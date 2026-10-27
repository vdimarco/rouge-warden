// Standalone test for Source/Quebec/QuebecChase.h. Built by Scripts/test_chase.py.

#ifdef QUEBEC_CHASE_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPace.h"
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

using namespace QuebecChase;

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

    double RoadGap(double X, double Y)
    {
        const double DX = RoadEastX - RoadWestX;
        const double DY = RoadEastY - RoadWestY;
        const double Length = DX * DX + DY * DY;
        if (Length < 1e-6) return Apart(X, Y, RoadWestX, RoadWestY);
        double Along = ((X - RoadWestX) * DX + (Y - RoadWestY) * DY) / Length;
        if (Along < 0.) Along = 0.;
        if (Along > 1.) Along = 1.;
        return Apart(X, Y, RoadWestX + Along * DX, RoadWestY + Along * DY);
    }

    void ClearOf(double X, double Y, const char* What)
    {
        Expect(Apart(X, Y, QuebecCut::StartX, QuebecCut::StartY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecCut::FinishX, QuebecCut::FinishY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecCut::BendX, QuebecCut::BendY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecGrab::CaseX, QuebecGrab::CaseY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecGrab::DropX, QuebecGrab::DropY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecShade::PocketX, QuebecShade::PocketY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecShade::FarX, QuebecShade::FarY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecShade::LampAX, QuebecShade::LampAY) > QuebecShade::Lamp + Reach, "%s", What);
        Expect(Apart(X, Y, QuebecShade::LampBX, QuebecShade::LampBY) > QuebecShade::Lamp + Reach, "%s", What);
        Expect(Apart(X, Y, QuebecEscort::MeetX, QuebecEscort::MeetY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecEscort::DoorX, QuebecEscort::DoorY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecRing::GateAX, QuebecRing::GateAY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecScoot::StandX, QuebecScoot::StandY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecCycle::StandX, QuebecCycle::StandY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecTour::BikeX, QuebecTour::BikeY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecCrate::CurbX, QuebecCrate::CurbY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecCrate::ParkX, QuebecCrate::ParkY) > Reach, "%s", What);
        Expect(Apart(X, Y, QuebecStand::Spot.X, QuebecStand::Spot.Y) > QuebecStand::Reach + Reach, "%s", What);
        Expect(Apart(X, Y, QuebecBay::Spot.X, QuebecBay::Spot.Y) > QuebecBay::CarReach, "%s", What);
        Expect(Apart(X, Y, QuebecCombatModel::HospitalX, QuebecCombatModel::HospitalY) > Reach, "%s", What);
        for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers)
            Expect(Apart(X, Y, Spot.X, Spot.Y) > Reach, "%s", What);
        for (const QuebecCombatModel::FAnchor& Anchor : QuebecCombatModel::QAAnchors)
            Expect(Apart(X, Y, Anchor.X, Anchor.Y) > Reach, "%s", What);
    }

    FTail Drive(double Speed, bool bInCar, bool& bCaught)
    {
        FTail Now = Tick(FTail{}, 0.1, true, true, StartX, StartY);
        const double DX = HideX - StartX;
        const double DY = HideY - StartY;
        const double Length = Apart(StartX, StartY, HideX, HideY);
        const double UX = Length <= 0. ? 0. : DX / Length;
        const double UY = Length <= 0. ? 0. : DY / Length;
        double X = StartX;
        double Y = StartY;
        double Along = 0.;
        bCaught = false;
        for (int Frame = 0; Frame < 400 && Now.Step == StepTail; ++Frame)
        {
            Along += Speed * Slice;
            if (Along > Length) Along = Length;
            X = StartX + UX * Along;
            Y = StartY + UY * Along;
            const int Before = Now.Step;
            Now = Tick(Now, Slice, bInCar, true, X, Y);
            if (Now.Step == StepSeat && Before == StepTail)
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
    Expect(StepSeat == 0 && StepTail == 1 && StepBanked == 2, "the steps drifted");
    Expect(Pay == 640 && Reach == 1400. && Catch == 900. && HeadStart == 4500. && Slice == 0.25, "the purse or the gap drifted");
    Expect(TailCmPerSecond == 1100. && TailCmPerSecond > QuebecPace::SprintCmPerSecond, "the tail is no faster than a sprint");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(QuebecCycle::BikeKind) && !CountsAsCar(QuebecScoot::ScootKind), "a bike counted as the car");
    Expect(StartX > 20000. && HideX > 20000. && RecoverX > 20000., "the chase sits on the pond side");
    const double Run = Apart(StartX, StartY, HideX, HideY);
    Expect(Run > 17000. && Run < 19000., "the hide left the straight");
    Expect(RoadGap(StartX, StartY) < 80. && RoadGap(HideX, HideY) < 80., "the doors left the road");
    const FTail Waiting = Park();
    Expect(Waiting.Step == StepSeat && std::fabs(Apart(Waiting.X, Waiting.Y, StartX, StartY) - HeadStart) < 1., "the tail does not wait behind the seat");
    Expect(RoadGap(Waiting.X, Waiting.Y) < 80., "the tail parks off the road");
    Expect(Apart(RecoverX, RecoverY, StartX, StartY) > Reach, "the recover already counts as the seat");
    Expect(Apart(RecoverX, RecoverY, HideX, HideY) > Reach, "the recover already counts as the hide");
    Expect(Apart(Waiting.X, Waiting.Y, RecoverX, RecoverY) > Reach, "the recover stands on the tail's park");
    Expect(!InHide(StartX, StartY) && !InStart(HideX, HideY), "the seat and the hide overlap");
    ClearOf(StartX, StartY, "the seat sits on another door");
    ClearOf(HideX, HideY, "the hide sits on another door");
    ClearOf(Waiting.X, Waiting.Y, "the park sits on another door");
    ClearOf(RecoverX, RecoverY, "the recover sits on another door");

    Expect(!Offers(false, StepSeat), "the chase offered before the short way was banked");
    Expect(Offers(true, StepSeat) && Offers(true, StepTail), "a banked short way did not offer the chase");
    Expect(!Offers(true, StepBanked), "a finished chase stayed open");

    const FTail Seated = Tick(FTail{}, 0.1, false, true, StartX, StartY);
    Expect(Seated.Step == StepSeat, "a walker took the seat");
    const FTail Bike = Tick(FTail{}, 0.1, false, true, StartX, StartY);
    Expect(Bike.Step == StepSeat, "a bike took the seat");
    const FTail Gone = Tick(FTail{}, 5., true, true, StartX + 5000., StartY);
    Expect(Gone.Step == StepSeat, "a car off the line took the seat");
    const FTail Loose = Tick(FTail{}, 0.1, true, true, StartX, StartY);
    Expect(Loose.Step == StepTail && std::fabs(Loose.X - Waiting.X) < 1. && std::fabs(Loose.Y - Waiting.Y) < 1., "the tail did not start behind the seat");
    Expect(Purse(StepSeat, Loose.Step) == 0, "taking the seat paid");

    const FTail LongFrame = Tick(Loose, 5., true, true, StartX, StartY);
    Expect(LongFrame.Step == StepTail && Apart(LongFrame.X, LongFrame.Y, Waiting.X, Waiting.Y) < TailCmPerSecond * Slice + 1., "a long frame let the tail close the whole gap");

    bool bDriveCaught = true;
    const FTail Driven = Drive(1800., true, bDriveCaught);
    Expect(!bDriveCaught && Driven.Step == StepBanked, "a drive down the road was caught");
    Expect(Purse(StepTail, Driven.Step) == Pay, "the hide did not pay");

    bool bCrawlCaught = false;
    const FTail Crawled = Drive(400., true, bCrawlCaught);
    Expect(bCrawlCaught && Crawled.Step == StepSeat, "a crawl reached the hide");
    Expect(Purse(StepTail, Crawled.Step) == 0, "being caught paid");

    bool bStopCaught = false;
    const FTail Stopped = Drive(0., true, bStopCaught);
    Expect(bStopCaught && Stopped.Step == StepSeat, "standing still lost the tail");

    const FTail Walker = Tick(Loose, Slice, false, true, HideX, HideY);
    Expect(Walker.Step == StepTail, "a walker took the hide");
    Expect(Purse(StepTail, Walker.Step) == 0, "a walker was paid");

    FTail Tied = Loose;
    Tied.X = HideX;
    Tied.Y = HideY;
    const FTail Tie = Tick(Tied, Slice, true, true, HideX, HideY);
    Expect(Tie.Step == StepSeat, "a tie at the hide still paid");
    Expect(Purse(StepTail, Tie.Step) == 0, "the tie paid");

    const FTail Empty = Tick(Loose, Slice, false, false, 0., 0.);
    Expect(std::fabs(Empty.X - Loose.X) < 1. && std::fabs(Empty.Y - Loose.Y) < 1., "an empty street sent the tail to the origin");

    const FTail Done = Tick(Driven, Slice, true, true, HideX, HideY);
    Expect(Done.Step == StepBanked && Purse(StepBanked, Done.Step) == 0, "a second pass paid again");

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
    Tail.Cut = QuebecStorySave::CutBanked;
    Tail.Chase = StepTail;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "a chase in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Cut, 2, Tail), "a version-7 slot carried the chase");
    const QuebecStorySave::FSteps Applied = QuebecStorySave::Applied(QuebecStorySave::Cut, Tail);
    Expect(Applied.Cut == QuebecStorySave::CutBanked && Applied.Chase == 0, "a version-7 slot copied the chase");
    Tail.Cut = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Tail), "the chase started before the short way was banked");
    Expect(StepBanked == QuebecStorySave::ChaseBanked, "the save left the chase bank");
    Expect(QuebecStorySave::Chase == 8 && QuebecStorySave::Finale == 9 && QuebecStorySave::Current == 10 && QuebecStorySave::Cut == 7, "the slot writer left version 10");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
