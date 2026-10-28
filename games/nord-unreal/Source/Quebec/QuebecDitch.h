#pragma once

// Engine-independent rules for mission 26, ditching a chase car.
// No Unreal includes, so Scripts/test_ditch.py can build this with the system compiler.
// Cross a line in a real car, still rolling, nose toward the far end. They start behind you
// and drive the road. They do not steer. Beat them to the end, then get out. The mark is
// off the road, and they stop at the end. A crawl is caught. A walker does not start it.
// A catch sends the line back. How far they have driven is not stored.
// A version-18 slot starts this ditch over.
// The tail still follows a car to a hide. The traffic car is still caught from alongside.
// The stall is still a reverse. The slip is still a sprint on foot.

#include <cmath>

namespace QuebecDitch
{
    inline constexpr int StepRoll = 0;
    inline constexpr int StepLead = 1;
    inline constexpr int StepFoot = 2;
    inline constexpr int StepBanked = 3;

    // Surveyed road north of the stall. The line is in from the near end. The clear mark is off the far end.
    inline constexpr double RoadAx = 46815.398;
    inline constexpr double RoadAy = 34267.636;
    inline constexpr double RoadBx = 48698.090;
    inline constexpr double RoadBy = 42601.051;
    inline constexpr double LineAlong = 1600.;
    inline constexpr double EndBack = 600.;
    inline constexpr double Reach = 700.;
    inline constexpr double Lane = 900.;
    inline constexpr double Catch = 800.;
    inline constexpr double RecoverBack = 1400.;
    inline constexpr double FootSide = 2000.;
    inline constexpr double RollMin = 500.;
    inline constexpr double Align = 0.55;
    inline constexpr double Slice = 0.25;
    // Faster than the traffic cruise, slower than the tail. A crawl loses. A real drive does not.
    inline constexpr double ChaseCmPerSecond = 900.;
    inline constexpr int Pay = 660;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    struct FHit
    {
        double Along = 0.;
        double Lateral = 0.;
    };

    struct FRun
    {
        int Step = StepRoll;
        double Along = 0.;
        bool bCaught = false;
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

    inline double EndAlong()
    {
        return Length() - EndBack;
    }

    inline FSpot Place(double Along)
    {
        const double Whole = Length();
        if (Whole < 1e-6) return {RoadAx, RoadAy};
        if (Along < 0.) Along = 0.;
        if (Along > Whole) Along = Whole;
        const double T = Along / Whole;
        return {RoadAx + (RoadBx - RoadAx) * T, RoadAy + (RoadBy - RoadAy) * T};
    }

    inline FHit Project(double X, double Y)
    {
        const double Whole = Length();
        FHit Hit;
        if (Whole < 1e-6) return Hit;
        const double DX = RoadBx - RoadAx;
        const double DY = RoadBy - RoadAy;
        double T = ((X - RoadAx) * DX + (Y - RoadAy) * DY) / (Whole * Whole);
        if (T < 0.) T = 0.;
        if (T > 1.) T = 1.;
        Hit.Along = T * Whole;
        const double PX = RoadAx + DX * T;
        const double PY = RoadAy + DY * T;
        Hit.Lateral = Apart(X, Y, PX, PY);
        return Hit;
    }

    inline double Nose(double ForwardX, double ForwardY)
    {
        const double Whole = Length();
        if (Whole < 1e-6) return 0.;
        return (ForwardX * (RoadBx - RoadAx) + ForwardY * (RoadBy - RoadAy)) / Whole;
    }

    inline FSpot Line()
    {
        return Place(LineAlong);
    }

    inline FSpot End()
    {
        return Place(EndAlong());
    }

    inline FSpot Recover()
    {
        return Place(LineAlong - RecoverBack);
    }

    inline FSpot Foot()
    {
        const double Whole = Length();
        if (Whole < 1e-6) return {RoadBx, RoadBy};
        const double UX = (RoadBx - RoadAx) / Whole;
        const double UY = (RoadBy - RoadAy) / Whole;
        return {RoadBx - UY * FootSide, RoadBy + UX * FootSide};
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepFoot && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bMarchBanked, int Step)
    {
        return bMarchBanked && Step >= StepRoll && Step < StepBanked;
    }

    // Speed is signed centimetres per second. Forward is the car's nose.
    // bOnFoot is a person on the ground. One long frame only spends a quarter of a second.
    // Crossing the line does not also clear the end. Reaching the end does not also clear the mark.
    inline FRun Tick(FRun Now, double Seconds, bool bInCar, bool bOnFoot, double Speed, double ForwardX, double ForwardY, double X, double Y)
    {
        Now.bCaught = false;
        if (Now.Step >= StepBanked) return Now;
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Slice) Seconds = Slice;
        if (Now.Step == StepRoll)
        {
            const FSpot Mark = Line();
            if (bInCar && Speed >= RollMin && Nose(ForwardX, ForwardY) >= Align && Apart(X, Y, Mark.X, Mark.Y) <= Reach)
            {
                Now.Step = StepLead;
                Now.Along = 0.;
            }
            return Now;
        }
        if (Now.Step == StepLead)
        {
            Now.Along += ChaseCmPerSecond * Seconds;
            const double Stop = EndAlong();
            const FHit Hit = Project(X, Y);
            const bool bOnRoad = bInCar && Hit.Lateral <= Lane;
            if (bOnRoad && Hit.Along >= Stop && Hit.Along - Now.Along > Catch)
            {
                Now.Step = StepFoot;
                return Now;
            }
            if (!bOnRoad || Hit.Along - Now.Along <= Catch || Now.Along >= Stop)
            {
                Now.bCaught = true;
                Now.Step = StepRoll;
                Now.Along = 0.;
            }
            return Now;
        }
        if (!bOnFoot) return Now;
        const FSpot Clear = Foot();
        if (Apart(X, Y, Clear.X, Clear.Y) <= Reach) Now.Step = StepBanked;
        return Now;
    }
}
