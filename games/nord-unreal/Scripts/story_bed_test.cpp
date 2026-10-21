// Standalone test for Source/Quebec/QuebecStoryBed.h. Built by Scripts/test_story_bed.py.

#ifdef QUEBEC_STORY_BED_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecStoryBed.h"

#include <cstdarg>
#include <cmath>
#include <cstdio>

using namespace QuebecStoryBed;

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
}

int main()
{
    Expect(SampleRate * 80 == Frames * 7, "the loop is not an even four bars at 84");
    Expect(std::fabs(LoopSeconds * static_cast<double>(SampleRate) - static_cast<double>(Frames)) < 1e-6, "the duration does not match the frames");

    const FStereo Open = SampleAt(0);
    const FStereo Closed = SampleAt(Frames);
    Expect(std::fabs(Open.L) < 1e-9 && std::fabs(Open.R) < 1e-9, "the downbeat is already loud");
    Expect(std::fabs(Closed.L - Open.L) < 1e-9 && std::fabs(Closed.R - Open.R) < 1e-9, "the wrap does not meet the downbeat");
    const FStereo Tail = SampleAt(Frames - 1);
    Expect(std::fabs(Tail.L) < 0.002 && std::fabs(Tail.R) < 0.002, "the bar does not release before the wrap");

    double Energy = 0.;
    double Peak = 0.;
    bool bWide = false;
    bool bMoved = false;
    const FStereo Early = SampleAt(BeatFrames);
    for (int Frame = 0; Frame < Frames; Frame += 20)
    {
        const FStereo Sample = SampleAt(Frame);
        Energy += Sample.L * Sample.L + Sample.R * Sample.R;
        Peak = std::fmax(Peak, std::fmax(std::fabs(Sample.L), std::fabs(Sample.R)));
        if (std::fabs(Sample.L - Sample.R) > 0.01) bWide = true;
    }
    const FStereo Later = SampleAt(BeatFrames * 6);
    bMoved = std::fabs(Later.L - Early.L) > 0.02;
    Expect(Energy / static_cast<double>(Frames / 20) > 0.004, "the bed is silent");
    Expect(Peak > 0.08 && Peak < 0.95, "the bed is quiet or it clips");
    Expect(bWide, "the two ears match");
    Expect(bMoved, "the melody sits on one note");

    Expect(BedFor(true, true) == EBed::Race, "a race does not keep the race bed");
    Expect(BedFor(true, false) == EBed::Race, "a race alone is not the race bed");
    Expect(BedFor(false, true) == EBed::Story, "an open beat does not use the story bed");
    Expect(BedFor(false, false) == EBed::Neighborhood, "the city does not fall back to the neighborhood");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
