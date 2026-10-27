// The gas pedal reaches full power in 50 ms. Steering rates stay put.

#ifdef QUEBEC_PEDAL_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecSteerAssist.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

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

    struct FDrive
    {
        float Throttle = 0.f;
        float Speed = 0.f;
        float Distance = 0.f;
    };

    // The player-car gas step, without steering, collision or the road assist.
    void Advance(FDrive& Drive, float Pedal, float Seconds, float Rate)
    {
        Drive.Throttle = QuebecSteer::MoveToward(Drive.Throttle, Pedal, Seconds, Rate);
        if (std::fabs(Pedal) > .01f)
        {
            const float Power = QuebecSteer::Lerp(1050.f, 700.f, QuebecSteer::Clamp(std::fabs(Drive.Speed) / 3000.f, 0.f, 1.f));
            const float Sign = Pedal > 0.f ? 1.f : -1.f;
            Drive.Speed += std::max(0.f, Drive.Throttle * Sign) * Sign * Power * Seconds;
            Drive.Speed = QuebecSteer::MoveToward(Drive.Speed, 0.f, Seconds, 100.f + Drive.Speed * Drive.Speed * .000035f);
        }
        else Drive.Speed = QuebecSteer::MoveToward(Drive.Speed, 0.f, Seconds, 360.f + Drive.Speed * Drive.Speed * .000035f);
        Drive.Speed = QuebecSteer::Clamp(Drive.Speed, -950.f, 3000.f);
        Drive.Distance += Drive.Speed * Seconds;
    }

    FDrive Hold(float Seconds, float Rate, float Step = 1.f / 60.f)
    {
        FDrive Drive;
        for (float Elapsed = 0.f; Elapsed < Seconds - 1.e-4f; Elapsed += Step)
            Advance(Drive, 1.f, std::min(Step, Seconds - Elapsed), Rate);
        return Drive;
    }

    float SecondsToFull(float Rate, float Step = 1.f / 60.f)
    {
        FDrive Drive;
        for (int Frame = 1; Frame <= 30; ++Frame)
        {
            Advance(Drive, 1.f, Step, Rate);
            if (Drive.Throttle >= 1.f - 1.e-4f) return static_cast<float>(Frame) * Step;
        }
        return 1.f;
    }
}

int main()
{
    using namespace QuebecSteer;
    Expect(ThrottleRate == 20.f, "the pedal follows at 20 per second");
    Expect(HoldRate == 3.5f && ReleaseRate == 10.f, "steering rates stay");
    const float Now = SecondsToFull(ThrottleRate);
    const float Before = SecondsToFull(5.f);
    Expect(Now <= .05f + 1.e-4f && Now >= .04f, "full gas by 50 ms, not a one-frame snap (%.3f)", static_cast<double>(Now));
    Expect(Before >= .19f, "the old 5 per second waited %.0f ms", static_cast<double>(Before * 1000.f));

    const FDrive Early = Hold(.25f, ThrottleRate);
    const FDrive Old = Hold(.25f, 5.f);
    Expect(Early.Speed > Old.Speed * 1.4f, "a quarter second is faster (%.0f vs %.0f cm/s)", static_cast<double>(Early.Speed), static_cast<double>(Old.Speed));
    Expect(Early.Distance > Old.Distance * 1.8f, "and covers more ground (%.1f vs %.1f cm)", static_cast<double>(Early.Distance), static_cast<double>(Old.Distance));

    const FDrive City = Hold(1.5f, ThrottleRate);
    Expect(City.Speed > 1100.f && City.Speed < 1400.f, "1.5 s is still city speed, not a launch (%.0f)", static_cast<double>(City.Speed));
    Expect(City.Distance > 750.f && City.Distance < 1100.f, "and the same travel window (%.0f cm)", static_cast<double>(City.Distance));

    FDrive Lift;
    Lift.Throttle = 1.f;
    Lift.Speed = 800.f;
    Advance(Lift, 0.f, 1.f / 60.f, ThrottleRate);
    Expect(Lift.Throttle < 1.f && Lift.Speed < 800.f, "a release drops the pedal and the speed on the next frame");

    std::printf("%d assertions, %d failures, full in %.0f ms, quarter %.0f cm/s over %.1f cm\n",
        Assertions, Failures, static_cast<double>(Now * 1000.f), static_cast<double>(Early.Speed), static_cast<double>(Early.Distance));
    return Failures == 0 ? 0 : 1;
}
