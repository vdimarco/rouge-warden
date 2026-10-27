#ifdef QUEBEC_DITCH_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecDitch.h"
#include "../Source/Quebec/QuebecMarch.h"
#include "../Source/Quebec/QuebecSlip.h"
#include "../Source/Quebec/QuebecNose.h"
#include "../Source/Quebec/QuebecPursue.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecBlock.h"
#include "../Source/Quebec/QuebecSend.h"
#include "../Source/Quebec/QuebecStorySave.h"

#include <cmath>
#include <cstdio>

namespace
{
    int Assertions = 0;
    int Failures = 0;

    void Expect(bool Condition, const char* What)
    {
        ++Assertions;
        if (!Condition)
        {
            ++Failures;
            std::fprintf(stderr, "FAIL %s\n", What);
        }
    }
}

int main()
{
    using namespace QuebecDitch;
    const double Whole = Length();
    const double UX = (RoadBx - RoadAx) / Whole;
    const double UY = (RoadBy - RoadAy) / Whole;
    const FSpot Mark = Line();
    const FSpot Stop = End();
    const FSpot Clear = Foot();
    const FSpot Back = Recover();
    Expect(StepBanked == 3 && Pay == 660 && ChaseCmPerSecond == 900. && RollMin == 500., "the ditch left its purse");
    Expect(Whole > 8000. && EndAlong() - LineAlong > Reach * 4. && RecoverBack > Reach && FootSide > Reach, "the line already counted as the end");
    Expect(Apart(Back.X, Back.Y, Mark.X, Mark.Y) > Reach, "recover stands on the line");
    Expect(Apart(Stop.X, Stop.Y, Clear.X, Clear.Y) > Reach, "the clear mark stands in the end");
    Expect(Apart(Mark.X, Mark.Y, QuebecMarch::ColumnX, QuebecMarch::StartY) > 2500., "the ditch sat on the march");
    Expect(Apart(Mark.X, Mark.Y, QuebecSlip::DoorX, QuebecSlip::DoorY) > 2500., "the ditch sat on the slip");
    const QuebecNose::FSpot Stall = QuebecNose::Stall();
    Expect(Apart(Mark.X, Mark.Y, Stall.X, Stall.Y) > 2500., "the ditch sat on the stall");
    const QuebecPursue::FSpot Avenue = QuebecPursue::Place(0.);
    Expect(Apart(Mark.X, Mark.Y, Avenue.X, Avenue.Y) > 2500., "the ditch sat on the pursuit");
    Expect(Apart(Mark.X, Mark.Y, QuebecChase::StartX, QuebecChase::StartY) > 2500., "the ditch sat on the tail");
    Expect(Apart(Mark.X, Mark.Y, QuebecBlock::RoadAx, QuebecBlock::RoadAy) > 2500., "the ditch sat on the block");
    Expect(Apart(Mark.X, Mark.Y, QuebecSend::ColumnX, QuebecSend::DoorY) > 2500., "the ditch sat on the send-off");
    Expect(Offers(true, StepRoll) && Offers(true, StepLead) && Offers(true, StepFoot) && !Offers(true, StepBanked) && !Offers(false, StepRoll), "the ditch opened early");

    FRun Now;
    const FRun Walker = Tick(Now, Slice, false, true, 0., UX, UY, Mark.X, Mark.Y);
    Expect(Walker.Step == StepRoll && !Walker.bCaught, "a walker crossed the line");
    const FRun Stopped = Tick(Now, Slice, true, false, 0., UX, UY, Mark.X, Mark.Y);
    Expect(Stopped.Step == StepRoll, "a stop crossed the line");
    const FRun Backed = Tick(Now, Slice, true, false, -600., UX, UY, Mark.X, Mark.Y);
    Expect(Backed.Step == StepRoll, "a reverse crossed the line");
    const FRun Sideways = Tick(Now, Slice, true, false, 800., -UY, UX, Mark.X, Mark.Y);
    Expect(Sideways.Step == StepRoll, "a sideways nose crossed the line");
    const FRun Started = Tick(Now, Slice, true, false, RollMin, UX, UY, Mark.X, Mark.Y);
    Expect(Started.Step == StepLead && !Started.bCaught && std::fabs(Started.Along) < 1., "a rolling car did not start them");

    FRun Hold = Started;
    const FHit AtLine = Project(Mark.X, Mark.Y);
    const FRun LongFrame = Tick(Hold, 5., true, false, 1200., UX, UY, Mark.X, Mark.Y);
    Expect(std::fabs(LongFrame.Along - ChaseCmPerSecond * Slice) < 1. && LongFrame.Step == StepLead, "one long frame drove the whole road");
    Expect(AtLine.Along > LineAlong - 1. && AtLine.Lateral < 1., "the line left the road");

    FRun Fast = Started;
    double FastAlong = LineAlong;
    bool bFastCaught = false;
    for (int I = 0; I < 80 && Fast.Step == StepLead; ++I)
    {
        FastAlong += 1200. * Slice;
        const FSpot Spot = Place(FastAlong);
        Fast = Tick(Fast, Slice, true, false, 1200., UX, UY, Spot.X, Spot.Y);
        if (Fast.bCaught) bFastCaught = true;
    }
    Expect(!bFastCaught && Fast.Step == StepFoot && Fast.Along + Catch < EndAlong(), "a drive did not beat them to the end");
    const FSpot ClearSpot = Foot();
    const FRun StillCar = Tick(Fast, Slice, true, false, 0., UX, UY, ClearSpot.X, ClearSpot.Y);
    Expect(StillCar.Step == StepFoot, "a car cleared the mark");
    const FRun Done = Tick(Fast, Slice, false, true, 0., UX, UY, ClearSpot.X, ClearSpot.Y);
    Expect(Done.Step == StepBanked && Purse(StepFoot, Done.Step) == Pay, "stepping clear did not finish the ditch");
    const FRun Twice = Tick(Done, Slice, false, true, 0., UX, UY, ClearSpot.X, ClearSpot.Y);
    Expect(Twice.Step == StepBanked && Purse(StepBanked, Twice.Step) == 0, "the ditch paid twice");

    FRun Slow = Started;
    double SlowAlong = LineAlong;
    bool bSlowCaught = false;
    for (int I = 0; I < 80 && Slow.Step == StepLead; ++I)
    {
        SlowAlong += 400. * Slice;
        const FSpot Spot = Place(SlowAlong);
        Slow = Tick(Slow, Slice, true, false, 400., UX, UY, Spot.X, Spot.Y);
        if (Slow.bCaught) bSlowCaught = true;
    }
    Expect(bSlowCaught && Slow.Step == StepRoll && SlowAlong < EndAlong() && Purse(StepLead, Slow.Step) == 0, "a crawl beat them to the end");

    FRun Wide = Started;
    const FSpot Off = Place(LineAlong + 400.);
    const FRun Left = Tick(Wide, Slice, true, false, 1200., UX, UY, Off.X - UY * 2000., Off.Y + UX * 2000.);
    Expect(Left.bCaught && Left.Step == StepRoll, "leaving the road stayed ahead");

    const FRun Early = Tick(Slow, Slice, false, true, 0., UX, UY, ClearSpot.X, ClearSpot.Y);
    Expect(Early.Step == StepRoll, "the mark cleared before the chase");

    QuebecStorySave::FSteps Saved;
    Saved.Pond = QuebecStorySave::PondBanked;
    Saved.Court = QuebecStorySave::CourtBanked;
    Saved.Show = QuebecStorySave::ShowBanked;
    Saved.Rescue = QuebecStorySave::RescueDone;
    Saved.Convoy = QuebecStorySave::ConvoyBanked;
    Saved.Blank = QuebecStorySave::BlankBanked;
    Saved.Tour = QuebecStorySave::TourBanked;
    Saved.Home = QuebecStorySave::HomeBanked;
    Saved.Escort = QuebecStorySave::EscortBanked;
    Saved.Shade = QuebecStorySave::ShadeBanked;
    Saved.Grab = QuebecStorySave::GrabBanked;
    Saved.Cut = QuebecStorySave::CutBanked;
    Saved.Chase = QuebecStorySave::ChaseBanked;
    Saved.Finale = QuebecStorySave::FinaleBanked;
    Saved.Follow = QuebecStorySave::FollowBanked;
    Saved.Roll = QuebecStorySave::RollBanked;
    Saved.Bell = QuebecStorySave::BellBanked;
    Saved.Block = QuebecStorySave::BlockBanked;
    Saved.Send = QuebecStorySave::SendBanked;
    Saved.Pursue = QuebecStorySave::PursueBanked;
    Saved.Nose = QuebecStorySave::NoseBanked;
    Saved.Slip = QuebecStorySave::SlipBanked;
    Saved.March = QuebecStorySave::MarchBanked;
    Saved.Ditch = 0;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a finished march was rejected");
    Saved.Ditch = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::March, 2, Saved), "a version-18 slot carried the ditch");
    const QuebecStorySave::FSteps FromMarch = QuebecStorySave::Applied(QuebecStorySave::March, Saved);
    Expect(FromMarch.March == QuebecStorySave::MarchBanked && FromMarch.Ditch == 0, "a version-18 slot copied the ditch");
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a ditch in progress was rejected");
    Saved.Ditch = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a ditch past the bank was accepted");
    Saved.Ditch = 1;
    Saved.March = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the ditch started before the march was banked");
    Expect(QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Bolt == 21 && QuebecStorySave::Current == 22 && QuebecStorySave::Slip == 17, "the slot writer left version 22");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
