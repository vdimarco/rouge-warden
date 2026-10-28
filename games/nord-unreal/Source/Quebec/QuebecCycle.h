#pragma once

// A park bike at a dry stand east of the spawn. No Unreal types.
// A car is not a bike. On land it tops out faster than a walk and slower than a street car.
// In the water it only creeps, so a dunk does not become a boat.

#include <cmath>

namespace QuebecCycle
{
    inline constexpr int BikeKind = 2;

    inline constexpr float Top = 900.f;
    inline constexpr float Reverse = 200.f;
    inline constexpr float Bog = 90.f;
    inline constexpr float Power = 380.f;
    inline constexpr float Coast = 140.f;
    inline constexpr float TurnDegrees = 70.f;

    // Dry park, about 53 m from the spawn, past the nearest road by more than a car length.
    inline constexpr double StandX = 34800.;
    inline constexpr double StandY = -4000.;
    inline constexpr float StandZ = 102.f;
    inline constexpr float StandYaw = 90.f;

    inline bool IsBike(int Kind) { return Kind == BikeKind; }

    inline float ClampUnit(float Value)
    {
        if (Value > 1.f) return 1.f;
        if (Value < -1.f) return -1.f;
        return Value;
    }

    inline float MoveToward(float Current, float Target, float Step, float Rate)
    {
        const float Gap = Target - Current;
        const float Limit = Rate * Step;
        if (Gap > Limit) return Current + Limit;
        if (Gap < -Limit) return Current - Limit;
        return Target;
    }

    inline float TargetSpeed(float Throttle, bool bInWater)
    {
        const float Held = ClampUnit(Throttle);
        if (Held > 0.01f) return (bInWater ? Bog : Top) * Held;
        if (Held < -0.01f) return (bInWater ? -Bog : -Reverse) * (-Held);
        return 0.f;
    }

    // One pedal step. A car never calls this. Speed is cm/s, Step is seconds.
    inline float Advance(float Speed, float Throttle, bool bInWater, float Step)
    {
        if (!(Step > 0.f)) return Speed;
        const float Target = TargetSpeed(Throttle, bInWater);
        const bool bCoast = Target > -0.01f && Target < 0.01f;
        return MoveToward(Speed, Target, Step, bCoast ? Coast : Power);
    }

    // Full lock turns 70 degrees a second at a stop, and 31.5 degrees a second at the top.
    inline float YawDegrees(float Speed, float Steer, float Step)
    {
        if (!(Step > 0.f)) return 0.f;
        const float Held = ClampUnit(Steer);
        const float Pace = std::fabs(Speed);
        const float Fraction = Pace >= Top ? 1.f : Pace / Top;
        const float Blend = 1.f - 0.55f * Fraction;
        return Held * TurnDegrees * Blend * Step;
    }
}
