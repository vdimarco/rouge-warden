#ifdef QUEBEC_SLIP_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecSlip.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecNose.h"
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
    using namespace QuebecSlip;
    Expect(StepBanked == 2 && Pay == 500 && CloseCmPerSecond == 640., "the slip left its purse");
    Expect(HeadStart > Catch && Length > Reach * 2. && RecoverNorth > Reach, "the door already counted as caught");
    const FSpot Back = Recover();
    const FSpot Behind = Park();
    const FSpot Out = Gate();
    Expect(Apart(Back.X, Back.Y, DoorX, DoorY) > Reach, "recover stands in the door");
    Expect(Apart(DoorX, DoorY, Out.X, Out.Y) > Reach * 2., "the gate overlaps the door");
    Expect(Apart(DoorX, DoorY, QuebecChase::StartX, QuebecChase::StartY) > 2500., "the slip sat on the tail");
    const QuebecNose::FSpot Stall = QuebecNose::Stall();
    Expect(Apart(DoorX, DoorY, Stall.X, Stall.Y) > 2500., "the slip sat on the stall");
    Expect(Apart(DoorX, DoorY, QuebecSend::ColumnX, QuebecSend::DoorY) > 2500., "the slip sat on the send-off");
    Expect(Offers(true, StepDoor) && Offers(true, StepRun) && !Offers(true, StepBanked) && !Offers(false, StepDoor), "the slip opened early");

    FRun Now;
    const FRun Car = Tick(Now, Slice, false, DoorX, DoorY);
    Expect(Car.Step == StepDoor && !Car.bCaught, "a car opened the door");
    const FRun Started = Tick(Now, Slice, true, DoorX, DoorY);
    Expect(Started.Step == StepRun && !Started.bCaught && std::fabs(Started.Y - Behind.Y) < 1., "stepping out did not start the chase");
    const FRun Later = Tick(Started, Slice, true, Out.X, Out.Y);
    Expect(Later.Step == StepBanked && !Later.bCaught, "a clear gap at the gate stayed open");

    FRun Hold = Started;
    const FRun Empty = Tick(Hold, Slice, false, Out.X, Out.Y);
    Expect(Empty.Step == StepRun && std::fabs(Empty.Y - Started.Y) < 1., "an empty lawn moved them");
    const FRun LongFrame = Tick(Hold, 5., true, DoorX, DoorY - 100.);
    const double Closed = CloseCmPerSecond * Slice;
    Expect(std::fabs(Apart(LongFrame.X, LongFrame.Y, DoorX, DoorY - 100.) - (HeadStart + 100. - Closed)) < 2., "one long frame closed the whole lawn");

    FRun Walk = Started;
    double WalkY = DoorY;
    bool bWalkCaught = false;
    for (int I = 0; I < 80 && Walk.Step == StepRun; ++I)
    {
        WalkY -= 450. * Slice;
        Walk = Tick(Walk, Slice, true, DoorX, WalkY);
        if (Walk.bCaught) bWalkCaught = true;
    }
    Expect(bWalkCaught && Walk.Step == StepDoor && WalkY > Out.Y && Purse(StepRun, Walk.Step) == 0, "a walk reached the gate");

    FRun Sprint = Started;
    double SprintY = DoorY;
    bool bSprintCaught = false;
    for (int I = 0; I < 80 && Sprint.Step == StepRun; ++I)
    {
        SprintY -= 800. * Slice;
        Sprint = Tick(Sprint, Slice, true, DoorX, SprintY);
        if (Sprint.bCaught) bSprintCaught = true;
    }
    Expect(!bSprintCaught && Sprint.Step == StepBanked && Purse(StepRun, Sprint.Step) == Pay, "a sprint did not lose them");
    const FRun Twice = Tick(Sprint, Slice, true, Out.X, Out.Y);
    Expect(Twice.Step == StepBanked && Purse(StepBanked, Twice.Step) == 0, "the slip paid twice");

    FRun Still = Started;
    bool bStill = false;
    for (int I = 0; I < 20 && Still.Step == StepRun; ++I)
    {
        Still = Tick(Still, Slice, true, DoorX, DoorY);
        if (Still.bCaught) bStill = true;
    }
    Expect(bStill && Still.Step == StepDoor, "standing still lost them");
    const FRun GateWhileDoor = Tick(Still, Slice, true, Out.X, Out.Y);
    Expect(GateWhileDoor.Step == StepDoor, "the gate cleared before the door");

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
    Saved.Slip = 0;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a finished stall was rejected");
    Saved.Slip = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Nose, 2, Saved), "a version-16 slot carried the slip");
    const QuebecStorySave::FSteps FromNose = QuebecStorySave::Applied(QuebecStorySave::Nose, Saved);
    Expect(FromNose.Nose == QuebecStorySave::NoseBanked && FromNose.Slip == 0, "a version-16 slot copied the slip");
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a slip in progress was rejected");
    Saved.Slip = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a slip past the bank was accepted");
    Saved.Slip = 1;
    Saved.Nose = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the slip started before the stall was banked");
    Expect(QuebecStorySave::Nose == 16 && QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Bolt == 21 && QuebecStorySave::Current == 22 && QuebecStorySave::Pursue == 15, "the slot writer left version 22");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
