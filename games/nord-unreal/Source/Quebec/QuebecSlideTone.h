#pragma once

// Two quick rising notes when a handbrake slide earns its banner. No cooked asset and no Unreal types.
// The notes sit off the rank pitches, the lock chirp, the pond tick, the court whistle,
// the court rasp, the theatre page, the dent thud and the falling loss sting.
// The lock chirp still marks the catch. This marks the pay, about 0.35 s later.

#include <cmath>

namespace QuebecSlideTone
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 5292;
    inline constexpr int NoteFrames = 2646;
    inline constexpr double Peak = 0.30;
    inline constexpr double LowHz = 587.;
    inline constexpr double HighHz = 784.;

    inline double SampleAt(int Frame)
    {
        if (Frame < 0 || Frame >= Frames) return 0.;
        const bool bHigh = Frame >= NoteFrames;
        const double Hz = bHigh ? HighHz : LowHz;
        const double Time = static_cast<double>(bHigh ? Frame - NoteFrames : Frame) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.005 ? Time / 0.005 : 1.;
        // Each note fades over its last 12 ms, so neither the switch nor the end clicks.
        const double Left = static_cast<double>(NoteFrames) / static_cast<double>(SampleRate) - Time;
        const double Release = Left < 0.012 ? Left / 0.012 : 1.;
        const double Envelope = Attack * Release * std::exp(-Time * (bHigh ? 11. : 22.));
        const double Phase = 6.283185307179586 * Hz * Time;
        // A third harmonic gives the notes a reedy edge, so they read over the engine hum.
        const double Tone = std::sin(Phase) * 0.8 + std::sin(3. * Phase) * 0.2;
        return Tone * Envelope * Peak;
    }
}
