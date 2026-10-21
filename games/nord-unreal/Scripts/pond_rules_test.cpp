// Standalone test for Source/Quebec/QuebecPondRules.h. Built and run by Scripts/test_pond_rules.py.
// QUEBEC_POND_STRICT poisons Unreal names before the header is read, so the header cannot use them.

#ifdef QUEBEC_POND_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecPondRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecPondRules;

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
            "%s clearance %.0f is under %.0f", Name, QuebecJobRules::Clearance(Point), QuebecJobRules::MinClearance);
        Expect(Spot.Y >= 11400., "%s y %.0f is south of the land line", Name, Spot.Y);
        for (const QuebecJobRules::FJobSpot& Marker : QuebecJobRules::Markers)
            Expect(QuebecJobRules::Distance2D(Point, Marker) >= QuebecJobRules::MinClearance,
                "%s overlaps a side-job marker", Name);
        Expect(QuebecJobRules::Distance2D(Point, QuebecJobRules::GoonArena) >= QuebecJobRules::MinClearance,
            "%s overlaps the goon arena", Name);
        for (const QuebecJobRules::FJobSpot& Spawn : QuebecJobRules::GoonSpawns)
            Expect(QuebecJobRules::Distance2D(Point, Spawn) >= QuebecJobRules::MinClearance,
                "%s overlaps a goon spawn", Name);
        Expect(QuebecJobRules::Distance2D(Point, QuebecJobRules::DeliveryCafe) >= QuebecJobRules::MinClearance,
            "%s overlaps the delivery café", Name);
        for (const QuebecJobRules::FJobSpot& Door : QuebecJobRules::DeliveryDoors)
            Expect(QuebecJobRules::Distance2D(Point, Door) >= QuebecJobRules::MinClearance,
                "%s overlaps a delivery door", Name);
        Expect(QuebecJobRules::Distance2D(Point, QuebecJobRules::ThiefStart) >= QuebecJobRules::MinClearance,
            "%s overlaps the thief start", Name);
        Expect(QuebecJobRules::Distance2D(Point, QuebecJobRules::EscapeGarage) >= QuebecJobRules::MinClearance,
            "%s overlaps the escape garage", Name);
    }
}

int main()
{
    Expect(StepBanked == 6, "banked step index drifted from the campaign constant");

    const FSpot PlaySpots[] = {ShoreLookout, Beams[0], Beams[1], Beams[2], NearLock, FarLock, DashEnd, Picnic};
    const char* Names[] = {"shore", "beam0", "beam1", "beam2", "near", "far", "dash", "picnic"};
    for (int Index = 0; Index < 8; ++Index)
    {
        ExpectClear(Names[Index], PlaySpots[Index]);
        const FSpot Back = {PlaySpots[Index].X, PlaySpots[Index].Y + RecoverNorth, 0.};
        ExpectClear(Names[Index], Back);
    }

    Expect(SpotDistance(Beams[0], Beams[1]) > Reach * 2., "beam 0 and the postcard overlap");
    Expect(SpotDistance(Beams[1], Beams[2]) > Reach * 2., "beam 2 and the postcard overlap");
    Expect(SpotDistance(Beams[0], Beams[2]) > Reach * 2., "the decoy beams overlap");
    Expect(SpotDistance(ShoreLookout, Beams[FalseBeam]) > Reach, "the lookout stands on the postcard beam");
    Expect(SpotDistance(Beams[FalseBeam], NearLock) > Reach, "tagging the postcard also hits the near lock");
    Expect(SpotDistance(NearLock, FarLock) > DashWasFar, "the second lock is not a new path");
    Expect(SpotDistance(FarLock, DashEnd) > DashWasFar, "the exposed path is shorter than a step");
    Expect(SpotDistance(DashEnd, Picnic) > Reach, "sprinting the path also pulls the clamp");
    Expect(FarLock.X > Beams[FalseBeam].X, "the second lock does not move the route east");

    for (int Step = StepShore; Step <= StepPull; ++Step)
    {
        const FSpot Back = RecoverAt(Step);
        Expect(Back.Y == Objective(Step).Y + RecoverNorth, "recover for step %d is not north of the step", Step);
        Expect(SpotDistance(Back, Objective(Step)) > Reach, "recover for step %d completes the step", Step);
        Expect(SpotDistance(Back, Objective(Step)) > DashWasFar, "recover for step %d does not arm the dash", Step);
    }

    int Step = StepShore;
    Step = Apply(Step, EAct::Use, FalseBeam, true);
    Expect(Step == StepShore, "using the lookout skipped the watch");
    Step = Apply(Step, EAct::Arrive, -1, false);
    Expect(Step == StepTag, "arriving at the shore did not open the beams");
    Step = Apply(Step, EAct::Tag, 0, false);
    Expect(Step == StepTag, "a blinking beam advanced the postcard");
    Step = Apply(Step, EAct::Tag, 2, true);
    Expect(Step == StepTag, "the east decoy advanced the postcard");
    Step = Apply(Step, EAct::Tag, FalseBeam, false);
    Expect(Step == StepNear, "the steady beam did not open the near lock");
    Step = Apply(Step, EAct::Arrive, FalseBeam, true);
    Expect(Step == StepNear, "arriving again skipped a lock");
    Step = Apply(Step, EAct::Use, -1, false);
    Expect(Step == StepFar, "the near lock did not peel the sheet east");
    Step = Apply(Step, EAct::Use, -1, false);
    Expect(Step == StepDash, "the far lock did not open the path");
    Step = Apply(Step, EAct::SprintIn, -1, false);
    Expect(Step == StepDash, "walking the path pulled the picnic");
    Step = Apply(Step, EAct::Use, -1, true);
    Expect(Step == StepDash, "using the path skipped the sprint");
    Step = Apply(Step, EAct::SprintIn, -1, true);
    Expect(Step == StepPull, "sprinting the path did not reach the clamp");
    Step = Apply(Step, EAct::SprintIn, -1, true);
    Expect(Step == StepPull, "sprinting again skipped the pull");
    Step = Apply(Step, EAct::Use, -1, false);
    Expect(Step == StepBanked, "pulling the clamp did not bank the picnic");
    Step = Apply(Step, EAct::Use, FalseBeam, true);
    Expect(Step == StepBanked, "a banked picnic accepted another action");
    Expect(Apply(-1, EAct::Arrive, FalseBeam, true) == -1, "an unknown step moved");

    Expect(Objective(StepShore).Y == ShoreLookout.Y, "shore objective drifted");
    Expect(Objective(StepTag).X == Beams[FalseBeam].X && Objective(StepTag).Y == Beams[FalseBeam].Y, "tag objective is not the postcard");
    Expect(Objective(StepNear).Y == NearLock.Y, "near objective drifted");
    Expect(Objective(StepFar).X == FarLock.X, "far objective drifted");
    Expect(Objective(StepDash).X == DashEnd.X, "dash objective drifted");
    Expect(Objective(StepPull).X == Picnic.X, "pull objective drifted");
    Expect(Objective(StepBanked).X == Picnic.X, "a banked card lost the picnic");

    bool bWasFar = false;
    NoteDash(bWasFar, 200.);
    Expect(!bWasFar, "standing on the finish armed the dash");
    Expect(!SprintCross(bWasFar, 300., 270., SprintSpeed), "a close sprint counted before the path was armed");
    NoteDash(bWasFar, DashWasFar);
    Expect(!bWasFar, "the arming line is inclusive of the near side");
    NoteDash(bWasFar, DashWasFar + 0.1);
    Expect(bWasFar, "a far sample did not arm the dash");
    Expect(!SprintCross(bWasFar, 800., 760., SprintSpeed), "still outside the ring counted as a finish");
    Expect(!SprintCross(bWasFar, Reach, Reach, SprintSpeed), "already inside the ring counted as a crossing");
    Expect(!SprintCross(bWasFar, Reach + 0.1, Reach, SprintSpeed - 0.1), "a walk across the ring counted");
    Expect(SprintCross(bWasFar, Reach + 0.1, Reach, SprintSpeed), "a sprint across the ring did not count");
    Expect(!SprintCross(false, Reach + 0.1, Reach, 800.), "an unarmed sprint counted");
    Expect(!SprintCross(bWasFar, 200., 180., 800.), "sprinting in place at the finish counted");

    Expect(BeamLit(FalseBeam, 0.), "the postcard was dark at the start of the blink");
    Expect(BeamLit(FalseBeam, 1.5), "the postcard blinked off");
    Expect(BeamLit(FalseBeam, 100.), "the postcard blinked off late");
    Expect(BeamLit(0, 0.), "a decoy was dark during the on half");
    Expect(!BeamLit(0, BlinkOn), "a decoy stayed lit into the off half");
    Expect(!BeamLit(2, 1.5), "the east decoy stayed lit in the off half");
    Expect(BeamLit(0, BlinkPeriod), "a decoy missed the next on half");
    Expect(BeamLit(2, -0.1) == BeamLit(0, -0.1), "the decoys disagreed");
    int Lit = 0;
    int Which = -1;
    for (int Beam = 0; Beam < BeamCount; ++Beam)
        if (BeamLit(Beam, 1.5)) { ++Lit; Which = Beam; }
    Expect(Lit == 1 && Which == FalseBeam, "the off half did not leave exactly the postcard lit");

    Expect(PartVisible(StepShore, 0, 1.5) && !PartVisible(StepShore, 2, 0.), "the shore shows the wrong post");
    Expect(PartVisible(StepTag, 1 + FalseBeam, 1.5), "the postcard post hides in the off half");
    Expect(!PartVisible(StepTag, 1, 1.5) && !PartVisible(StepTag, 3, 1.5), "a decoy post stays up in the off half");
    Expect(PartVisible(StepTag, 1, 0.) && PartVisible(StepTag, 3, 0.), "decoy posts hide during the on half");
    Expect(PartVisible(StepNear, 4, 0.) && !PartVisible(StepNear, 5, 0.), "the near lock shows the far post");
    Expect(PartVisible(StepFar, 5, 0.) && !PartVisible(StepFar, 6, 0.), "the far lock shows the dash post");
    Expect(PartVisible(StepDash, 6, 0.) && !PartVisible(StepDash, PartPicnic, 0.), "the dash shows the picnic");
    Expect(PartVisible(StepPull, PartPicnic, 0.) && !PartVisible(StepPull, 0, 0.), "the pull shows the shore");
    Expect(PartVisible(StepBanked, PartPicnic, 1.5) && !PartVisible(StepBanked, 2, 0.), "a banked picnic hid the souvenir");
    Expect(!PartVisible(StepShore, -1, 0.) && !PartVisible(StepShore, PartCount, 0.), "an unknown post is visible");

    Expect(!OffersPond(false, StepShore), "mission 3 offers during mission 1");
    Expect(OffersPond(true, StepShore) && OffersPond(true, StepPull), "a finished race did not offer the pond");
    Expect(!OffersPond(true, StepBanked), "a banked picnic still offers the pond");
    Expect(!GuidesSideJobs(true, StepPull), "side jobs lead while the picnic is in the picture");
    Expect(GuidesSideJobs(true, StepBanked), "a banked picnic did not return the side-job guide");
    Expect(!GuidesSideJobs(false, StepBanked), "side jobs lead before the race is banked");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
