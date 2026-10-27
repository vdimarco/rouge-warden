#pragma once

// Engine-independent rules for mission 19, ringing three bells in order.
// No Unreal includes, so Scripts/test_bells.py can build this with the system compiler.
// The bells do not move. Ring the north one, then the middle, then the south.
// An early bell starts the order over. A sprint still rings. A car does not.
// The beat is stored on the version-12 tail. A version-11 slot starts it over.
// The seven story banks stay seven.

#include <cmath>

namespace QuebecBells
{
    inline constexpr int StepOne = 0;
    inline constexpr int StepTwo = 1;
    inline constexpr int StepThree = 2;
    inline constexpr int StepBanked = 3;
    inline constexpr int Count = 3;

    // East of the follow line, on the same open north lawn.
    inline constexpr double BellX = 24800.;
    inline constexpr double BellOneY = 22000.;
    inline constexpr double BellTwoY = 19000.;
    inline constexpr double BellThreeY = 16000.;
    inline constexpr double Reach = 450.;
    inline constexpr double RecoverNorth = 700.;
    inline constexpr int Pay = 340;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRing
    {
        int Step = StepOne;
        bool bEarly = false;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline FSpot Bell(int Index)
    {
        if (Index < 0) Index = 0;
        if (Index > 2) Index = 2;
        const double Y = Index == 0 ? BellOneY : Index == 1 ? BellTwoY : BellThreeY;
        return {BellX, Y};
    }

    inline bool InBell(int Index, double X, double Y)
    {
        const FSpot Mark = Bell(Index);
        return Gap(X, Y, Mark.X, Mark.Y) <= Reach;
    }

    inline FSpot Recover(int Step)
    {
        const FSpot Mark = Bell(Step);
        return {Mark.X, Mark.Y + RecoverNorth};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepThree && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bRollBanked, int Step)
    {
        return bRollBanked && Step >= StepOne && Step < StepBanked;
    }

    // bHaveNext is a walker inside the bell this step is waiting for.
    // bHaveOther is a walker inside a different bell, and nobody is in the next one.
    // Pace does not matter. Leaving every bell does nothing.
    inline FRing Tick(FRing Now, bool bOnFoot, bool bHaveNext, bool bHaveOther)
    {
        Now.bEarly = false;
        if (Now.Step >= StepBanked) return Now;
        if (bOnFoot && bHaveNext)
        {
            Now.Step += 1;
            return Now;
        }
        if (bOnFoot && bHaveOther)
        {
            Now.bEarly = true;
            Now.Step = StepOne;
        }
        return Now;
    }
}
