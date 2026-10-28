#pragma once

#include <cmath>

// Engine-independent rules for the yard.
// On foot. A watcher turns in place. Cross from the near side to the far side
// while their look is somewhere else. Stepping into that look sends you back
// to the near side and does not save. A car does not cross. Where they are
// looking, and whether this crossing is armed, stay in the session.

namespace QuebecYard
{
    inline constexpr int StepOpen = 0;
    inline constexpr int StepBanked = 1;

    inline constexpr double NearX = -37668.;
    inline constexpr double NearY = 59266.;
    inline constexpr double FarX = -36068.;
    inline constexpr double FarY = 59266.;
    inline constexpr double WatchX = -36868.;
    inline constexpr double WatchY = 58166.;
    inline constexpr double Reach = 600.;
    inline constexpr double Range = 2200.;
    inline constexpr double Half = 0.55;
    inline constexpr double Turn = 0.35;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 540;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepOpen;
        double Angle = 0.;
        bool bArmed = false;
        bool bSeen = false;
    };

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline FSpot Near()
    {
        return {NearX, NearY};
    }

    inline FSpot Far()
    {
        return {FarX, FarY};
    }

    inline FSpot Watch()
    {
        return {WatchX, WatchY};
    }

    inline bool InLook(double Angle, double X, double Y)
    {
        const double DX = X - WatchX;
        const double DY = Y - WatchY;
        const double Dist = std::hypot(DX, DY);
        if (Dist > Range || Dist < 1.) return false;
        const double Dot = (std::cos(Angle) * DX + std::sin(Angle) * DY) / Dist;
        return Dot >= std::cos(Half);
    }

    inline FRun Tick(const FRun& Now, double Seconds, bool bOnFoot, double X, double Y)
    {
        FRun After = Now;
        After.bSeen = false;
        double Spent = Seconds;
        if (Spent > Slice) Spent = Slice;
        if (Spent < 0.) Spent = 0.;
        After.Angle = Now.Angle + Turn * Spent;
        const double Circle = 6.283185307179586;
        if (After.Angle >= Circle) After.Angle = std::fmod(After.Angle, Circle);
        if (After.Step >= StepBanked || !bOnFoot) return After;
        if (InLook(After.Angle, X, Y))
        {
            if (Now.bArmed) After.bSeen = true;
            After.bArmed = false;
            return After;
        }
        if (Apart(X, Y, NearX, NearY) <= Reach) After.bArmed = true;
        if (After.bArmed && Apart(X, Y, FarX, FarY) <= Reach) After.Step = StepBanked;
        return After;
    }
}
