#pragma once

namespace QuebecShade
{
    // Fernando, Percentage-Closer Soft Shadows (SIGGRAPH 2005): the penumbra widens with the
    // gap from the blocker. Unreal drives that from the directional light's source angle.
    // Three degrees is wider than the solar disk so the edge reads.
    inline constexpr float SunDiskDegrees = 3.f;

    // Contact shadows close the last gap at the receiver, in world centimetres.
    inline constexpr float ContactShadowCm = 45.f;

    // Mittring, Finding Next Gen (SIGGRAPH 2007): screen-space ambient occlusion.
    inline constexpr float AmbientOcclusion = 0.65f;
}
