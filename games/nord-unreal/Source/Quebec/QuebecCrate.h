#pragma once

// A session parcel from the Sherbrooke sidewalk to Parc Persillier-Lachapelle.
// No Unreal includes, so Scripts/test_crate.py can build this with the system compiler.
// One person on foot takes the caisse. That same person finishes it on the park bike.
// A later place does not skip. The purse is paid once. Nothing is saved.

namespace QuebecCrate
{
    inline constexpr int Curb = 0;
    inline constexpr int Park = 1;
    inline constexpr int Done = 2;
    inline constexpr int Nobody = -1;
    inline constexpr float Reach = 450.f;
    inline constexpr int Pay = 260;

    // Eight metres south of Chez Lise, outside the stall's door and the atelier's car reach.
    inline constexpr double CurbX = 38004.;
    inline constexpr double CurbY = -12244.;
    // Parc Persillier-Lachapelle path, east of the ponds and clear of the shotgun pickup.
    inline constexpr double ParkX = 60800.;
    inline constexpr double ParkY = -5200.;

    struct FProgress
    {
        int Step = Curb;
        int Runner = Nobody;
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

    // The curb wants a walker. The park wants that same person on the bike.
    // A driver does not take the caisse. A walker does not drop it. Banked stays banked.
    inline FProgress Advance(FProgress Progress, int Who, bool bOnFoot, bool bBike, bool bAtCurb, bool bAtPark)
    {
        if (Who == Nobody || Progress.Step >= Done) return Progress;
        if (Progress.Step == Curb)
        {
            if (!bOnFoot || bBike || !bAtCurb) return Progress;
            Progress.Step = Park;
            Progress.Runner = Who;
            return Progress;
        }
        if (!bBike || bOnFoot || !bAtPark || Who != Progress.Runner) return Progress;
        Progress.Step = Done;
        return Progress;
    }

    inline int Purse(FProgress Before, FProgress After)
    {
        return Before.Step == Park && After.Step == Done && After.Runner == Before.Runner ? Pay : 0;
    }
}
