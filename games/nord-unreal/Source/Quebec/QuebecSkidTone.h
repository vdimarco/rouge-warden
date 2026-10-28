#pragma once

// A short chirp when the wheels lock above a walk. No cooked asset and no Unreal types.
// The sweep sits off the rank pitches and off the pond tick, the court whistle,
// the court rasp and the theatre page.

#include <cmath>
#include <cstdint>

namespace QuebecSkidTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 2205;
    inline constexpr double Peak = 0.34;
    inline constexpr int EngageSpeed = 300;

    inline bool Caught(bool bLocked, bool bWasLocked, double Speed)
    {
        return bLocked && !bWasLocked && std::fabs(Speed) > static_cast<double>(EngageSpeed);
    }

    inline std::uint32_t HashFrame(int Frame)
    {
        std::uint32_t X = static_cast<std::uint32_t>(Frame) * 747796405u + 2891336453u;
        X = (X ^ (X >> 16)) * 0x7feb352du;
        X = (X ^ (X >> 15)) * 0x846ca68bu;
        return X ^ (X >> 16);
    }

    inline double SampleAt(int Frame)
    {
        if (Frame < 0 || Frame >= Frames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.008 ? Time / 0.008 : 1.;
        const double Envelope = Attack * std::exp(-Time * 14.);
        const double Span = static_cast<double>(Frames) / static_cast<double>(SampleRate);
        const double Phase = 6.283185307179586 * (1860. * Time + (420. - 1860.) * Time * Time / (2. * Span));
        const double Chirp = std::sin(Phase);
        const double Noise = static_cast<double>(HashFrame(Frame) & 65535u) / 32767.5 - 1.;
        return (Chirp * 0.62 + Noise * 0.38) * Envelope * Peak;
    }
}
