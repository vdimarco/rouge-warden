// Standalone test for Source/Quebec/QuebecImpactTone.h. Built by Scripts/test_impact_tone.py.

#ifdef QUEBEC_IMPACT_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
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

using namespace QuebecImpactTone;

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
        Expect(Gap > 0.05, "the thud matches %s", Name);
    }
}

int main()
{
    Expect(Struck(601.f, true), "a wall past the dent stays quiet");
    Expect(!Struck(600.f, true), "a wall at the dent line still thuds");
    Expect(!Struck(100.f, true), "a wall scrape still thuds");
    Expect(Struck(501.f, false), "a car past the dent stays quiet");
    Expect(!Struck(500.f, false), "a car at the dent line still thuds");
    Expect(!Struck(300.f, false), "a light ram still thuds");
    Expect(!Struck(-800.f, true), "separating from a wall still thuds");
    Expect(!Struck(0.f, false), "a stop still thuds");
    Expect(Struck(601.f, true) == (QuebecSteer::ImpactDamage(601.f, true) > 0.f), "the wall thud left the dent rule");
    Expect(Struck(500.f, false) == (QuebecSteer::ImpactDamage(500.f, false) > 0.f), "the car thud left the dent rule");

    Expect(Due(601.f, true, 1., 0.), "the first dent stays quiet");
    Expect(!Due(100.f, true, 2., 0.), "a scrape starts the thud");
    Expect(!Due(800.f, false, 1.2, 1.2 + 0.01), "a dent inside the gap thuds again");
    Expect(Due(800.f, false, 1.35, 1.), "a dent after the gap stays quiet");
    Expect(NextAt(1.) == 1. + static_cast<double>(GapSeconds), "the gap left 0.35 s");
    Expect(GapSeconds == 0.35f, "the gap drifted");

    double Loud = 0.;
    bool bInside = true;
    for (int Frame = 0; Frame < Frames; ++Frame)
    {
        const double Sample = SampleAt(Frame);
        Loud = std::max(Loud, std::fabs(Sample));
        if (std::fabs(Sample) > 1.) bInside = false;
    }
    Expect(Loud > 0.05, "the thud is silent");
    Expect(bInside, "a thud sample leaves the unit range");
    Expect(SampleAt(-1) == 0. && SampleAt(Frames) == 0., "the thud runs outside its window");

    const int Held[] = {
        QuebecRankTone::ScrapeHz, QuebecRankTone::CleanHz, QuebecRankTone::ChainHz,
        QuebecRankTone::HeatHz, QuebecRankTone::MaxHz, 90, 210, 740, 980, 1400, 1470
    };
    for (int Hz : Held)
    {
        char Name[32];
        std::snprintf(Name, sizeof Name, "%d Hz", Hz);
        Apart(Name, [Hz](int Frame) { return QuebecRankTone::SampleAt(Frame, Hz); }, QuebecRankTone::Frames);
    }

    Apart("the lock chirp", [](int Frame) { return QuebecSkidTone::SampleAt(Frame); }, QuebecSkidTone::Frames);
    Apart("the pond tick", [](int Frame) { return QuebecPondTone::SampleAt(Frame); }, QuebecPondTone::TickFrames);
    Apart("the court whistle", [](int Frame) { return QuebecCourtTone::WhistleAt(Frame); }, QuebecCourtTone::WhistleFrames);
    Apart("the court rasp", [](int Frame) { return QuebecCourtTone::RaspAt(Frame); }, QuebecCourtTone::RaspFrames);
    Apart("the theatre page", [](int Frame) { return QuebecShowTone::SampleAt(Frame); }, QuebecShowTone::PageFrames);

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
