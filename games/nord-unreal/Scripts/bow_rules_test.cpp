// Standalone test for Source/Quebec/QuebecBowRules.h. Built and run by Scripts/test_bow_rules.py.

#ifdef QUEBEC_BOW_STRICT
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBowRules.h"
#include "../Source/Quebec/QuebecJobRules.h"
#include "../Source/Quebec/QuebecStandRules.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecBow;

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

    void HoldTests()
    {
        Expect(Pay == 150, "the bow pay is not 150");
        Expect(QuebecJobRules::Rewards[2] == 300, "the goon pay moved");
        Expect(HoldSeconds == 12.f && GraceSeconds == 2.f, "the hold or the grace moved");
        Expect(HoldRadius < QuebecJobRules::GoonArenaRadius, "the light is wider than the stage lawn");

        const FHold Full = Advance(0.f, 0.f, true, 12.f);
        Expect(Full.bDone && !Full.bDropped && Full.Inside == 12.f, "twelve seconds in the light did not finish");
        const FHold Short = Advance(0.f, 0.f, true, 11.9f);
        Expect(!Short.bDone && Short.Inside > 11.f && Short.Inside < 12.f, "eleven seconds finished the bow");
        const FHold StepOut = Advance(5.f, 0.f, false, 1.f);
        Expect(!StepOut.bDropped && !StepOut.bDone && StepOut.Inside == 5.f && StepOut.Outside == 1.f, "one second outside dropped the bow");
        const FHold Back = Advance(StepOut.Inside, StepOut.Outside, true, 0.5f);
        Expect(!Back.bDropped && !Back.bDone && Back.Outside == 0.f && Back.Inside == 5.5f, "coming back did not clear the grace");
        const FHold Leave = Advance(5.f, 0.f, false, 2.1f);
        Expect(Leave.bDropped && !Leave.bDone && Leave.Inside == 5.f, "too long outside kept the bow");
        const FHold Still = Advance(3.f, 1.f, false, 0.f);
        Expect(!Still.bDropped && Still.Inside == 3.f && Still.Outside == 1.f, "a zero step moved the clock");
        const FHold Backward = Advance(3.f, 0.f, true, -1.f);
        Expect(!Backward.bDone && Backward.Inside == 3.f, "a backward step moved the clock");

        Expect(CanStart(true, false, false, false, false, false), "a clear stage refused the bow");
        Expect(!CanStart(false, false, false, false, false, false), "the bow started before the fight was won");
        Expect(!CanStart(true, true, false, false, false, false), "the bow started during a job");
        Expect(!CanStart(true, false, true, false, false, false), "the bow started during a story beat");
        Expect(!CanStart(true, false, false, true, false, false), "the bow started twice");
        Expect(!CanStart(true, false, false, false, true, false), "a downed player started the bow");
        Expect(!CanStart(true, false, false, false, false, true), "a driver started the bow");
        Expect(Listed(true, false, false) && !Listed(true, true, false) && !Listed(true, false, true) && !Listed(false, false, false),
            "the stage mark showed at the wrong time");
    }

    void PlaceTests()
    {
        const QuebecJobRules::FJobSpot Here{Spot.X, Spot.Y, 0.};
        const double MinX = -43674.718, MaxX = 75373.303, MinY = -46754.4, MaxY = 69018.4;
        Expect(QuebecJobRules::Clearance(Here) >= QuebecJobRules::MinClearance, "the stage is %.0f cm from a QA anchor", QuebecJobRules::Clearance(Here));
        Expect(Here.X > MinX + 1000. && Here.X < MaxX - 1000. && Here.Y > MinY + 1000. && Here.Y < MaxY - 1000., "the stage is outside the district");
        const double FromMarker = QuebecJobRules::Distance2D(Here, QuebecJobRules::Markers[2]);
        const double FromArena = QuebecJobRules::Distance2D(Here, QuebecJobRules::GoonArena);
        Expect(FromMarker > 800., "the stage is %.0f cm from the goon marker", FromMarker);
        Expect(FromMarker > Reach + QuebecJobRules::MarkerRadius, "the stage reach overlaps the goon marker");
        Expect(FromArena < QuebecJobRules::GoonArenaRadius, "the stage is outside the theatre lawn");
        Expect(FromArena + HoldRadius < QuebecJobRules::GoonArenaRadius, "the light spills off the theatre lawn");
        const QuebecJobRules::FJobSpot Stall{QuebecStand::Spot.X, QuebecStand::Spot.Y, 0.};
        Expect(QuebecJobRules::Distance2D(Here, Stall) > 800., "the stage overlaps the stall");
        for (const QuebecJobRules::FJobSpot& Spawn : QuebecJobRules::GoonSpawns)
            Expect(QuebecJobRules::Distance2D(Here, Spawn) > 800., "the stage is %.0f cm from a goon spawn", QuebecJobRules::Distance2D(Here, Spawn));
    }
}

int main()
{
    HoldTests();
    PlaceTests();
    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
