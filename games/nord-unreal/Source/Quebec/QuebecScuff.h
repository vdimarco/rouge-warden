#pragma once

// Foot-contact dust for a walk. No Unreal includes, so Scripts/scuff_test.cpp can build it.
//
// William T. Reeves, "Particle Systems — A Technique for Modeling a Class of Fuzzy Objects"
// (SIGGRAPH 1983): each puff is born, ages, and dies. The leaf cards already use that for a
// crown. A foot contact is a different birth, at the rear shoe, left behind as the walker moves.

#include <cmath>

namespace QuebecScuff
{
    inline constexpr int Count = 5;
    inline constexpr double Life = 0.7;
    inline constexpr double Interval = 0.16;
    // Below this planar speed the shoes are not scuffing.
    inline constexpr double WalkSpeed = 80.;
    // Rear shoe, centimetres, mesh space. +X is the way the casual body faces.
    inline constexpr double FootBack = 40.;
    inline constexpr double FootSide = -13.;
    inline constexpr double FootUp = 4.;

    struct FPuff
    {
        double Back = 0.;
        double Side = 0.;
        double Up = 0.;
        double Radius = 0.;
    };

    // Age in seconds. Back and side are centimetres from the birth point. Radius is centimetres.
    inline FPuff At(double Age, int Slot)
    {
        const double Clamped = Age < 0. ? 0. : (Age > Life ? Life : Age);
        const double Along = Clamped / Life;
        const double Fade = Along > 0.75 ? (1. - Along) / 0.25 : 1.;
        FPuff Out;
        Out.Back = Clamped * 84.;
        Out.Up = 6. + Clamped * 58.;
        Out.Radius = (12. + Clamped * 32.) * Fade;
        Out.Side = (Slot % 2) ? 8. : -8.;
        return Out;
    }
}
