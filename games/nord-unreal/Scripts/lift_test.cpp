#ifdef QUEBEC_LIFT_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecLift.h"
#include "../Source/Quebec/QuebecYard.h"
#include "../Source/Quebec/QuebecSend.h"
#include "../Source/Quebec/QuebecPace.h"
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

    QuebecLift::FRun Hold(QuebecLift::FRun Run, double Speed, int Kind, int Frames)
    {
        const QuebecLift::FSpot Stop = QuebecLift::Pocket();
        for (int Frame = 0; Frame < Frames && Run.Step == QuebecLift::StepOpen && !Run.bBack; ++Frame)
            Run = QuebecLift::Tick(Run, 0.05, Kind, Speed, Stop.X, Stop.Y);
        return Run;
    }
}

int main()
{
    const double Whole = QuebecLift::Span();
    Expect(Whole > 1400. && Whole < 2200., "the walk is not a short crossing");
    Expect(QuebecLift::Walk == QuebecPace::WalkCmPerSecond, "they took a sprint");
    Expect(QuebecLift::Still != QuebecSend::Crawl && QuebecLift::Still < QuebecSend::Crawl, "the hold copied the send-off crawl");
    Expect(QuebecLift::Pay == 680 && QuebecLift::Pay < 800, "the lift purse left 680");
    Expect(QuebecLift::Pay != QuebecYard::Pay && QuebecLift::Pay != 720 && QuebecLift::Pay != 660 && QuebecLift::Pay != QuebecSend::Pay, "the lift reused a purse");
    Expect(QuebecLift::CountsAsCar(0) && !QuebecLift::CountsAsCar(2) && !QuebecLift::CountsAsCar(1), "a bike counts as the car");
    const QuebecLift::FSpot Mid = QuebecLift::Place(Whole * 0.5);
    const QuebecLift::FSpot Door = QuebecLift::Home();
    const QuebecLift::FSpot Stop = QuebecLift::Pocket();
    Expect(std::fabs(QuebecLift::Apart(Mid.X, Mid.Y, Door.X, Door.Y) - Whole * 0.5) < 1., "they left the line");

    const QuebecLift::FRun Arrived = Hold({}, 0., 0, 120);
    Expect(Arrived.Step == QuebecLift::StepBanked && !Arrived.bBack, "a stopped car did not let them in");
    const QuebecLift::FRun Twice = QuebecLift::Tick(Arrived, 0.05, 0, 0., Stop.X, Stop.Y);
    Expect(Twice.Step == QuebecLift::StepBanked, "the lift paid twice");

    const QuebecLift::FRun Started = Hold({}, 0., 0, 20);
    Expect(Started.Step == QuebecLift::StepOpen && Started.bComing && Started.Along > 200., "they did not start toward the car");
    const QuebecLift::FRun Rolled = QuebecLift::Tick(Started, 0.05, 0, 400., Stop.X, Stop.Y);
    Expect(Rolled.bBack && !Rolled.bComing && Rolled.Step == QuebecLift::StepOpen && Rolled.Along < Started.Along, "a roll did not send them back");
    QuebecLift::FRun HomeAgain = Rolled;
    for (int Frame = 0; Frame < 80 && HomeAgain.Along > 0.; ++Frame)
        HomeAgain = QuebecLift::Tick(HomeAgain, 0.05, 0, 400., Stop.X, Stop.Y);
    Expect(HomeAgain.Step == QuebecLift::StepOpen && HomeAgain.Along == 0., "they kept coming after the roll");

    const QuebecLift::FRun Bike = Hold({}, 0., 2, 120);
    Expect(Bike.Step == QuebecLift::StepOpen && Bike.Along == 0., "a bike started them");
    const QuebecLift::FRun Creep = Hold({}, 61., 0, 120);
    Expect(Creep.Step == QuebecLift::StepOpen && Creep.Along == 0., "a creep counted as stopped");
    const QuebecLift::FRun Quiet = Hold({}, 60., 0, 120);
    Expect(Quiet.Step == QuebecLift::StepBanked, "a car at the hold limit did not count");

    const QuebecLift::FRun Long = QuebecLift::Tick({}, 5., 0, 0., Stop.X, Stop.Y);
    Expect(Long.Step == QuebecLift::StepOpen && Long.Along < 200., "one long frame walked them all the way");

    Expect(QuebecStorySave::Yard == 22 && QuebecStorySave::Lift == 23 && QuebecStorySave::Post == 24 && QuebecStorySave::Current == 25 && QuebecStorySave::Bolt == 21, "the slot writer left version 25");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
