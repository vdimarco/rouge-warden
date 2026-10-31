#pragma once

// Two quick rising notes when a handbrake slide earns its graded banner. No cooked asset and no Unreal types.
// The notes sit off the rank pitches, the lock chirp, the pond tick, the court whistle,
// the court rasp, the theatre page, the dent thud and the falling loss sting.
// The lock chirp marks the catch and the tire scream marks the slide. This marks the pay, when the slide ends.

#include <cmath>

namespace QuebecSlidePay
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 5292;
    inline constexpr int NoteFrames = 2646;
    inline constexpr double Peak = 0.30;
    inline constexpr double LowHz = 587.;
    inline constexpr double HighHz = 784.;

    // Each link after the first adds one short repeat of the high note, up to four.
    // A lone slide plays two notes. A chain of three plays two notes and two repeats. The count is heard, not only read.
    inline constexpr int EchoFrames = 1323;
    inline constexpr int MaxEchoes = 4;

    inline int EchoesFor(int Chain)
    {
        const int Echoes = Chain - 1;
        return Echoes < 0 ? 0 : (Echoes > MaxEchoes ? MaxEchoes : Echoes);
    }

    inline int FramesFor(int Chain)
    {
        return Frames + EchoesFor(Chain) * EchoFrames;
    }

    inline constexpr int MaxFrames = Frames + MaxEchoes * EchoFrames;

    // One note that starts at Start frames, Length frames long, with a 5 ms attack and a 12 ms fade at its end.
    inline double NoteAt(int Frame, int Start, int Length, double Hz, double Decay)
    {
        const double Time = static_cast<double>(Frame - Start) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.005 ? Time / 0.005 : 1.;
        const double Left = static_cast<double>(Length) / static_cast<double>(SampleRate) - Time;
        const double Release = Left < 0.012 ? Left / 0.012 : 1.;
        const double Envelope = Attack * Release * std::exp(-Time * Decay);
        const double Phase = 6.283185307179586 * Hz * Time;
        // A third harmonic gives the notes a reedy edge, so they read over the engine hum.
        const double Tone = std::sin(Phase) * 0.8 + std::sin(3. * Phase) * 0.2;
        return Tone * Envelope * Peak;
    }

    inline double SampleAt(int Frame, int Chain)
    {
        if (Frame < 0 || Frame >= FramesFor(Chain)) return 0.;
        if (Frame < NoteFrames) return NoteAt(Frame, 0, NoteFrames, LowHz, 22.);
        if (Frame < Frames) return NoteAt(Frame, NoteFrames, NoteFrames, HighHz, 11.);
        const int Echo = (Frame - Frames) / EchoFrames;
        return NoteAt(Frame, Frames + Echo * EchoFrames, EchoFrames, HighHz, 30.) * 0.8;
    }

    inline double SampleAt(int Frame)
    {
        return SampleAt(Frame, 1);
    }
}
