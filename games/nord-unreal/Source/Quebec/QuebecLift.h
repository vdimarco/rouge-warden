#pragma once

#include <cmath>

// Engine-independent rules for the lift.
// Stop a real car and leave it stopped. They walk a fixed line from off the
// road to the car. A roll sends them back along that line and does not save.
// A bike does not start them. Where they are on the walk stays in the session.

namespace QuebecLift
{
    inline constexpr int StepOpen = 0;
    inline constexpr int StepBanked = 1;

    inline constexpr double PocketX = -25683.074;
    inline constexpr double PocketY = 18644.430;
    inline constexpr double HomeX = -24169.643;
    inline constexpr double HomeY = 17669.994;
    inline constexpr double Reach = 600.;
    inline constexpr double Still = 60.;
    inline constexpr double Walk = 450.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 680;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepOpen;
        double Along = 0.;
        bool bComing = false;
        bool bBack = false;
    };

    inline constexpr bool CountsAsCar(int Kind)
    {
        return Kind == 0;
    }

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline double Span()
    {
        return Apart(HomeX, HomeY, PocketX, PocketY);
    }

    inline FSpot Home()
    {
        return {HomeX, HomeY};
    }

    inline FSpot Pocket()
    {
        return {PocketX, PocketY};
    }

    inline FSpot Place(double Along)
    {
        const double Whole = Span();
        const double Portion = Whole > 1. ? Along / Whole : 0.;
        return {HomeX + (PocketX - HomeX) * Portion, HomeY + (PocketY - HomeY) * Portion};
    }

    inline bool Held(int Kind, double Speed, double X, double Y)
    {
        return CountsAsCar(Kind) && std::fabs(Speed) <= Still && Apart(X, Y, PocketX, PocketY) <= Reach;
    }

    inline FRun Tick(const FRun& Now, double Seconds, int Kind, double Speed, double X, double Y)
    {
        FRun After = Now;
        After.bBack = false;
        if (Now.Step >= StepBanked) return After;
        double Spent = Seconds;
        if (Spent > Slice) Spent = Slice;
        if (Spent < 0.) Spent = 0.;
        const double Whole = Span();
        if (Held(Kind, Speed, X, Y))
        {
            After.bComing = true;
            After.Along = Now.Along + Walk * Spent;
            if (After.Along > Whole) After.Along = Whole;
            if (After.Along >= Whole) After.Step = StepBanked;
            return After;
        }
        if (Now.bComing && Now.Along > 0.) After.bBack = true;
        After.bComing = false;
        After.Along = Now.Along - Walk * Spent;
        if (After.Along < 0.) After.Along = 0.;
        return After;
    }
}
