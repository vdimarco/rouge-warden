#pragma once

#include <cmath>

// Engine-independent rules for the parcel.
// A parcel waits off a surveyed street. Picking it up on foot starts a clock.
// Two traffic cars keep the street and do not steer. Step into the lane while
// one is close and the parcel goes back. The clock is not saved. A car does not
// pick it up and does not deliver it. The stoop is off the far side.

namespace QuebecParcel
{
    inline constexpr double RoadAx = 60966.786;
    inline constexpr double RoadAy = -37733.027;
    inline constexpr double RoadBx = 63440.647;
    inline constexpr double RoadBy = -31813.030;
    inline constexpr double Side = 2200.;
    inline constexpr double Reach = 450.;
    inline constexpr double Lane = 700.;
    inline constexpr double Close = 900.;
    inline constexpr double TrafficCmPerSecond = 280.;
    inline constexpr double LimitSeconds = 16.;
    inline constexpr double Slice = 0.25;
    inline constexpr double TrafficA = 2648.051;
    inline constexpr double TrafficB = 3208.051;
    inline constexpr double RecoverPast = 1000.;
    inline constexpr int Pay = 620;
    inline constexpr int StepParcel = 0;
    inline constexpr int StepCarry = 1;
    inline constexpr int StepBanked = 2;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    inline double Length()
    {
        return std::hypot(RoadBx - RoadAx, RoadBy - RoadAy);
    }

    inline void Basis(double& AlongX, double& AlongY, double& SideX, double& SideY)
    {
        const double Whole = Length();
        AlongX = (RoadBx - RoadAx) / Whole;
        AlongY = (RoadBy - RoadAy) / Whole;
        SideX = -AlongY;
        SideY = AlongX;
    }

    inline double Wrap(double Along)
    {
        const double Whole = Length();
        Along = std::fmod(Along, Whole);
        if (Along < 0.) Along += Whole;
        return Along;
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

    inline FSpot Mid()
    {
        return OnRoad(Length() * 0.5);
    }

    inline FSpot Parcel()
    {
        const FSpot Mark = Mid();
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        return {Mark.X + SideX * Side, Mark.Y + SideY * Side};
    }

    inline FSpot Stoop()
    {
        const FSpot Mark = Mid();
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        return {Mark.X - SideX * Side, Mark.Y - SideY * Side};
    }

    inline FSpot Recover()
    {
        const FSpot Mark = Mid();
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        const double Out = Side + RecoverPast;
        return {Mark.X + SideX * Out, Mark.Y + SideY * Out};
    }

    inline double Apart(double Ax, double Ay, double Bx, double By)
    {
        return std::hypot(Ax - Bx, Ay - By);
    }

    inline double Lateral(double X, double Y)
    {
        double AlongX = 0.;
        double AlongY = 0.;
        double SideX = 0.;
        double SideY = 0.;
        Basis(AlongX, AlongY, SideX, SideY);
        double Along = (X - RoadAx) * AlongX + (Y - RoadAy) * AlongY;
        const double Whole = Length();
        if (Along < 0.) Along = 0.;
        if (Along > Whole) Along = Whole;
        const FSpot Mark = OnRoad(Along);
        return Apart(X, Y, Mark.X, Mark.Y);
    }

    struct FRun
    {
        int Step = StepParcel;
        double Clock = 0.;
        double AlongA = TrafficA;
        double AlongB = TrafficB;
        bool bDropped = false;
    };

    inline FRun Tick(const FRun& Now, double DeltaSeconds, bool bOnFoot, double X, double Y)
    {
        FRun Next = Now;
        Next.bDropped = false;
        if (DeltaSeconds < 0.) DeltaSeconds = 0.;
        if (DeltaSeconds > Slice) DeltaSeconds = Slice;
        Next.AlongA = Wrap(Now.AlongA + TrafficCmPerSecond * DeltaSeconds);
        Next.AlongB = Wrap(Now.AlongB + TrafficCmPerSecond * DeltaSeconds);
        if (Now.Step >= StepBanked) return Next;
        if (Now.Step == StepParcel)
        {
            const FSpot Mark = Parcel();
            if (bOnFoot && Apart(X, Y, Mark.X, Mark.Y) <= Reach)
            {
                Next.Step = StepCarry;
                Next.Clock = LimitSeconds;
            }
            return Next;
        }
        Next.Clock = Now.Clock - DeltaSeconds;
        const FSpot CarA = OnRoad(Next.AlongA);
        const FSpot CarB = OnRoad(Next.AlongB);
        const bool bOnLane = Lateral(X, Y) <= Lane;
        const bool bHit = bOnLane
            && (Apart(X, Y, CarA.X, CarA.Y) <= Close || Apart(X, Y, CarB.X, CarB.Y) <= Close);
        if (bHit || Next.Clock <= 0.)
        {
            Next.Step = StepParcel;
            Next.Clock = 0.;
            Next.AlongA = TrafficA;
            Next.AlongB = TrafficB;
            Next.bDropped = true;
            return Next;
        }
        const FSpot Door = Stoop();
        if (bOnFoot && Apart(X, Y, Door.X, Door.Y) <= Reach) Next.Step = StepBanked;
        return Next;
    }
}
