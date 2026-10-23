#pragma once

// Engine-independent NORD mobile gauntlet: the Plateau loop over the road graph, the driver that steers the player's
// car around it, the run phases, frame-time statistics and the expected-CVar file.
// No Unreal includes, so Scripts/test_gauntlet_model.py can build and run it with the system compiler.
// Positions are planar map centimetres, speeds cm/s, times seconds and frame times milliseconds.
// Yaw follows Unreal: atan2(Y, X) in degrees. Data/Gauntlet/loop.json holds the same numbers; the test compares them.

#include "QuebecGauntletRoute.h"
#include "QuebecPursuitModel.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>
#include <utility>
#include <vector>

namespace QuebecGauntlet
{
    using QuebecPursuit::FVec2;

    // Driver: the police follower's look-ahead, corner speeds and stuck rule, with a lower cap for a repeatable lap.
    inline constexpr double SpeedCap = 1500.0;
    inline constexpr double AimBase = 350.0;          // Aim this far ahead along the loop...
    inline constexpr double AimPerSpeed = .3;         // ...plus this many cm per cm/s.
    inline constexpr double BendRangeBase = 600.0;    // Slow for the sharpest bend within this...
    inline constexpr double BendRangePerSpeed = .9;   // ...plus this many cm per cm/s.
    inline constexpr double WheelDegrees = 32.0;      // Heading error that gives full lock.
    inline constexpr double PedalSpeed = 500.0;       // Speed error that gives full throttle or brake.
    inline constexpr double StopDeceleration = 400.0; // Easing into a hold, cm/s per second.
    inline constexpr double StopShort = 100.0;        // The car aims to stand this far before the stop.
    inline constexpr double ArriveRadius = 300.0;     // A hold starts within this of the stop...
    inline constexpr double ArriveSpeed = 60.0;       // ...once slower than this.
    inline constexpr double BrakeWanted = 60.0;       // Below this wanted speed and BrakeSpeed the handbrake holds the car.
    inline constexpr double BrakeSpeed = 300.0;
    inline constexpr double StuckAfter = 1.2;         // Throttle without StuckSpeed this long...
    inline constexpr double ReverseFor = 1.1;         // ...backs out this long with the wheel the other way.
    inline constexpr double StuckSpeed = 60.0;
    inline constexpr double StuckPedal = .3;

    // Run limits.
    inline constexpr double StallSeconds = 10.0;      // Less than StallProgress along the loop in this long fails the run.
    inline constexpr double StallProgress = 500.0;
    inline constexpr double MaxLapSeconds = 360.0;    // Driving time of one lap; holds do not count.
    inline constexpr double ReadyGrace = 60.0;        // The car and the CVar readback must be ready this long after the delay.

    // Loop building and tracking.
    inline constexpr double NoUTurn = 1.0e7;          // FRoadGraph::Route U-turn cost that rules turning back out.
    inline constexpr double JoinPoints = 1.0;         // Route points closer than this to the last one are dropped.
    inline constexpr double TrackAhead = 4000.0;      // The tracker looks for the car this far ahead of its last place.

    // Frame times. A frame counts when it is strictly over the limit.
    inline constexpr double FrameBudgetMs = 33.3;
    inline constexpr double SlowFrameMs = 50.0;
    inline constexpr double HitchMs = 66.7;
    inline constexpr double LongFrameMs = 250.0;

    inline constexpr double Pi = 3.14159265358979323846;

    // Signed shortest turn from one heading to another, -180..180 degrees.
    inline double DeltaDegrees(double From, double To)
    {
        double Delta = std::fmod(To - From, 360.0);
        if (Delta > 180.0) Delta -= 360.0;
        else if (Delta < -180.0) Delta += 360.0;
        return Delta;
    }

    inline double YawOf(const FVec2& Direction) { return std::atan2(Direction.Y, Direction.X) * 180.0 / Pi; }

    // The stop eyes from QuebecGauntletRoute.h in drive order.
    inline std::vector<FVec2> RouteEyes()
    {
        std::vector<FVec2> Eyes;
        for (const QuebecGauntletRoute::FStop& Stop : QuebecGauntletRoute::Stops) Eyes.push_back({Stop.EyeX, Stop.EyeY});
        return Eyes;
    }

    inline std::string StopLabel(int Stop)
    {
        return Stop >= 0 && Stop < QuebecGauntletRoute::StopCount ? QuebecGauntletRoute::Stops[Stop].Label : "?";
    }

    // Leg Leg runs from stop Leg to the next stop; the last leg returns to the first. Named like "S1-S2".
    inline std::string LegName(int Leg)
    {
        return StopLabel(Leg) + "-" + StopLabel(Leg + 1 < QuebecGauntletRoute::StopCount ? Leg + 1 : 0);
    }

    // A closed loop through the stops in order. Points[0] is the first stop's road point and the last point is that
    // point again. Distance[i] is the arc length at Points[i]; Stops[k] is the Points index of stop k's road point.
    struct FLoop
    {
        std::vector<FVec2> Points;
        std::vector<double> Distance;
        std::vector<std::size_t> Stops;
        double Length = 0.0;

        int StopCount() const { return static_cast<int>(Stops.size()); }
        int SegmentCount() const { return Points.size() > 1 ? static_cast<int>(Points.size()) - 1 : 0; }
        double StopAlong(int Stop) const { return Distance[Stops[static_cast<std::size_t>(Stop)]]; }
        double LegLength(int Leg) const { return (Leg + 1 < StopCount() ? StopAlong(Leg + 1) : Length) - StopAlong(Leg); }

        double Wrap(double Along) const
        {
            if (Length <= 0.0) return 0.0;
            const double Wrapped = std::fmod(Along, Length);
            return Wrapped < 0.0 ? Wrapped + Length : Wrapped;
        }

        // Segment that holds arc length Along, wrapped onto the loop.
        std::size_t SegmentAt(double Along) const
        {
            const double Wrapped = Wrap(Along);
            const std::size_t Upper = static_cast<std::size_t>(std::upper_bound(Distance.begin(), Distance.end(), Wrapped) - Distance.begin());
            return std::min(Upper > 0 ? Upper - 1 : 0, static_cast<std::size_t>(std::max(SegmentCount() - 1, 0)));
        }

        FVec2 PointAt(double Along) const
        {
            if (Points.size() < 2) return Points.empty() ? FVec2{} : Points[0];
            const std::size_t Segment = SegmentAt(Along);
            const double Span = Distance[Segment + 1] - Distance[Segment];
            const double Alpha = Span > 1e-9 ? std::clamp((Wrap(Along) - Distance[Segment]) / Span, 0.0, 1.0) : 0.0;
            return Points[Segment] + (Points[Segment + 1] - Points[Segment]) * Alpha;
        }

        FVec2 DirectionAt(double Along) const
        {
            if (Points.size() < 2) return {};
            const std::size_t Segment = SegmentAt(Along);
            return QuebecPursuit::Normal(Points[Segment + 1] - Points[Segment]);
        }

        // Yaw the car faces when it stands at the first stop before the run starts.
        double StartYaw() const { return YawOf(DirectionAt(0.0)); }
    };

    // Each eye's road point is the nearest point on an open segment. Each leg is FRoadGraph::Route from one road point to
    // the next, leaving along the direction the car arrived from, so the loop never turns back at a stop. The first leg
    // leaves along the last leg's arrival, which needs a second pass; passes repeat until that direction holds.
    inline bool BuildLoop(const QuebecPursuit::FRoadGraph& Graph, const std::vector<FVec2>& Eyes, FLoop& Out)
    {
        Out = FLoop();
        if (Eyes.size() < 2) return false;
        std::vector<FVec2> Road(Eyes.size());
        for (std::size_t Index = 0; Index < Eyes.size(); ++Index)
            if (Graph.Nearest(Eyes[Index], Road[Index]) < 0) return false;
        FVec2 Arrival;
        for (int Pass = 0; Pass < 4; ++Pass)
        {
            FLoop Loop;
            Loop.Points.push_back(Road[0]);
            Loop.Stops.push_back(0);
            FVec2 Heading = Arrival;
            for (std::size_t Leg = 0; Leg < Road.size(); ++Leg)
            {
                const std::size_t Next = (Leg + 1) % Road.size();
                std::vector<FVec2> Path;
                if (!Graph.Route(Road[Leg], Heading, Road[Next], Path, NoUTurn)) return false;
                for (const FVec2& Point : Path)
                    if (QuebecPursuit::Distance(Point, Loop.Points.back()) > JoinPoints) Loop.Points.push_back(Point);
                if (Loop.Points.size() < 2) return false;
                // The leg ends exactly on the next road point, so the loop closes on Road[0].
                Loop.Points.back() = Road[Next];
                Heading = Loop.Points.back() - Loop.Points[Loop.Points.size() - 2];
                if (Next != 0) Loop.Stops.push_back(Loop.Points.size() - 1);
            }
            const bool bSettled = Pass > 0 && QuebecPursuit::Dot(QuebecPursuit::Normal(Heading), QuebecPursuit::Normal(Arrival)) > .999;
            Arrival = Heading;
            Out = std::move(Loop);
            if (bSettled) break;
        }
        Out.Distance.assign(Out.Points.size(), 0.0);
        for (std::size_t Index = 1; Index < Out.Points.size(); ++Index)
            Out.Distance[Index] = Out.Distance[Index - 1] + QuebecPursuit::Distance(Out.Points[Index - 1], Out.Points[Index]);
        Out.Length = Out.Distance.back();
        return Out.Length > 0.0 && Out.StopCount() == static_cast<int>(Eyes.size());
    }

    // Where the car is on the loop: the nearest point on the segments from just behind its last place to TrackAhead
    // in front, so a loop that drives a street twice never jumps ahead. Along is unwrapped and keeps growing each lap.
    struct FTracker
    {
        std::size_t Segment = 0;
        double Along = 0.0;
        double Offset = 0.0;   // Lateral error: the distance from the loop line.
        FVec2 Closest;
    };

    inline void Track(FTracker& Tracker, const FLoop& Loop, const FVec2& Position)
    {
        const int Count = Loop.SegmentCount();
        if (Count <= 0) return;
        const std::size_t Size = static_cast<std::size_t>(Count);
        const std::size_t First = (Tracker.Segment % Size + Size - std::min<std::size_t>(2, Size - 1)) % Size;
        double Best = std::numeric_limits<double>::max(), BestAlpha = 0.0;
        std::size_t BestSegment = Tracker.Segment % Size;
        FVec2 BestPoint;
        for (std::size_t Step = 0; Step < Size; ++Step)
        {
            const std::size_t Segment = (First + Step) % Size;
            double Ahead = Loop.Distance[Segment] - Loop.Distance[Tracker.Segment % Size];
            if (Ahead < 0.0) Ahead += Loop.Length;
            if (Step > 2 && Ahead > TrackAhead) break;
            double Alpha = 0.0;
            const FVec2 Point = QuebecPursuit::ClosestOnSegment(Position, Loop.Points[Segment], Loop.Points[Segment + 1], Alpha);
            const double Gap = QuebecPursuit::Distance(Position, Point);
            if (Gap < Best) { Best = Gap; BestAlpha = Alpha; BestSegment = Segment; BestPoint = Point; }
        }
        const double Arc = Loop.Distance[BestSegment] + BestAlpha * (Loop.Distance[BestSegment + 1] - Loop.Distance[BestSegment]);
        double Delta = Arc - Loop.Wrap(Tracker.Along);
        if (Delta > Loop.Length * .5) Delta -= Loop.Length;
        else if (Delta < -Loop.Length * .5) Delta += Loop.Length;
        Tracker.Along += Delta;
        Tracker.Segment = BestSegment;
        Tracker.Offset = Best;
        Tracker.Closest = BestPoint;
    }

    // Car inputs: Wheel is MoveRight and Pedal is MoveForward (both -1..1); bBrake is ApplyHandbrake.
    struct FControls
    {
        double Wheel = 0.0;
        double Pedal = 0.0;
        bool bBrake = true;
    };

    struct FDriver
    {
        double StuckFor = 0.0;
        double ReverseUntil = -1.0;
        int Reversals = 0;
    };

    // Wanted speed at the tracker's place: the cap, the police CornerSpeed for the sharpest bend ahead, and an even stop
    // StopShort before StopAt (an unwrapped arc length; negative when the car drives through).
    inline double WantedSpeed(const FLoop& Loop, const FTracker& Tracker, double Speed, double StopAt)
    {
        const double Range = BendRangeBase + std::fabs(Speed) * BendRangePerSpeed;
        const int Count = Loop.SegmentCount();
        std::vector<FVec2> Ahead;
        double Covered = 0.0;
        const FVec2 Here = Loop.PointAt(Tracker.Along);
        FVec2 Previous = Here;
        for (int Step = 1; Step <= Count && Covered <= Range; ++Step)
        {
            const FVec2& Point = Loop.Points[(Loop.SegmentAt(Tracker.Along) + static_cast<std::size_t>(Step)) % static_cast<std::size_t>(Count)];
            Covered += QuebecPursuit::Distance(Previous, Point);
            Ahead.push_back(Point);
            Previous = Point;
        }
        const double Bend = QuebecPursuit::TurnAhead(Ahead, 0, Here, Loop.DirectionAt(Tracker.Along), Range);
        double Wanted = std::min(SpeedCap, QuebecPursuit::CornerSpeed(Bend));
        if (StopAt >= 0.0) Wanted = std::min(Wanted, std::sqrt(2.0 * StopDeceleration * std::max(0.0, StopAt - Tracker.Along - StopShort)));
        return Wanted;
    }

    // One driver step: steer at a point ahead on the loop, hold the wanted speed, and back out when stuck (the police rule).
    inline FControls Drive(FDriver& Driver, const FLoop& Loop, const FTracker& Tracker, const FVec2& Position, double Yaw, double Speed,
        double StopAt, double Now, double DeltaSeconds)
    {
        FControls Controls;
        const double Wanted = WantedSpeed(Loop, Tracker, Speed, StopAt);
        const FVec2 Aim = Loop.PointAt(Tracker.Along + AimBase + std::fabs(Speed) * AimPerSpeed);
        Controls.Wheel = std::clamp(DeltaDegrees(Yaw, YawOf(Aim - Position)) / WheelDegrees, -1.0, 1.0);
        Controls.Pedal = std::clamp((Wanted - Speed) / PedalSpeed, -1.0, 1.0);
        Controls.bBrake = Wanted < BrakeWanted && std::fabs(Speed) < BrakeSpeed;
        if (Controls.bBrake) Controls.Pedal = 0.0;
        if (Now < Driver.ReverseUntil)
        {
            Controls.Pedal = -1.0;
            Controls.Wheel = -Controls.Wheel;
            Controls.bBrake = false;
        }
        else if (!Controls.bBrake && Controls.Pedal > StuckPedal && std::fabs(Speed) < StuckSpeed)
        {
            Driver.StuckFor += DeltaSeconds;
            if (Driver.StuckFor > StuckAfter)
            {
                Driver.StuckFor = 0.0;
                Driver.ReverseUntil = Now + ReverseFor;
                ++Driver.Reversals;
            }
        }
        else Driver.StuckFor = 0.0;
        return Controls;
    }

    // The run. Perf measures laps, look holds at each stop for stills, stream holds briefly for decoded frames.
    enum class EMode : uint8_t { Perf, Look, Stream };
    enum class EPhase : uint8_t { Wait, WarmLap, Measure, Hold, Done, Fail };
    // Process exit codes. Python judges the budgets; the run only reports.
    enum class EExit : int { Running = -1, Done = 0, Stuck = 2, NoSky = 3, CVarMismatch = 4, Timeout = 5 };
    enum class EEvent : uint8_t { None, WarmBegin, HoldBegin, LegBegin, Done, Fail };

    struct FRunSettings
    {
        double Delay = 10.0;     // Seconds after Begin before the car may start.
        int WarmLaps = 1;        // Driven and not measured (shader compiles).
        int Laps = 1;            // Measured; -NordGauntletLaps overrides it.
        double Hold = 0.0;       // Seconds at each stop; 0 drives through.
        bool bAmbient = true;    // False adds -NordNoAmbient, so stills repeat.
        bool bSkySwitch = false; // Look: each hold takes both skies.
    };

    // loop.json "modes".
    inline FRunSettings ForMode(EMode Mode)
    {
        FRunSettings Settings;
        if (Mode == EMode::Look)
        {
            Settings.WarmLaps = 0;
            Settings.Hold = 24.0;
            Settings.bAmbient = false;
            Settings.bSkySwitch = true;
        }
        else if (Mode == EMode::Stream)
        {
            Settings.Delay = 95.0;
            Settings.WarmLaps = 0;
            Settings.Hold = 4.0;
        }
        return Settings;
    }

    inline const char* ModeName(EMode Mode) { return Mode == EMode::Look ? "look" : Mode == EMode::Stream ? "stream" : "perf"; }

    inline bool EqualsNoCase(const std::string& A, const std::string& B)
    {
        if (A.size() != B.size()) return false;
        for (std::size_t Index = 0; Index < A.size(); ++Index)
        {
            const char Left = A[Index] >= 'A' && A[Index] <= 'Z' ? static_cast<char>(A[Index] - 'A' + 'a') : A[Index];
            const char Right = B[Index] >= 'A' && B[Index] <= 'Z' ? static_cast<char>(B[Index] - 'A' + 'a') : B[Index];
            if (Left != Right) return false;
        }
        return true;
    }

    inline bool ParseMode(const std::string& Text, EMode& Out)
    {
        for (const EMode Mode : {EMode::Perf, EMode::Look, EMode::Stream})
            if (EqualsNoCase(Text, ModeName(Mode))) { Out = Mode; return true; }
        return false;
    }

    inline const char* ExitName(EExit Exit)
    {
        switch (Exit)
        {
        case EExit::Done: return "done";
        case EExit::Stuck: return "stuck";
        case EExit::NoSky: return "no_sky";
        case EExit::CVarMismatch: return "cvar_mismatch";
        case EExit::Timeout: return "timeout";
        default: return "running";
        }
    }

    struct FRun
    {
        FLoop Loop;
        FRunSettings Settings;
        FTracker Tracker;
        FDriver Driver;
        EPhase Phase = EPhase::Wait;
        EExit Exit = EExit::Running;
        int Lap = 0;              // Measured laps count from 1; warm laps are 0 and below.
        int Leg = -1;             // The leg being driven, from stop Leg to the next.
        int Stop = -1;            // The stop of the current hold.
        double BeganAt = 0.0;
        double HoldEndsAt = 0.0;
        double LapDriving = 0.0;  // Driving seconds in this lap.
        double StallMark = 0.0;
        double StallAt = 0.0;
        bool bExpectCVars = false;
        bool bCVarsChecked = false;
    };

    // What happened this tick (at most one event) and the inputs for the car.
    struct FStep
    {
        EEvent Event = EEvent::None;
        int Lap = 0;
        int Leg = -1;
        int Stop = -1;
        FControls Controls;
    };

    inline bool Finished(const FRun& Run) { return Run.Phase == EPhase::Done || Run.Phase == EPhase::Fail; }

    // Start a run. bSkyArgs is true when both -NordHour= and -NordWeather= were passed; bExpectCVars when an expected-CVar
    // file was given, so the car waits for ReportCVars. The car stands at the first stop facing Loop.StartYaw().
    inline void Begin(FRun& Run, FLoop Loop, const FRunSettings& Settings, double Now, bool bSkyArgs, bool bExpectCVars)
    {
        Run = FRun();
        Run.Loop = std::move(Loop);
        Run.Settings = Settings;
        Run.Settings.WarmLaps = std::max(Run.Settings.WarmLaps, 0);
        Run.Settings.Laps = std::max(Run.Settings.Laps, 1);
        Run.Settings.Hold = std::max(Run.Settings.Hold, 0.0);
        Run.BeganAt = Now;
        Run.bExpectCVars = bExpectCVars;
        // A loop the car cannot drive fails as stuck; a run without a pinned sky never measures the shipped sky.
        if (Run.Loop.StopCount() < 2 || Run.Loop.Length <= 0.0) { Run.Phase = EPhase::Fail; Run.Exit = EExit::Stuck; }
        else if (!bSkyArgs) { Run.Phase = EPhase::Fail; Run.Exit = EExit::NoSky; }
    }

    // The readback of every expected CVar: any mismatch fails the run.
    inline void ReportCVars(FRun& Run, int Mismatches)
    {
        Run.bCVarsChecked = true;
        if (Mismatches > 0 && !Finished(Run)) { Run.Phase = EPhase::Fail; Run.Exit = EExit::CVarMismatch; }
    }

    inline void Abort(FRun& Run, EExit Exit)
    {
        if (Finished(Run)) return;
        Run.Phase = Exit == EExit::Done ? EPhase::Done : EPhase::Fail;
        Run.Exit = Exit;
    }

    // Unwrapped arc length where lap Lap starts. The run starts at the first stop with Along 0.
    inline double LapStart(const FRun& Run, int Lap) { return static_cast<double>(Lap - (1 - Run.Settings.WarmLaps)) * Run.Loop.Length; }

    inline void EnterLeg(FRun& Run, int Leg, double Now, FStep& Step)
    {
        Run.Phase = EPhase::Measure;
        Run.Leg = Leg;
        Run.Stop = -1;
        Run.StallMark = Run.Tracker.Along;
        Run.StallAt = Now;
        Step.Event = EEvent::LegBegin;
    }

    inline void EnterStop(FRun& Run, int Stop, double Now, FStep& Step)
    {
        if (Run.Settings.Hold <= 0.0) { EnterLeg(Run, Stop, Now, Step); return; }
        Run.Phase = EPhase::Hold;
        Run.Stop = Stop;
        Run.Leg = -1;
        Run.HoldEndsAt = Now + Run.Settings.Hold;
        Step.Event = EEvent::HoldBegin;
    }

    inline void FailRun(FRun& Run, EExit Exit, FStep& Step)
    {
        Run.Phase = EPhase::Fail;
        Run.Exit = Exit;
        Step.Event = EEvent::Fail;
    }

    // One tick. Call it every frame with the car's place, yaw and forward speed; bReady is true once the player sits in
    // the car at the first stop. Frames count toward a leg only while Run.Phase is Measure.
    inline FStep Tick(FRun& Run, double Now, double DeltaSeconds, const FVec2& Position, double Yaw, double Speed, bool bReady)
    {
        FStep Step;
        if (Finished(Run))
        {
            Step.Lap = Run.Lap;
            return Step;
        }
        const int Stops = Run.Loop.StopCount();
        if (Run.Phase == EPhase::Wait)
        {
            const bool bCVars = !Run.bExpectCVars || Run.bCVarsChecked;
            if (!bReady || !bCVars || Now - Run.BeganAt < Run.Settings.Delay)
            {
                if (Now - Run.BeganAt > Run.Settings.Delay + ReadyGrace) FailRun(Run, EExit::Timeout, Step);
            }
            else
            {
                Run.Tracker = FTracker();
                Track(Run.Tracker, Run.Loop, Position);
                Run.Lap = 1 - Run.Settings.WarmLaps;
                Run.LapDriving = 0.0;
                if (Run.Lap <= 0)
                {
                    Run.Phase = EPhase::WarmLap;
                    Run.Leg = 0;
                    Run.StallMark = Run.Tracker.Along;
                    Run.StallAt = Now;
                    Step.Event = EEvent::WarmBegin;
                }
                else EnterStop(Run, 0, Now, Step);
            }
        }
        else if (Run.Phase == EPhase::Hold)
        {
            if (Now >= Run.HoldEndsAt) EnterLeg(Run, Run.Stop, Now, Step);
        }
        else
        {
            Track(Run.Tracker, Run.Loop, Position);
            Run.LapDriving += DeltaSeconds;
            if (Run.Tracker.Along > Run.StallMark + StallProgress)
            {
                Run.StallMark = Run.Tracker.Along;
                Run.StallAt = Now;
            }
            const double Base = LapStart(Run, Run.Lap);
            const bool bWarm = Run.Phase == EPhase::WarmLap;
            // A warm lap drives through every stop; the last one stops at the first stop when measured laps hold there.
            const int Next = bWarm ? Stops : Run.Leg + 1;
            const double Target = Base + (Next < Stops ? Run.Loop.StopAlong(Next) : Run.Loop.Length);
            const bool bStop = Run.Settings.Hold > 0.0 && (!bWarm || Run.Lap == 0);
            const bool bArrived = bStop ? Target - Run.Tracker.Along <= ArriveRadius && std::fabs(Speed) < ArriveSpeed : Run.Tracker.Along >= Target;
            if (bWarm)
                while (Run.Leg + 1 < Stops && Run.Tracker.Along >= Base + Run.Loop.StopAlong(Run.Leg + 1)) ++Run.Leg;
            if (Now - Run.StallAt > StallSeconds) FailRun(Run, EExit::Stuck, Step);
            else if (Run.LapDriving > MaxLapSeconds) FailRun(Run, EExit::Timeout, Step);
            else if (bArrived && Next < Stops) EnterStop(Run, Next, Now, Step);
            else if (bArrived && !bWarm && Run.Lap >= Run.Settings.Laps)
            {
                Run.Phase = EPhase::Done;
                Run.Exit = EExit::Done;
                Step.Event = EEvent::Done;
            }
            else if (bArrived)
            {
                ++Run.Lap;
                Run.LapDriving = 0.0;
                if (Run.Lap <= 0)
                {
                    Run.Leg = 0;
                    Step.Event = EEvent::WarmBegin;
                }
                else EnterStop(Run, 0, Now, Step);
            }
            else Step.Controls = Drive(Run.Driver, Run.Loop, Run.Tracker, Position, Yaw, Speed, bStop ? Target : -1.0, Now, DeltaSeconds);
        }
        Step.Lap = Run.Lap;
        Step.Leg = Run.Leg;
        Step.Stop = Run.Stop;
        return Step;
    }

    // Frame statistics over a set of frame times.
    struct FFrameSummary
    {
        int Frames = 0;
        double Seconds = 0.0;
        double P50 = 0.0;
        double P95 = 0.0;
        double P99 = 0.0;
        double Max = 0.0;
        int OverBudget = 0;   // Over FrameBudgetMs.
        int Slow = 0;         // Over SlowFrameMs.
        int Hitches = 0;      // Over HitchMs.
        int Long = 0;         // Over LongFrameMs.
    };

    // Scripts/profile_package.py's percentile: the sorted value at ceil((n - 1) * Fraction). P50 uses it too.
    inline double Percentile(const std::vector<double>& Sorted, double Fraction)
    {
        if (Sorted.empty()) return 0.0;
        const double Rank = std::ceil(static_cast<double>(Sorted.size() - 1) * Fraction);
        return Sorted[std::min(Sorted.size() - 1, static_cast<std::size_t>(std::max(Rank, 0.0)))];
    }

    // Seconds is the sum of the frame times in the given order, divided by 1000.
    inline FFrameSummary Summarize(std::vector<double> Frames)
    {
        FFrameSummary Summary;
        Summary.Frames = static_cast<int>(Frames.size());
        double Total = 0.0;
        for (const double Ms : Frames)
        {
            Total += Ms;
            Summary.OverBudget += Ms > FrameBudgetMs;
            Summary.Slow += Ms > SlowFrameMs;
            Summary.Hitches += Ms > HitchMs;
            Summary.Long += Ms > LongFrameMs;
        }
        Summary.Seconds = Total / 1000.0;
        std::sort(Frames.begin(), Frames.end());
        Summary.P50 = Percentile(Frames, .5);
        Summary.P95 = Percentile(Frames, .95);
        Summary.P99 = Percentile(Frames, .99);
        Summary.Max = Frames.empty() ? 0.0 : Frames.back();
        return Summary;
    }

    // Every measured frame with its lap and leg, summarised for the whole run, one leg over all laps, or one lap.
    class FFrameLog
    {
    public:
        void Add(int Lap, int Leg, double FrameMs) { Samples.push_back({Lap, Leg, FrameMs}); }
        void Clear() { Samples.clear(); }
        int Count() const { return static_cast<int>(Samples.size()); }
        FFrameSummary All() const { return Collect(-1, -1); }
        FFrameSummary ForLeg(int Leg) const { return Collect(-1, Leg); }
        FFrameSummary ForLap(int Lap) const { return Collect(Lap, -1); }

    private:
        struct FSample
        {
            int Lap;
            int Leg;
            double Ms;
        };

        FFrameSummary Collect(int Lap, int Leg) const
        {
            std::vector<double> Frames;
            Frames.reserve(Samples.size());
            for (const FSample& Sample : Samples)
                if ((Lap < 0 || Sample.Lap == Lap) && (Leg < 0 || Sample.Leg == Leg)) Frames.push_back(Sample.Ms);
            return Summarize(std::move(Frames));
        }

        std::vector<FSample> Samples;
    };

    // Fixed-point text with Digits decimals, independent of the C locale (snprintf may print a decimal comma).
    inline std::string Fixed(double Value, int Digits)
    {
        long long Scale = 1;
        for (int Index = 0; Index < Digits; ++Index) Scale *= 10;
        const long long Scaled = std::llround(Value * static_cast<double>(Scale));
        const long long Magnitude = Scaled < 0 ? -Scaled : Scaled;
        std::string Fraction = std::to_string(Magnitude % Scale);
        if (Digits > 0) Fraction.insert(0, static_cast<std::size_t>(Digits) - Fraction.size(), '0');
        return (Scaled < 0 ? "-" : "") + std::to_string(Magnitude / Scale) + (Digits > 0 ? "." + Fraction : "");
    }

    // One summary as key=value pairs for the NORD_GAUNTLET summary log line; the keys match
    // Data/Gauntlet/fixtures/frametimes_expected.json.
    inline std::string FormatSummary(const FFrameSummary& Summary)
    {
        return "frames=" + std::to_string(Summary.Frames) + " seconds=" + Fixed(Summary.Seconds, 3)
            + " p50_ms=" + Fixed(Summary.P50, 3) + " p95_ms=" + Fixed(Summary.P95, 3) + " p99_ms=" + Fixed(Summary.P99, 3)
            + " max_ms=" + Fixed(Summary.Max, 3) + " over_33_3ms=" + std::to_string(Summary.OverBudget)
            + " over_50ms=" + std::to_string(Summary.Slow) + " over_66_7ms=" + std::to_string(Summary.Hitches)
            + " over_250ms=" + std::to_string(Summary.Long);
    }

    // The expected-CVar file (-NordGauntletExpect=): one name=value per line. Blank lines and lines that start with
    // # or ; are skipped, a # or ; after a space or tab starts a trailing comment, and a UTF-8 byte order mark is ignored.
    struct FCVarExpectation
    {
        std::string Name;
        std::string Value;
        int Line = 0;
    };

    struct FCVarFile
    {
        std::vector<FCVarExpectation> Values;
        std::vector<int> BadLines;   // No '=', an empty name or value, a space in the name, or a name given two values.
    };

    inline bool IsBlank(char Character) { return Character == ' ' || Character == '\t' || Character == '\r'; }

    inline std::string Trim(const std::string& Text)
    {
        std::size_t First = 0, Last = Text.size();
        while (First < Last && IsBlank(Text[First])) ++First;
        while (Last > First && IsBlank(Text[Last - 1])) --Last;
        return Text.substr(First, Last - First);
    }

    // A decimal number such as 75, -1.5, .25 or 1e3, read without the C locale. False for anything else.
    inline bool ParseNumber(const std::string& Text, double& Out)
    {
        const std::size_t Size = Text.size();
        std::size_t Index = 0;
        const bool bNegative = Index < Size && Text[Index] == '-';
        if (Index < Size && (Text[Index] == '-' || Text[Index] == '+')) ++Index;
        double Value = 0.0;
        int Digits = 0;
        for (; Index < Size && Text[Index] >= '0' && Text[Index] <= '9'; ++Index, ++Digits) Value = Value * 10.0 + static_cast<double>(Text[Index] - '0');
        if (Index < Size && Text[Index] == '.')
            for (double Scale = .1; ++Index < Size && Text[Index] >= '0' && Text[Index] <= '9'; Scale *= .1, ++Digits) Value += static_cast<double>(Text[Index] - '0') * Scale;
        if (Digits == 0) return false;
        if (Index < Size && (Text[Index] == 'e' || Text[Index] == 'E'))
        {
            ++Index;
            const bool bNegativeExponent = Index < Size && Text[Index] == '-';
            if (Index < Size && (Text[Index] == '-' || Text[Index] == '+')) ++Index;
            int Exponent = 0, ExponentDigits = 0;
            for (; Index < Size && Text[Index] >= '0' && Text[Index] <= '9'; ++Index, ++ExponentDigits) Exponent = std::min(Exponent * 10 + (Text[Index] - '0'), 400);
            if (ExponentDigits == 0) return false;
            Value *= std::pow(10.0, bNegativeExponent ? -Exponent : Exponent);
        }
        if (Index != Size) return false;
        Out = bNegative ? -Value : Value;
        return true;
    }

    // Numbers compare by value, because UE may print 75 as 75.000000; other text compares without case.
    inline bool CVarValueMatches(const std::string& Expected, const std::string& Actual)
    {
        double Want = 0.0, Have = 0.0;
        if (ParseNumber(Trim(Expected), Want) && ParseNumber(Trim(Actual), Have))
            return std::fabs(Want - Have) <= 1e-4 * std::max({1.0, std::fabs(Want), std::fabs(Have)});
        return EqualsNoCase(Trim(Expected), Trim(Actual));
    }

    inline FCVarFile ParseExpectedCVars(const std::string& Text)
    {
        FCVarFile File;
        std::size_t Start = Text.compare(0, 3, "\xEF\xBB\xBF") == 0 ? 3 : 0;
        for (int Line = 1; Start < Text.size(); ++Line)
        {
            std::size_t End = Text.find('\n', Start);
            if (End == std::string::npos) End = Text.size();
            std::string Body = Trim(Text.substr(Start, End - Start));
            Start = End + 1;
            if (Body.empty() || Body[0] == '#' || Body[0] == ';') continue;
            for (std::size_t Index = 1; Index < Body.size(); ++Index)
                if ((Body[Index] == '#' || Body[Index] == ';') && IsBlank(Body[Index - 1])) { Body = Trim(Body.substr(0, Index)); break; }
            const std::size_t Equals = Body.find('=');
            const std::string Name = Equals == std::string::npos ? std::string() : Trim(Body.substr(0, Equals));
            const std::string Value = Equals == std::string::npos ? std::string() : Trim(Body.substr(Equals + 1));
            bool bBad = Name.empty() || Value.empty() || Name.find_first_of(" \t") != std::string::npos;
            bool bRepeat = false;
            for (const FCVarExpectation& Earlier : File.Values)
                if (!bBad && EqualsNoCase(Earlier.Name, Name))
                {
                    bRepeat = true;
                    bBad = !CVarValueMatches(Earlier.Value, Value);
                }
            if (bBad) File.BadLines.push_back(Line);
            else if (!bRepeat) File.Values.push_back({Name, Value, Line});
        }
        return File;
    }

    struct FCVarMismatch
    {
        std::string Name;
        std::string Expected;
        std::string Actual;
        bool bMissing = false;
    };

    // Read fills the CVar's current value and returns false when no such CVar exists.
    inline std::vector<FCVarMismatch> CompareCVars(const std::vector<FCVarExpectation>& Expected,
        const std::function<bool(const std::string&, std::string&)>& Read)
    {
        std::vector<FCVarMismatch> Mismatches;
        for (const FCVarExpectation& Want : Expected)
        {
            std::string Actual;
            if (!Read(Want.Name, Actual)) Mismatches.push_back({Want.Name, Want.Value, std::string(), true});
            else if (!CVarValueMatches(Want.Value, Actual)) Mismatches.push_back({Want.Name, Want.Value, Actual, false});
        }
        return Mismatches;
    }
}
