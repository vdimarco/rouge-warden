#pragma once

// A pedal boat beside the north-pond bridge. No Unreal types.
// A car is not a pedalo. On the water the boat tops out at a paddle.
// Off the water it only creeps, so it can leave the bridge and cannot tour the streets.

#include <cmath>

namespace QuebecRide
{
    inline constexpr int CarKind = 0;
    inline constexpr int PedaloKind = 1;

    inline constexpr float PedaloTop = 650.f;
    inline constexpr float PedaloReverse = 220.f;
    inline constexpr float DockCrawl = 140.f;
    inline constexpr float Power = 280.f;
    inline constexpr float Coast = 200.f;
    inline constexpr float TurnDegrees = 35.f;

    // The footbridge across the north pond's south narrows. The deck is dry.
    inline constexpr double BridgeAx = -7689.869956;
    inline constexpr double BridgeAy = 3216.034800;
    inline constexpr double BridgeBx = -7731.984863;
    inline constexpr double BridgeBy = 3683.578800;
    // Far enough to sit in the channel, near enough that E on the deck still boards.
    inline constexpr double BerthGap = 280.;
    inline constexpr double DoorReach = 450.;
    inline constexpr float BerthZ = 48.f;
    inline constexpr float BerthYaw = 95.f;

    // East of the deck by BerthGap. hypot is not constexpr in this toolchain, so the point is written out.
    inline constexpr double BerthX = -7432.056481612848;
    inline constexpr double BerthY = 3474.9266244292967;

    inline bool IsPedalo(int Kind) { return Kind == PedaloKind; }
    inline bool Slides(int Kind) { return Kind == CarKind; }

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

    inline float TargetSpeed(float Throttle, bool bOnWater)
    {
        const float Held = ClampUnit(Throttle);
        if (Held > 0.01f) return (bOnWater ? PedaloTop : DockCrawl) * Held;
        if (Held < -0.01f) return (bOnWater ? -PedaloReverse : -DockCrawl) * (-Held);
        return 0.f;
    }

    // One paddle step. A car never calls this. Speed is cm/s, Step is seconds.
    inline float Advance(float Speed, float Throttle, bool bOnWater, float Step)
    {
        if (!(Step > 0.f)) return Speed;
        const float Target = TargetSpeed(Throttle, bOnWater);
        const bool bCoast = Target > -0.01f && Target < 0.01f;
        return MoveToward(Speed, Target, Step, bCoast ? Coast : Power);
    }

    inline float YawDegrees(float Speed, float Steer, float Step)
    {
        if (!(Step > 0.f)) return 0.f;
        const float Held = ClampUnit(Steer);
        const float Pace = std::fabs(Speed);
        const float Blend = Pace < 200.f ? 0.35f + 0.65f * (Pace / 200.f) : 1.f;
        return Held * TurnDegrees * Blend * Step;
    }
}
