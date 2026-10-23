// Standalone test for Source/Quebec/QuebecTrio.h. Built by Scripts/test_trio.py.

#ifdef QUEBEC_TRIO_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecTrio.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecTrio;

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

    double Gap(int A, int B)
    {
        return std::hypot(Stops[A].X - Stops[B].X, Stops[A].Y - Stops[B].Y);
    }
}

int main()
{
    Expect(StopCount == 3 && Done == 3 && Nobody == -1, "the chain length drifted");
    Expect(Pay == 240 && Reach == 450.f, "the purse or the reach drifted");
    Expect(Stops[0].X == 40728.122518850185 && Stops[0].Y == -13228.603649675151, "porte 1 moved");
    Expect(Stops[1].X == 50326.0914605786 && Stops[1].Y == -17800.430512056646, "porte 2 moved");
    Expect(Stops[2].X == 33318.71650840211 && Stops[2].Y == -21325.7112521016, "porte 3 moved");

    const double First = Gap(0, 1);
    const double Second = Gap(1, 2);
    const double Span = Gap(0, 2);
    Expect(First > 10000. && Second > 10000. && Span > 10000., "a leg is shorter than 100 m");
    Expect(First > static_cast<double>(Reach) * 2. && Second > static_cast<double>(Reach) * 2. && Span > static_cast<double>(Reach) * 2.,
        "two posts share a reach");
    Expect(!Inside(Stops[1].X, Stops[1].Y, Stops[0].X, Stops[0].Y, Reach), "porte 2 sits on porte 1");
    Expect(!Inside(Stops[2].X, Stops[2].Y, Stops[1].X, Stops[1].Y, Reach), "porte 3 sits on porte 2");
    Expect(Inside(Stops[0].X + 450., Stops[0].Y, Stops[0].X, Stops[0].Y, Reach), "porte 1 reach was short");
    Expect(!Inside(Stops[0].X + 451., Stops[0].Y, Stops[0].X, Stops[0].Y, Reach), "past porte 1 still counted");

    const FProgress Start;
    Expect(Advance(Start, 7, true, false, true, false).Step == 0, "porte 2 counted before porte 1");
    Expect(Advance(Start, 7, true, false, false, true).Step == 0, "porte 3 counted before porte 1");
    Expect(Advance(Start, 7, false, true, false, false).Step == 0, "a driver tagged porte 1");
    Expect(Advance(Start, Nobody, true, true, false, false).Step == 0, "nobody tagged porte 1");
    Expect(Purse(Start, Start) == 0, "standing still paid");

    const FProgress One = Advance(Start, 7, true, true, false, false);
    Expect(One.Step == 1 && One.Runner == 7, "porte 1 did not remember the walker");
    Expect(Purse(Start, One) == 0, "porte 1 paid early");
    Expect(Advance(One, 7, true, false, false, true).Step == 1, "porte 3 skipped porte 2");
    Expect(Advance(One, 4, true, false, true, false).Step == 1, "a bystander took porte 2");
    Expect(Advance(One, 4, true, false, true, false).Runner == 7, "a bystander replaced the walker");

    const FProgress Two = Advance(One, 7, true, false, true, false);
    Expect(Two.Step == 2 && Two.Runner == 7, "porte 2 did not advance");
    Expect(Purse(One, Two) == 0, "porte 2 paid early");
    Expect(Advance(Two, 7, true, true, false, false).Step == 2, "porte 1 pulled the walk backward");
    Expect(Advance(Two, 4, true, false, false, true).Step == 2, "a bystander finished the walk");

    const FProgress Home = Advance(Two, 7, true, false, false, true);
    Expect(Home.Step == Done && Home.Runner == 7, "porte 3 did not finish the walk");
    Expect(Purse(Two, Home) == Pay, "porte 3 paid %d", Purse(Two, Home));
    Expect(Advance(Home, 7, true, true, true, true).Step == Done, "the walk ran again");
    Expect(Purse(Home, Home) == 0, "the walk paid twice");
    Expect(Advance(Two, 7, true, false, false, false).Step == 2, "leaving porte 2 finished the walk");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
