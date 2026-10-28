#pragma once

// Engine-independent rules for mission 21, the send-off.
// No Unreal includes, so Scripts/test_send.py can build this with the system compiler.
// Four stages on one lawn: the door on foot, a gentle drive, a full stop, then a walk.
// A fail stays on that stage. The purse is once, at the end. How far the drive got is not stored.
// A version-13 slot starts this send-off over.
// This is not the five-stage day. No lamps, no page, no grass cut, and no car that follows.

#include <cmath>

namespace QuebecSend
{
    inline constexpr int StepDoor = 0;
    inline constexpr int StepDrive = 1;
    inline constexpr int StepStop = 2;
    inline constexpr int StepWalk = 3;
    inline constexpr int StepBanked = 4;

    // East of the bells and west of the five-stage day, on open lawn.
    inline constexpr double ColumnX = 28800.;
    inline constexpr double DoorY = 21000.;
    inline constexpr double GateY = 16500.;
    inline constexpr double BayY = 13500.;
    inline constexpr double FinishY = 10500.;
    inline constexpr double FootReach = 450.;
    inline constexpr double CarReach = 1100.;
    inline constexpr double Lane = 1600.;
    inline constexpr double RecoverNorth = 700.;
    inline constexpr double DriveSpan = 4500.;
    // Above a cruise and below a flat-out run. The header treats anything faster as too fast.
    inline constexpr double SpeedCap = 1600.;
    inline constexpr double Crawl = 80.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 520;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FDay
    {
        int Step = StepDoor;
        double Driven = 0.;
        bool bFast = false;
    };

    inline constexpr bool CountsAsCar(int Kind)
    {
        return Kind == 0;
    }

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline bool InCircle(double X, double Y, double CY, double Radius)
    {
        return Apart(X, Y, ColumnX, CY) <= Radius;
    }

    inline bool InDoor(double X, double Y) { return InCircle(X, Y, DoorY, FootReach); }
    inline bool InGate(double X, double Y) { return InCircle(X, Y, GateY, CarReach); }
    inline bool InBay(double X, double Y) { return InCircle(X, Y, BayY, CarReach); }
    inline bool InFinish(double X, double Y) { return InCircle(X, Y, FinishY, FootReach); }
    inline bool InLane(double X) { return std::fabs(X - ColumnX) <= Lane; }

    inline FSpot Recover(int Step)
    {
        if (Step == StepDrive) return {ColumnX, DoorY};
        if (Step == StepStop) return {ColumnX, GateY};
        if (Step == StepWalk) return {ColumnX, FinishY + RecoverNorth};
        return {ColumnX, DoorY + RecoverNorth};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepWalk && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bBlockBanked, int Step)
    {
        return bBlockBanked && Step >= StepDoor && Step < StepBanked;
    }

    // bInMark is the circle for this stage. bInLane lets a gentle car add to the drive.
    // Speed is centimeters per second. One long frame only spends a quarter of a second.
    inline FDay Tick(FDay Now, double Seconds, bool bOnFoot, bool bInCar, bool bHaveBody, double Speed, bool bInMark, bool bInLane)
    {
        Now.bFast = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Speed < 0.) Speed = 0.;
        if (!bHaveBody) return Now;
        if (Now.Step == StepDoor)
        {
            if (bOnFoot && !bInCar && bInMark)
            {
                Now.Step = StepDrive;
                Now.Driven = 0.;
            }
            return Now;
        }
        if (Now.Step == StepDrive)
        {
            if (bInCar && Speed > SpeedCap)
            {
                if (Now.Driven > 0.) Now.bFast = true;
                Now.Driven = 0.;
                return Now;
            }
            if (bInCar && bInLane && Speed > 0.) Now.Driven += Speed * Seconds;
            if (bInCar && bInMark && Now.Driven >= DriveSpan && Speed <= SpeedCap) Now.Step = StepStop;
            return Now;
        }
        if (Now.Step == StepStop)
        {
            if (bInCar && bInMark && Speed <= Crawl) Now.Step = StepWalk;
            return Now;
        }
        if (bOnFoot && !bInCar && bInMark) Now.Step = StepBanked;
        return Now;
    }
}
