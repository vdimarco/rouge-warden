// Standalone test for Source/Quebec/QuebecNearMiss.h. Built by Scripts/test_near_miss.py.
// Two cars on straight lines at 60 Hz, offsets taken the same way as AQuebecCar::TickNearMiss.

#ifdef QUEBEC_NEAR_MISS_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecNearMiss.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <vector>

using namespace QuebecNearMiss;

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

    // The player drives along +X. Each other car keeps its own lane and speed along X.
    struct FOther
    {
        float X = 0.f;
        float Y = 0.f;
        float Speed = 0.f;
    };

    struct FRun
    {
        int Pays = 0;
        float FirstPay = -1.f;
    };

    // ContactAt: a time when the player's car touches something, or below zero for none.
    FRun Drive(float Speed, std::vector<FOther> Others, float Seconds, float ContactAt = -1.f)
    {
        FState State;
        FRun Run;
        const float Dt = 1.f / 60.f;
        float X = 0.f;
        float Time = 0.f;
        const int Steps = static_cast<int>(std::lround(Seconds / Dt));
        for (int Step = 0; Step < Steps; ++Step)
        {
            X += Speed * Dt;
            for (FOther& Other : Others) Other.X += Other.Speed * Dt;
            Time += Dt;
            State.Tick(Dt, ContactAt >= 0.f && Time >= ContactAt && Time < ContactAt + Dt);
            for (const FOther& Other : Others)
            {
                const FOffset Now{Other.X - X, Other.Y};
                const FOffset Before{Now.Ahead - (Other.Speed - Speed) * Dt, Now.Side};
                if (!State.Pass(Speed, Before, Now)) continue;
                if (Run.FirstPay < 0.f) Run.FirstPay = Time;
                break;
            }
        }
        Run.Pays = State.Pays;
        return Run;
    }
}

int main()
{
    Expect(MinSpeed == 1500.f && MaxSide == 330.f, "the line left 1500 cm/s or 330 cm");
    Expect(CleanSeconds == 1.f && AgainSeconds == 1.5f, "the gaps left 1 s or 1.5 s");
    Expect(Kmh(1500.f) == 54 && Kmh(-2000.f) == 72, "km/h %d %d", Kmh(1500.f), Kmh(-2000.f));

    // Oncoming in the next lane, 3 m to the side. The cars meet 1 s in.
    const FRun Oncoming = Drive(1800.f, {{3000.f, 300.f, -1200.f}}, 3.f);
    Expect(Oncoming.Pays == 1, "an oncoming car 3 m off pays once, got %d", Oncoming.Pays);
    Expect(Oncoming.FirstPay > .98f && Oncoming.FirstPay < 1.03f, "the banner comes as the cars meet, %f",
        static_cast<double>(Oncoming.FirstPay));
    Expect(Drive(1800.f, {{3000.f, -300.f, -1200.f}}, 3.f).Pays == 1, "the left side counts too");
    Expect(Drive(1800.f, {{3000.f, 500.f, -1200.f}}, 3.f).Pays == 0, "5 m off is not close");
    Expect(Drive(1200.f, {{3000.f, 300.f, -1200.f}}, 3.f).Pays == 0, "43 km/h is not fast");

    // Overtaking a slow car pays. Being overtaken does not.
    Expect(Drive(2000.f, {{1000.f, 280.f, 800.f}}, 3.f).Pays == 1, "overtaking close pays");
    Expect(Drive(1600.f, {{-1000.f, 280.f, 2600.f}}, 3.f).Pays == 0, "being overtaken pays nothing");

    // A touch voids the pass for a second.
    Expect(Drive(1800.f, {{3000.f, 300.f, -1200.f}}, 3.f, .5f).Pays == 0, "a touch 0.5 s before voids it");
    Expect(Drive(1800.f, {{3000.f, 300.f, -1200.f}}, 3.f, -1.f).Pays == 1, "no touch pays");
    Expect(Drive(1800.f, {{6000.f, 300.f, -1200.f}}, 3.f, .5f).Pays == 1, "a touch 1.5 s before does not");

    // Two cars 0.5 s apart make one banner. Two cars 2 s apart make two.
    Expect(Drive(1800.f, {{3000.f, 300.f, -1200.f}, {4500.f, 300.f, -1200.f}}, 4.f).Pays == 1, "a quick pair pays once");
    Expect(Drive(1800.f, {{3000.f, 300.f, -1200.f}, {9000.f, 300.f, -1200.f}}, 5.f).Pays == 2, "a slow pair pays twice");

    // A parked car at the curb, passed fast and close.
    Expect(Drive(1700.f, {{2000.f, 260.f, 0.f}}, 2.f).Pays == 1, "a parked car passed close pays");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
