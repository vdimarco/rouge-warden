// Standalone test for Source/Quebec/QuebecTrafficModel.h. Built and run by Scripts/test_traffic_model.py.
// With QUEBEC_TRAFFIC_STRICT the Unreal macro names are poisoned before the header is read, so the header
// cannot use them. The traffic steps below copy AQuebecCar's traffic dynamics (UpdateTraffic's throttle rule and
// SimulateDrive's traffic branch) so the stop, yield and curb rules are exercised with the car's real response.

#ifdef QUEBEC_TRAFFIC_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG INDEX_NONE MAX_flt
#endif
#include "../Source/Quebec/QuebecTrafficModel.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecTrafficModel;

namespace
{
    int Failures = 0;
    int Assertions = 0;
    float StopCentre = 0.f, StopHeld = 0.f, StopTime = 0.f, YieldGap = 0.f, CurbStopped = 0.f, CurbPoint = 0.f;

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

    constexpr float Step = .05f;  // traffic tick interval

    // AQuebecCar::UpdateTraffic's throttle choice and SimulateDrive's traffic branch, one 0.05 s step.
    float TrafficStep(float Speed, float Desired)
    {
        if (Desired <= 0.f) return std::fmax(0.f, Speed - 3200.f * Step);  // bHandbrake
        const float Throttle = Desired > Speed + 40.f ? .65f : (Speed > Desired + 40.f ? -.6f : 0.f);
        float Next = Speed + Throttle * (Throttle * Speed < 0.f ? 2400.f : 1250.f) * Step;
        if (Next > 2400.f) Next = 2400.f;
        if (Throttle == 0.f) Next = Next > 0.f ? std::fmax(0.f, Next - 800.f * Step) : Next;
        return Next;
    }

    void TestStopGate()
    {
        Expect(StopApplies(1800.f, 140.f, .99f), "a stop ahead on the car's street applies");
        Expect(!StopApplies(500.f, 140.f, .99f), "a car already in the crossing does not stop");
        Expect(!StopApplies(1800.f, 600.f, .99f), "a junction on another street does not stop the car");
        Expect(!StopApplies(1800.f, 140.f, .2f), "a stop for the crossing street does not stop the car");
        Expect(!StopApplies(3000.f, 140.f, .99f), "a far stop does not slow the car yet");

        // A car cruising at 650 cm/s toward a stop junction 26 m ahead.
        FStopGate Gate;
        float Ahead = 2590.f, Speed = 650.f, Time = 0.f, Held = 0.f, StopAt = -1.f, Longest = 0.f;
        bool bPassed = false;
        for (int Frame = 0; Frame < 400 && !bPassed; ++Frame)
        {
            const int Approach = StopApplies(Ahead, 145.f, 1.f) ? 3 : -1;
            const float Desired = Gate.Update(Approach, Ahead, Speed, Step, 650.f);
            Speed = TrafficStep(Speed, Desired);
            Ahead -= Speed * Step;
            Time += Step;
            if (Speed < StopSpeed && Ahead > StopTooClose) { Held += Step; if (StopAt < 0.f) StopAt = Ahead; }
            else { Longest = std::fmax(Longest, Held); Held = 0.f; }
            bPassed = Ahead < 0.f;
        }
        Expect(StopAt > 900.f && StopAt < 1000.f, "the car stops with its centre 9.0-10.0 m from the junction (%.1f cm)", static_cast<double>(StopAt));
        Expect(Longest >= StopHold - .001f, "the car holds under 30 cm/s for at least 0.8 s (%.2f s)", static_cast<double>(Longest));
        Expect(bPassed && Time < 9.f, "then proceeds through the junction (%.2f s)", static_cast<double>(Time));
        StopCentre = StopAt; StopHeld = Longest; StopTime = Time;
        Expect(Gate.Update(-1, 0.f, Speed, Step, 650.f) == 650.f && !Gate.bServed, "a junction behind the car leaves the gate idle");

        // The reservation test's start: stopped 12.5 m out. A served stop never holds the car twice.
        FStopGate Again;
        Again.Update(1, 1500.f, 0.f, Step, 650.f);
        Expect(Again.Update(1, 1500.f, 0.f, Step, 650.f) > 0.f, "a stopped car far from the line moves up to it");
        Again.bServed = true;
        Expect(Again.Update(1, 950.f, 0.f, Step, 650.f) == 650.f, "a served stop releases the car");
    }

    void TestYield()
    {
        Expect(LaneGap(700.f, 50.f, -95.f) > 400.f && LaneGap(700.f, 50.f, -95.f) < 500.f, "a resident 7 m ahead in the lane is seen");
        Expect(LaneGap(700.f, 260.f, -95.f) < 0.f, "a person on the sidewalk beside the lane is ignored");
        Expect(LaneGap(1200.f, 0.f, 0.f) < 0.f, "a person beyond 8 m ahead of the bumper is ignored");
        Expect(LaneGap(-100.f, 0.f, 0.f) < 0.f, "a person behind the car's nose is ignored");
        Expect(LaneGap(150.f, 0.f, 0.f) == 0.f, "a person touching the bumper gives a zero gap");
        Expect(LaneGap(700.f, 0.f, 400.f) < 0.f, "a person on a balcony is ignored");

        // A car at 650 cm/s meets a person standing in its lane 10 m ahead of its centre.
        FYield Yield;
        float Ahead = 1000.f, Speed = 650.f, MinGap = 1e9f;
        for (int Frame = 0; Frame < 100; ++Frame)
        {
            const float Desired = Yield.Update(LaneGap(Ahead, 30.f, -95.f), Step, 650.f);
            Speed = TrafficStep(Speed, Desired);
            Ahead -= Speed * Step;
            MinGap = std::fmin(MinGap, Ahead - YieldBumper);
        }
        Expect(Speed == 0.f && MinGap >= 180.f, "the car stops short of the person (gap %.0f cm)", static_cast<double>(MinGap));
        YieldGap = MinGap;
        // Someone who never moves is passed at a crawl after 15 s, then yielded to again.
        float Crawl = 0.f;
        for (int Frame = 0; Frame < 400; ++Frame)
        {
            const float Limit = Yield.Update(0.f, Step, 650.f);
            if (Limit > 0.f) Crawl += Step;
            Expect(Limit <= YieldCrawl, "patience never allows more than a crawl near a person");
        }
        Expect(Crawl > 3.5f && Crawl < 9.f, "patience gives short crawls past a person who stays put (%.2f s in 20 s)", static_cast<double>(Crawl));
        FYield Clear;
        Expect(Clear.Update(-1.f, Step, 650.f) == 650.f, "an empty lane keeps the cruise speed");
    }

    void TestCurbPlanner()
    {
        FCurbSite Site;
        Site.Along = 600.f; Site.SegmentLength = 6000.f; Site.bParkingSide = true;
        const float Stop = CurbStopAlong(Site);
        Expect(Stop == 2800.f, "a long parking street gives a stop point 22 m ahead (%.0f)", static_cast<double>(Stop));
        Site.SegmentLength = 5100.f;
        Expect(CurbStopAlong(Site) < 0.f, "a stop point within 24 m of the junction ahead is refused");
        Site.SegmentLength = 6000.f; Site.Along = 100.f;
        Expect(CurbStopAlong(Site) < 0.f, "a car still leaving the junction behind does not signal");
        Site.Along = 600.f; Site.bParkingSide = false;
        Expect(CurbStopAlong(Site) < 0.f, "a no-stopping curb is refused");
        Site.bParkingSide = true; Site.bRace = true;
        Expect(CurbStopAlong(Site) < 0.f, "nobody pulls over during the campaign race");
        Site.bRace = false; Site.NearbyStops = 1;
        Expect(CurbStopAlong(Site) < 0.f, "a second car does not stop beside another stopped car");
        Site.NearbyStops = 0; Site.StopAhead = 3500.f;
        Expect(CurbStopAlong(Site) < 0.f, "a stop point close to an ARRET line is refused");
        Expect(!CurbOffsetFits(300.f) && CurbOffsetFits(420.f) && !CurbOffsetFits(700.f), "only a curb that clears the lane fits");

        // Schedule: first stop after 1-5 minutes, then every 3-5 minutes; stops last 15-40 s; all deterministic.
        float FirstMin = 1e9f, FirstMax = 0.f, EveryMin = 1e9f, EveryMax = 0.f, ParkMin = 1e9f, ParkMax = 0.f;
        for (uint32_t Seed = 1; Seed < 400; ++Seed)
        {
            const float First = CurbInterval(Seed, 0U);
            FirstMin = std::fmin(FirstMin, First); FirstMax = std::fmax(FirstMax, First);
            for (uint32_t Index = 1; Index < 6; ++Index)
            {
                const float Every = CurbInterval(Seed, Index), Park = CurbDuration(Seed, Index);
                EveryMin = std::fmin(EveryMin, Every); EveryMax = std::fmax(EveryMax, Every);
                ParkMin = std::fmin(ParkMin, Park); ParkMax = std::fmax(ParkMax, Park);
            }
        }
        Expect(FirstMin >= 60.f && FirstMax <= 300.f && FirstMax - FirstMin > 200.f, "first stops spread over 1-5 minutes");
        Expect(EveryMin >= 180.f && EveryMax <= 300.f && EveryMax - EveryMin > 100.f, "later stops come every 3-5 minutes");
        Expect(ParkMin >= 15.f && ParkMax <= 40.f && ParkMax - ParkMin > 20.f, "stops last 15-40 s");
        Expect(CurbInterval(77U, 3U) == CurbInterval(77U, 3U) && CurbInterval(77U, 3U) != CurbInterval(78U, 3U), "the schedule is seeded per car");
    }

    void TestCurbCycle()
    {
        // A car on a 60 m segment decides to stop at 6 m along and runs the whole cycle.
        FCurbStop Curb;
        Curb.Advance(0.f, 1234U);
        Expect(Curb.NextAt >= 60.f && !Curb.Due(5), "a new car is not due for a curb stop at once");
        Curb.Clock = Curb.NextAt;
        Expect(Curb.Due(5), "the stop falls due on schedule");
        Curb.Retry(5, true);
        Curb.Clock += CurbRetry;
        Expect(!Curb.Due(5) && Curb.Due(6), "an unusable segment is skipped until the car turns");
        FCurbSite Site;
        Site.Along = 600.f; Site.SegmentLength = 6000.f; Site.bParkingSide = true;
        Curb.Begin(6, CurbStopAlong(Site), 430.f);
        float Along = 600.f, Speed = 650.f, LastShift = 0.f, MaxJump = 0.f, ParkedFor = 0.f, StopPoint = -1.f;
        int RightFrames = 0, HazardFrames = 0, LeftFrames = 0, Order = 0;
        bool bHazardBeforeLeft = true;
        for (int Frame = 0; Frame < 2000 && Order < 2; ++Frame)
        {
            uint8_t Signal = SignalOff;
            const float Desired = Curb.Update(6, Along, Speed, 650.f, true, Signal);
            Speed = TrafficStep(Speed, Desired);
            Along += Speed * Step;
            Curb.Advance(Step, 1234U);
            const float Shift = Curb.Shift(Along + 450.f + .3f * Speed);
            MaxJump = std::fmax(MaxJump, std::fabs(Shift - LastShift));
            LastShift = Shift;
            if (Signal == SignalRight) ++RightFrames;
            if (Signal == SignalHazard) { ++HazardFrames; ParkedFor += Step; if (StopPoint < 0.f) StopPoint = Along; }
            if (Signal == SignalLeft) { ++LeftFrames; bHazardBeforeLeft = bHazardBeforeLeft && HazardFrames > 0; }
            if (Order == 0 && Curb.Phase != ECurbPhase::Cruise) Order = 1;
            if (Order == 1 && Curb.Phase == ECurbPhase::Cruise) Order = 2;
        }
        Expect(Order == 2, "the car pulls over and rejoins traffic");
        CurbStopped = ParkedFor; CurbPoint = StopPoint;
        Expect(RightFrames > 20 && HazardFrames > 0 && LeftFrames > 20 && bHazardBeforeLeft, "it signals right, shows hazards, then signals left");
        Expect(ParkedFor >= 15.f && ParkedFor <= 40.2f, "it stays at the curb 15-40 s (%.1f s)", static_cast<double>(ParkedFor));
        Expect(StopPoint > 2800.f - CurbArrive - 1.f && StopPoint < 2850.f && 6000.f - StopPoint >= CurbJunctionClear - CurbArrive,
            "it stops near the planned point, more than 20 m before the junction (%.0f)", static_cast<double>(StopPoint));
        Expect(MaxJump < 25.f, "the steering target slides to and from the curb without jumps (%.1f cm)", static_cast<double>(MaxJump));
        Expect(Curb.Count == 1 && Curb.NextAt - Curb.Clock >= 179.f, "the next stop is minutes away");
        Expect(Curb.Shift(Along) == 0.f, "a cruising car keeps the lane centre");

        // Waiting for the lane: no merge while traffic approaches behind.
        FCurbStop Waiting;
        Waiting.Advance(0.f, 9U);
        Waiting.Begin(2, 2800.f, 430.f);
        Waiting.Phase = ECurbPhase::Signal;
        Waiting.Until = 0.f;
        uint8_t Signal = SignalOff;
        Expect(Waiting.Update(2, 2800.f, 0.f, 650.f, false, Signal) == 0.f && Signal == SignalLeft, "a stopped car waits for a gap in the lane");
        Expect(Waiting.Update(2, 2800.f, 0.f, 650.f, true, Signal) > 0.f && Waiting.Phase == ECurbPhase::PullOut, "and merges into the gap");
        Expect(Waiting.Update(3, 2900.f, 300.f, 650.f, true, Signal) == 650.f && Waiting.Phase == ECurbPhase::Cruise, "a turn ends the manoeuvre");

        // A pull-in blocked by a parked car parks briefly where it is instead of blocking the lane forever.
        FCurbStop Blocked;
        Blocked.Advance(0.f, 5U);
        Blocked.Begin(4, 2800.f, 430.f);
        Blocked.Clock += CurbPullInLimit;
        Expect(Blocked.Update(4, 1500.f, 0.f, 650.f, true, Signal) == 0.f && Blocked.Phase == ECurbPhase::Parked && Blocked.Until - Blocked.Clock < 5.f,
            "a blocked pull-in gives up after 14 s");
    }

    void TestMarks()
    {
        Expect(!IsSkidding(500.f, 0.f, true, 3200.f, true), "ambient traffic braking at a stop leaves no marks");
        Expect(IsSkidding(500.f, 400.f, false, 0.f, true), "a sliding traffic car marks the road");
        Expect(IsSkidding(900.f, 0.f, true, 0.f, false), "a handbrake at speed marks the road");
        Expect(!IsSkidding(300.f, 0.f, true, 0.f, false), "a handbrake at walking pace does not");
        Expect(IsSkidding(1500.f, 0.f, false, 3200.f, false), "a hard brake marks the road");
        Expect(!IsSkidding(1500.f, 0.f, false, 700.f, false), "lifting off does not");
        Expect(!IsSkidding(400.f, 0.f, false, 3200.f, false), "braking from a crawl does not");
        float Filtered = 0.f;
        for (int Frame = 0; Frame < 30; ++Frame) Filtered = FilterDeceleration(Filtered, Frame % 2 ? 6400.f : 0.f, 1.f / 60.f);
        Expect(Filtered > 2000.f && Filtered < 4400.f, "stepped replicated speed still reads as hard braking (%.0f)", static_cast<double>(Filtered));

        FMarkRing Ring;
        int Highest = -1;
        for (int Mark = 0; Mark < 1000; ++Mark) { const int Slot = Ring.Claim(static_cast<float>(Mark) * .01f); Highest = Slot > Highest ? Slot : Highest; }
        Expect(Ring.Count == MarkCapacity && Highest == MarkCapacity - 1, "the pool never grows past %d marks", MarkCapacity);
        Expect(Ring.Next == 1000 % MarkCapacity, "the oldest mark is reused first");
        FMarkRing Fresh;
        const int Slot = Fresh.Claim(10.f);
        Expect(Fresh.Scale(Slot, 10.f) == 1.f && Fresh.Scale(Slot, 70.f) == 1.f, "a mark stays whole for 75 s");
        Expect(Fresh.Scale(Slot, 92.5f) > .4f && Fresh.Scale(Slot, 92.5f) < .6f, "then narrows away");
        Expect(Fresh.Scale(Slot, 100.f) == 0.f && Fresh.Live(100.f) == 0 && Fresh.Live(50.f) == 1, "and is gone after 90 s");
        Expect(Fresh.Scale(5, 10.f) == 0.f, "an unused slot is never shown");
    }

    void TestProps()
    {
        // A car 2.35 m long each way and 1.1 m wide each side, heading +X, passes a cone of radius 20 cm.
        Expect(!SweptBoxTouches(-400.f, 100.f, -350.f, 100.f, 1.f, 0.f, 235.f, 110.f, 20.f), "a car 3.5 m short of the cone misses it");
        Expect(SweptBoxTouches(-280.f, 100.f, -230.f, 100.f, 1.f, 0.f, 235.f, 110.f, 20.f), "the bumper reaching a cone in its lane hits it");
        Expect(SweptBoxTouches(-280.f, 125.f, 280.f, 125.f, 1.f, 0.f, 235.f, 110.f, 20.f), "a car passing 1.25 m to the side still clips a 20 cm cone");
        Expect(!SweptBoxTouches(-280.f, 160.f, 280.f, 160.f, 1.f, 0.f, 235.f, 110.f, 20.f), "a car passing 1.6 m to the side misses");
        Expect(SweptBoxTouches(-900.f, 0.f, 900.f, 0.f, 1.f, 0.f, 235.f, 110.f, 20.f), "a fast step over the cone never tunnels");
        Expect(SweptBoxTouches(0.f, -900.f, 0.f, 900.f, 0.f, 1.f, 235.f, 110.f, 20.f), "the test follows the car's heading");
        Expect(KnockTravel(3000.f, 1.f) == 700.f && KnockTravel(100.f, 2.f) == 80.f, "knock distance is bounded");
        Expect(KnockTravel(1500.f, 1.f) > KnockTravel(1500.f, 2.2f), "bins travel less than cones");
        const FTumble Start = Tumble(0.f, 60.f), Mid = Tumble(TumbleFlight * .5f, 60.f), Land = Tumble(TumbleFlight, 60.f), Rest = Tumble(5.f, 60.f);
        Expect(Start.Height == 0.f && Start.Tip == 0.f && Start.Travel == 0.f, "a tumble starts at home, upright");
        Expect(Mid.Height == 60.f && Mid.Tip > 20.f && Mid.Tip < 80.f, "it hops and tips in the air");
        Expect(Land.Height == 0.f && Land.Tip == 90.f && Land.Travel > .8f && Land.Travel < 1.f, "it lands on its side and slides");
        Expect(Rest.Travel == 1.f && Rest.Tip == 90.f && Rest.Height == 0.f && TumbleDone(5.f) && !TumbleDone(.5f), "then rests where it fell");
        float Previous = -1.f;
        bool bMonotonic = true;
        for (int Frame = 0; Frame <= 60; ++Frame)
        {
            const float Travel = Tumble(static_cast<float>(Frame) / 60.f, 60.f).Travel;
            bMonotonic = bMonotonic && Travel >= Previous;
            Previous = Travel;
        }
        Expect(bMonotonic, "a tumbling prop never slides backward");
    }
}

int main()
{
    TestStopGate();
    TestYield();
    TestCurbPlanner();
    TestCurbCycle();
    TestMarks();
    TestProps();
    std::printf("ARRET: centre stops %.0f cm from the junction, holds %.2f s, through after %.2f s; yield gap %.0f cm; curb stop at %.0f cm for %.1f s\n",
        static_cast<double>(StopCentre), static_cast<double>(StopHeld), static_cast<double>(StopTime), static_cast<double>(YieldGap),
        static_cast<double>(CurbPoint), static_cast<double>(CurbStopped));
    std::printf("traffic model: %d checks, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
