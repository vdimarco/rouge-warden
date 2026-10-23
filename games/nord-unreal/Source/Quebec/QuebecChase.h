#pragma once

// Engine-independent rules for mission 15, the tail.
// No Unreal includes, so Scripts/test_chase.py can build this with the system compiler.
// The lap ghost stays on the race route. The police chase stays on wanted cars.
// This car follows the player. A drive down the straight road pulls away. A crawl is caught.
// Only a real car (kind 0) can take the seat or the hide. A bike, a pedalo, a scooter, or a walker cannot.
// Getting out does not stop the tail. Their place on the road is not stored. A version-7 slot starts this beat over.

#include <cmath>

namespace QuebecChase
{
    inline constexpr int StepSeat = 0;
    inline constexpr int StepTail = 1;
    inline constexpr int StepBanked = 2;

    // One surveyed edge, west to east. The seat and the hide sit on it. The tail waits behind the seat.
    inline constexpr double RoadWestX = 55373.3;
    inline constexpr double RoadWestY = 15114.2;
    inline constexpr double RoadEastX = 75373.3;
    inline constexpr double RoadEastY = 1932.1;
    inline constexpr double StartX = 59548.1;
    inline constexpr double StartY = 12362.6;
    inline constexpr double HideX = 74577.2;
    inline constexpr double HideY = 2456.8;
    inline constexpr double RecoverX = 60538.6;
    inline constexpr double RecoverY = 13865.5;
    inline constexpr double Reach = 1400.;
    inline constexpr double HeadStart = 4500.;
    inline constexpr double Catch = 900.;
    inline constexpr double Slice = 0.25;
    inline constexpr double TailCmPerSecond = 1100.;
    inline constexpr int Pay = 640;

    struct FTail
    {
        int Step = StepSeat;
        double X = 0.;
        double Y = 0.;
    };

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline constexpr bool CountsAsCar(int Kind)
    {
        return Kind == 0;
    }

    inline bool InCircle(double X, double Y, double CX, double CY, double Radius)
    {
        return Apart(X, Y, CX, CY) <= Radius;
    }

    inline bool InStart(double X, double Y)
    {
        return InCircle(X, Y, StartX, StartY, Reach);
    }

    inline bool InHide(double X, double Y)
    {
        return InCircle(X, Y, HideX, HideY, Reach);
    }

    inline FTail Park()
    {
        const double DX = HideX - StartX;
        const double DY = HideY - StartY;
        const double Length = std::hypot(DX, DY);
        const double Portion = Length <= 0. ? 0. : HeadStart / Length;
        FTail Waiting;
        Waiting.Step = StepSeat;
        Waiting.X = StartX - DX * Portion;
        Waiting.Y = StartY - DY * Portion;
        return Waiting;
    }

    // bInCar is a real car, kind 0. bHaveBody is false when nobody is there, so the tail does not seek the origin.
    // A catch, including a tie on the hide, sends the line back. The hide pays only when the gap is still open.
    inline FTail Tick(FTail Now, double Seconds, bool bInCar, bool bHaveBody, double X, double Y)
    {
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepSeat)
        {
            if (bInCar && bHaveBody && InStart(X, Y))
            {
                const FTail Waiting = Park();
                Now.Step = StepTail;
                Now.X = Waiting.X;
                Now.Y = Waiting.Y;
            }
            return Now;
        }
        if (!bHaveBody) return Now;
        double Span = Apart(X, Y, Now.X, Now.Y);
        const double Budget = TailCmPerSecond * Seconds;
        if (Span > 1e-9)
        {
            const double Move = Budget < Span ? Budget : Span;
            Now.X += (X - Now.X) / Span * Move;
            Now.Y += (Y - Now.Y) / Span * Move;
            Span -= Move;
        }
        if (Span <= Catch) return Park();
        if (bInCar && InHide(X, Y)) Now.Step = StepBanked;
        return Now;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepTail && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bCutBanked, int Step)
    {
        return bCutBanked && Step >= StepSeat && Step < StepBanked;
    }
}
