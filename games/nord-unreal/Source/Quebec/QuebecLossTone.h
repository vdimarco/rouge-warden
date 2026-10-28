#pragma once

// A short falling sting when a side job fails. No cooked asset and no Unreal types.
// The fall sits under the lock chirp and off the rank pitches, the pond tick,
// the court whistle, the court rasp, the theatre page, and the dent thud.
// A success does not ask for it.

#include <cmath>
#include <cstdint>

namespace QuebecLossTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 4410;
    inline constexpr double Peak = 0.40;
    inline constexpr double StartHz = 310.;
    inline constexpr double EndHz = 118.;

    // A miss asks. A paid finish does not.
    inline bool LossCue(bool bSucceeded)
    {
        return !bSucceeded;
    }

    inline std::uint32_t HashFrame(int Frame)
    {
        std::uint32_t X = static_cast<std::uint32_t>(Frame) * 1597334677u + 3812015801u;
        X = (X ^ (X >> 16)) * 0x7feb352du;
        X = (X ^ (X >> 15)) * 0x846ca68bu;
        return X ^ (X >> 16);
    }

    inline double SampleAt(int Frame)
    {
        if (Frame < 0 || Frame >= Frames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Span = static_cast<double>(Frames) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.006 ? Time / 0.006 : 1.;
        const double Envelope = Attack * std::exp(-Time * 6.);
        const double Phase = 6.283185307179586 * (StartHz * Time + (EndHz - StartHz) * Time * Time / (2. * Span));
        const double Fall = std::sin(Phase);
        const double Noise = static_cast<double>(HashFrame(Frame) & 65535u) / 32767.5 - 1.;
        return (Fall * 0.82 + Noise * 0.18) * Envelope * Peak;
    }
}
