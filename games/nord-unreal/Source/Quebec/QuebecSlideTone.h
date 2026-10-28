#pragma once

// The tire scream of a handbrake slide. It uses the same live line as the SLIDE banner,
// so a gripped turn keeps only the quiet tire hiss of the drive loop.
// No Unreal includes, so Scripts/test_slide_tone.py can build and run it with the system compiler.
// Speeds are cm/s, times are seconds, and the drive loop runs at 24 kHz.

#include "QuebecSlide.h"

#include <cmath>
#include <cstdint>

namespace QuebecSlideTone
{
    inline constexpr int SampleRate = 24000;
    // A full scream at this sideways speed. The handbrake slide peaks near 600 cm/s.
    inline constexpr float FullLateral = 520.f;
    // Fast in, so the scream starts with the shove. A short tail when the tires grip again.
    inline constexpr float AttackRate = 18.f;
    inline constexpr float ReleaseRate = 14.f;
    // Louder than the 0.045 hiss and the engine, under the 0.34 skid chirp.
    inline constexpr float Peak = .12f;
    inline constexpr float BaseHz = 1050.f;
    inline constexpr float RiseHz = 520.f;
    inline constexpr float WobbleHz = 7.5f;

    // 0 under the banner's live line, then up with the sideways shove.
    inline float Target(float Speed, float Lateral, bool bBrake)
    {
        if (!bBrake || std::fabs(Speed) < QuebecSlide::MinSpeed || std::fabs(Lateral) < QuebecSlide::MinLateral) return 0.f;
        const float Span = (std::fabs(Lateral) - QuebecSlide::MinLateral) / (FullLateral - QuebecSlide::MinLateral);
        return .45f + .55f * (Span < 0.f ? 0.f : (Span > 1.f ? 1.f : Span));
    }

    // One drive-loop update: move the gain toward the target at the attack or release rate.
    inline float Follow(float Gain, float Goal, float Delta)
    {
        if (!(Delta > 0.f)) return Gain;
        const float Rate = Goal > Gain ? AttackRate : ReleaseRate;
        const float Step = Delta * Rate > 1.f ? 1.f : Delta * Rate;
        return Gain + (Goal - Gain) * Step;
    }

    struct FVoice
    {
        float Phase = 0.f;
        float Wobble = 0.f;
        std::uint32_t Noise = 0x9e3779b9u;

        // One sample at 24 kHz. Two detuned partials and a little grit, like rubber on asphalt.
        float Sample(float Gain)
        {
            Wobble += WobbleHz / static_cast<float>(SampleRate);
            Wobble -= std::floor(Wobble);
            const float Hz = BaseHz + RiseHz * Gain + 38.f * std::sin(Wobble * 6.2831853f);
            Phase += Hz / static_cast<float>(SampleRate);
            Phase -= std::floor(Phase);
            Noise = Noise * 1664525u + 1013904223u;
            const float Grit = static_cast<float>(Noise >> 8) / 8388607.5f - 1.f;
            const float Tone = std::sin(Phase * 6.2831853f) * .7f + std::sin(Phase * 2.f * 6.2831853f + 1.3f) * .18f;
            return Gain * Peak * (Tone + Grit * .12f);
        }
    };
}
