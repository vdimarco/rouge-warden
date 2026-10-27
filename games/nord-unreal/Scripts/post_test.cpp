#ifdef QUEBEC_POST_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecPost.h"
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

    QuebecPost::FRun Hold(QuebecPost::FRun Run, double Speed, bool bOnFoot, int Frames)
    {
        const QuebecPost::FSpot Here = QuebecPost::Mark();
        for (int Frame = 0; Frame < Frames; ++Frame)
        {
            Run = QuebecPost::Tick(Run, 0.05, bOnFoot, Speed, Here.X, Here.Y);
            if (Run.Step >= QuebecPost::StepBanked || Run.bBroke) return Run;
        }
        return Run;
    }
}

int main()
{
    using namespace QuebecPost;
    Expect(Walk == 450. && Walk == QuebecPace::WalkCmPerSecond, "the post took a sprint");
    Expect(Drift != QuebecSend::Crawl && Drift > QuebecSend::Crawl, "standing copied the send-off crawl");
    Expect(Pay == 700 && Pay < 800 && Pay != QuebecLift::Pay && Pay != 720 && Pay != 540, "the post reused a purse");
    Expect(Fill == 6. && Reach == 450. && Slice == 0.25, "the post count moved");
    Expect(QuebecStorySave::Lift == 23 && QuebecStorySave::Current == 24 && QuebecStorySave::Yard == 22, "the slot writer left version 24");

    const FRun Stood = Hold({}, 0., true, 40);
    Expect(Stood.Clock == 0. && Stood.Step == StepOpen && !Stood.bBroke, "standing still counted");

    const FRun Crept = Hold({}, 89., true, 20);
    Expect(Crept.Clock == 0. && !Crept.bBroke, "a creep under a walk counted");
    const FRun Walking = Hold({}, 90., true, 20);
    Expect(Walking.Clock > 0.8 && Walking.Step == StepOpen && !Walking.bBroke, "a walk inside the mark did not count");

    const FRun Bolt = Hold({}, 451., true, 20);
    Expect(Bolt.Clock == 0. && Bolt.Step == StepOpen, "a sprint stood the post");
    const FRun Car = Hold({}, 200., false, 20);
    Expect(Car.Clock == 0. && Car.Step == StepOpen, "a car stood the post");

    FRun Started = Hold({}, 200., true, 20);
    Expect(Started.Clock > 0.8 && Started.Step == StepOpen, "the count did not start");
    const FRun Broke = QuebecPost::Tick(Started, 0.05, true, 800., MarkX, MarkY);
    Expect(Broke.bBroke && Broke.Clock == 0. && Broke.Step == StepOpen, "a sprint kept the count");
    const FRun Quiet = QuebecPost::Tick(Broke, 0.05, true, 800., MarkX, MarkY);
    Expect(!Quiet.bBroke && Quiet.Clock == 0., "a second sprint broke the count again");

    const FSpot Here = Mark();
    const FRun Outside = QuebecPost::Tick(Started, 0.05, true, 200., Here.X + 800., Here.Y);
    Expect(Outside.bBroke && Outside.Clock == 0. && Outside.Step == StepOpen, "a step out kept the count");

    const FRun Long = QuebecPost::Tick({}, 5., true, 200., Here.X, Here.Y);
    Expect(std::fabs(Long.Clock - 0.25) < 1e-9 && Long.Step == StepOpen && !Long.bBroke, "one frame stood the whole post");

    const FRun Done = Hold({}, 450., true, 130);
    Expect(Done.Step == StepBanked && std::fabs(Done.Clock - Fill) < 1e-6 && !Done.bBroke, "a walk did not fill the post");
    const FRun Again = QuebecPost::Tick(Done, 0.05, true, 450., Here.X, Here.Y);
    Expect(Again.Step == StepBanked && !Again.bBroke, "a second walk paid again");

    FRun Almost;
    Almost.Clock = 5.9;
    const FRun Closed = QuebecPost::Tick(Almost, 0.2, true, 200., Here.X, Here.Y);
    Expect(Closed.Step == StepBanked && !Closed.bBroke && std::fabs(Closed.Clock - Fill) < 1e-9, "reaching the count also broke it");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
