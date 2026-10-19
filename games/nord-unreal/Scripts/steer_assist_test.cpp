// Standalone test for Source/Quebec/QuebecSteerAssist.h. Built and run by Scripts/test_steer_assist.py.
// With QUEBEC_STEER_STRICT the Unreal macro names are poisoned before the header is read, so the header cannot
// use them. The closed-loop part drives a simulated player through a 150 ms input delay and prints the numbers.

#ifdef QUEBEC_STEER_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FMath
#endif
#include "../Source/Quebec/QuebecSteerAssist.h"

#include <cstdarg>
#include <cstdio>
#include <vector>

using namespace QuebecSteer;

namespace
{
    int Failures = 0;
    int Assertions = 0;

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

    bool Near(float A, float B, float Tolerance) { return std::fabs(A - B) <= Tolerance; }

    // The steering rule in QuebecGameplay.cpp before this change, kept here as the baseline.
    float LegacyTurnInRate(float Input, float State) { return std::fabs(Input) < .01f || Input * State < 0.f ? 10.f : 3.5f; }

    // The pinned values must come out of the shared formula unchanged.
    void TestPinnedHandling()
    {
        Expect(Near(LockDegrees(0.f), 30.f, 1.e-4f) && Near(LockDegrees(2400.f), 4.2f, 1.e-4f) && Near(LockDegrees(-3000.f), 4.2f, 1.e-4f),
            "lock is 30 at rest and 4.2 from 2400 cm/s");
        // 900 cm/s full lock: lock = Lerp(30, 4.2, SmoothStep(0,2400,900)) = 21.83 degrees, yaw about 66.7 deg/s.
        Expect(Near(YawRateFor(900.f, 1.f, false), 66.7f, .2f), "full lock at 900 cm/s yaws about 66.7 deg/s (%.3f)", static_cast<double>(YawRateFor(900.f, 1.f, false)));
        Expect(YawRateFor(900.f, -1.f, false) == -YawRateFor(900.f, 1.f, false), "steering is symmetric");
        Expect(Near(YawRateFor(900.f, 1.f, true), 66.7f * 1.4f, .3f), "handbrake turns 1.4x faster above 450 cm/s");
        Expect(YawRateFor(400.f, 1.f, true) == YawRateFor(400.f, 1.f, false), "handbrake does not boost below 450 cm/s");
        Expect(YawRateFor(800.f, 1.f, true) <= MaxYawRate, "yaw is clamped to 110 deg/s");
        // Keyboard input is 0 or full: the new rate rule equals the old one for every keyboard case.
        const float States[] = {-1.f, -.6f, -.2f, 0.f, .2f, .6f, 1.f};
        const float Keys[] = {-1.f, 0.f, 1.f};
        for (float Key : Keys)
            for (float Held : States)
                Expect(TurnInRate(900.f, Key, Held, false) == LegacyTurnInRate(Key, Held),
                    "keyboard turn-in unchanged for input %.1f state %.1f", static_cast<double>(Key), static_cast<double>(Held));
        Expect(TurnInRate(900.f, .25f, 0.f, false) == HoldRate, "partial input still builds at 3.5/s");
        Expect(TurnInRate(900.f, .33f, .66f, false) == ReleaseRate, "easing to a smaller graded level is quick");
        Expect(TurnInRate(900.f, .66f, .2f, true) == HoldRate, "assist keeps city-speed turn-in");
        Expect(Near(TurnInRate(2600.f, .66f, .2f, true), FastHoldRate, 1.e-5f), "assist slows highway turn-in of a graded level");
        Expect(TurnInRate(2600.f, 1.f, .2f, true) == HoldRate, "full lock keeps today's turn-in on a road");
        Expect(Near(MoveToward(0.f, 1.f, .1f, 3.5f), .35f, 1.e-6f) && MoveToward(.99999f, 1.f, .1f, 3.5f) == 1.f, "constant-rate approach");
        Expect(Near(DeltaAngle(170.f, -170.f), 20.f, 1.e-4f) && Near(DeltaAngle(-170.f, 170.f), -20.f, 1.e-4f), "shortest signed turn wraps");
    }

    void TestRoadChoice()
    {
        FAssistState Road;
        Expect(Road.Offer(0.f, 200.f, 500.f) && !Road.Offer(90.f, 700.f, 500.f), "segments count only within the curb plus margin");
        FRoadHeading Choice = ChooseRoadHeading(10.f, 0.f, Road);
        Expect(Choice.bOnRoad && !Choice.bJunction && Near(Choice.Error, -10.f, 1.e-4f), "a straight street pulls a 10 degree drift back");
        Choice = ChooseRoadHeading(-172.f, 0.f, Road);
        Expect(Choice.bOnRoad && Near(Choice.Error, -8.f, 1.e-4f), "the street's reverse direction is used when driving the other way");
        Expect(!ChooseRoadHeading(50.f, 0.f, Road).bOnRoad, "a deliberate turn across the street is left alone");
        Road.Offer(.5f, 120.f, 500.f);
        Expect(!ChooseRoadHeading(10.f, 0.f, Road).bJunction, "collinear waypoints are not a junction");
        Road.Offer(90.f, 100.f, 450.f);
        Choice = ChooseRoadHeading(10.f, 0.f, Road);
        Expect(Choice.bJunction && Choice.bOnRoad && Near(Choice.Error, -9.5f, 1.e-4f), "at a junction the lined-up street is kept");
        Expect(!ChooseRoadHeading(25.f, 0.f, Road).bOnRoad, "at a junction a car mid-turn is not pulled back");
        Choice = ChooseRoadHeading(80.f, .05f, Road);
        Expect(Choice.bOnRoad && Near(Choice.Error, 10.f, 1.e-4f), "at a junction a wheel turned left keeps the left street");
        Expect(!ChooseRoadHeading(100.f, .05f, Road).bOnRoad, "at a junction the wheel's side wins over the closer street behind it");
        Expect(Near(SegmentDistance(0.f, 300.f, -100.f, 0.f, 100.f, 0.f), 300.f, 1.e-3f) &&
            Near(SegmentDistance(400.f, 0.f, -100.f, 0.f, 100.f, 0.f), 300.f, 1.e-3f), "segment distance uses the nearest point");
        Expect(Near(SegmentDirection(0.f, 0.f, 0.f, 10.f), 90.f, 1.e-4f), "segment direction follows Unreal yaw");
    }

    void TestAssistRules()
    {
        FRoadHeading Off;
        Expect(AssistedYawRate(900.f, 1.f, .5f, false, Off) == YawRateFor(900.f, .5f, false), "turn-in is not damped");
        const float Released = AssistedYawRate(900.f, 0.f, .5f, false, Off);
        Expect(Near(Released, YawRateFor(900.f, .5f, false) * ExcessYawKeep, 1.e-3f), "after a release only a quarter of the leftover yaw remains");
        Expect(AssistedYawRate(900.f, -1.f, .5f, false, Off) < 0.f, "a countersteer reverses the yaw at once");
        FRoadHeading Street;
        Street.bOnRoad = true;
        Street.Error = -10.f;
        Expect(Near(AssistedYawRate(1200.f, 0.f, 0.f, false, Street), -24.f, 1.e-3f), "a centred wheel straightens at up to 24 deg/s");
        Expect(AssistedYawRate(1200.f, .2f, .2f, false, Street) == YawRateFor(1200.f, .2f, false), "a wheel outside the centre band is obeyed");
        Expect(AssistedYawRate(1200.f, 0.f, 0.f, true, Street) == 0.f, "handbrake slides are never straightened");
        Expect(AssistedYawRate(200.f, 0.f, 0.f, false, Street) == 0.f, "a crawling car is not turned");
        Expect(Near(GlanceTurn(.866f, -.5f, 0.f, 1.f, 90.f), 30.f, .1f), "a 30 degree scrape lines up with the wall");
        Expect(Near(GlanceTurn(.866f, -.5f, 0.f, 1.f, 1.5f), 1.5f, 1.e-4f), "the wall turn is rate limited");
        Expect(GlanceTurn(0.f, -1.f, 0.f, 1.f, 90.f) == 0.f && GlanceTurn(1.f, .1f, 0.f, 1.f, 90.f) == 0.f, "square hits and departures do not turn");
        Expect(ImpactDamage(500.f, true) == 0.f && Near(ImpactDamage(3000.f, true), 48.f, 1.e-3f) && Near(ImpactDamage(1500.f, false), 25.f, 1.e-3f),
            "damage starts above city bumps and four hard rams wreck a car");

        FStuckWatch Stuck;
        bool bFired = false;
        for (int Frame = 0; Frame < 89; ++Frame) bFired |= Stuck.Update(1.f / 60.f, 2.f, 0.f, true);
        Expect(!bFired, "not stuck before 1.5 s");
        bFired = false;
        for (int Frame = 0; Frame < 4; ++Frame) bFired |= Stuck.Update(1.f / 60.f, 2.f, 0.f, true);
        Expect(bFired, "stuck after 1.5 s of throttle without progress");
        Stuck = FStuckWatch();
        bFired = false;
        for (int Frame = 0; Frame < 300; ++Frame) bFired |= Stuck.Update(1.f / 60.f, static_cast<float>(Frame) * 5.f, 0.f, true);
        Expect(!bFired, "a moving car is never stuck");
        bFired = false;
        for (int Frame = 0; Frame < 300; ++Frame) bFired |= Stuck.Update(1.f / 60.f, 0.f, 0.f, Frame % 60 != 0);
        Expect(!bFired, "lifting the throttle resets the watch");
    }

    // ---- Closed loop: a player keeps the car in its lane through a delayed stream. ----

    enum class EDriver { Keyboard, Graded };
    // Hold the street heading after a swerve, or also steer back to the lane centre.
    enum class ETask { Heading, Lane };

    struct FRun
    {
        int Reversals = 0;       // Heading swings across the street direction by more than 3 degrees each way.
        int Wobbles = 0;         // The same with 1 degree each way.
        int InputFlips = 0;      // Times the player switched steering side.
        float RmsHeading = 0.f;  // Heading error, degrees, after the first second.
        float PeakHeading = 0.f; // Largest heading error after the first second.
        float RmsLane = 0.f;     // Lateral offset, cm, after the first second.
    };

    // A graded wheel as the browser sends it: zero, a third, two thirds or full on each side.
    float Graded(float Wheel)
    {
        const float Size = std::fabs(Wheel);
        const float Level = Size < .18f ? 0.f : (Size < .45f ? .33f : (Size < .75f ? .66f : 1.f));
        return Wheel < 0.f ? -Level : Level;
    }

    // The car starts 2.5 m off the lane centre, nosed 10 degrees further out. In the heading task the player only
    // wants to drive straight down the street; in the lane task the player aims at the lane centre 15 m ahead.
    // The player sees the car as it is and the command reaches the car after the delay. A keyboard player taps
    // full lock beyond 2.5 degrees of error; a touch player drags the graded wheel in proportion.
    // The road runs along +X and is 10 m wide.
    FRun Drive(ETask Task, EDriver Driver, bool bAssist, float Speed, float DelaySeconds, float Seconds = 10.f)
    {
        constexpr float Step = 1.f / 60.f;
        const int Delay = static_cast<int>(DelaySeconds / Step + .5f);
        std::vector<float> Pipe(static_cast<size_t>(Delay) + 1, 0.f);
        size_t Head = 0;
        float Y = 250.f, Heading = 10.f, State = 0.f, LastInput = 0.f, Sum = 0.f, LaneSum = 0.f, Swing = 0.f, Wobble = 0.f;
        int Samples = 0;
        FRun Run;
        FAssistState Road;
        for (int Frame = 0; Frame < static_cast<int>(Seconds / Step); ++Frame)
        {
            const float Wanted = Task == ETask::Lane ? std::atan2(-Y, 1500.f) * (180.f / Pi) : 0.f;
            const float Error = DeltaAngle(Heading, Wanted);
            float Input = 0.f;
            if (Driver == EDriver::Keyboard) Input = Error > 2.5f ? 1.f : (Error < -2.5f ? -1.f : 0.f);
            else Input = Graded(Clamp(Error / 12.f, -1.f, 1.f));
            if (Input != 0.f && Input * LastInput < 0.f) ++Run.InputFlips;
            if (Input != 0.f) LastInput = Input;
            // What the player commands now reaches the car after the stream delay.
            Pipe[Head] = Input;
            Head = (Head + 1) % Pipe.size();
            const float Arrived = Pipe[Head];

            const float Rate = bAssist ? TurnInRate(Speed, Arrived, State, true) : LegacyTurnInRate(Arrived, State);
            State = MoveToward(State, Arrived, Step, Rate);
            float Yaw = YawRateFor(Speed, State, false);
            if (bAssist)
            {
                Road.Count = 0;
                Road.Offer(0.f, std::fabs(Y), 500.f);
                Yaw = AssistedYawRate(Speed, Arrived, State, false, ChooseRoadHeading(Heading, Arrived, Road));
            }
            Heading += Yaw * Step;
            Y += Speed * std::sin(Heading * (Pi / 180.f)) * Step;
            if (Frame < 60) continue;
            const float Off = DeltaAngle(0.f, Heading);
            Sum += Off * Off;
            LaneSum += Y * Y;
            ++Samples;
            if (std::fabs(Off) > Run.PeakHeading) Run.PeakHeading = std::fabs(Off);
            // A reversal is a swing past the street direction by more than 3 degrees on the other side.
            if ((Swing >= 0.f && Off < -3.f) || (Swing <= 0.f && Off > 3.f))
            {
                if (Swing != 0.f) ++Run.Reversals;
                Swing = Off;
            }
            if ((Wobble >= 0.f && Off < -1.f) || (Wobble <= 0.f && Off > 1.f))
            {
                if (Wobble != 0.f) ++Run.Wobbles;
                Wobble = Off;
            }
        }
        Run.RmsHeading = std::sqrt(Sum / static_cast<float>(Samples));
        Run.RmsLane = std::sqrt(LaneSum / static_cast<float>(Samples));
        return Run;
    }

    void PrintRun(const char* Label, const FRun& Run)
    {
        std::printf("  %-22s reversals %3d (1 deg: %3d)  input flips %3d  heading rms %5.2f peak %5.2f deg  lane rms %5.1f cm\n", Label,
            Run.Reversals, Run.Wobbles, Run.InputFlips, static_cast<double>(Run.RmsHeading), static_cast<double>(Run.PeakHeading),
            static_cast<double>(Run.RmsLane));
    }

    void TestClosedLoop()
    {
        const float Speeds[] = {600.f, 1000.f, 1500.f, 2200.f};
        for (ETask Task : {ETask::Heading, ETask::Lane})
            for (float Delay : {.15f, .25f})
            {
                int KeyTodayTotal = 0, KeyAssistTotal = 0, TouchTodayTotal = 0, TouchAssistTotal = 0;
                const char* TaskName = Task == ETask::Heading ? "hold the street heading" : "return to the lane centre";
                for (float Speed : Speeds)
                {
                    std::printf("%s, delay %.0f ms, %.0f cm/s\n", TaskName, static_cast<double>(Delay * 1000.f), static_cast<double>(Speed));
                    const FRun KeyToday = Drive(Task, EDriver::Keyboard, false, Speed, Delay);
                    const FRun KeyAssist = Drive(Task, EDriver::Keyboard, true, Speed, Delay);
                    const FRun TouchToday = Drive(Task, EDriver::Graded, false, Speed, Delay);
                    const FRun TouchAssist = Drive(Task, EDriver::Graded, true, Speed, Delay);
                    PrintRun("keyboard, today", KeyToday);
                    PrintRun("keyboard, assist", KeyAssist);
                    PrintRun("graded wheel, today", TouchToday);
                    PrintRun("graded wheel, assist", TouchAssist);
                    KeyTodayTotal += KeyToday.Reversals + KeyToday.Wobbles;
                    KeyAssistTotal += KeyAssist.Reversals + KeyAssist.Wobbles;
                    TouchTodayTotal += TouchToday.Reversals + TouchToday.Wobbles;
                    TouchAssistTotal += TouchAssist.Reversals + TouchAssist.Wobbles;
                    if (Delay > .2f) continue;
                    // With 150 ms of delay the assisted car stays closer to the street heading and overshoots less.
                    Expect(KeyAssist.RmsHeading < KeyToday.RmsHeading && TouchAssist.RmsHeading < TouchToday.RmsHeading,
                        "%s at %.0f cm/s: assist heading rms %.2f/%.2f, today %.2f/%.2f", TaskName, static_cast<double>(Speed),
                        static_cast<double>(KeyAssist.RmsHeading), static_cast<double>(TouchAssist.RmsHeading),
                        static_cast<double>(KeyToday.RmsHeading), static_cast<double>(TouchToday.RmsHeading));
                    Expect(KeyAssist.PeakHeading < KeyToday.PeakHeading, "%s, keyboard at %.0f cm/s: assist overshoot %.2f, today %.2f", TaskName,
                        static_cast<double>(Speed), static_cast<double>(KeyAssist.PeakHeading), static_cast<double>(KeyToday.PeakHeading));
                    Expect(TouchAssist.Reversals <= TouchToday.Reversals && TouchAssist.Wobbles <= TouchToday.Wobbles,
                        "%s, graded wheel at %.0f cm/s: assist swings %d/%d, today %d/%d", TaskName, static_cast<double>(Speed),
                        TouchAssist.Reversals, TouchAssist.Wobbles, TouchToday.Reversals, TouchToday.Wobbles);
                }
                std::printf("%s, delay %.0f ms: heading swings over all speeds (3 + 1 degree) keyboard %d -> %d, graded wheel %d -> %d\n",
                    TaskName, static_cast<double>(Delay * 1000.f), KeyTodayTotal, KeyAssistTotal, TouchTodayTotal, TouchAssistTotal);
                if (Delay > .2f) continue;
                // The requirement as written: fewer heading oscillations than without the assist under a 150 ms delay.
                Expect(KeyAssistTotal < KeyTodayTotal, "%s: keyboard swings %d with assist, %d today", TaskName, KeyAssistTotal, KeyTodayTotal);
                Expect(TouchAssistTotal < TouchTodayTotal || TouchTodayTotal == 0, "%s: graded wheel swings %d with assist, %d today", TaskName,
                    TouchAssistTotal, TouchTodayTotal);
            }
    }

    // After a release on a straight street the assisted car lines up within a second; today's car keeps its drift.
    void TestReleaseStraightens()
    {
        constexpr float Step = 1.f / 60.f;
        FAssistState Road;
        float Heading = 12.f;
        for (int Frame = 0; Frame < 60; ++Frame)
        {
            Road.Count = 0;
            Road.Offer(0.f, 100.f, 500.f);
            Heading += AssistedYawRate(1200.f, 0.f, 0.f, false, ChooseRoadHeading(Heading, 0.f, Road)) * Step;
        }
        std::printf("release at 12 degrees, 1200 cm/s: heading after 1 s %.3f degrees (today 12.000)\n", static_cast<double>(Heading));
        Expect(std::fabs(Heading) < 1.f, "a released wheel lines the car up with the street within a second (%.3f)", static_cast<double>(Heading));
    }
}

int main()
{
    TestPinnedHandling();
    TestRoadChoice();
    TestAssistRules();
    TestReleaseStraightens();
    TestClosedLoop();
    std::printf("steer assist: %d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
