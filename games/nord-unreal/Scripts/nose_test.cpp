#ifdef QUEBEC_NOSE_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecNose.h"
#include "../Source/Quebec/QuebecSend.h"
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
    using namespace QuebecNose;
    Expect(StepBanked == 1 && Pay == 440 && ReverseMin == 400. && Align == 0.55, "the stall left its purse");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(2) && !CountsAsCar(3), "a bike counted as the backing car");
    Expect(ReverseMin > QuebecSend::Crawl && RecoverAhead > Reach && Length() > 7000., "the line-up sat in the stall");
    Expect(StallAlong + RecoverAhead + 1000. < Length(), "the line-up ran off the road");
    const FSpot Mark = Stall();
    const FSpot Line = Recover();
    const FSpot Out = Outward();
    Expect(Apart(Mark.X, Mark.Y, Line.X, Line.Y) > Reach, "recover stands in the stall");
    Expect(Apart(Mark.X, Mark.Y, QuebecPursue::RoadAx, QuebecPursue::RoadAy) > 2500., "the stall sat on the traffic avenue");
    Expect(Apart(Mark.X, Mark.Y, QuebecChase::StartX, QuebecChase::StartY) > 2500., "the stall sat on the tail");
    Expect(Apart(Mark.X, Mark.Y, QuebecBlock::RoadAx, QuebecBlock::RoadAy) > 2500., "the stall sat on the courier");
    Expect(Apart(Mark.X, Mark.Y, QuebecSend::ColumnX, QuebecSend::DoorY) > 2500., "the stall sat on the send-off");
    Expect(Offers(true, StepBack) && !Offers(true, StepBanked) && !Offers(false, StepBack), "the stall opened early");

    FRun Now;
    const FRun Walker = Tick(Now, false, Mark.X, Mark.Y, -ReverseMin, Out.X, Out.Y);
    Expect(Walker.Step == StepBack && !Walker.bIn && Purse(StepBack, Walker.Step) == 0, "a walker backed into the stall");
    const FRun Forward = Tick(Now, true, Mark.X, Mark.Y, ReverseMin, Out.X, Out.Y);
    Expect(Forward.Step == StepBack && !Forward.bIn, "a forward roll backed into the stall");
    const FRun Stopped = Tick(Now, true, Mark.X, Mark.Y, 0., Out.X, Out.Y);
    Expect(Stopped.Step == StepBack, "a stop backed into the stall");
    const FRun Creep = Tick(Now, true, Mark.X, Mark.Y, -(ReverseMin - 1.), Out.X, Out.Y);
    Expect(Creep.Step == StepBack, "a crawl backed into the stall");
    const FRun OutwardNose = Tick(Now, true, Mark.X, Mark.Y, -ReverseMin, -Out.X, -Out.Y);
    Expect(OutwardNose.Step == StepBack, "backing out of the stall counted");
    const FRun Sideways = Tick(Now, true, Mark.X, Mark.Y, -ReverseMin, -Out.Y, Out.X);
    Expect(Sideways.Step == StepBack, "a sideways reverse backed into the stall");
    const FRun NoNose = Tick(Now, true, Mark.X, Mark.Y, -ReverseMin, 0., 0.);
    Expect(NoNose.Step == StepBack, "a car with no nose backed into the stall");
    const FSpot Perp{-Out.Y, Out.X};
    const FRun Shallow = Tick(Now, true, Mark.X, Mark.Y, -ReverseMin, Out.X * 0.5 + Perp.X * 0.8660254037844386, Out.Y * 0.5 + Perp.Y * 0.8660254037844386);
    Expect(Shallow.Step == StepBack, "a shallow nose backed into the stall");
    const FRun Missed = Tick(Now, true, Line.X, Line.Y, -ReverseMin, Out.X, Out.Y);
    Expect(Missed.Step == StepBack, "the line-up counted as the stall");

    const FRun In = Tick(Now, true, Mark.X, Mark.Y, -ReverseMin, Out.X, Out.Y);
    Expect(In.Step == StepBanked && In.bIn && Purse(StepBack, In.Step) == Pay, "backing in did not bank the stall");
    const FRun Twice = Tick(In, true, Mark.X, Mark.Y, -ReverseMin, Out.X, Out.Y);
    Expect(Twice.Step == StepBanked && Purse(StepBanked, Twice.Step) == 0, "the stall paid twice");

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
    Saved.Nose = 0;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a finished pursuit was rejected");
    Saved.Nose = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Pursue, 2, Saved), "a version-15 slot carried the stall");
    const QuebecStorySave::FSteps FromPursue = QuebecStorySave::Applied(QuebecStorySave::Pursue, Saved);
    Expect(FromPursue.Pursue == QuebecStorySave::PursueBanked && FromPursue.Nose == 0, "a version-15 slot copied the stall");
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a stall in progress was rejected");
    Saved.Nose = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a stall past the bank was accepted");
    Saved.Nose = 1;
    Saved.Pursue = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the stall started before the pursuit was banked");
    Expect(QuebecStorySave::Pursue == 15 && QuebecStorySave::Nose == 16 && QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Bolt == 21 && QuebecStorySave::Yard == 22 && QuebecStorySave::Lift == 23 && QuebecStorySave::Post == 24 && QuebecStorySave::Current == 25 && QuebecStorySave::Send == 14, "the slot writer left version 25");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
