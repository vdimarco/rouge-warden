#pragma once

// A session circuit for the park bike. No Unreal types.
// Pedal to the lawn, then the allée, then back to the stand. A car does not count.
// The purse is paid once, to the rider who tagged the lawn. Nothing is saved.

#include "QuebecCycle.h"

#include <cmath>

namespace QuebecRing
{
    inline constexpr double StandX = QuebecCycle::StandX;
    inline constexpr double StandY = QuebecCycle::StandY;
    // North of the stand, on dry ground, a 200 m pedal.
    inline constexpr double GateAX = 34800.;
    inline constexpr double GateAY = 16000.;
    // West of the stand, on dry ground, a 200 m pedal. The lawn sits on the diagonal.
    inline constexpr double GateBX = 14800.;
    inline constexpr double GateBY = -4000.;

    inline constexpr float Reach = 450.f;
    inline constexpr int Pay = 180;
    inline constexpr int Nobody = -1;

    inline constexpr int Stand = 0;
    inline constexpr int Lawn = 1;
    inline constexpr int Allee = 2;
    inline constexpr int Done = 3;

    struct FProgress
    {
        int Leg = Stand;
        int Rider = Nobody;
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

    // Stand plus the lawn remembers Who and becomes Lawn.
    // Only that rider at the allée becomes Allee. Only that rider at the stand becomes Done.
    // A later mark does not skip. A different rider does not take the lap. Done stays Done.
    inline FProgress Advance(FProgress Progress, int Who, bool bBike, bool bAtStand, bool bAtLawn, bool bAtAllee)
    {
        if (!bBike || Who == Nobody || Progress.Leg == Done) return Progress;
        if (Progress.Leg == Stand && bAtLawn)
        {
            Progress.Leg = Lawn;
            Progress.Rider = Who;
            return Progress;
        }
        if (Progress.Leg == Lawn && bAtAllee && Who == Progress.Rider)
        {
            Progress.Leg = Allee;
            return Progress;
        }
        if (Progress.Leg == Allee && bAtStand && Who == Progress.Rider)
        {
            Progress.Leg = Done;
            return Progress;
        }
        return Progress;
    }

    inline int Purse(FProgress Before, FProgress After)
    {
        return Before.Leg == Allee && After.Leg == Done && After.Rider == Before.Rider ? Pay : 0;
    }
}
