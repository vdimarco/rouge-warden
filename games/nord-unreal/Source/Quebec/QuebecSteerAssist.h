#pragma once

// Engine-independent steering for player cars driven through a laggy video stream: speed-based turn-in,
// a damper on yaw beyond what the wheel asks for, road-heading straightening near the centre of the wheel,
// a stuck watch and the collision forgiveness numbers.
// No Unreal includes, so Scripts/test_steer_assist.py can build and run it with the system compiler.
// Angles are degrees, speeds cm/s, distances cm and times seconds. Yaw follows Unreal: atan2(Y, X).

#include <cmath>

namespace QuebecSteer
{
    // Today's player handling. The off-road path reproduces it exactly, so the pinned driving tests keep their numbers.
    inline constexpr float HoldRate = 3.5f;          // Steering units/s toward a held input.
    inline constexpr float ReleaseRate = 10.f;       // Toward neutral, a smaller graded level or the other side.
    inline constexpr float Wheelbase = 310.f;
    inline constexpr float LockSlow = 30.f;          // Wheel lock at rest...
    inline constexpr float LockFast = 4.2f;          // ...and from 2,400 cm/s.
    inline constexpr float LockFadeSpeed = 2400.f;
    inline constexpr float MaxYawRate = 110.f;
    inline constexpr float HandbrakeYawScale = 1.4f;
    inline constexpr float HandbrakeYawSpeed = 450.f;

    // Assist, active only for a player car on a road.
    inline constexpr float FastHoldRate = 2.6f;      // Turn-in at highway speed, so lane changes do not overshoot.
    inline constexpr float FastHoldFrom = 1200.f;
    inline constexpr float FastHoldTo = 2600.f;
    inline constexpr float ExcessYawKeep = .25f;     // Share of the yaw beyond the wheel's request that remains.
    inline constexpr float CentreBand = .15f;        // Below this the road may straighten the car.
    inline constexpr float WheelHint = .02f;         // A residual wheel this large picks the side at a junction.
    inline constexpr float AlignGain = 2.6f;         // Correction in deg/s per degree of heading error.
    inline constexpr float AlignMaxRate = 24.f;
    inline constexpr float AlignMaxError = 32.f;     // A larger error is a deliberate turn across the street.
    inline constexpr float JunctionMaxError = 15.f;  // At a junction only a car already lined up is helped.
    inline constexpr float JunctionSplit = 25.f;     // Streets this far apart in direction form a junction.
    inline constexpr float AlignSpeedFrom = 300.f;
    inline constexpr float AlignSpeedTo = 1100.f;
    inline constexpr float RoadMargin = 100.f;       // Beyond the curb that still counts as on the road.
    inline constexpr int MaxRoadCandidates = 8;

    // Collision forgiveness.
    inline constexpr float GlanceMaxDot = .5f;       // Hits within 30 degrees of the wall line are glancing scrapes.
    inline constexpr float GlanceTurnRate = 90.f;    // deg/s the nose turns along a scraped wall.
    inline constexpr float StuckSeconds = 1.5f;      // Throttle held this long without progress...
    inline constexpr float StuckProgress = 40.f;     // ...of at least this far counts as stuck.
    inline constexpr float StuckMaxSpeed = 150.f;
    inline constexpr float StuckTurnLimit = 30.f;    // The recovery nudge turns toward the street by at most this.
    inline constexpr float WallDamageSpeed = 600.f;  // Closing speed that starts to dent the body on a wall...
    inline constexpr float WallDamagePerSpeed = .02f;
    inline constexpr float CarDamageSpeed = 500.f;   // ...and on another car (each car takes this damage).
    inline constexpr float CarDamagePerSpeed = .025f;

    inline constexpr float Pi = 3.1415926535897932f;

    inline float Clamp(float Value, float Low, float High) { return Value < Low ? Low : (Value > High ? High : Value); }
    inline float Lerp(float A, float B, float Alpha) { return A + Alpha * (B - A); }

    // Hermite step of X between A and B, 0 below A and 1 from B (FMath::SmoothStep).
    inline float SmoothStep(float A, float B, float X)
    {
        if (X < A) return 0.f;
        if (X >= B) return 1.f;
        const float Fraction = (X - A) / (B - A);
        return Fraction * Fraction * (3.f - 2.f * Fraction);
    }

    // Constant-rate approach (FMath::FInterpConstantTo).
    inline float MoveToward(float Current, float Target, float Seconds, float Rate)
    {
        const float Gap = Target - Current;
        if (Gap * Gap < 1.e-8f) return Target;
        const float Limit = Rate * Seconds;
        return Current + Clamp(Gap, -Limit, Limit);
    }

    // Signed shortest turn from one heading to another, -180..180.
    inline float DeltaAngle(float From, float To)
    {
        float Delta = std::fmod(To - From, 360.f);
        if (Delta > 180.f) Delta -= 360.f;
        else if (Delta < -180.f) Delta += 360.f;
        return Delta;
    }

    inline float LockDegrees(float Speed) { return Lerp(LockSlow, LockFast, SmoothStep(0.f, LockFadeSpeed, std::fabs(Speed))); }

    // How fast the steering state follows the input. Easing to a smaller graded level is as quick as a release,
    // which a keyboard never notices (its input is 0 or full).
    inline float TurnInRate(float Speed, float Input, float State, bool bAssist)
    {
        if (std::fabs(Input) < .01f || Input * State < 0.f || std::fabs(Input) < std::fabs(State)) return ReleaseRate;
        if (!bAssist) return HoldRate;
        return Lerp(HoldRate, FastHoldRate, SmoothStep(FastHoldFrom, FastHoldTo, std::fabs(Speed)));
    }

    // Kinematic yaw rate of a steering state: bicycle model with the speed-based lock, clamped.
    inline float YawRateFor(float Speed, float State, bool bHandbrake)
    {
        const float Lock = LockDegrees(Speed);
        float Rate = (Speed / Wheelbase * std::tan((State * Lock) * (Pi / 180.f))) * (180.f / Pi);
        if (bHandbrake && std::fabs(Speed) > HandbrakeYawSpeed) Rate *= HandbrakeYawScale;
        return Clamp(Rate, -MaxYawRate, MaxYawRate);
    }

    // A road segment near the car: its direction, the car's distance from its centre line and its half-width.
    struct FRoadCandidate
    {
        float Direction = 0.f;
        float Distance = 0.f;
        float HalfWidth = 0.f;
    };

    // Throttle held against an obstacle without progress for StuckSeconds.
    struct FStuckWatch
    {
        float Seconds = 0.f;
        float AnchorX = 0.f;
        float AnchorY = 0.f;
        bool bArmed = false;

        // True once each time the car has been stuck for StuckSeconds; the wait then starts again.
        bool Update(float DeltaSeconds, float X, float Y, bool bPushing)
        {
            if (!bPushing) { Seconds = 0.f; bArmed = false; return false; }
            const float MovedX = X - AnchorX, MovedY = Y - AnchorY;
            if (!bArmed || MovedX * MovedX + MovedY * MovedY > StuckProgress * StuckProgress)
            {
                AnchorX = X; AnchorY = Y; Seconds = 0.f; bArmed = true;
                return false;
            }
            Seconds += DeltaSeconds;
            if (Seconds < StuckSeconds) return false;
            Seconds = 0.f; bArmed = false;
            return true;
        }
    };

    // Per-car assist state: the road segments near the car this frame and the stuck watch.
    struct FAssistState
    {
        FRoadCandidate Candidates[MaxRoadCandidates];
        int Count = 0;
        FStuckWatch Stuck;

        // Keeps a segment that the car is on (within its half-width plus the margin).
        bool Offer(float Direction, float Distance, float HalfWidth)
        {
            if (Count >= MaxRoadCandidates || Distance > HalfWidth + RoadMargin) return false;
            Candidates[Count].Direction = Direction;
            Candidates[Count].Distance = Distance;
            Candidates[Count].HalfWidth = HalfWidth;
            ++Count;
            return true;
        }
    };

    // Distance from a point to a segment in the plane.
    inline float SegmentDistance(float X, float Y, float AX, float AY, float BX, float BY)
    {
        const float DX = BX - AX, DY = BY - AY;
        const float LengthSquared = DX * DX + DY * DY;
        float Along = LengthSquared > 1.e-6f ? ((X - AX) * DX + (Y - AY) * DY) / LengthSquared : 0.f;
        Along = Clamp(Along, 0.f, 1.f);
        const float OffX = X - (AX + DX * Along), OffY = Y - (AY + DY * Along);
        return std::sqrt(OffX * OffX + OffY * OffY);
    }

    // Unreal yaw of the direction from A to B.
    inline float SegmentDirection(float AX, float AY, float BX, float BY) { return std::atan2(BY - AY, BX - AX) * (180.f / Pi); }

    struct FRoadHeading
    {
        bool bOnRoad = false;    // A street direction was chosen.
        bool bJunction = false;  // Streets of different directions meet here.
        float Error = 0.f;       // Signed turn from the car's heading to the chosen street direction.
    };

    // The street direction to straighten toward: of every nearby segment, both ways, the one closest to the heading.
    // At a junction a residual wheel picks the side it points to, and only a car already lined up is helped.
    // MaxError limits how far from the heading a direction may be.
    inline FRoadHeading ChooseRoadHeading(float Heading, float Input, const FAssistState& State, float MaxError = AlignMaxError)
    {
        FRoadHeading Result;
        for (int I = 0; I < State.Count && !Result.bJunction; ++I)
            for (int J = I + 1; J < State.Count; ++J)
            {
                const float Apart = std::fabs(DeltaAngle(State.Candidates[I].Direction, State.Candidates[J].Direction));
                if (Apart > JunctionSplit && Apart < 180.f - JunctionSplit) { Result.bJunction = true; break; }
            }
        const bool bWheelPicks = Result.bJunction && std::fabs(Input) >= WheelHint;
        const float Limit = Result.bJunction ? (MaxError < JunctionMaxError ? MaxError : JunctionMaxError) : MaxError;
        float Best = Limit;
        for (int I = 0; I < State.Count; ++I)
            for (int Way = 0; Way < 2; ++Way)
            {
                const float Error = DeltaAngle(Heading, State.Candidates[I].Direction + (Way ? 180.f : 0.f));
                if (bWheelPicks && Error * Input < 0.f) continue;
                if (std::fabs(Error) > Best) continue;
                Best = std::fabs(Error);
                Result.bOnRoad = true;
                Result.Error = Error;
            }
        return Result;
    }

    // Yaw rate of an assisted car. Turn-in follows the steering state as today. Yaw the state still carries beyond
    // what the wheel now asks for (after a release or a countersteer) is damped, and with the wheel near centre
    // the car turns toward the chosen street direction.
    inline float AssistedYawRate(float Speed, float Input, float State, bool bHandbrake, const FRoadHeading& Road)
    {
        const float Asked = YawRateFor(Speed, Input, bHandbrake);
        float Rate = YawRateFor(Speed, State, bHandbrake);
        const bool bTurningIn = Asked * Rate >= 0.f && std::fabs(Rate) <= std::fabs(Asked);
        if (!bTurningIn) Rate = Asked + (Rate - Asked) * ExcessYawKeep;
        if (Road.bOnRoad && !bHandbrake && Speed > AlignSpeedFrom && std::fabs(Input) < CentreBand)
        {
            const float Strength = SmoothStep(AlignSpeedFrom, AlignSpeedTo, Speed) * (1.f - std::fabs(Input) / CentreBand);
            Rate += Clamp(Road.Error * AlignGain, -AlignMaxRate, AlignMaxRate) * Strength;
        }
        return Clamp(Rate, -MaxYawRate, MaxYawRate);
    }

    // Turn (degrees, at most MaxTurn either way) that lines the car's nose up with a wall it scrapes at a glancing
    // angle. Forward and Normal are planar unit vectors; Normal points out of the wall. Zero for a square hit.
    inline float GlanceTurn(float ForwardX, float ForwardY, float NormalX, float NormalY, float MaxTurn)
    {
        const float Into = ForwardX * NormalX + ForwardY * NormalY;
        if (Into >= 0.f || Into < -GlanceMaxDot) return 0.f;
        const float AlongX = ForwardX - NormalX * Into, AlongY = ForwardY - NormalY * Into;
        const float Turn = DeltaAngle(std::atan2(ForwardY, ForwardX) * (180.f / Pi), std::atan2(AlongY, AlongX) * (180.f / Pi));
        return Clamp(Turn, -MaxTurn, MaxTurn);
    }

    // Body damage (0..100 scale) from a hit at this closing speed.
    inline float ImpactDamage(float ClosingSpeed, bool bWall)
    {
        const float Start = bWall ? WallDamageSpeed : CarDamageSpeed;
        return ClosingSpeed > Start ? (ClosingSpeed - Start) * (bWall ? WallDamagePerSpeed : CarDamagePerSpeed) : 0.f;
    }
}
