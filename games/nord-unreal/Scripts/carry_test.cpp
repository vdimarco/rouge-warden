#ifdef QUEBEC_CARRY_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecCarry.h"
#include "../Source/Quebec/QuebecTab.h"
#include "../Source/Quebec/QuebecPost.h"
#include "../Source/Quebec/QuebecSend.h"
#include "../Source/Quebec/QuebecPace.h"
#include "../Source/Quebec/QuebecStorySave.h"

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
    using namespace QuebecCarry;
    Expect(WalkHi == QuebecPace::WalkCmPerSecond && WalkLo > QuebecTab::Still && WalkHi < QuebecPace::SprintCmPerSecond && WalkHi < QuebecTab::Slow, "the walk copied a sprint or the lane");
    Expect(RollMin > QuebecSend::Crawl && RollMin > QuebecPost::Drift && RollMax < QuebecTab::Slow && RollMax < WalkHi, "the roll copied the lane or a crawl");
    Expect(!(RollMax >= QuebecTab::Slow && RollMin <= QuebecTab::Fast), "the roll sits inside the lane band");
    Expect(Pay == 740 && Pay != QuebecTab::Pay && Pay != QuebecPost::Pay && Pay < 800, "the carry reused a purse");
    Expect(StepBanked == 3, "the carry lost a step");
    Expect(QuebecStorySave::Tab == 25 && QuebecStorySave::Current == 26 && QuebecStorySave::Post == 24, "the slot writer left version 26");
    Expect(CountsAsCar(0) && !CountsAsCar(2), "the line took a bike");

    const FSpot Case = Objective(StepCase);
    const FSpot Stoop = Objective(StepWalk);
    const FSpot Mark = Objective(StepRoll);
    Expect(Apart(Case.X, Case.Y, Stoop.X, Stoop.Y) > 4000. && Apart(Stoop.X, Stoop.Y, Mark.X, Mark.Y) > 4000. && Apart(Case.X, Case.Y, Mark.X, Mark.Y) > 4000., "the three stops sit on top of each other");

    const FRun Opened = Tick({}, -1, true, 300., Case.X, Case.Y);
    Expect(Opened.Step == StepWalk && !Opened.bSlipped, "a walk did not pick up the case");
    const FRun Driven = Tick({}, 0, false, 300., Case.X, Case.Y);
    Expect(Driven.Step == StepCase && !Driven.bSlipped, "a car picked up the case");

    const FRun Sprinted = Tick(Opened, -1, true, 800., Stoop.X, Stoop.Y);
    Expect(Sprinted.bSlipped && Sprinted.Step == StepWalk, "a sprint delivered the case");
    const FRun Crept = Tick(Opened, -1, true, 40., Stoop.X, Stoop.Y);
    Expect(Crept.bSlipped && Crept.Step == StepWalk, "a creep delivered the case");
    const FRun Parked = Tick(Opened, 0, false, 300., Stoop.X, Stoop.Y);
    Expect(Parked.bSlipped && Parked.Step == StepWalk, "a car delivered the case");
    const FRun Bike = Tick(Opened, 2, false, 300., Stoop.X, Stoop.Y);
    Expect(!Bike.bSlipped && Bike.Step == StepWalk, "a bike delivered the case");
    const FRun Walked = Tick(Opened, -1, true, 450., Stoop.X, Stoop.Y);
    Expect(Walked.Step == StepRoll && !Walked.bSlipped, "a walk did not reach the stoop");

    const FRun Stopped = Tick(Walked, 0, false, 20., Mark.X, Mark.Y);
    Expect(Stopped.bSlipped && Stopped.Step == StepRoll, "a stop crossed the line");
    const FRun Bolted = Tick(Walked, 0, false, 900., Mark.X, Mark.Y);
    Expect(Bolted.bSlipped && Bolted.Step == StepRoll, "a bolt crossed the line");
    const FRun Rider = Tick(Walked, 2, false, 200., Mark.X, Mark.Y);
    Expect(!Rider.bSlipped && Rider.Step == StepRoll, "a bike crossed the line");
    const FRun Rolled = Tick(Walked, 0, false, 200., Mark.X, Mark.Y);
    Expect(Rolled.Step == StepBanked && !Rolled.bSlipped, "a roll did not finish the carry");
    const FRun Again = Tick(Rolled, 0, false, 200., Mark.X, Mark.Y);
    Expect(Again.Step == StepBanked && !Again.bSlipped, "a second roll reopened the carry");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
