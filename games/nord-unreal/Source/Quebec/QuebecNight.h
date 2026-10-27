#pragma once

// The opening hour, and the neon blades on the near sidewalk of Rue Sherbrooke.
//
// 22:00 on the Montréal clear-day model (day 288) puts the sun about 39 degrees
// below the horizon. Street lamps, headlights, and the night window glow are on.
// The weather default stays clear: a session still joins the weather chain, and
// rain remains the night-rain preset. Pitch, yaw, and the socket stay.

namespace QuebecShade
{
    inline constexpr float OpeningHour = 22.f;
    inline constexpr float NeonCandela = 12000.f;

    struct FNeonSign
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
        float R = 1.f;
        float G = 1.f;
        float B = 1.f;
    };

    // Projecting blades, facing down Sherbrooke, in the opening look.
    inline constexpr FNeonSign NeonSigns[] = {
        { 38561.7868, -7184.9191, 320.0, 1.00f, 0.12f, 0.55f },
        { 38669.7442, -6696.7130, 320.0, 0.15f, 0.90f, 1.00f },
        { 38803.6113, -6091.3374, 320.0, 1.00f, 0.55f, 0.10f },
    };
}
