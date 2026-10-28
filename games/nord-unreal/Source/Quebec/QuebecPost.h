#pragma once

#include <cmath>

// Engine-independent rules for the post.
// On foot, keep walking inside the mark. Standing still does not count, and a
// sprint or a step out starts the count again and does not save. A car does
// not stand the post. How long they have stood stays in the session.

namespace QuebecPost
{
    inline constexpr int StepOpen = 0;
    inline constexpr int StepBanked = 1;

    inline constexpr double MarkX = 57794.578;
    inline constexpr double MarkY = -18855.368;
    inline constexpr double Reach = 450.;
    inline constexpr double Drift = 90.;
    inline constexpr double Walk = 450.;
    inline constexpr double Fill = 6.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 700;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepOpen;
        double Clock = 0.;
        bool bBroke = false;
    };

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline FSpot Mark()
    {
        return {MarkX, MarkY};
    }

    inline bool Counting(bool bOnFoot, double Speed, double X, double Y)
    {
        return bOnFoot && Speed >= Drift && Speed <= Walk && Apart(X, Y, MarkX, MarkY) <= Reach;
    }

    inline FRun Tick(const FRun& Now, double Seconds, bool bOnFoot, double Speed, double X, double Y)
    {
        FRun After = Now;
        After.bBroke = false;
        if (Now.Step >= StepBanked) return After;
        double Spent = Seconds;
        if (Spent > Slice) Spent = Slice;
        if (Spent < 0.) Spent = 0.;
        if (Counting(bOnFoot, Speed, X, Y))
        {
            After.Clock = Now.Clock + Spent;
            if (After.Clock > Fill) After.Clock = Fill;
            if (After.Clock >= Fill) After.Step = StepBanked;
            return After;
        }
        if (Now.Clock > 0.) After.bBroke = true;
        After.Clock = 0.;
        return After;
    }
}
