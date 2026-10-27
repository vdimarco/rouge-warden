#pragma once

// Tailpipe puffs for a running car. No Unreal includes, so Scripts/exhaust_test.cpp can build it.
//
// William T. Reeves, "Particle Systems — A Technique for Modeling a Class of Fuzzy Objects"
// (SIGGRAPH 1983): each puff is born, ages, and dies. The foot dust already uses that at the shoe.
// A tailpipe is a different birth, behind the car, left as the car moves.

#include <cmath>

namespace QuebecExhaust
{
    inline constexpr int Count = 6;
    inline constexpr double Life = 1.1;
    inline constexpr double Interval = 0.16;
    // Centimetres per second, back along the car and up off the tail.
    inline constexpr double BackSpeed = 160.;
    inline constexpr double RiseSpeed = 180.;
    // Sphere scale at birth and at full swell, before the fade.
    inline constexpr double SwellBorn = 0.16;
    inline constexpr double SwellFull = 0.55;

    struct FPuff
    {
        double Back = 0.;
        double Up = 0.;
        double Swell = 0.;
        double Side = 0.;
    };

    // Age in seconds. Back and up are centimetres from the birth point. Swell is the sphere scale.
    inline FPuff At(double Age, int Slot)
    {
        const double Clamped = Age < 0. ? 0. : (Age > Life ? Life : Age);
        const double Along = Clamped / Life;
        const double Grow = SwellBorn + (SwellFull - SwellBorn) * (Along * 1.4 < 1. ? Along * 1.4 : 1.);
        const double Fade = Along > 0.75 ? (1. - Along) / 0.25 : 1.;
        FPuff Out;
        Out.Back = Clamped * BackSpeed;
        Out.Up = Clamped * RiseSpeed;
        Out.Swell = Grow * Fade;
        Out.Side = 14. * static_cast<double>((Slot % 3) - 1);
        return Out;
    }
}
