// Standalone test for QuebecShowRules and QuebecShowTone. Built by Scripts/test_show_rules.py.

#ifdef QUEBEC_SHOW_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecShowRules.h"
#include "../Source/Quebec/QuebecShowTone.h"
#include "../Source/Quebec/QuebecPondTone.h"
#include "../Source/Quebec/QuebecCourtRules.h"
#include "../Source/Quebec/QuebecPondRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>
#include <cmath>

using namespace QuebecShowRules;

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
        Expect(QuebecJobRules::Clearance(Point) >= QuebecJobRules::MinClearance,
            "%s clearance is under the QA line", Name);
        for (const QuebecJobRules::FJobSpot& Marker : QuebecJobRules::Markers)
            Expect(QuebecJobRules::Distance2D(Point, Marker) >= QuebecJobRules::MinClearance, "%s overlaps a side-job marker", Name);
        const QuebecPondRules::FSpot PondSpots[] = {
            QuebecPondRules::ShoreLookout, QuebecPondRules::Beams[0], QuebecPondRules::Beams[1], QuebecPondRules::Beams[2],
            QuebecPondRules::NearLock, QuebecPondRules::FarLock, QuebecPondRules::DashEnd, QuebecPondRules::Picnic
        };
        for (const QuebecPondRules::FSpot& Pond : PondSpots)
        {
            const QuebecJobRules::FJobSpot PondPoint = {Pond.X, Pond.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, PondPoint) >= QuebecJobRules::MinClearance, "%s overlaps the pond scene", Name);
        }
        const QuebecCourtRules::FSpot CourtSpots[] = {
            QuebecCourtRules::Arrive, QuebecCourtRules::Panels[0], QuebecCourtRules::Panels[1], QuebecCourtRules::Panels[2],
            QuebecCourtRules::ReturnGate, QuebecCourtRules::Clamp
        };
        for (const QuebecCourtRules::FSpot& Court : CourtSpots)
        {
            const QuebecJobRules::FJobSpot CourtPoint = {Court.X, Court.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, CourtPoint) >= QuebecJobRules::MinClearance, "%s overlaps the court", Name);
        }
    }
}

int main()
{
    Expect(StepBanked == 5, "banked step index drifted");
    const FSpot Play[] = {Loading, Followspot, Backdrop, Stage};
    const char* Names[] = {"loading", "followspot", "backdrop", "stage"};
    for (int Index = 0; Index < 4; ++Index) ExpectClear(Names[Index], Play[Index]);

    Expect(SpotDistance(Loading, Followspot) > Reach * 2., "loading stands on the followspot");
    Expect(SpotDistance(Loading, Backdrop) > Reach * 2., "loading stands on the backdrop");
    Expect(SpotDistance(Followspot, Backdrop) > Reach * 2., "the two stations overlap");
    Expect(SpotDistance(Loading, Stage) > Reach * 2., "the stage diamond is the loading edge");
    Expect(SpotDistance(Stage, Followspot) > Reach * 2., "the stage diamond is the followspot");
    Expect(SpotDistance(Stage, Backdrop) > Reach * 2., "the stage diamond is the backdrop");

    for (int Step = StepArrive; Step <= StepCue; ++Step)
    {
        const FSpot Back = RecoverAt(Step);
        Expect(Back.Y == Objective(Step).Y - RecoverSouth, "recover for step %d is not south of the step", Step);
        Expect(SpotDistance(Back, Objective(Step)) > Reach, "recover for step %d completes the step", Step);
        ExpectClear("recover", Back);
    }

    int SpotFirst = StepArrive;
    SpotFirst = Apply(SpotFirst, EAct::Spot);
    Expect(SpotFirst == StepArrive, "the followspot worked before the walk");
    SpotFirst = Apply(SpotFirst, EAct::Walk);
    Expect(SpotFirst == StepChoice, "arriving did not open the choice");
    SpotFirst = Apply(SpotFirst, EAct::Spot);
    Expect(SpotFirst == StepSpot, "the followspot did not bank first");
    SpotFirst = Apply(SpotFirst, EAct::Spot);
    Expect(SpotFirst == StepSpot, "setting the followspot again skipped the backdrop");
    SpotFirst = Apply(SpotFirst, EAct::Cue);
    Expect(SpotFirst == StepSpot, "the curtain worked with the backdrop still blank");
    SpotFirst = Apply(SpotFirst, EAct::Drop);
    Expect(SpotFirst == StepCue, "the backdrop did not open the curtain");
    SpotFirst = Apply(SpotFirst, EAct::Drop);
    Expect(SpotFirst == StepCue, "a second backdrop skipped the curtain");
    SpotFirst = Apply(SpotFirst, EAct::Cue);
    Expect(SpotFirst == StepBanked, "the curtain did not turn the page");
    Expect(Apply(SpotFirst, EAct::Cue) == StepBanked, "a banked show accepted another cue");

    int DropFirst = Apply(StepChoice, EAct::Drop);
    Expect(DropFirst == StepDrop, "the backdrop did not bank first");
    DropFirst = Apply(DropFirst, EAct::Drop);
    Expect(DropFirst == StepDrop, "setting the backdrop again skipped the followspot");
    DropFirst = Apply(DropFirst, EAct::Spot);
    Expect(DropFirst == StepCue, "the followspot second did not open the curtain");

    Expect(PartVisible(StepChoice, PartSpot) && PartVisible(StepChoice, PartDrop), "the choice hides a station");
    Expect(!PartVisible(StepChoice, PartPanel0), "the page shows before the curtain");
    Expect(!PartVisible(StepSpot, PartSpot) && PartVisible(StepSpot, PartDrop), "a set followspot stays up");
    Expect(PartVisible(StepDrop, PartSpot) && !PartVisible(StepDrop, PartDrop), "a hung backdrop stays up");
    Expect(PartVisible(StepCue, PartCue) && !PartVisible(StepCue, PartSpot) && !PartVisible(StepCue, PartDrop), "the curtain still shows the stations");
    Expect(PartVisible(StepBanked, PartPanel0) && PartVisible(StepBanked, PartSouvenir) && !PartVisible(StepBanked, PartCue), "the page hid the panels");
    Expect(!PartVisible(StepArrive, -1) && !PartVisible(StepArrive, PartCount), "an unknown post is visible");

    Expect(!OffersShow(false, true, true, StepArrive), "the show offers during mission 1");
    Expect(!OffersShow(true, false, true, StepArrive), "the show offers before the picnic");
    Expect(!OffersShow(true, true, false, StepArrive), "the show offers before the court");
    Expect(OffersShow(true, true, true, StepArrive) && OffersShow(true, true, true, StepCue), "a banked court did not offer the show");
    Expect(!OffersShow(true, true, true, StepBanked), "a banked show still offers the ovation");
    Expect(!GuidesAfterShow(true, true, true, StepCue), "side jobs lead while the ovation is open");
    Expect(GuidesAfterShow(true, true, true, StepBanked), "a banked show did not return the side-job guide");

    Expect(QuebecShowTone::PageFrames > QuebecPondTone::TickFrames, "the page is as short as the pond tick");
    Expect(QuebecShowTone::ThumpHz != QuebecPondTone::Frequency, "the page uses the pond tick's pitch");
    Expect(std::fabs(QuebecShowTone::SampleAt(0)) < 1e-9, "the page starts at a click");
    Expect(std::fabs(QuebecShowTone::SampleAt(QuebecShowTone::PageFrames / 8)) > 0.02, "the page has no body");
    Expect(std::fabs(QuebecShowTone::SampleAt(QuebecShowTone::PageFrames - 1)) < 0.02, "the page tail is still loud");
    Expect(QuebecShowTone::SampleAt(-1) == 0. && QuebecShowTone::SampleAt(QuebecShowTone::PageFrames) == 0., "the page plays outside its window");
    bool bDistinct = false;
    for (int Frame = 0; Frame < QuebecPondTone::TickFrames; ++Frame)
    {
        if (std::fabs(QuebecShowTone::SampleAt(Frame) - QuebecPondTone::SampleAt(Frame)) > 0.01)
        {
            bDistinct = true;
            break;
        }
    }
    Expect(bDistinct, "the page matches the pond tick");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
