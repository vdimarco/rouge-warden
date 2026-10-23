// Standalone test for Source/Quebec/QuebecCycle.h. Built by Scripts/test_cycle.py.

#ifdef QUEBEC_CYCLE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecCycle.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecCycle;

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
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    float Run(float Speed, float Throttle, bool bInWater, float Seconds)
    {
        const int Steps = static_cast<int>(Seconds / 0.05f);
        for (int Step = 0; Step < Steps; ++Step) Speed = Advance(Speed, Throttle, bInWater, 0.05f);
        return Speed;
    }
}

int main()
{
    Expect(BikeKind == 2, "the bike kind drifted");
    Expect(IsBike(BikeKind) && !IsBike(0) && !IsBike(1), "a car or a pedalo counts as a bike");
    Expect(Top == 900.f && Top > 450.f, "the bike is not faster than a walk");
    Expect(Reverse == 200.f && Bog == 90.f, "reverse or the water bog drifted");

    Expect(Advance(100.f, 1.f, false, 0.f) == 100.f, "a zero step still pedaled");
    Expect(Advance(400.f, 1.f, false, -1.f) == 400.f, "a backward step still pedaled");

    const float Rolling = Run(0.f, 1.f, false, 4.f);
    Expect(Rolling == Top, "full gas left %f", static_cast<double>(Rolling));
    const float Held = Run(Top, 1.f, false, 2.f);
    Expect(Held == Top, "holding the pedals climbed past the top");
    const float Back = Run(0.f, -1.f, false, 2.f);
    Expect(Back == -Reverse, "reverse left %f", static_cast<double>(Back));

    const float Dunked = Run(0.f, 1.f, true, 2.f);
    Expect(Dunked == Bog, "the water bog left %f", static_cast<double>(Dunked));
    const float Soaked = Advance(Top, 1.f, true, 0.5f);
    Expect(Soaked < Top && Soaked > Bog, "a dunked bike kept the dry top");

    const float Glide = Advance(Top, 0.f, false, 1.f);
    Expect(std::fabs(Glide - 760.f) < 0.05f, "coasting left %f", static_cast<double>(Glide));
    const float Stopped = Run(Top, 0.f, false, 8.f);
    Expect(Stopped == 0.f, "the bike never stopped");

    const float Aim = YawDegrees(0.f, 1.f, 1.f);
    Expect(std::fabs(Aim - TurnDegrees) < 0.01f, "a stop turn left %f", static_cast<double>(Aim));
    const float Sweep = YawDegrees(Top, 1.f, 1.f);
    Expect(std::fabs(Sweep - 31.5f) < 0.05f, "a top turn left %f", static_cast<double>(Sweep));
    Expect(Sweep < Aim, "speed did not loosen the turn");
    Expect(YawDegrees(Top, 1.f, 0.f) == 0.f, "a zero step still turned");

    Expect(StandX == 34800. && StandY == -4000., "the stand moved");
    Expect(StandZ == 102.f && StandYaw == 90.f, "the stand height or heading drifted");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
