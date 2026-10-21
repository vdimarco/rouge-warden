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

    struct FPose
    {
        double Bob = 0.;
        double Side = 0.;
        double Roll = 0.;
        double Pitch = 0.;
    };

    // Time in seconds, planar speed in cm/s. Roll and pitch are degrees. Bob and side are cm.
    // A moving body uses the walk rate. A still body uses the smaller idle share.
    inline FPose Pose(double Time, double Speed)
    {
        const bool bMoving = Speed > MoveSpeed;
        const double Omega = bMoving ? WalkOmega : IdleOmega;
        const double Share = bMoving ? 1. : IdleShare;
        const double Phase = Time * Omega;
        FPose Out;
        Out.Bob = std::sin(Phase * 2.) * WalkBob * Share;
        Out.Side = std::sin(Phase) * WalkSide * Share;
        Out.Roll = std::sin(Phase) * WalkRoll * Share;
        Out.Pitch = std::sin(Phase * 2.) * WalkPitch * Share;
        return Out;
    }
}
