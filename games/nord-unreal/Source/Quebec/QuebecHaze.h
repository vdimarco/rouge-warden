#pragma once

namespace QuebecShade
{
    // Kenny Mitchell, Volumetric Light Scattering as a Post-Process, GPU Gems 3, chapter 13.
    // The radial samples are the light shafts. Unreal's volumetric fog is the height haze.
    // Shafts turn on when the sun is low. The opening afternoon stays clear of them.
    inline constexpr float ShaftElevationDegrees = 8.f;
    inline constexpr float ShaftBloomScale = 0.4f;
    inline constexpr float ShaftOcclusionDarkness = 0.5f;
    inline constexpr float VolumetricScattering = 2.f;
    inline constexpr float VolumetricFogExtinction = 2.f;

    // Offline haze. Density is per centimetre, so a few dozen metres reads and the near curb stays.
    inline constexpr float HazeDensityPerCm = 0.00015f;
}
