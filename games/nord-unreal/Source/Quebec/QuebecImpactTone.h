#pragma once

// A short thud when a hit dents the body. No cooked asset and no Unreal types.
// The body sits under the rank pitches, the lock chirp, the pond tick, the court whistle,
// the court rasp and the theatre page. A scrape that does not dent stays quiet.

#include "QuebecSteerAssist.h"

#include <cmath>
#include <cstdint>

namespace QuebecImpactTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 2205;
    inline constexpr double Peak = 0.48;
    // One crash, then a gap, so a grind along a wall does not machine-gun.
    inline constexpr float GapSeconds = 0.35f;

    inline std::uint32_t HashFrame(int Frame)
    {
        std::uint32_t X = static_cast<std::uint32_t>(Frame) * 2246822519u + 3266489917u;
        X = (X ^ (X >> 16)) * 0x7feb352du;
        X = (X ^ (X >> 15)) * 0x846ca68bu;
        return X ^ (X >> 16);
    }

    // True when this closing speed would add body damage. Walls start at 600 cm/s, cars at 500.
    inline bool Struck(float Closing, bool bWall)
    {
        return QuebecSteer::ImpactDamage(Closing, bWall) > 0.f;
    }

    // A dent that is also outside the gap asks for a thud. A graze does not start the gap.
    inline bool Due(float Closing, bool bWall, double Now, double NextAt)
    {
        return Struck(Closing, bWall) && Now >= NextAt;
    }

    inline double NextAt(double Now)
    {
        return Now + static_cast<double>(GapSeconds);
    }

    inline double SampleAt(int Frame)
    {
        if (Frame < 0 || Frame >= Frames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.002 ? Time / 0.002 : 1.;
        const double Envelope = Attack * std::exp(-Time * 26.);
        const double Body = std::sin(6.283185307179586 * 48. * Time);
        const double Noise = static_cast<double>(HashFrame(Frame) & 65535u) / 32767.5 - 1.;
        const double Crack = Time < 0.018 ? Noise * (1. - Time / 0.018) : 0.;
        return (Body * 0.35 + Crack * 0.8) * Envelope * Peak;
    }
}
