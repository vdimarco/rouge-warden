// Standalone test for Source/Quebec/QuebecConvoyRules.h. Built by Scripts/test_convoy_rules.py.

#ifdef QUEBEC_CONVOY_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecConvoyRules.h"
#include "../Source/Quebec/QuebecRescueRules.h"
#include "../Source/Quebec/QuebecShowRules.h"
#include "../Source/Quebec/QuebecCourtRules.h"
#include "../Source/Quebec/QuebecPondRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecConvoyRules;

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
        const QuebecRescueRules::FSpot RescueSpots[] = {
            QuebecRescueRules::Terrace, QuebecRescueRules::Pond, QuebecRescueRules::Court
        };
        for (const QuebecRescueRules::FSpot& OtherSpot : RescueSpots)
        {
            const QuebecJobRules::FJobSpot Other = {OtherSpot.X, OtherSpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps a rescue post", Name);
        }
        const QuebecShowRules::FSpot ShowSpots[] = {
            QuebecShowRules::Loading, QuebecShowRules::Followspot, QuebecShowRules::Backdrop, QuebecShowRules::Stage
        };
        for (const QuebecShowRules::FSpot& ShowSpot : ShowSpots)
        {
            const QuebecJobRules::FJobSpot Other = {ShowSpot.X, ShowSpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps the show", Name);
        }
    }
}

int main()
{
    Expect(StepBanked == 4, "the banked step drifted");
    const FSpot Posts[] = {Feeder, Projector, Escape};
    const FSpot Recovers[] = {FeederRecover, ProjectorRecover, EscapeRecover};
    const char* Names[] = {"feeder", "projector", "escape"};
    for (int Index = 0; Index < 3; ++Index)
    {
        ExpectClear(Names[Index], Posts[Index]);
        ExpectClear(Names[Index], Recovers[Index]);
        Expect(SpotDistance(Posts[Index], Recovers[Index]) > Reach, "%s recover stands on the post", Names[Index]);
        Expect(SpotDistance(Posts[Index], Recovers[Index]) > 600. && SpotDistance(Posts[Index], Recovers[Index]) < 800.,
            "%s recover left the sidewalk", Names[Index]);
    }
    Expect(SpotDistance(Feeder, Projector) > Reach * 2., "the feeder stands on the projector");
    Expect(SpotDistance(Feeder, Escape) > Reach * 2., "the feeder stands on the escape gate");
    Expect(SpotDistance(Projector, Escape) > Reach * 2., "the projector stands on the escape gate");

    Expect(Apply(StepArrive, EAct::Walk, 0.) == StepGap, "walking up does not open the gap");
    Expect(Apply(StepArrive, EAct::Pull, 1.5) == StepArrive, "the clamp accepts a pull before the gap is read");
    Expect(BeamDanger(0.4), "the beam is quiet at the start of the paint");
    Expect(!BeamDanger(1.5), "the gap is still painted");
    Expect(BeamTelegraph(2.9), "the warning is missing before the paint");
    Expect(!BeamTelegraph(1.5), "the open gap is marked as a warning");
    Expect(Apply(StepGap, EAct::Pull, 0.4) == StepGap, "a pull during the paint stalls the feed");
    Expect(Apply(StepGap, EAct::Pull, 1.5) == StepInvert, "a pull in the gap does not stall the feed");
    Expect(Apply(StepGap, EAct::Pull, 2.9) == StepInvert, "the warning refuses a pull that can still land");
    Expect(Apply(StepGap, EAct::Use, 1.5) == StepGap, "using the bay skips the pull");
    Expect(Apply(StepInvert, EAct::Use, 0.) == StepEscape, "inverting the plate does not isolate the escape");
    Expect(Apply(StepInvert, EAct::Pull, 1.5) == StepInvert, "pulling again skips the plate");
    Expect(Apply(StepEscape, EAct::Use, 0.) == StepBanked, "the escape gate does not bank the gap");
    Expect(Apply(StepBanked, EAct::Use, 0.) == StepBanked, "a second escape rewinds the mission");

    Expect(Objective(StepArrive).X == Feeder.X && Objective(StepGap).Y == Feeder.Y, "the gap leads somewhere else");
    Expect(Objective(StepInvert).X == Projector.X, "the plate leads somewhere else");
    Expect(Objective(StepEscape).X == Escape.X, "the escape leads somewhere else");
    Expect(RecoverAt(StepGap).X == FeederRecover.X, "the gap recover left the feeder");
    Expect(RecoverAt(StepInvert).X == ProjectorRecover.X, "the plate recover left the projector");
    Expect(RecoverAt(StepEscape).X == EscapeRecover.X, "the escape recover left the gate");

    Expect(!OffersConvoy(true, true, true, true, false, StepArrive), "the convoy offers before the groups are out");
    Expect(!OffersConvoy(true, true, true, false, true, StepArrive), "the convoy offers before the curtain");
    Expect(OffersConvoy(true, true, true, true, true, StepGap), "a finished rescue does not open the convoy");
    Expect(!OffersConvoy(true, true, true, true, true, StepBanked), "a banked convoy stays open");
    Expect(GuidesAfterConvoy(true, true, true, true, true, StepBanked), "side jobs wait after the escape");
    Expect(!GuidesAfterConvoy(true, true, true, true, true, StepEscape), "side jobs return while the escape is open");

    Expect(PartVisible(StepGap, PartBeam, 0.4), "the beam hides while it paints");
    Expect(PartVisible(StepGap, PartBeam, 2.9), "the beam hides during the warning");
    Expect(!PartVisible(StepGap, PartBeam, 1.5), "the beam stays up in the open gap");
    Expect(PartVisible(StepArrive, PartFeeder, 0.), "the feeder hides on the walk-up");
    Expect(!PartVisible(StepArrive, PartProjector, 0.), "the projector shows before the feed stalls");
    Expect(PartVisible(StepInvert, PartProjector, 0.), "the projector hides when it is isolated");
    Expect(PartVisible(StepEscape, PartEscape, 0.), "the escape gate hides on its step");
    Expect(PartVisible(StepBanked, PartPlate, 0.), "the inverted plate hides once the gap is banked");
    Expect(!PartVisible(StepBanked, PartFeeder, 0.), "the feeder stays up after the escape");
    Expect(!PartVisible(StepGap, 9, 0.), "an unknown part is visible");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
