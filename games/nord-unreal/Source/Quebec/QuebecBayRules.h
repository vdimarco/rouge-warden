#pragma once

// Engine-independent rules for the sidewalk atelier. No Unreal includes, so
// Scripts/test_bay_rules.py can build and run it with the system compiler.
// One walking player pays session cash to clear the body damage on a nearby car.
// The bill grows with the damage. A wreck costs more than a scratch.
// Wanted stars are not for sale here. Nothing is written into the v1 campaign slot.

#include <cmath>
#include <cstdint>

namespace QuebecBay
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    // Sidewalk east of the spawn, 8 m off a mapped road so standing here is outside the car door.
    inline constexpr FSpot Spot{42912., -9522., 0.};
    inline constexpr double Reach = 200.;
    // The road centre is this far from the sign. A car parked on that road is still in reach.
    inline constexpr double RoadGap = 800.;
    inline constexpr double CarReach = 1100.;
    // The door radius in QuebecGameplay.cpp. A player inside Reach stays farther from a car on the road.
    inline constexpr double EnterRadius = 450.;

    inline constexpr int DamageCap = 100;
    // The intercept of the bill. A car with no damage is not charged.
    inline constexpr int ScratchPrice = 40;
    inline constexpr int WreckPrice = 400;

    enum class EBill : uint8_t { None, Short, Mend };

    struct FQuote
    {
        int Cash = 0;
        double Damage = 0.;
        int Price = 0;
        EBill Result = EBill::None;
    };

    // Whole dollars for this much body damage. 0 when there is nothing to mend.
    // A wreck is WreckPrice. The line is straight from ScratchPrice at no damage.
    inline int PriceFor(double Damage)
    {
        if (!(Damage > 0.)) return 0;
        const double Clamped = std::fmin(Damage, static_cast<double>(DamageCap));
        const double Span = static_cast<double>(WreckPrice - ScratchPrice);
        const double Bill = static_cast<double>(ScratchPrice) + Span * (Clamped / static_cast<double>(DamageCap));
        const long Rounded = std::lround(Bill);
        if (Rounded < static_cast<long>(ScratchPrice)) return ScratchPrice;
        if (Rounded > static_cast<long>(WreckPrice)) return WreckPrice;
        return static_cast<int>(Rounded);
    }

    // Cash and damage after one press of E. A short purse, a police car, or a refusal leaves them as they were.
    // Stars are not an input: this counter cannot clear them.
    inline FQuote Quote(int Cash, double Damage, bool bDown, bool bInCar, bool bCarNear, bool bPolice)
    {
        FQuote Out;
        Out.Cash = Cash;
        Out.Damage = Damage;
        if (bDown || bInCar || !bCarNear || bPolice || !(Damage > 0.)) return Out;
        Out.Price = PriceFor(Damage);
        if (Cash < Out.Price)
        {
            Out.Result = EBill::Short;
            return Out;
        }
        Out.Cash = Cash - Out.Price;
        Out.Damage = 0.;
        Out.Result = EBill::Mend;
        return Out;
    }
}
