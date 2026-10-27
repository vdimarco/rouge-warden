#pragma once

#include <cmath>

// Engine-independent rules for the tab.
// On foot, reach the counter. A car does not open it. Then drive a real car
// through the lane inside a speed band, nose down the road. Too fast, too slow,
// or the wrong nose drops the tab and leaves the counter banked. Then stand
// still on foot at the receipt. Moving or stepping out starts that count again
// and does not save. The count is not saved.

namespace QuebecTab
{
    inline constexpr int StepCounter = 0;
    inline constexpr int StepLane = 1;
    inline constexpr int StepStill = 2;
    inline constexpr int StepBanked = 3;

    inline constexpr double CounterX = -19252.447;
    inline constexpr double CounterY = -1944.473;
    inline constexpr double RoadAx = -19241.053;
    inline constexpr double RoadAy = -3849.446;
    inline constexpr double RoadBx = -30137.895;
    inline constexpr double RoadBy = 3100.262;
    inline constexpr double ReceiptX = -28405.794;
    inline constexpr double ReceiptY = 3893.282;
    inline constexpr double Reach = 500.;
    inline constexpr double GateReach = 550.;
    inline constexpr double Slow = 520.;
    inline constexpr double Fast = 880.;
    inline constexpr double Align = 0.62;
    inline constexpr double Still = 40.;
    inline constexpr double Hold = 3.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 760;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepCounter;
        double Clock = 0.;
        bool bSlipped = false;
        bool bBroke = false;
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

    inline void Basis(double& AlongX, double& AlongY)
    {
        const double Whole = Length();
        AlongX = (RoadBx - RoadAx) / Whole;
        AlongY = (RoadBy - RoadAy) / Whole;
    }

    inline FSpot Gate()
    {
        return {(RoadAx + RoadBx) * 0.5, (RoadAy + RoadBy) * 0.5};
    }

    inline FSpot Objective(int Step)
    {
        if (Step <= StepCounter) return {CounterX, CounterY};
        if (Step == StepLane) return Gate();
        return {ReceiptX, ReceiptY};
    }

    inline bool InBand(double Speed)
    {
        return Speed >= Slow && Speed <= Fast;
    }

    inline bool Aimed(double ForwardX, double ForwardY)
    {
        double AlongX = 0.;
        double AlongY = 0.;
        Basis(AlongX, AlongY);
        return ForwardX * AlongX + ForwardY * AlongY >= Align;
    }

    inline FRun Tick(const FRun& Now, double Seconds, int Kind, bool bOnFoot, double Speed, double ForwardX, double ForwardY, double X, double Y)
    {
        FRun After = Now;
        After.bSlipped = false;
        After.bBroke = false;
        if (Now.Step >= StepBanked) return After;
        double Spent = Seconds;
        if (Spent > Slice) Spent = Slice;
        if (Spent < 0.) Spent = 0.;
        if (Now.Step == StepCounter)
        {
            if (bOnFoot && Apart(X, Y, CounterX, CounterY) <= Reach) After.Step = StepLane;
            return After;
        }
        if (Now.Step == StepLane)
        {
            const FSpot Lane = Gate();
            if (CountsAsCar(Kind) && Apart(X, Y, Lane.X, Lane.Y) <= GateReach)
            {
                if (InBand(Speed) && Aimed(ForwardX, ForwardY))
                {
                    After.Step = StepStill;
                    After.Clock = 0.;
                    return After;
                }
                After.bSlipped = true;
            }
            return After;
        }
        if (bOnFoot && Speed <= Still && Apart(X, Y, ReceiptX, ReceiptY) <= Reach)
        {
            After.Clock = Now.Clock + Spent;
            if (After.Clock > Hold) After.Clock = Hold;
            if (After.Clock >= Hold) After.Step = StepBanked;
            return After;
        }
        if (Now.Clock > 0.) After.bBroke = true;
        After.Clock = 0.;
        return After;
    }
}
