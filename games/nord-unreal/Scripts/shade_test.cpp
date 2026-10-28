// Standalone test for Source/Quebec/QuebecShade.h. Built by Scripts/test_shade.py.

#ifdef QUEBEC_SHADE_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecShade.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecEscort.h"
#include "../Source/Quebec/QuebecHome.h"
#include "../Source/Quebec/QuebecTour.h"
#include "../Source/Quebec/QuebecCycle.h"
#include "../Source/Quebec/QuebecScoot.h"
#include "../Source/Quebec/QuebecRing.h"
#include "../Source/Quebec/QuebecCrate.h"
#include "../Source/Quebec/QuebecStandRules.h"
#include "../Source/Quebec/QuebecBayRules.h"
#include "../Source/Quebec/QuebecJobRules.h"
#include "../Source/Quebec/QuebecCombatModel.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecShade;

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

    void ClearOf(double X, double Y, const char* What)
    {
        Expect(Gap(X, Y, QuebecEscort::MeetX, QuebecEscort::MeetY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecEscort::DoorX, QuebecEscort::DoorY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecRing::GateAX, QuebecRing::GateAY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecScoot::StandX, QuebecScoot::StandY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecCycle::StandX, QuebecCycle::StandY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecTour::BikeX, QuebecTour::BikeY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecCrate::CurbX, QuebecCrate::CurbY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecCrate::ParkX, QuebecCrate::ParkY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecStand::Spot.X, QuebecStand::Spot.Y) > QuebecStand::Reach + Reach, "%s", What);
        Expect(Gap(X, Y, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "%s", What);
        Expect(Gap(X, Y, QuebecCombatModel::HospitalX, QuebecCombatModel::HospitalY) > Reach, "%s", What);
        for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers)
            Expect(Gap(X, Y, Spot.X, Spot.Y) > Reach, "%s", What);
        for (const QuebecCombatModel::FAnchor& Anchor : QuebecCombatModel::QAAnchors)
            Expect(Gap(X, Y, Anchor.X, Anchor.Y) > Reach, "%s", What);
    }
}

int main()
{
    Expect(StepPocket == 0 && StepCross == 1 && StepBanked == 2, "the steps drifted");
    Expect(Pay == 520 && Reach == 450. && Lamp == 800., "the purse or a radius drifted");
    Expect(PocketX > 20000. && FarX > 20000. && LampAX > 20000. && LampBX > 20000., "the lawn sits on the pond side");
    Expect(Gap(PocketX, PocketY, FarX, FarY) > 5000., "the pockets share a reach");
    Expect(Gap(PocketX, PocketY, PocketX, PocketY + RecoverNorth) > Reach, "the north recover already counts as the pocket");
    Expect(!InLamp(PocketX, PocketY) && !InLamp(FarX, FarY), "a pocket stands in a lamp");
    Expect(!InLamp(PocketX, PocketY + RecoverNorth), "the recover stands in a lamp");
    Expect(Gap(PocketX, PocketY, LampAX, LampAY) > Lamp + Reach, "the pocket overlaps a lamp");
    Expect(Gap(PocketX, PocketY, LampBX, LampBY) > Lamp + Reach, "the pocket overlaps the east lamp");
    Expect(Gap(FarX, FarY, LampAX, LampAY) > Lamp + Reach, "the south dark overlaps a lamp");
    Expect(InLamp(50700., 12000.), "the straight line between the pockets is dark");
    Expect(!InLamp(48500., 12000.) && !InLamp(48500., 14500.) && !InLamp(48500., 9000.), "the west dark is lit");
    ClearOf(PocketX, PocketY, "the pocket sits on another door");
    ClearOf(FarX, FarY, "the south dark sits on another door");
    ClearOf(LampAX, LampAY, "a lamp sits on another door");
    ClearOf(LampBX, LampBY, "the east lamp sits on another door");

    Expect(!Offers(false, StepPocket), "the crossing offered before Grey Coat was home");
    Expect(Offers(true, StepPocket) && Offers(true, StepCross), "a finished walk did not offer the crossing");
    Expect(!Offers(true, StepBanked), "a finished crossing stayed open");

    FCross Dark;
    const FCross Started = Watch(Dark, true, PocketX, PocketY, false);
    Expect(Started.Step == StepCross && !Started.bBurned, "a walker in the pocket stayed outside");
    Expect(Watch(Dark, false, PocketX, PocketY, false).Step == StepPocket, "a rider started the crossing");
    Expect(Purse(StepPocket, StepCross) == 0, "entering the pocket paid");

    FCross Crossing = Started;
    const FCross Seen = Watch(Crossing, true, 50700., 12000., false);
    Expect(Seen.Step == StepCross && Seen.bBurned, "the straight line did not burn the crossing");
    Expect(Watch(Seen, true, FarX, FarY, false).Step == StepCross, "a burned crossing finished at the south dark");
    const FCross Covered = Watch(Seen, true, PocketX, PocketY, false);
    Expect(Covered.Step == StepCross && !Covered.bBurned, "the pocket did not cover a burned crossing");
    Expect(Watch(Seen, true, PocketX, PocketY, true).bBurned, "the pocket covered someone who was still lit");

    FCross Clean = Started;
    const FCross Around = Watch(Clean, true, 48500., 12000., false);
    Expect(Around.Step == StepCross && !Around.bBurned, "the west dark burned a clean crossing");
    const FCross Done = Watch(Around, true, FarX, FarY, false);
    Expect(Done.Step == StepBanked && Purse(StepCross, Done.Step) == Pay, "the south dark did not pay");
    Expect(Watch(Done, true, FarX, FarY, false).Step == StepBanked, "the south dark paid twice");
    Expect(Purse(StepBanked, StepBanked) == 0, "a banked crossing paid again");
    Expect(Watch(Clean, false, FarX, FarY, false).Step == StepCross, "a rider finished the crossing");
    Expect(Watch(Clean, true, FarX, FarY, true).bBurned, "another person in a lamp left this crossing clean");
    Expect(Watch(Clean, false, 50700., 12000., false).bBurned, "a rider in a lamp stayed clean");

    QuebecStorySave::FSteps Tail;
    Tail.Pond = QuebecStorySave::PondBanked;
    Tail.Court = QuebecStorySave::CourtBanked;
    Tail.Show = QuebecStorySave::ShowBanked;
    Tail.Rescue = QuebecStorySave::RescueDone;
    Tail.Convoy = QuebecStorySave::ConvoyBanked;
    Tail.Blank = QuebecStorySave::BlankBanked;
    Tail.Tour = QuebecStorySave::TourBanked;
    Tail.Home = QuebecStorySave::HomeBanked;
    Tail.Escort = QuebecStorySave::EscortBanked;
    Tail.Shade = StepCross;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "a crossing in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Escort, 2, Tail), "a version-4 slot carried the crossing");
    const QuebecStorySave::FSteps Applied = QuebecStorySave::Applied(QuebecStorySave::Escort, Tail);
    Expect(Applied.Escort == QuebecStorySave::EscortBanked && Applied.Shade == 0, "a version-4 slot copied the crossing");
    Tail.Escort = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "the crossing started before the walk was banked");
    Expect(StepBanked == QuebecStorySave::ShadeBanked, "the save left the shade bank");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
