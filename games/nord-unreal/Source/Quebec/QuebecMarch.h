#pragma once

// Engine-independent rules for mission 25, staying inside a march.
// No Unreal includes, so Scripts/test_march.py can build this with the system compiler.
// The march walks itself at a walk. You stay inside it. A sprint leaves out the front.
// A stop lets it leave you. At the end you step out. A car does not join and does not finish it.
// Leaving sends the march back to the start. Its place is not stored.
// A version-17 slot starts this march over.
// Mission 16 still burns lamps, holds a page, cuts grass, and tails a car. This does none of those.

#include <cmath>

namespace QuebecMarch
{
    inline constexpr int StepJoin = 0;
    inline constexpr int StepMarch = 1;
    inline constexpr int StepLeave = 2;
    inline constexpr int StepBanked = 3;

    // Lawn east of the slip and south of the cart. The march walks due south.
    inline constexpr double ColumnX = 13600.;
    inline constexpr double StartY = 16800.;
    inline constexpr double Length = 6400.;
    inline constexpr double Reach = 380.;
    inline constexpr double OutPast = 900.;
    inline constexpr double RecoverNorth = 700.;
    inline constexpr double Slice = 0.25;
    // The same pace as a walk. A sprint pulls out the front. A stop falls out the back.
    inline constexpr double MarchCmPerSecond = 450.;
    inline constexpr int Pay = 580;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepJoin;
        double Y = StartY;
        bool bLeft = false;
    };

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline bool InCircle(double X, double Y, double CX, double CY)
    {
        return Apart(X, Y, CX, CY) <= Reach;
    }

    inline FSpot Join()
    {
        return {ColumnX, StartY};
    }

    inline FSpot End()
    {
        return {ColumnX, StartY - Length};
    }

    inline FSpot Leave()
    {
        return {ColumnX, StartY - Length - OutPast};
    }

    inline FSpot Recover()
    {
        return {ColumnX, StartY + RecoverNorth};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepLeave && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bSlipBanked, int Step)
    {
        return bSlipBanked && Step >= StepJoin && Step < StepBanked;
    }

    // bOnFoot is a person on the ground. A car, a bike, and a swimmer are not.
    // One long frame only spends a quarter of a second. Arriving does not also step out.
    inline FRun Tick(FRun Now, double Seconds, bool bOnFoot, double X, double Y)
    {
        Now.bLeft = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepJoin)
        {
            if (bOnFoot && InCircle(X, Y, ColumnX, StartY))
            {
                Now.Step = StepMarch;
                Now.Y = StartY;
            }
            return Now;
        }
        if (Now.Step == StepMarch)
        {
            Now.Y -= MarchCmPerSecond * Seconds;
            const FSpot Stop = End();
            if (Now.Y < Stop.Y) Now.Y = Stop.Y;
            if (!(bOnFoot && InCircle(X, Y, ColumnX, Now.Y)))
            {
                Now.bLeft = true;
                Now.Step = StepJoin;
                Now.Y = StartY;
                return Now;
            }
            if (Now.Y <= Stop.Y) Now.Step = StepLeave;
            return Now;
        }
        if (!bOnFoot) return Now;
        const FSpot Out = Leave();
        if (!InCircle(X, Y, ColumnX, Now.Y) && InCircle(X, Y, Out.X, Out.Y)) Now.Step = StepBanked;
        return Now;
    }
}
