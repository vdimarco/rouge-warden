#pragma once

// Aim assist for NORD combat: which target a shot or a swing goes to.
// No Unreal includes, so Scripts/test_aim_model.py can build and run it with the system compiler.
// Players aim over an 80-200 ms video stream, so the server picks the target inside a generous planar cone and keeps
// the previous lock for a while (sticky targeting, as in GTA V's lock timer). Units are centimetres, degrees, seconds.

#include <cmath>

namespace QuebecAim
{
    struct FPoint
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    struct FTarget
    {
        FPoint Point;             // Torso aim point.
        unsigned Key = 0;         // Stable identity across shots; 0 means "no identity" and never keeps a lock.
        bool bDown = false;       // Knocked down or out: never chosen.
        bool bThreat = false;     // Police chasing the shooter, or goons: wins close calls.
        double Penalty = 0.;      // Added to the score; cars use it so people win close calls.
    };

    struct FSettings
    {
        double ConeDegrees = 25.;         // A new lock sits inside this planar half-angle.
        double KeepConeDegrees = 35.;     // The previous lock stays preferred inside this wider half-angle...
        double KeepSeconds = 4.;          // ...for this long after it was acquired.
        double Range = 4500.;             // Farthest new lock.
        double KeepRangeScale = 1.15;     // The previous lock may drift this much farther away.
        double MaxElevationDegrees = 45.; // Targets far above or below the shooter are ignored.
        double ThreatBonus = .35;         // Subtracted from a threat's score.
    };

    struct FLock
    {
        unsigned Key = 0;
        double AcquiredAt = -1.e9;
    };

    struct FChoice
    {
        int Index = -1;           // Into the target array; -1 when nothing qualifies.
        bool bKept = false;       // The previous lock was kept by hysteresis.
        double AngleDegrees = 0.;
        double Distance = 0.;
    };

    inline constexpr double DegreesPerRadian = 57.29577951308232;

    // Planar angle in degrees between Direction and the line from Origin to Target. Zero when either is degenerate.
    inline double PlanarAngleDegrees(const FPoint& Origin, const FPoint& Direction, const FPoint& Target)
    {
        const double ToX = Target.X - Origin.X, ToY = Target.Y - Origin.Y;
        const double ToLength = std::sqrt(ToX * ToX + ToY * ToY);
        const double AimLength = std::sqrt(Direction.X * Direction.X + Direction.Y * Direction.Y);
        if (ToLength < 1. || AimLength < 1.e-6) return 0.;
        double Cosine = (ToX * Direction.X + ToY * Direction.Y) / (ToLength * AimLength);
        Cosine = Cosine > 1. ? 1. : Cosine < -1. ? -1. : Cosine;
        return std::acos(Cosine) * DegreesPerRadian;
    }

    inline double PlanarDistance(const FPoint& A, const FPoint& B)
    {
        const double DX = B.X - A.X, DY = B.Y - A.Y;
        return std::sqrt(DX * DX + DY * DY);
    }

    // Elevation of Target seen from Origin, in degrees; positive is above.
    inline double ElevationDegrees(const FPoint& Origin, const FPoint& Target)
    {
        return std::atan2(Target.Z - Origin.Z, PlanarDistance(Origin, Target) + 1.e-6) * DegreesPerRadian;
    }

    // Lower is better: centred and close targets win, threats get a bonus.
    inline double Score(double AngleDegrees, double Distance, const FTarget& Target, const FSettings& Settings)
    {
        return AngleDegrees / Settings.ConeDegrees + Distance / Settings.Range + Target.Penalty
            - (Target.bThreat ? Settings.ThreatBonus : 0.);
    }

    // Picks the target for an aim from Origin along Direction (only its planar part counts) at time Now.
    // Lock is the shooter's previous lock; it is updated to the choice, or cleared when nothing qualifies.
    inline FChoice Choose(const FPoint& Origin, const FPoint& Direction, const FTarget* Targets, int Count,
        const FSettings& Settings, FLock& Lock, double Now)
    {
        FChoice Result;
        if (!Targets || Count <= 0 || std::sqrt(Direction.X * Direction.X + Direction.Y * Direction.Y) < 1.e-6)
        {
            Lock = FLock();
            return Result;
        }
        // Hysteresis: the previous lock wins while it stays inside the wider cone and the lock timer runs.
        if (Lock.Key != 0 && Now - Lock.AcquiredAt < Settings.KeepSeconds)
            for (int Index = 0; Index < Count; ++Index)
            {
                const FTarget& Candidate = Targets[Index];
                if (Candidate.Key != Lock.Key || Candidate.bDown) continue;
                const double Angle = PlanarAngleDegrees(Origin, Direction, Candidate.Point);
                const double Distance = PlanarDistance(Origin, Candidate.Point);
                if (Angle > Settings.KeepConeDegrees || Distance > Settings.Range * Settings.KeepRangeScale ||
                    std::fabs(ElevationDegrees(Origin, Candidate.Point)) > Settings.MaxElevationDegrees) break;
                Result.Index = Index;
                Result.bKept = true;
                Result.AngleDegrees = Angle;
                Result.Distance = Distance;
                return Result;
            }
        double Best = 1.e18;
        for (int Index = 0; Index < Count; ++Index)
        {
            const FTarget& Candidate = Targets[Index];
            if (Candidate.bDown) continue;
            const double Angle = PlanarAngleDegrees(Origin, Direction, Candidate.Point);
            const double Distance = PlanarDistance(Origin, Candidate.Point);
            if (Angle > Settings.ConeDegrees || Distance > Settings.Range ||
                std::fabs(ElevationDegrees(Origin, Candidate.Point)) > Settings.MaxElevationDegrees) continue;
            const double Value = Score(Angle, Distance, Candidate, Settings);
            if (Value >= Best) continue;
            Best = Value;
            Result.Index = Index;
            Result.AngleDegrees = Angle;
            Result.Distance = Distance;
        }
        if (Result.Index < 0)
        {
            Lock = FLock();
            return Result;
        }
        // A fresh choice restarts the lock timer, including when it picks the same target again.
        Lock.Key = Targets[Result.Index].Key;
        Lock.AcquiredAt = Now;
        return Result;
    }
}
