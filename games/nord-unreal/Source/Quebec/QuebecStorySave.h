#pragma once

// Engine-independent rules for the campaign slot.
// No Unreal includes, so Scripts/test_story_save.py can build this with the system compiler.
// Version 1 is the race boundary (completed missions 0–2) and has no story tail.
// Version 2 is the unsupported fixture the story slice plants on disk. It is never written.
// Version 3 keeps that same mission count and the eight story steps. It starts the escort and the crossing over.
// Version 4 adds the escort step and starts the crossing over.
// Version 5 adds the crossing. The chain, the hold clocks, the court misses, cash,
// the friend's place on the lawn, the lamp burn, and the side errands are not in this record.

namespace QuebecStorySave
{
    inline constexpr int Legacy = 1;
    inline constexpr int Rejected = 2;
    inline constexpr int Story = 3;
    inline constexpr int Escort = 4;
    inline constexpr int Current = 5;

    inline constexpr int PondBanked = 6;
    inline constexpr int CourtBanked = 4;
    inline constexpr int ShowBanked = 5;
    inline constexpr int RescueDone = 7;
    inline constexpr int ConvoyBanked = 4;
    inline constexpr int BlankBanked = 4;
    inline constexpr int TourBanked = 3;
    inline constexpr int HomeBanked = 3;
    inline constexpr int EscortBanked = 2;
    inline constexpr int ShadeBanked = 2;

    struct FSteps
    {
        int Pond = 0;
        int Court = 0;
        int Show = 0;
        int Rescue = 0;
        int Convoy = 0;
        int Blank = 0;
        int Tour = 0;
        int Home = 0;
        int Escort = 0;
        int Shade = 0;
    };

    inline bool InRange(int Value, int Hi)
    {
        return Value >= 0 && Value <= Hi;
    }

    inline bool Fresh(const FSteps& Steps)
    {
        return Steps.Pond == 0 && Steps.Court == 0 && Steps.Show == 0 && Steps.Rescue == 0
            && Steps.Convoy == 0 && Steps.Blank == 0 && Steps.Tour == 0             && Steps.Home == 0
            && Steps.Escort == 0
            && Steps.Shade == 0;
    }

    // A later beat may move only after the one before it is banked.
    inline bool StepsFit(const FSteps& Steps)
    {
        if (!InRange(Steps.Pond, PondBanked) || !InRange(Steps.Court, CourtBanked)
            || !InRange(Steps.Show, ShowBanked) || !InRange(Steps.Rescue, RescueDone)
            || !InRange(Steps.Convoy, ConvoyBanked) || !InRange(Steps.Blank, BlankBanked)
            || !InRange(Steps.Tour, TourBanked) || !InRange(Steps.Home, HomeBanked)
            || !InRange(Steps.Escort, EscortBanked)
            || !InRange(Steps.Shade, ShadeBanked))
            return false;
        if (Steps.Court > 0 && Steps.Pond != PondBanked) return false;
        if (Steps.Show > 0 && (Steps.Pond != PondBanked || Steps.Court != CourtBanked)) return false;
        if (Steps.Rescue > 0 && (Steps.Pond != PondBanked || Steps.Court != CourtBanked || Steps.Show != ShowBanked))
            return false;
        if (Steps.Convoy > 0 && (Steps.Show != ShowBanked || Steps.Rescue != RescueDone)) return false;
        if (Steps.Blank > 0 && (Steps.Rescue != RescueDone || Steps.Convoy != ConvoyBanked)) return false;
        if (Steps.Tour > 0 && (Steps.Convoy != ConvoyBanked || Steps.Blank != BlankBanked)) return false;
        if (Steps.Home > 0 && (Steps.Blank != BlankBanked || Steps.Tour != TourBanked)) return false;
        if (Steps.Escort > 0 && Steps.Home != HomeBanked) return false;
        if (Steps.Shade > 0 && Steps.Escort != EscortBanked) return false;
        return true;
    }

    inline bool Accept(int Version, int Completed, const FSteps& Steps)
    {
        if (Completed < 0 || Completed > 2) return false;
        if (Version == Legacy) return Fresh(Steps);
        if (Version == Story)
        {
            if (Steps.Escort != 0 || Steps.Shade != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Escort)
        {
            if (Steps.Shade != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version != Current) return false;
        if (Completed < 2 && !Fresh(Steps)) return false;
        return StepsFit(Steps);
    }

    // A legacy slot never copies a story tail. A version-3 slot never copies the escort or the crossing.
    // A version-4 slot never copies the crossing. Call this only after Accept.
    inline FSteps Applied(int Version, const FSteps& Steps)
    {
        if (Version == Legacy) return {};
        if (Version == Story)
        {
            FSteps Copy = Steps;
            Copy.Escort = 0;
            Copy.Shade = 0;
            return Copy;
        }
        if (Version == Escort)
        {
            FSteps Copy = Steps;
            Copy.Shade = 0;
            return Copy;
        }
        return Steps;
    }
}
