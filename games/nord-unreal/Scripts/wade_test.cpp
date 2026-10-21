// Standalone test for Source/Quebec/QuebecWade.h. Built by Scripts/test_wade.py.

#ifdef QUEBEC_WADE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecWade.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

using namespace QuebecWade;

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
    Expect(static_cast<int>(ELeg::Bank) == 0 && static_cast<int>(ELeg::Buoy) == 1 && static_cast<int>(ELeg::Done) == 2,
        "the legs drifted");
    Expect(Pay == 80 && Reach == 450.f, "the purse or the reach drifted");
    Expect(BuoyX == 3585.566498 && BuoyY == -6351.3626, "the float left the south-pond swim point");

    const double DX = BuoyX - BankX;
    const double DY = BuoyY - BankY;
    const double Gap = std::hypot(DX, DY);
    Expect(std::fabs(Gap - 2100.) < 0.05, "the bank drifted, gap %f", Gap);
    Expect(Gap > static_cast<double>(Reach) * 2., "the float and the bank overlap");
    Expect(!Inside(BuoyX, BuoyY, BankX, BankY, Reach), "the float sits on the bank");
    Expect(!Inside(BankX, BankY, BuoyX, BuoyY, Reach), "the bank sits on the float");
    Expect(Inside(BuoyX, BuoyY, BuoyX, BuoyY, Reach), "the float misses itself");
    Expect(Inside(BankX + 450., BankY, BankX, BankY, Reach), "the bank reach was short");
    Expect(!Inside(BankX + 451., BankY, BankX, BankY, Reach), "past the bank still counted");

    const FProgress Start;
    Expect(Advance(Start, 1, true, false, true).Leg == ELeg::Bank, "standing on the bank already finished the wade");
    Expect(Purse(Start, Start) == 0, "standing on the bank paid");

    Expect(Advance(Start, 1, false, true, false).Leg == ELeg::Bank, "a driver tagged the float");
    FProgress Waiting;
    Waiting.Leg = ELeg::Buoy;
    Waiting.Swimmer = 1;
    Expect(Advance(Waiting, 1, false, false, true).Leg == ELeg::Buoy, "a driver finished the wade");
    Expect(Purse(Waiting, Waiting) == 0, "a driver was paid");

    const FProgress Tagged = Advance(Start, 7, true, true, false);
    Expect(Tagged.Leg == ELeg::Buoy && Tagged.Swimmer == 7, "the swimmer missed the float");
    Expect(Purse(Start, Tagged) == 0, "tagging the float paid early");
    Expect(Advance(Start, 7, true, true, true).Leg == ELeg::Buoy, "touching both spots skipped the float");

    const FProgress Stolen = Advance(Tagged, 4, true, false, true);
    Expect(Stolen.Leg == ELeg::Buoy && Stolen.Swimmer == 7, "a bystander finished the wade");
    Expect(Purse(Tagged, Stolen) == 0, "a bystander was paid");
    Expect(Advance(Tagged, Nobody, true, false, true).Leg == ELeg::Buoy, "nobody finished the wade");

    const double MidX = (BuoyX + BankX) * 0.5;
    const double MidY = (BuoyY + BankY) * 0.5;
    Expect(!Inside(MidX, MidY, BuoyX, BuoyY, Reach) && !Inside(MidX, MidY, BankX, BankY, Reach),
        "the middle of the wade counted as a mark");
    Expect(Advance(Start, 7, true, false, false).Leg == ELeg::Bank, "open water tagged the float");
    Expect(Advance(Tagged, 7, true, true, false).Leg == ELeg::Buoy, "touching the float again finished the wade");

    const FProgress Home = Advance(Tagged, 7, true, false, true);
    Expect(Home.Leg == ELeg::Done && Home.Swimmer == 7, "the return missed the bank");
    Expect(Purse(Tagged, Home) == Pay, "the return paid %d", Purse(Tagged, Home));
    Expect(Advance(Home, 7, true, true, true).Leg == ELeg::Done, "the wade ran again");
    Expect(Purse(Home, Home) == 0, "the wade paid twice");
    Expect(Advance(Tagged, 7, true, false, false).Leg == ELeg::Buoy, "leaving the float finished the wade");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
