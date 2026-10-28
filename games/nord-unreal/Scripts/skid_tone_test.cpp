// Standalone test for Source/Quebec/QuebecSkidTone.h. Built by Scripts/test_skid_tone.py.

#ifdef QUEBEC_SKID_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecSkidTone.h"
#include "../Source/Quebec/QuebecRankTone.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecSkidTone;

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
    Expect(EngageSpeed == 300, "the lock catch left 300 cm/s");
    Expect(Caught(true, false, 301.), "a lock above a walk stayed quiet");
    Expect(Caught(true, false, -301.), "a lock in reverse stayed quiet");
    Expect(!Caught(true, false, 300.), "a lock at the walk still chirped");
    Expect(!Caught(true, false, 0.), "a lock at rest still chirped");
    Expect(!Caught(true, true, 900.), "a held lock chirped again");
    Expect(!Caught(false, true, 900.), "letting go chirped");
    Expect(!Caught(false, false, 900.), "rolling free chirped");

    double Loud = 0.;
    bool bInside = true;
    for (int Frame = 0; Frame < Frames; ++Frame)
    {
        const double Sample = SampleAt(Frame);
        Loud = std::max(Loud, std::fabs(Sample));
        if (std::fabs(Sample) > 1.) bInside = false;
    }
    Expect(Loud > 0.05, "the chirp is silent");
    Expect(bInside, "a chirp sample leaves the unit range");
    Expect(SampleAt(-1) == 0. && SampleAt(Frames) == 0., "the chirp runs outside its window");

    const int Held[] = {
        QuebecRankTone::ScrapeHz, QuebecRankTone::CleanHz, QuebecRankTone::ChainHz,
        QuebecRankTone::HeatHz, QuebecRankTone::MaxHz, 90, 210, 740, 980, 1400, 1470
    };
    for (int Hz : Held)
    {
        double Gap = 0.;
        for (int Frame = 0; Frame < Frames; ++Frame)
            Gap = std::max(Gap, std::fabs(SampleAt(Frame) - QuebecRankTone::SampleAt(Frame, Hz)));
        Expect(Gap > 0.05, "the chirp matches %d Hz", Hz);
    }

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
