#pragma once

// Engine-independent rules for mission 23, backing a car into a stall.
// No Unreal includes, so Scripts/test_nose.py can build this with the system compiler.
// The stall sits on a surveyed road. The line-up is further toward the far end.
// A real car inside the stall, reversing, with its nose toward that far end, banks the beat.
// A stop, a forward roll, and a walker do not. The send-off still wants a full stop.
// The pursuit still meets a car that keeps its own lane. Nothing about this reverse is stored.
// A version-15 slot starts this stall over.

#include <cmath>

namespace QuebecNose
{
    inline constexpr int StepBack = 0;
    inline constexpr int StepBanked = 1;

    // Surveyed road, north of the park. The stall is on the centre. The line-up is further along.
    inline constexpr double RoadAx = 44495.179;
    inline constexpr double RoadAy = 23662.179;
    inline constexpr double RoadBx = 46161.057;
    inline constexpr double RoadBy = 31394.466;
    inline constexpr double StallAlong = 3200.;
    inline constexpr double RecoverAhead = 2400.;
    inline constexpr double Reach = 900.;
    // Player reverse clamps at -950. This is a committed reverse, past a crawl.
    inline constexpr double ReverseMin = 400.;
    // Nose points toward the far end. A sideways car does not count.
    inline constexpr double Align = 0.55;
    inline constexpr int Pay = 440;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepBack;
        bool bIn = false;
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

    inline FSpot Stall()
    {
        return Place(StallAlong);
    }

    inline FSpot Recover()
    {
        return Place(StallAlong + RecoverAhead);
    }

    inline FSpot Outward()
    {
        const double Whole = Length();
        if (Whole < 1e-6) return {1., 0.};
        return {(RoadBx - RoadAx) / Whole, (RoadBy - RoadAy) / Whole};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepBack && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bPursueBanked, int Step)
    {
        return bPursueBanked && Step >= StepBack && Step < StepBanked;
    }

    // Speed is signed along the car's nose. Negative is reverse. One call does not move the stall.
    inline FRun Tick(FRun Now, bool bInCar, double CarX, double CarY, double Speed, double ForwardX, double ForwardY)
    {
        Now.bIn = false;
        if (Now.Step >= StepBanked) return Now;
        if (!bInCar) return Now;
        const FSpot Mark = Stall();
        if (Apart(CarX, CarY, Mark.X, Mark.Y) > Reach) return Now;
        if (!(Speed <= -ReverseMin)) return Now;
        const double Mag = std::hypot(ForwardX, ForwardY);
        if (Mag < 1e-6) return Now;
        const FSpot Out = Outward();
        const double Dot = (ForwardX / Mag) * Out.X + (ForwardY / Mag) * Out.Y;
        if (Dot < Align) return Now;
        Now.bIn = true;
        Now.Step = StepBanked;
        return Now;
    }
}
