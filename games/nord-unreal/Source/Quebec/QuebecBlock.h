#pragma once

// Engine-independent rules for mission 20, heading off a car.
// No Unreal includes, so Scripts/test_block.py can build this with the system compiler.
// A courier drives one surveyed road. They do not follow the player.
// The side street is the short way onto that road. Only a real car can start it or block it.
// A bike, a pedalo, a scooter, or a walker does not count. If the courier reaches the block first, the side street is back.
// The beat is stored on the version-13 tail. A version-12 slot starts it over.
// How far the courier has driven is not stored. The seven story banks stay seven.
// The tail in mission 15 still follows the player. This courier does not.

#include <cmath>

namespace QuebecBlock
{
    inline constexpr int StepSide = 0;
    inline constexpr int StepRun = 1;
    inline constexpr int StepBanked = 2;

    // Surveyed edge, north end to south end. The courier starts at the north end.
    inline constexpr double RoadAx = 12728.841;
    inline constexpr double RoadAy = -24734.191;
    inline constexpr double RoadBx = 25297.020;
    inline constexpr double RoadBy = -32941.814;
    // On that edge, where the side street meets it.
    inline constexpr double BlockX = 22823.537;
    inline constexpr double BlockY = -31326.511;
    // Far end of the side street. The near end meets the block.
    inline constexpr double SideX = 24421.186;
    inline constexpr double SideY = -33963.732;
    inline constexpr double RecoverX = 25881.204;
    inline constexpr double RecoverY = -35016.513;
    inline constexpr double Reach = 1400.;
    inline constexpr double Slice = 0.25;
    inline constexpr double CourierCmPerSecond = 1400.;
    inline constexpr int Pay = 380;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepSide;
        double Along = 0.;
        bool bPassed = false;
    };

    inline constexpr bool CountsAsCar(int Kind)
    {
        return Kind == 0;
    }

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline double Length()
    {
        return Apart(RoadAx, RoadAy, RoadBx, RoadBy);
    }

    inline double BlockAlong()
    {
        const double DX = RoadBx - RoadAx;
        const double DY = RoadBy - RoadAy;
        const double Whole = Length();
        if (Whole < 1e-6) return 0.;
        return ((BlockX - RoadAx) * DX + (BlockY - RoadAy) * DY) / Whole;
    }

    inline FSpot Place(double Along)
    {
        const double Whole = Length();
        if (Whole < 1e-6) return {RoadAx, RoadAy};
        if (Along < 0.) Along = 0.;
        if (Along > Whole) Along = Whole;
        const double Portion = Along / Whole;
        return {RoadAx + (RoadBx - RoadAx) * Portion, RoadAy + (RoadBy - RoadAy) * Portion};
    }

    inline bool InCircle(double X, double Y, double CX, double CY)
    {
        return Apart(X, Y, CX, CY) <= Reach;
    }

    inline bool InSide(double X, double Y) { return InCircle(X, Y, SideX, SideY); }
    inline bool InBlock(double X, double Y) { return InCircle(X, Y, BlockX, BlockY); }

    inline FSpot Recover() { return {RecoverX, RecoverY}; }

    inline int Purse(int Before, int After)
    {
        return Before == StepRun && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bBellBanked, int Step)
    {
        return bBellBanked && Step >= StepSide && Step < StepBanked;
    }

    // bInCar is a real car, kind 0. bAtSide starts the run. bAtBlock stops the courier only while they are still short of it.
    // One long frame only spends a quarter of a second. Nobody present leaves the courier where they are.
    inline FRun Tick(FRun Now, double Seconds, bool bInCar, bool bHaveBody, bool bAtSide, bool bAtBlock)
    {
        Now.bPassed = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepSide)
        {
            if (bInCar && bHaveBody && bAtSide)
            {
                Now.Step = StepRun;
                Now.Along = 0.;
            }
            return Now;
        }
        if (bInCar && bHaveBody && bAtBlock && Now.Along < BlockAlong())
        {
            Now.Step = StepBanked;
            return Now;
        }
        if (!bHaveBody) return Now;
        Now.Along += CourierCmPerSecond * Seconds;
        if (Now.Along >= BlockAlong())
        {
            Now.bPassed = true;
            Now.Along = 0.;
            Now.Step = StepSide;
        }
        return Now;
    }
}
