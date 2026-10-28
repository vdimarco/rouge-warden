#pragma once

// A short pitch for the word on a bank. No cooked asset and no Unreal types.
// The pitches sit off the pond tick (740 Hz), the court whistle (980 Hz),
// the court rasp (210 Hz) and the theatre page (90 Hz plus 1400 Hz).

#include <cmath>
#include <cstdint>

namespace QuebecRankTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 2205;
    inline constexpr double Peak = 0.22;
    inline constexpr double Decay = 18.;
    inline constexpr int ScrapeHz = 160;
    inline constexpr int CleanHz = 392;
    inline constexpr int ChainHz = 523;
    inline constexpr int HeatHz = 659;
    inline constexpr int MaxHz = 880;

    inline int RankHz(int ChainAfter, bool bWasSpoiled)
    {
        if (bWasSpoiled) return ScrapeHz;
        if (ChainAfter < 2) return CleanHz;
        if (ChainAfter < 4) return ChainHz;
        if (ChainAfter < 7) return HeatHz;
        return MaxHz;
    }

    inline double SampleAt(int Frame, int Hz)
    {
        if (Frame < 0 || Frame >= Frames || Hz <= 0) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.01 ? Time / 0.01 : 1.;
        const double Envelope = Attack * std::exp(-Time * Decay);
        const double Tone = std::sin(6.283185307179586 * static_cast<double>(Hz) * Time);
        return Tone * Envelope * Peak;
    }
}
