#pragma once

// Engine-independent rules for mission 22, catching a traffic car.
// No Unreal includes, so Scripts/test_pursue.py can build this with the system compiler.
// The car cruises one surveyed avenue at the traffic straight-line speed. It does not steer toward the player.
// A real car alongside it, before the avenue ends, banks the beat. A walker does not.
// If it reaches the end first, it is ahead again. How far it has driven is not stored.
// A version-14 slot starts this pursuit over.
// The tail in mission 15 still follows the player. The courier in mission 20 still aims at a point.

#include <cmath>

namespace QuebecPursue
{
    inline constexpr int StepHunt = 0;
    inline constexpr int StepBanked = 1;

    // Surveyed avenue. The traffic car is already ahead of the near end.
    inline constexpr double RoadAx = 7749.923;
    inline constexpr double RoadAy = -21373.440;
    inline constexpr double RoadBx = -7289.778;
    inline constexpr double RoadBy = -11630.714;
    inline constexpr double HeadStart = 2800.;
    inline constexpr double Catch = 800.;
    inline constexpr double RecoverBack = 1800.;
    inline constexpr double Slice = 0.25;
    // Traffic on a straight asks for 570 + 40 * (paint % 4). Paint 2 is 650.
    inline constexpr double CruiseCmPerSecond = 650.;
    inline constexpr int Pay = 460;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepHunt;
        double Along = HeadStart;
        bool bGone = false;
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

    inline FSpot Place(double Along)
    {
        const double Whole = Length();
        if (Whole < 1e-6) return {RoadAx, RoadAy};
        if (Along < 0.) Along = 0.;
        if (Along > Whole) Along = Whole;
        const double T = Along / Whole;
        return {RoadAx + (RoadBx - RoadAx) * T, RoadAy + (RoadBy - RoadAy) * T};
    }

    inline FSpot Recover()
    {
        const double Whole = Length();
        if (Whole < 1e-6) return {RoadAx, RoadAy};
        const double UX = (RoadBx - RoadAx) / Whole;
        const double UY = (RoadBy - RoadAy) / Whole;
        return {RoadAx - UX * RecoverBack, RoadAy - UY * RecoverBack};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepHunt && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bSendBanked, int Step)
    {
        return bSendBanked && Step >= StepHunt && Step < StepBanked;
    }

    // CarX and CarY are the chasing car. One long frame only spends a quarter of a second.
    // The cruise is applied before the catch, so you meet the car where it is now.
    inline FRun Tick(FRun Now, double Seconds, bool bInCar, bool bHaveBody, double CarX, double CarY)
    {
        Now.bGone = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (!bHaveBody) return Now;
        Now.Along += CruiseCmPerSecond * Seconds;
        if (Now.Along >= Length())
        {
            Now.bGone = true;
            Now.Along = HeadStart;
            return Now;
        }
        const FSpot Spot = Place(Now.Along);
        if (bInCar && Apart(CarX, CarY, Spot.X, Spot.Y) <= Catch) Now.Step = StepBanked;
        return Now;
    }
}
