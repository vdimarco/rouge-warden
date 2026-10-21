#pragma once

// A session wade on the south pond. No Unreal types.
// Swim to the float, then walk back to the bank. A car and a pedalo do not count.
// The purse is paid once. Nothing is saved.

#include <cmath>

namespace QuebecWade
{
    // The south-pond swim point. Deep water.
    inline constexpr double BuoyX = 3585.566498;
    inline constexpr double BuoyY = -6351.3626;
    // Dry bank, 21 m from the float, so the two reaches do not overlap.
    inline constexpr double BankX = 5558.921001650408;
    inline constexpr double BankY = -7069.604900983904;

    inline constexpr float Reach = 450.f;
    inline constexpr int Pay = 80;
    inline constexpr int Nobody = -1;

    enum class ELeg : int
    {
        Bank = 0,
        Buoy = 1,
        Done = 2
    };

    struct FProgress
    {
        ELeg Leg = ELeg::Bank;
        int Swimmer = Nobody;
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

    // On foot, Bank becomes Buoy at the float and remembers who tagged it.
    // That same person becomes Done at the bank. Anyone else waiting there does not finish it.
    // Done stays Done. A driver stays where they are. Standing on the bank first does not finish.
    inline FProgress Advance(FProgress Progress, int Who, bool bOnFoot, bool bAtBuoy, bool bAtBank)
    {
        if (!bOnFoot || Who == Nobody || Progress.Leg == ELeg::Done) return Progress;
        if (Progress.Leg == ELeg::Bank && bAtBuoy)
        {
            Progress.Leg = ELeg::Buoy;
            Progress.Swimmer = Who;
            return Progress;
        }
        if (Progress.Leg == ELeg::Buoy && bAtBank && Who == Progress.Swimmer)
        {
            Progress.Leg = ELeg::Done;
            return Progress;
        }
        return Progress;
    }

    inline int Purse(FProgress Before, FProgress After)
    {
        return Before.Leg == ELeg::Buoy && After.Leg == ELeg::Done && After.Swimmer == Before.Swimmer ? Pay : 0;
    }
}
