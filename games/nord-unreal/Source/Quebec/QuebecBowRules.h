#pragma once

// Engine-independent rules for the bow on the Théâtre de Verdure stage.
// No Unreal includes, so Scripts/test_bow_rules.py can build and run it.
// After the goon fight, one player holds the stage light. Nothing here is saved,
// and nothing here touches the job pays or the story chain.

#include <cstdint>

namespace QuebecBow
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    // On the stage lawn, 18 m from the goon marker toward the arena centre, so E here is not E on the M.
    inline constexpr FSpot Spot{-13366., 5258., 0.};
    inline constexpr double Reach = 200.;
    inline constexpr double HoldRadius = 900.;
    inline constexpr float HoldSeconds = 12.f;
    inline constexpr float GraceSeconds = 2.f;
    inline constexpr int Pay = 150;

    inline bool CanStart(bool bGoonsWon, bool bJobRunning, bool bStoryOpen, bool bDone, bool bDown, bool bInCar)
    {
        return bGoonsWon && !bJobRunning && !bStoryOpen && !bDone && !bDown && !bInCar;
    }

    // The mark on the radar and the sign, including while the light is being held.
    inline bool Listed(bool bGoonsWon, bool bJobRunning, bool bDone)
    {
        return bGoonsWon && !bJobRunning && !bDone;
    }

    struct FHold
    {
        float Inside = 0.f;
        float Outside = 0.f;
        bool bDone = false;
        bool bDropped = false;
    };

    // The clock runs only in the light. Outside, it pauses, and too long outside drops the bow.
    inline FHold Advance(float Inside, float Outside, bool bInside, float Dt)
    {
        FHold Out;
        if (!(Dt > 0.f)) Dt = 0.f;
        if (bInside)
        {
            Out.Inside = Inside + Dt;
            Out.Outside = 0.f;
            Out.bDone = Out.Inside >= HoldSeconds;
        }
        else
        {
            Out.Inside = Inside;
            Out.Outside = Outside + Dt;
            Out.bDropped = Out.Outside > GraceSeconds;
        }
        return Out;
    }
}
