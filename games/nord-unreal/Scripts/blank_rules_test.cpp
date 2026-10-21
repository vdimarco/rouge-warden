// Standalone test for Source/Quebec/QuebecBlankRules.h. Built by Scripts/test_blank_rules.py.

#ifdef QUEBEC_BLANK_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBlankRules.h"
#include "../Source/Quebec/QuebecConvoyRules.h"
#include "../Source/Quebec/QuebecRescueRules.h"
#include "../Source/Quebec/QuebecShowRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecBlankRules;

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

    void ExpectClear(const char* Name, const FSpot& Spot)
    {
        const QuebecJobRules::FJobSpot Point = {Spot.X, Spot.Y, Spot.Z};
        Expect(QuebecJobRules::Clearance(Point) >= QuebecJobRules::MinClearance, "%s clearance is under the QA line", Name);
        const QuebecShowRules::FSpot ShowSpots[] = {
            QuebecShowRules::Loading, QuebecShowRules::Followspot, QuebecShowRules::Backdrop, QuebecShowRules::Stage
        };
        for (const QuebecShowRules::FSpot& ShowSpot : ShowSpots)
        {
            const QuebecJobRules::FJobSpot Other = {ShowSpot.X, ShowSpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps the show", Name);
        }
        const QuebecConvoyRules::FSpot ConvoySpots[] = {
            QuebecConvoyRules::Feeder, QuebecConvoyRules::Projector, QuebecConvoyRules::Escape
        };
        for (const QuebecConvoyRules::FSpot& ConvoySpot : ConvoySpots)
        {
            const QuebecJobRules::FJobSpot Other = {ConvoySpot.X, ConvoySpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps the convoy", Name);
        }
        const QuebecRescueRules::FSpot RescueSpots[] = {
            QuebecRescueRules::Terrace, QuebecRescueRules::Pond, QuebecRescueRules::Court
        };
        for (const QuebecRescueRules::FSpot& RescueSpot : RescueSpots)
        {
            const QuebecJobRules::FJobSpot Other = {RescueSpot.X, RescueSpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps a rescue post", Name);
        }
    }
}

int main()
{
    Expect(StepBanked == 4, "the banked step drifted");
    const FSpot Posts[] = {GateA, GateB, GateC, Cue};
    const FSpot Recovers[] = {GateARecover, GateBRecover, GateCRecover, CueRecover};
    const char* Names[] = {"gate A", "gate B", "gate C", "cue"};
    for (int Index = 0; Index < 4; ++Index)
    {
        ExpectClear(Names[Index], Posts[Index]);
        ExpectClear(Names[Index], Recovers[Index]);
        Expect(SpotDistance(Posts[Index], Recovers[Index]) > Reach, "%s recover stands on the post", Names[Index]);
    }
    for (int Index = 0; Index < 4; ++Index)
        for (int Other = Index + 1; Other < 4; ++Other)
            Expect(SpotDistance(Posts[Index], Posts[Other]) > Reach * 2., "two finale posts overlap");

    Expect(Apply(StepGateA, EAct::Walk) == StepGateB, "the first gate does not open the second");
    Expect(Apply(StepGateA, EAct::Use) == StepGateA, "the first gate accepts the final pull");
    Expect(Apply(StepGateB, EAct::Walk) == StepGateC, "the second gate does not open the third");
    Expect(Apply(StepGateC, EAct::Walk) == StepCue, "the third gate does not open the cue");
    Expect(Apply(StepGateB, EAct::Walk) != StepBanked, "a middle gate skips the page");
    Expect(Apply(StepCue, EAct::Use) == StepBanked, "the cue does not leave the page blank");
    Expect(Apply(StepCue, EAct::Walk) == StepCue, "walking the cue skips the pull");
    Expect(Apply(StepBanked, EAct::Use) == StepBanked, "a second pull rewinds the page");

    Expect(Objective(StepGateA).X == GateA.X, "the first gate leads somewhere else");
    Expect(Objective(StepGateB).X == GateB.X, "the second gate leads somewhere else");
    Expect(Objective(StepGateC).X == GateC.X, "the third gate leads somewhere else");
    Expect(Objective(StepCue).Y == Cue.Y, "the cue leads somewhere else");
    Expect(RecoverAt(StepGateA).X == GateARecover.X, "gate A recover left its sidewalk");
    Expect(RecoverAt(StepCue).Y == CueRecover.Y, "the cue recover left its mark");

    Expect(!OffersBlank(true, true, true, true, true, false, StepGateA), "the page offers before the convoy");
    Expect(OffersBlank(true, true, true, true, true, true, StepCue), "a banked convoy does not open the page");
    Expect(!OffersBlank(true, true, true, true, true, true, StepBanked), "a blank page stays open");
    Expect(GuidesAfterBlank(true, true, true, true, true, true, StepBanked), "side jobs wait after the page");
    Expect(!GuidesAfterBlank(true, true, true, true, true, true, StepCue), "side jobs return while the cue is open");

    Expect(PartVisible(StepGateA, PartGateA), "the first gate hides on its step");
    Expect(!PartVisible(StepGateA, PartGateB), "the second gate shows early");
    Expect(PartVisible(StepCue, PartCue), "the cue hides on its step");
    Expect(PartVisible(StepBanked, PartPage), "the blank page hides once it is banked");
    Expect(!PartVisible(StepBanked, PartGateA), "the first gate stays up after the page");
    Expect(!PartVisible(StepCue, 9), "an unknown part is visible");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
