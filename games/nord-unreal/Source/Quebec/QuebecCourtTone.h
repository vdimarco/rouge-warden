#pragma once

// Original sounds for mission 4's bank shot. No cooked asset and no Unreal types.
// The whistle is the ball going in. The rasp is the ink spoiling the shot.
// Neither is the pond tick (740 Hz) nor the theatre page (90 Hz plus 1400 Hz).

#include <cmath>
#include <cstdint>

namespace QuebecCourtTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr double WhistleHz = 980.;
    inline constexpr double WhistleOverHz = 1470.;
    inline constexpr double WhistleDecay = 48.;
    inline constexpr double WhistlePeak = 0.2;
    inline constexpr int WhistleFrames = 2205;
    inline constexpr double RaspHz = 210.;
    inline constexpr double RaspDecay = 70.;
    inline constexpr double RaspPeak = 0.16;
    inline constexpr int RaspFrames = 1102;

    inline double WhistleAt(int Frame)
    {
        if (Frame < 0 || Frame >= WhistleFrames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Envelope = std::exp(-Time * WhistleDecay);
        const double Low = std::sin(6.283185307179586 * WhistleHz * Time);
        const double High = std::sin(6.283185307179586 * WhistleOverHz * Time);
        return (Low * 0.7 + High * 0.3) * Envelope * WhistlePeak;
    }

    inline double RaspAt(int Frame)
    {
        if (Frame < 0 || Frame >= RaspFrames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Envelope = std::exp(-Time * RaspDecay);
        const double Tone = std::sin(6.283185307179586 * RaspHz * Time);
        const double Crack = static_cast<double>((Frame * 17) % 64) / 64. - 0.5;
        return (Tone * 0.45 + Crack * 0.55) * Envelope * RaspPeak;
    }
}
