// Standalone test for Source/Quebec/QuebecStorySave.h. Built by Scripts/test_story_save.py.

#ifdef QUEBEC_STORY_SAVE_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecStorySave.h"
#include "../Source/Quebec/QuebecPondRules.h"
#include "../Source/Quebec/QuebecCourtRules.h"
#include "../Source/Quebec/QuebecShowRules.h"
#include "../Source/Quebec/QuebecRescueRules.h"
#include "../Source/Quebec/QuebecConvoyRules.h"
#include "../Source/Quebec/QuebecBlankRules.h"
#include "../Source/Quebec/QuebecTour.h"
#include "../Source/Quebec/QuebecHome.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecStorySave;

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

    FSteps Steps(int Pond, int Court = 0, int Show = 0, int Rescue = 0, int Convoy = 0, int Blank = 0, int Tour = 0, int Home = 0)
    {
        return {Pond, Court, Show, Rescue, Convoy, Blank, Tour, Home};
    }

    FSteps Banked()
    {
        return Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, BlankBanked, TourBanked, HomeBanked);
    }
}

int main()
{
    Expect(Legacy == 1 && Rejected == 2 && Current == 3, "the slot versions drifted");
    Expect(Current != Rejected, "the writer would plant the unsupported fixture");
    Expect(PondBanked == QuebecPondRules::StepBanked, "the pond bank left the save");
    Expect(CourtBanked == QuebecCourtRules::StepBanked, "the court bank left the save");
    Expect(ShowBanked == QuebecShowRules::StepBanked, "the show bank left the save");
    Expect(RescueDone == QuebecRescueRules::Done, "the rescue mask left the save");
    Expect(ConvoyBanked == QuebecConvoyRules::StepBanked, "the convoy bank left the save");
    Expect(BlankBanked == QuebecBlankRules::StepBanked, "the blank-page bank left the save");
    Expect(TourBanked == QuebecTour::StepBanked, "the tour bank left the save");
    Expect(HomeBanked == QuebecHome::StepBanked, "the home bank left the save");

    const FSteps None{};
    Expect(Fresh(None), "a zero record is not a fresh day");
    Expect(!Fresh(Steps(1)), "a pond step counted as a fresh day");
    for (int Completed = 0; Completed <= 2; ++Completed)
    {
        Expect(Accept(Legacy, Completed, None), "a legacy race boundary was rejected");
        Expect(Accept(Current, Completed, None), "a current race boundary with no story was rejected");
        Expect(!Accept(Rejected, Completed, None), "version 2 was accepted");
        Expect(!Accept(0, Completed, None), "version 0 was accepted");
        Expect(!Accept(4, Completed, None), "a later schema was accepted");
    }
    Expect(!Accept(Legacy, -1, None), "a missing mission count was accepted");
    Expect(!Accept(Legacy, 3, None), "completed missions 3 were accepted on a legacy slot");
    Expect(!Accept(Current, 3, None), "completed missions 3 were accepted on the story slot");
    Expect(!Accept(Current, 3, Banked()), "a finished day with missions 3 was accepted");

    Expect(Accept(Current, 2, Steps(4)), "a mid-pond day was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked)), "a banked pond was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, 2)), "a mid-court day was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, CourtBanked, 3)), "a mid-show day was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, 5)), "a partial rescue was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, 2)), "a mid-convoy day was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, 2)), "a mid-page day was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, BlankBanked, 1)), "a mid-tour day was rejected");
    Expect(Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, BlankBanked, TourBanked, 2)), "a mid-home day was rejected");
    Expect(Accept(Current, 2, Banked()), "a finished day was rejected");

    Expect(!Accept(Current, 2, Steps(PondBanked + 1)), "a pond step past the bank was accepted");
    Expect(!Accept(Current, 2, Steps(-1)), "a negative pond step was accepted");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked + 1)), "a court step past the bank was accepted");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone + 1)), "a rescue mask past done was accepted");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, BlankBanked, TourBanked + 1)), "a tour step past the bank was accepted");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, BlankBanked, TourBanked, HomeBanked + 1)), "a home step past the bank was accepted");

    Expect(!Accept(Current, 2, Steps(3, 1)), "the court moved before the pond was banked");
    Expect(!Accept(Current, 2, Steps(PondBanked, 2, 1)), "the show moved before the court was banked");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, 2, 1)), "the rescue moved before the show was banked");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, 3, 1)), "the convoy moved before every group was out");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, 2, 1)), "the page moved before the convoy was banked");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, 2, 1)), "the tour moved before the page was blank");
    Expect(!Accept(Current, 2, Steps(PondBanked, CourtBanked, ShowBanked, RescueDone, ConvoyBanked, BlankBanked, 1, 1)), "the day moved before the tour was banked");
    Expect(!Accept(Current, 1, Steps(1)), "story progress was stored before the race was finished");
    Expect(!Accept(Current, 0, Banked()), "a finished day was stored on an unstarted race");
    Expect(!Accept(Legacy, 2, Steps(4)), "a legacy slot carried a pond step");
    Expect(!Accept(Legacy, 2, Banked()), "a legacy slot carried a finished day");
    Expect(!Accept(Rejected, 2, Banked()), "version 2 carried a finished day");

    const FSteps Stuffed = Steps(4);
    const FSteps FromLegacy = Applied(Legacy, Stuffed);
    Expect(Fresh(FromLegacy), "a legacy slot copied its tail into the day");
    const FSteps Kept = Applied(Current, Steps(PondBanked, 2));
    Expect(Kept.Pond == PondBanked && Kept.Court == 2 && Kept.Show == 0 && Kept.Home == 0, "a current slot dropped the open beat");
    const FSteps Done = Applied(Current, Banked());
    Expect(Done.Pond == PondBanked && Done.Court == CourtBanked && Done.Show == ShowBanked && Done.Rescue == RescueDone
        && Done.Convoy == ConvoyBanked && Done.Blank == BlankBanked && Done.Tour == TourBanked && Done.Home == HomeBanked,
        "a finished day did not round-trip");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
