// Standalone test for Source/Quebec/QuebecLap.h. Built by Scripts/test_lap.py.

#ifdef QUEBEC_LAP_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecLap.h"
#include "../Source/Quebec/QuebecRide.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecLap;

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
    Expect(static_cast<int>(ELeg::Dock) == 0 && static_cast<int>(ELeg::Buoy) == 1 && static_cast<int>(ELeg::Done) == 2,
        "the legs drifted");
    Expect(Pay == 120 && Reach == 450.f, "the purse or the reach drifted");
    Expect(BuoyX == -10651.111588 && BuoyY == 7939.899, "the buoy left the north-pond swim point");

    const double DX = BuoyX - QuebecRide::BerthX;
    const double DY = BuoyY - QuebecRide::BerthY;
    const double Gap = std::hypot(DX, DY);
    Expect(Gap > 5000., "the buoy drifted toward the berth, gap %f", Gap);
    Expect(Gap > static_cast<double>(Reach) * 2., "the buoy and the berth overlap");
    Expect(!Inside(BuoyX, BuoyY, QuebecRide::BerthX, QuebecRide::BerthY, Reach), "the buoy sits in the berth");
    Expect(!Inside(QuebecRide::BerthX, QuebecRide::BerthY, BuoyX, BuoyY, Reach), "the berth sits on the buoy");
    Expect(Inside(BuoyX, BuoyY, BuoyX, BuoyY, Reach), "the buoy misses itself");
    Expect(Inside(BuoyX + 450., BuoyY, BuoyX, BuoyY, Reach), "the buoy reach was short");
    Expect(!Inside(BuoyX + 451., BuoyY, BuoyX, BuoyY, Reach), "past the buoy still counted");

    Expect(Step(ELeg::Dock, true, false, true) == ELeg::Dock, "leaving the berth already finished the tour");
    Expect(Purse(ELeg::Dock, ELeg::Dock) == 0, "sitting at the berth paid");

    Expect(Step(ELeg::Dock, false, true, false) == ELeg::Dock, "a car tagged the buoy");
    Expect(Step(ELeg::Buoy, false, false, true) == ELeg::Buoy, "a car finished the tour");
    Expect(Purse(ELeg::Buoy, ELeg::Buoy) == 0, "a car was paid");

    const ELeg Tagged = Step(ELeg::Dock, true, true, false);
    Expect(Tagged == ELeg::Buoy, "the pedalo missed the buoy");
    Expect(Purse(ELeg::Dock, Tagged) == 0, "tagging the buoy paid early");
    Expect(Step(ELeg::Dock, true, true, true) == ELeg::Buoy, "touching both spots skipped the buoy");

    const double MidX = (BuoyX + QuebecRide::BerthX) * 0.5;
    const double MidY = (BuoyY + QuebecRide::BerthY) * 0.5;
    Expect(!Inside(MidX, MidY, BuoyX, BuoyY, Reach) && !Inside(MidX, MidY, QuebecRide::BerthX, QuebecRide::BerthY, Reach),
        "the middle of the pond counted as a mark");
    Expect(Step(ELeg::Dock, true, false, false) == ELeg::Dock, "open water tagged the buoy");
    Expect(Step(ELeg::Buoy, true, true, false) == ELeg::Buoy, "touching the buoy again finished the tour");

    const ELeg Home = Step(Tagged, true, false, true);
    Expect(Home == ELeg::Done, "the return missed the berth");
    Expect(Purse(Tagged, Home) == Pay, "the return paid %d", Purse(Tagged, Home));
    Expect(Step(Home, true, true, true) == ELeg::Done, "the tour ran again");
    Expect(Purse(Home, ELeg::Done) == 0, "the tour paid twice");
    Expect(Step(ELeg::Buoy, true, false, false) == ELeg::Buoy, "leaving the buoy finished the tour");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
