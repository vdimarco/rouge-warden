#pragma once

// Engine-independent geometry for the mission route line.
// No Unreal includes, so Scripts/test_route_line.py can build this with the system compiler.
// The card needle points the way to turn. The radar stroke runs from the player toward the diamond.

#include <cmath>

namespace QuebecRouteLine
{
    struct FVec2
    {
        double X = 0.;
        double Y = 0.;
    };

    enum class ETurn { Here, Ahead, Right, Behind, Left };

    inline double Length(FVec2 Value)
    {
        return std::hypot(Value.X, Value.Y);
    }

    // Clockwise radians from the player's forward to the target, in (-pi, pi].
    // 0 is ahead, +pi/2 is right, -pi/2 is left. A zero forward is treated as north.
    inline double BearingFromPlayer(FVec2 Forward, FVec2 To)
    {
        const FVec2 Face = Length(Forward) < 1e-3 ? FVec2{0., 1.} : Forward;
        const double Ahead = Face.X * To.X + Face.Y * To.Y;
        const double Right = Face.Y * To.X - Face.X * To.Y;
        return std::atan2(Right, Ahead);
    }

    // Under 1.5 m the stop is here. Otherwise the turn is ahead, behind, left or right.
    inline ETurn TurnFor(double Bearing, double DistanceCm)
    {
        if (DistanceCm < 150.) return ETurn::Here;
        const double Abs = std::fabs(Bearing);
        if (Abs < 0.45) return ETurn::Ahead;
        if (Abs > 2.6) return ETurn::Behind;
        return Bearing > 0. ? ETurn::Right : ETurn::Left;
    }

    // Needle in a square of Size. +X is right, +Y is down, so ahead points up.
    inline void CardNeedle(double Bearing, double Size, FVec2& Start, FVec2& Tip)
    {
        Start = {Size * 0.5, Size * 0.5};
        const double Reach = Size * 0.38;
        Tip = {Start.X + std::sin(Bearing) * Reach, Start.Y - std::cos(Bearing) * Reach};
    }

    // Stroke from Center toward Goal, inset so it clears the player arrow and the diamond.
    inline bool RadarStroke(FVec2 Center, FVec2 Goal, double StartPad, double EndPad, FVec2& A, FVec2& B)
    {
        const FVec2 Delta{Goal.X - Center.X, Goal.Y - Center.Y};
        const double Span = Length(Delta);
        if (Span <= StartPad + EndPad) return false;
        const double Inv = 1. / Span;
        A = {Center.X + Delta.X * Inv * StartPad, Center.Y + Delta.Y * Inv * StartPad};
        B = {Center.X + Delta.X * Inv * (Span - EndPad), Center.Y + Delta.Y * Inv * (Span - EndPad)};
        return true;
    }

    // View-space ahead, right, and up, written as a screen direction. +X is right, +Y is down.
    // A stop behind the camera folds downward so the arrow still leaves the frame.
    inline void ViewToScreen(double Ahead, double Right, double Up, double& DirX, double& DirY)
    {
        DirX = Right;
        DirY = -Up;
        if (Ahead < 0.)
        {
            const double Span = std::hypot(DirX, DirY);
            DirY += Span + std::fabs(Ahead);
        }
    }

    // Where a ray from the center of the inset rect leaves that rect. False when the direction is ~0.
    inline bool EdgeArrow(double DirX, double DirY, double Left, double Top, double Right, double Bottom, FVec2& Out)
    {
        const double Span = std::hypot(DirX, DirY);
        if (Span < 1e-6 || !(Right > Left) || !(Bottom > Top)) return false;
        const double Cx = (Left + Right) * 0.5;
        const double Cy = (Top + Bottom) * 0.5;
        const double Ux = DirX / Span;
        const double Uy = DirY / Span;
        double Best = 1e300;
        const auto Consider = [&Best](double T, double X, double Y, double MinX, double MaxX, double MinY, double MaxY)
        {
            if (T > 1e-9 && T < Best && X >= MinX && X <= MaxX && Y >= MinY && Y <= MaxY) Best = T;
        };
        if (std::fabs(Ux) > 1e-12)
        {
            const double ToRight = (Right - Cx) / Ux;
            Consider(ToRight, Right, Cy + Uy * ToRight, Left, Right, Top, Bottom);
            const double ToLeft = (Left - Cx) / Ux;
            Consider(ToLeft, Left, Cy + Uy * ToLeft, Left, Right, Top, Bottom);
        }
        if (std::fabs(Uy) > 1e-12)
        {
            const double ToBottom = (Bottom - Cy) / Uy;
            Consider(ToBottom, Cx + Ux * ToBottom, Bottom, Left, Right, Top, Bottom);
            const double ToTop = (Top - Cy) / Uy;
            Consider(ToTop, Cx + Ux * ToTop, Top, Left, Right, Top, Bottom);
        }
        if (Best > 1e200) return false;
        Out = {Cx + Ux * Best, Cy + Uy * Best};
        return true;
    }
}
