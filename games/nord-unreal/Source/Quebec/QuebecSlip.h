#pragma once

// Engine-independent rules for mission 24, losing a pursuer on foot.
// No Unreal includes, so Scripts/test_slip.py can build this with the system compiler.
// They start behind the door and close on you once you step out. A sprint reaches the gate.
// A walk is caught. A car does not start the run and does not clear the gate.
// A catch sends you back to the door. Their place is not stored.
// A version-16 slot starts this slip over.
// The tail in mission 15 still follows a car. This one follows a person on foot.

#include <cmath>

namespace QuebecSlip
{
    inline constexpr int StepDoor = 0;
    inline constexpr int StepRun = 1;
    inline constexpr int StepBanked = 2;

    // Lawn west of the cart. The gate is due south. The door is the north end.
    inline constexpr double DoorX = 12800.;
    inline constexpr double DoorY = 14000.;
    inline constexpr double Length = 7200.;
    inline constexpr double Reach = 450.;
    inline constexpr double HeadStart = 1600.;
    inline constexpr double Catch = 500.;
    inline constexpr double RecoverNorth = 700.;
    inline constexpr double Slice = 0.25;
    // Between a walk (450) and a sprint (800). A walk is caught. A sprint is not.
    inline constexpr double CloseCmPerSecond = 640.;
    inline constexpr int Pay = 500;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepDoor;
        double X = 0.;
        double Y = DoorY + HeadStart;
        bool bCaught = false;
    };

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline bool InCircle(double X, double Y, double CX, double CY)
    {
        return Apart(X, Y, CX, CY) <= Reach;
    }

    inline FSpot Door()
    {
        return {DoorX, DoorY};
    }

    inline FSpot Gate()
    {
        return {DoorX, DoorY - Length};
    }

    inline FSpot Recover()
    {
        return {DoorX, DoorY + RecoverNorth};
    }

    inline FSpot Park()
    {
        return {DoorX, DoorY + HeadStart};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepRun && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bNoseBanked, int Step)
    {
        return bNoseBanked && Step >= StepDoor && Step < StepBanked;
    }

    // bOnFoot is a person on the ground. A car, a bike, and a swimmer are not.
    // One long frame only spends a quarter of a second. The same step outside does not also clear the gate.
    inline FRun Tick(FRun Now, double Seconds, bool bOnFoot, double X, double Y)
    {
        Now.bCaught = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepDoor)
        {
            if (bOnFoot && InCircle(X, Y, DoorX, DoorY))
            {
                const FSpot Behind = Park();
                Now.Step = StepRun;
                Now.X = Behind.X;
                Now.Y = Behind.Y;
            }
            return Now;
        }
        if (!bOnFoot) return Now;
        double Span = Apart(X, Y, Now.X, Now.Y);
        const double Budget = CloseCmPerSecond * Seconds;
        if (Span > 1e-9)
        {
            const double Move = Budget < Span ? Budget : Span;
            Now.X += (X - Now.X) / Span * Move;
            Now.Y += (Y - Now.Y) / Span * Move;
            Span -= Move;
        }
        if (Span <= Catch)
        {
            const FSpot Behind = Park();
            Now.bCaught = true;
            Now.Step = StepDoor;
            Now.X = Behind.X;
            Now.Y = Behind.Y;
            return Now;
        }
        const FSpot Out = Gate();
        if (InCircle(X, Y, Out.X, Out.Y)) Now.Step = StepBanked;
        return Now;
    }
}
