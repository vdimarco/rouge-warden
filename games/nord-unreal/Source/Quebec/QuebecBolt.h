#pragma once

#include <cmath>

// Engine-independent rules for the bolt.
// Drive a real car to the far end, still fast, nose down the road. A seeker then
// steers toward you. Reach the bay in the car before they close. A crawl is caught
// and the chase starts again. The drive stays banked. Then get out. The gate is
// further off the road, and they do not follow. The clock is not saved. A car
// does not clear the gate. A timeout starts that clock again and leaves the chase banked.

namespace QuebecBolt
{
    inline constexpr int StepDrive = 0;
    inline constexpr int StepChase = 1;
    inline constexpr int StepOut = 2;
    inline constexpr int StepBanked = 3;

    inline constexpr double RoadAx = -152.082;
    inline constexpr double RoadAy = 21026.122;
    inline constexpr double RoadBx = -16062.937;
    inline constexpr double RoadBy = 31202.996;
    inline constexpr double StartAlong = 1800.;
    inline constexpr double EndBack = 2200.;
    inline constexpr double SeekBack = 1800.;
    inline constexpr double BaySide = 2000.;
    inline constexpr double GatePast = 1800.;
    inline constexpr double Reach = 600.;
    inline constexpr double DriveMin = 1200.;
    inline constexpr double Align = 0.62;
    inline constexpr double SeekCmPerSecond = 1050.;
    inline constexpr double Catch = 700.;
    inline constexpr double LimitSeconds = 10.;
    inline constexpr double Slice = 0.25;
    inline constexpr int Pay = 720;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FRun
    {
        int Step = StepDrive;
        double Clock = 0.;
        double SeekX = 0.;
        double SeekY = 0.;
        bool bCaught = false;
        bool bExpired = false;
    };

    inline constexpr bool CountsAsCar(int Kind)
    {
        return Kind == 0;
    }

    inline double Apart(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline double Length()
    {
        return Apart(RoadAx, RoadAy, RoadBx, RoadBy);
    }

    inline void Basis(double& AlongX, double& AlongY, double& SideX, double& SideY)
    {
        const double Whole = Length();
        AlongX = (RoadBx - RoadAx) / Whole;
        AlongY = (RoadBy - RoadAy) / Whole;
        SideX = -AlongY;
        SideY = AlongX;
    }

    inline FSpot OnRoad(double Along)
    {
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        return {RoadAx + AlongX * Along, RoadAy + AlongY * Along};
    }

    inline double EndAlong()
    {
        return Length() - EndBack;
    }

    inline FSpot DriveStart()
    {
        return OnRoad(StartAlong);
    }

    inline FSpot End()
    {
        return OnRoad(EndAlong());
    }

    inline FSpot Home()
    {
        return OnRoad(EndAlong() - SeekBack);
    }

    inline FSpot Off(double Side)
    {
        const FSpot Mark = End();
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        return {Mark.X + SideX * Side, Mark.Y + SideY * Side};
    }

    inline FSpot Bay()
    {
        return Off(BaySide);
    }

    inline FSpot Gate()
    {
        return Off(BaySide + GatePast);
    }

    inline double DotRoad(double ForwardX, double ForwardY)
    {
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        return ForwardX * AlongX + ForwardY * AlongY;
    }

    inline void Steer(double& SeekX, double& SeekY, double TowardX, double TowardY, double DeltaSeconds)
    {
        const double DX = TowardX - SeekX;
        const double DY = TowardY - SeekY;
        const double Dist = std::hypot(DX, DY);
        if (Dist < 1.) return;
        const double Step = SeekCmPerSecond * DeltaSeconds < Dist ? SeekCmPerSecond * DeltaSeconds : Dist;
        SeekX += DX / Dist * Step;
        SeekY += DY / Dist * Step;
    }

    inline FRun Fresh()
    {
        FRun Run;
        const FSpot Parked = Home();
        Run.SeekX = Parked.X;
        Run.SeekY = Parked.Y;
        return Run;
    }

    inline FRun Tick(const FRun& Now, double DeltaSeconds, int Kind, bool bOnFoot, double Speed, double ForwardX, double ForwardY, double X, double Y)
    {
        FRun Next = Now;
        Next.bCaught = false;
        Next.bExpired = false;
        if (DeltaSeconds < 0.) DeltaSeconds = 0.;
        if (DeltaSeconds > Slice) DeltaSeconds = Slice;
        if (Now.Step >= StepBanked) return Next;
        const bool bCar = CountsAsCar(Kind);
        if (Now.Step == StepDrive)
        {
            const FSpot Mark = End();
            if (bCar && Apart(X, Y, Mark.X, Mark.Y) <= Reach && Speed >= DriveMin && DotRoad(ForwardX, ForwardY) >= Align)
            {
                Next.Step = StepChase;
                const FSpot Parked = Home();
                Next.SeekX = Parked.X;
                Next.SeekY = Parked.Y;
            }
            return Next;
        }
        if (Now.Step == StepChase)
        {
            Steer(Next.SeekX, Next.SeekY, X, Y, DeltaSeconds);
            if (Apart(Next.SeekX, Next.SeekY, X, Y) <= Catch)
            {
                const FSpot Parked = Home();
                Next.SeekX = Parked.X;
                Next.SeekY = Parked.Y;
                Next.bCaught = true;
                return Next;
            }
            const FSpot Mark = Bay();
            if (bCar && Apart(X, Y, Mark.X, Mark.Y) <= Reach)
            {
                Next.Step = StepOut;
                Next.Clock = LimitSeconds;
            }
            return Next;
        }
        Next.Clock = Now.Clock - DeltaSeconds;
        if (Next.Clock <= 0.)
        {
            Next.Clock = LimitSeconds;
            Next.bExpired = true;
            return Next;
        }
        const FSpot Door = Gate();
        if (bOnFoot && Apart(X, Y, Door.X, Door.Y) <= Reach) Next.Step = StepBanked;
        return Next;
    }
}
