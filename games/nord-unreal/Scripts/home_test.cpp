// Standalone test for Source/Quebec/QuebecHome.h. Built by Scripts/test_home.py.

#ifdef QUEBEC_HOME_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecHome.h"
#include "../Source/Quebec/QuebecTour.h"
#include "../Source/Quebec/QuebecCrate.h"
#include "../Source/Quebec/QuebecStandRules.h"
#include "../Source/Quebec/QuebecBayRules.h"
#include "../Source/Quebec/QuebecJobRules.h"
#include "../Source/Quebec/QuebecCombatModel.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecHome;

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
    Expect(StepBike == 0 && StepBoat == 1 && StepWalk == 2 && StepBanked == 3, "the steps drifted");
    Expect(Pay == 420 && Reach == 450., "the purse or the reach drifted");
    Expect(StandX == QuebecCycle::StandX && StandY == QuebecCycle::StandY, "the bike step left the stand");
    Expect(BerthX == QuebecRide::BerthX && BerthY == QuebecRide::BerthY, "the boat step left the berth");
    Expect(BankX == QuebecWade::BankX && BankY == QuebecWade::BankY, "the walk step left the bank");
    Expect(StandRecoverX > 20000., "the stand recover sits on the pond side");
    Expect(Gap(StandX, StandY, StandRecoverX, StandRecoverY) > Reach, "stand recover already counts as the stand");
    Expect(Gap(BerthX, BerthY, BerthRecoverX, BerthRecoverY) > Reach, "berth recover already counts as the berth");
    Expect(BerthRecoverY < BerthY, "the berth recover is not south of the channel");
    Expect(Gap(BankX, BankY, BankRecoverX, BankRecoverY) > Reach, "bank recover already counts as the bank");
    Expect(Gap(BankRecoverX, BankRecoverY, QuebecWade::BuoyX, QuebecWade::BuoyY) > Gap(BankX, BankY, QuebecWade::BuoyX, QuebecWade::BuoyY),
        "the walk recover steps back toward the float");
    Expect(Gap(StandX, StandY, BerthX, BerthY) > 5000., "the stand and the berth share a reach");
    Expect(Gap(BerthX, BerthY, BankX, BankY) > 5000., "the berth and the bank share a reach");
    Expect(Gap(BankX, BankY, StandX, StandY) > 5000., "the bank and the stand share a reach");
    Expect(Gap(StandX, StandY, QuebecTour::BikeX, QuebecTour::BikeY) > Reach, "the stand sits on the east mark");
    Expect(Gap(BerthX, BerthY, QuebecLap::BuoyX, QuebecLap::BuoyY) > Reach, "the berth sits on the buoy");
    Expect(Gap(StandRecoverX, StandRecoverY, QuebecCrate::CurbX, QuebecCrate::CurbY) > Reach, "stand recover sits on the caisse");
    Expect(Gap(StandRecoverX, StandRecoverY, QuebecStand::Spot.X, QuebecStand::Spot.Y) > QuebecStand::Reach + Reach, "stand recover sits on Chez Lise");
    Expect(Gap(StandRecoverX, StandRecoverY, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "stand recover sits on the atelier");
    Expect(Gap(BerthRecoverX, BerthRecoverY, QuebecJobRules::GoonArena.X, QuebecJobRules::GoonArena.Y) > QuebecJobRules::GoonArenaRadius,
        "berth recover sits in the goon arena");
    for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers)
    {
        Expect(Gap(StandRecoverX, StandRecoverY, Spot.X, Spot.Y) > Reach, "stand recover sits on a job marker");
        Expect(Gap(BerthRecoverX, BerthRecoverY, Spot.X, Spot.Y) > Reach, "berth recover sits on a job marker");
        Expect(Gap(BankRecoverX, BankRecoverY, Spot.X, Spot.Y) > Reach, "bank recover sits on a job marker");
    }
    for (const QuebecCombatModel::FAnchor& Anchor : QuebecCombatModel::QAAnchors)
    {
        Expect(Gap(StandRecoverX, StandRecoverY, Anchor.X, Anchor.Y) > Reach, "stand recover sits on a QA anchor");
        Expect(Gap(BerthRecoverX, BerthRecoverY, Anchor.X, Anchor.Y) > Reach, "berth recover sits on a QA anchor");
        Expect(Gap(BankRecoverX, BankRecoverY, Anchor.X, Anchor.Y) > Reach, "bank recover sits on a QA anchor");
    }

    Expect(Apply(StepBike, false, false, true, true, false, false) == StepBike, "a walker tagged the stand");
    Expect(Apply(StepBike, false, true, false, true, false, false) == StepBike, "the pedalo tagged the stand");
    Expect(Apply(StepBike, true, false, false, false, true, false) == StepBike, "the bike skipped ahead to the berth");
    Expect(Apply(StepBike, true, true, false, true, false, false) == StepBike, "a bike that is also a pedalo advanced");
    const int Rode = Apply(StepBike, true, false, false, true, false, false);
    Expect(Rode == StepBoat && Purse(StepBike, Rode) == 0, "the bike did not open the berth");

    Expect(Apply(StepBoat, true, false, false, false, true, false) == StepBoat, "the bike tagged the berth");
    Expect(Apply(StepBoat, false, true, false, true, false, false) == StepBoat, "the pedalo skipped the berth");
    const int Paddled = Apply(StepBoat, false, true, false, false, true, false);
    Expect(Paddled == StepWalk && Purse(StepBoat, Paddled) == 0, "the pedalo did not open the walk");

    Expect(Apply(StepWalk, false, true, true, false, false, true) == StepWalk, "the pedalo finished the walk");
    Expect(Apply(StepWalk, false, false, false, false, false, true) == StepWalk, "a swimmer finished the walk");
    Expect(Apply(StepWalk, false, false, true, true, false, false) == StepWalk, "walking the stand finished the day");
    const int Home = Apply(StepWalk, false, false, true, false, false, true);
    Expect(Home == StepBanked && Purse(StepWalk, Home) == Pay, "the walk did not pay %d", Pay);
    Expect(Apply(StepBanked, true, true, true, true, true, true) == StepBanked, "a banked day reopened");
    Expect(Purse(StepBanked, StepBanked) == 0, "a second pass paid");

    Expect(Offers(true, true, true, true, true, true, true, true, StepBike), "a banked tour did not offer the day");
    Expect(!Offers(true, true, true, true, true, true, true, false, StepBike), "the day opened before the tour");
    Expect(!Offers(true, true, true, true, true, true, true, true, StepBanked), "a banked day is still offered");
    Expect(GuidesAfter(true, true, true, true, true, true, true, true, StepBanked), "side jobs wait after the day");
    Expect(!GuidesAfter(true, true, true, true, true, true, true, true, StepWalk), "side jobs return while the walk is open");

    const FSpot Bike = Objective(StepBike);
    const FSpot Boat = Objective(StepBoat);
    const FSpot Walk = Objective(StepWalk);
    Expect(Bike.X == StandX && Bike.Y == StandY, "the bike objective left the stand");
    Expect(Boat.X == BerthX && Boat.Y == BerthY, "the boat objective left the berth");
    Expect(Walk.X == BankX && Walk.Y == BankY, "the walk objective left the bank");
    const FSpot Back = RecoverAt(StepBoat);
    Expect(Back.X == BerthRecoverX && Back.Y == BerthRecoverY, "the boat recover left the south shore");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
