#pragma once

// A kick scooter on the east lawn. No Unreal types.
// A car, a pedalo, and a bike are not a scooter. On land it tops out faster than a walk and slower than the bike.
// In the water it only creeps, so a dunk does not become a boat.

#include <cmath>

namespace QuebecScoot
{
    inline constexpr int ScootKind = 3;

    inline constexpr float Top = 620.f;
    inline constexpr float Reverse = 150.f;
    inline constexpr float Bog = 60.f;
    inline constexpr float Power = 500.f;
    inline constexpr float Coast = 180.f;
    inline constexpr float TurnDegrees = 80.f;

    // Dry lawn east of the ponds, clear of the roads and of the bike stand.
    inline constexpr double StandX = 28000.;
    inline constexpr double StandY = 8000.;
    inline constexpr float StandZ = 102.f;
    inline constexpr float StandYaw = 0.f;

    inline bool IsScoot(int Kind) { return Kind == ScootKind; }

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

    // One kick. A car never calls this. Speed is cm/s, Step is seconds.
    inline float Advance(float Speed, float Throttle, bool bInWater, float Step)
    {
        if (!(Step > 0.f)) return Speed;
        const float Target = TargetSpeed(Throttle, bInWater);
        const bool bCoast = Target > -0.01f && Target < 0.01f;
        return MoveToward(Speed, Target, Step, bCoast ? Coast : Power);
    }

    // Full lock turns 80 degrees a second at a stop, and 40 degrees a second at the top.
    inline float YawDegrees(float Speed, float Steer, float Step)
    {
        if (!(Step > 0.f)) return 0.f;
        const float Held = ClampUnit(Steer);
        const float Pace = std::fabs(Speed);
        const float Fraction = Pace >= Top ? 1.f : Pace / Top;
        const float Blend = 1.f - 0.5f * Fraction;
        return Held * TurnDegrees * Blend * Step;
    }
}
