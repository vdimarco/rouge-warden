// Standalone test for Source/Quebec/QuebecRide.h. Built by Scripts/test_ride.py.

#ifdef QUEBEC_RIDE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecRide.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecRide;

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

    float Run(float Speed, float Throttle, bool bOnWater, float Seconds)
    {
        const int Steps = static_cast<int>(Seconds / 0.05f);
        for (int Step = 0; Step < Steps; ++Step) Speed = Advance(Speed, Throttle, bOnWater, 0.05f);
        return Speed;
    }

    double SegmentGap()
    {
        const double DxSeg = BridgeBx - BridgeAx;
        const double DySeg = BridgeBy - BridgeAy;
        const double Ax = BerthX - BridgeAx;
        const double Ay = BerthY - BridgeAy;
        const double Den = DxSeg * DxSeg + DySeg * DySeg;
        double Along = (Ax * DxSeg + Ay * DySeg) / Den;
        if (Along < 0.) Along = 0.;
        if (Along > 1.) Along = 1.;
        const double Dx = BerthX - (BridgeAx + DxSeg * Along);
        const double Dy = BerthY - (BridgeAy + DySeg * Along);
        return std::hypot(Dx, Dy);
    }
}

int main()
{
    Expect(CarKind == 0 && PedaloKind == 1, "the kinds drifted");
    Expect(IsPedalo(PedaloKind) && !IsPedalo(CarKind), "a car counts as a pedalo");
    Expect(Slides(CarKind) && !Slides(PedaloKind), "the pedalo still slides");
    Expect(PedaloTop == 650.f && PedaloReverse == 220.f && DockCrawl == 140.f, "the paddle speeds drifted");

    Expect(Advance(100.f, 1.f, true, 0.f) == 100.f, "a zero step still paddled");
    Expect(Advance(400.f, 1.f, true, -1.f) == 400.f, "a backward step still paddled");

    const float Afloat = Run(0.f, 1.f, true, 4.f);
    Expect(Afloat == PedaloTop, "full paddle left %f", static_cast<double>(Afloat));
    const float Held = Run(PedaloTop, 1.f, true, 2.f);
    Expect(Held == PedaloTop, "holding the paddle climbed past the top");
    const float Reverse = Run(0.f, -1.f, true, 3.f);
    Expect(Reverse == -PedaloReverse, "reverse left %f", static_cast<double>(Reverse));

    const float Dock = Run(0.f, 1.f, false, 4.f);
    Expect(Dock == DockCrawl, "the dock crawl left %f", static_cast<double>(Dock));
    const float Beached = Advance(PedaloTop, 1.f, false, 0.5f);
    Expect(std::fabs(Beached - 510.f) < 0.05f, "beaching snapped to %f", static_cast<double>(Beached));
    Expect(Beached > DockCrawl && Beached < PedaloTop, "a beached boat kept highway speed");

    const float Glide = Advance(PedaloTop, 0.f, true, 1.f);
    Expect(std::fabs(Glide - 450.f) < 0.05f, "coasting left %f", static_cast<double>(Glide));
    const float Stopped = Run(PedaloTop, 0.f, true, 5.f);
    Expect(Stopped == 0.f, "the boat never stopped");

    const float Turn = YawDegrees(PedaloTop, 1.f, 1.f);
    Expect(std::fabs(Turn - TurnDegrees) < 0.01f, "full turn left %f", static_cast<double>(Turn));
    Expect(YawDegrees(0.f, 1.f, 1.f) > 0.f && YawDegrees(0.f, 1.f, 1.f) < TurnDegrees, "a stopped boat cannot aim");
    Expect(YawDegrees(PedaloTop, 1.f, 0.f) == 0.f, "a zero step still turned");

    const double Gap = SegmentGap();
    Expect(std::fabs(Gap - BerthGap) < 0.05, "the berth left the channel by %f", Gap);
    Expect(BerthGap < DoorReach, "the deck cannot board the boat");
    Expect(BerthGap > 160., "the boat sits on the deck");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
