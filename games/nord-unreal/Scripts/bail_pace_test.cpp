// Standalone test for Source/Quebec/QuebecBail.h. Built by Scripts/test_bail_pace.py.

#ifdef QUEBEC_BAIL_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBail.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecBail;

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
}

int main()
{
    Expect(PlantAt == 450.f, "the plant line left a walk");
    Expect(Cap == 900.f, "the cap left 900 cm/s");
    Expect(Decay == 1400.f, "the ease left 1400 cm/s each second");

    Expect(CarryPace(0.f, 0.f) == 0.f, "a parked car still shoves");
    Expect(CarryPace(450.f, 0.f) == 0.f, "a walk still shoves");
    Expect(CarryPace(-450.f, 0.f) == 0.f, "reversing at a walk still shoves");
    Expect(CarryPace(200.f, 300.f) == 0.f, "a slow slide still shoves");
    Expect(CarryPace(451.f, 0.f) == 451.f, "just above a walk planted the player");
    Expect(CarryPace(-800.f, 0.f) == 800.f, "reversing dropped the pace");
    Expect(CarryPace(0.f, 800.f) == 800.f, "a sideways slip planted the player");
    Expect(CarryPace(3000.f, 0.f) == Cap, "a highway exit left the cap");
    Expect(CarryPace(0.f, -2000.f) == Cap, "a hard slide left the cap");
    Expect(std::fabs(CarryPace(600.f, 600.f) - 848.528137f) < 0.02f, "a diagonal slide left the pace");
    Expect(CarryPace(800.f, 800.f) == Cap, "a hard diagonal left the cap");

    Expect(Ease(0.f, 0.1f) == 0.f, "a planted exit started moving");
    Expect(Ease(900.f, 0.f) == 900.f, "a zero step eased the pace");
    Expect(Ease(900.f, -1.f) == 900.f, "a backward step eased the pace");
    const float Eased = Ease(900.f, 0.1f);
    Expect(std::fabs(Eased - 760.f) < 0.01f, "a tenth of a second left %f", static_cast<double>(Eased));
    Expect(Eased < 900.f, "the ease did not slow the pace");
    float Speed = 900.f;
    for (int Step = 0; Step < 20; ++Step) Speed = Ease(Speed, 0.05f);
    Expect(Speed == 0.f, "the pace never reached a stop");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
