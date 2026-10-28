#pragma once

// Where an on-foot opening look should aim. No Unreal includes, so Scripts/street_aim_test.cpp
// can build it with the system compiler.
//
// Joseph V. Mascelli, The Five C's of Cinematography (1965): the eye follows a line.
// From the sidewalk, a look parallel to the avenue leaves the street as a side sliver.
// Aiming at a point down the lane puts that line in the frame. A Dutch tilt does not fit.

#include <cmath>
#include <cstddef>

namespace QuebecStreetLook
{
    struct FSegment
    {
        double AX = 0.;
        double AY = 0.;
        double BX = 0.;
        double BY = 0.;
        float Width = 0.f;
    };

    inline double WrapDegrees(double Yaw)
    {
        Yaw = std::fmod(Yaw + 180., 360.);
        if (Yaw < 0.) Yaw += 360.;
        return Yaw - 180.;
    }

    // Yaw in degrees, Unreal convention (atan2 of Y, X). Faces a point LeadCm down the nearest
    // avenue (width >= MinWidthCm) within ReachCm, picking the direction nearer FallbackYaw.
    // No avenue in reach keeps FallbackYaw.
    inline double AimYaw(double X, double Y, const FSegment* Segments, int Count, double FallbackYaw,
        double MinWidthCm = 900., double ReachCm = 2500., double LeadCm = 1800.)
    {
        double Best = ReachCm * ReachCm;
        double ClosestX = 0.;
        double ClosestY = 0.;
        double DirectionX = 0.;
        double DirectionY = 0.;
        bool bHit = false;
        for (int Index = 0; Index < Count; ++Index)
        {
            if (Segments[Index].Width < MinWidthCm) continue;
            const double DeltaX = Segments[Index].BX - Segments[Index].AX;
            const double DeltaY = Segments[Index].BY - Segments[Index].AY;
            const double LengthSquared = DeltaX * DeltaX + DeltaY * DeltaY;
            if (LengthSquared < 1.) continue;
            double Along = ((X - Segments[Index].AX) * DeltaX + (Y - Segments[Index].AY) * DeltaY) / LengthSquared;
            if (Along < 0.) Along = 0.;
            if (Along > 1.) Along = 1.;
            const double PointX = Segments[Index].AX + Along * DeltaX;
            const double PointY = Segments[Index].AY + Along * DeltaY;
            const double OffX = X - PointX;
            const double OffY = Y - PointY;
            const double DistanceSquared = OffX * OffX + OffY * OffY;
            if (DistanceSquared < Best)
            {
                Best = DistanceSquared;
                ClosestX = PointX;
                ClosestY = PointY;
                DirectionX = DeltaX;
                DirectionY = DeltaY;
                bHit = true;
            }
        }
        if (!bHit) return FallbackYaw;
        const double Length = std::hypot(DirectionX, DirectionY);
        const double UnitX = DirectionX / Length;
        const double UnitY = DirectionY / Length;
        auto YawOf = [&](double Sign)
        {
            const double TargetX = ClosestX + Sign * UnitX * LeadCm;
            const double TargetY = ClosestY + Sign * UnitY * LeadCm;
            return std::atan2(TargetY - Y, TargetX - X) * (180. / 3.14159265358979323846);
        };
        const double Ahead = YawOf(1.);
        const double Behind = YawOf(-1.);
        const double AheadDelta = std::fabs(WrapDegrees(Ahead - FallbackYaw));
        const double BehindDelta = std::fabs(WrapDegrees(Behind - FallbackYaw));
        return AheadDelta <= BehindDelta ? Ahead : Behind;
    }
}
