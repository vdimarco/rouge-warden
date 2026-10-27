#ifdef QUEBEC_PARCEL_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecParcel.h"
#include "../Source/Quebec/QuebecDitch.h"
#include "../Source/Quebec/QuebecMarch.h"
#include "../Source/Quebec/QuebecSlip.h"
#include "../Source/Quebec/QuebecNose.h"
#include "../Source/Quebec/QuebecPursue.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecStorySave.h"

#include <cmath>
#include <cstdio>

namespace
{
    int Assertions = 0;
    int Failures = 0;

    void Expect(bool Condition, const char* What)
    {
        ++Assertions;
        if (!Condition)
        {
            ++Failures;
            std::fprintf(stderr, "FAIL %s\n", What);
        }
    }

    QuebecParcel::FRun Walk(QuebecParcel::FRun Run, double WaitSeconds, double Pace)
    {
        const QuebecParcel::FSpot From = QuebecParcel::Parcel();
        const QuebecParcel::FSpot To = QuebecParcel::Stoop();
        double X = From.X;
        double Y = From.Y;
        const double DX = To.X - From.X;
        const double DY = To.Y - From.Y;
        const double Whole = std::hypot(DX, DY);
        const double StepX = DX / Whole;
        const double StepY = DY / Whole;
        double Waited = 0.;
        const double Slice = 0.05;
        for (int Frame = 0; Frame < 800 && Run.Step == QuebecParcel::StepCarry; ++Frame)
        {
            if (Waited < WaitSeconds)
            {
                Waited += Slice;
            }
            else
            {
                const double Left = std::hypot(To.X - X, To.Y - Y);
                const double Step = Left < Pace * Slice ? Left : Pace * Slice;
                X += StepX * Step;
                Y += StepY * Step;
            }
            Run = QuebecParcel::Tick(Run, Slice, true, X, Y);
        }
        return Run;
    }
}

int main()
{
    using namespace QuebecParcel;
    const FSpot Mark = Parcel();
    const FSpot Door = Stoop();
    const FSpot Back = Recover();
    Expect(Apart(Mark.X, Mark.Y, Door.X, Door.Y) > Reach * 2., "the stoop already sits on the parcel");
    Expect(Apart(Back.X, Back.Y, Mark.X, Mark.Y) > Reach, "the recover already sits on the parcel");
    Expect(Lateral(Mark.X, Mark.Y) > Lane, "the parcel is already in the lane");
    Expect(Lateral(Door.X, Door.Y) > Lane, "the stoop is already in the lane");
    Expect(TrafficCmPerSecond != QuebecPursue::CruiseCmPerSecond, "the traffic took the pursuit cruise");
    Expect(TrafficCmPerSecond != QuebecSlip::CloseCmPerSecond, "the traffic took the slip");
    Expect(TrafficCmPerSecond != QuebecDitch::ChaseCmPerSecond, "the traffic took the ditch chase");
    Expect(TrafficCmPerSecond < 450. && TrafficCmPerSecond > 80., "the traffic left the gap under a walk");
    Expect(Pay != QuebecDitch::Pay && Pay != QuebecMarch::Pay && Pay != QuebecSlip::Pay && Pay != 800 && Pay < 800, "the purse repeats a beat");
    Expect(StepBanked == 2 && QuebecStorySave::ParcelBanked == StepBanked, "the parcel bank left the save");

    FRun Held;
    Held = Tick(Held, 0.05, false, Mark.X, Mark.Y);
    Expect(Held.Step == StepParcel, "a car picked up the parcel");
    Held = Tick(Held, 0.05, true, Mark.X, Mark.Y);
    Expect(Held.Step == StepCarry && Held.Clock == LimitSeconds, "picking up the parcel did not start the clock");
    Expect(Held.Step != StepBanked, "picking up the parcel also crossed the street");

    FRun Rushed = Held;
    Rushed = Walk(Rushed, 0., 450.);
    Expect(Rushed.bDropped && Rushed.Step == StepParcel && Rushed.Clock == 0., "a walk into the car kept the parcel");
    Expect(Rushed.AlongA == TrafficA && Rushed.AlongB == TrafficB, "a drop left the cars where they hit");

    FRun Dashed = Held;
    Dashed = Walk(Dashed, 0., 800.);
    Expect(Dashed.bDropped && Dashed.Step == StepParcel, "a sprint into the car kept the parcel");

    FRun Late = Held;
    for (int Frame = 0; Frame < 360; ++Frame) Late = Tick(Late, 0.05, true, Back.X, Back.Y);
    Expect(Late.Step == StepParcel && Late.Clock == 0., "standing through the clock kept the parcel");

    FRun Clamped = Held;
    Clamped = Tick(Clamped, 5., true, Mark.X, Mark.Y);
    Expect(Clamped.Step == StepCarry && Clamped.Clock > LimitSeconds - 1., "one long frame spent the whole clock");

    FRun Across = Held;
    Across = Walk(Across, 4., 450.);
    Expect(Across.Step == StepBanked && !Across.bDropped, "waiting for the car and walking across did not deliver");
    FRun SprintGap = Held;
    SprintGap = Walk(SprintGap, 4., 800.);
    Expect(SprintGap.Step == StepBanked, "waiting for the car and sprinting across did not deliver");

    FRun TooLate = Held;
    TooLate = Walk(TooLate, 8., 450.);
    Expect(TooLate.Step == StepParcel && TooLate.bDropped, "waiting out the clock still delivered");

    Expect(QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Current == 21 && QuebecStorySave::March == 18, "the slot writer left version 21");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
