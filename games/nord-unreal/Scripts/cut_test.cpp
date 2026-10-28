// Standalone test for Source/Quebec/QuebecCut.h. Built by Scripts/test_cut.py.

#ifdef QUEBEC_CUT_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecCut.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecGrab.h"
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

using namespace QuebecCut;

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
        Expect(Gap(X, Y, QuebecGrab::CaseX, QuebecGrab::CaseY) > Reach, "%s", What);
        Expect(Gap(X, Y, QuebecGrab::DropX, QuebecGrab::DropY) > Reach, "%s", What);
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
    Expect(StepLine == 0 && StepRun == 1 && StepBanked == 2, "the steps drifted");
    Expect(Pay == 600 && Reach == 450. && Slice == 0.25 && RivalCmPerSecond == 900., "the purse or the rival drifted");
    Expect(RivalCmPerSecond > QuebecPace::SprintCmPerSecond, "the rival is no faster than a sprint");
    Expect(StartX > 20000. && FinishX > 20000. && BendX > 20000., "the race sits on the pond side");
    const double Grass = Direct();
    const double Long = Road();
    const double Theirs = Long / RivalCmPerSecond;
    Expect(Grass > 5000., "the line and the finish share a reach");
    Expect(Long > Grass, "their road is not the long way");
    Expect(Grass / QuebecPace::SprintCmPerSecond < Theirs, "a sprint on the grass cannot beat them");
    Expect(Grass / QuebecPace::WalkCmPerSecond > Theirs, "a walk on the grass still beats them");
    Expect(Long / QuebecPace::SprintCmPerSecond > Theirs, "a sprint on their road still beats them");
    Expect(Gap(StartX, StartY, StartX, StartY + RecoverNorth) > Reach, "the north recover already counts as the line");
    Expect(Gap(StartX, StartY + RecoverNorth, FinishX, FinishY) > Reach, "the recover already counts as the finish");
    Expect(!InFinish(StartX, StartY) && !InStart(FinishX, FinishY) && !InStart(BendX, BendY) && !InFinish(BendX, BendY), "the marks overlap");
    ClearOf(StartX, StartY, "the line sits on another door");
    ClearOf(FinishX, FinishY, "the finish sits on another door");
    ClearOf(BendX, BendY, "the bend sits on another door");
    ClearOf(StartX, StartY + RecoverNorth, "the recover sits on another door");

    Expect(!Offers(false, StepLine), "the race offered before the grab was banked");
    Expect(Offers(true, StepLine) && Offers(true, StepRun), "a banked grab did not offer the race");
    Expect(!Offers(true, StepBanked), "a finished race stayed open");
    Expect(Left(0.) >= 1 && Left(Theirs) == 0, "the seconds left drifted");

    FRun Closed;
    const FRun Gun = Tick(Closed, 0.1, true, StartX, StartY);
    Expect(Gun.Step == StepRun && Gun.Elapsed == 0., "a walker at the line stayed outside");
    Expect(Tick(Closed, 0.1, false, StartX, StartY).Step == StepLine, "a rider started the race");
    Expect(Purse(StepLine, StepRun) == 0, "starting the race paid");

    FRun Running = Gun;
    const FRun Waiting = Tick(Running, 0.2, true, StartX, StartY);
    Expect(Waiting.Step == StepRun && std::fabs(Waiting.Elapsed - 0.2) < 0.001, "standing at the line after the gun stopped them");
    const FRun Rode = Tick(Running, 0.2, false, FinishX, FinishY);
    Expect(Rode.Step == StepRun && std::fabs(Rode.Elapsed - 0.2) < 0.001, "a rider at the finish won");

    FRun Mid = Running;
    Mid.Elapsed = 8.;
    const FRun In = Tick(Mid, 0.1, true, FinishX, FinishY);
    Expect(In.Step == StepBanked && Purse(StepRun, In.Step) == Pay, "the finish did not pay");
    Expect(Tick(In, 0.1, true, FinishX, FinishY).Step == StepBanked, "the finish paid twice");
    Expect(Purse(StepBanked, StepBanked) == 0, "a banked race paid again");

    FRun Stall = Running;
    const FRun Stalled = Tick(Stall, 1.0, true, StartX, StartY + 2000.);
    Expect(Stalled.Step == StepRun && std::fabs(Stalled.Elapsed - Slice) < 0.001, "a one-second hitch handed them the race");

    FRun Late = Running;
    Late.Elapsed = Theirs - Slice * 0.5;
    const FRun Beat = Tick(Late, 1.0, true, FinishX, FinishY);
    Expect(Beat.Step == StepLine && Beat.Elapsed == 0., "a tie at the finish still paid");
    Expect(Purse(StepRun, Beat.Step) == 0, "their arrival paid");

    double AtX = 0.;
    double AtY = 0.;
    Place(0., AtX, AtY);
    Expect(std::fabs(AtX - StartX) < 1. && std::fabs(AtY - StartY) < 1., "they did not start on the line");
    Place(Theirs, AtX, AtY);
    Expect(Gap(AtX, AtY, FinishX, FinishY) < 1., "they did not arrive at the finish");

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
    Tail.Grab = QuebecStorySave::GrabBanked;
    Tail.Cut = StepRun;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "a race in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Grab, 2, Tail), "a version-6 slot carried the race");
    const QuebecStorySave::FSteps Applied = QuebecStorySave::Applied(QuebecStorySave::Grab, Tail);
    Expect(Applied.Grab == QuebecStorySave::GrabBanked && Applied.Cut == 0, "a version-6 slot copied the race");
    Tail.Grab = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "the race started before the grab was banked");
    Expect(StepBanked == QuebecStorySave::CutBanked, "the save left the race bank");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
