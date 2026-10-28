// Standalone test for Source/Quebec/QuebecEscort.h. Built by Scripts/test_escort.py.

#ifdef QUEBEC_ESCORT_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecEscort.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecStorySave.h"
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

using namespace QuebecEscort;

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
    Expect(StepMeet == 0 && StepWalk == 1 && StepBanked == 2, "the steps drifted");
    Expect(Pay == 480 && Reach == 450., "the purse or the door drifted");
    Expect(QuebecPace::WalkCmPerSecond < Speed && Speed < QuebecPace::SprintCmPerSecond, "Grey Coat no longer sits between a walk and a sprint");
    Expect(Close < Reach && Reach < RecoverSouth && RecoverSouth < Follow && Follow < Stop, "the leash distances overlap");
    Expect(MeetX > 20000. && DoorX > 20000., "the lawn sits on the pond side");
    Expect(Gap(MeetX, MeetY, DoorX, DoorY) > 5000., "the meet and the door share a reach");
    Expect(Gap(MeetX, MeetY, MeetX, MeetY - RecoverSouth) > Reach, "meet recover already counts as the meet");
    Expect(Gap(MeetX, MeetY - RecoverSouth, DoorX, DoorY) > Reach, "meet recover already counts as the door");
    Expect(Gap(DoorX, DoorY, DoorX, DoorY - RecoverSouth) > Reach, "door recover already counts as the door");
    Expect(Gap(MeetX, MeetY, QuebecRing::GateAX, QuebecRing::GateAY) > Reach, "the meet sits on the ring lawn");
    Expect(Gap(DoorX, DoorY, QuebecRing::GateAX, QuebecRing::GateAY) > Reach, "the door sits on the ring lawn");
    Expect(Gap(MeetX, MeetY, QuebecScoot::StandX, QuebecScoot::StandY) > Reach, "the meet sits on the scooter");
    Expect(Gap(DoorX, DoorY, QuebecScoot::StandX, QuebecScoot::StandY) > Reach, "the door sits on the scooter");
    Expect(Gap(MeetX, MeetY, QuebecCycle::StandX, QuebecCycle::StandY) > Reach, "the meet sits on the bike stand");
    Expect(Gap(DoorX, DoorY, QuebecCycle::StandX, QuebecCycle::StandY) > Reach, "the door sits on the bike stand");
    Expect(Gap(MeetX, MeetY, QuebecTour::BikeX, QuebecTour::BikeY) > Reach, "the meet sits on the east mark");
    Expect(Gap(DoorX, DoorY, QuebecCrate::CurbX, QuebecCrate::CurbY) > Reach, "the door sits on the caisse");
    Expect(Gap(DoorX, DoorY, QuebecCrate::ParkX, QuebecCrate::ParkY) > Reach, "the door sits on the Persillier drop");
    Expect(Gap(MeetX, MeetY, QuebecStand::Spot.X, QuebecStand::Spot.Y) > QuebecStand::Reach + Reach, "the meet sits on Chez Lise");
    Expect(Gap(DoorX, DoorY, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "the door sits on the atelier");
    for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers)
    {
        Expect(Gap(MeetX, MeetY, Spot.X, Spot.Y) > Reach, "the meet sits on a job marker");
        Expect(Gap(DoorX, DoorY, Spot.X, Spot.Y) > Reach, "the door sits on a job marker");
    }
    for (const QuebecCombatModel::FAnchor& Anchor : QuebecCombatModel::QAAnchors)
    {
        Expect(Gap(MeetX, MeetY, Anchor.X, Anchor.Y) > Reach, "the meet sits on a QA anchor");
        Expect(Gap(DoorX, DoorY, Anchor.X, Anchor.Y) > Reach, "the door sits on a QA anchor");
    }

    Expect(Meet(StepMeet, true, true) == StepWalk, "a walker at the meet stayed alone");
    Expect(Meet(StepMeet, false, true) == StepMeet, "a bike started the walk");
    Expect(Meet(StepMeet, true, false) == StepMeet, "a walker away from Grey Coat started the walk");
    Expect(Meet(StepWalk, true, true) == StepWalk, "meeting again skipped the door");
    Expect(!Offers(false, StepMeet), "the walk offered before the day was home");
    Expect(Offers(true, StepMeet) && Offers(true, StepWalk), "a home day did not offer the walk");
    Expect(!Offers(true, StepBanked), "a finished walk stayed open");

    FFriend Coat;
    const FFriend Rode = Move(Coat, MeetX + 100., MeetY, 0.1, false);
    Expect(Rode.bPlanted && Rode.X == MeetX && Rode.Y == MeetY, "a rider next to Grey Coat pulled them along");

    FFriend Far = Move(Coat, MeetX, MeetY + Stop + 50., 0.1, true);
    Expect(Far.bPlanted && Far.Y == MeetY, "Grey Coat followed past the stop");

    FFriend Held = Far;
    const FFriend Still = Move(Held, MeetX, MeetY + Stop + 50., 0.1, true);
    Expect(Still.bPlanted && Still.Y == MeetY, "a planted coat walked toward someone still too far");

    const FFriend Back = Move(Still, MeetX, MeetY + Follow, 0.1, true);
    Expect(!Back.bPlanted, "coming back inside the follow did not unplant Grey Coat");

    FFriend Catch = Coat;
    Catch.Y = MeetY;
    const double Ahead = MeetY + 800.;
    const FFriend Closed = Move(Catch, MeetX, Ahead, 0.1, true);
    Expect(!Closed.bPlanted && Closed.Y > MeetY && Closed.Y < Ahead - Close + 1., "a walker was not closed on");
    const double OneStep = Speed * 0.1;
    Expect(std::fabs(Closed.Y - MeetY - OneStep) < 0.01, "the catch step was not one tenth of the speed");

    FFriend Stall = Coat;
    const FFriend Stalled = Move(Stall, MeetX, MeetY + 1500., 1.0, true);
    Expect(!Stalled.bPlanted && std::fabs(Stalled.Y - MeetY - Speed * Hitch) < 0.01, "a one-second hitch dragged Grey Coat");

    Expect(!Arrived(StepWalk, true, true, DoorX, DoorY, DoorX, DoorY), "a planted coat at the door finished the walk");
    Expect(!Arrived(StepWalk, false, false, DoorX, DoorY, DoorX, DoorY), "a rider at the door finished the walk");
    Expect(!Arrived(StepWalk, true, false, DoorX, DoorY, MeetX, MeetY), "the player finished without Grey Coat");
    Expect(!Arrived(StepMeet, true, false, DoorX, DoorY, DoorX, DoorY), "the door counted before the meeting");
    Expect(Arrived(StepWalk, true, false, DoorX, DoorY - 100., DoorX, DoorY + 100.), "both people at the door did not finish");
    Expect(Purse(StepMeet, StepWalk) == 0, "meeting paid");
    Expect(Purse(StepWalk, StepBanked) == Pay, "the door did not pay");
    Expect(Purse(StepBanked, StepBanked) == 0, "the door paid twice");

    QuebecStorySave::FSteps Tail;
    Tail.Pond = QuebecStorySave::PondBanked;
    Tail.Court = QuebecStorySave::CourtBanked;
    Tail.Show = QuebecStorySave::ShowBanked;
    Tail.Rescue = QuebecStorySave::RescueDone;
    Tail.Convoy = QuebecStorySave::ConvoyBanked;
    Tail.Blank = QuebecStorySave::BlankBanked;
    Tail.Tour = QuebecStorySave::TourBanked;
    Tail.Home = QuebecStorySave::HomeBanked;
    Tail.Escort = StepWalk;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "a walk in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Story, 2, Tail), "a version-3 slot carried the walk");
    Tail.Home = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "the walk started before the day was home");
    Expect(QuebecEscort::StepBanked == QuebecStorySave::EscortBanked, "the save left the escort bank");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
