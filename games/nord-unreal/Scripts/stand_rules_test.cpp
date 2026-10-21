// Standalone test for Source/Quebec/QuebecStandRules.h. Built and run by Scripts/test_stand_rules.py.
// With QUEBEC_STAND_STRICT the Unreal macro names are poisoned before the header is read.

#ifdef QUEBEC_STAND_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecStandRules.h"
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>

using namespace QuebecStand;

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

    void ExpectSale(const FSale& Sale, int Cash, double Health, double Armor, int Stars, EGood Bought, const char* Why)
    {
        Expect(Sale.Cash == Cash, "%s cash is %d", Why, Sale.Cash);
        Expect(Sale.Health == Health, "%s health is %.1f", Why, Sale.Health);
        Expect(Sale.Armor == Armor, "%s armour is %.1f", Why, Sale.Armor);
        Expect(Sale.Stars == Stars, "%s stars are %d", Why, Sale.Stars);
        Expect(Sale.Bought == Bought, "%s bought %d", Why, static_cast<int>(Sale.Bought));
    }

    void SaleTests()
    {
        Expect(PriceOf(EGood::Health) == HealthPrice && HealthPrice == 80, "a kit is not 80");
        Expect(PriceOf(EGood::Armor) == ArmorPrice && ArmorPrice == 120, "a vest is not 120");
        Expect(PriceOf(EGood::Star) == StarPrice && StarPrice == 200, "a star is not 200");
        Expect(PriceOf(EGood::None) == 0, "nothing has a price");
        Expect(HealthPrice + ArmorPrice + StarPrice == 400, "the counter is not 400");
        Expect(QuebecJobRules::Rewards[2] == 300, "the goon pay moved");
        Expect(QuebecJobRules::Rewards[3] == 500, "the escape pay moved");
        Expect(QuebecJobRules::Rewards[0] >= HealthPrice + ArmorPrice, "a delivery no longer covers a kit and a vest");
        Expect(QuebecJobRules::Rewards[3] > HealthPrice + ArmorPrice + StarPrice, "an escape no longer covers the counter");

        ExpectSale(Sell(80, 40., 0., 3, false, false, false), 0, 90., 0., 3, EGood::Health, "a hurt player");
        ExpectSale(Sell(79, 40., 0., 0, false, false, false), 79, 40., 0., 0, EGood::None, "a short purse");
        ExpectSale(Sell(200, 60., 0., 4, false, false, false), 120, 100., 0., 4, EGood::Health, "a kit caps at full");
        ExpectSale(Sell(120, 100., 0., 2, false, false, false), 0, 100., 50., 2, EGood::Armor, "a healthy player buys a vest");
        ExpectSale(Sell(120, 99.6, 10., 1, false, false, false), 0, 99.6, 60., 1, EGood::Armor, "a nearly full bar counts as full");
        ExpectSale(Sell(80, 99.4, 100., 0, false, false, false), 0, 100., 100., 0, EGood::Health, "a bar just under full still needs a kit");
        ExpectSale(Sell(200, 100., 100., 2, false, false, false), 0, 100., 100., 1, EGood::Star, "a full player buys one star off");
        ExpectSale(Sell(200, 100., 100., 2, true, false, false), 200, 100., 100., 2, EGood::None, "Cinq étoiles keeps its stars");
        ExpectSale(Sell(80, 40., 0., 5, true, false, false), 0, 90., 0., 5, EGood::Health, "a hurt player still buys a kit during the escape");
        ExpectSale(Sell(500, 100., 100., 0, false, false, false), 500, 100., 100., 0, EGood::None, "nothing is for sale");
        ExpectSale(Sell(500, 10., 0., 3, false, true, false), 500, 10., 0., 3, EGood::None, "a downed player");
        ExpectSale(Sell(500, 10., 0., 3, false, false, true), 500, 10., 0., 3, EGood::None, "a driver");

        const FSale Kit = Sell(520, 70., 0., 1, false, false, false);
        ExpectSale(Kit, 440, 100., 0., 1, EGood::Health, "the kit");
        const FSale Vest = Sell(Kit.Cash, Kit.Health, Kit.Armor, Kit.Stars, false, false, false);
        ExpectSale(Vest, 320, 100., 50., 1, EGood::Armor, "the first vest");
        const FSale VestFull = Sell(Vest.Cash, Vest.Health, Vest.Armor, Vest.Stars, false, false, false);
        ExpectSale(VestFull, 200, 100., 100., 1, EGood::Armor, "the second vest");
        const FSale Quiet = Sell(VestFull.Cash, VestFull.Health, VestFull.Armor, VestFull.Stars, false, false, false);
        ExpectSale(Quiet, 0, 100., 100., 0, EGood::Star, "the star");
    }

    void PlaceTests()
    {
        const QuebecJobRules::FJobSpot Here{Spot.X, Spot.Y, 0.};
        const double MinX = -43674.718, MaxX = 75373.303, MinY = -46754.4, MaxY = 69018.4;
        Expect(QuebecJobRules::Clearance(Here) >= QuebecJobRules::MinClearance, "the stand is %.0f cm from a QA anchor", QuebecJobRules::Clearance(Here));
        Expect(Here.X > MinX + 1000. && Here.X < MaxX - 1000. && Here.Y > MinY + 1000. && Here.Y < MaxY - 1000., "the stand is outside the district");
        const QuebecJobRules::FJobSpot Spawn{38793.0, -7522.8, 0.};
        const double FromSpawn = QuebecJobRules::Distance2D(Here, Spawn);
        Expect(FromSpawn > 3000. && FromSpawn < 6000., "the stand is %.0f cm from the spawn sidewalk", FromSpawn);
        Expect(Here.Y < Spawn.Y && Here.X > 37000. && Here.X < 40000., "the stand left the Sherbrooke block");
        const QuebecJobRules::FJobSpot Points[] = {
            QuebecJobRules::Markers[0], QuebecJobRules::Markers[1], QuebecJobRules::Markers[2], QuebecJobRules::Markers[3], QuebecJobRules::Markers[4],
            QuebecJobRules::DeliveryCafe, QuebecJobRules::DeliveryDoors[0], QuebecJobRules::DeliveryDoors[1], QuebecJobRules::DeliveryDoors[2],
            QuebecJobRules::ThiefStart, QuebecJobRules::GoonArena, QuebecJobRules::EscapeGarage,
            QuebecJobRules::PosterBoards[0], QuebecJobRules::PosterBoards[1], QuebecJobRules::PosterBoards[2],
            QuebecJobRules::GoonSpawns[0], QuebecJobRules::GoonSpawns[1], QuebecJobRules::GoonSpawns[2], QuebecJobRules::GoonSpawns[3], QuebecJobRules::GoonSpawns[4]
        };
        for (const QuebecJobRules::FJobSpot& Point : Points)
            Expect(QuebecJobRules::Distance2D(Here, Point) > 800., "the stand is %.0f cm from a job point", QuebecJobRules::Distance2D(Here, Point));
        Expect(Reach <= 280., "the stand reach overlaps a story step");
    }
}

int main()
{
    SaleTests();
    PlaceTests();
    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
