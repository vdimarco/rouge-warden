#pragma once

// Engine-independent rules for mission 17, keeping a gap behind a walker.
// No Unreal includes, so Scripts/test_follow.py can build this with the system compiler.
// They walk their own line at a walk. They do not follow the player, and they do not chase.
// A matched walk keeps the gap. A sprint closes it and sends them back to the corner.
// A stop lets them walk out of reach and sends them back to the corner. A car does not count.
// The beat is stored on the version-10 tail. A version-9 slot starts it over.
// How far they have walked is not stored. The seven story banks stay seven.

#include <cmath>

namespace QuebecFollow
{
    inline constexpr int StepMeet = 0;
    inline constexpr int StepFollow = 1;
    inline constexpr int StepBanked = 2;

    // North lawn, west of the short way and the escort. They walk due south.
    inline constexpr double CornerX = 20000.;
    inline constexpr double CornerY = 22000.;
    inline constexpr double StopX = 20000.;
    inline constexpr double StopY = 15600.;
    inline constexpr double Behind = 1200.;
    inline constexpr double Reach = 450.;
    inline constexpr double RecoverNorth = 700.;
    // Inside this, including a tie, they feel crowded. Outside the leash, including a tie, they notice you are gone.
    inline constexpr double Spook = 600.;
    inline constexpr double Leash = 2800.;
    // The same pace as a walk, so holding walk keeps the gap and holding sprint closes it.
    inline constexpr double Speed = 450.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 400;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FGap
    {
        int Step = StepMeet;
        double Along = 0.;
        bool bCrowded = false;
        bool bLost = false;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline double Length()
    {
        return std::fabs(CornerY - StopY);
    }

    inline FSpot Place(double Along)
    {
        if (Along < 0.) Along = 0.;
        const double Whole = Length();
        if (Along > Whole) Along = Whole;
        return {CornerX, CornerY - Along};
    }

    inline FSpot Meet() { return {CornerX, CornerY + Behind}; }
    inline FSpot Stop() { return {StopX, StopY}; }

    inline FSpot Recover(int Step, double Along)
    {
        if (Step == StepFollow)
        {
            const FSpot There = Place(Along);
            return {There.X, There.Y + Behind};
        }
        const FSpot Door = Meet();
        return {Door.X, Door.Y + RecoverNorth};
    }

    inline bool InCircle(double X, double Y, double CX, double CY, double Radius)
    {
        return Gap(X, Y, CX, CY) <= Radius;
    }

    inline bool InMeet(double X, double Y)
    {
        const FSpot Door = Meet();
        return InCircle(X, Y, Door.X, Door.Y, Reach);
    }

    inline bool InBand(double Distance)
    {
        return Distance > Spook && Distance < Leash;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepFollow && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bFinaleBanked, int Step)
    {
        return bFinaleBanked && Step >= StepMeet && Step < StepBanked;
    }

    // bOnFoot is a walker. bCrowded is true when any walker is inside the spook, including a partner.
    // One long frame only spends a quarter of a second. A fail returns them to the corner and stays on this step.
    inline FGap Tick(FGap Now, double Seconds, bool bOnFoot, bool bHaveBody, bool bCrowded, double X, double Y)
    {
        Now.bCrowded = false;
        Now.bLost = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepMeet)
        {
            if (bOnFoot && bHaveBody && InMeet(X, Y))
            {
                Now.Step = StepFollow;
                Now.Along = 0.;
            }
            return Now;
        }
        const FSpot There = Place(Now.Along);
        const double Distance = bHaveBody ? Gap(X, Y, There.X, There.Y) : Leash;
        const bool bHeld = bHaveBody && bOnFoot && !bCrowded && InBand(Distance);
        if (!bHeld)
        {
            Now.bCrowded = bCrowded || (bHaveBody && bOnFoot && Distance <= Spook);
            Now.bLost = !Now.bCrowded;
            Now.Along = 0.;
            return Now;
        }
        Now.Along += Speed * Seconds;
        if (Now.Along >= Length())
        {
            Now.Along = Length();
            Now.Step = StepBanked;
        }
        return Now;
    }
}
