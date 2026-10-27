#ifdef QUEBEC_BELLS_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBells.h"
#include "../Source/Quebec/QuebecFollow.h"
#include "../Source/Quebec/QuebecRoll.h"
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
    using namespace QuebecBells;
    Expect(StepBanked == 3 && Count == 3, "the order lost a bell");
    Expect(Pay == 340, "the last bell left its purse");
    Expect(Reach == 450. && RecoverNorth > Reach, "recover stands inside the first bell");
    Expect(BellOneY - BellTwoY == 3000. && BellTwoY - BellThreeY == 3000., "the bells left their spacing");
    Expect(Reach * 2. < BellOneY - BellTwoY, "two bells share a circle");
    Expect(std::fabs(Bell(0).X - BellX) < 1. && std::fabs(Bell(0).Y - BellOneY) < 1., "the north bell moved");
    Expect(std::fabs(Bell(1).Y - BellTwoY) < 1. && std::fabs(Bell(2).Y - BellThreeY) < 1., "the later bells moved");
    Expect(!InBell(0, Bell(1).X, Bell(1).Y) && !InBell(1, Bell(2).X, Bell(2).Y), "a neighbour counted as this bell");
    const FSpot Back = Recover(StepOne);
    Expect(!InBell(0, Back.X, Back.Y) && !InBell(1, Back.X, Back.Y), "recover stands in a bell");
    Expect(Gap(BellX, BellOneY, QuebecFollow::CornerX, QuebecFollow::CornerY) > 2500., "the bells sat on the follow");
    Expect(Gap(BellX, BellOneY, QuebecRoll::StartX, QuebecRoll::StartY) > 2500., "the bells sat on the cart");
    Expect(Offers(true, StepOne) && Offers(true, StepThree) && !Offers(true, StepBanked) && !Offers(false, StepOne), "the order opened early");

    FRing Now;
    const FRing First = Tick(Now, true, true, false);
    Expect(First.Step == StepTwo && !First.bEarly && Purse(StepOne, First.Step) == 0, "the north bell did not take");
    const FRing Skipped = Tick(Now, true, false, true);
    Expect(Skipped.bEarly && Skipped.Step == StepOne && Purse(StepOne, Skipped.Step) == 0, "an early bell advanced the order");
    const FRing Car = Tick(Now, false, true, false);
    Expect(Car.Step == StepOne && !Car.bEarly, "a car rang the bell");
    const FRing Empty = Tick(Now, false, false, false);
    Expect(Empty.Step == StepOne && !Empty.bEarly, "an empty lawn rang a bell");

    Now = First;
    const FRing EarlyMid = Tick(Now, true, false, true);
    Expect(EarlyMid.bEarly && EarlyMid.Step == StepOne, "a wrong second bell kept the first");
    const FRing Second = Tick(First, true, true, false);
    Expect(Second.Step == StepThree && !Second.bEarly && Purse(StepTwo, Second.Step) == 0, "the middle bell did not take");
    const FRing Sprint = Tick(Second, true, true, false);
    Expect(Sprint.Step == StepBanked && !Sprint.bEarly && Purse(StepThree, Sprint.Step) == Pay, "a sprint failed to ring the last bell");
    const FRing Again = Tick(Sprint, true, true, false);
    Expect(Again.Step == StepBanked && Purse(StepBanked, Again.Step) == 0, "the last bell paid twice");

    Now = Second;
    const FRing BackToOne = Tick(Now, true, false, true);
    Expect(BackToOne.bEarly && BackToOne.Step == StepOne && Purse(StepThree, BackToOne.Step) == 0, "a wrong last bell kept the order");

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
    Saved.Bell = 1;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "an order in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Roll, 2, Saved), "a version-11 slot carried the bells");
    const QuebecStorySave::FSteps FromRoll = QuebecStorySave::Applied(QuebecStorySave::Roll, Saved);
    Expect(FromRoll.Roll == QuebecStorySave::RollBanked && FromRoll.Bell == 0, "a version-11 slot copied the bells");
    Saved.Bell = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "an order past the bank was accepted");
    Saved.Bell = 1;
    Saved.Roll = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the bells started before the cart was banked");
    Expect(QuebecStorySave::Roll == 11 && QuebecStorySave::Bell == 12 && QuebecStorySave::Block == 13 && QuebecStorySave::Send == 14 && QuebecStorySave::Pursue == 15 && QuebecStorySave::Nose == 16 && QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Current == 21 && QuebecStorySave::Follow == 10, "the slot writer left version 21");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
