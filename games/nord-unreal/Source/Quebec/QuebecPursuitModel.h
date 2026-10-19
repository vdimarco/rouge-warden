#pragma once

// Engine-independent police driving: target prediction, chase speed, and routes over the surveyed road segments.
// No Unreal includes, so Scripts/test_heat_model.py can build and run it with the system compiler.
// Positions are planar map centimetres (east, north); speeds are cm/s.

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <limits>
#include <utility>
#include <vector>

namespace QuebecPursuit
{
    struct FVec2
    {
        double X = 0.0;
        double Y = 0.0;
        FVec2 operator+(const FVec2& Other) const { return {X + Other.X, Y + Other.Y}; }
        FVec2 operator-(const FVec2& Other) const { return {X - Other.X, Y - Other.Y}; }
        FVec2 operator*(double Scale) const { return {X * Scale, Y * Scale}; }
    };

    inline double Dot(const FVec2& A, const FVec2& B) { return A.X * B.X + A.Y * B.Y; }
    inline double Length(const FVec2& V) { return std::sqrt(Dot(V, V)); }
    inline double Distance(const FVec2& A, const FVec2& B) { return Length(A - B); }
    inline FVec2 Normal(const FVec2& V)
    {
        const double Size = Length(V);
        return Size > 1e-9 ? V * (1.0 / Size) : FVec2{};
    }

    inline FVec2 ClosestOnSegment(const FVec2& Point, const FVec2& A, const FVec2& B, double& Alpha)
    {
        const FVec2 Along = B - A;
        const double Squared = Dot(Along, Along);
        Alpha = Squared > 1e-9 ? std::clamp(Dot(Point - A, Along) / Squared, 0.0, 1.0) : 0.0;
        return A + Along * Alpha;
    }

    // Reynolds pursuit: aim where the quarry will be, leading by the time to close the gap, at most MaxLead.
    inline constexpr double MaxLead = 1.2;
    inline constexpr double MinClosingSpeed = 500.0;
    // Within this range a police car drives straight at the predicted point instead of following roads.
    inline constexpr double DirectRange = 4000.0;

    inline FVec2 PredictTarget(const FVec2& Pursuer, const FVec2& PursuerVelocity, const FVec2& Quarry, const FVec2& QuarryVelocity)
    {
        const FVec2 Gap = Quarry - Pursuer;
        const double Range = Length(Gap);
        if (Range <= 1e-6) return Quarry;
        const double Closing = Dot(PursuerVelocity - QuarryVelocity, Gap * (1.0 / Range));
        const double Lead = std::clamp(Range / std::max(Closing, MinClosingSpeed), 0.0, MaxLead);
        return Quarry + QuarryVelocity * Lead;
    }

    // Catch up while far and out of sight, never out-drag a nearby player by much, and stop short of one on foot.
    inline double ChaseSpeed(double Range, double QuarrySpeed, bool bQuarryDriving)
    {
        if (!bQuarryDriving && Range < DirectRange) return std::clamp((Range - 1000.0) * 1.2, 0.0, 1500.0);
        if (Range > 12000.0) return 2950.0;
        if (Range > 3000.0) return 2600.0;
        return std::clamp(QuarrySpeed + 350.0, 1200.0, 2800.0);
    }

    // Slow for the turn ahead: full speed when straight, about 800 cm/s through a right angle.
    inline double CornerSpeed(double TurnDegrees)
    {
        return 2700.0 - 1900.0 * std::clamp(TurnDegrees / 90.0, 0.0, 1.0);
    }

    // Point Distance ahead along Path from From. Waypoints within ReachRadius count as reached and Index moves past them.
    inline FVec2 Lookahead(const std::vector<FVec2>& Path, std::size_t& Index, const FVec2& From, double Ahead, double ReachRadius = 900.0)
    {
        if (Path.empty()) return From;
        while (Index + 1 < Path.size() && Distance(From, Path[Index]) < ReachRadius) ++Index;
        Index = std::min(Index, Path.size() - 1);
        FVec2 Cursor = From;
        double Left = Ahead;
        for (std::size_t Step = Index; Step < Path.size(); ++Step)
        {
            const double Leg = Distance(Cursor, Path[Step]);
            if (Leg >= Left) return Cursor + Normal(Path[Step] - Cursor) * Left;
            Left -= Leg;
            Cursor = Path[Step];
        }
        return Path.back();
    }

    // Largest heading change at a waypoint within Range ahead, in degrees, for braking before corners.
    inline double TurnAhead(const std::vector<FVec2>& Path, std::size_t Index, const FVec2& From, const FVec2& Heading, double Range)
    {
        double Turn = 0.0, Travelled = 0.0;
        FVec2 Previous = From, Direction = Normal(Heading);
        for (std::size_t Step = Index; Step < Path.size() && Travelled <= Range; ++Step)
        {
            const FVec2 Next = Normal(Path[Step] - Previous);
            if (Length(Next) > .5)
            {
                const double Cosine = std::clamp(Dot(Direction, Next), -1.0, 1.0);
                Turn = std::max(Turn, std::acos(Cosine) * 180.0 / 3.14159265358979323846);
                Direction = Next;
            }
            Travelled += Distance(Previous, Path[Step]);
            Previous = Path[Step];
        }
        return Turn;
    }

    struct FSegment
    {
        FVec2 A;
        FVec2 B;
    };

    // Segment endpoints within JoinDistance are one junction, as in the traffic graph.
    class FRoadGraph
    {
    public:
        void Build(const std::vector<FSegment>& Segments, double JoinDistance = 40.0)
        {
            Nodes.clear();
            Ends.clear();
            Open.assign(Segments.size(), true);
            Links.clear();
            const auto NodeFor = [this, JoinDistance](const FVec2& Point)
            {
                for (std::size_t Index = 0; Index < Nodes.size(); ++Index)
                    if (Distance(Nodes[Index], Point) <= JoinDistance) return static_cast<int>(Index);
                Nodes.push_back(Point);
                Links.emplace_back();
                return static_cast<int>(Nodes.size() - 1);
            };
            for (std::size_t Index = 0; Index < Segments.size(); ++Index)
            {
                const int First = NodeFor(Segments[Index].A);
                const int Second = NodeFor(Segments[Index].B);
                Ends.emplace_back(First, Second);
                if (First == Second) { Open[Index] = false; continue; }
                Links[static_cast<std::size_t>(First)].push_back(static_cast<int>(Index));
                Links[static_cast<std::size_t>(Second)].push_back(static_cast<int>(Index));
            }
        }

        int SegmentCount() const { return static_cast<int>(Ends.size()); }
        int NodeCount() const { return static_cast<int>(Nodes.size()); }
        bool IsOpen(int Segment) const { return Segment >= 0 && Segment < SegmentCount() && Open[static_cast<std::size_t>(Segment)]; }
        void SetOpen(int Segment, bool bOpen)
        {
            if (Segment >= 0 && Segment < SegmentCount() && Ends[static_cast<std::size_t>(Segment)].first != Ends[static_cast<std::size_t>(Segment)].second)
                Open[static_cast<std::size_t>(Segment)] = bOpen;
        }
        FVec2 SegmentStart(int Segment) const { return Nodes[static_cast<std::size_t>(Ends[static_cast<std::size_t>(Segment)].first)]; }
        FVec2 SegmentEnd(int Segment) const { return Nodes[static_cast<std::size_t>(Ends[static_cast<std::size_t>(Segment)].second)]; }

        // Nearest open segment to Point and the closest point on it; -1 when every segment is closed.
        int Nearest(const FVec2& Point, FVec2& Closest) const
        {
            int Best = -1;
            double BestDistance = std::numeric_limits<double>::max();
            for (int Segment = 0; Segment < SegmentCount(); ++Segment)
            {
                if (!Open[static_cast<std::size_t>(Segment)]) continue;
                double Alpha = 0.0;
                const FVec2 Candidate = ClosestOnSegment(Point, SegmentStart(Segment), SegmentEnd(Segment), Alpha);
                const double Gap = Distance(Point, Candidate);
                if (Gap < BestDistance) { BestDistance = Gap; Best = Segment; Closest = Candidate; }
            }
            return Best;
        }

        // Shortest route over open segments from From (moving along Heading) to the road point nearest To.
        // Turning back costs UTurnCost extra. Out receives the junctions to pass and ends at that road point.
        bool Route(const FVec2& From, const FVec2& Heading, const FVec2& To, std::vector<FVec2>& Out, double UTurnCost = 3000.0) const
        {
            Out.clear();
            FVec2 Start, Goal;
            const int StartSegment = Nearest(From, Start);
            const int GoalSegment = Nearest(To, Goal);
            if (StartSegment < 0 || GoalSegment < 0) return false;
            if (StartSegment == GoalSegment)
            {
                Out.push_back(Goal);
                return true;
            }
            const std::size_t Count = Nodes.size();
            std::vector<double> Cost(Count, std::numeric_limits<double>::max());
            std::vector<int> Previous(Count, -1);
            using FEntry = std::pair<double, int>;
            std::vector<FEntry> Heap;
            const auto Push = [&Heap](double Value, int Node)
            {
                Heap.emplace_back(Value, Node);
                std::push_heap(Heap.begin(), Heap.end(), std::greater<FEntry>());
            };
            const FVec2 Facing = Normal(Heading);
            for (const int Node : {Ends[static_cast<std::size_t>(StartSegment)].first, Ends[static_cast<std::size_t>(StartSegment)].second})
            {
                const FVec2 Toward = Nodes[static_cast<std::size_t>(Node)] - Start;
                const double Value = Distance(From, Start) + Length(Toward) + (Dot(Facing, Toward) < 0.0 && Length(Facing) > .5 ? UTurnCost : 0.0);
                if (Value < Cost[static_cast<std::size_t>(Node)]) { Cost[static_cast<std::size_t>(Node)] = Value; Push(Value, Node); }
            }
            while (!Heap.empty())
            {
                std::pop_heap(Heap.begin(), Heap.end(), std::greater<FEntry>());
                const FEntry Top = Heap.back();
                Heap.pop_back();
                const std::size_t Node = static_cast<std::size_t>(Top.second);
                if (Top.first > Cost[Node]) continue;
                for (const int Segment : Links[Node])
                {
                    if (!Open[static_cast<std::size_t>(Segment)]) continue;
                    const std::pair<int, int>& Pair = Ends[static_cast<std::size_t>(Segment)];
                    const int Other = Pair.first == Top.second ? Pair.second : Pair.first;
                    const double Value = Top.first + Distance(Nodes[Node], Nodes[static_cast<std::size_t>(Other)]);
                    if (Value < Cost[static_cast<std::size_t>(Other)])
                    {
                        Cost[static_cast<std::size_t>(Other)] = Value;
                        Previous[static_cast<std::size_t>(Other)] = Top.second;
                        Push(Value, Other);
                    }
                }
            }
            int Last = -1;
            double Best = std::numeric_limits<double>::max();
            for (const int Node : {Ends[static_cast<std::size_t>(GoalSegment)].first, Ends[static_cast<std::size_t>(GoalSegment)].second})
            {
                const std::size_t Index = static_cast<std::size_t>(Node);
                if (Cost[Index] == std::numeric_limits<double>::max()) continue;
                const double Value = Cost[Index] + Distance(Nodes[Index], Goal);
                if (Value < Best) { Best = Value; Last = Node; }
            }
            if (Last < 0) return false;
            for (int Node = Last; Node >= 0; Node = Previous[static_cast<std::size_t>(Node)]) Out.push_back(Nodes[static_cast<std::size_t>(Node)]);
            std::reverse(Out.begin(), Out.end());
            Out.push_back(Goal);
            return true;
        }

        // A point on an open segment within Radius of Center, chosen from Seed; false when none is that close.
        bool PointNear(const FVec2& Center, double Radius, uint32_t Seed, FVec2& Out) const
        {
            std::vector<int> Candidates;
            for (int Segment = 0; Segment < SegmentCount(); ++Segment)
            {
                if (!Open[static_cast<std::size_t>(Segment)]) continue;
                double Alpha = 0.0;
                if (Distance(Center, ClosestOnSegment(Center, SegmentStart(Segment), SegmentEnd(Segment), Alpha)) <= Radius)
                    Candidates.push_back(Segment);
            }
            if (Candidates.empty()) return false;
            const uint32_t Mixed = Seed * 2654435761u + 0x9e3779b9u;
            const int Segment = Candidates[Mixed % static_cast<uint32_t>(Candidates.size())];
            const double Alpha = static_cast<double>((Mixed >> 8) % 1001u) / 1000.0;
            Out = SegmentStart(Segment) + (SegmentEnd(Segment) - SegmentStart(Segment)) * Alpha;
            return true;
        }

    private:
        std::vector<FVec2> Nodes;
        std::vector<std::pair<int, int>> Ends;
        std::vector<bool> Open;
        std::vector<std::vector<int>> Links;
    };
}
