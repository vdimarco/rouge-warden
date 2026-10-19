#pragma once

// Engine-independent rules for NORD street traffic and the traces that play leaves behind:
// ARRET stops, yielding to people, curb stops, the tyre-mark pool, and knocked-over street props.
// No Unreal includes, so Scripts/test_traffic_model.py can build and run it with the system compiler.
// Units are AQuebecCar's: centimetres, seconds, cm/s. "Ahead" and "Side" are a car's own planar frame
// (Side is positive to the right); "Along" is the distance along the car's current road segment.

#include <cmath>
#include <cstdint>

namespace QuebecTrafficModel
{
    inline float Clamp01(float Value) { return Value < 0.f ? 0.f : (Value > 1.f ? 1.f : Value); }
    inline float SmoothStep01(float Value) { const float T = Clamp01(Value); return T * T * (3.f - 2.f * T); }
    // Highest speed that still stops within Remaining cm at deceleration Brake (cm/s^2).
    inline float BrakingSpeed(float Remaining, float Brake) { return Remaining > 0.f ? std::sqrt(2.f * Brake * Remaining) : 0.f; }

    // ---- ARRET -----------------------------------------------------------------------------------------------
    // A full stop is under 30 cm/s for 0.8 s with the car's centre 9.5 m before the junction centre, so the front
    // bumper waits about 7.3 m out, behind the crosswalk of a 10-12 m residential street.
    inline constexpr float StopSpeed = 30.f;
    inline constexpr float StopHold = .8f;
    inline constexpr float StopLine = 950.f;
    inline constexpr float StopSearch = 2600.f;   // look for an ARRET this far ahead of the car's centre
    inline constexpr float StopTooClose = 600.f;  // nearer than this the car is already in the crossing: no stop
    inline constexpr float StopLaneSide = 450.f;  // the junction lies on the car's own street
    inline constexpr float StopAligned = .8f;     // and the car travels with the approach
    inline constexpr float StopBrake = 300.f;     // gentle approach deceleration
    inline constexpr float StopCreep = 150.f;     // the hold counts only within 1.5 m of the line
    inline constexpr float StopRollIn = 25.f;     // inside this the car brakes to a standstill

    // Ahead and Side locate a mapped stop junction in the car's frame; DirectionDot compares the car's travel with
    // the approach direction stored for that stop.
    inline bool StopApplies(float Ahead, float Side, float DirectionDot)
    {
        return Ahead > StopTooClose && Ahead < StopSearch && std::fabs(Side) < StopLaneSide && DirectionDot > StopAligned;
    }

    struct FStopGate
    {
        int Approach = -1;  // stop approach being served, or -1
        float Held = 0.f;   // seconds spent under StopSpeed at the line
        bool bServed = false;

        // NewApproach: the nearest stop approach that applies (or -1); Ahead: car centre to its junction centre.
        // Returns the speed limit for this traffic step; Desired passes through when no stop applies.
        float Update(int NewApproach, float Ahead, float CarSpeed, float Elapsed, float Desired)
        {
            if (NewApproach != Approach) { Approach = NewApproach; Held = 0.f; bServed = false; }
            if (Approach < 0 || bServed) return Desired;
            const float Remaining = Ahead - StopLine;
            // The hold must be continuous: creeping forward again restarts it.
            Held = Remaining <= StopCreep && std::fabs(CarSpeed) < StopSpeed ? Held + Elapsed : 0.f;
            if (Held >= StopHold) { bServed = true; return Desired; }
            if (Remaining <= StopRollIn) return 0.f;
            return std::fmin(Desired, BrakingSpeed(Remaining - StopRollIn, StopBrake));
        }
    };

    // ---- Yielding to people -----------------------------------------------------------------------------------
    inline constexpr float YieldReach = 800.f;      // people up to 8 m ahead of the front bumper
    inline constexpr float YieldBumper = 235.f;     // car centre to the front of its yield box (the traffic sweep box)
    inline constexpr float YieldHalfWidth = 190.f;  // half a car plus a person's shoulder room
    inline constexpr float YieldStopGap = 250.f;    // stand at least 2.5 m short of a person
    inline constexpr float YieldBrake = 450.f;
    inline constexpr float YieldPatience = 15.f;    // someone who stays in the lane this long is passed slowly
    inline constexpr float YieldIgnore = 4.f;
    inline constexpr float YieldCrawl = 230.f;

    // Gap from the car's front to a person at (Ahead, Side, Height) in its frame, or -1 when not in the lane ahead.
    inline float LaneGap(float Ahead, float Side, float Height)
    {
        if (std::fabs(Side) > YieldHalfWidth || std::fabs(Height) > 250.f) return -1.f;
        const float Gap = Ahead - YieldBumper;
        return Gap >= -150.f && Gap <= YieldReach ? std::fmax(Gap, 0.f) : -1.f;
    }

    inline float YieldSpeed(float Gap, float Desired)
    {
        if (Gap < 0.f) return Desired;
        return Gap <= YieldStopGap ? 0.f : std::fmin(Desired, BrakingSpeed(Gap - YieldStopGap, YieldBrake));
    }

    struct FYield
    {
        float Waiting = 0.f;    // seconds stopped for people
        float IgnoreFor = 0.f;  // seconds left of crawling past someone who does not move

        // NearestGap: the smallest LaneGap this step, or -1. Returns the speed limit.
        float Update(float NearestGap, float Elapsed, float Desired)
        {
            if (IgnoreFor > 0.f) { IgnoreFor -= Elapsed; return std::fmin(Desired, YieldCrawl); }
            const float Limit = YieldSpeed(NearestGap, Desired);
            Waiting = NearestGap >= 0.f && Limit <= 0.f ? Waiting + Elapsed : 0.f;
            if (Waiting >= YieldPatience) { Waiting = 0.f; IgnoreFor = YieldIgnore; }
            return Limit;
        }
    };

    // ---- Curb stops -------------------------------------------------------------------------------------------
    // The first stop comes 2-5 minutes after a car starts, so every car is still moving during the population check
    // (Scripts/population_test.py samples traffic motion at about 65-75 s of world time).
    inline constexpr float CurbFirst = 120.f;
    inline constexpr float CurbFirstSpan = 180.f;
    inline constexpr float CurbEvery = 180.f;       // then every 3-5 minutes
    inline constexpr float CurbEverySpan = 120.f;
    inline constexpr float CurbRetry = 2.f;         // re-check this often while a stop is due
    inline constexpr float CurbPark = 15.f;         // stopped 15-40 s
    inline constexpr float CurbParkSpan = 25.f;
    inline constexpr float CurbLane = 145.f;        // traffic lane centre from the road centre line
    inline constexpr float CurbBodyGap = 140.f;     // stopped car centre from the curb face (the parking rule)
    inline constexpr float CurbMinOffset = 375.f;   // the stopped car's inner side clears passing traffic's sweep box
    inline constexpr float CurbMaxOffset = 600.f;
    inline constexpr float CurbStartAlong = 300.f;  // clear of the junction behind before signalling
    inline constexpr float CurbAhead = 2200.f;      // the stop point lies this far ahead of the car when it decides
    inline constexpr float CurbJunctionClear = 2400.f;  // and this far before the segment end, so the merge back ends first
    inline constexpr float CurbExit = 1500.f;       // travel used to merge back into the lane
    inline constexpr float CurbTargetLead = 450.f;  // UpdateTraffic steers at a point at least 4.5 m ahead
    inline constexpr float CurbArrive = 150.f;      // a stop within 1.5 m of the planned point counts
    inline constexpr float CurbSignal = 1.8f;       // left signal shown before merging
    inline constexpr float CurbPullInLimit = 14.f;
    inline constexpr float CurbStopBrake = 250.f;
    inline constexpr float CurbMergeSpeed = 400.f;

    enum class ECurbPhase : uint8_t { Cruise, PullIn, Parked, Signal, PullOut };
    // Replicated lamp state of a traffic car.
    inline constexpr uint8_t SignalOff = 0;
    inline constexpr uint8_t SignalLeft = 1;
    inline constexpr uint8_t SignalRight = 2;
    inline constexpr uint8_t SignalHazard = 3;

    inline uint32_t Mix(uint32_t Value)
    {
        Value ^= Value >> 16; Value *= 0x7feb352dU;
        Value ^= Value >> 15; Value *= 0x846ca68bU;
        Value ^= Value >> 16;
        return Value;
    }
    // Deterministic [0, 1) from a car's seed and a salt.
    inline float Unit(uint32_t Seed, uint32_t Salt)
    {
        return static_cast<float>(Mix(Seed ^ Mix(Salt + 0x9e3779b9U)) >> 8) * (1.f / 16777216.f);
    }
    // Seconds until stop number Index (0 is the first) is due.
    inline float CurbInterval(uint32_t Seed, uint32_t Index)
    {
        return Index == 0 ? CurbFirst + CurbFirstSpan * Unit(Seed, 1U) : CurbEvery + CurbEverySpan * Unit(Seed, 2U * Index + 1U);
    }
    inline float CurbDuration(uint32_t Seed, uint32_t Index) { return CurbPark + CurbParkSpan * Unit(Seed, 2U * Index + 2U); }

    // What the planner knows about the road where a car might pull over.
    struct FCurbSite
    {
        float Along = 0.f;          // car centre along its segment
        float SegmentLength = 0.f;
        float StopAhead = 1e9f;     // car centre to the next ARRET line it faces
        bool bParkingSide = false;  // stopping is allowed at the curb on the car's right
        bool bRace = false;         // the campaign race is running or about to start
        int NearbyStops = 0;        // other cars pulled over within 40 m
    };

    // The stop point (along the segment) for a curb stop decided now, or -1 when this stretch must not be used:
    // too close to a junction, an ARRET, a no-stopping side, another stopped car, or the race.
    inline float CurbStopAlong(const FCurbSite& Site)
    {
        if (Site.bRace || !Site.bParkingSide || Site.NearbyStops > 0 || Site.Along < CurbStartAlong) return -1.f;
        const float Stop = Site.Along + CurbAhead;
        if (Site.SegmentLength - Stop < CurbJunctionClear || Site.StopAhead - CurbAhead < CurbJunctionClear) return -1.f;
        return Stop;
    }
    inline bool CurbOffsetFits(float Offset) { return Offset >= CurbMinOffset && Offset <= CurbMaxOffset; }

    struct FCurbStop
    {
        ECurbPhase Phase = ECurbPhase::Cruise;
        float Clock = 0.f;       // this car's traffic time
        float NextAt = -1.f;     // when the next stop is due; negative until scheduled
        float Until = 0.f;       // end of the current timed phase
        float StopAlong = 0.f;   // stop point on Segment
        float Offset = 0.f;      // stopped lateral position, from the road centre line
        float MergeAlong = 0.f;  // where the merge back into the lane began
        int Segment = -1;
        int FailedSegment = -1;  // a segment whose curb could not be used
        uint32_t Seed = 0;
        uint32_t Count = 0;      // stops made

        void Advance(float Elapsed, uint32_t NewSeed)
        {
            if (NextAt < 0.f) { Seed = NewSeed; NextAt = Clock + CurbInterval(Seed, 0U); }
            Clock += Elapsed;
        }
        bool Due(int CurrentSegment) const { return Phase == ECurbPhase::Cruise && NextAt >= 0.f && Clock >= NextAt && CurrentSegment != FailedSegment; }
        void Retry(int CurrentSegment, bool bSegmentUnusable)
        {
            NextAt = Clock + CurbRetry;
            if (bSegmentUnusable) FailedSegment = CurrentSegment;
        }
        void Begin(int CurrentSegment, float NewStopAlong, float NewOffset)
        {
            Phase = ECurbPhase::PullIn;
            Segment = CurrentSegment;
            StopAlong = NewStopAlong;
            Offset = NewOffset;
            Until = Clock + CurbPullInLimit;
        }
        void Finish()
        {
            Phase = ECurbPhase::Cruise;
            ++Count;
            NextAt = Clock + CurbInterval(Seed, Count);
        }
        // Lateral shift from the lane centre toward the curb for a steering target AtAlong on Segment.
        float Shift(float AtAlong) const
        {
            const float Full = Offset - CurbLane;
            switch (Phase)
            {
            // Ramps start beyond the steering target's lead, so the target slides sideways instead of jumping.
            case ECurbPhase::PullIn: return Full * SmoothStep01((AtAlong - (StopAlong - CurbAhead + 700.f)) / (CurbAhead - 1000.f));
            case ECurbPhase::Parked:
            case ECurbPhase::Signal: return Full;
            case ECurbPhase::PullOut: return Full * (1.f - SmoothStep01((AtAlong - MergeAlong - CurbTargetLead) / CurbExit));
            default: return 0.f;
            }
        }
        // One traffic step: returns the speed limit and sets the lamp signal. bLaneClear: nothing approaches in the
        // lane behind, so a stopped car may merge.
        float Update(int CurrentSegment, float Along, float CarSpeed, float Desired, bool bLaneClear, uint8_t& Signal)
        {
            Signal = SignalOff;
            if (Phase != ECurbPhase::Cruise && CurrentSegment != Segment) { Finish(); return Desired; }
            switch (Phase)
            {
            case ECurbPhase::PullIn:
            {
                const float Remaining = StopAlong - Along;
                const bool bArrived = Remaining <= CurbArrive && std::fabs(CarSpeed) < 15.f;
                if (bArrived || Clock >= Until)
                {
                    // A blocked pull-in parks where it is, briefly, rather than waiting in the lane forever.
                    Phase = ECurbPhase::Parked;
                    Until = Clock + (bArrived ? CurbDuration(Seed, Count) : 4.f);
                    Signal = SignalHazard;
                    return 0.f;
                }
                Signal = SignalRight;
                return Remaining <= 30.f ? 0.f : std::fmin(Desired, BrakingSpeed(Remaining - 30.f, CurbStopBrake));
            }
            case ECurbPhase::Parked:
                if (Clock < Until) { Signal = SignalHazard; return 0.f; }
                Phase = ECurbPhase::Signal;
                Until = Clock + CurbSignal;
                Signal = SignalLeft;
                return 0.f;
            case ECurbPhase::Signal:
                Signal = SignalLeft;
                if (Clock < Until || !bLaneClear) return 0.f;
                Phase = ECurbPhase::PullOut;
                MergeAlong = Along;
                return std::fmin(Desired, CurbMergeSpeed);
            case ECurbPhase::PullOut:
                if (Along >= MergeAlong + CurbExit) { Finish(); return Desired; }
                Signal = SignalLeft;
                return std::fmin(Desired, CurbMergeSpeed);
            default:
                return Desired;
            }
        }
    };

    // ---- Tyre marks ---------------------------------------------------------------------------------------------
    inline constexpr int MarkCapacity = 300;      // per world; the oldest mark is reused first
    inline constexpr float MarkLife = 90.f;
    inline constexpr float MarkFade = 15.f;       // the last 15 s a mark narrows away
    inline constexpr float MarkMinLength = 120.f; // lay a new quad once a wheel has moved this far
    inline constexpr float MarkMaxLength = 260.f; // a longer jump (teleport, frame hitch) starts a new streak
    inline constexpr float MarkWidth = 22.f;
    inline constexpr float SkidLateral = 260.f;
    inline constexpr float SkidHandbrakeSpeed = 450.f;
    inline constexpr float SkidBrake = 1900.f;    // service brake and handbrake decelerate harder; coasting does not
    inline constexpr float SkidBrakeSpeed = 600.f;

    // bAmbientTraffic: an AI traffic car, which brakes with its handbrake at every stop and must not mark the road.
    inline bool IsSkidding(float Speed, float LateralSpeed, bool bHandbrake, float Deceleration, bool bAmbientTraffic)
    {
        const float Forward = std::fabs(Speed), Sideways = std::fabs(LateralSpeed);
        if (Sideways > SkidLateral && Forward + Sideways > 400.f) return true;
        if (bAmbientTraffic) return false;
        return (bHandbrake && Forward > SkidHandbrakeSpeed) || (Deceleration > SkidBrake && Forward > SkidBrakeSpeed);
    }
    // Smooths a deceleration estimate made from replicated speed, which arrives in steps.
    inline float FilterDeceleration(float Previous, float Raw, float Elapsed) { return Previous + (Raw - Previous) * Clamp01(Elapsed * 8.f); }

    struct FMarkRing
    {
        float Born[MarkCapacity] = {};
        int Count = 0;  // slots used so far, at most MarkCapacity
        int Next = 0;

        // The slot for a new mark: a fresh one until the pool is full, then the oldest.
        int Claim(float Now)
        {
            const int Slot = Next;
            Born[Slot] = Now;
            Next = (Next + 1) % MarkCapacity;
            if (Count < MarkCapacity) ++Count;
            return Slot;
        }
        // Width scale of a mark: 1 while fresh, narrowing to 0 when it expires.
        float Scale(int Slot, float Now) const
        {
            if (Slot < 0 || Slot >= Count) return 0.f;
            return Clamp01((MarkLife - (Now - Born[Slot])) / MarkFade);
        }
        int Live(float Now) const
        {
            int Result = 0;
            for (int Slot = 0; Slot < Count; ++Slot) Result += Scale(Slot, Now) > 0.f ? 1 : 0;
            return Result;
        }
    };

    // ---- Street props -------------------------------------------------------------------------------------------
    inline constexpr float PropReset = 120.f;
    inline constexpr float TumbleFlight = .55f;
    inline constexpr float TumbleSlide = .35f;

    // A car's planar box (HalfLength ahead and behind, HalfWidth each side, facing ForwardX/ForwardY) moves from
    // (FromX, FromY) to (ToX, ToY), positions relative to a prop at the origin. True when the box passes over the
    // prop's disc of Radius during the step; the step is tested as a swept segment, so fast cars never tunnel.
    inline bool SweptBoxTouches(float FromX, float FromY, float ToX, float ToY, float ForwardX, float ForwardY,
        float HalfLength, float HalfWidth, float Radius)
    {
        // The prop's position in the car's frame at both ends of the step.
        const float StartAhead = -(FromX * ForwardX + FromY * ForwardY), StartSide = FromX * ForwardY - FromY * ForwardX;
        const float EndAhead = -(ToX * ForwardX + ToY * ForwardY), EndSide = ToX * ForwardY - ToY * ForwardX;
        float Enter = 0.f, Leave = 1.f;
        const auto Slab = [&Enter, &Leave](float Start, float Delta, float Extent)
        {
            if (std::fabs(Delta) < 1e-6f) return std::fabs(Start) <= Extent;
            float Near = (-Extent - Start) / Delta, Far = (Extent - Start) / Delta;
            if (Near > Far) { const float Swap = Near; Near = Far; Far = Swap; }
            Enter = std::fmax(Enter, Near);
            Leave = std::fmin(Leave, Far);
            return Enter <= Leave;
        };
        return Slab(StartAhead, EndAhead - StartAhead, HalfLength + Radius) && Slab(StartSide, EndSide - StartSide, HalfWidth + Radius);
    }

    // How far a struck prop travels: light cones fly, heavy bins topple close by.
    inline float KnockTravel(float CarSpeed, float Mass)
    {
        const float Travel = std::fabs(CarSpeed) * .3f / Mass;
        return Travel < 80.f ? 80.f : (Travel > 700.f ? 700.f : Travel);
    }

    struct FTumble
    {
        float Travel = 0.f;  // 0..1 of the way from home to the rest point
        float Height = 0.f;  // cm above the straight path
        float Tip = 0.f;     // degrees toward the push, 90 lying down
        float Spin = 0.f;    // 0..1 of the prop's total spin
    };
    // Comic ballistic tumble T seconds after a hit: a parabolic hop of Apex cm while tipping over, then a short slide.
    inline FTumble Tumble(float T, float Apex)
    {
        FTumble Pose;
        const float Flight = Clamp01(T / TumbleFlight);
        const float Settle = Clamp01(T / (TumbleFlight + TumbleSlide));
        Pose.Travel = 1.f - (1.f - Settle) * (1.f - Settle);
        Pose.Height = Apex * 4.f * Flight * (1.f - Flight);
        Pose.Tip = 90.f * SmoothStep01(Flight * 1.25f);
        Pose.Spin = Pose.Travel;
        return Pose;
    }
    inline bool TumbleDone(float T) { return T >= TumbleFlight + TumbleSlide; }
}
