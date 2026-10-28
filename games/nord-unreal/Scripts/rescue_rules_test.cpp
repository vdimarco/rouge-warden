// Standalone test for Source/Quebec/QuebecRescueRules.h. Built by Scripts/test_rescue_rules.py.

#ifdef QUEBEC_RESCUE_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecRescueRules.h"
#include "../Source/Quebec/QuebecShowRules.h"
#include "../Source/Quebec/QuebecCourtRules.h"
#include "../Source/Quebec/QuebecPondRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecRescueRules;

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
        const QuebecPondRules::FSpot PondSpots[] = {
            QuebecPondRules::ShoreLookout, QuebecPondRules::Beams[0], QuebecPondRules::Beams[1], QuebecPondRules::Beams[2],
            QuebecPondRules::NearLock, QuebecPondRules::FarLock, QuebecPondRules::DashEnd, QuebecPondRules::Picnic
        };
        for (const QuebecPondRules::FSpot& PondSpot : PondSpots)
        {
            const QuebecJobRules::FJobSpot Other = {PondSpot.X, PondSpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps the pond scene", Name);
        }
        const QuebecCourtRules::FSpot CourtSpots[] = {
            QuebecCourtRules::Arrive, QuebecCourtRules::Panels[0], QuebecCourtRules::Panels[1], QuebecCourtRules::Panels[2],
            QuebecCourtRules::ReturnGate, QuebecCourtRules::Clamp
        };
        for (const QuebecCourtRules::FSpot& CourtSpot : CourtSpots)
        {
            const QuebecJobRules::FJobSpot Other = {CourtSpot.X, CourtSpot.Y, 0.};
            Expect(QuebecJobRules::Distance2D(Point, Other) >= QuebecJobRules::MinClearance, "%s overlaps the court", Name);
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
    Expect(Done == 7, "the done mask drifted");
    const char* Names[] = {"terrace", "pond", "court"};
    for (int Group = 0; Group < GroupCount; ++Group) ExpectClear(Names[Group], Posts[Group]);
    Expect(SpotDistance(Terrace, Pond) > Reach * 2., "the terrace group stands on the pond group");
    Expect(SpotDistance(Pond, Court) > Reach * 2., "the pond group stands on the court group");
    Expect(SpotDistance(Terrace, Court) > Reach * 2., "the terrace group stands on the court group");

    for (int Mask = 0; Mask < Done; ++Mask)
    {
        const FSpot Back = RecoverAt(Mask);
        const FSpot Goal = Objective(Mask);
        Expect(SpotDistance(Back, Goal) > Reach, "recover for mask %d completes that group", Mask);
        ExpectClear("recover", Back);
        if (Goal.X == Terrace.X) Expect(Back.X == Terrace.X + RecoverOffset, "the terrace recover stepped into the water");
        else Expect(Back.Y == Goal.Y - RecoverOffset, "recover for mask %d is not south of the group", Mask);
    }

    int Mask = 0;
    Mask = Apply(Mask, GroupTerrace);
    Expect(Mask == BitTerrace, "the terrace group did not bank");
    Mask = Apply(Mask, GroupTerrace);
    Expect(Mask == BitTerrace, "freeing the terrace again cleared another group");
    Mask = Apply(Mask, GroupPond);
    Expect(Mask == (BitTerrace | BitPond), "the pond group did not bank");
    Mask = Apply(Mask, GroupCourt);
    Expect(Mask == Done, "the court group did not finish the rescue");
    Expect(Apply(Mask, GroupTerrace) == Done, "a finished rescue accepted another group");

    int Other = Apply(Apply(Apply(0, GroupCourt), GroupTerrace), GroupPond);
    Expect(Other == Done, "court then terrace then pond did not finish");
    Expect(Apply(0, 9) == 0, "an unknown group changed the mask");
    Expect(Objective(0).X == Terrace.X && Objective(BitTerrace).X == Pond.X && Objective(BitTerrace | BitPond).X == Court.X,
        "the diamond does not lead to an open group");
    Expect(Objective(Done).X == Terrace.X, "a finished rescue lost its souvenir mark");

    Expect(PartVisible(0) && PartVisible(1) && PartVisible(2) && !PartVisible(-1) && !PartVisible(3), "a rescue post is hidden or an extra one shows");
    Expect(!OffersRescue(false, true, true, true, 0), "the rescue offers during mission 1");
    Expect(!OffersRescue(true, false, true, true, 0), "the rescue offers before the picnic");
    Expect(!OffersRescue(true, true, false, true, 0), "the rescue offers before the court");
    Expect(!OffersRescue(true, true, true, false, 0), "the rescue offers before the curtain");
    Expect(OffersRescue(true, true, true, true, 0) && OffersRescue(true, true, true, true, BitPond), "a banked show did not offer the rescue");
    Expect(!OffersRescue(true, true, true, true, Done), "a finished rescue still offers");
    Expect(!GuidesAfterRescue(true, true, true, true, BitCourt), "side jobs lead while a group is still in the picture");
    Expect(GuidesAfterRescue(true, true, true, true, Done), "a finished rescue did not return the side-job guide");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
