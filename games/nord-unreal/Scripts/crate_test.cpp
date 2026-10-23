// Standalone test for Source/Quebec/QuebecCrate.h. Built by Scripts/test_crate.py.

#ifdef QUEBEC_CRATE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecCrate.h"
#include "../Source/Quebec/QuebecStandRules.h"
#include "../Source/Quebec/QuebecBayRules.h"
#include "../Source/Quebec/QuebecTrio.h"
#include "../Source/Quebec/QuebecTour.h"
#include "../Source/Quebec/QuebecRing.h"
#include "../Source/Quebec/QuebecCombatModel.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecCrate;

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
    Expect(Curb == 0 && Park == 1 && Done == 2, "the caisse steps drifted");
    Expect(Pay == 260, "the purse drifted from 260");
    Expect(Reach == 450.f, "the reach drifted from the door");
    Expect(Nobody == -1, "a real player id of 0 must stay free");
    Expect(CurbX > 20000. && ParkX > 20000., "a caisse point sits west of the dry east side");
    Expect(Gap(CurbX, CurbY, ParkX, ParkY) > 5000., "the park is not a trip from the sidewalk");
    Expect(Gap(CurbX, CurbY, QuebecStand::Spot.X, QuebecStand::Spot.Y) > static_cast<double>(Reach) + QuebecStand::Reach,
        "the caisse reaches Chez Lise");
    Expect(Gap(CurbX, CurbY, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "the caisse reaches the atelier");
    Expect(Gap(ParkX, ParkY, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "the park post reaches the atelier");
    for (const QuebecTrio::FStop& Stop : QuebecTrio::Stops)
    {
        Expect(Gap(CurbX, CurbY, Stop.X, Stop.Y) > static_cast<double>(Reach), "the caisse reaches a porte");
        Expect(Gap(ParkX, ParkY, Stop.X, Stop.Y) > static_cast<double>(Reach), "the park post reaches a porte");
    }
    Expect(Gap(CurbX, CurbY, QuebecTour::BikeX, QuebecTour::BikeY) > static_cast<double>(Reach), "the caisse reaches the east mark");
    Expect(Gap(ParkX, ParkY, QuebecTour::BikeX, QuebecTour::BikeY) > static_cast<double>(Reach), "the park post reaches the east mark");
    Expect(Gap(CurbX, CurbY, QuebecRing::StandX, QuebecRing::StandY) > static_cast<double>(Reach), "the caisse reaches the bike stand");
    Expect(Gap(ParkX, ParkY, QuebecRing::GateAX, QuebecRing::GateAY) > static_cast<double>(Reach), "the park post reaches the lawn");
    Expect(Gap(CurbX, CurbY, QuebecRing::GateBX, QuebecRing::GateBY) > static_cast<double>(Reach), "the caisse reaches the allée");
    for (const QuebecCombatModel::FSpot& Spot : QuebecCombatModel::PickupSpots)
    {
        Expect(Gap(CurbX, CurbY, Spot.X, Spot.Y) > static_cast<double>(Reach), "the caisse reaches a pickup");
        Expect(Gap(ParkX, ParkY, Spot.X, Spot.Y) > static_cast<double>(Reach), "the park post reaches a pickup");
    }
    for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers)
    {
        Expect(Gap(CurbX, CurbY, Spot.X, Spot.Y) > static_cast<double>(Reach), "the caisse reaches a job marker");
        Expect(Gap(ParkX, ParkY, Spot.X, Spot.Y) > static_cast<double>(Reach), "the park post reaches a job marker");
    }
    for (const QuebecCombatModel::FAnchor& Anchor : QuebecCombatModel::QAAnchors)
    {
        Expect(Gap(CurbX, CurbY, Anchor.X, Anchor.Y) > static_cast<double>(Reach), "the caisse stands on a QA anchor");
        Expect(Gap(ParkX, ParkY, Anchor.X, Anchor.Y) > static_cast<double>(Reach), "the park post stands on a QA anchor");
    }

    FProgress Fresh;
    const FProgress Still = Advance(Fresh, 0, false, true, true, false);
    Expect(Still.Step == Curb && Still.Runner == Nobody, "a bike at the caisse took it");
    const FProgress WalkerPark = Advance(Fresh, 0, true, false, false, true);
    Expect(WalkerPark.Step == Curb, "standing in the park skipped the caisse");
    const FProgress Both = Advance(Fresh, 0, true, true, true, true);
    Expect(Both.Step == Curb, "being on foot and on a bike took the caisse");
    const FProgress NobodyTook = Advance(Fresh, Nobody, true, false, true, false);
    Expect(NobodyTook.Step == Curb, "nobody took the caisse");

    const FProgress Carried = Advance(Fresh, 0, true, false, true, false);
    Expect(Carried.Step == Park && Carried.Runner == 0, "player 0 did not take the caisse");
    Expect(Purse(Fresh, Carried) == 0, "taking the caisse paid");
    const FProgress Stranger = Advance(Carried, 4, false, true, false, true);
    Expect(Stranger.Step == Park && Stranger.Runner == 0, "another rider dropped the parcel");
    Expect(Purse(Carried, Stranger) == 0, "another rider was paid");
    const FProgress OnFoot = Advance(Carried, 0, true, false, false, true);
    Expect(OnFoot.Step == Park, "walking into the park dropped the parcel");
    const FProgress Home = Advance(Carried, 0, false, true, false, true);
    Expect(Home.Step == Done && Home.Runner == 0, "the rider did not finish at Persillier");
    Expect(Purse(Carried, Home) == Pay, "the purse was not 260");
    const FProgress Again = Advance(Home, 0, false, true, false, true);
    Expect(Again.Step == Done, "a second pass left the bank");
    Expect(Purse(Home, Again) == 0, "a second pass paid");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
