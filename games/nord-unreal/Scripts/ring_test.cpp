// Standalone test for Source/Quebec/QuebecRing.h. Built by Scripts/test_ring.py.

#ifdef QUEBEC_RING_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecRing.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecRing;

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

    double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }
}

int main()
{
    Expect(StandX == 34800. && StandY == -4000., "the stand moved");
    Expect(StandX == QuebecCycle::StandX && StandY == QuebecCycle::StandY, "the ring left the bike stand");
    Expect(GateAX == 34800. && GateAY == 16000., "the lawn moved");
    Expect(GateBX == 14800. && GateBY == -4000., "the allée moved");
    Expect(Pay == 180 && Nobody == -1 && Reach == 450.f, "the purse or the reach drifted");

    const double LawnGap = Gap(StandX, StandY, GateAX, GateAY);
    const double AlleeGap = Gap(GateAX, GateAY, GateBX, GateBY);
    const double HomeGap = Gap(GateBX, GateBY, StandX, StandY);
    Expect(LawnGap > 5000. && AlleeGap > 5000. && HomeGap > 5000., "a leg is short enough to skip on foot");
    Expect(std::fabs(LawnGap - 20000.) < 1. && std::fabs(HomeGap - 20000.) < 1., "a straight leg left %f / %f", LawnGap, HomeGap);
    Expect(!Inside(StandX, StandY, GateAX, GateAY, Reach), "the stand already counts as the lawn");
    Expect(!Inside(GateAX, GateAY, GateBX, GateBY, Reach), "one reach covers both marks");

    FProgress Open;
    const FProgress Missed = Advance(Open, 7, false, false, true, false);
    Expect(Missed.Leg == Stand && Missed.Rider == Nobody, "a car tagged the lawn");
    const FProgress Early = Advance(Open, 7, true, true, false, false);
    Expect(Early.Leg == Stand, "standing at the support finished the lap");
    const FProgress Skipped = Advance(Open, 7, true, false, false, true);
    Expect(Skipped.Leg == Stand && Purse(Open, Skipped) == 0, "the allée skipped the lawn");

    const FProgress Tagged = Advance(Open, 7, true, false, true, true);
    Expect(Tagged.Leg == Lawn && Tagged.Rider == 7, "the lawn did not remember the rider");
    Expect(Purse(Open, Tagged) == 0, "the lawn paid");
    const FProgress Stranger = Advance(Tagged, 4, true, false, false, true);
    Expect(Stranger.Leg == Lawn && Stranger.Rider == 7, "a different rider took the lap");
    Expect(Purse(Tagged, Stranger) == 0, "a different rider was paid");
    const FProgress HomeEarly = Advance(Tagged, 7, true, true, false, false);
    Expect(HomeEarly.Leg == Lawn, "returning early finished the lap");

    const FProgress Second = Advance(Tagged, 7, true, false, false, true);
    Expect(Second.Leg == Allee && Second.Rider == 7, "the allée forgot the rider");
    Expect(Purse(Tagged, Second) == 0, "the allée paid");
    const FProgress Rewound = Advance(Second, 7, true, false, true, false);
    Expect(Rewound.Leg == Allee, "going back to the lawn rewound the lap");
    const FProgress Stolen = Advance(Second, 4, true, true, false, false);
    Expect(Stolen.Leg == Allee && Purse(Second, Stolen) == 0, "a friend at the stand took the purse");

    const FProgress Closed = Advance(Second, 7, true, true, false, false);
    Expect(Closed.Leg == Done && Closed.Rider == 7, "the stand did not close the lap");
    Expect(Purse(Second, Closed) == Pay, "the purse was not %d", Pay);
    const FProgress Again = Advance(Closed, 7, true, true, true, true);
    Expect(Again.Leg == Done && Purse(Closed, Again) == 0, "a second pass paid");

    FProgress Zero;
    const FProgress First = Advance(Zero, 0, true, false, true, false);
    Expect(First.Leg == Lawn && First.Rider == 0, "player 0 could not tag the lawn");
    const FProgress Empty = Advance(Open, Nobody, true, false, true, false);
    Expect(Empty.Leg == Stand, "nobody tagged the lawn");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
