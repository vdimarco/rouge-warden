#pragma once

// The pace a player keeps when they get out of a moving car. No Unreal types.
// At a walk or slower, getting out plants them. Faster than that, they keep the
// car's planar pace, capped, and it eases off.

#include <cmath>

namespace QuebecBail
{
    inline constexpr float PlantAt = 450.f;
    inline constexpr float Cap = 900.f;
    inline constexpr float Decay = 1400.f;

    inline float CarryPace(float Forward, float Lateral)
    {
        const double Pace = std::hypot(static_cast<double>(Forward), static_cast<double>(Lateral));
        if (!(Pace > static_cast<double>(PlantAt))) return 0.f;
        const double Capped = Pace > static_cast<double>(Cap) ? static_cast<double>(Cap) : Pace;
        return static_cast<float>(Capped);
    }

    inline float Ease(float Speed, float Step)
    {
        if (!(Speed > 0.f)) return 0.f;
        if (!(Step > 0.f)) return Speed;
        const float Next = Speed - Decay * Step;
        return Next > 0.f ? Next : 0.f;
    }
}
