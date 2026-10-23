// Standalone test for Source/Quebec/QuebecGauntletModel.h and QuebecGauntletRoute.h. Built and run by Scripts/test_gauntlet_model.py.
// argv[1] is Data/Gauntlet/fixtures/frametimes.csv. The route checks read the real LaFontaine road set straight from
// Source/Quebec/LaFontaineMap.h and LaFontaineExtensionMap.h through one-line FVector and int8 stubs, so they cannot go stale.
// With QUEBEC_GAUNTLET_STRICT the Unreal macro names are poisoned before the model headers are read, so they cannot use them.

#ifdef QUEBEC_GAUNTLET_STRICT
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <limits>
#include <string>
#include <utility>
#include <vector>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FString TArray
#endif
#include "../Source/Quebec/QuebecGauntletModel.h"
#include "../Source/Quebec/QuebecSteerAssist.h"

// The map headers are plain C++ arrays of FVector rows.
using int8 = signed char;
struct FVector
{
    double X, Y, Z;
    constexpr FVector(double InX, double InY, double InZ) : X(InX), Y(InY), Z(InZ) {}
};
#include "../Source/Quebec/LaFontaineMap.h"
#include "../Source/Quebec/LaFontaineExtensionMap.h"

#include <cstdarg>
#include <cstdio>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

using namespace QuebecGauntlet;
using QuebecPursuit::FRoadGraph;
using QuebecPursuit::FSegment;

namespace
{
    int Failures = 0;
    int Assertions = 0;

    // Limits of the checks, as in Data/Gauntlet/loop.json "route" and "drive".
    constexpr double LengthMin = 250000.0;
    constexpr double LengthMax = 350000.0;
    constexpr double StopRoadMax = 5000.0;
    constexpr double EndWithin = 800.0;
    constexpr double LateralMax = 250.0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    bool Near(double A, double B, double Tolerance)
    {
        return std::fabs(A - B) <= Tolerance;
    }

    // Largest heading change at any point of a closed loop, in degrees.
    double SharpestTurn(const FLoop& Loop)
    {
        double Sharpest = 0.0;
        const std::size_t Count = static_cast<std::size_t>(Loop.SegmentCount());
        for (std::size_t Index = 0; Index < Count; ++Index)
        {
            const FVec2 In = QuebecPursuit::Normal(Loop.Points[Index + 1] - Loop.Points[Index]);
            const FVec2 Out = QuebecPursuit::Normal(Loop.Points[(Index + 1) % Count + 1] - Loop.Points[(Index + 1) % Count]);
            Sharpest = std::max(Sharpest, std::acos(std::clamp(QuebecPursuit::Dot(In, Out), -1.0, 1.0)) * 180.0 / Pi);
        }
        return Sharpest;
    }

    // Distance from Point to the nearest of Segments.
    double Gap(const FVec2& Point, const std::vector<FSegment>& Segments)
    {
        double Best = std::numeric_limits<double>::max(), Alpha = 0.0;
        for (const FSegment& Segment : Segments) Best = std::min(Best, QuebecPursuit::Distance(Point, QuebecPursuit::ClosestOnSegment(Point, Segment.A, Segment.B, Alpha)));
        return Best;
    }

    // The largest Gap of any point of the loop line, sampled every tenth of a segment.
    double FarthestFrom(const FLoop& Loop, const std::vector<FSegment>& Segments)
    {
        double Farthest = 0.0;
        for (std::size_t Index = 0; Index + 1 < Loop.Points.size(); ++Index)
            for (int Step = 0; Step < 10; ++Step)
                Farthest = std::max(Farthest, Gap(Loop.Points[Index] + (Loop.Points[Index + 1] - Loop.Points[Index]) * (Step / 10.0), Segments));
        return Farthest;
    }

    double SlowestLimit(const FLoop& Loop)
    {
        double Slowest = SpeedCap;
        for (std::size_t Segment = 0; Segment < Loop.Points.size(); ++Segment) Slowest = std::min(Slowest, Loop.LimitAt(Segment));
        return Slowest;
    }

    // Segments of Loop driven at Speed.
    int SegmentsAt(const FLoop& Loop, double Speed)
    {
        int Count = 0;
        for (int Segment = 0; Segment < Loop.SegmentCount(); ++Segment) Count += Near(Loop.LimitAt(static_cast<std::size_t>(Segment)), Speed, 1e-9);
        return Count;
    }

    std::vector<FSegment> Polyline(const std::vector<FVec2>& Points)
    {
        std::vector<FSegment> Segments;
        for (std::size_t Index = 0; Index + 1 < Points.size(); ++Index) Segments.push_back({Points[Index], Points[Index + 1]});
        return Segments;
    }

    std::vector<FSegment> RadarSegments()
    {
        std::vector<FSegment> Segments;
        for (const auto& Row : LaFontaineExtension::RadarRoadSegments) Segments.push_back({{Row[0].X, Row[0].Y}, {Row[1].X, Row[1].Y}});
        return Segments;
    }

    FLoop PlateauLoop()
    {
        FRoadGraph Graph;
        Graph.Build(RadarSegments());
        FLoop Loop;
        Expect(BuildLoop(Graph, RouteEyes(), Loop), "the Plateau loop builds over the LaFontaine radar roads");
        return Loop;
    }

    // ------------------------------------------------------------------ the generated route and the loop

    void TestRouteHeader()
    {
        Expect(QuebecGauntletRoute::StopCount == 5, "five stops");
        Expect(QuebecGauntletRoute::EyeFieldOfView == 85.0, "eye views use the game camera's 85 degrees");
        const char* Labels[] = {"S1", "S2", "S3", "S4", "S5"};
        for (int Stop = 0; Stop < QuebecGauntletRoute::StopCount; ++Stop)
        {
            Expect(StopLabel(Stop) == Labels[Stop], "stop %d is %s", Stop, Labels[Stop]);
            const QuebecGauntletRoute::FStop& Row = QuebecGauntletRoute::Stops[Stop];
            Expect(QuebecPursuit::Distance({Row.EyeX, Row.EyeY}, {Row.TargetX, Row.TargetY}) > 1000.0, "%s looks along its street", Row.Label);
        }
        Expect(LegName(0) == "S1-S2" && LegName(4) == "S5-S1", "legs are named from stop to stop and the last returns to S1");
        Expect(StopLabel(-1) == "?" && StopLabel(5) == "?", "a stop out of range has no label");
    }

    void TestPlateauLoop()
    {
        const FLoop Loop = PlateauLoop();
        if (Loop.Points.size() < 2) return;
        Expect(Loop.Length >= LengthMin && Loop.Length <= LengthMax, "loop length %.0f m is 2.5 to 3.5 km", Loop.Length / 100.0);
        Expect(QuebecPursuit::Distance(Loop.Points.front(), Loop.Points.back()) < 1e-6, "the loop closes on the first stop");
        Expect(Loop.StopCount() == 5 && Loop.Stops[0] == 0, "five stops, the first at the start");
        double Legs = 0.0;
        std::printf("Plateau loop %.0f m over %d points; legs", Loop.Length / 100.0, static_cast<int>(Loop.Points.size()));
        for (int Leg = 0; Leg < Loop.StopCount(); ++Leg)
        {
            Expect(Leg == 0 || Loop.Stops[static_cast<std::size_t>(Leg)] > Loop.Stops[static_cast<std::size_t>(Leg - 1)], "stops in drive order");
            Expect(Loop.LegLength(Leg) > 10000.0, "leg %s is longer than 100 m (%.0f m)", LegName(Leg).c_str(), Loop.LegLength(Leg) / 100.0);
            Legs += Loop.LegLength(Leg);
            const FVec2 Eye = RouteEyes()[static_cast<std::size_t>(Leg)];
            const double Gap = QuebecPursuit::Distance(Eye, Loop.Points[Loop.Stops[static_cast<std::size_t>(Leg)]]);
            Expect(Gap <= StopRoadMax, "stop %s road point is %.0f m from its eye", StopLabel(Leg).c_str(), Gap / 100.0);
            std::printf(" %s %.0f m (road point %.0f m from the eye)%s", LegName(Leg).c_str(), Loop.LegLength(Leg) / 100.0, Gap / 100.0,
                Leg + 1 < Loop.StopCount() ? "," : "\n");
        }
        Expect(Near(Legs, Loop.Length, 1e-6), "legs add up to the loop");
        const double Turn = SharpestTurn(Loop);
        Expect(Turn <= RoundFrom + 1e-6, "every corner is an arc and the loop never turns back (sharpest step %.1f degrees)", Turn);
        const double Off = FarthestFrom(Loop, RadarSegments());
        Expect(Off <= MaxCut + Simplify, "the driven line keeps within 4 m of a road centre line (%.2f m)", Off / 100.0);
        Expect(static_cast<int>(Loop.Limit.size()) == static_cast<int>(Loop.Points.size()) && SlowestLimit(Loop) >= MinCornerSpeed, "every segment has a speed");
        std::printf("Plateau loop: farthest from a road centre line %.2f m, slowest corner %.1f m/s\n", Off / 100.0, SlowestLimit(Loop) / 100.0);
        // How much of the loop runs on the east extension, which LaFontaineExtensionMap.h appends after the original roads.
        const std::size_t Original = sizeof(LaFontaine::RoadSegments) / sizeof(LaFontaine::RoadSegments[0]);
        const std::vector<FSegment> Radar = RadarSegments();
        double Extension = 0.0;
        for (int Segment = 0; Segment < Loop.SegmentCount(); ++Segment)
        {
            const FVec2 Middle = (Loop.Points[static_cast<std::size_t>(Segment)] + Loop.Points[static_cast<std::size_t>(Segment) + 1]) * .5;
            std::size_t Nearest = 0;
            double Best = std::numeric_limits<double>::max(), Alpha = 0.0;
            for (std::size_t Index = 0; Index < Radar.size(); ++Index)
            {
                const double Gap = QuebecPursuit::Distance(Middle, QuebecPursuit::ClosestOnSegment(Middle, Radar[Index].A, Radar[Index].B, Alpha));
                if (Gap < Best) { Best = Gap; Nearest = Index; }
            }
            if (Nearest >= Original) Extension += Loop.Distance[static_cast<std::size_t>(Segment) + 1] - Loop.Distance[static_cast<std::size_t>(Segment)];
        }
        std::printf("Plateau loop: sharpest turn %.1f degrees, %.0f m on the east extension roads (%d original segments)\n", Turn, Extension / 100.0,
            static_cast<int>(Original));
    }

    // A 3 by 3 grid of 100 m blocks with stops mid-block: the loop closes and never turns back at a stop.
    void TestGridLoop()
    {
        std::vector<FSegment> Segments;
        for (int Line = 0; Line <= 3; ++Line)
            for (int Block = 0; Block < 3; ++Block)
            {
                Segments.push_back({{Block * 10000.0, Line * 10000.0}, {(Block + 1) * 10000.0, Line * 10000.0}});
                Segments.push_back({{Line * 10000.0, Block * 10000.0}, {Line * 10000.0, (Block + 1) * 10000.0}});
            }
        FRoadGraph Graph;
        Graph.Build(Segments);
        FLoop Loop;
        // The third stop is on the first stop's street, behind it: the loop goes round a block instead of turning back.
        Expect(BuildLoop(Graph, {{5000.0, -800.0}, {25000.0, 30800.0}, {2000.0, 800.0}}, Loop), "the grid loop builds");
        Expect(QuebecPursuit::Distance(Loop.Points.front(), Loop.Points.back()) < 1e-6 && Loop.StopCount() == 3, "the grid loop closes with three stops");
        Expect(SharpestTurn(Loop) <= RoundFrom + 1e-6, "the grid loop turns only on arcs (sharpest step %.1f degrees)", SharpestTurn(Loop));
        const FVec2 Road[] = {{5000.0, 0.0}, {25000.0, 30000.0}, {2000.0, 0.0}};
        for (int Stop = 0; Stop < Loop.StopCount(); ++Stop)
            Expect(QuebecPursuit::Distance(Loop.Points[Loop.Stops[static_cast<std::size_t>(Stop)]], Road[Stop]) < 1e-6, "grid stop %d stays on its road point", Stop);
        // The loop reaches the third stop from the west, so the last leg runs straight on to the first: a 1200 m tour
        // with eight right-angle arcs.
        const double Radius = TurnRadius(800.0) * CornerMargin;
        Expect(Near(Loop.LegLength(2), 3000.0, 1e-6) && SegmentsAt(Loop, 800.0) == 8 * 9, "the third stop is reached from the west (%.0f m on, %d arc chords)",
            Loop.LegLength(2) / 100.0, SegmentsAt(Loop, 800.0));
        Expect(Near(Loop.Length, 120000.0 - 8.0 * (2.0 - Pi / 2.0) * Radius, 50.0), "the grid tour is 1200 m less the arcs (%.1f m)", Loop.Length / 100.0);
        Expect(Near(Loop.StopAlong(0), 0.0, 1e-9) && Near(Loop.LegLength(0) + Loop.LegLength(1) + Loop.LegLength(2), Loop.Length, 1e-6), "leg lengths");
        Expect(Near(Loop.PointAt(Loop.Length + 100.0).X, Loop.PointAt(100.0).X, 1e-6) && Near(Loop.PointAt(-100.0).Y, Loop.PointAt(Loop.Length - 100.0).Y, 1e-6),
            "arc lengths wrap onto the loop");
        FLoop Short;
        Expect(!BuildLoop(Graph, {{5000.0, 0.0}}, Short), "one stop is no loop");
    }

    // FinishLoop: arcs at the police corner speed, merged corners, the cut limit, and stops that never move.
    void TestCorners()
    {
        // A 100 m square with the stop mid-side: four right-angle arcs at CornerSpeed(90) = 8 m/s.
        const std::vector<FVec2> SquareLine = {{5000.0, 0.0}, {10000.0, 0.0}, {10000.0, 10000.0}, {0.0, 10000.0}, {0.0, 0.0}, {5000.0, 0.0}};
        FLoop Square;
        Square.Points = SquareLine;
        Square.Stops = {0};
        FinishLoop(Square);
        const double Radius = TurnRadius(800.0) * CornerMargin;
        Expect(Square.Stops.size() == 1 && Square.Stops[0] == 0 && QuebecPursuit::Distance(Square.Points[0], {5000.0, 0.0}) < 1e-9, "the stop stays on its road point");
        Expect(SegmentsAt(Square, 800.0) == 36 && SegmentsAt(Square, SpeedCap) == 5 && Square.Limit.size() == Square.Points.size(),
            "four arcs of nine chords at 8 m/s and five straights at the cap (%d, %d)", SegmentsAt(Square, 800.0), SegmentsAt(Square, SpeedCap));
        Expect(Near(Square.Length, 40000.0 - 4.0 * (2.0 - Pi / 2.0) * Radius, 20.0), "the arcs shorten the square by 4 (2 - pi / 2) R (%.1f cm)", Square.Length);
        Expect(Near(Gap({10000.0, 0.0}, Polyline(Square.Points)), Radius * (std::sqrt(2.0) - 1.0), .01 * Radius), "a right-angle arc passes R (sqrt 2 - 1) from the corner");
        Expect(Near(FarthestFrom(Square, Polyline(SquareLine)), Radius * (1.0 - std::cos(Pi / 4.0)), .01 * Radius), "and cuts the corner by R (1 - cos 45)");
        Expect(TurnRadius(800.0) > TurnRadius(300.0) && TurnRadius(1500.0) > TurnRadius(800.0) && Near(TurnRadius(0.0), 310.0 / std::tan(30.0 * Pi / 180.0), 1e-3),
            "the turning radius grows with speed from the 30 degree lock");

        // Two 45 degree turns 2.8 m apart merge into one right-angle arc where the long sides meet.
        FLoop Chamfer;
        Chamfer.Points = {{5000.0, 0.0}, {10000.0, 0.0}, {10200.0, 200.0}, {10200.0, 10000.0}, {0.0, 10000.0}, {0.0, 0.0}, {5000.0, 0.0}};
        Chamfer.Stops = {0};
        FinishLoop(Chamfer);
        Expect(SegmentsAt(Chamfer, 800.0) == 36 && SlowestLimit(Chamfer) == 800.0, "two 45 degree turns 2.8 m apart become one right-angle arc (%d chords at 8 m/s)",
            SegmentsAt(Chamfer, 800.0));
        Expect(Near(Gap({10200.0, 0.0}, Polyline(Chamfer.Points)), Radius * (std::sqrt(2.0) - 1.0), .01 * Radius), "centred on the corner where the long sides meet");

        // A 120 degree turn: the police radius would pass 4.7 m inside, so the arc shrinks to pass 3 m inside, more slowly.
        const std::vector<FVec2> SharpLine = {{0.0, 0.0}, {20000.0, 0.0}, {20000.0 - 10000.0, 10000.0 * std::sqrt(3.0)}, {0.0, 0.0}};
        FLoop Sharp;
        Sharp.Points = SharpLine;
        Sharp.Stops = {0};
        FinishLoop(Sharp);
        Expect(Near(FarthestFrom(Sharp, Polyline(SharpLine)), MaxCut, 2.0), "a sharp arc passes MaxCut inside its corner (%.1f cm)", FarthestFrom(Sharp, Polyline(SharpLine)));
        // The 6 m arc is tighter than any turning circle with CornerMargin to spare, so it gets the floor speed, at which
        // the car still turns inside it.
        const double SharpSpeed = SlowestLimit(Sharp);
        Expect(SharpSpeed == SpeedForRadius(MaxCut / (1.0 - std::cos(Pi / 3.0)), 800.0) && SharpSpeed == MinCornerSpeed
            && TurnRadius(SharpSpeed) <= MaxCut / (1.0 - std::cos(Pi / 3.0)), "at the floor speed, whose turning circle fits the arc (%.0f cm/s)", SharpSpeed);
        Expect(SpeedForRadius(1.0, 800.0) == MinCornerSpeed && SpeedForRadius(1.0e6, 800.0) == 800.0, "speed for a radius is between MinCornerSpeed and the start");

        // A short side shared by two right-angle arcs: each takes half, so both shrink and slow down.
        FLoop Narrow;
        Narrow.Points = {{5000.0, 0.0}, {10000.0, 0.0}, {10000.0, 1000.0}, {0.0, 1000.0}, {0.0, 0.0}, {5000.0, 0.0}};
        Narrow.Stops = {0};
        FinishLoop(Narrow);
        Expect(SlowestLimit(Narrow) < 800.0 && SegmentsAt(Narrow, 800.0) == 18 && QuebecPursuit::Distance(Narrow.Points[Narrow.Stops[0]], {5000.0, 0.0}) < 1e-9,
            "a 10 m side halves the two arcs at its ends and slows them (%.0f cm/s)", SlowestLimit(Narrow));
    }

    // The tracker keeps to its own pass of a street the loop drives twice, 3 m apart.
    void TestTracker()
    {
        FLoop Loop;
        Loop.Points = {{0.0, 0.0}, {10000.0, 0.0}, {10000.0, 300.0}, {0.0, 300.0}, {0.0, 0.0}};
        Loop.Stops = {0, 2};
        Loop.Distance = {0.0, 10000.0, 10300.0, 20300.0, 20600.0};
        Loop.Length = 20600.0;
        FTracker Tracker;
        for (double X = 500.0; X <= 9000.0; X += 500.0) Track(Tracker, Loop, {X, 140.0});
        Expect(Tracker.Segment == 0 && Near(Tracker.Along, 9000.0, 1e-6) && Near(Tracker.Offset, 140.0, 1e-6), "the tracker stays on the first pass");
        Track(Tracker, Loop, {10000.0, 150.0});
        for (double X = 9600.0; X >= 400.0; X -= 400.0) Track(Tracker, Loop, {X, 160.0});
        Expect(Tracker.Segment == 2 && Near(Tracker.Along, 10300.0 + 10000.0 - 400.0, 1e-6), "and moves to the return pass only by driving round");
        Track(Tracker, Loop, {0.0, 100.0});
        Track(Tracker, Loop, {200.0, 0.0});
        Expect(Near(Tracker.Along, 20800.0, 1e-6), "along is unwrapped across the start (%.1f)", Tracker.Along);
        FTracker Behind;
        Track(Behind, Loop, {0.0, 50.0});
        Expect(Near(Behind.Along, -50.0, 1e-6), "a car just behind the start is slightly negative (%.1f)", Behind.Along);
    }

    // ------------------------------------------------------------------ the driver against a kinematic car

    struct FCar
    {
        FVec2 Position;
        double Yaw = 0.0;
        float Speed = 0.f;
        float SteeringState = 0.f;
        float DriveThrottle = 0.f;
    };

    // AQuebecCar's player step (QuebecGameplay.cpp, the !bTraffic branch) without the road assist, collision or slip.
    void StepCar(FCar& Car, const FControls& Controls, float Step, float SpeedLimit)
    {
        const float Throttle = static_cast<float>(Controls.Pedal);
        const float Steering = static_cast<float>(Controls.Wheel);
        Car.DriveThrottle = QuebecSteer::MoveToward(Car.DriveThrottle, Throttle, Step, 5.f);
        Car.SteeringState = QuebecSteer::MoveToward(Car.SteeringState, Steering, Step, QuebecSteer::TurnInRate(Car.Speed, Steering, Car.SteeringState, false));
        if (Controls.bBrake) Car.Speed = QuebecSteer::MoveToward(Car.Speed, 0.f, Step, 2300.f);
        else if (Throttle * Car.Speed < 0.f)
        {
            Car.Speed = QuebecSteer::MoveToward(Car.Speed, 0.f, Step, 3200.f * std::fabs(Throttle));
            if (Car.Speed == 0.f) Car.DriveThrottle = 0.f;
        }
        else if (std::fabs(Throttle) > .01f)
        {
            const float Corner = QuebecSteer::Lerp(2400.f, 900.f, QuebecSteer::Clamp((std::fabs(Car.SteeringState) - .2f) / .8f, 0.f, 1.f));
            if (Throttle > 0.f && std::fabs(Car.SteeringState) > .2f && Car.Speed > Corner) Car.Speed = QuebecSteer::MoveToward(Car.Speed, Corner, Step, 1200.f);
            else
            {
                const float Power = QuebecSteer::Lerp(1050.f, 700.f, QuebecSteer::Clamp(std::fabs(Car.Speed) / 3000.f, 0.f, 1.f));
                const float Sign = Throttle > 0.f ? 1.f : -1.f;
                Car.Speed += std::max(0.f, Car.DriveThrottle * Sign) * Sign * Power * Step;
                Car.Speed = QuebecSteer::MoveToward(Car.Speed, 0.f, Step, 100.f + Car.Speed * Car.Speed * .000035f);
            }
        }
        else Car.Speed = QuebecSteer::MoveToward(Car.Speed, 0.f, Step, 360.f + Car.Speed * Car.Speed * .000035f);
        Car.Speed = QuebecSteer::Clamp(Car.Speed, -std::min(950.f, SpeedLimit), std::min(3000.f, SpeedLimit));
        if (std::fabs(Car.Speed) > 15.f) Car.Yaw += static_cast<double>(QuebecSteer::YawRateFor(Car.Speed, Car.SteeringState, Controls.bBrake) * Step);
        const double Radians = Car.Yaw * Pi / 180.0;
        Car.Position = Car.Position + FVec2{std::cos(Radians), std::sin(Radians)} * (static_cast<double>(Car.Speed) * static_cast<double>(Step));
    }

    struct FDriveResult
    {
        EExit Exit = EExit::Running;
        double Seconds = 0.0;
        double FinishedAt = 0.0;
        double LegStartedAt = -1.0;
        double MaxOffset = 0.0;
        double LongestCrawl = 0.0;
        double EndGap = 0.0;
        double MeasuredDriving = 0.0;
        int Reversals = 0;
        bool bOrdered = true;
        std::string Events;
    };

    // Drive the loop at Rate ticks per second. A blocked car never moves; SpeedLimit caps a crawling car.
    FDriveResult DriveLoop(const FLoop& Loop, const FRunSettings& Settings, double Rate, bool bBlocked = false, float SpeedLimit = 1.e6f)
    {
        FDriveResult Result;
        FRun Run;
        Begin(Run, Loop, Settings, 0.0, true, false);
        FCar Car;
        Car.Position = Loop.Points[0];
        Car.Yaw = Loop.StartYaw();
        const double Step = 1.0 / Rate;
        const double Limit = Settings.Delay + 2.0 * ReadyGrace + (Settings.WarmLaps + Settings.Laps + 1) * (MaxLapSeconds + 5.0 * Settings.Hold);
        double Now = 0.0, Crawl = 0.0;
        int ExpectStop = 0, ExpectLeg = 0, ExpectLap = 1 - Settings.WarmLaps;
        for (; Now < Limit && !Finished(Run); Now += Step)
        {
            const FStep Out = Tick(Run, Now, Step, Car.Position, Car.Yaw, static_cast<double>(Car.Speed), true);
            switch (Out.Event)
            {
            case EEvent::WarmBegin:
                Result.Events += "W" + std::to_string(Out.Lap) + " ";
                Result.bOrdered &= Out.Lap == ExpectLap++ && Out.Leg == 0;
                break;
            case EEvent::HoldBegin:
                Result.Events += "H" + StopLabel(Out.Stop) + " ";
                Result.bOrdered &= Out.Stop == ExpectStop && Out.Lap >= 1 && Settings.Hold > 0.0;
                ExpectLeg = ExpectStop;
                break;
            case EEvent::LegBegin:
                Result.Events += LegName(Out.Leg) + " ";
                Result.bOrdered &= Out.Leg == (Settings.Hold > 0.0 ? ExpectLeg : ExpectStop) && Out.Lap >= 1;
                ExpectStop = (Out.Leg + 1) % Loop.StopCount();
                if (Result.LegStartedAt < 0.0) Result.LegStartedAt = Now;
                break;
            case EEvent::Done: Result.Events += "done"; Result.bOrdered &= ExpectStop == 0 && Out.Lap == Settings.Laps; break;
            case EEvent::Fail: Result.Events += std::string("fail:") + ExitName(Run.Exit); break;
            case EEvent::None: break;
            }
            if (Finished(Run)) break;
            const bool bDriving = Run.Phase == EPhase::WarmLap || Run.Phase == EPhase::Measure;
            if (bDriving)
            {
                Result.MaxOffset = std::max(Result.MaxOffset, Run.Tracker.Offset);
                Crawl = std::fabs(Car.Speed) < 100.f ? Crawl + Step : 0.0;
                Result.LongestCrawl = std::max(Result.LongestCrawl, Crawl);
            }
            if (Run.Phase == EPhase::Measure) Result.MeasuredDriving += Step;
            if (!bBlocked) StepCar(Car, Out.Controls, static_cast<float>(Step), SpeedLimit);
        }
        Result.Exit = Run.Exit;
        Result.FinishedAt = Now;
        Result.Seconds = Now;
        Result.Reversals = Run.Driver.Reversals;
        Result.EndGap = QuebecPursuit::Distance(Car.Position, Loop.Points[0]);
        return Result;
    }

    void TestDrivenLaps()
    {
        const FLoop Loop = PlateauLoop();
        if (Loop.Points.size() < 2) return;
        for (const EMode Mode : {EMode::Perf, EMode::Stream, EMode::Look})
        {
            double Driving[2] = {0.0, 0.0};
            int Index = 0;
            for (const double Rate : {30.0, 120.0})
            {
                const FRunSettings Settings = ForMode(Mode);
                const FDriveResult Result = DriveLoop(Loop, Settings, Rate);
                const char* Name = ModeName(Mode);
                Expect(Result.Exit == EExit::Done, "%s at %.0f Hz completes the loop (%s; %s)", Name, Rate, ExitName(Result.Exit), Result.Events.c_str());
                Expect(Result.bOrdered, "%s at %.0f Hz visits the stops in order: %s", Name, Rate, Result.Events.c_str());
                Expect(Result.MaxOffset < LateralMax, "%s at %.0f Hz lateral error %.2f m is under 2.5 m", Name, Rate, Result.MaxOffset / 100.0);
                Expect(Result.Reversals == 0 && Result.LongestCrawl < 3.0, "%s at %.0f Hz never stalls (reversals %d, longest crawl %.2f s)", Name, Rate,
                    Result.Reversals, Result.LongestCrawl);
                Expect(Result.EndGap <= EndWithin, "%s at %.0f Hz ends %.1f m from the start", Name, Rate, Result.EndGap / 100.0);
                Expect(Result.MeasuredDriving <= MaxLapSeconds * Settings.Laps, "%s at %.0f Hz drives a lap in %.0f s", Name, Rate, Result.MeasuredDriving);
                // The delay and the first hold each end on the first tick at or after their time, so allow two ticks.
                Expect(Near(Result.LegStartedAt, Settings.Delay + (Settings.WarmLaps > 0 ? Result.MeasuredDriving : Settings.Hold), Settings.WarmLaps > 0 ? 400.0 : 2.0 / Rate + 1e-9),
                    "%s at %.0f Hz starts the first leg after the delay and the first hold (%.2f s)", Name, Rate, Result.LegStartedAt);
                std::printf("%s at %.0f Hz: lap %.1f s driving, finished at %.1f s, lateral error %.2f m, end %.1f m from start\n", Name, Rate,
                    Result.MeasuredDriving, Result.FinishedAt, Result.MaxOffset / 100.0, Result.EndGap / 100.0);
                Driving[Index++] = Result.MeasuredDriving;
            }
            Expect(std::fabs(Driving[0] - Driving[1]) <= .03 * Driving[1], "%s laps repeat across frame rates (%.1f s at 30 Hz, %.1f s at 120 Hz)", ModeName(Mode),
                Driving[0], Driving[1]);
        }
    }

    void TestFailures()
    {
        const FLoop Loop = PlateauLoop();
        if (Loop.Points.size() < 2) return;
        FRunSettings Quick = ForMode(EMode::Perf);
        Quick.Delay = 1.0;
        Quick.WarmLaps = 0;
        // A car that cannot move: it backs out after 1.2 s and the run fails as stuck 10 s after the leg starts.
        const FDriveResult Blocked = DriveLoop(Loop, Quick, 60.0, true);
        Expect(Blocked.Exit == EExit::Stuck && static_cast<int>(Blocked.Exit) == 2, "a blocked car exits 2 (%s)", ExitName(Blocked.Exit));
        Expect(Near(Blocked.FinishedAt - Blocked.LegStartedAt, StallSeconds, 2.0 / 60.0), "stuck after 10 s without progress (%.2f s)",
            Blocked.FinishedAt - Blocked.LegStartedAt);
        Expect(Blocked.Reversals >= 3, "the blocked driver backed out every 2.3 s (%d)", Blocked.Reversals);
        // A crawling car keeps moving but cannot finish a lap in 6 minutes.
        const FDriveResult Crawling = DriveLoop(Loop, Quick, 30.0, false, 100.f);
        Expect(Crawling.Exit == EExit::Timeout && static_cast<int>(Crawling.Exit) == 5, "a 1 m/s car exits 5 (%s)", ExitName(Crawling.Exit));
        Expect(Near(Crawling.MeasuredDriving, MaxLapSeconds, .1), "after 360 s of driving (%.1f s)", Crawling.MeasuredDriving);

        FRun Run;
        Begin(Run, Loop, Quick, 0.0, false, false);
        FStep Step = Tick(Run, 5.0, .1, Loop.Points[0], 0.0, 0.0, true);
        Expect(Run.Phase == EPhase::Fail && Run.Exit == EExit::NoSky && static_cast<int>(Run.Exit) == 3, "no sky arguments exit 3");
        Expect(Step.Controls.bBrake && Step.Controls.Pedal == 0.0 && Step.Event == EEvent::None, "a failed run only brakes");

        Begin(Run, Loop, Quick, 0.0, true, true);
        Step = Tick(Run, 30.0, .1, Loop.Points[0], 0.0, 0.0, true);
        Expect(Run.Phase == EPhase::Wait && Step.Event == EEvent::None, "the car waits for the CVar readback");
        ReportCVars(Run, 2);
        Expect(Run.Phase == EPhase::Fail && Run.Exit == EExit::CVarMismatch && static_cast<int>(Run.Exit) == 4, "a CVar mismatch exits 4");

        Begin(Run, Loop, Quick, 0.0, true, true);
        ReportCVars(Run, 0);
        Step = Tick(Run, .5, .1, Loop.Points[0], Loop.StartYaw(), 0.0, true);
        Expect(Run.Phase == EPhase::Wait, "the delay holds the car");
        Step = Tick(Run, 1.0, .1, Loop.Points[0], Loop.StartYaw(), 0.0, true);
        Expect(Run.Phase == EPhase::Measure && Step.Event == EEvent::LegBegin && Step.Leg == 0 && Step.Lap == 1, "a matching readback starts the first leg");

        Begin(Run, Loop, Quick, 0.0, true, false);
        Step = Tick(Run, 60.9, .1, Loop.Points[0], 0.0, 0.0, false);
        Expect(Run.Phase == EPhase::Wait, "the car may take a minute to be ready");
        Step = Tick(Run, 61.1, .1, Loop.Points[0], 0.0, 0.0, false);
        Expect(Run.Exit == EExit::Timeout && Step.Event == EEvent::Fail, "a car never ready exits 5");

        Begin(Run, FLoop(), Quick, 0.0, true, false);
        Expect(Run.Exit == EExit::Stuck, "a loop that does not build fails as stuck");
        Begin(Run, Loop, Quick, 0.0, true, false);
        Abort(Run, EExit::Timeout);
        Abort(Run, EExit::Stuck);
        Expect(Run.Exit == EExit::Timeout, "the first abort wins");
        Expect(static_cast<int>(EExit::Done) == 0, "done exits 0");

        EMode Mode = EMode::Perf;
        Expect(ParseMode("STREAM", Mode) && Mode == EMode::Stream && ParseMode("look", Mode) && Mode == EMode::Look && !ParseMode("fast", Mode), "modes parse");
    }

    // The police stuck rule on its own: 1.2 s of throttle without speed, then 1.1 s backing out with the wheel reversed.
    void TestStuckRule()
    {
        FLoop Loop;
        Loop.Points = {{0.0, 0.0}, {20000.0, 0.0}, {20000.0, 20000.0}, {0.0, 0.0}};
        Loop.Stops = {0};
        FinishLoop(Loop);
        FTracker Tracker;
        Track(Tracker, Loop, {0.0, 0.0});
        FDriver Driver;
        const double Yaw = 10.0;
        double Now = 0.0;
        FControls Controls = Drive(Driver, Loop, Tracker, {0.0, 0.0}, Yaw, 0.0, -1.0, Now, .1);
        Expect(Controls.Pedal == 1.0 && !Controls.bBrake && Controls.Wheel < 0.0, "from rest: full throttle and steer back to the line");
        const double Wheel = Controls.Wheel;
        // Ten more steps of .1 s: 1.1 s with throttle and no speed. The 1.2 s step itself may go either way in floating point.
        for (int Step = 0; Step < 10; ++Step) Controls = Drive(Driver, Loop, Tracker, {0.0, 0.0}, Yaw, 0.0, -1.0, Now += .1, .1);
        Expect(Driver.Reversals == 0 && Controls.Pedal == 1.0, "not stuck after 1.1 s");
        double StuckAt = -1.0;
        for (int Step = 0; Step < 2; ++Step)
        {
            Controls = Drive(Driver, Loop, Tracker, {0.0, 0.0}, Yaw, 0.0, -1.0, Now += .1, .1);
            if (Driver.Reversals == 1 && StuckAt < 0.0) StuckAt = Now;
        }
        Expect(Driver.Reversals == 1 && Near(Driver.ReverseUntil, StuckAt + ReverseFor, 1e-9), "stuck after more than 1.2 s (backs out until %.2f s)",
            Driver.ReverseUntil);
        Controls = Drive(Driver, Loop, Tracker, {0.0, 0.0}, Yaw, 0.0, -1.0, Now += .1, .1);
        Expect(Controls.Pedal == -1.0 && Near(Controls.Wheel, -Wheel, 1e-9) && !Controls.bBrake, "backing out with the wheel the other way");
        while (Now < Driver.ReverseUntil - 1e-9) Controls = Drive(Driver, Loop, Tracker, {0.0, 0.0}, Yaw, 0.0, -1.0, Now += .1, .1);
        Controls = Drive(Driver, Loop, Tracker, {0.0, 0.0}, Yaw, 0.0, -1.0, Now += .1, .1);
        Expect(Controls.Pedal == 1.0 && Driver.StuckFor > 0.0, "after 1.1 s it drives forward again");
        // Speed and corner: the cap on the straight, the arc's speed within the bend range of the right angle (its arc
        // starts 9.4 m before the corner), and the handbrake at a stop.
        Expect(Near(WantedSpeed(Loop, Tracker, 0.0, -1.0), SpeedCap, 1e-9), "15 m/s on a long straight");
        FTracker Corner;
        Track(Corner, Loop, {17000.0, 0.0});
        Expect(Near(WantedSpeed(Loop, Corner, 1500.0, -1.0), SpeedCap, 1e-9), "still 15 m/s 20 m before the arc at 15 m/s");
        Track(Corner, Loop, {18000.0, 0.0});
        Expect(Near(WantedSpeed(Loop, Corner, 1500.0, -1.0), 800.0, 1e-9), "8 m/s once the arc is within 6 m + 0.9 s (%.0f cm/s)", WantedSpeed(Loop, Corner, 1500.0, -1.0));
        Track(Corner, Loop, {19800.0, 300.0});
        Track(Corner, Loop, {20000.0, 2000.0});
        Expect(Near(WantedSpeed(Loop, Corner, 800.0, -1.0), SpeedCap, 1e-9), "15 m/s again on the straight after the arc");
        Expect(WantedSpeed(Loop, Tracker, 0.0, 50.0) == 0.0, "zero within StopShort of a stop");
        const FControls Stopped = Drive(Driver, Loop, Tracker, {0.0, 0.0}, 0.0, 100.0, 50.0, Now += 5.0, .1);
        Expect(Stopped.bBrake && Stopped.Pedal == 0.0, "a slow car at its stop holds the handbrake");
    }

    // ------------------------------------------------------------------ frame statistics

    std::vector<std::string> Split(const std::string& Line, char Separator)
    {
        std::vector<std::string> Fields;
        std::stringstream Stream(Line);
        std::string Field;
        while (std::getline(Stream, Field, Separator)) Fields.push_back(Trim(Field));
        return Fields;
    }

    void TestPercentiles()
    {
        std::vector<double> Sorted = {1.0, 2.0, 3.0, 4.0};
        Expect(Percentile(Sorted, .95) == 4.0, "profile_package.py: percentile([4, 1, 3, 2], .95) is 4");
        Expect(Percentile(Sorted, .5) == 3.0 && Percentile(Sorted, 0.0) == 1.0 && Percentile({}, .5) == 0.0, "ceil((n - 1) * f) rank");
        const FFrameSummary Summary = Summarize({16.7, 33.3, 33.31, 50.0, 50.01, 66.7, 66.71, 250.0, 250.01});
        Expect(Summary.Frames == 9 && Summary.OverBudget == 7 && Summary.Slow == 5 && Summary.Hitches == 3 && Summary.Long == 1,
            "a frame counts only when strictly over a limit (%d %d %d %d)", Summary.OverBudget, Summary.Slow, Summary.Hitches, Summary.Long);
        Expect(Summary.Max == 250.01 && Summary.P50 == 50.01, "max and p50");
        Expect(Summarize({}).Frames == 0 && Summarize({}).P99 == 0.0, "no frames summarise to zero");
        Expect(Fixed(1.0005, 3) == "1.000" || Fixed(1.0005, 3) == "1.001", "fixed rounding");
        Expect(Fixed(-0.25, 2) == "-0.25" && Fixed(16.6666, 3) == "16.667" && Fixed(7.0, 0) == "7" && Fixed(0.04, 3) == "0.040", "fixed-point text");
        FFrameLog Log;
        Log.Add(1, 0, 20.0);
        Log.Add(1, 1, 40.0);
        Log.Add(2, 0, 60.0);
        Expect(Log.Count() == 3 && Log.ForLeg(0).Frames == 2 && Log.ForLap(2).Frames == 1 && Log.All().Max == 60.0, "the log splits by lap and leg");
        Log.Clear();
        Expect(Log.Count() == 0, "the log clears");
    }

    // Data/Gauntlet/fixtures/frametimes.csv, summarised; Scripts/test_gauntlet_model.py compares the lines with the expected JSON.
    void TestFixture(const char* Path)
    {
        std::ifstream File(Path);
        Expect(File.good(), "fixture %s opens", Path);
        if (!File.good()) return;
        std::string Line;
        std::getline(File, Line);
        const std::vector<std::string> Header = Split(Line, ',');
        const auto Column = [&Header](const char* Name)
        {
            for (std::size_t Index = 0; Index < Header.size(); ++Index)
                if (Header[Index] == Name) return static_cast<int>(Index);
            return -1;
        };
        const int FrameColumn = Column("frame_ms"), LegColumn = Column("leg");
        Expect(FrameColumn >= 0 && LegColumn >= 0, "fixture columns frame_ms and leg");
        if (FrameColumn < 0 || LegColumn < 0) return;
        std::map<std::string, int> Legs;
        for (int Leg = 0; Leg < QuebecGauntletRoute::StopCount; ++Leg) Legs[LegName(Leg)] = Leg;
        FFrameLog Log;
        int Rows = 0;
        while (std::getline(File, Line))
        {
            if (Trim(Line).empty()) continue;
            const std::vector<std::string> Fields = Split(Line, ',');
            double Ms = 0.0;
            const bool bRow = static_cast<int>(Fields.size()) > std::max(FrameColumn, LegColumn) && ParseNumber(Fields[static_cast<std::size_t>(FrameColumn)], Ms)
                && Legs.count(Fields[static_cast<std::size_t>(LegColumn)]) == 1;
            Expect(bRow, "fixture row %d is a frame time and a leg name: %s", Rows + 2, Line.c_str());
            if (bRow) Log.Add(1, Legs[Fields[static_cast<std::size_t>(LegColumn)]], Ms);
            ++Rows;
        }
        Expect(Rows > 0 && Log.Count() == Rows, "every fixture row is used");
        std::printf("NORD_GAUNTLET_FIXTURE lap %s\n", FormatSummary(Log.All()).c_str());
        for (int Leg = 0; Leg < QuebecGauntletRoute::StopCount; ++Leg)
            std::printf("NORD_GAUNTLET_FIXTURE leg=%s %s\n", LegName(Leg).c_str(), FormatSummary(Log.ForLeg(Leg)).c_str());
    }

    // ------------------------------------------------------------------ expected CVars

    void TestCVarFile()
    {
        const std::string Text = "\xEF\xBB\xBF# NordPhoneStream candidate 7\r\n"
                                 "\r\n"
                                 "sg.ShadowQuality=2\r\n"
                                 "   ; an indented comment\n"
                                 "\t\n"
                                 "r.ScreenPercentage = 85   # trailing comment\n"
                                 "r.Shadow.Virtual.Enable=1 ;also a comment\n"
                                 "t.MaxFPS=60\n"
                                 "sg.ShadowQuality=2.0\n"
                                 "this line has no equals sign\n"
                                 "=3\n"
                                 "r.Tonemapper.Sharpen=\n"
                                 "bad name=1\n"
                                 "r.ScreenPercentage=75\n"
                                 "r.Weather=Rain#not a comment";
        const FCVarFile File = ParseExpectedCVars(Text);
        Expect(File.Values.size() == 5, "five expectations (%d)", static_cast<int>(File.Values.size()));
        if (File.Values.size() == 5)
        {
            Expect(File.Values[0].Name == "sg.ShadowQuality" && File.Values[0].Value == "2" && File.Values[0].Line == 3, "the byte order mark and CRLF are ignored");
            Expect(File.Values[1].Name == "r.ScreenPercentage" && File.Values[1].Value == "85" && File.Values[1].Line == 6, "spaces and a trailing # comment are trimmed");
            Expect(File.Values[2].Value == "1" && File.Values[3].Value == "60", "a trailing ; comment is trimmed");
            Expect(File.Values[4].Name == "r.Weather" && File.Values[4].Value == "Rain#not a comment", "# inside a value is kept");
        }
        const std::vector<int> Bad = {10, 11, 12, 13, 14};
        Expect(File.BadLines == Bad, "bad lines: no '=', no name, no value, a space in the name, and a second value for one name");
        Expect(ParseExpectedCVars("").Values.empty() && ParseExpectedCVars("\n\n# only comments\n").BadLines.empty(), "an empty file expects nothing");
        Expect(ParseExpectedCVars("a=1").Values.size() == 1, "the last line needs no newline");

        double Value = 0.0;
        Expect(ParseNumber("75", Value) && Value == 75.0 && ParseNumber("-1.5", Value) && Value == -1.5 && ParseNumber(".25", Value) && Value == .25, "numbers");
        Expect(ParseNumber("1e3", Value) && Value == 1000.0 && ParseNumber("+2.5E-1", Value) && Near(Value, .25, 1e-12), "exponents");
        Expect(!ParseNumber("", Value) && !ParseNumber("-", Value) && !ParseNumber("1.2.3", Value) && !ParseNumber("1e", Value) && !ParseNumber("75 %", Value), "not numbers");
        Expect(CVarValueMatches("75", "75.000000") && CVarValueMatches("0.5", "0.50001") && !CVarValueMatches("75", "75.1"), "numbers compare by value");
        Expect(CVarValueMatches("Rain", "rain") && !CVarValueMatches("Rain", "Rainy") && !CVarValueMatches("1", "true"), "text compares without case");

        const std::map<std::string, std::string> Live = {{"sg.ShadowQuality", "2"}, {"r.ScreenPercentage", "75.000000"}, {"r.Shadow.Virtual.Enable", "1"},
            {"t.MaxFPS", "60.000000"}};
        const std::vector<FCVarMismatch> Mismatches = CompareCVars(File.Values, [&Live](const std::string& Name, std::string& Out)
        {
            const auto Found = Live.find(Name);
            if (Found == Live.end()) return false;
            Out = Found->second;
            return true;
        });
        Expect(Mismatches.size() == 2, "two mismatches (%d)", static_cast<int>(Mismatches.size()));
        if (Mismatches.size() == 2)
        {
            Expect(Mismatches[0].Name == "r.ScreenPercentage" && Mismatches[0].Expected == "85" && Mismatches[0].Actual == "75.000000" && !Mismatches[0].bMissing,
                "a saved setting overriding the profile is a mismatch");
            Expect(Mismatches[1].Name == "r.Weather" && Mismatches[1].bMissing, "an unknown CVar is a mismatch");
        }
    }

    // ------------------------------------------------------------------ numbers that Data/Gauntlet/loop.json repeats

    void PrintConstants()
    {
        std::string Line = "NORD_GAUNTLET_CONSTANTS";
        const auto Add = [&Line](const char* Key, double Value) { Line += std::string(" ") + Key + "=" + Fixed(Value, 3); };
        Add("drive.speed_cap_m_s", SpeedCap / 100.0);
        Add("drive.stuck_after_s", StuckAfter);
        Add("drive.reverse_for_s", ReverseFor);
        Add("drive.stuck_speed_m_s", StuckSpeed / 100.0);
        Add("drive.stall_s", StallSeconds);
        Add("drive.stall_progress_m", StallProgress / 100.0);
        Add("drive.max_lap_s", MaxLapSeconds);
        Add("drive.max_lateral_error_m", LateralMax / 100.0);
        Add("route.length_min_m", LengthMin / 100.0);
        Add("route.length_max_m", LengthMax / 100.0);
        Add("route.stop_road_max_m", StopRoadMax / 100.0);
        Add("route.end_within_m", EndWithin / 100.0);
        Add("eye_fov_deg", QuebecGauntletRoute::EyeFieldOfView);
        Add("budgets.native.frame_budget_ms", FrameBudgetMs);
        Add("budgets.native.slow_frame_ms", SlowFrameMs);
        Add("budgets.native.hitch_ms", HitchMs);
        Add("budgets.native.long_frame_ms", LongFrameMs);
        for (const EExit Exit : {EExit::Done, EExit::Stuck, EExit::NoSky, EExit::CVarMismatch, EExit::Timeout})
            Add(("exit_codes." + std::string(ExitName(Exit))).c_str(), static_cast<double>(static_cast<int>(Exit)));
        for (const EMode Mode : {EMode::Perf, EMode::Look, EMode::Stream})
        {
            const FRunSettings Settings = ForMode(Mode);
            const std::string Prefix = std::string("modes.") + ModeName(Mode) + ".";
            Add((Prefix + "delay_s").c_str(), Settings.Delay);
            Add((Prefix + "warm_laps").c_str(), Settings.WarmLaps);
            Add((Prefix + "laps").c_str(), Settings.Laps);
            Add((Prefix + "hold_s").c_str(), Settings.Hold);
            Add((Prefix + "ambient").c_str(), Settings.bAmbient ? 1.0 : 0.0);
            Add((Prefix + "sky_switch").c_str(), Settings.bSkySwitch ? 1.0 : 0.0);
        }
        for (int Stop = 0; Stop < QuebecGauntletRoute::StopCount; ++Stop)
            Line += " stop." + std::to_string(Stop) + "=" + QuebecGauntletRoute::Stops[Stop].Label + ":" + QuebecGauntletRoute::Stops[Stop].Camera;
        std::printf("%s\n", Line.c_str());
    }
}

int main(int Count, char** Arguments)
{
    if (Count < 2)
    {
        std::fputs("usage: gauntlet_model_test Data/Gauntlet/fixtures/frametimes.csv\n", stderr);
        return 2;
    }
    TestRouteHeader();
    TestPlateauLoop();
    TestGridLoop();
    TestCorners();
    TestTracker();
    TestStuckRule();
    TestDrivenLaps();
    TestFailures();
    TestPercentiles();
    TestFixture(Arguments[1]);
    TestCVarFile();
    PrintConstants();
    if (Failures)
    {
        std::fprintf(stderr, "%d of %d checks failed\n", Failures, Assertions);
        return 1;
    }
    std::printf("NORD_GAUNTLET_MODEL_TEST_OK %d checks\n", Assertions);
    return 0;
}
