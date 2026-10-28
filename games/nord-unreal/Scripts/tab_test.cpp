#ifdef QUEBEC_TAB_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecTab.h"
#include "../Source/Quebec/QuebecPost.h"
#include "../Source/Quebec/QuebecBolt.h"
#include "../Source/Quebec/QuebecLift.h"
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
}

int main()
{
    using namespace QuebecTab;
    Expect(Slow > QuebecPace::WalkCmPerSecond && Slow > QuebecSend::Crawl && Fast < QuebecBolt::DriveMin && Fast > QuebecPace::SprintCmPerSecond, "the band copied a crawl or a bolt");
    Expect(Still < QuebecPost::Drift && Still < QuebecLift::Still, "standing copied the post or the lift");
    Expect(Pay == 760 && Pay < 800 && Pay != QuebecPost::Pay && Pay != QuebecBolt::Pay && Pay != QuebecLift::Pay, "the tab reused a purse");
    Expect(StepBanked == 3 && Hold == 3. && Slice == 0.25, "the tab lost a step");
    Expect(QuebecStorySave::Post == 24 && QuebecStorySave::Tab == 25 && QuebecStorySave::Current == 26 && QuebecStorySave::Lift == 23, "the slot writer left version 26");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(2), "the lane took a bike");

    const FSpot Counter = Objective(StepCounter);
    const FSpot Lane = Objective(StepLane);
    const FSpot Door = Objective(StepStill);
    Expect(Apart(Counter.X, Counter.Y, Lane.X, Lane.Y) > 4000. && Apart(Lane.X, Lane.Y, Door.X, Door.Y) > 4000., "the three stops sit on top of each other");

    double AlongX = 0.;
    double AlongY = 0.;
    Basis(AlongX, AlongY);
    const FRun Opened = Tick({}, 0.05, -1, true, 200., 0., 1., Counter.X, Counter.Y);
    Expect(Opened.Step == StepLane && !Opened.bSlipped, "a walk did not open the tab");
    const FRun Driven = Tick({}, 0.05, 0, false, 700., AlongX, AlongY, Counter.X, Counter.Y);
    Expect(Driven.Step == StepCounter, "a car opened the tab");

    FRun LaneRun = Opened;
    const FRun FastCar = Tick(LaneRun, 0.05, 0, false, 1100., AlongX, AlongY, Lane.X, Lane.Y);
    Expect(FastCar.bSlipped && FastCar.Step == StepLane, "a bolt through the lane kept the tab");
    const FRun SlowCar = Tick(LaneRun, 0.05, 0, false, 200., AlongX, AlongY, Lane.X, Lane.Y);
    Expect(SlowCar.bSlipped && SlowCar.Step == StepLane, "a crawl through the lane kept the tab");
    const FRun WrongWay = Tick(LaneRun, 0.05, 0, false, 700., -AlongX, -AlongY, Lane.X, Lane.Y);
    Expect(WrongWay.bSlipped && WrongWay.Step == StepLane, "the wrong nose kept the tab");
    const FRun Bike = Tick(LaneRun, 0.05, 2, false, 700., AlongX, AlongY, Lane.X, Lane.Y);
    Expect(!Bike.bSlipped && Bike.Step == StepLane, "a bike took the lane");
    const FRun Passed = Tick(LaneRun, 0.05, 0, false, 700., AlongX, AlongY, Lane.X, Lane.Y);
    Expect(Passed.Step == StepStill && !Passed.bSlipped && Passed.Clock == 0., "the band did not take the lane");

    FRun Waiting = Passed;
    for (int Frame = 0; Frame < 12; ++Frame)
        Waiting = Tick(Waiting, 0.25, -1, true, 0., 0., 1., Door.X, Door.Y);
    Expect(Waiting.Step == StepBanked && std::fabs(Waiting.Clock - Hold) < 1e-9 && !Waiting.bBroke, "standing still did not close the tab");

    FRun Almost = Passed;
    Almost.Clock = 2.5;
    const FRun Moved = Tick(Almost, 0.25, -1, true, 200., 0., 1., Door.X, Door.Y);
    Expect(Moved.bBroke && Moved.Clock == 0. && Moved.Step == StepStill, "a walk kept the receipt count");
    const FRun Quiet = Tick(Moved, 0.25, -1, true, 200., 0., 1., Door.X, Door.Y);
    Expect(!Quiet.bBroke && Quiet.Step == StepStill, "a second walk broke the count again");
    const FRun Creep = Tick(Passed, 0.25, -1, true, 41., 0., 1., Door.X, Door.Y);
    Expect(Creep.Clock == 0. && Creep.Step == StepStill && !Creep.bBroke, "a creep stood the receipt");
    const FRun Long = Tick(Passed, 5., -1, true, 0., 0., 1., Door.X, Door.Y);
    Expect(std::fabs(Long.Clock - Slice) < 1e-9 && Long.Step == StepStill, "one frame closed the tab");
    const FRun Again = Tick(Waiting, 0.25, -1, true, 0., 0., 1., Door.X, Door.Y);
    Expect(Again.Step == StepBanked && !Again.bBroke, "a second stand paid again");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
