// Standalone test for Source/Quebec/QuebecTour.h. Built by Scripts/test_tour.py.

#ifdef QUEBEC_TOUR_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecTour.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecTour;

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

    double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }
}

int main()
{
    Expect(StepBike == 0 && StepBoat == 1 && StepSwim == 2 && StepBanked == 3, "the steps drifted");
    Expect(Pay == 360 && Reach == 450., "the purse or the reach drifted");
    Expect(BikeX == 40000. && BikeY == -4000., "the east mark moved");
    Expect(BoatX == QuebecLap::BuoyX && BoatY == QuebecLap::BuoyY, "the boat step left the buoy");
    Expect(BoatRecoverX == QuebecRide::BerthX && BoatRecoverY == QuebecRide::BerthY, "the boat recover left the berth");
    Expect(FloatX == QuebecWade::BuoyX && FloatY == QuebecWade::BuoyY, "the swim step left the float");
    Expect(FloatRecoverX == QuebecWade::BankX && FloatRecoverY == QuebecWade::BankY, "the swim recover left the bank");
    Expect(Gap(BikeX, BikeY, QuebecCycle::StandX, QuebecCycle::StandY) > Reach, "the east mark sits on the stand");
    Expect(Gap(BikeX, BikeY, BikeRecoverX, BikeRecoverY) > Reach, "recover already counts as the east mark");
    Expect(Gap(BikeX, BikeY, BoatX, BoatY) > 5000., "the bike and the buoy share a reach");
    Expect(Gap(BoatX, BoatY, FloatX, FloatY) > 5000., "the buoy and the float share a reach");
    Expect(Gap(FloatX, FloatY, BikeX, BikeY) > 5000., "the float and the east mark share a reach");

    Expect(Apply(StepBike, false, false, false, true, false, false) == StepBike, "a walker tagged the east mark");
    Expect(Apply(StepBike, false, true, false, true, false, false) == StepBike, "the pedalo tagged the east mark");
    Expect(Apply(StepBike, true, false, false, false, true, false) == StepBike, "the bike skipped ahead to the buoy");
    Expect(Apply(StepBike, true, true, false, true, false, false) == StepBike, "a bike that is also a pedalo advanced");
    const int Rode = Apply(StepBike, true, false, false, true, false, false);
    Expect(Rode == StepBoat && Purse(StepBike, Rode) == 0, "the bike did not open the boat");

    Expect(Apply(StepBoat, true, false, false, false, true, false) == StepBoat, "the bike tagged the buoy");
    Expect(Apply(StepBoat, false, true, false, true, false, false) == StepBoat, "the pedalo skipped the buoy");
    const int Paddled = Apply(StepBoat, false, true, false, false, true, false);
    Expect(Paddled == StepSwim && Purse(StepBoat, Paddled) == 0, "the pedalo did not open the swim");

    Expect(Apply(StepSwim, false, true, true, false, false, true) == StepSwim, "the pedalo finished the swim");
    Expect(Apply(StepSwim, false, false, false, false, false, true) == StepSwim, "a dry visit finished the swim");
    Expect(Apply(StepSwim, false, false, true, true, false, false) == StepSwim, "swimming at the east mark finished the tour");
    const int Home = Apply(StepSwim, false, false, true, false, false, true);
    Expect(Home == StepBanked && Purse(StepSwim, Home) == Pay, "the swim did not pay %d", Pay);
    Expect(Apply(StepBanked, true, true, true, true, true, true) == StepBanked, "a banked tour reopened");
    Expect(Purse(StepBanked, StepBanked) == 0, "a second pass paid");

    Expect(Offers(true, true, true, true, true, true, true, StepBike), "a blank page did not offer the tour");
    Expect(!Offers(true, true, true, true, true, true, false, StepBike), "the tour opened before the page");
    Expect(!Offers(true, true, true, true, true, true, true, StepBanked), "a banked tour is still offered");
    Expect(GuidesAfter(true, true, true, true, true, true, true, StepBanked), "side jobs wait after the tour");
    Expect(!GuidesAfter(true, true, true, true, true, true, true, StepSwim), "side jobs return while the swim is open");

    const FSpot Bike = Objective(StepBike);
    const FSpot Boat = Objective(StepBoat);
    const FSpot Swim = Objective(StepSwim);
    Expect(Bike.X == BikeX && Bike.Y == BikeY, "the bike objective left the east mark");
    Expect(Boat.X == BoatX && Boat.Y == BoatY, "the boat objective left the buoy");
    Expect(Swim.X == FloatX && Swim.Y == FloatY, "the swim objective left the float");
    const FSpot Back = RecoverAt(StepBoat);
    Expect(Back.X == BoatRecoverX && Back.Y == BoatRecoverY, "the boat recover left the berth");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
