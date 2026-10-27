#ifdef QUEBEC_YARD_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecYard.h"
#include "../Source/Quebec/QuebecBolt.h"
#include "../Source/Quebec/QuebecShade.h"
#include "../Source/Quebec/QuebecSlip.h"
#include "../Source/Quebec/QuebecParcel.h"
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

    QuebecYard::FRun Walk(QuebecYard::FRun Run, double Pace)
    {
        const QuebecYard::FSpot From = QuebecYard::Near();
        const QuebecYard::FSpot To = QuebecYard::Far();
        double X = From.X;
        double Y = From.Y;
        const double DX = To.X - From.X;
        const double DY = To.Y - From.Y;
        const double Whole = std::hypot(DX, DY);
        const double Slice = 0.05;
        for (int Frame = 0; Frame < 400 && Run.Step == QuebecYard::StepOpen && !Run.bSeen; ++Frame)
        {
            const double Left = std::hypot(To.X - X, To.Y - Y);
            const double Step = Left < Pace * Slice ? Left : Pace * Slice;
            X += DX / Whole * Step;
            Y += DY / Whole * Step;
            Run = QuebecYard::Tick(Run, Slice, true, X, Y);
        }
        return Run;
    }
}

int main()
{
    const QuebecYard::FSpot Edge = QuebecYard::Near();
    const QuebecYard::FSpot Door = QuebecYard::Far();
    const QuebecYard::FSpot Look = QuebecYard::Watch();
    Expect(QuebecYard::Apart(Edge.X, Edge.Y, Door.X, Door.Y) > QuebecYard::Reach * 2., "the far side already sits on the near side");
    Expect(QuebecYard::Apart(Look.X, Look.Y, Edge.X, Edge.Y) < QuebecYard::Range, "the near side is beyond their look");
    Expect(QuebecYard::Half < 1.2 && QuebecYard::Half > 0.2, "the look is not a cone");
    Expect(QuebecYard::Pay == 540 && QuebecYard::Pay < 800, "the yard purse left 540");
    Expect(QuebecYard::Pay != QuebecBolt::Pay && QuebecYard::Pay != QuebecShade::Pay && QuebecYard::Pay != QuebecSlip::Pay && QuebecYard::Pay != QuebecParcel::Pay, "the yard reused a purse");
    Expect(QuebecYard::StepBanked == 1, "the yard banked more than the crossing");

    const double MiddleX = (Edge.X + Door.X) * 0.5;
    const double MiddleY = (Edge.Y + Door.Y) * 0.5;
    const double Toward = std::atan2(MiddleY - Look.Y, MiddleX - Look.X);
    Expect(QuebecYard::InLook(Toward, MiddleX, MiddleY), "looking at the yard missed the middle");
    Expect(!QuebecYard::InLook(Toward, Look.X, Look.Y - 1100.), "the look covered the ground behind them");

    QuebecYard::FRun Armed;
    Armed.bArmed = true;
    Armed.Angle = Toward;
    const QuebecYard::FRun Caught = QuebecYard::Tick(Armed, 0.05, true, MiddleX, MiddleY);
    Expect(Caught.bSeen && !Caught.bArmed && Caught.Step == QuebecYard::StepOpen, "their look did not send the crossing back");
    const QuebecYard::FRun Still = QuebecYard::Tick(Caught, 0.05, true, Door.X, Door.Y);
    Expect(!Still.bSeen && Still.Step == QuebecYard::StepOpen, "the far side banked after they had looked");

    QuebecYard::FRun Waiting;
    Waiting.Angle = 0.;
    Expect(!QuebecYard::InLook(0., Edge.X, Edge.Y), "the opening look already covered the near side");
    const QuebecYard::FRun Ready = QuebecYard::Tick(Waiting, 0.05, true, Edge.X, Edge.Y);
    Expect(Ready.bArmed && !Ready.bSeen && Ready.Step == QuebecYard::StepOpen, "waiting on the near side did not arm the crossing");
    const QuebecYard::FRun Crossed = Walk(Ready, 450.);
    Expect(Crossed.Step == QuebecYard::StepBanked && !Crossed.bSeen, "a walk while they looked away did not bank");
    const QuebecYard::FRun Again = QuebecYard::Tick(Crossed, 0.05, true, Door.X, Door.Y);
    Expect(Again.Step == QuebecYard::StepBanked, "the yard paid twice");

    QuebecYard::FRun Rush = Ready;
    const QuebecYard::FRun Drove = QuebecYard::Tick(Rush, 0.05, false, Door.X, Door.Y);
    Expect(Drove.Step == QuebecYard::StepOpen && Drove.bArmed, "a car cleared the yard");

    QuebecYard::FRun Held;
    Held.Angle = 0.;
    const QuebecYard::FRun Long = QuebecYard::Tick(Held, 5., true, Edge.X, Edge.Y);
    Expect(Long.Angle < 0.1 && !Long.bSeen, "one long frame swept the whole look");

    Expect(QuebecStorySave::Bolt == 21 && QuebecStorySave::Current == 22 && QuebecStorySave::Parcel == 20, "the slot writer left version 22");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
