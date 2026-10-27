// Standalone test for Source/Quebec/QuebecFollow.h. Built by Scripts/test_follow.py.

#ifdef QUEBEC_FOLLOW_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecFollow.h"
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecFinale.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecCut.h"
#include "../Source/Quebec/QuebecEscort.h"
#include "../Source/Quebec/QuebecGrab.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecFollow;

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

    FGap At(int Step, double Along)
    {
        FGap Now;
        Now.Step = Step;
        Now.Along = Along;
        return Now;
    }

}

int main()
{
    Expect(StepMeet == 0 && StepFollow == 1 && StepBanked == 2, "the stages drifted");
    Expect(Pay == 400 && Reach == 450. && Spook == 600. && Leash == 2800. && Slice == 0.25, "the purse or the band drifted");
    Expect(Speed == QuebecPace::WalkCmPerSecond && Speed < QuebecPace::SprintCmPerSecond, "their pace left the walk");
    Expect(Length() == 6400. && Length() > 5000., "the line left the north lawn");
    const FSpot Door = Meet();
    const FSpot End = Stop();
    const FSpot Back = Recover(StepMeet, 0.);
    Expect(std::fabs(Door.Y - (CornerY + Behind)) < 1. && std::fabs(Door.X - CornerX) < 1., "the meet left the gap behind them");
    Expect(Gap(Door.X, Door.Y, CornerX, CornerY) - Reach > Spook, "the near edge of the meet already crowds them");
    Expect(Gap(Door.X, Door.Y, CornerX, CornerY) + Reach < Leash, "the far edge of the meet is already out of reach");
    Expect(Gap(Back.X, Back.Y, Door.X, Door.Y) > Reach, "meet recover is already the meet");
    Expect(InBand(Gap(Recover(StepFollow, 0.).X, Recover(StepFollow, 0.).Y, CornerX, CornerY)), "follow recover is outside the band");
    Expect(InBand(Gap(Recover(StepFollow, Length()).X, Recover(StepFollow, Length()).Y, End.X, End.Y)), "the stop recover is outside the band");
    Expect(Gap(CornerX, CornerY, QuebecCut::StartX, QuebecCut::StartY) > 4000., "the corner reused the short way");
    Expect(Gap(End.X, End.Y, QuebecCut::FinishX, QuebecCut::FinishY) > 4000., "the stop reused the short way");
    Expect(Gap(Door.X, Door.Y, QuebecEscort::MeetX, QuebecEscort::MeetY) > 4000., "the meet reused the escort");
    Expect(Gap(CornerX, CornerY, QuebecFinale::ColumnX, QuebecFinale::MeetY) > 4000., "the corner reused the day");
    Expect(Gap(CornerX, CornerY, QuebecChase::StartX, QuebecChase::StartY) > 20000., "the corner reused the tail");
    Expect(Gap(CornerX, CornerY, QuebecGrab::CaseX, QuebecGrab::CaseY) > 4000., "the corner reused the window");

    Expect(!Offers(false, StepMeet), "the gap offered before the day was banked");
    Expect(Offers(true, StepMeet) && Offers(true, StepFollow), "a banked day did not offer the gap");
    Expect(!Offers(true, StepBanked), "a finished gap stayed open");

    const FGap Met = Tick(FGap{}, Slice, true, true, false, Door.X, Door.Y);
    Expect(Met.Step == StepFollow && Met.Along == 0. && Purse(StepMeet, Met.Step) == 0, "standing behind them did not open the walk");
    const FGap Rode = Tick(FGap{}, Slice, false, true, false, Door.X, Door.Y);
    Expect(Rode.Step == StepMeet, "a car stood behind them");
    const double SouthY = Door.Y - Reach;
    Expect(InMeet(Door.X, SouthY), "the south edge of the meet is outside it");
    const FGap SouthMet = Tick(FGap{}, Slice, true, true, false, Door.X, SouthY);
    Expect(SouthMet.Step == StepFollow, "the south edge of the meet did not start the walk");

    FGap Matched = Met;
    double X = Door.X;
    double Y = Door.Y;
    for (int Frame = 0; Frame < 80 && Matched.Step == StepFollow; ++Frame)
    {
        const FSpot There = Place(Matched.Along);
        const double Dist = Gap(X, Y, There.X, There.Y);
        Expect(std::fabs(Dist - Behind) < 1., "a matched walk changed the gap");
        Y -= Speed * Slice;
        Matched = Tick(Matched, Slice, true, true, false, X, Y);
    }
    Expect(Matched.Step == StepBanked && Purse(StepFollow, Matched.Step) == Pay, "a matched walk missed the stop");
    Expect(Purse(StepBanked, StepBanked) == 0, "the stop paid twice");

    FGap SouthWalk = SouthMet;
    double SouthX = Door.X;
    double SouthWalkY = SouthY;
    for (int Frame = 0; Frame < 80 && SouthWalk.Step == StepFollow; ++Frame)
    {
        SouthWalkY -= Speed * Slice;
        SouthWalk = Tick(SouthWalk, Slice, true, true, false, SouthX, SouthWalkY);
    }
    Expect(SouthWalk.Step == StepBanked, "a walk from the south edge of the meet missed the stop");

    FGap Sprinted = Met;
    double SprintY = Door.Y;
    for (int Frame = 0; Frame < 40 && Sprinted.Step == StepFollow && !Sprinted.bCrowded; ++Frame)
    {
        SprintY -= QuebecPace::SprintCmPerSecond * Slice;
        Sprinted = Tick(Sprinted, Slice, true, true, false, Door.X, SprintY);
    }
    Expect(Sprinted.Step == StepFollow && Sprinted.bCrowded && Sprinted.Along == 0. && Purse(StepFollow, Sprinted.Step) == 0, "a sprint kept the gap");

    FGap Stopped = Met;
    Stopped = Tick(Stopped, Slice, true, true, false, Door.X, Door.Y);
    Expect(Stopped.Along > 0., "the first matched step did not move them");
    for (int Frame = 0; Frame < 40 && Stopped.Along > 0.; ++Frame)
        Stopped = Tick(Stopped, Slice, true, true, false, Door.X, Door.Y);
    Expect(Stopped.Step == StepFollow && Stopped.bLost && Stopped.Along == 0., "standing still kept the gap");

    FGap Mounted = Met;
    Mounted = Tick(Mounted, Slice, true, true, false, Door.X, Door.Y);
    Mounted = Tick(Mounted, Slice, false, true, false, Door.X, Door.Y - Speed * Slice);
    Expect(Mounted.Step == StepFollow && Mounted.bLost && Mounted.Along == 0., "a car kept the gap");

    FGap Partner = Met;
    Partner = Tick(Partner, Slice, true, true, true, Door.X, Door.Y);
    Expect(Partner.bCrowded && Partner.Along == 0. && Partner.Step == StepFollow, "a partner inside the spook left the gap");

    const FGap LongFrame = Tick(At(StepFollow, 0.), 5., true, true, false, Door.X, Door.Y);
    Expect(std::fabs(LongFrame.Along - Speed * Slice) < 1. && LongFrame.Step == StepFollow, "one long frame walked the whole line");

    const FGap Empty = Tick(At(StepFollow, 400.), Slice, false, false, false, 0., 0.);
    Expect(Empty.Along == 0. && Empty.bLost && Empty.Step == StepFollow, "an empty lawn kept them walking");

    const FGap Idle = Tick(At(StepFollow, 0.), Slice, true, true, false, Door.X + 9000., Door.Y);
    Expect(Idle.Along == 0. && Idle.bLost, "a far walker kept them walking");

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
    Saved.Follow = 1;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a gap in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Finale, 2, Saved), "a version-9 slot carried the gap");
    const QuebecStorySave::FSteps FromFinale = QuebecStorySave::Applied(QuebecStorySave::Finale, Saved);
    Expect(FromFinale.Finale == QuebecStorySave::FinaleBanked && FromFinale.Follow == 0, "a version-9 slot copied the gap");
    Saved.Follow = 3;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a gap past the bank was accepted");
    Saved.Follow = 1;
    Saved.Finale = 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the gap started before the day was banked");
    Expect(QuebecStorySave::Finale == 9 && QuebecStorySave::Follow == 10 && QuebecStorySave::Roll == 11 && QuebecStorySave::Bell == 12 && QuebecStorySave::Block == 13 && QuebecStorySave::Send == 14 && QuebecStorySave::Pursue == 15 && QuebecStorySave::Nose == 16 && QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Bolt == 21 && QuebecStorySave::Yard == 22 && QuebecStorySave::Lift == 23 && QuebecStorySave::Current == 24 && QuebecStorySave::Chase == 8, "the slot writer left version 24");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
