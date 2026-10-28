#pragma once

// A session walk of three sidewalk posts, in order. No Unreal types.
// The same person on foot tags porte 1, then 2, then 3. A driver does not count.
// Skipping a post does not count. The purse is paid once, at the last post. Nothing is saved.

namespace QuebecTrio
{
    inline constexpr int StopCount = 3;
    inline constexpr int Done = 3;
    inline constexpr int Nobody = -1;
    inline constexpr float Reach = 450.f;
    inline constexpr int Pay = 240;

    struct FStop
    {
        double X = 0.;
        double Y = 0.;
    };

    // Sidewalks east of the park, each leg longer than 100 m, each post off the asphalt.
    inline constexpr FStop Stops[StopCount] = {
        {40728.122518850185, -13228.603649675151},
        {50326.0914605786, -17800.430512056646},
        {33318.71650840211, -21325.7112521016},
    };

    struct FProgress
    {
        int Step = 0;
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

    // Step 0 becomes 1 at the first post and remembers who. That person then has to hit
    // post 2, then post 3. A later post does not skip. Someone else cannot finish it.
    inline FProgress Advance(FProgress Progress, int Who, bool bOnFoot, bool bAt0, bool bAt1, bool bAt2)
    {
        if (!bOnFoot || Who == Nobody || Progress.Step >= Done) return Progress;
        const bool bHere = Progress.Step == 0 ? bAt0 : Progress.Step == 1 ? bAt1 : bAt2;
        if (!bHere) return Progress;
        if (Progress.Step == 0)
        {
            Progress.Step = 1;
            Progress.Runner = Who;
            return Progress;
        }
        if (Who != Progress.Runner) return Progress;
        Progress.Step += 1;
        return Progress;
    }

    inline int Purse(FProgress Before, FProgress After)
    {
        return Before.Step == StopCount - 1 && After.Step == Done && After.Runner == Before.Runner ? Pay : 0;
    }
}
