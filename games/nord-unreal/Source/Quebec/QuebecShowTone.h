#pragma once

// A short original page-turn for mission 5's curtain. No cooked asset and no Unreal types.
// A low thump plus a higher flutter, about 200 ms, distinct from the pond's 740 Hz tick.

#include <cmath>
#include <cstdint>

namespace QuebecShowTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr double ThumpHz = 90.;
    inline constexpr double FlutterHz = 1400.;
    inline constexpr double Decay = 22.;
    inline constexpr double Peak = 0.26;
    inline constexpr int PageFrames = 4410;

    inline double SampleAt(int Frame)
    {
        if (Frame < 0 || Frame >= PageFrames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Envelope = std::exp(-Time * Decay);
        const double Thump = std::sin(6.283185307179586 * ThumpHz * Time);
        const double Flutter = std::sin(6.283185307179586 * FlutterHz * Time);
        return (Thump * 0.65 + Flutter * 0.35) * Envelope * Peak;
    }
}
