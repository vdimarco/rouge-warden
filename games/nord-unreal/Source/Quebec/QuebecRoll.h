#pragma once

// Engine-independent rules for mission 18, rolling a cart.
// No Unreal includes, so Scripts/test_roll.py can build this with the system compiler.
// The cart does not move by itself. It rolls only while someone walks at the handles.
// A stop leaves it where it is. A sprint tips it back to the start. A car does not push it.
// The beat is stored on the version-11 tail. A version-10 slot starts it over.
// How far it has rolled is not stored. The seven story banks stay seven.

#include <cmath>

namespace QuebecRoll
{
    inline constexpr int StepReady = 0;
    inline constexpr int StepRoll = 1;
    inline constexpr int StepBanked = 2;

    // West of the follow line, on the same open north lawn.
    inline constexpr double StartX = 16800.;
    inline constexpr double StartY = 21000.;
    inline constexpr double StopX = 16800.;
    inline constexpr double StopY = 15000.;
    inline constexpr double Behind = 160.;
    inline constexpr double Reach = 220.;
    inline constexpr double RecoverNorth = 700.;
    inline constexpr double Speed = 450.;
    // Above a walk and below a sprint. The campaign treats anything faster than this, at the handles, as a tip.
    inline constexpr double SprintAbove = 625.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 360;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FCart
    {
        int Step = StepReady;
        double Along = 0.;
        bool bTipped = false;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline double Length()
    {
        return std::fabs(StartY - StopY);
    }

    inline FSpot Place(double Along)
    {
        if (Along < 0.) Along = 0.;
        const double Whole = Length();
        if (Along > Whole) Along = Whole;
        return {StartX, StartY - Along};
    }

    inline FSpot Handles(double Along)
    {
        const FSpot Cart = Place(Along);
        return {Cart.X, Cart.Y + Behind};
    }

    inline FSpot Stop() { return {StopX, StopY}; }

    inline FSpot Recover(int Step, double Along)
    {
        const FSpot Hands = Handles(Step == StepRoll ? Along : 0.);
        if (Step == StepRoll) return Hands;
        return {Hands.X, Hands.Y + RecoverNorth};
    }

    inline bool InHandles(double X, double Y, double Along)
    {
        const FSpot Hands = Handles(Along);
        return Gap(X, Y, Hands.X, Hands.Y) <= Reach;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepRoll && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bFollowBanked, int Step)
    {
        return bFollowBanked && Step >= StepReady && Step < StepBanked;
    }

    // bOnFoot is a walker at the handles. bSprinting tips the cart. One long frame only spends a quarter of a second.
    // Leaving the handles does not move it and does not tip it.
    inline FCart Tick(FCart Now, double Seconds, bool bOnFoot, bool bHaveBody, bool bSprinting, double X, double Y)
    {
        Now.bTipped = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepReady)
        {
            if (bOnFoot && bHaveBody && InHandles(X, Y, 0.))
            {
                Now.Step = StepRoll;
                Now.Along = 0.;
            }
            return Now;
        }
        if (!(bOnFoot && bHaveBody && InHandles(X, Y, Now.Along))) return Now;
        if (bSprinting)
        {
            Now.bTipped = true;
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
