#pragma once

// Engine-independent rules for mission 16, the day.
// No Unreal includes, so Scripts/test_finale.py can build this with the system compiler.
// One shorter run of the walk-up, the dark, the page, the grass, and a car that follows.
// A fail returns to that stage. The purse is once, at the end. The clocks are not stored.
// A version-8 slot starts this day over.

#include <cmath>

namespace QuebecFinale
{
    inline constexpr int StepMeet = 0;
    inline constexpr int StepDark = 1;
    inline constexpr int StepPage = 2;
    inline constexpr int StepCut = 3;
    inline constexpr int StepChase = 4;
    inline constexpr int StepBanked = 5;

    // Open lawn, east of the pond and west of the earlier beats. Every mark is on foot except the last.
    inline constexpr double ColumnX = 32800.;
    inline constexpr double MeetY = 19000.;
    inline constexpr double PocketY = 16200.;
    inline constexpr double FarY = 13700.;
    inline constexpr double CaseY = 10500.;
    inline constexpr double DropY = 7000.;
    inline constexpr double LineY = 5200.;
    inline constexpr double FinishY = 2200.;
    inline constexpr double BendX = 34600.;
    inline constexpr double BendY = 3700.;
    inline constexpr double LampAX = 32300.;
    inline constexpr double LampAY = 14950.;
    inline constexpr double LampBX = 33300.;
    inline constexpr double LampBY = 14950.;
    inline constexpr double DarkWestX = 31400.;
    inline constexpr double DarkWestY = 14950.;
    inline constexpr double FootReach = 450.;
    inline constexpr double Lamp = 650.;
    inline constexpr double RecoverNorth = 700.;
    // The clock starts anywhere in the circle, including the south edge.
    // Five seconds still loses a walk from that edge and still beats a sprint from the north edge.
    inline constexpr double Window = 5.;
    inline constexpr double Slice = 0.25;
    // Faster than a sprint. Their time still loses a walk from the south edge of the line
    // and still loses to a sprint from the north edge of the line.
    inline constexpr double RivalCmPerSecond = 1100.;

    // A different surveyed edge from mission 15. Seat, park, and hide sit on it.
    inline constexpr double RoadWestX = 36384.939;
    inline constexpr double RoadWestY = -13092.345;
    inline constexpr double RoadEastX = 38188.081;
    inline constexpr double RoadEastY = -4938.155;
    inline constexpr double SeatAlong = 3800.;
    inline constexpr double HideAlong = 8300.;
    inline constexpr double HeadStart = 1200.;
    inline constexpr double RecoverSide = 1600.;
    inline constexpr double CarReach = 1100.;
    inline constexpr double Catch = 600.;
    inline constexpr double TailCmPerSecond = 1100.;
    inline constexpr int Pay = 800;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FDay
    {
        int Step = StepMeet;
        bool bBurned = false;
        bool bHolding = false;
        bool bRacing = false;
        bool bTailing = false;
        double Elapsed = 0.;
        double TailX = 0.;
        double TailY = 0.;
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

    inline FSpot Meet() { return {ColumnX, MeetY}; }
    inline FSpot Pocket() { return {ColumnX, PocketY}; }
    inline FSpot Far() { return {ColumnX, FarY}; }
    inline FSpot Case() { return {ColumnX, CaseY}; }
    inline FSpot Drop() { return {ColumnX, DropY}; }
    inline FSpot Line() { return {ColumnX, LineY}; }
    inline FSpot Finish() { return {ColumnX, FinishY}; }
    inline FSpot Bend() { return {BendX, BendY}; }

    inline bool InMeet(double X, double Y) { return InCircle(X, Y, ColumnX, MeetY, FootReach); }
    inline bool InPocket(double X, double Y) { return InCircle(X, Y, ColumnX, PocketY, FootReach); }
    inline bool InFar(double X, double Y) { return InCircle(X, Y, ColumnX, FarY, FootReach); }
    inline bool InCase(double X, double Y) { return InCircle(X, Y, ColumnX, CaseY, FootReach); }
    inline bool InDrop(double X, double Y) { return InCircle(X, Y, ColumnX, DropY, FootReach); }
    inline bool InLine(double X, double Y) { return InCircle(X, Y, ColumnX, LineY, FootReach); }
    inline bool InFinish(double X, double Y) { return InCircle(X, Y, ColumnX, FinishY, FootReach); }

    inline bool InLamp(double X, double Y)
    {
        return InCircle(X, Y, LampAX, LampAY, Lamp) || InCircle(X, Y, LampBX, LampBY, Lamp);
    }

    inline double Grass()
    {
        return Apart(ColumnX, LineY, ColumnX, FinishY);
    }

    inline double Road()
    {
        return Apart(ColumnX, LineY, BendX, BendY) + Apart(BendX, BendY, ColumnX, FinishY);
    }

    inline double Edge()
    {
        return Apart(RoadWestX, RoadWestY, RoadEastX, RoadEastY);
    }

    inline FSpot OnEdge(double Along)
    {
        const double DX = RoadEastX - RoadWestX;
        const double DY = RoadEastY - RoadWestY;
        const double Length = Edge();
        const double Portion = Length <= 0. ? 0. : Along / Length;
        return {RoadWestX + DX * Portion, RoadWestY + DY * Portion};
    }

    inline FSpot Seat() { return OnEdge(SeatAlong); }
    inline FSpot Hide() { return OnEdge(HideAlong); }

    // Left of the eastbound edge, away from the comic stand.
    inline FSpot ChaseRecover()
    {
        const FSpot Door = Seat();
        const double Length = Edge();
        const double UX = Length <= 0. ? 0. : (RoadEastX - RoadWestX) / Length;
        const double UY = Length <= 0. ? 0. : (RoadEastY - RoadWestY) / Length;
        return {Door.X - UY * RecoverSide, Door.Y + UX * RecoverSide};
    }

    inline FSpot Recover(int Step)
    {
        if (Step == StepDark) return {ColumnX, PocketY + RecoverNorth};
        if (Step == StepPage) return {ColumnX, CaseY + RecoverNorth};
        if (Step == StepCut) return {ColumnX, LineY + RecoverNorth};
        if (Step == StepChase) return ChaseRecover();
        return {ColumnX, MeetY + RecoverNorth};
    }

    inline bool InSeat(double X, double Y)
    {
        const FSpot Door = Seat();
        return InCircle(X, Y, Door.X, Door.Y, CarReach);
    }

    inline bool InHide(double X, double Y)
    {
        const FSpot Door = Hide();
        return InCircle(X, Y, Door.X, Door.Y, CarReach);
    }

    inline FDay Park()
    {
        const FSpot Waiting = OnEdge(SeatAlong - HeadStart);
        FDay Day;
        Day.Step = StepChase;
        Day.TailX = Waiting.X;
        Day.TailY = Waiting.Y;
        return Day;
    }

    inline int Left(double Remain)
    {
        if (Remain <= 0.) return 0;
        return static_cast<int>(std::ceil(Remain));
    }

    inline int PageLeft(double Elapsed)
    {
        if (Elapsed < 0.) Elapsed = 0.;
        return Left(Window - Elapsed);
    }

    inline int CutLeft(double Elapsed)
    {
        if (Elapsed < 0.) Elapsed = 0.;
        return Left(Road() / RivalCmPerSecond - Elapsed);
    }

    inline void Place(double Elapsed, double& X, double& Y)
    {
        double Along = Elapsed * RivalCmPerSecond;
        if (Along < 0.) Along = 0.;
        const FSpot Start = Line();
        const FSpot Corner = Bend();
        const FSpot End = Finish();
        const double First = Apart(Start.X, Start.Y, Corner.X, Corner.Y);
        const double Whole = Road();
        if (Along > Whole) Along = Whole;
        if (Along <= First || First <= 0.)
        {
            const double Portion = First <= 0. ? 1. : Along / First;
            X = Start.X + (Corner.X - Start.X) * Portion;
            Y = Start.Y + (Corner.Y - Start.Y) * Portion;
            return;
        }
        const double Rest = Whole - First;
        const double Portion = Rest <= 0. ? 1. : (Along - First) / Rest;
        X = Corner.X + (End.X - Corner.X) * Portion;
        Y = Corner.Y + (End.Y - Corner.Y) * Portion;
    }

    // bOnFoot is a walker. bInCar is a real car, kind 0. bHaveBody is false when nobody is there.
    // bLamp is true when any person is standing in a lamp, including someone who is not at X, Y.
    // A catch, including a tie on the hide, sends the seat back. The hide pays only when the gap is still open.
    inline FDay Tick(FDay Now, double Seconds, bool bOnFoot, bool bInCar, bool bHaveBody, double X, double Y, bool bLamp)
    {
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        const bool bFoot = bOnFoot && bHaveBody;
        if (Now.Step == StepMeet)
        {
            if (bFoot && InMeet(X, Y)) Now.Step = StepDark;
            return Now;
        }
        if (Now.Step == StepDark)
        {
            const bool bLit = bLamp || (bHaveBody && InLamp(X, Y));
            if (bLit) Now.bBurned = true;
            if (bFoot && InPocket(X, Y) && !InLamp(X, Y) && !bLamp) Now.bBurned = false;
            if (!Now.bBurned && bFoot && InFar(X, Y) && !InLamp(X, Y))
            {
                Now.Step = StepPage;
                Now.bBurned = false;
            }
            return Now;
        }
        if (Now.Step == StepPage)
        {
            if (!Now.bHolding)
            {
                if (bFoot && InCase(X, Y))
                {
                    Now.bHolding = true;
                    Now.Elapsed = 0.;
                }
                return Now;
            }
            Now.Elapsed += Seconds;
            if (Now.Elapsed > Window)
            {
                Now.bHolding = false;
                Now.Elapsed = 0.;
                return Now;
            }
            if (bFoot && InDrop(X, Y))
            {
                Now.Step = StepCut;
                Now.bHolding = false;
                Now.Elapsed = 0.;
            }
            return Now;
        }
        if (Now.Step == StepCut)
        {
            if (!Now.bRacing)
            {
                if (bFoot && InLine(X, Y))
                {
                    Now.bRacing = true;
                    Now.Elapsed = 0.;
                }
                return Now;
            }
            Now.Elapsed += Seconds;
            if (Now.Elapsed * RivalCmPerSecond >= Road())
            {
                Now.bRacing = false;
                Now.Elapsed = 0.;
                return Now;
            }
            if (bFoot && InFinish(X, Y))
            {
                const FDay Waiting = Park();
                Now.Step = StepChase;
                Now.bRacing = false;
                Now.Elapsed = 0.;
                Now.bTailing = false;
                Now.TailX = Waiting.TailX;
                Now.TailY = Waiting.TailY;
            }
            return Now;
        }
        if (!Now.bTailing)
        {
            if (bInCar && bHaveBody && InSeat(X, Y))
            {
                const FDay Waiting = Park();
                Now.bTailing = true;
                Now.TailX = Waiting.TailX;
                Now.TailY = Waiting.TailY;
            }
            return Now;
        }
        if (!bHaveBody) return Now;
        double Span = Apart(X, Y, Now.TailX, Now.TailY);
        const double Budget = TailCmPerSecond * Seconds;
        if (Span > 1e-9)
        {
            const double Move = Budget < Span ? Budget : Span;
            Now.TailX += (X - Now.TailX) / Span * Move;
            Now.TailY += (Y - Now.TailY) / Span * Move;
            Span -= Move;
        }
        if (Span <= Catch)
        {
            const FDay Waiting = Park();
            Now.bTailing = false;
            Now.TailX = Waiting.TailX;
            Now.TailY = Waiting.TailY;
            return Now;
        }
        if (bInCar && InHide(X, Y))
        {
            Now.Step = StepBanked;
            Now.bTailing = false;
        }
        return Now;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepChase && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bChaseBanked, int Step)
    {
        return bChaseBanked && Step >= StepMeet && Step < StepBanked;
    }
}
