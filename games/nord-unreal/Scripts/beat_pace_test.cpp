// Standalone test for Source/Quebec/QuebecPace.h. Built by Scripts/test_beat_pace.py.

#ifdef QUEBEC_PACE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecPace.h"

#include <cstdarg>
#include <cmath>
#include <cstdio>

using namespace QuebecPace;

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
    Expect(WalkCmPerSecond == 450. && SprintCmPerSecond == 800., "the card pace is not the player's walk and sprint");
    Expect(WalkSeconds(0.) == 0, "a zero leg still names a walk");
    Expect(WalkSeconds(200.) == 1, "a short leg rounds away to nothing");
    Expect(WalkSeconds(450.) == 1, "one second of walking is not one second");
    Expect(WalkSeconds(900.) == 2, "two seconds of walking is not two seconds");

    const FBeat Pond = Linear(QuebecPondRules::StepShore, QuebecPondRules::StepBanked, QuebecPondRules::Objective);
    Expect(Pond.Index == 1 && Pond.Count == 6 && Pond.WalkSeconds > 0, "the pond does not open as stop 1 of 6 with a walk");
    const FBeat PondEnd = Linear(QuebecPondRules::StepPull, QuebecPondRules::StepBanked, QuebecPondRules::Objective);
    Expect(PondEnd.Index == 6 && PondEnd.Count == 6 && PondEnd.WalkSeconds == 0, "the picnic clamp invents a walk after the beat");

    const FBeat Court = Linear(QuebecCourtRules::StepArrive, QuebecCourtRules::StepBanked, QuebecCourtRules::Objective);
    Expect(Court.Index == 1 && Court.Count == 4 && Court.WalkSeconds > 0, "the court does not open as stop 1 of 4");

    const FBeat Choice = Show(QuebecShowRules::StepChoice);
    Expect(Choice.Index == 2 && Choice.Count == 4 && Choice.WalkSeconds == 0, "the either-order choice names one walk");
    const FBeat AfterSpot = Show(QuebecShowRules::StepSpot);
    const auto Backdrop = QuebecShowRules::Objective(QuebecShowRules::StepSpot);
    const auto Curtain = QuebecShowRules::Objective(QuebecShowRules::StepCue);
    const int CurtainWalk = WalkSeconds(std::hypot(Curtain.X - Backdrop.X, Curtain.Y - Backdrop.Y));
    Expect(AfterSpot.Index == 3 && AfterSpot.Count == 4 && AfterSpot.WalkSeconds == CurtainWalk, "after the followspot the walk is not to the curtain");
    const auto Followspot = QuebecShowRules::Objective(QuebecShowRules::StepDrop);
    Expect(AfterSpot.WalkSeconds != WalkSeconds(std::hypot(Followspot.X - Backdrop.X, Followspot.Y - Backdrop.Y)) ||
        (Followspot.X == Curtain.X && Followspot.Y == Curtain.Y), "after the followspot the walk returns to the followspot");

    const FBeat Groups = Rescue(0);
    Expect(Groups.Index == 1 && Groups.Count == 3 && Groups.WalkSeconds == 0, "the first rescue group is not 1 of 3");
    const FBeat OneOut = Rescue(QuebecRescueRules::BitTerrace);
    Expect(OneOut.Index == 2 && OneOut.Count == 3, "freeing the terrace does not advance the count");
    Expect(Rescue(QuebecRescueRules::Done).Count == 0, "a finished rescue still has a pace");

    const FBeat Convoy = Linear(QuebecConvoyRules::StepGap, QuebecConvoyRules::StepBanked, QuebecConvoyRules::Objective);
    const auto Feeder = QuebecConvoyRules::Objective(QuebecConvoyRules::StepGap);
    const auto Plate = QuebecConvoyRules::Objective(QuebecConvoyRules::StepInvert);
    Expect(Convoy.Index == 2 && Convoy.Count == 4 &&
        Convoy.WalkSeconds == WalkSeconds(std::hypot(Plate.X - Feeder.X, Plate.Y - Feeder.Y)),
        "the beam gap does not walk on to the projector");

    const FBeat Page = Linear(QuebecBlankRules::StepGateA, QuebecBlankRules::StepBanked, QuebecBlankRules::Objective);
    Expect(Page.Index == 1 && Page.Count == 4 && Page.WalkSeconds > 0, "the first gate is not stop 1 of 4");
    const FBeat LastPage = Linear(QuebecBlankRules::StepCue, QuebecBlankRules::StepBanked, QuebecBlankRules::Objective);
    Expect(LastPage.Index == 4 && LastPage.WalkSeconds == 0, "the blank page invents a walk after itself");

    const FBeat Aim = Terrace(0);
    Expect(Aim.Index == 1 && Aim.Count == 5 && Aim.bMeasureWalk, "the worklight is not stop 1 of 5 with a walk");
    const FBeat Park = Terrace(3);
    Expect(Park.Index == 4 && Park.Count == 5 && !Park.bMeasureWalk, "parking the car is counted as a walk");
    Expect(Terrace(5).Count == 0, "the race borrows the terrace count");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
