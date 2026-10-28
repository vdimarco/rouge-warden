// Standalone test for Source/Quebec/QuebecBayRules.h. Built and run by Scripts/test_bay_rules.py.
// With QUEBEC_BAY_STRICT the Unreal macro names are poisoned before the header is read.

#ifdef QUEBEC_BAY_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBayRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecBay;

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

    void ExpectQuote(const FQuote& QuoteResult, int Cash, double Damage, int Price, EBill Result, const char* Why)
    {
        Expect(QuoteResult.Cash == Cash, "%s cash is %d", Why, QuoteResult.Cash);
        Expect(QuoteResult.Damage == Damage, "%s damage is %.1f", Why, QuoteResult.Damage);
        Expect(QuoteResult.Price == Price, "%s price is %d", Why, QuoteResult.Price);
        Expect(QuoteResult.Result == Result, "%s result is %d", Why, static_cast<int>(Result));
    }

    void BillTests()
    {
        Expect(PriceFor(0.) == 0 && PriceFor(-10.) == 0, "a clean car still has a bill");
        Expect(PriceFor(100.) == WreckPrice && WreckPrice == 400, "a wreck is not 400");
        Expect(PriceFor(50.) == 220, "half the body is not 220");
        Expect(PriceFor(25.) == 130, "a quarter of the body is not 130");
        Expect(PriceFor(1.) > ScratchPrice && PriceFor(1.) < PriceFor(25.), "a scratch costs as much as a dent");
        Expect(PriceFor(100.) > PriceFor(50.) && PriceFor(50.) > PriceFor(25.), "the bill does not grow with the damage");
        Expect(PriceFor(1000.) == WreckPrice, "damage past a wreck costs extra");
        Expect(QuebecJobRules::Rewards[2] == 300, "the goon pay moved");
        Expect(QuebecJobRules::Rewards[2] < WreckPrice, "the goon pay covers a wreck");
        Expect(QuebecJobRules::Rewards[0] < WreckPrice, "a delivery covers a wreck");
        Expect(QuebecJobRules::Rewards[3] > WreckPrice, "an escape no longer covers a wreck");

        ExpectQuote(Quote(400, 100., false, false, true, false), 0, 0., 400, EBill::Mend, "a wreck");
        ExpectQuote(Quote(399, 100., false, false, true, false), 399, 100., 400, EBill::Short, "a short purse");
        ExpectQuote(Quote(500, 50., false, false, true, false), 280, 0., 220, EBill::Mend, "a dent");
        ExpectQuote(Quote(500, 0., false, false, true, false), 500, 0., 0, EBill::None, "a clean car");
        ExpectQuote(Quote(500, 40., false, true, true, false), 500, 40., 0, EBill::None, "a driver");
        ExpectQuote(Quote(500, 40., true, false, true, false), 500, 40., 0, EBill::None, "a downed player");
        ExpectQuote(Quote(500, 40., false, false, false, false), 500, 40., 0, EBill::None, "no car in reach");
        ExpectQuote(Quote(500, 100., false, false, true, true), 500, 100., 0, EBill::None, "a police car");
    }

    void PlaceTests()
    {
        const QuebecJobRules::FJobSpot Here{Spot.X, Spot.Y, 0.};
        const double MinX = -43674.718, MaxX = 75373.303, MinY = -46754.4, MaxY = 69018.4;
        Expect(QuebecJobRules::Clearance(Here) >= QuebecJobRules::MinClearance, "the bay is %.0f cm from a QA anchor", QuebecJobRules::Clearance(Here));
        Expect(Here.X > MinX + 1000. && Here.X < MaxX - 1000. && Here.Y > MinY + 1000. && Here.Y < MaxY - 1000., "the bay is outside the district");
        const QuebecJobRules::FJobSpot Stall{38004., -11444., 0.};
        const QuebecJobRules::FJobSpot Bow{-13366., 5258., 0.};
        Expect(QuebecJobRules::Distance2D(Here, Stall) > 1500., "the bay shares the casse-croûte");
        Expect(QuebecJobRules::Distance2D(Here, Bow) > 1500., "the bay shares the stage");
        Expect(RoadGap - Reach > EnterRadius, "standing at the bay still reaches the car door");
        Expect(CarReach > RoadGap, "a car on the road is out of the bay's reach");
        const QuebecJobRules::FJobSpot Points[] = {
            QuebecJobRules::Markers[0], QuebecJobRules::Markers[1], QuebecJobRules::Markers[2], QuebecJobRules::Markers[3],
            QuebecJobRules::Markers[4], QuebecJobRules::Markers[5], QuebecJobRules::FareDrop,
            QuebecJobRules::DeliveryCafe, QuebecJobRules::EscapeGarage
        };
        for (const QuebecJobRules::FJobSpot& Point : Points)
            Expect(QuebecJobRules::Distance2D(Here, Point) > 800., "the bay is %.0f cm from a job point", QuebecJobRules::Distance2D(Here, Point));
    }
}

int main()
{
    BillTests();
    PlaceTests();
    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
