// Standalone test for Source/Quebec/QuebecLossTone.h. Built by Scripts/test_loss_tone.py.

#ifdef QUEBEC_LOSS_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
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

using namespace QuebecLossTone;

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
        Expect(Gap > 0.05, "the sting matches %s", Name);
    }
}

int main()
{
    Expect(LossCue(false), "a failed job stays silent");
    Expect(!LossCue(true), "a paid job still plays the sting");

    Expect(StartHz > EndHz, "the sting rises");
    Expect(StartHz == 310., "the fall left 310 Hz");
    Expect(EndHz == 118., "the fall left 118 Hz");
    Expect(Peak == 0.40, "the peak drifted");

    double Loud = 0.;
    bool bInside = true;
    for (int Frame = 0; Frame < Frames; ++Frame)
    {
        const double Sample = SampleAt(Frame);
        Loud = std::max(Loud, std::fabs(Sample));
        if (std::fabs(Sample) > 1.) bInside = false;
    }
    Expect(Loud > 0.05, "the sting is silent");
    Expect(bInside, "a sting sample leaves the unit range");
    Expect(SampleAt(-1) == 0. && SampleAt(Frames) == 0., "the sting runs outside its window");

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
    Apart("the dent thud", [](int Frame) { return QuebecImpactTone::SampleAt(Frame); }, QuebecImpactTone::Frames);

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
