#ifdef QUEBEC_BLOCK_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBlock.h"
#include "../Source/Quebec/QuebecBells.h"
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
    using namespace QuebecBlock;
    Expect(StepBanked == 2 && Pay == 380, "the block left its purse");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(2) && !CountsAsCar(3), "a bike counted as the blocking car");
    Expect(CourierCmPerSecond == 1400., "the courier left a firm city drive");
    const double Whole = Length();
    const double Need = BlockAlong();
    const FSpot Mark = Place(Need);
    Expect(std::fabs(Mark.X - BlockX) < 1. && std::fabs(Mark.Y - BlockY) < 1., "the block left the courier road");
    Expect(Need > 10000. && Need < Whole, "the block left the far half of the road");
    const double SideGap = Apart(SideX, SideY, BlockX, BlockY);
    Expect(SideGap > Reach * 2. && Need > SideGap * 3., "the side street is not the short way");
    Expect(!InSide(BlockX, BlockY) && !InBlock(SideX, SideY), "the side street sits in the block");
    Expect(!InSide(RecoverX, RecoverY) && !InBlock(RecoverX, RecoverY), "recover stands in a circle");
    Expect(Apart(BlockX, BlockY, QuebecChase::StartX, QuebecChase::StartY) > 8000., "the block sat on the tail");
    Expect(Apart(SideX, SideY, QuebecBells::BellX, QuebecBells::BellOneY) > 8000., "the side street sat on the bells");
    Expect(Offers(true, StepSide) && Offers(true, StepRun) && !Offers(true, StepBanked) && !Offers(false, StepSide), "the block opened early");

    FRun Now;
    const FRun Foot = Tick(Now, Slice, false, true, true, false);
    Expect(Foot.Step == StepSide && Foot.Along == 0. && !Foot.bPassed, "a walker started the courier");
    const FRun Waiting = Tick(Now, Slice, true, true, false, true);
    Expect(Waiting.Step == StepSide && !Waiting.bPassed, "a car at the block started them early");
    const FRun Started = Tick(Now, Slice, true, true, true, false);
    Expect(Started.Step == StepRun && Started.Along == 0. && !Started.bPassed && Purse(StepSide, Started.Step) == 0, "the side street did not start the run");

    const FRun Held = Tick(Started, Slice, true, true, false, false);
    Expect(std::fabs(Held.Along - CourierCmPerSecond * Slice) < 1. && Held.Step == StepRun, "the courier did not take the long road");
    const FRun LongFrame = Tick(Started, 5., true, true, false, false);
    Expect(std::fabs(LongFrame.Along - CourierCmPerSecond * Slice) < 1., "one long frame drove the whole road");
    const FRun Empty = Tick(Held, Slice, false, false, false, false);
    Expect(std::fabs(Empty.Along - Held.Along) < 1. && Empty.Step == StepRun, "an empty road moved the courier");

    FRun Rolling = Started;
    const FRun Cut = Tick(Rolling, Slice, true, true, false, true);
    Expect(Cut.Step == StepBanked && !Cut.bPassed && Purse(StepRun, Cut.Step) == Pay, "a car on the block did not stop them");
    const FRun Again = Tick(Cut, Slice, true, true, false, true);
    Expect(Again.Step == StepBanked && Purse(StepBanked, Again.Step) == 0, "the block paid twice");

    const FRun Bike = Tick(Held, Slice, false, true, false, true);
    Expect(Bike.Step == StepRun && !Bike.bPassed && Bike.Along > Held.Along, "a bike blocked the road");

    int Ticks = 0;
    FRun Late = Started;
    while (Late.Step == StepRun && Ticks < 80)
    {
        Late = Tick(Late, Slice, true, true, false, false);
        ++Ticks;
    }
    Expect(Late.bPassed && Late.Step == StepSide && Late.Along == 0. && Ticks > 20 && Purse(StepRun, Late.Step) == 0, "a missed block did not send the side street back");

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
    Saved.Block = 1;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a block in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Bell, 2, Saved), "a version-12 slot carried the block");
    const QuebecStorySave::FSteps FromBell = QuebecStorySave::Applied(QuebecStorySave::Bell, Saved);
    Expect(FromBell.Bell == QuebecStorySave::BellBanked && FromBell.Block == 0, "a version-12 slot copied the block");
    Saved.Block = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a block past the bank was accepted");
    Saved.Block = 1;
    Saved.Bell = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the block started before the bells were banked");
    Expect(QuebecStorySave::Bell == 12 && QuebecStorySave::Block == 13 && QuebecStorySave::Send == 14 && QuebecStorySave::Pursue == 15 && QuebecStorySave::Nose == 16 && QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Current == 20 && QuebecStorySave::Roll == 11, "the slot writer left version 20");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
