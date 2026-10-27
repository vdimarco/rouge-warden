#ifdef QUEBEC_MARCH_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecMarch.h"
#include "../Source/Quebec/QuebecSlip.h"
#include "../Source/Quebec/QuebecNose.h"
#include "../Source/Quebec/QuebecSend.h"
#include "../Source/Quebec/QuebecChase.h"
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
    using namespace QuebecMarch;
    Expect(StepBanked == 3 && Pay == 580 && MarchCmPerSecond == 450., "the march left its purse");
    Expect(Length > Reach * 4. && OutPast > Reach && RecoverNorth > Reach, "the join already counted as the end");
    const FSpot Back = Recover();
    const FSpot Stop = End();
    const FSpot Out = Leave();
    Expect(Apart(Back.X, Back.Y, ColumnX, StartY) > Reach, "recover stands in the join");
    Expect(Apart(ColumnX, StartY, Stop.X, Stop.Y) > Reach * 2., "the end overlaps the join");
    Expect(Apart(Stop.X, Stop.Y, Out.X, Out.Y) > Reach, "the step-out stands in the march");
    Expect(Apart(ColumnX, StartY, QuebecSlip::DoorX, QuebecSlip::DoorY) > 2500., "the march sat on the slip");
    const QuebecNose::FSpot Stall = QuebecNose::Stall();
    Expect(Apart(ColumnX, StartY, Stall.X, Stall.Y) > 2500., "the march sat on the stall");
    Expect(Apart(ColumnX, StartY, QuebecSend::ColumnX, QuebecSend::DoorY) > 2500., "the march sat on the send-off");
    Expect(Apart(ColumnX, StartY, QuebecChase::StartX, QuebecChase::StartY) > 2500., "the march sat on the tail");
    Expect(Offers(true, StepJoin) && Offers(true, StepMarch) && Offers(true, StepLeave) && !Offers(true, StepBanked) && !Offers(false, StepJoin), "the march opened early");

    FRun Now;
    const FRun Car = Tick(Now, Slice, false, ColumnX, StartY);
    Expect(Car.Step == StepJoin && !Car.bLeft, "a car joined the march");
    const FRun Started = Tick(Now, Slice, true, ColumnX, StartY);
    Expect(Started.Step == StepMarch && !Started.bLeft && std::fabs(Started.Y - StartY) < 1., "stepping in did not start the march");
    const FRun SameFrame = Tick(Now, Slice, true, Out.X, Out.Y);
    Expect(SameFrame.Step == StepJoin, "the step-out cleared before the join");

    FRun Hold = Started;
    const FRun LongFrame = Tick(Hold, 5., true, ColumnX, StartY);
    Expect(std::fabs(LongFrame.Y - (StartY - MarchCmPerSecond * Slice)) < 1. && LongFrame.Step == StepMarch, "one long frame walked the whole lawn");

    FRun Walk = Started;
    double WalkY = StartY;
    bool bWalkLeft = false;
    for (int I = 0; I < 80 && Walk.Step == StepMarch; ++I)
    {
        WalkY -= 450. * Slice;
        Walk = Tick(Walk, Slice, true, ColumnX, WalkY);
        if (Walk.bLeft) bWalkLeft = true;
    }
    Expect(!bWalkLeft && Walk.Step == StepLeave && std::fabs(Walk.Y - Stop.Y) < 1., "a walk did not stay inside");
    double LeaveY = WalkY;
    FRun Done = Walk;
    for (int I = 0; I < 40 && Done.Step == StepLeave; ++I)
    {
        LeaveY -= 450. * Slice;
        Done = Tick(Done, Slice, true, ColumnX, LeaveY);
    }
    Expect(Done.Step == StepBanked && Purse(StepLeave, Done.Step) == Pay, "stepping out did not finish the march");
    const FRun Twice = Tick(Done, Slice, true, Out.X, Out.Y);
    Expect(Twice.Step == StepBanked && Purse(StepBanked, Twice.Step) == 0, "the march paid twice");

    FRun Sprint = Started;
    double SprintY = StartY;
    bool bSprintLeft = false;
    for (int I = 0; I < 40 && Sprint.Step == StepMarch; ++I)
    {
        SprintY -= 800. * Slice;
        Sprint = Tick(Sprint, Slice, true, ColumnX, SprintY);
        if (Sprint.bLeft) bSprintLeft = true;
    }
    Expect(bSprintLeft && Sprint.Step == StepJoin && SprintY > Stop.Y && Purse(StepMarch, Sprint.Step) == 0, "a sprint stayed inside");

    FRun Still = Started;
    bool bStill = false;
    for (int I = 0; I < 20 && Still.Step == StepMarch; ++I)
    {
        Still = Tick(Still, Slice, true, ColumnX, StartY);
        if (Still.bLeft) bStill = true;
    }
    Expect(bStill && Still.Step == StepJoin, "standing still stayed inside");
    const FRun AfterLeave = Tick(Still, Slice, true, Out.X, Out.Y);
    Expect(AfterLeave.Step == StepJoin, "the step-out cleared before the march");

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
    Saved.March = 0;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a finished slip was rejected");
    Saved.March = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Slip, 2, Saved), "a version-17 slot carried the march");
    const QuebecStorySave::FSteps FromSlip = QuebecStorySave::Applied(QuebecStorySave::Slip, Saved);
    Expect(FromSlip.Slip == QuebecStorySave::SlipBanked && FromSlip.March == 0, "a version-17 slot copied the march");
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a march in progress was rejected");
    Saved.March = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a march past the bank was accepted");
    Saved.March = 1;
    Saved.Slip = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the march started before the slip was banked");
    Expect(QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Current == 20 && QuebecStorySave::Nose == 16, "the slot writer left version 20");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
