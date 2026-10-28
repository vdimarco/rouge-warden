#pragma once

#include <cmath>

// Engine-independent rules for the carry.
// On foot, pick up the case. A car does not take it. Walk it to the stoop
// inside a walk band. A sprint, a creep, or a car at the stoop drops that
// delivery and leaves the case banked. Then roll a real car across the line,
// slower than a walk and faster than a crawl. A stop or a bolt drops the roll
// and leaves the stoop banked. A bike does not finish it. Nothing here is saved
// except the step.

namespace QuebecCarry
{
    inline constexpr int StepCase = 0;
    inline constexpr int StepWalk = 1;
    inline constexpr int StepRoll = 2;
    inline constexpr int StepBanked = 3;

    inline constexpr double CaseX = -20220.041;
    inline constexpr double CaseY = -26860.949;
    inline constexpr double StoopX = -14590.094;
    inline constexpr double StoopY = -29558.738;
    inline constexpr double RoadAx = -14817.428;
    inline constexpr double RoadAy = -33702.130;
    inline constexpr double RoadBx = -23475.161;
    inline constexpr double RoadBy = -28087.149;
    inline constexpr double Reach = 500.;
    inline constexpr double LineReach = 550.;
    inline constexpr double WalkLo = 220.;
    inline constexpr double WalkHi = 450.;
    inline constexpr double RollMin = 140.;
    inline constexpr double RollMax = 400.;
    inline constexpr int Pay = 740;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepCase;
        bool bSlipped = false;
    };

    inline constexpr bool CountsAsCar(int Kind)
    {
        return Kind == 0;
    }

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline FSpot Line()
    {
        return {(RoadAx + RoadBx) * 0.5, (RoadAy + RoadBy) * 0.5};
    }

    inline FSpot Objective(int Step)
    {
        if (Step <= StepCase) return {CaseX, CaseY};
        if (Step == StepWalk) return {StoopX, StoopY};
        return Line();
    }

    inline bool InWalk(double Speed)
    {
        return Speed >= WalkLo && Speed <= WalkHi;
    }

    inline bool InRoll(double Speed)
    {
        return Speed >= RollMin && Speed <= RollMax;
    }

    inline FRun Tick(const FRun& Now, int Kind, bool bOnFoot, double Speed, double X, double Y)
    {
        FRun After = Now;
        After.bSlipped = false;
        if (Now.Step >= StepBanked) return After;
        if (Now.Step == StepCase)
        {
            if (bOnFoot && Apart(X, Y, CaseX, CaseY) <= Reach) After.Step = StepWalk;
            return After;
        }
        if (Now.Step == StepWalk)
        {
            if (Apart(X, Y, StoopX, StoopY) <= Reach)
            {
                if (bOnFoot && InWalk(Speed))
                {
                    After.Step = StepRoll;
                    return After;
                }
                if (!bOnFoot && CountsAsCar(Kind)) After.bSlipped = true;
                else if (bOnFoot) After.bSlipped = true;
            }
            return After;
        }
        const FSpot Mark = Line();
        if (CountsAsCar(Kind) && Apart(X, Y, Mark.X, Mark.Y) <= LineReach)
        {
            if (InRoll(Speed))
            {
                After.Step = StepBanked;
                return After;
            }
            After.bSlipped = true;
        }
        return After;
    }
}
