// Standalone test for Source/Quebec/QuebecGrab.h. Built by Scripts/test_grab.py.

#ifdef QUEBEC_GRAB_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecGrab.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecShade.h"
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

using namespace QuebecGrab;

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
        Expect(Gap(X, Y, QuebecShade::PocketX, QuebecShade::PocketY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecShade::FarX, QuebecShade::FarY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecShade::LampAX, QuebecShade::LampAY) > QuebecShade::Lamp + Reach, "%s", What);
        Expect(Gap(X, Y, QuebecShade::LampBX, QuebecShade::LampBY) > QuebecShade::Lamp + Reach, "%s", What);
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
    Expect(StepCase == 0 && StepRun == 1 && StepBanked == 2, "the steps drifted");
    Expect(Pay == 560 && Reach == 450. && Window == 12. && Slice == 0.25, "the purse or the window drifted");
    Expect(CaseX > 20000. && DropX > 20000., "the grab sits on the pond side");
    const double Leg = Gap(CaseX, CaseY, DropX, DropY);
    Expect(Leg > 5000., "the case and the drop share a reach");
    Expect(Leg / QuebecPace::SprintCmPerSecond < Window, "a sprint cannot beat the window");
    Expect(Leg / QuebecPace::WalkCmPerSecond > Window, "a walk still beats the window");
    Expect(Gap(CaseX, CaseY, CaseX, CaseY + RecoverNorth) > Reach, "the north recover already counts as the case");
    Expect(Gap(CaseX, CaseY + RecoverNorth, DropX, DropY) > Reach, "the recover already counts as the drop");
    Expect(!InDrop(CaseX, CaseY) && !InCase(DropX, DropY), "the case and the drop overlap");
    ClearOf(CaseX, CaseY, "the case sits on another door");
    ClearOf(DropX, DropY, "the drop sits on another door");
    ClearOf(CaseX, CaseY + RecoverNorth, "the recover sits on another door");

    Expect(!Offers(false, StepCase), "the window offered before the crossing was banked");
    Expect(Offers(true, StepCase) && Offers(true, StepRun), "a dark lawn did not offer the window");
    Expect(!Offers(true, StepBanked), "a finished grab stayed open");
    Expect(Left(0.) == 12 && Left(11.1) == 1 && Left(12.) == 0, "the seconds left drifted");

    FRun Closed;
    const FRun Taken = Tick(Closed, 0.1, true, CaseX, CaseY);
    Expect(Taken.Step == StepRun && Taken.Elapsed == 0., "a walker at the case stayed outside");
    Expect(Tick(Closed, 0.1, false, CaseX, CaseY).Step == StepCase, "a rider took the case");
    Expect(Purse(StepCase, StepRun) == 0, "taking the case paid");

    FRun Running = Taken;
    const FRun Waiting = Tick(Running, 0.2, true, CaseX, CaseY);
    Expect(Waiting.Step == StepRun && std::fabs(Waiting.Elapsed - 0.2) < 0.001, "standing at the case after the take stopped the clock");
    const FRun Rode = Tick(Running, 0.2, false, DropX, DropY);
    Expect(Rode.Step == StepRun && std::fabs(Rode.Elapsed - 0.2) < 0.001, "a rider at the drop finished the grab");

    FRun Mid = Running;
    Mid.Elapsed = 8.;
    const FRun In = Tick(Mid, 0.1, true, DropX, DropY);
    Expect(In.Step == StepBanked && Purse(StepRun, In.Step) == Pay, "the drop did not pay");
    Expect(Tick(In, 0.1, true, DropX, DropY).Step == StepBanked, "the drop paid twice");
    Expect(Purse(StepBanked, StepBanked) == 0, "a banked grab paid again");

    FRun Hitch = Running;
    const FRun Stalled = Tick(Hitch, 1.0, true, CaseX, CaseY + 2000.);
    Expect(Stalled.Step == StepRun && std::fabs(Stalled.Elapsed - Slice) < 0.001, "a one-second hitch ate the window");

    FRun Late = Running;
    Late.Elapsed = Window - Slice * 0.5;
    const FRun Shut = Tick(Late, 1.0, true, DropX, DropY);
    Expect(Shut.Step == StepCase && Shut.Elapsed == 0., "a late drop still paid");
    Expect(Purse(StepRun, Shut.Step) == 0, "a shut window paid");

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
    Tail.Shade = QuebecStorySave::ShadeBanked;
    Tail.Grab = StepRun;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "a grab in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Shade, 2, Tail), "a version-5 slot carried the grab");
    const QuebecStorySave::FSteps Applied = QuebecStorySave::Applied(QuebecStorySave::Shade, Tail);
    Expect(Applied.Shade == QuebecStorySave::ShadeBanked && Applied.Grab == 0, "a version-5 slot copied the grab");
    Tail.Shade = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "the grab started before the crossing was banked");
    Expect(StepBanked == QuebecStorySave::GrabBanked, "the save left the grab bank");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
