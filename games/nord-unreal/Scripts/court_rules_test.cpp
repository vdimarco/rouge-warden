// Standalone test for Source/Quebec/QuebecCourtRules.h. Built and run by Scripts/test_court_rules.py.

#ifdef QUEBEC_COURT_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecCourtRules.h"
#include "../Source/Quebec/QuebecCourtTone.h"
#include "../Source/Quebec/QuebecPondTone.h"
#include "../Source/Quebec/QuebecShowTone.h"
#include "../Source/Quebec/QuebecPondRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cmath>
#include <cstdio>

using namespace QuebecCourtRules;

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
        Expect(InsideCourt(Spot.X, Spot.Y), "%s is off the mapped court", Name);
        for (const QuebecJobRules::FJobSpot& Marker : QuebecJobRules::Markers)
            Expect(QuebecJobRules::Distance2D(Point, Marker) >= QuebecJobRules::MinClearance, "%s overlaps a side-job marker", Name);
        const QuebecPondRules::FSpot PondSpots[] = {
            QuebecPondRules::ShoreLookout, QuebecPondRules::Beams[0], QuebecPondRules::Beams[1], QuebecPondRules::Beams[2],
            QuebecPondRules::NearLock, QuebecPondRules::FarLock, QuebecPondRules::DashEnd, QuebecPondRules::Picnic
        };
        for (const QuebecPondRules::FSpot& Pond : PondSpots)
        {
            const QuebecJobRules::FJobSpot PondPoint = {Pond.X, Pond.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, PondPoint) >= QuebecJobRules::MinClearance, "%s overlaps the pond", Name);
        }
    }
}

int main()
{
    Expect(StepBanked == 4, "banked step index drifted");
    const FSpot Play[] = {Arrive, Panels[0], Panels[1], Panels[2], ReturnGate, Clamp};
    const char* Names[] = {"arrive", "panel0", "panel1", "gold", "gate", "clamp"};
    for (int Index = 0; Index < 6; ++Index) ExpectClear(Names[Index], Play[Index]);

    Expect(SpotDistance(Panels[GoldPanel], ReturnGate) > Reach * 2., "the gold panel and the return gate overlap");
    Expect(SpotDistance(ReturnGate, Clamp) > Reach * 2., "banking the ball also pulls the clamp");
    Expect(SpotDistance(Panels[0], Panels[1]) > Reach * 2., "the first two panels overlap");
    Expect(SpotDistance(Panels[1], Panels[GoldPanel]) > Reach * 2., "the middle and the gold panel overlap");
    Expect(SpotDistance(Arrive, Panels[GoldPanel]) > Reach * 2., "arriving stands on the gold panel");

    for (int Step = StepArrive; Step <= StepPull; ++Step)
    {
        const FSpot Back = RecoverAt(Step);
        Expect(Back.Y == Objective(Step).Y + RecoverNorth, "recover for step %d is not north of the step", Step);
        Expect(SpotDistance(Back, Objective(Step)) > Reach, "recover for step %d completes the step", Step);
    }

    const double OnGold = PanelPeriod * 2. + 0.2;
    const double OnMiddle = PanelPeriod + 0.2;
    Expect(BallPanel(OnGold) == GoldPanel, "the gold window is not on the gold panel");
    Expect(BallPanel(OnMiddle) == BankPanel, "the bank window is not on the middle panel");
    Expect(!SweepDanger(OnMiddle), "the sample bank window is under the ink");

    bool bClear = false;
    bool bDanger = false;
    for (int Sample = 0; Sample < 960; ++Sample)
    {
        const double Time = static_cast<double>(Sample) * 0.05;
        if (BallPanel(Time) != BankPanel) continue;
        if (SweepDanger(Time)) bDanger = true;
        else bClear = true;
    }
    Expect(bClear, "the bank shot has no clear window");
    Expect(bDanger, "the ink never crosses the bank window");

    int Step = StepArrive;
    Step = Apply(Step, EAct::Score, GoldPanel, OnGold);
    Expect(Step == StepArrive, "scoring from the walk skipped the court");
    Step = Apply(Step, EAct::Walk, -1, 0.);
    Expect(Step == StepRally, "arriving did not start the rally");
    Step = Apply(Step, EAct::Score, GoldPanel, OnMiddle);
    Expect(Step == StepRally, "scoring off the gold panel advanced");
    Step = Apply(Step, EAct::Score, 0, OnGold);
    Expect(Step == StepRally, "scoring a decoy panel advanced");
    Step = Apply(Step, EAct::Bank, BankPanel, OnMiddle);
    Expect(Step == StepRally, "the bank shot worked before the loop was shown");
    Step = Apply(Step, EAct::Score, GoldPanel, OnGold);
    Expect(Step == StepRedirect, "scoring the gold panel did not open the return gate");
    Step = Apply(Step, EAct::Score, GoldPanel, OnGold);
    Expect(Step == StepRedirect, "scoring again rewound the checkpoint");
    Step = Apply(Step, EAct::Bank, BankPanel, OnMiddle);
    Expect(!SweepDanger(OnMiddle) && Step == StepPull, "a clear bank shot did not expose the clamp");
    Step = StepRedirect;
    Expect(Apply(Step, EAct::Bank, BankPanel, 0.2) == StepRedirect, "banking under the ink exposed the clamp");
    Expect(BallPanel(0.2) != BankPanel || SweepDanger(0.2), "0.2 s is not a bad bank sample");
    Step = Apply(StepRedirect, EAct::Bank, BankPanel, OnMiddle);
    Expect(Step == StepPull, "the clear bank shot did not reach the clamp");
    Step = Apply(Step, EAct::Bank, BankPanel, OnMiddle);
    Expect(Step == StepPull, "banking again skipped the pull");
    Step = Apply(Step, EAct::Use, -1, 0.);
    Expect(Step == StepBanked, "pulling the clamp did not bank the court");
    Expect(Apply(Step, EAct::Use, GoldPanel, OnGold) == StepBanked, "a banked court accepted another action");

    Expect(SweepTelegraph(SweepPeriod - 0.2) && !SweepDanger(SweepPeriod - 0.2), "the telegraph does not warn before the ink");
    Expect(SweepDanger(0.1) && !SweepTelegraph(0.1), "the danger window also counts as a warning");
    Expect(PartVisible(StepRally, 3, OnGold) && !PartVisible(StepRally, 4, OnGold), "the rally shows the return gate");
    Expect(PartVisible(StepRedirect, 4, OnMiddle) && PartVisible(StepRedirect, PartBall, OnMiddle), "the redirect hides the gate or the ball");
    Expect(PartVisible(StepRedirect, PartInk, 0.1), "the ink hides while it is dangerous");
    Expect(!PartVisible(StepRedirect, PartInk, OnMiddle), "the ink shows during the clear bank window");
    Expect(PartVisible(StepPull, PartClamp, 0.) && !PartVisible(StepPull, PartBall, 0.), "the pull still shows the ball");
    Expect(PartVisible(StepBanked, PartClamp, 0.) && !PartVisible(StepBanked, 4, 0.), "a banked court hid the souvenir");
    Expect(!PartVisible(StepArrive, -1, 0.) && !PartVisible(StepArrive, PartCount, 0.), "an unknown post is visible");

    Expect(!OffersCourt(false, true, StepArrive), "the court offers during mission 1");
    Expect(!OffersCourt(true, false, StepArrive), "the court offers before the picnic is banked");
    Expect(OffersCourt(true, true, StepArrive) && OffersCourt(true, true, StepPull), "a banked picnic did not offer the court");
    Expect(!OffersCourt(true, true, StepBanked), "a banked court still offers the match");
    Expect(!GuidesAfterCourt(true, true, StepPull), "side jobs lead while the match is looping");
    Expect(GuidesAfterCourt(true, true, StepBanked), "a banked court did not return the side-job guide");
    Expect(!GuidesAfterCourt(true, false, StepBanked), "side jobs lead before the picnic is banked");

    Expect(QuebecCourtTone::WhistleHz != QuebecPondTone::Frequency, "the bank whistle uses the pond tick");
    Expect(QuebecCourtTone::WhistleHz != QuebecShowTone::ThumpHz && QuebecCourtTone::WhistleOverHz != QuebecShowTone::FlutterHz,
        "the bank whistle uses the page");
    Expect(QuebecCourtTone::RaspHz != QuebecCourtTone::WhistleHz, "the ink rasp is the whistle");
    Expect(QuebecCourtTone::WhistleFrames < QuebecShowTone::PageFrames, "the whistle is as long as the page");
    double WhistlePeak = 0.;
    for (int Frame = 0; Frame < QuebecCourtTone::WhistleFrames; ++Frame)
        WhistlePeak = std::fmax(WhistlePeak, std::fabs(QuebecCourtTone::WhistleAt(Frame)));
    Expect(WhistlePeak > 0.02 && WhistlePeak <= QuebecCourtTone::WhistlePeak + 1e-9, "the whistle is silent or too hot");
    Expect(std::fabs(QuebecCourtTone::WhistleAt(QuebecCourtTone::WhistleFrames - 1)) < 0.02, "the whistle tail is still loud");
    Expect(QuebecCourtTone::WhistleAt(-1) == 0. && QuebecCourtTone::WhistleAt(QuebecCourtTone::WhistleFrames) == 0.,
        "the whistle plays outside its window");
    double RaspPeak = 0.;
    for (int Frame = 0; Frame < QuebecCourtTone::RaspFrames; ++Frame)
        RaspPeak = std::fmax(RaspPeak, std::fabs(QuebecCourtTone::RaspAt(Frame)));
    Expect(RaspPeak > 0.01 && RaspPeak <= QuebecCourtTone::RaspPeak + 1e-9, "the rasp is silent or too hot");
    Expect(std::fabs(QuebecCourtTone::RaspAt(QuebecCourtTone::RaspFrames - 1)) < 0.02, "the rasp tail is still loud");
    Expect(QuebecCourtTone::RaspAt(-1) == 0. && QuebecCourtTone::RaspAt(QuebecCourtTone::RaspFrames) == 0.,
        "the rasp plays outside its window");
    bool bWhistleDistinct = false;
    for (int Frame = 0; Frame < QuebecPondTone::TickFrames && Frame < QuebecCourtTone::WhistleFrames; ++Frame)
    {
        if (std::fabs(QuebecCourtTone::WhistleAt(Frame) - QuebecPondTone::SampleAt(Frame)) > 0.01)
        {
            bWhistleDistinct = true;
            break;
        }
    }
    Expect(bWhistleDistinct, "the whistle matches the pond tick");

    Expect(DangerSeconds(0) == SweepDangerSeconds, "a fresh chain keeps the taught ink");
    Expect(DangerSeconds(4) > DangerSeconds(0), "a held chain lengthens the ink");
    Expect(ClearSeconds(4) < ClearSeconds(0), "a held chain shortens the clear window");
    Expect(ClearSeconds(6) > 0.35, "a full chain still leaves a clear window");
    Expect(DangerSeconds(6) < SweepPeriod - SweepTelegraphSeconds, "the ink does not eat the warning");
    Expect(!SweepDanger(OnMiddle, 0) && SweepDanger(OnMiddle, 6), "the taught bank sample is ink once the chain is full");
    Expect(Apply(StepRedirect, EAct::Bank, BankPanel, OnMiddle, 0) == StepPull, "chain zero still accepts the taught bank");
    Expect(Apply(StepRedirect, EAct::Bank, BankPanel, OnMiddle, 6) == StepRedirect, "a full chain refuses the taught bank sample");
    Expect(!PartVisible(StepRedirect, PartInk, OnMiddle, 0) && PartVisible(StepRedirect, PartInk, OnMiddle, 6),
        "the ink mark does not grow with the chain");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
