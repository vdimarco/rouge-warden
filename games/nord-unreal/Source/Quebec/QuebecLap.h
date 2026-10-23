#pragma once

// A session circuit on the north pond. No Unreal types.
// Paddle the pedalo to the buoy, then back to the berth. A car does not count.
// The purse is paid once. Nothing is saved.

#include <cmath>

namespace QuebecLap
{
    // The north-pond swim point. Deep water, and the island sits between it and the berth.
    inline constexpr double BuoyX = -10651.111588;
    inline constexpr double BuoyY = 7939.899;

    inline constexpr float Reach = 450.f;
    inline constexpr int Pay = 120;

    enum class ELeg : int
    {
        Dock = 0,
        Buoy = 1,
        Done = 2
    };

    inline double Dist2(double X, double Y, double TargetX, double TargetY)
    {
        const double DX = X - TargetX;
        const double DY = Y - TargetY;
        return DX * DX + DY * DY;
    }

    inline bool Inside(double X, double Y, double TargetX, double TargetY, float Radius)
    {
        const double Limit = static_cast<double>(Radius);
        return Dist2(X, Y, TargetX, TargetY) <= Limit * Limit;
    }

    // A pedalo on Dock becomes Buoy at the buoy. A pedalo on Buoy becomes Done at the berth.
    // Done stays Done. A car stays where it is. Touching the berth before the buoy does not finish.
    inline ELeg Step(ELeg Leg, bool bPedalo, bool bAtBuoy, bool bAtBerth)
    {
        if (!bPedalo || Leg == ELeg::Done) return Leg;
        if (Leg == ELeg::Dock && bAtBuoy) return ELeg::Buoy;
        if (Leg == ELeg::Buoy && bAtBerth) return ELeg::Done;
        return Leg;
    }

    inline int Purse(ELeg Before, ELeg After)
    {
        return Before == ELeg::Buoy && After == ELeg::Done ? Pay : 0;
    }
}
