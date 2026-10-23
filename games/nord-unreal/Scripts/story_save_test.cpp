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
    Expect(Legacy == 1 && Rejected == 2 && Story == 3 && Escort == 4 && Shade == 5 && Grab == 6 && Cut == 7 && Chase == 8 && Current == 9, "the slot versions drifted");
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
        Expect(Accept(Story, Completed, None), "a version-3 race boundary was rejected");
        Expect(Accept(Escort, Completed, None), "a version-4 race boundary was rejected");
        Expect(Accept(Shade, Completed, None), "a version-5 race boundary was rejected");
        Expect(Accept(Grab, Completed, None), "a version-6 race boundary was rejected");
        Expect(Accept(Cut, Completed, None), "a version-7 race boundary was rejected");
        Expect(Accept(Chase, Completed, None), "a version-8 race boundary was rejected");
        Expect(Accept(Current, Completed, None), "a current race boundary with no story was rejected");
        Expect(!Accept(Rejected, Completed, None), "version 2 was accepted");
        Expect(!Accept(0, Completed, None), "version 0 was accepted");
        Expect(!Accept(10, Completed, None), "a later schema was accepted");
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
        && Done.Convoy == ConvoyBanked && Done.Blank == BlankBanked && Done.Tour == TourBanked && Done.Home == HomeBanked
        && Done.Escort == 0 && Done.Chase == 0 && Done.Finale == 0,
        "a finished day did not round-trip");
    FSteps WithCoat = Banked();
    WithCoat.Escort = 1;
    const FSteps FromStory = Applied(Story, WithCoat);
    Expect(FromStory.Home == HomeBanked && FromStory.Escort == 0, "a version-3 slot copied the escort");
    Expect(Accept(Current, 2, WithCoat), "a walk in progress was rejected");
    Expect(!Accept(Story, 2, WithCoat), "a version-3 slot carried the walk");
    WithCoat.Escort = EscortBanked;
    Expect(Accept(Current, 2, WithCoat), "a finished walk was rejected");
    WithCoat.Escort = EscortBanked + 1;
    Expect(!Accept(Current, 2, WithCoat), "a walk past the bank was accepted");
    WithCoat.Escort = 1;
    WithCoat.Home = 0;
    Expect(!Accept(Current, 2, WithCoat), "the walk started before the day was home");
    FSteps Lit = Banked();
    Lit.Escort = EscortBanked;
    Lit.Shade = 1;
    Expect(Accept(Current, 2, Lit), "a crossing in progress was rejected");
    Expect(!Accept(Escort, 2, Lit), "a version-4 slot carried the crossing");
    const FSteps FromEscort = Applied(Escort, Lit);
    Expect(FromEscort.Escort == EscortBanked && FromEscort.Shade == 0, "a version-4 slot copied the crossing");
    Lit.Shade = ShadeBanked;
    Expect(Accept(Current, 2, Lit), "a finished crossing was rejected");
    Lit.Shade = ShadeBanked + 1;
    Expect(!Accept(Current, 2, Lit), "a crossing past the bank was accepted");
    Lit.Shade = 1;
    Lit.Escort = 0;
    Expect(!Accept(Current, 2, Lit), "the crossing started before the walk was banked");
    FSteps Held = Banked();
    Held.Escort = EscortBanked;
    Held.Shade = ShadeBanked;
    Held.Grab = 1;
    Expect(Accept(Current, 2, Held), "a grab in progress was rejected");
    Expect(!Accept(Shade, 2, Held), "a version-5 slot carried the grab");
    const FSteps FromShade = Applied(Shade, Held);
    Expect(FromShade.Shade == ShadeBanked && FromShade.Grab == 0, "a version-5 slot copied the grab");
    Held.Grab = GrabBanked;
    Expect(Accept(Current, 2, Held), "a finished grab was rejected");
    Held.Grab = GrabBanked + 1;
    Expect(!Accept(Current, 2, Held), "a grab past the bank was accepted");
    Held.Grab = 1;
    Held.Shade = 0;
    Expect(!Accept(Current, 2, Held), "the grab started before the crossing was banked");
    FSteps Dared = Banked();
    Dared.Escort = EscortBanked;
    Dared.Shade = ShadeBanked;
    Dared.Grab = GrabBanked;
    Dared.Cut = 1;
    Expect(Accept(Current, 2, Dared), "a race in progress was rejected");
    Expect(!Accept(Grab, 2, Dared), "a version-6 slot carried the race");
    const FSteps FromGrab = Applied(Grab, Dared);
    Expect(FromGrab.Grab == GrabBanked && FromGrab.Cut == 0, "a version-6 slot copied the race");
    Dared.Cut = CutBanked;
    Expect(Accept(Current, 2, Dared), "a finished race was rejected");
    Dared.Cut = CutBanked + 1;
    Expect(!Accept(Current, 2, Dared), "a race past the bank was accepted");
    Dared.Cut = 1;
    Dared.Grab = 0;
    Expect(!Accept(Current, 2, Dared), "the race started before the grab was banked");
    FSteps Tailed = Banked();
    Tailed.Escort = EscortBanked;
    Tailed.Shade = ShadeBanked;
    Tailed.Grab = GrabBanked;
    Tailed.Cut = CutBanked;
    Tailed.Chase = 1;
    Expect(Accept(Current, 2, Tailed), "a chase in progress was rejected");
    Expect(Accept(Chase, 2, Tailed), "a version-8 chase was rejected");
    Expect(!Accept(Cut, 2, Tailed), "a version-7 slot carried the chase");
    const FSteps FromCut = Applied(Cut, Tailed);
    Expect(FromCut.Cut == CutBanked && FromCut.Chase == 0, "a version-7 slot copied the chase");
    Tailed.Chase = ChaseBanked;
    Expect(Accept(Current, 2, Tailed), "a finished chase was rejected");
    Tailed.Chase = ChaseBanked + 1;
    Expect(!Accept(Current, 2, Tailed), "a chase past the bank was accepted");
    Tailed.Chase = 1;
    Tailed.Cut = 0;
    Expect(!Accept(Current, 2, Tailed), "the chase started before the short way was banked");
    FSteps Day = Banked();
    Day.Escort = EscortBanked;
    Day.Shade = ShadeBanked;
    Day.Grab = GrabBanked;
    Day.Cut = CutBanked;
    Day.Chase = ChaseBanked;
    Day.Finale = 1;
    Expect(!Fresh(Day), "a finale step counted as a fresh day");
    Expect(Accept(Current, 2, Day), "a day in progress was rejected");
    Expect(!Accept(Chase, 2, Day), "a version-8 slot carried the day");
    const FSteps FromChase = Applied(Chase, Day);
    Expect(FromChase.Chase == ChaseBanked && FromChase.Finale == 0, "a version-8 slot copied the day");
    Day.Finale = FinaleBanked;
    Expect(Accept(Current, 2, Day), "a finished day was rejected");
    Day.Finale = FinaleBanked + 1;
    Expect(!Accept(Current, 2, Day), "a day past the bank was accepted");
    Day.Finale = 1;
    Day.Chase = 0;
    Expect(!Accept(Current, 2, Day), "the day started before the tail was lost");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
