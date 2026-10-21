#pragma once

// Engine-independent rules for mission 14, the short way.
// No Unreal includes, so Scripts/test_cut.py can build this with the system compiler.
// The lap already rides a ghost along its own route. This person takes a longer road, and they are faster than a sprint.
// The grass from the line to the finish is shorter. A sprint there beats them. A walk does not. A sprint on their road does not.
// Their clock is not stored. A version-6 slot starts this beat over.

#include <cmath>

namespace QuebecCut
{
    inline constexpr int StepLine = 0;
    inline constexpr int StepRun = 1;
    inline constexpr int StepBanked = 2;

    inline constexpr double StartX = 24000.;
    inline constexpr double StartY = 18000.;
    inline constexpr double FinishX = 24000.;
    inline constexpr double FinishY = 11000.;
    inline constexpr double BendX = 26800.;
    inline constexpr double BendY = 14500.;
    inline constexpr double RecoverNorth = 900.;
    inline constexpr double Reach = 450.;
    inline constexpr double Slice = 0.25;
    inline constexpr double RivalCmPerSecond = 900.;
    inline constexpr int Pay = 600;

    struct FRun
    {
        int Step = StepLine;
        double Elapsed = 0.;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline double Direct()
    {
        return Gap(StartX, StartY, FinishX, FinishY);
    }

    inline double Road()
    {
        return Gap(StartX, StartY, BendX, BendY) + Gap(BendX, BendY, FinishX, FinishY);
    }

    inline bool InCircle(double X, double Y, double CX, double CY, double Radius)
    {
        return Gap(X, Y, CX, CY) <= Radius;
    }

    inline bool InStart(double X, double Y)
    {
        return InCircle(X, Y, StartX, StartY, Reach);
    }

    inline bool InFinish(double X, double Y)
    {
        return InCircle(X, Y, FinishX, FinishY, Reach);
    }

    inline int Left(double Elapsed)
    {
        if (Elapsed < 0.) Elapsed = 0.;
        const double Remain = Road() / RivalCmPerSecond - Elapsed;
        if (Remain <= 0.) return 0;
        return static_cast<int>(std::ceil(Remain));
    }

    inline void Place(double Elapsed, double& X, double& Y)
    {
        double Along = Elapsed * RivalCmPerSecond;
        if (Along < 0.) Along = 0.;
        const double First = Gap(StartX, StartY, BendX, BendY);
        const double Whole = Road();
        if (Along > Whole) Along = Whole;
        if (Along <= First || First <= 0.)
        {
            const double Portion = First <= 0. ? 1. : Along / First;
            X = StartX + (BendX - StartX) * Portion;
            Y = StartY + (BendY - StartY) * Portion;
            return;
        }
        const double Rest = Whole - First;
        const double Portion = Rest <= 0. ? 1. : (Along - First) / Rest;
        X = BendX + (FinishX - BendX) * Portion;
        Y = BendY + (FinishY - BendY) * Portion;
    }

    inline FRun Tick(FRun Now, double Seconds, bool bOnFoot, double X, double Y)
    {
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepLine)
        {
            if (bOnFoot && InStart(X, Y))
            {
                Now.Step = StepRun;
                Now.Elapsed = 0.;
            }
            return Now;
        }
        Now.Elapsed += Seconds;
        if (Now.Elapsed * RivalCmPerSecond >= Road())
        {
            Now.Step = StepLine;
            Now.Elapsed = 0.;
            return Now;
        }
        if (bOnFoot && InFinish(X, Y)) Now.Step = StepBanked;
        return Now;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepRun && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bGrabBanked, int Step)
    {
        return bGrabBanked && Step >= StepLine && Step < StepBanked;
    }
}
