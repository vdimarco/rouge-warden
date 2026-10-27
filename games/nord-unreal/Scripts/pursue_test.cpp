#ifdef QUEBEC_PURSUE_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecPursue.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecBlock.h"
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
    using namespace QuebecPursue;
    Expect(StepBanked == 1 && Pay == 460 && CruiseCmPerSecond == 650., "the pursuit left its purse");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(2) && !CountsAsCar(3), "a bike counted as the chasing car");
    Expect(HeadStart > Catch && Length() > 10000., "the head start sat inside the catch");
    Expect(CruiseCmPerSecond > 450. && CruiseCmPerSecond < QuebecBlock::CourierCmPerSecond, "the traffic car left the cruise");
    const FSpot Start = Place(0.);
    const FSpot Ahead = Place(HeadStart);
    Expect(Apart(Start.X, Start.Y, Ahead.X, Ahead.Y) > Catch, "the seat already counts as alongside");
    const FSpot Back = Recover();
    Expect(Apart(Back.X, Back.Y, Ahead.X, Ahead.Y) > Catch, "recover stands in the catch");
    Expect(Apart(Start.X, Start.Y, QuebecChase::StartX, QuebecChase::StartY) > 2500., "the pursuit sat on the tail");
    Expect(Apart(Start.X, Start.Y, QuebecBlock::RoadAx, QuebecBlock::RoadAy) > 2500., "the pursuit sat on the courier");
    Expect(Offers(true, StepHunt) && !Offers(true, StepBanked) && !Offers(false, StepHunt), "the pursuit opened early");

    FRun Now;
    Now.Along = HeadStart;
    const FRun Empty = Tick(Now, Slice, true, false, Ahead.X, Ahead.Y);
    Expect(std::fabs(Empty.Along - HeadStart) < 1. && Empty.Step == StepHunt, "an empty avenue moved the traffic car");
    const FRun LongFrame = Tick(Now, 5., false, true, Start.X, Start.Y);
    Expect(std::fabs(LongFrame.Along - (HeadStart + CruiseCmPerSecond * Slice)) < 1. && LongFrame.Step == StepHunt, "one long frame drove the avenue");
    const FRun Walker = Tick(Now, Slice, false, true, Ahead.X, Ahead.Y);
    Expect(Walker.Step == StepHunt && Walker.Along > HeadStart && Purse(StepHunt, Walker.Step) == 0, "a walker caught the traffic car");
    const FRun Far = Tick(Now, Slice, true, true, Start.X, Start.Y);
    Expect(Far.Step == StepHunt && !Far.bGone, "a car at the seat caught them");

    const FSpot Soon = Place(HeadStart + CruiseCmPerSecond * Slice);
    const FRun Caught = Tick(Now, Slice, true, true, Soon.X, Soon.Y);
    Expect(Caught.Step == StepBanked && !Caught.bGone && Purse(StepHunt, Caught.Step) == Pay, "pulling alongside did not catch the car");
    const FRun Twice = Tick(Caught, Slice, true, true, Soon.X, Soon.Y);
    Expect(Twice.Step == StepBanked && Purse(StepBanked, Twice.Step) == 0, "the pursuit paid twice");

    FRun Late = Now;
    Late.Along = Length() - 10.;
    const FRun Gone = Tick(Late, Slice, true, true, RoadBx, RoadBy);
    Expect(Gone.bGone && Gone.Step == StepHunt && std::fabs(Gone.Along - HeadStart) < 1. && Purse(StepHunt, Gone.Step) == 0, "the end of the avenue kept the catch");

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
    Saved.Pursue = 0;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a finished send-off was rejected");
    Saved.Pursue = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Send, 2, Saved), "a version-14 slot carried the pursuit");
    const QuebecStorySave::FSteps FromSend = QuebecStorySave::Applied(QuebecStorySave::Send, Saved);
    Expect(FromSend.Send == QuebecStorySave::SendBanked && FromSend.Pursue == 0, "a version-14 slot copied the pursuit");
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a pursuit in progress was rejected");
    Saved.Pursue = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a pursuit past the bank was accepted");
    Saved.Pursue = 1;
    Saved.Send = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the pursuit started before the send-off was banked");
    Expect(QuebecStorySave::Send == 14 && QuebecStorySave::Current == 15 && QuebecStorySave::Block == 13, "the slot writer left version 15");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
