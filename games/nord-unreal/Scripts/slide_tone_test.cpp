// Standalone test for Source/Quebec/QuebecSlideTone.h. Built by Scripts/test_slide_tone.py.

#ifdef QUEBEC_SLIDE_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecSlideTone.h"
#include "../Source/Quebec/QuebecLossTone.h"
#include "../Source/Quebec/QuebecImpactTone.h"
#include "../Source/Quebec/QuebecRankTone.h"
#include "../Source/Quebec/QuebecSkidTone.h"
#include "../Source/Quebec/QuebecPondTone.h"
#include "../Source/Quebec/QuebecCourtTone.h"
#include "../Source/Quebec/QuebecShowTone.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecSlideTone;

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    template <typename Sample>
    void Apart(const char* Name, Sample Other, int OtherFrames)
    {
        double Gap = 0.;
        const int Count = std::min(Frames, OtherFrames);
        for (int Frame = 0; Frame < Count; ++Frame)
            Gap = std::max(Gap, std::fabs(SampleAt(Frame) - Other(Frame)));
        Expect(Gap > 0.05, "the slide notes match %s", Name);
    }

    // Goertzel power at one pitch over a span of frames.
    double PowerAt(double Hz, int From, int To)
    {
        const double Step = 6.283185307179586 * Hz / static_cast<double>(SampleRate);
        const double Coeff = 2. * std::cos(Step);
        double Now = 0., Last = 0., Before = 0.;
        for (int Frame = From; Frame < To; ++Frame)
        {
            Now = SampleAt(Frame) + Coeff * Last - Before;
            Before = Last;
            Last = Now;
        }
        return Last * Last + Before * Before - Coeff * Last * Before;
    }
}

int main()
{
    Expect(LowHz == 587. && HighHz == 784., "the notes left 587 Hz and 784 Hz");
    Expect(HighHz > LowHz, "the second note does not rise");
    Expect(NoteFrames * 2 == Frames, "the two notes are not the same length");
    Expect(Frames == 5292, "the cue left 0.24 s");
    Expect(Peak == 0.30, "the peak drifted");

    double Loud = 0.;
    bool bInside = true;
    for (int Frame = 0; Frame < Frames; ++Frame)
    {
        const double Sample = SampleAt(Frame);
        Loud = std::max(Loud, std::fabs(Sample));
        if (std::fabs(Sample) > 1.) bInside = false;
    }
    Expect(Loud > 0.05, "the slide notes are silent");
    Expect(bInside, "a slide sample leaves the unit range");
    Expect(SampleAt(-1) == 0. && SampleAt(Frames) == 0., "the slide notes run outside their window");
    Expect(std::fabs(SampleAt(0)) < 1e-9 && std::fabs(SampleAt(NoteFrames)) < 1e-9, "a note starts with a click");
    Expect(std::fabs(SampleAt(NoteFrames - 1)) < 0.002 && std::fabs(SampleAt(Frames - 1)) < 0.002, "a note ends with a click");

    const int Held[] = {
        QuebecRankTone::ScrapeHz, QuebecRankTone::CleanHz, QuebecRankTone::ChainHz,
        QuebecRankTone::HeatHz, QuebecRankTone::MaxHz, 90, 210, 740, 980, 1400, 1470
    };
    const double FirstLow = PowerAt(LowHz, 0, NoteFrames);
    const double SecondHigh = PowerAt(HighHz, NoteFrames, Frames);
    Expect(FirstLow > PowerAt(HighHz, 0, NoteFrames) * 20., "the first note is not 587 Hz");
    Expect(SecondHigh > PowerAt(LowHz, NoteFrames, Frames) * 20., "the second note is not 784 Hz");
    for (int Hz : Held)
    {
        char Name[32];
        std::snprintf(Name, sizeof Name, "%d Hz", Hz);
        Apart(Name, [Hz](int Frame) { return QuebecRankTone::SampleAt(Frame, Hz); }, QuebecRankTone::Frames);
        Expect(FirstLow > PowerAt(static_cast<double>(Hz), 0, NoteFrames) * 20., "the first note leans on %d Hz", Hz);
        Expect(SecondHigh > PowerAt(static_cast<double>(Hz), NoteFrames, Frames) * 20., "the second note leans on %d Hz", Hz);
    }

    // A chain adds short repeats of the high note. A single slide stays two notes.
    Expect(FramesFor(1) == Frames && FramesFor(0) == Frames, "a single slide grew");
    Expect(FramesFor(2) == Frames + EchoFrames, "x2 does not add one repeat");
    Expect(FramesFor(5) == MaxFrames && FramesFor(9) == MaxFrames, "the repeats do not stop at four");
    Expect(EchoFrames == 1323 && MaxEchoes == 4, "the repeat left 0.06 s or four");
    bool bSameStart = true;
    for (int Frame = 0; Frame < Frames; ++Frame)
        if (SampleAt(Frame, 3) != SampleAt(Frame)) bSameStart = false;
    Expect(bSameStart, "a chain changes the first two notes");
    Expect(SampleAt(Frames, 1) == 0., "a single slide plays a repeat");
    for (int Chain = 2; Chain <= 9; ++Chain)
    {
        double Peaks = 0.;
        bool bQuiet = true;
        for (int Frame = Frames; Frame < FramesFor(Chain); ++Frame)
            Peaks = std::max(Peaks, std::fabs(SampleAt(Frame, Chain)));
        for (int Echo = 0; Echo < EchoesFor(Chain); ++Echo)
        {
            const int Start = Frames + Echo * EchoFrames;
            if (std::fabs(SampleAt(Start, Chain)) > 1e-9 || std::fabs(SampleAt(Start + EchoFrames - 1, Chain)) > 0.002) bQuiet = false;
        }
        Expect(Peaks > 0.05, "x%d repeats are silent", Chain);
        Expect(Peaks <= Peak, "x%d repeats are louder than the notes", Chain);
        Expect(bQuiet, "a repeat in x%d clicks", Chain);
        Expect(SampleAt(FramesFor(Chain), Chain) == 0., "x%d runs past its window", Chain);
    }

    Apart("the lock chirp", [](int Frame) { return QuebecSkidTone::SampleAt(Frame); }, QuebecSkidTone::Frames);
    Apart("the pond tick", [](int Frame) { return QuebecPondTone::SampleAt(Frame); }, QuebecPondTone::TickFrames);
    Apart("the court whistle", [](int Frame) { return QuebecCourtTone::WhistleAt(Frame); }, QuebecCourtTone::WhistleFrames);
    Apart("the court rasp", [](int Frame) { return QuebecCourtTone::RaspAt(Frame); }, QuebecCourtTone::RaspFrames);
    Apart("the theatre page", [](int Frame) { return QuebecShowTone::SampleAt(Frame); }, QuebecShowTone::PageFrames);
    Apart("the dent thud", [](int Frame) { return QuebecImpactTone::SampleAt(Frame); }, QuebecImpactTone::Frames);
    Apart("the loss sting", [](int Frame) { return QuebecLossTone::SampleAt(Frame); }, QuebecLossTone::Frames);

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
