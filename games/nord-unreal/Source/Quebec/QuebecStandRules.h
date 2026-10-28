#pragma once

// Engine-independent rules for the Sherbrooke casse-croûte. No Unreal includes, so
// Scripts/test_stand_rules.py can build and run it with the system compiler.
// The stall sells one thing at a time: a kit if you are hurt, else a vest, else one wanted star.
// Cash is session money. Nothing here is written into the v1 campaign slot.

#include <cmath>
#include <cstdint>

namespace QuebecStand
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    // Sidewalk of Rue Sherbrooke Est, 40 m south of the spawn along the mapped footway.
    // The point sits on that footway, clear of the job markers and the QA anchors.
    inline constexpr FSpot Spot{38004., -11444., 0.};
    inline constexpr double Reach = 250.;

    inline constexpr int HealthPrice = 80;
    inline constexpr int ArmorPrice = 120;
    inline constexpr int StarPrice = 200;
    // One kit or one vest, the same grant as a street pickup.
    inline constexpr int Grant = 50;
    inline constexpr int HealthCap = 100;
    inline constexpr int ArmorCap = 100;
    // A bar this close to full is already full, matching the pickup's refusal.
    inline constexpr double FullMargin = 0.5;

    enum class EGood : uint8_t { None, Health, Armor, Star };

    inline bool NeedsHealth(double Health)
    {
        return Health < static_cast<double>(HealthCap) - FullMargin;
    }

    inline bool NeedsArmor(double Armor)
    {
        return Armor < static_cast<double>(ArmorCap) - FullMargin;
    }

    // What E would buy. A downed player and a driver buy nothing. Stars are not for sale during Cinq étoiles.
    inline EGood GoodFor(double Health, double Armor, int Stars, bool bEscapeRunning, bool bDown, bool bInCar)
    {
        if (bDown || bInCar) return EGood::None;
        if (NeedsHealth(Health)) return EGood::Health;
        if (NeedsArmor(Armor)) return EGood::Armor;
        if (Stars > 0 && !bEscapeRunning) return EGood::Star;
        return EGood::None;
    }

    inline int PriceOf(EGood Good)
    {
        if (Good == EGood::Health) return HealthPrice;
        if (Good == EGood::Armor) return ArmorPrice;
        if (Good == EGood::Star) return StarPrice;
        return 0;
    }

    struct FSale
    {
        int Cash = 0;
        double Health = 0.;
        double Armor = 0.;
        int Stars = 0;
        EGood Bought = EGood::None;
    };

    // Cash, health, armour and stars after one press of E. A short purse or a refusal leaves them as they were.
    inline FSale Sell(int Cash, double Health, double Armor, int Stars, bool bEscapeRunning, bool bDown, bool bInCar)
    {
        FSale Out;
        Out.Cash = Cash;
        Out.Health = Health;
        Out.Armor = Armor;
        Out.Stars = Stars;
        const EGood Good = GoodFor(Health, Armor, Stars, bEscapeRunning, bDown, bInCar);
        const int Price = PriceOf(Good);
        if (Good == EGood::None || Cash < Price) return Out;
        Out.Cash = Cash - Price;
        Out.Bought = Good;
        if (Good == EGood::Health) Out.Health = std::fmin(static_cast<double>(HealthCap), Health + static_cast<double>(Grant));
        else if (Good == EGood::Armor) Out.Armor = std::fmin(static_cast<double>(ArmorCap), Armor + static_cast<double>(Grant));
        else Out.Stars = Stars - 1;
        return Out;
    }
}
