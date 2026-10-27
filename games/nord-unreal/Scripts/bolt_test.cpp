#ifdef QUEBEC_BOLT_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBolt.h"
#include "../Source/Quebec/QuebecDitch.h"
#include "../Source/Quebec/QuebecParcel.h"
#include "../Source/Quebec/QuebecChase.h"
#include "../Source/Quebec/QuebecPursue.h"
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

    QuebecBolt::FRun DriveToBay(QuebecBolt::FRun Run, double Pace)
    {
        const QuebecBolt::FSpot From = QuebecBolt::End();
        const QuebecBolt::FSpot To = QuebecBolt::Bay();
        double X = From.X;
        double Y = From.Y;
        const double DX = To.X - From.X;
        const double DY = To.Y - From.Y;
        const double Whole = std::hypot(DX, DY);
        const double Slice = 0.05;
        for (int Frame = 0; Frame < 400 && Run.Step == QuebecBolt::StepChase && !Run.bCaught; ++Frame)
        {
            const double Left = std::hypot(To.X - X, To.Y - Y);
            const double Step = Left < Pace * Slice ? Left : Pace * Slice;
            if (Pace > 0.)
            {
                X += DX / Whole * Step;
                Y += DY / Whole * Step;
            }
            Run = QuebecBolt::Tick(Run, Slice, 0, false, Pace, DX / Whole, DY / Whole, X, Y);
        }
        return Run;
    }
}

int main()
{
    using namespace QuebecBolt;
    const FSpot Far = End();
    const FSpot Pocket = Bay();
    const FSpot Door = Gate();
    const FSpot Parked = Home();
    double AlongX = 0.;
    double AlongY = 0.;
    double SideX = 0.;
    double SideY = 0.;
    Basis(AlongX, AlongY, SideX, SideY);

    Expect(Apart(Far.X, Far.Y, Pocket.X, Pocket.Y) > Reach * 2., "the bay already sits on the end");
    Expect(Apart(Pocket.X, Pocket.Y, Door.X, Door.Y) > Reach * 2., "the gate already sits on the bay");
    Expect(DriveMin > QuebecDitch::RollMin && SeekCmPerSecond != QuebecDitch::ChaseCmPerSecond, "the bolt copied the ditch");
    Expect(SeekCmPerSecond != QuebecChase::TailCmPerSecond && SeekCmPerSecond != QuebecPursue::CruiseCmPerSecond, "the seeker took an old speed");
    Expect(Pay != QuebecDitch::Pay && Pay != QuebecParcel::Pay && Pay != 800 && Pay < 800, "the purse repeats a beat");
    Expect(StepBanked == 3 && QuebecStorySave::BoltBanked == StepBanked, "the bolt bank left the save");

    FRun Run = Fresh();
    Run = Tick(Run, 0.05, 0, false, 400., AlongX, AlongY, Far.X, Far.Y);
    Expect(Run.Step == StepDrive, "a crawl started the chase");
    Run = Tick(Run, 0.05, 2, false, DriveMin, AlongX, AlongY, Far.X, Far.Y);
    Expect(Run.Step == StepDrive, "a bike started the chase");
    Run = Tick(Run, 0.05, -1, true, 0., AlongX, AlongY, Far.X, Far.Y);
    Expect(Run.Step == StepDrive, "a walker started the chase");
    Run = Tick(Run, 0.05, 0, false, DriveMin, -AlongX, -AlongY, Far.X, Far.Y);
    Expect(Run.Step == StepDrive, "a reversed nose started the chase");
    Run = Tick(Run, 0.05, 0, false, DriveMin, AlongX, AlongY, Far.X, Far.Y);
    Expect(Run.Step == StepChase && !Run.bCaught, "a fast arrival did not start the chase");
    Expect(Apart(Run.SeekX, Run.SeekY, Parked.X, Parked.Y) < 1., "the seeker was not waiting behind the end");
    Expect(Run.Step != StepOut, "arriving also cleared the bay");

    FRun Crawl = DriveToBay(Run, 600.);
    Expect(Crawl.bCaught && Crawl.Step == StepChase, "a crawl reached the bay");
    Expect(Apart(Crawl.SeekX, Crawl.SeekY, Parked.X, Parked.Y) < 1., "a catch left the seeker on top of the car");

    FRun Held = DriveToBay(Run, 0.);
    Expect(Held.bCaught && Held.Step == StepChase, "standing still lost the seeker");

    FRun Hot = DriveToBay(Run, DriveMin);
    Expect(Hot.Step == StepOut && Hot.Clock == LimitSeconds && !Hot.bCaught, "holding the drive did not reach the bay");
    Expect(Hot.Step != StepBanked, "reaching the bay also cleared the gate");
    double SeekX = Parked.X;
    double SeekY = Parked.Y;
    Steer(SeekX, SeekY, Pocket.X, Pocket.Y, Slice);
    const double OffRoad = (SeekX - Parked.X) * SideX + (SeekY - Parked.Y) * SideY;
    Expect(std::fabs(OffRoad) > 50., "the seeker stayed on the road");

    FRun Sat = Hot;
    const FSpot PocketNow = Bay();
    bool Expired = false;
    for (int Frame = 0; Frame < 250 && !Expired; ++Frame)
    {
        Sat = Tick(Sat, 0.05, -1, true, 0., 0., 0., PocketNow.X, PocketNow.Y);
        Expired = Sat.bExpired;
    }
    Expect(Expired && Sat.Step == StepOut && Sat.Clock == LimitSeconds, "the clock ran out and undid the chase");

    FRun Clamped = Hot;
    Clamped = Tick(Clamped, 5., -1, true, 0., 0., 0., PocketNow.X, PocketNow.Y);
    Expect(Clamped.Step == StepOut && !Clamped.bExpired && Clamped.Clock > LimitSeconds - 1., "one long frame spent the escape");

    FRun Drove = Hot;
    Drove = Tick(Drove, 0.05, 0, false, 0., AlongX, AlongY, Door.X, Door.Y);
    Expect(Drove.Step == StepOut, "a car cleared the gate");

    FRun Out = Hot;
    double X = PocketNow.X;
    double Y = PocketNow.Y;
    const double GX = Door.X - PocketNow.X;
    const double GY = Door.Y - PocketNow.Y;
    const double Whole = std::hypot(GX, GY);
    for (int Frame = 0; Frame < 200 && Out.Step == StepOut; ++Frame)
    {
        const double Left = std::hypot(Door.X - X, Door.Y - Y);
        const double Step = Left < 450. * 0.05 ? Left : 450. * 0.05;
        X += GX / Whole * Step;
        Y += GY / Whole * Step;
        Out = Tick(Out, 0.05, -1, true, 450., GX / Whole, GY / Whole, X, Y);
    }
    Expect(Out.Step == StepBanked && !Out.bExpired, "walking to the gate did not finish the bolt");

    Expect(QuebecStorySave::Parcel == 20 && QuebecStorySave::Bolt == 21 && QuebecStorySave::Yard == 22 && QuebecStorySave::Lift == 23 && QuebecStorySave::Post == 24 && QuebecStorySave::Current == 25 && QuebecStorySave::Ditch == 19, "the slot writer left version 25");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
