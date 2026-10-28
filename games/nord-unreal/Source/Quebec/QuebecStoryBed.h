#pragma once

// Original story bed. No cooked asset and no Unreal types.
// Four bars at 84, D minor, while a story beat is open. The race bed still wins.
// The two cooked loops stay on the neighborhood and the race. This one is additive synthesis.

#include <cmath>
#include <cstdint>

namespace QuebecStoryBed
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int BeatFrames = 15750;
    inline constexpr int Frames = 252000;
    inline constexpr double LoopSeconds = 80. / 7.;

    enum class EBed { Neighborhood, Race, Story };

    inline EBed BedFor(bool bRacing, bool bStoryOpen)
    {
        if (bRacing) return EBed::Race;
        if (bStoryOpen) return EBed::Story;
        return EBed::Neighborhood;
    }

    struct FStereo
    {
        double L = 0.;
        double R = 0.;
    };

    inline double Voice(int Frame, int StartBeat, int EndBeat, double Hz, double Gain)
    {
        const int Start = StartBeat * BeatFrames;
        const int End = EndBeat * BeatFrames;
        if (Frame < Start || Frame >= End) return 0.;
        const double Age = static_cast<double>(Frame - Start) / static_cast<double>(SampleRate);
        const double Left = static_cast<double>(End - Frame) / static_cast<double>(SampleRate);
        constexpr double Attack = 0.028;
        constexpr double Release = 0.07;
        double Env = 1.;
        if (Age < Attack) Env = 0.5 - 0.5 * std::cos(3.141592653589793 * Age / Attack);
        if (Left < Release)
        {
            const double Fall = 0.5 - 0.5 * std::cos(3.141592653589793 * Left / Release);
            if (Fall < Env) Env = Fall;
        }
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        return std::sin(6.283185307179586 * Hz * Time) * Env * Gain;
    }

    inline double BeatTick(int Frame)
    {
        const int Into = Frame % BeatFrames;
        if (Into > 882) return 0.;
        const double Time = static_cast<double>(Into) / static_cast<double>(SampleRate);
        return std::sin(6.283185307179586 * 1680. * Time) * std::exp(-Time * 90.) * 0.05;
    }

    inline FStereo SampleAt(int Frame)
    {
        FStereo Out;
        if (Frame < 0) return Out;
        if (Frame >= Frames) Frame %= Frames;
        const double Bass =
            Voice(Frame, 0, 4, 73.42, 0.22) +
            Voice(Frame, 4, 8, 98.00, 0.22) +
            Voice(Frame, 8, 12, 116.54, 0.20) +
            Voice(Frame, 12, 16, 110.00, 0.20);
        const double Lead =
            Voice(Frame, 0, 2, 293.66, 0.13) +
            Voice(Frame, 2, 4, 349.23, 0.13) +
            Voice(Frame, 4, 6, 392.00, 0.12) +
            Voice(Frame, 6, 8, 440.00, 0.12) +
            Voice(Frame, 8, 10, 349.23, 0.12) +
            Voice(Frame, 10, 12, 329.63, 0.12) +
            Voice(Frame, 12, 14, 293.66, 0.13) +
            Voice(Frame, 14, 16, 261.63, 0.13);
        const double Chord =
            Voice(Frame, 0, 1, 146.83, 0.05) + Voice(Frame, 0, 1, 174.61, 0.04) +
            Voice(Frame, 4, 5, 196.00, 0.05) + Voice(Frame, 4, 5, 233.08, 0.04) +
            Voice(Frame, 8, 9, 233.08, 0.05) + Voice(Frame, 8, 9, 293.66, 0.04) +
            Voice(Frame, 12, 13, 220.00, 0.05) + Voice(Frame, 12, 13, 261.63, 0.04);
        const double Tick = BeatTick(Frame);
        const double Mid = Bass + Lead + Chord + Tick;
        Out.L = Mid - Lead * 0.08;
        Out.R = Mid + Lead * 0.08;
        return Out;
    }
}
