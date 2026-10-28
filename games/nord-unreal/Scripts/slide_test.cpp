// A played drive: gas, then a handbrake turn, earns one slide banner.
// A straight run, a tap and a turn without the brake earn none.

#ifdef QUEBEC_SLIDE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecSlide.h"
#include "../Source/Quebec/QuebecSteerAssist.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <vector>

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    struct FSample
    {
        float Time = 0.f;
        float Speed = 0.f;
        float Lateral = 0.f;
        int Pays = 0;
    };

    struct FCar
    {
        float Speed = 0.f;
        float Lateral = 0.f;
        float Yaw = 0.f;
        float SteeringState = 0.f;
        float DriveThrottle = 0.f;
        float PeakLateral = 0.f;
        QuebecSlide::FState Slide;

        // One substep of the player car in QuebecGameplay.cpp: pedal slew, the handbrake brake,
        // the bicycle yaw, the momentum split and the grip. No collision and no road assist.
        void Advance(float Dt, bool bBrake, float Steer, bool bGas)
        {
            const float Throttle = bGas ? 1.f : 0.f;
            DriveThrottle = QuebecSteer::MoveToward(DriveThrottle, Throttle, Dt, QuebecSteer::ThrottleRate);
            SteeringState = QuebecSteer::MoveToward(SteeringState, Steer, Dt,
                QuebecSteer::TurnInRate(Speed, Steer, SteeringState, false));
            if (bBrake)
                Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 2300.f);
            else if (Throttle * Speed < 0.f)
                Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 3200.f * std::fabs(Throttle));
            else if (std::fabs(Throttle) > .01f)
            {
                const float Corner = QuebecSteer::Lerp(2400.f, 900.f,
                    QuebecSteer::Clamp((std::fabs(SteeringState) - .2f) / .8f, 0.f, 1.f));
                if (Throttle > 0.f && std::fabs(SteeringState) > .2f && Speed > Corner)
                    Speed = QuebecSteer::MoveToward(Speed, Corner, Dt, 1200.f);
                else
                {
                    const float Power = QuebecSteer::Lerp(1050.f, 700.f,
                        QuebecSteer::Clamp(std::fabs(Speed) / 3000.f, 0.f, 1.f));
                    const float Requested = std::max(0.f, DriveThrottle * (Throttle > 0.f ? 1.f : -1.f)) * (Throttle > 0.f ? 1.f : -1.f);
                    Speed += Requested * Power * Dt;
                    Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 100.f + Speed * Speed * .000035f);
                }
            }
            else Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 360.f + Speed * Speed * .000035f);
            Speed = QuebecSteer::Clamp(Speed, -950.f, 3000.f);

            const float YawRad = Yaw * (QuebecSteer::Pi / 180.f);
            const float ForwardX = std::cos(YawRad);
            const float ForwardY = std::sin(YawRad);
            const float RightX = -std::sin(YawRad);
            const float RightY = std::cos(YawRad);
            const float MomentumX = ForwardX * Speed + RightX * Lateral;
            const float MomentumY = ForwardY * Speed + RightY * Lateral;
            if (std::fabs(Speed) > 15.f)
                Yaw += QuebecSteer::YawRateFor(Speed, SteeringState, bBrake) * Dt;
            const float Yaw2 = Yaw * (QuebecSteer::Pi / 180.f);
            const float Forward2X = std::cos(Yaw2);
            const float Forward2Y = std::sin(Yaw2);
            const float Right2X = -std::sin(Yaw2);
            const float Right2Y = std::cos(Yaw2);
            Speed = MomentumX * Forward2X + MomentumY * Forward2Y;
            Lateral = MomentumX * Right2X + MomentumY * Right2Y;
            const float Grip = bBrake ? 1.15f : 8.f;
            Lateral += (0.f - Lateral) * QuebecSteer::Clamp(Dt * Grip, 0.f, 1.f);
            const float Cap = std::fabs(Speed) * .7f + 80.f;
            Lateral = QuebecSteer::Clamp(Lateral, -Cap, Cap);
            if (std::fabs(Speed) < 100.f)
                Lateral = QuebecSteer::MoveToward(Lateral, 0.f, Dt, 3600.f);
            PeakLateral = std::max(PeakLateral, std::fabs(Lateral));
            Slide.Tick(Dt, Speed, Lateral, bBrake);
        }
    };

    struct FPhase
    {
        float Seconds;
        bool bBrake;
        float Steer;
        bool bGas;
    };

    FCar Play(const FPhase* Phases, int Count, std::vector<FSample>* Trace)
    {
        FCar Car;
        float Time = 0.f;
        const float Dt = 1.f / 60.f;
        for (int Phase = 0; Phase < Count; ++Phase)
        {
            const int Steps = static_cast<int>(std::lround(Phases[Phase].Seconds / Dt));
            for (int Step = 0; Step < Steps; ++Step)
            {
                Car.Advance(Dt, Phases[Phase].bBrake, Phases[Phase].Steer, Phases[Phase].bGas);
                Time += Dt;
                if (Trace) Trace->push_back({Time, Car.Speed, Car.Lateral, Car.Slide.Pays});
            }
        }
        return Car;
    }

    void TestRule()
    {
        Expect(QuebecSlide::HoldSeconds == .35f, "HoldSeconds %f", static_cast<double>(QuebecSlide::HoldSeconds));
        Expect(QuebecSlide::MinSpeed == 450.f, "MinSpeed");
        Expect(QuebecSlide::MinLateral == 180.f, "MinLateral");
        Expect(QuebecSlide::AgainSeconds == 1.5f, "AgainSeconds");
        QuebecSlide::FState Early;
        for (int Frame = 0; Frame < 20; ++Frame)
            Expect(!Early.Tick(1.f / 60.f, 2000.f, 400.f, true), "frame %d paid early", Frame);
        Expect(Early.Pays == 0, "20 frames is under the hold");
        Expect(Early.Tick(1.f / 60.f, 2000.f, 400.f, true), "frame 21 pays");
        Expect(Early.Pays == 1, "one pay");
        Expect(!Early.Tick(1.f / 60.f, 2000.f, 400.f, true), "holding on does not pay again");

        QuebecSlide::FState Wiggle;
        for (int Frame = 0; Frame < 60; ++Frame) Wiggle.Tick(1.f / 60.f, 2000.f, 50.f, true);
        Expect(Wiggle.Pays == 0, "a lane wiggle is not a slide");
        QuebecSlide::FState Slow;
        for (int Frame = 0; Frame < 60; ++Frame) Slow.Tick(1.f / 60.f, 300.f, 400.f, true);
        Expect(Slow.Pays == 0, "a slow shove is not a slide");
        QuebecSlide::FState Straight;
        for (int Frame = 0; Frame < 60; ++Frame) Straight.Tick(1.f / 60.f, 2000.f, 400.f, false);
        Expect(Straight.Pays == 0, "no brake, no banner");
    }

    void TestSession()
    {
        std::vector<FSample> Trace;
        const FPhase Slide[] = {{3.f, false, 0.f, true}, {1.2f, true, 1.f, false}};
        const FCar Paid = Play(Slide, 2, &Trace);
        Expect(Paid.Slide.Pays == 1, "a held slide pays once, got %d", Paid.Slide.Pays);
        float PayTime = -1.f;
        float Peak = 0.f;
        for (const FSample& Sample : Trace)
        {
            Peak = std::max(Peak, std::fabs(Sample.Lateral));
            if (PayTime < 0.f && Sample.Pays == 1) PayTime = Sample.Time;
        }
        Expect(PayTime > 3.4f && PayTime < 3.8f, "pay time %f", static_cast<double>(PayTime));
        Expect(Peak > 400.f, "peak lateral %f", static_cast<double>(Peak));
        std::printf("pay %.3f peak %.1f\n", static_cast<double>(PayTime), static_cast<double>(Peak));
        for (const FSample& Sample : Trace)
            std::printf("trace %.4f %.2f %.2f %d\n", static_cast<double>(Sample.Time),
                static_cast<double>(Sample.Speed), static_cast<double>(Sample.Lateral), Sample.Pays);

        const FPhase Tap[] = {{3.f, false, 0.f, true}, {.45f, true, 1.f, false}, {.8f, false, 0.f, false}};
        Expect(Play(Tap, 3, nullptr).Slide.Pays == 0, "a short brake earns nothing");
        const FPhase NoBrake[] = {{3.f, false, 0.f, true}, {1.2f, false, 1.f, true}};
        const FCar Gripped = Play(NoBrake, 2, nullptr);
        Expect(Gripped.Slide.Pays == 0, "a turn without the handbrake earns nothing");
        Expect(Gripped.PeakLateral < QuebecSlide::MinLateral, "grip kept the shove under the line, peak %f",
            static_cast<double>(Gripped.PeakLateral));
        const FPhase Gas[] = {{4.f, false, 0.f, true}};
        Expect(Play(Gas, 1, nullptr).Slide.Pays == 0, "a straight run earns nothing");

        const FPhase Twice[] = {
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
            {3.f, false, 0.f, true}, {1.2f, true, 1.f, false},
        };
        Expect(Play(Twice, 4, nullptr).Slide.Pays == 2, "a second slide after getting up to speed pays again");
        const FPhase Quick[] = {
            {3.f, false, 0.f, true}, {.7f, true, 1.f, false},
            {.2f, false, 0.f, false}, {.8f, true, 1.f, false},
        };
        Expect(Play(Quick, 4, nullptr).Slide.Pays == 1, "a second shove inside 1.5 s stays on the first banner");
    }
}

int main()
{
    TestRule();
    TestSession();
    std::printf("%d failures\n", Failures);
    std::printf("%d assertions\n", Assertions);
    return Failures == 0 ? 0 : 1;
}
