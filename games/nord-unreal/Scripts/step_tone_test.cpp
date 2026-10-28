// Standalone test for Source/Quebec/QuebecStep.h.

#ifdef QUEBEC_STEP_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecStep.h"
#include "../Source/Quebec/QuebecImpactTone.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

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
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    int Count(double Speed, double Seconds)
    {
        double Traveled = 0.;
        int Steps = 0;
        const double Tick = 1. / 60.;
        const int Ticks = static_cast<int>(std::lround(Seconds / Tick));
        for (int Index = 0; Index < Ticks; ++Index)
            Steps += QuebecStep::Consume(Traveled, Speed, Tick);
        return Steps;
    }
}

int main()
{
    using namespace QuebecStep;
    const double Stride = StrideCm();
    Expect(std::fabs(WalkInterval() - 3.14159265358979323846 / 7.2) < 1e-12, "walk interval is half the rock cycle");
    Expect(std::fabs(Stride - 450. * WalkInterval()) < 1e-9, "a walk stride is the pace times that interval");

    const int WalkSteps = Count(450., 8.);
    const int SprintSteps = Count(800., 8.);
    const int ExpectedWalk = static_cast<int>(std::floor(450. * 8. / Stride));
    const int ExpectedSprint = static_cast<int>(std::floor(800. * 8. / Stride));
    Expect(WalkSteps == ExpectedWalk, "eight seconds of walking plants %d steps, got %d", ExpectedWalk, WalkSteps);
    Expect(SprintSteps == ExpectedSprint, "eight seconds of sprinting plants %d steps, got %d", ExpectedSprint, SprintSteps);
    Expect(SprintSteps > WalkSteps * 17 / 10, "a sprint plants sooner than a walk");
    Expect(Count(0., 8.) == 0, "standing still is silent");
    Expect(Count(4., 8.) == 0, "below the sway move speed is silent");

    double Held = 0.;
    Expect(Consume(Held, 450., 8.) == MaxStepsPerTick, "a long frame plays only a few taps");
    Expect(Held < Stride, "the extra distance is dropped");
    Expect(Consume(Held, 450., 0.) == 0, "a zero tick adds nothing");

    double Sum = 0.;
    double PeakSeen = 0.;
    double Tail = 0.;
    for (int Frame = 0; Frame < Frames; ++Frame)
    {
        const double Sample = SampleAt(Frame, 0);
        Sum += Sample;
        PeakSeen = std::max(PeakSeen, std::fabs(Sample));
        if (Frame > Frames * 3 / 4) Tail = std::max(Tail, std::fabs(Sample));
    }
    Expect(std::fabs(SampleAt(0, 0)) < 1e-6 && std::fabs(SampleAt(Frames - 1, 0)) < 0.002, "the tap starts and ends quiet");
    Expect(std::fabs(Sum / Frames) < 0.01, "the tap has almost no DC");
    Expect(PeakSeen > 0.05 && PeakSeen < 0.5, "the tap is quieter than a crash");
    Expect(Tail < PeakSeen * 0.15, "the tap dies away");
    double Gap = 0.;
    for (int Frame = 0; Frame < Frames && Frame < QuebecImpactTone::Frames; ++Frame)
        Gap = std::max(Gap, std::fabs(SampleAt(Frame, 0) - QuebecImpactTone::SampleAt(Frame)));
    Expect(Gap > 0.05, "the tap is not the impact thud");
    double Feet = 0.;
    for (int Frame = 0; Frame < Frames; ++Frame)
        Feet = std::max(Feet, std::fabs(SampleAt(Frame, 0) - SampleAt(Frame, 1)));
    Expect(Feet > 0.02, "the two shoes are not the same tap");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
