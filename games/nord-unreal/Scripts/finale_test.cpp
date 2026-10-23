// Standalone test for Source/Quebec/QuebecFinale.h. Built by Scripts/test_finale.py.

#ifdef QUEBEC_FINALE_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecFinale.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecCut.h"
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

using namespace QuebecFinale;

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

    void ClearOf(double X, double Y, double Radius, const char* What)
    {
        const FSpot Door = Seat();
        const FSpot End = Hide();
        const FDay Waiting = Park();
        const FSpot Side = ChaseRecover();
        Expect(Apart(X, Y, Door.X, Door.Y) > Radius || (std::fabs(X - Door.X) < 1. && std::fabs(Y - Door.Y) < 1.), "%s", What);
        Expect(Apart(X, Y, End.X, End.Y) > Radius || (std::fabs(X - End.X) < 1. && std::fabs(Y - End.Y) < 1.), "%s", What);
        Expect(Apart(X, Y, Waiting.TailX, Waiting.TailY) > Radius || (std::fabs(X - Waiting.TailX) < 1. && std::fabs(Y - Waiting.TailY) < 1.), "%s", What);
        Expect(Apart(X, Y, Side.X, Side.Y) > Radius || (std::fabs(X - Side.X) < 1. && std::fabs(Y - Side.Y) < 1.), "%s", What);
        Expect(Apart(X, Y, QuebecChase::StartX, QuebecChase::StartY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecChase::HideX, QuebecChase::HideY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecChase::RecoverX, QuebecChase::RecoverY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecCut::StartX, QuebecCut::StartY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecCut::FinishX, QuebecCut::FinishY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecCut::BendX, QuebecCut::BendY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecGrab::CaseX, QuebecGrab::CaseY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecGrab::DropX, QuebecGrab::DropY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecShade::PocketX, QuebecShade::PocketY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecShade::FarX, QuebecShade::FarY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecShade::LampAX, QuebecShade::LampAY) > QuebecShade::Lamp + Radius, "%s", What);
        Expect(Apart(X, Y, QuebecShade::LampBX, QuebecShade::LampBY) > QuebecShade::Lamp + Radius, "%s", What);
        Expect(Apart(X, Y, QuebecEscort::MeetX, QuebecEscort::MeetY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecEscort::DoorX, QuebecEscort::DoorY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecRing::GateAX, QuebecRing::GateAY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecScoot::StandX, QuebecScoot::StandY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecCycle::StandX, QuebecCycle::StandY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecTour::BikeX, QuebecTour::BikeY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecCrate::CurbX, QuebecCrate::CurbY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecCrate::ParkX, QuebecCrate::ParkY) > Radius, "%s", What);
        Expect(Apart(X, Y, QuebecStand::Spot.X, QuebecStand::Spot.Y) > QuebecStand::Reach + Radius, "%s", What);
        Expect(Apart(X, Y, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "%s", What);
        Expect(Apart(X, Y, QuebecCombatModel::HospitalX, QuebecCombatModel::HospitalY) > Radius, "%s", What);
        for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers)
            Expect(Apart(X, Y, Spot.X, Spot.Y) > Radius, "%s", What);
        for (const QuebecCombatModel::FAnchor& Anchor : QuebecCombatModel::QAAnchors)
            Expect(Apart(X, Y, Anchor.X, Anchor.Y) > Radius, "%s", What);
    }

    FDay RunLine(int Step, double Speed, double FromX, double FromY, double ToX, double ToY)
    {
        FDay Now;
        Now.Step = Step;
        Now = Tick(Now, Slice, true, false, true, FromX, FromY, false);
        const double Dist = Apart(FromX, FromY, ToX, ToY);
        const double UX = Dist <= 0. ? 0. : (ToX - FromX) / Dist;
        const double UY = Dist <= 0. ? 0. : (ToY - FromY) / Dist;
        double Along = 0.;
        double X = FromX;
        double Y = FromY;
        for (int Frame = 0; Frame < 80 && Now.Step == Step; ++Frame)
        {
            const bool bLive = Step == StepPage ? Now.bHolding : Now.bRacing;
            if (!bLive) break;
            Along += Speed * Slice;
            if (Along > Dist) Along = Dist;
            X = FromX + UX * Along;
            Y = FromY + UY * Along;
            Now = Tick(Now, Slice, true, false, true, X, Y, false);
            if (Along + 1. >= Dist) break;
        }
        return Now;
    }

    FDay Drive(double Speed, bool bInCar, bool& bCaught)
    {
        const FSpot Door = Seat();
        const FSpot End = Hide();
        FDay Now = Tick(Park(), Slice, false, true, true, Door.X, Door.Y, false);
        const double DX = End.X - Door.X;
        const double DY = End.Y - Door.Y;
        const double Length = Apart(Door.X, Door.Y, End.X, End.Y);
        const double UX = Length <= 0. ? 0. : DX / Length;
        const double UY = Length <= 0. ? 0. : DY / Length;
        double X = Door.X;
        double Y = Door.Y;
        double Along = 0.;
        bCaught = false;
        for (int Frame = 0; Frame < 80 && Now.bTailing && Now.Step == StepChase; ++Frame)
        {
            Along += Speed * Slice;
            if (Along > Length) Along = Length;
            X = Door.X + UX * Along;
            Y = Door.Y + UY * Along;
            Now = Tick(Now, Slice, false, bInCar, true, X, Y, false);
            if (!Now.bTailing && Now.Step == StepChase)
            {
                bCaught = true;
                break;
            }
            if (Along + 1. >= Length) break;
        }
        return Now;
    }
}

int main()
{
    Expect(StepMeet == 0 && StepDark == 1 && StepPage == 2 && StepCut == 3 && StepChase == 4 && StepBanked == 5, "the stages drifted");
    Expect(Pay == 800 && FootReach == 450. && CarReach == 1100. && Catch == 600. && Window == 5. && Slice == 0.25, "the purse or a radius drifted");
    Expect(TailCmPerSecond == 1100. && RivalCmPerSecond == 1100. && RivalCmPerSecond > QuebecPace::SprintCmPerSecond, "the grass runner is no faster than a sprint");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(QuebecCycle::BikeKind) && !CountsAsCar(QuebecScoot::ScootKind), "a bike counted as the car");
    Expect(ColumnX > 20000. && MeetY > 0. && FinishY > 0., "the lawn sits on the pond side");

    const FSpot Door = Seat();
    const FSpot End = Hide();
    const FDay Waiting = Park();
    const FSpot Side = ChaseRecover();
    const double Run = Apart(Door.X, Door.Y, End.X, End.Y);
    Expect(std::fabs(Run - (HideAlong - SeatAlong)) < 1., "the hide left the edge");
    Expect(Run > 4000. && Run < 5000., "the hide is not the short last stretch");
    Expect(std::fabs(Apart(Waiting.TailX, Waiting.TailY, Door.X, Door.Y) - HeadStart) < 1., "the tail does not wait behind the seat");
    Expect(Apart(Side.X, Side.Y, Door.X, Door.Y) > CarReach, "the recover already counts as the seat");
    Expect(Apart(Side.X, Side.Y, End.X, End.Y) > CarReach, "the recover already counts as the hide");
    Expect(Apart(Waiting.TailX, Waiting.TailY, Side.X, Side.Y) > CarReach, "the recover stands on the tail's park");
    Expect(Apart(Door.X, Door.Y, QuebecChase::StartX, QuebecChase::StartY) > 20000., "the seat reused mission 15");
    Expect(!InHide(Door.X, Door.Y) && !InSeat(End.X, End.Y), "the seat and the hide overlap");

    const FSpot Marks[] = {Meet(), Pocket(), Far(), Case(), Drop(), Line(), Finish(), Bend(), Recover(StepMeet), Recover(StepDark), Recover(StepPage), Recover(StepCut)};
    for (const FSpot& Mark : Marks)
        ClearOf(Mark.X, Mark.Y, FootReach, "a lawn mark sits on another door");
    ClearOf(LampAX, LampAY, FootReach, "a lamp sits on another door");
    ClearOf(LampBX, LampBY, FootReach, "a lamp sits on another door");
    ClearOf(DarkWestX, DarkWestY, FootReach, "the west dark sits on another door");
    ClearOf(Door.X, Door.Y, CarReach, "the seat sits on another door");
    ClearOf(End.X, End.Y, CarReach, "the hide sits on another door");
    ClearOf(Waiting.TailX, Waiting.TailY, CarReach, "the park sits on another door");
    ClearOf(Side.X, Side.Y, CarReach, "the recover sits on another door");

    Expect(Apart(Meet().X, Meet().Y, Pocket().X, Pocket().Y) > FootReach * 2., "the meet and the pocket overlap");
    Expect(Apart(Pocket().X, Pocket().Y, Far().X, Far().Y) > FootReach * 2., "the pocket and the far dark overlap");
    Expect(Apart(Far().X, Far().Y, Case().X, Case().Y) > FootReach * 2., "the far dark and the case overlap");
    Expect(Apart(Drop().X, Drop().Y, Line().X, Line().Y) > FootReach * 2., "the drop and the line overlap");
    Expect(Apart(Recover(StepMeet).X, Recover(StepMeet).Y, Meet().X, Meet().Y) > FootReach, "meet recover is already the meet");
    Expect(Apart(Recover(StepDark).X, Recover(StepDark).Y, Pocket().X, Pocket().Y) > FootReach, "dark recover is already the pocket");
    Expect(!InLamp(Recover(StepDark).X, Recover(StepDark).Y), "dark recover stands in a lamp");
    Expect(Apart(Recover(StepPage).X, Recover(StepPage).Y, Case().X, Case().Y) > FootReach, "page recover is already the case");
    Expect(Apart(Recover(StepCut).X, Recover(StepCut).Y, Line().X, Line().Y) > FootReach, "cut recover is already the line");

    Expect(InLamp(ColumnX, LampAY) && !InLamp(Pocket().X, Pocket().Y) && !InLamp(Far().X, Far().Y), "the straight dark is not the lit line");
    Expect(!InLamp(DarkWestX, DarkWestY), "the west side is lit");
    const double PageRun = Apart(Case().X, Case().Y, Drop().X, Drop().Y);
    const double PageSouth = PageRun - FootReach * 2.;
    Expect(PageRun / QuebecPace::SprintCmPerSecond < Window && PageRun / QuebecPace::WalkCmPerSecond > Window, "the page window does not split a sprint from a walk");
    Expect(PageSouth / QuebecPace::WalkCmPerSecond > Window, "a walk from the south edge of the page still makes it");
    Expect(PageSouth / QuebecPace::SprintCmPerSecond < Window, "a sprint from the south edge of the page misses it");
    const double RivalTime = Road() / RivalCmPerSecond;
    const double GrassSouth = Grass() - FootReach * 2.;
    Expect(Grass() / QuebecPace::SprintCmPerSecond < RivalTime, "a grass sprint does not beat them");
    Expect(Grass() / QuebecPace::WalkCmPerSecond > RivalTime, "a grass walk beats them");
    Expect(GrassSouth / QuebecPace::WalkCmPerSecond > RivalTime, "a walk from the south edge of the line still beats them");
    Expect(GrassSouth / QuebecPace::SprintCmPerSecond < RivalTime, "a sprint from the south edge of the line loses");
    Expect(Road() / QuebecPace::SprintCmPerSecond > RivalTime, "a sprint on their road beats them");
    Expect(Road() > Grass(), "their road is the short way");

    Expect(!Offers(false, StepMeet), "the day offered before the tail was lost");
    Expect(Offers(true, StepMeet) && Offers(true, StepChase), "a lost tail did not offer the day");
    Expect(!Offers(true, StepBanked), "a finished day stayed open");

    const FDay WalkUp = Tick(FDay{}, Slice, true, false, true, Meet().X, Meet().Y, false);
    Expect(WalkUp.Step == StepDark && Purse(StepMeet, WalkUp.Step) == 0, "walking up did not open the dark");
    const FDay RideUp = Tick(FDay{}, Slice, false, true, true, Meet().X, Meet().Y, false);
    Expect(RideUp.Step == StepMeet, "a car walked up to them");

    FDay Dark;
    Dark.Step = StepDark;
    const FDay Lit = Tick(Dark, Slice, true, false, true, ColumnX, LampAY, false);
    Expect(Lit.bBurned && Lit.Step == StepDark, "the straight line stayed dark");
    const FDay Blocked = Tick(Lit, Slice, true, false, true, Far().X, Far().Y, false);
    Expect(Blocked.bBurned && Blocked.Step == StepDark, "a burned crossing reached the south dark");
    const FDay Cleared = Tick(Blocked, Slice, true, false, true, Pocket().X, Pocket().Y, false);
    Expect(!Cleared.bBurned && Cleared.Step == StepDark, "the pocket did not cover the lamp");
    const FDay Held = Tick(Cleared, Slice, true, false, true, Pocket().X, Pocket().Y, true);
    Expect(Held.bBurned && Held.Step == StepDark, "a partner in a lamp left the pocket clear");
    const FDay South = Tick(Cleared, Slice, true, false, true, Far().X, Far().Y, false);
    Expect(South.Step == StepPage && !South.bBurned && Purse(StepDark, South.Step) == 0, "the south dark did not open the page");
    const FDay West = Tick(Dark, Slice, true, false, true, DarkWestX, DarkWestY, false);
    Expect(!West.bBurned, "the west side burned");
    const FDay WestSouth = Tick(West, Slice, true, false, true, Far().X, Far().Y, false);
    Expect(WestSouth.Step == StepPage, "the west side did not reach the south dark");
    const FDay RideDark = Tick(Dark, Slice, false, true, true, Far().X, Far().Y, false);
    Expect(RideDark.Step == StepDark, "a car crossed the dark");

    const FDay Sprinted = RunLine(StepPage, QuebecPace::SprintCmPerSecond, Case().X, Case().Y, Drop().X, Drop().Y);
    Expect(Sprinted.Step == StepCut && Purse(StepPage, Sprinted.Step) == 0, "a sprint missed the page");
    const FDay Walked = RunLine(StepPage, QuebecPace::WalkCmPerSecond, Case().X, Case().Y, Drop().X, Drop().Y);
    Expect(Walked.Step == StepPage && !Walked.bHolding && Purse(StepPage, Walked.Step) == 0, "a walk made the page");
    const FDay SouthWalk = RunLine(StepPage, QuebecPace::WalkCmPerSecond, Case().X, Case().Y - FootReach, Drop().X, Drop().Y + FootReach);
    Expect(SouthWalk.Step == StepPage && !SouthWalk.bHolding, "a walk from the south edge of the page made the drop");
    const FDay SouthSprint = RunLine(StepPage, QuebecPace::SprintCmPerSecond, Case().X, Case().Y - FootReach, Drop().X, Drop().Y + FootReach);
    Expect(SouthSprint.Step == StepCut, "a sprint from the south edge of the page missed the drop");
    const FDay NorthSprint = RunLine(StepPage, QuebecPace::SprintCmPerSecond, Case().X, Case().Y + FootReach, Drop().X, Drop().Y + FootReach);
    Expect(NorthSprint.Step == StepCut, "a sprint from the north edge of the page missed the drop");
    FDay Holding;
    Holding.Step = StepPage;
    Holding.bHolding = true;
    Holding.Elapsed = Window - Slice;
    const FDay Exact = Tick(Holding, Slice, true, false, true, Drop().X, Drop().Y, false);
    Expect(Exact.Step == StepCut, "the last instant of the window shut");
    Holding.Elapsed = Window - 0.01;
    const FDay Late = Tick(Holding, Slice, true, false, true, Drop().X, Drop().Y, false);
    Expect(Late.Step == StepPage && !Late.bHolding, "a late drop still counted");
    FDay Mounted = Holding;
    Mounted.Elapsed = 0.;
    for (int Frame = 0; Frame < 40 && Mounted.bHolding; ++Frame)
        Mounted = Tick(Mounted, Slice, false, true, true, Drop().X, Drop().Y, false);
    Expect(Mounted.Step == StepPage && !Mounted.bHolding, "a rider dropped the page");
    FDay IdlePage;
    IdlePage.Step = StepPage;
    const FDay NoCase = Tick(IdlePage, Slice, false, true, true, Case().X, Case().Y, false);
    Expect(NoCase.Step == StepPage && !NoCase.bHolding, "a rider took the page");

    const FDay GrassSprint = RunLine(StepCut, QuebecPace::SprintCmPerSecond, Line().X, Line().Y, Finish().X, Finish().Y);
    Expect(GrassSprint.Step == StepChase && !GrassSprint.bTailing && Purse(StepCut, GrassSprint.Step) == 0, "a grass sprint lost the cut");
    const FDay GrassWalk = RunLine(StepCut, QuebecPace::WalkCmPerSecond, Line().X, Line().Y, Finish().X, Finish().Y);
    Expect(GrassWalk.Step == StepCut && !GrassWalk.bRacing, "a grass walk beat them");
    const FDay EdgeWalk = RunLine(StepCut, QuebecPace::WalkCmPerSecond, Line().X, Line().Y - FootReach, Finish().X, Finish().Y + FootReach);
    Expect(EdgeWalk.Step == StepCut && !EdgeWalk.bRacing, "a walk from the south edge of the line beat them");
    const FDay EdgeSprint = RunLine(StepCut, QuebecPace::SprintCmPerSecond, Line().X, Line().Y - FootReach, Finish().X, Finish().Y + FootReach);
    Expect(EdgeSprint.Step == StepChase, "a sprint from the south edge of the line lost");
    const FDay FarSprint = RunLine(StepCut, QuebecPace::SprintCmPerSecond, Line().X, Line().Y + FootReach, Finish().X, Finish().Y + FootReach);
    Expect(FarSprint.Step == StepChase, "a sprint from the north edge of the line lost");
    FDay Racing;
    Racing.Step = StepCut;
    Racing.bRacing = true;
    Racing.Elapsed = Road() / RivalCmPerSecond - Slice;
    const FDay Tie = Tick(Racing, Slice, true, false, true, Finish().X, Finish().Y, false);
    Expect(Tie.Step == StepCut && !Tie.bRacing, "a tie at the finish still paid the cut");
    FDay IdleCut;
    IdleCut.Step = StepCut;
    const FDay RideLine = Tick(IdleCut, Slice, false, true, true, Line().X, Line().Y, false);
    Expect(RideLine.Step == StepCut && !RideLine.bRacing, "a rider started the cut");

    const FSpot BendSpot = Bend();
    FDay OnRoad;
    OnRoad.Step = StepCut;
    OnRoad = Tick(OnRoad, Slice, true, false, true, Line().X, Line().Y, false);
    double RoadAlong = 0.;
    const double First = Apart(Line().X, Line().Y, BendSpot.X, BendSpot.Y);
    const double Second = Apart(BendSpot.X, BendSpot.Y, Finish().X, Finish().Y);
    while (OnRoad.bRacing && OnRoad.Step == StepCut && RoadAlong < Road() + 1.)
    {
        RoadAlong += QuebecPace::SprintCmPerSecond * Slice;
        double X = Finish().X;
        double Y = Finish().Y;
        if (RoadAlong <= First)
        {
            const double Portion = First <= 0. ? 1. : RoadAlong / First;
            X = Line().X + (BendSpot.X - Line().X) * Portion;
            Y = Line().Y + (BendSpot.Y - Line().Y) * Portion;
        }
        else if (RoadAlong < First + Second)
        {
            const double Portion = Second <= 0. ? 1. : (RoadAlong - First) / Second;
            X = BendSpot.X + (Finish().X - BendSpot.X) * Portion;
            Y = BendSpot.Y + (Finish().Y - BendSpot.Y) * Portion;
        }
        OnRoad = Tick(OnRoad, Slice, true, false, true, X, Y, false);
    }
    Expect(OnRoad.Step == StepCut && !OnRoad.bRacing, "a sprint on their road beat them");

    bool bDriveCaught = true;
    const FDay Driven = Drive(1800., true, bDriveCaught);
    Expect(!bDriveCaught && Driven.Step == StepBanked, "a drive down the road was caught");
    Expect(Purse(StepChase, Driven.Step) == Pay, "the hide did not pay");
    bool bCrawlCaught = false;
    const FDay Crawled = Drive(400., true, bCrawlCaught);
    Expect(bCrawlCaught && Crawled.Step == StepChase && !Crawled.bTailing, "a crawl reached the hide");
    Expect(Purse(StepChase, Crawled.Step) == 0, "being caught paid");
    bool bStopCaught = false;
    const FDay Stopped = Drive(0., true, bStopCaught);
    Expect(bStopCaught && Stopped.Step == StepChase, "standing still lost the tail");

    const FDay Seated = Tick(Park(), Slice, false, true, true, Door.X, Door.Y, false);
    Expect(Seated.bTailing && Seated.Step == StepChase, "a car on the seat did not start the tail");
    Expect(Purse(StepChase, Seated.Step) == 0, "taking the seat paid");
    const FDay WalkerSeat = Tick(Park(), Slice, true, false, true, Door.X, Door.Y, false);
    Expect(!WalkerSeat.bTailing, "a walker took the seat");
    const FDay Out = Tick(Seated, Slice, true, false, true, Door.X, Door.Y, false);
    Expect(Out.bTailing && Out.Step == StepChase && Apart(Out.TailX, Out.TailY, Seated.TailX, Seated.TailY) > 1., "getting out froze the tail");
    const FDay WalkerHide = Tick(Seated, Slice, true, false, true, End.X, End.Y, false);
    Expect(WalkerHide.Step == StepChase && Purse(StepChase, WalkerHide.Step) == 0, "a walker took the hide");

    FDay Tied = Seated;
    Tied.TailX = End.X;
    Tied.TailY = End.Y;
    const FDay HideTie = Tick(Tied, Slice, false, true, true, End.X, End.Y, false);
    Expect(!HideTie.bTailing && HideTie.Step == StepChase, "a tie at the hide still paid");

    const FDay LongFrame = Tick(Seated, 5., false, true, true, Door.X, Door.Y, false);
    Expect(LongFrame.bTailing && Apart(LongFrame.TailX, LongFrame.TailY, Seated.TailX, Seated.TailY) < TailCmPerSecond * Slice + 1., "a long frame let the tail close the whole gap");
    const FDay Empty = Tick(Seated, Slice, false, false, false, 0., 0., false);
    Expect(std::fabs(Empty.TailX - Seated.TailX) < 1. && std::fabs(Empty.TailY - Seated.TailY) < 1., "an empty street sent the tail to the origin");
    const FDay Done = Tick(Driven, Slice, false, true, true, End.X, End.Y, false);
    Expect(Done.Step == StepBanked && Purse(StepBanked, Done.Step) == 0, "a second pass paid again");

    FDay Kept = Park();
    Kept.bTailing = true;
    Kept.Elapsed = 4.;
    const FDay Fresh = Park();
    Expect(Fresh.Step == StepChase && !Fresh.bTailing && Fresh.Elapsed == 0., "a parked tail kept the clock");
    Expect(Kept.bTailing, "the session tail was cleared by the park helper");

    QuebecStorySave::FSteps Day;
    Day.Pond = QuebecStorySave::PondBanked;
    Day.Court = QuebecStorySave::CourtBanked;
    Day.Show = QuebecStorySave::ShowBanked;
    Day.Rescue = QuebecStorySave::RescueDone;
    Day.Convoy = QuebecStorySave::ConvoyBanked;
    Day.Blank = QuebecStorySave::BlankBanked;
    Day.Tour = QuebecStorySave::TourBanked;
    Day.Home = QuebecStorySave::HomeBanked;
    Day.Escort = QuebecStorySave::EscortBanked;
    Day.Shade = QuebecStorySave::ShadeBanked;
    Day.Grab = QuebecStorySave::GrabBanked;
    Day.Cut = QuebecStorySave::CutBanked;
    Day.Chase = QuebecStorySave::ChaseBanked;
    Day.Finale = StepPage;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Day), "a day in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Chase, 2, Day), "a version-8 slot carried the day");
    const QuebecStorySave::FSteps Applied = QuebecStorySave::Applied(QuebecStorySave::Chase, Day);
    Expect(Applied.Chase == QuebecStorySave::ChaseBanked && Applied.Finale == 0, "a version-8 slot copied the day");
    Day.Finale = StepBanked;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Day), "a finished day was rejected");
    Day.Finale = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Day), "a day past the bank was accepted");
    Day.Finale = StepCut;
    Day.Chase = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Day), "the day started before the tail was lost");
    Expect(StepBanked == QuebecStorySave::FinaleBanked, "the save left the day bank");
    Expect(QuebecStorySave::Chase == 8 && QuebecStorySave::Current == 9 && QuebecStorySave::Cut == 7, "the slot writer left version 9");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
