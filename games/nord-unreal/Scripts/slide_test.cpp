// A played drive: gas, then a handbrake turn, earns one graded slide banner when the slide ends.
// A straight run, a tap and a turn without the brake earn none.

#ifdef QUEBEC_SLIDE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "slide_car.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <string>
#include <vector>

namespace
{
    using namespace SlideCar;

    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    void TestRule()
    {
        Expect(QuebecSlide::HoldSeconds == .35f, "HoldSeconds %f", static_cast<double>(QuebecSlide::HoldSeconds));
        Expect(QuebecSlide::MinSpeed == 450.f, "MinSpeed");
        Expect(QuebecSlide::MinLateral == 180.f, "MinLateral");
        Expect(QuebecSlide::AgainSeconds == 1.5f, "AgainSeconds");
        Expect(QuebecSlide::MaxSeconds == 2.5f, "MaxSeconds");
        const float Step = 1.f / 60.f;
        QuebecSlide::FState Early;
        for (int Index = 0; Index < 30; ++Index)
            Expect(!Early.Tick(Step, 2000.f, 400.f, true), "frame %d paid during the slide", Index);
        Expect(Early.Tick(Step, 2000.f, 400.f, false), "the slide pays when the brake comes off");
        Expect(Early.Pays == 1 && Early.LastGrade == QuebecSlide::EGrade::Slide, "one plain SLIDE");
        Expect(std::fabs(Early.LastSeconds - .5f) < .01f, "held %f", static_cast<double>(Early.LastSeconds));
        Expect(!Early.Tick(Step, 2000.f, 400.f, false), "the end pays once");

        QuebecSlide::FState Short;
        for (int Index = 0; Index < 20; ++Index) Short.Tick(Step, 2000.f, 400.f, true);
        Expect(!Short.Tick(Step, 2000.f, 400.f, false) && Short.Pays == 0, "0.33 s is under the hold");

        QuebecSlide::FState Graded;
        const float Peaks[] = {400.f, 549.f, 550.f, 699.f, 700.f, 820.f};
        const QuebecSlide::EGrade Grades[] = {QuebecSlide::EGrade::Slide, QuebecSlide::EGrade::Slide, QuebecSlide::EGrade::Big,
            QuebecSlide::EGrade::Big, QuebecSlide::EGrade::Huge, QuebecSlide::EGrade::Huge};
        for (int Case = 0; Case < 6; ++Case)
        {
            for (int Index = 0; Index < 30; ++Index) Graded.Tick(Step, 2000.f, Index == 15 ? Peaks[Case] : 300.f, true);
            Graded.Tick(2.f, 2000.f, 0.f, false);
            Expect(Graded.LastGrade == Grades[Case], "peak %.0f graded %d", static_cast<double>(Peaks[Case]),
                static_cast<int>(Graded.LastGrade));
        }
        Expect(Graded.Pays == 6, "six graded pays, got %d", Graded.Pays);
        Expect(std::string(QuebecSlide::Title(QuebecSlide::EGrade::Huge)) == "HUGE SLIDE", "huge title");
        Expect(std::string(QuebecSlide::Title(QuebecSlide::EGrade::Big)) == "BIG SLIDE", "big title");
        Expect(std::string(QuebecSlide::Title(QuebecSlide::EGrade::Slide)) == "SLIDE", "plain title");
        Expect(std::string(QuebecSlide::Title(QuebecSlide::EGrade::None)).empty(), "no title");
        Expect(QuebecSlide::ChainSeconds == 5.f && QuebecSlide::MaxChain == 9, "the chain left 5 s or 9");
        char Chained[24];
        QuebecSlide::ChainTitle(QuebecSlide::EGrade::Big, 1, Chained);
        Expect(std::string(Chained) == "BIG SLIDE", "one slide reads %s", Chained);
        QuebecSlide::ChainTitle(QuebecSlide::EGrade::Big, 2, Chained);
        Expect(std::string(Chained) == "BIG SLIDE x2", "two read %s", Chained);
        QuebecSlide::ChainTitle(QuebecSlide::EGrade::Huge, 40, Chained);
        Expect(std::string(Chained) == "HUGE SLIDE x9", "the cap reads %s", Chained);
        QuebecSlide::ChainTitle(QuebecSlide::EGrade::Slide, 0, Chained);
        Expect(std::string(Chained) == "SLIDE", "no chain reads %s", Chained);
        // Each slide pays at its end. Twelve, 2 s apart, stop at x9. One more after 5.1 s of nothing starts over.
        QuebecSlide::FState Link;
        auto PayOnce = [&Link, Step]() {
            for (int Index = 0; Index < 30; ++Index) Link.Tick(Step, 2000.f, 400.f, true);
            return Link.Tick(Step, 2000.f, 0.f, false);
        };
        Expect(PayOnce() && Link.Chain == 1, "the first pay is a chain of one, got %d", Link.Chain);
        for (int Slide = 1; Slide < 12; ++Slide)
        {
            for (int Index = 0; Index < 90; ++Index) Link.Tick(Step, 2000.f, 0.f, false);
            PayOnce();
        }
        Expect(Link.Pays == 12 && Link.Chain == QuebecSlide::MaxChain, "the chain stops at %d, got %d after %d pays",
            QuebecSlide::MaxChain, Link.Chain, Link.Pays);
        for (int Index = 0; Index < 306; ++Index) Link.Tick(Step, 2000.f, 0.f, false);
        PayOnce();
        Expect(Link.Chain == 1, "a pay more than 5 s later starts over, got %d", Link.Chain);

        QuebecSlide::FState Endless;
        int EndlessPays = 0;
        for (int Index = 0; Index < 400; ++Index) EndlessPays += Endless.Tick(Step, 2000.f, 400.f, true) ? 1 : 0;
        Expect(EndlessPays == 1, "an endless slide pays once, got %d", EndlessPays);
        Expect(std::fabs(Endless.LastSeconds - QuebecSlide::MaxSeconds) < .02f, "at the cap, %f", static_cast<double>(Endless.LastSeconds));
        Expect(!Endless.Tick(Step, 2000.f, 400.f, false), "its end does not pay again");

        QuebecSlide::FState Failsafe;
        for (int Index = 0; Index < 30; ++Index) Failsafe.Tick(Step, 2000.f, 400.f, true);
        Expect(!Failsafe.Tick(Step, 2000.f, 400.f, true, true) && Failsafe.Pays == 0, "a failsafe stop voids the slide");
        Expect(!Failsafe.Tick(Step, 2000.f, 400.f, false) && Failsafe.Pays == 0, "and nothing pays after it");

        QuebecSlide::FState Wiggle;
        for (int Frame = 0; Frame < 60; ++Frame) Wiggle.Tick(1.f / 60.f, 2000.f, 50.f, true);
        Expect(Wiggle.Pays == 0, "a lane wiggle is not a slide");
        QuebecSlide::FState Slow;
        for (int Frame = 0; Frame < 60; ++Frame) Slow.Tick(1.f / 60.f, 300.f, 400.f, true);
        Expect(Slow.Pays == 0, "a slow shove is not a slide");
        QuebecSlide::FState Straight;
        for (int Frame = 0; Frame < 60; ++Frame) Straight.Tick(1.f / 60.f, 2000.f, 400.f, false);
        Expect(Straight.Pays == 0, "no brake, no banner");
    }

    void TestSession()
    {
        std::vector<FSample> Trace;
        const FPhase Slide[] = {{3.f, false, 0.f, true}, {1.2f, true, 1.f, false}};
        const FCar Paid = Play(Slide, 2, &Trace);
        Expect(Paid.Slide.Pays == 1, "a held slide pays once, got %d", Paid.Slide.Pays);
        float PayTime = -1.f;
        float Peak = 0.f;
        for (const FSample& Sample : Trace)
        {
            Peak = std::max(Peak, std::fabs(Sample.Lateral));
            if (PayTime < 0.f && Sample.Pays == 1) PayTime = Sample.Time;
        }
        Expect(PayTime > 3.55f && PayTime < 3.8f, "the banner comes as the slide ends, pay time %f", static_cast<double>(PayTime));
        Expect(Paid.Slide.LastGrade == QuebecSlide::EGrade::Big, "a full turn after 3 s of gas is a BIG SLIDE, got %d",
            static_cast<int>(Paid.Slide.LastGrade));
        Expect(Paid.Slide.LastSeconds > .35f && Paid.Slide.LastSeconds < .6f, "held %f", static_cast<double>(Paid.Slide.LastSeconds));
        for (const FSample& Sample : Trace)
            if (Sample.Time >= PayTime - .001f && Sample.Time <= PayTime + .001f)
                Expect(std::fabs(Sample.Speed) > 300.f, "the car is still moving at the banner, %f", static_cast<double>(Sample.Speed));
        Expect(Peak > 400.f, "peak lateral %f", static_cast<double>(Peak));
        std::printf("pay %.3f peak %.1f held %.3f grade %s\n", static_cast<double>(PayTime), static_cast<double>(Peak),
            static_cast<double>(Paid.Slide.LastSeconds), QuebecSlide::Title(Paid.Slide.LastGrade));
        for (const FSample& Sample : Trace)
            std::printf("trace %.4f %.2f %.2f %d\n", static_cast<double>(Sample.Time),
                static_cast<double>(Sample.Speed), static_cast<double>(Sample.Lateral), Sample.Pays);

        const FPhase Tap[] = {{3.f, false, 0.f, true}, {.45f, true, 1.f, false}, {.8f, false, 0.f, false}};
        Expect(Play(Tap, 3, nullptr).Slide.Pays == 0, "a short brake earns nothing");
        const FPhase NoBrake[] = {{3.f, false, 0.f, true}, {1.2f, false, 1.f, true}};
        const FCar Gripped = Play(NoBrake, 2, nullptr);
        Expect(Gripped.Slide.Pays == 0, "a turn without the handbrake earns nothing");
        Expect(Gripped.PeakLateral < QuebecSlide::MinLateral, "grip kept the shove under the line, peak %f",
            static_cast<double>(Gripped.PeakLateral));
        const FPhase Gas[] = {{4.f, false, 0.f, true}};
        Expect(Play(Gas, 1, nullptr).Slide.Pays == 0, "a straight run earns nothing");

        const FPhase Twice[] = {
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
        };
        const FCar Chained = Play(Twice, 4, nullptr);
        Expect(Chained.Slide.Pays == 2, "a second slide after getting up to speed pays again");
        Expect(Chained.Slide.Chain == 2, "a slide about 4.2 s after the last one chains, got %d", Chained.Slide.Chain);
        const FPhase Coast[] = {
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
            {2.f, false, 0.f, false},
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
        };
        const FCar Broken = Play(Coast, 5, nullptr);
        Expect(Broken.Slide.Pays == 2 && Broken.Slide.Chain == 1, "a 2 s coast breaks the chain, pays %d chain %d",
            Broken.Slide.Pays, Broken.Slide.Chain);
        const FPhase Run[] = {
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
            {3.f, false, 0.f, true}, {1.2f, true, -1.f, false},
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
        };
        Expect(Play(Run, 6, nullptr).Slide.Chain == 3, "three quick slides make x3");
        const FPhase Quick[] = {
            {3.f, false, 0.f, true}, {.7f, true, 1.f, false},
            {.2f, false, 0.f, false}, {.8f, true, 1.f, false},
        };
        Expect(Play(Quick, 4, nullptr).Slide.Pays == 1, "a second shove inside 1.5 s stays on the first banner");

        const FPhase Half[] = {{3.f, false, 0.f, true}, {1.2f, true, .5f, false}};
        const FCar Gentle = Play(Half, 2, nullptr);
        Expect(Gentle.Slide.Pays == 1 && Gentle.Slide.LastGrade == QuebecSlide::EGrade::Slide, "a half turn is a plain SLIDE");
        const FPhase Fast[] = {{6.f, false, 0.f, true}, {1.2f, true, 1.f, false}};
        const FCar Wild = Play(Fast, 2, nullptr);
        Expect(Wild.Slide.Pays == 1 && Wild.Slide.LastGrade == QuebecSlide::EGrade::Huge, "a full turn at top speed is a HUGE SLIDE");
        std::printf("half %s %.2f s, fast %s %.2f s\n", QuebecSlide::Title(Gentle.Slide.LastGrade), static_cast<double>(Gentle.Slide.LastSeconds),
            QuebecSlide::Title(Wild.Slide.LastGrade), static_cast<double>(Wild.Slide.LastSeconds));
    }
}

int main()
{
    TestRule();
    TestSession();
    std::printf("%d failures\n", Failures);
    std::printf("%d assertions\n", Assertions);
    return Failures == 0 ? 0 : 1;
}
