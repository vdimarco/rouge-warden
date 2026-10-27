#pragma once

// Engine-independent rules for mission 12, the lamp crossing.
// No Unreal includes, so Scripts/test_shade.py can build this with the system compiler.
// Grey Coat's walk is a person who follows. This beat is the opposite: two lamps, and a straight walk is seen.
// The burn is not stored. A version-4 slot starts this beat over.

#include <cmath>

namespace QuebecShade
{
    inline constexpr int StepPocket = 0;
    inline constexpr int StepCross = 1;
    inline constexpr int StepBanked = 2;

    inline constexpr double PocketX = 50700.;
    inline constexpr double PocketY = 14500.;
    inline constexpr double FarX = 50700.;
    inline constexpr double FarY = 9000.;
    inline constexpr double LampAX = 50000.;
    inline constexpr double LampAY = 12000.;
    inline constexpr double LampBX = 51400.;
    inline constexpr double LampBY = 12000.;
    inline constexpr double RecoverNorth = 900.;
    inline constexpr double Reach = 450.;
    inline constexpr double Lamp = 800.;
    inline constexpr int Pay = 520;

    struct FCross
    {
        int Step = StepPocket;
        bool bBurned = false;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline bool InCircle(double X, double Y, double CX, double CY, double Radius)
    {
        return Gap(X, Y, CX, CY) <= Radius;
    }

    inline bool InLamp(double X, double Y)
    {
        return InCircle(X, Y, LampAX, LampAY, Lamp) || InCircle(X, Y, LampBX, LampBY, Lamp);
    }

    inline bool InPocket(double X, double Y)
    {
        return InCircle(X, Y, PocketX, PocketY, Reach);
    }

    inline bool InFar(double X, double Y)
    {
        return InCircle(X, Y, FarX, FarY, Reach);
    }

    // bSomeoneLit is true when any person is standing in a lamp, including someone who is not at X, Y.
    inline FCross Watch(FCross Now, bool bOnFoot, double X, double Y, bool bSomeoneLit)
    {
        if (Now.Step >= StepBanked) return Now;
        const bool bLit = bSomeoneLit || InLamp(X, Y);
        if (Now.Step == StepPocket)
        {
            if (bOnFoot && InPocket(X, Y) && !InLamp(X, Y))
            {
                Now.Step = StepCross;
                Now.bBurned = false;
            }
            else return Now;
        }
        if (bLit) Now.bBurned = true;
        if (Now.bBurned)
        {
            if (bOnFoot && InPocket(X, Y) && !InLamp(X, Y) && !bSomeoneLit) Now.bBurned = false;
            return Now;
        }
        if (bOnFoot && InFar(X, Y) && !InLamp(X, Y)) Now.Step = StepBanked;
        return Now;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepCross && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bEscortBanked, int Step)
    {
        return bEscortBanked && Step >= StepPocket && Step < StepBanked;
    }
}
