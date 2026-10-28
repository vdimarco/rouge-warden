#pragma once

// A short original tick for the postcard blink. No cooked asset and no Unreal types.
// 740 Hz, decaying in about 80 ms, quiet enough to sit under the neighborhood loop.

#include <cmath>
#include <cstdint>

namespace QuebecPondTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr double Frequency = 740.;
    inline constexpr double Decay = 36.;
    inline constexpr double Peak = 0.22;
    inline constexpr int TickFrames = 1764;

    inline double SampleAt(int Frame)
    {
        if (Frame < 0 || Frame >= TickFrames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Envelope = std::exp(-Time * Decay);
        return std::sin(6.283185307179586 * Frequency * Time) * Envelope * Peak;
    }
}
