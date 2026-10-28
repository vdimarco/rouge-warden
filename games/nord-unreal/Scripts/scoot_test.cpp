// Standalone test for Source/Quebec/QuebecScoot.h. Built by Scripts/test_scoot.py.

#ifdef QUEBEC_SCOOT_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecScoot.h"
#include "../Source/Quebec/QuebecCycle.h"
#include "../Source/Quebec/QuebecRide.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecScoot;

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

    double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }
}

int main()
{
    Expect(ScootKind == 3, "the scooter kind drifted");
    Expect(IsScoot(ScootKind) && !IsScoot(0) && !IsScoot(1) && !IsScoot(2), "a car, a pedalo, or a bike counts as a scooter");
    Expect(ScootKind != QuebecCycle::BikeKind && ScootKind != QuebecRide::PedaloKind, "the scooter reused another ride");
    Expect(Top > 450.f && Top < QuebecCycle::Top, "the scooter is not between a walk and the bike");
    Expect(Reverse == 150.f && Bog == 60.f && Bog < QuebecCycle::Bog, "reverse or the water bog drifted");

    Expect(Advance(100.f, 1.f, false, 0.f) == 100.f, "a zero step still kicked");
    Expect(Advance(200.f, 1.f, false, -1.f) == 200.f, "a backward step still kicked");

    const float Rolling = Run(0.f, 1.f, false, 2.f);
    Expect(Rolling == Top, "full gas left %f", static_cast<double>(Rolling));
    const float Held = Run(Top, 1.f, false, 2.f);
    Expect(Held == Top, "holding the kick climbed past the top");
    const float Back = Run(0.f, -1.f, false, 1.f);
    Expect(Back == -Reverse, "reverse left %f", static_cast<double>(Back));

    const float Dunked = Run(0.f, 1.f, true, 1.f);
    Expect(Dunked == Bog, "the water bog left %f", static_cast<double>(Dunked));
    const float Soaked = Advance(Top, 1.f, true, 0.5f);
    Expect(Soaked < Top && Soaked > Bog, "a dunked scooter kept the dry top");

    const float Glide = Advance(Top, 0.f, false, 1.f);
    Expect(std::fabs(Glide - 440.f) < 0.05f, "coasting left %f", static_cast<double>(Glide));
    const float Stopped = Run(Top, 0.f, false, 5.f);
    Expect(Stopped == 0.f, "the scooter never stopped");

    const float Aim = YawDegrees(0.f, 1.f, 1.f);
    Expect(std::fabs(Aim - TurnDegrees) < 0.01f, "a stop turn left %f", static_cast<double>(Aim));
    const float Sweep = YawDegrees(Top, 1.f, 1.f);
    Expect(std::fabs(Sweep - 40.f) < 0.05f, "a top turn left %f", static_cast<double>(Sweep));
    Expect(Sweep < Aim, "speed did not loosen the turn");
    Expect(YawDegrees(Top, 1.f, 0.f) == 0.f, "a zero step still turned");

    Expect(StandX == 28000. && StandY == 8000., "the stand moved");
    Expect(StandX > 20000., "the stand sits on the pond side");
    Expect(StandZ == 102.f && StandYaw == 0.f, "the stand height or heading drifted");
    Expect(Gap(StandX, StandY, QuebecCycle::StandX, QuebecCycle::StandY) > 600., "the scooter stands on the bike");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
