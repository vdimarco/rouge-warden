// Standalone test for Source/Quebec/QuebecRankTone.h. Built by Scripts/test_rank_tone.py.

#ifdef QUEBEC_RANK_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecRankTone.h"
#include "../Source/Quebec/QuebecChain.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <cstring>

using namespace QuebecRankTone;

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
    using QuebecChain::Callout;
    const int Forbidden[] = {90, 210, 740, 980, 1400, 1470};
    const struct { int Chain; bool bSpoiled; const char* Word; int Hz; } Rows[] = {
        {0, true, "SCRAPE", ScrapeHz},
        {4, true, "SCRAPE", ScrapeHz},
        {1, false, "CLEAN", CleanHz},
        {0, false, "CLEAN", CleanHz},
        {2, false, "CHAIN", ChainHz},
        {3, false, "CHAIN", ChainHz},
        {4, false, "HEAT", HeatHz},
        {6, false, "HEAT", HeatHz},
        {7, false, "MAX", MaxHz},
    };
    int Seen[5] = {};
    for (const auto& Row : Rows)
    {
        Expect(std::strcmp(Callout(Row.Chain, Row.bSpoiled), Row.Word) == 0, "the word for chain %d drifted", Row.Chain);
        Expect(RankHz(Row.Chain, Row.bSpoiled) == Row.Hz, "the pitch for %s drifted", Row.Word);
        for (int Banned : Forbidden)
            Expect(Row.Hz != Banned, "%s sits on a tone the city already plays", Row.Word);
        Seen[Row.Hz == ScrapeHz ? 0 : Row.Hz == CleanHz ? 1 : Row.Hz == ChainHz ? 2 : Row.Hz == HeatHz ? 3 : 4] = 1;
    }
    Expect(Seen[0] && Seen[1] && Seen[2] && Seen[3] && Seen[4], "a rank has no pitch");

    const int Mid = Frames / 2;
    Expect(std::fabs(SampleAt(Mid, CleanHz)) > 0.01, "the clean pitch is silent");
    const int Pitches[] = {ScrapeHz, CleanHz, ChainHz, HeatHz, MaxHz};
    for (int A = 0; A < 5; ++A)
        for (int B = A + 1; B < 5; ++B)
        {
            double Gap = 0.;
            for (int Frame = 0; Frame < Frames; ++Frame)
                Gap = std::max(Gap, std::fabs(SampleAt(Frame, Pitches[A]) - SampleAt(Frame, Pitches[B])));
            Expect(Gap > 0.05, "two ranks share a wave");
        }
    Expect(SampleAt(-1, CleanHz) == 0. && SampleAt(Frames, CleanHz) == 0., "the sting runs outside its window");
    bool bInside = true;
    for (int Frame = 0; Frame < Frames; Frame += 11)
        if (std::fabs(SampleAt(Frame, HeatHz)) > 1.) bInside = false;
    Expect(bInside, "a rank sample leaves the unit range");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
