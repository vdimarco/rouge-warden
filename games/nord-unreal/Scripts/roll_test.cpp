// Standalone test for Source/Quebec/QuebecRoll.h. Built by Scripts/test_roll.py.

#ifdef QUEBEC_ROLL_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecRoll.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecFollow.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecRoll;

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
}

int main()
{
    Expect(StepReady == 0 && StepRoll == 1 && StepBanked == 2, "the stages drifted");
    Expect(Pay == 360 && Reach == 220. && Behind == 160. && Slice == 0.25, "the purse or the handles drifted");
    Expect(Speed == QuebecPace::WalkCmPerSecond && Speed < QuebecPace::SprintCmPerSecond, "the cart left the walk");
    Expect(Length() == 6000. && Length() > 5000., "the roll left the north lawn");
    const FSpot Hands = Handles(0.);
    const FSpot Back = Recover(StepReady, 0.);
    Expect(std::fabs(Hands.Y - (StartY + Behind)) < 1. && std::fabs(Hands.X - StartX) < 1., "the handles left the cart");
    Expect(Gap(Back.X, Back.Y, Hands.X, Hands.Y) > Reach, "ready recover is already the handles");
    Expect(InHandles(Recover(StepRoll, 0.).X, Recover(StepRoll, 0.).Y, 0.), "roll recover is outside the handles");
    Expect(std::fabs(StartX - QuebecFollow::CornerX) > 2500., "the cart reused the follow line");
    Expect(Gap(StartX, StartY, QuebecFollow::CornerX, QuebecFollow::CornerY) > 2500., "the start reused their corner");
    Expect(Gap(StopX, StopY, QuebecFollow::StopX, QuebecFollow::StopY) > 2500., "the stop reused their stop");

    Expect(!Offers(false, StepReady), "the cart offered before the gap was banked");
    Expect(Offers(true, StepReady) && Offers(true, StepRoll), "a banked gap did not offer the cart");
    Expect(!Offers(true, StepBanked), "a finished cart stayed open");

    const FCart Met = Tick(FCart{}, Slice, true, true, false, Hands.X, Hands.Y);
    Expect(Met.Step == StepRoll && Met.Along == 0. && Purse(StepReady, Met.Step) == 0, "standing at the handles did not take the cart");
    const FCart Rode = Tick(FCart{}, Slice, false, true, false, Hands.X, Hands.Y);
    Expect(Rode.Step == StepReady, "a car took the cart");

    FCart Pushed = Met;
    double X = Hands.X;
    double Y = Hands.Y;
    for (int Frame = 0; Frame < 80 && Pushed.Step == StepRoll; ++Frame)
    {
        const FSpot There = Handles(Pushed.Along);
        Expect(Gap(X, Y, There.X, There.Y) <= Reach, "a matched walk left the handles");
        Y -= Speed * Slice;
        Pushed = Tick(Pushed, Slice, true, true, false, X, Y);
    }
    Expect(Pushed.Step == StepBanked && Purse(StepRoll, Pushed.Step) == Pay, "a matched walk missed the stop");
    Expect(Purse(StepBanked, StepBanked) == 0, "the stop paid twice");

    FCart Held = Met;
    Held = Tick(Held, Slice, true, true, false, Hands.X, Hands.Y - Speed * Slice);
    Expect(Held.Along > 0. && !Held.bTipped, "the first push did not move the cart");
    const double Parked = Held.Along;
    for (int Frame = 0; Frame < 20; ++Frame)
        Held = Tick(Held, Slice, true, true, false, Hands.X, Hands.Y + 1000.);
    Expect(Held.Step == StepRoll && !Held.bTipped && std::fabs(Held.Along - Parked) < 1., "standing away from the handles moved the cart");

    FCart Tipped = Met;
    Tipped = Tick(Tipped, Slice, true, true, false, Hands.X, Hands.Y - Speed * Slice);
    const FSpot AfterPush = Handles(Tipped.Along);
    Tipped = Tick(Tipped, Slice, true, true, true, AfterPush.X, AfterPush.Y);
    Expect(Tipped.Step == StepRoll && Tipped.bTipped && Tipped.Along == 0. && Purse(StepRoll, Tipped.Step) == 0, "a sprint kept the cart rolling");

    FCart Mounted = Met;
    Mounted = Tick(Mounted, Slice, true, true, false, Hands.X, Hands.Y - Speed * Slice);
    const double BeforeCar = Mounted.Along;
    Mounted = Tick(Mounted, Slice, false, true, false, Hands.X, Hands.Y - Speed * Slice);
    Expect(Mounted.Step == StepRoll && !Mounted.bTipped && std::fabs(Mounted.Along - BeforeCar) < 1., "a car rolled the cart");

    const FCart LongFrame = Tick(Met, 5., true, true, false, Hands.X, Hands.Y - Speed * Slice);
    Expect(std::fabs(LongFrame.Along - Speed * Slice) < 1. && LongFrame.Step == StepRoll, "one long frame rolled the whole lawn");

    const FCart Empty = Tick(Met, Slice, false, false, false, 0., 0.);
    Expect(Empty.Along == 0. && !Empty.bTipped && Empty.Step == StepRoll, "an empty lawn rolled the cart");

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
    Saved.Roll = 1;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a cart in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Follow, 2, Saved), "a version-10 slot carried the cart");
    const QuebecStorySave::FSteps FromFollow = QuebecStorySave::Applied(QuebecStorySave::Follow, Saved);
    Expect(FromFollow.Follow == QuebecStorySave::FollowBanked && FromFollow.Roll == 0, "a version-10 slot copied the cart");
    Saved.Roll = 3;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a cart past the bank was accepted");
    Saved.Roll = 1;
    Saved.Follow = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the cart started before the gap was banked");
    Expect(QuebecStorySave::Follow == 10 && QuebecStorySave::Roll == 11 && QuebecStorySave::Bell == 12 && QuebecStorySave::Block == 13 && QuebecStorySave::Send == 14 && QuebecStorySave::Pursue == 15 && QuebecStorySave::Nose == 16 && QuebecStorySave::Current == 17 && QuebecStorySave::Finale == 9, "the slot writer left version 17");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
