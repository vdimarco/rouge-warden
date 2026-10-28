#pragma once

namespace QuebecShade
{
    // Walter, Microfacet Models for Refraction through Rough Surfaces (EGSR 2007), the GGX
    // distribution. Schlick, An Inexpensive BRDF Model for Physically-based Rendering (1994),
    // the Fresnel. Karis, Real Shading in Unreal Engine 4 (SIGGRAPH 2013), the split-sum
    // weight on the reflected sky. A water film is smoother than dry asphalt. The clearcoat
    // on the paint is a dielectric lobe, not a mirror.
    inline constexpr float WetRoadRoughness = 0.15f;
    inline constexpr float CarPaintRoughness = 0.22f;
    inline constexpr float WetRoadF0 = 0.04f;
    inline constexpr float CarClearcoatF0 = 0.04f;

    // Unreal multiplies the light's specular by this. 1 is a full lobe.
    inline constexpr float SpecularScale = 1.f;
}
