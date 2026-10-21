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

    enum class ELeg : int
    {
        Bank = 0,
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

    // On foot, Bank becomes Buoy at the float, and Buoy becomes Done at the bank.
    // Done stays Done. A driver stays where they are. Standing on the bank first does not finish.
    inline ELeg Step(ELeg Leg, bool bOnFoot, bool bAtBuoy, bool bAtBank)
    {
        if (!bOnFoot || Leg == ELeg::Done) return Leg;
        if (Leg == ELeg::Bank && bAtBuoy) return ELeg::Buoy;
        if (Leg == ELeg::Buoy && bAtBank) return ELeg::Done;
        return Leg;
    }

    inline int Purse(ELeg Before, ELeg After)
    {
        return Before == ELeg::Buoy && After == ELeg::Done ? Pay : 0;
    }
}
