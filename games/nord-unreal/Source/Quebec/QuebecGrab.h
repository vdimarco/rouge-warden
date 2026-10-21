#pragma once

// Engine-independent rules for mission 13, the timed grab.
// No Unreal includes, so Scripts/test_grab.py can build this with the system compiler.
// The lamp crossing fails you for being seen. This beat fails you for being slow.
// The clock is not stored. A version-5 slot starts this beat over.

#include <cmath>

namespace QuebecGrab
{
    inline constexpr int StepCase = 0;
    inline constexpr int StepRun = 1;
    inline constexpr int StepBanked = 2;

    inline constexpr double CaseX = 62000.;
    inline constexpr double CaseY = 14000.;
    inline constexpr double DropX = 62000.;
    inline constexpr double DropY = 7000.;
    inline constexpr double RecoverNorth = 900.;
    inline constexpr double Reach = 450.;
    // A straight sprint beats this. A straight walk does not. One long frame only spends a slice.
    inline constexpr double Window = 12.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 560;

    struct FRun
    {
        int Step = StepCase;
        double Elapsed = 0.;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline bool InCircle(double X, double Y, double CX, double CY, double Radius)
    {
        return Gap(X, Y, CX, CY) <= Radius;
    }

    inline bool InCase(double X, double Y)
    {
        return InCircle(X, Y, CaseX, CaseY, Reach);
    }

    inline bool InDrop(double X, double Y)
    {
        return InCircle(X, Y, DropX, DropY, Reach);
    }

    inline int Left(double Elapsed)
    {
        if (Elapsed < 0.) Elapsed = 0.;
        const double Remain = Window - Elapsed;
        if (Remain <= 0.) return 0;
        return static_cast<int>(std::ceil(Remain));
    }

    inline FRun Tick(FRun Now, double Seconds, bool bOnFoot, double X, double Y)
    {
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepCase)
        {
            if (bOnFoot && InCase(X, Y))
            {
                Now.Step = StepRun;
                Now.Elapsed = 0.;
            }
            return Now;
        }
        Now.Elapsed += Seconds;
        if (Now.Elapsed > Window)
        {
            Now.Step = StepCase;
            Now.Elapsed = 0.;
            return Now;
        }
        if (bOnFoot && InDrop(X, Y)) Now.Step = StepBanked;
        return Now;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepRun && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bShadeBanked, int Step)
    {
        return bShadeBanked && Step >= StepCase && Step < StepBanked;
    }
}
