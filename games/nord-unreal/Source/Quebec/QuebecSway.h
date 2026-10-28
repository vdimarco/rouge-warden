#pragma once

// Procedural body sway for the on-foot stand-in. No Unreal includes, so Scripts/sway_test.cpp
// can build it with the system compiler.
//
// Frank Thomas and Ollie Johnston, The Illusion of Life (1981), overlapping action: the body
// keeps a secondary motion of its own. A posed walk cycle does not fit here. The crew blend
// space cannot be sampled offline, so this is the rock, not the steps.

#include <cmath>

namespace QuebecSway
{
    inline constexpr double MoveSpeed = 5.;
    inline constexpr double WalkOmega = 7.2;
    inline constexpr double IdleOmega = 1.8;
    inline constexpr double WalkRoll = 12.;
    inline constexpr double IdleShare = 0.34;
    inline constexpr double WalkBob = 6.;
    inline constexpr double WalkSide = 4.;
    inline constexpr double WalkPitch = 4.;
    // Full lean at the walk clip's reference speed. Below MoveSpeed the body stays at the idle share.
    inline constexpr double WalkSpeed = 180.;

    struct FPose
    {
        double Bob = 0.;
        double Side = 0.;
        double Roll = 0.;
        double Pitch = 0.;
    };

    // 0 at idle, 1 at WalkSpeed. Continuous, so crossing MoveSpeed does not step the lean.
    inline double Blend(double Speed)
    {
        if (!(Speed > MoveSpeed)) return 0.;
        const double Span = WalkSpeed - MoveSpeed;
        const double Along = (Speed - MoveSpeed) / Span;
        return Along < 1. ? Along : 1.;
    }

    inline double OmegaFor(double Speed)
    {
        const double Along = Blend(Speed);
        return IdleOmega + (WalkOmega - IdleOmega) * Along;
    }

    inline double ShareFor(double Speed)
    {
        const double Along = Blend(Speed);
        return IdleShare + (1. - IdleShare) * Along;
    }

    // Phase is radians, kept by the caller. A speed change does not jump it.
    inline double Advance(double Phase, double DeltaSeconds, double Speed)
    {
        constexpr double TwoPi = 6.283185307179586;
        double Next = std::fmod(Phase + DeltaSeconds * OmegaFor(Speed), TwoPi);
        if (Next < 0.) Next += TwoPi;
        return Next;
    }

    // Phase in radians, planar speed in cm/s. Roll and pitch are degrees. Bob and side are cm.
    inline FPose Pose(double Phase, double Speed)
    {
        const double Share = ShareFor(Speed);
        FPose Out;
        Out.Bob = std::sin(Phase * 2.) * WalkBob * Share;
        Out.Side = std::sin(Phase) * WalkSide * Share;
        Out.Roll = std::sin(Phase) * WalkRoll * Share;
        Out.Pitch = std::sin(Phase * 2.) * WalkPitch * Share;
        return Out;
    }
}
