#include "QuebecStreetLook.h"

#include <cmath>
#include <cstdlib>
#include <iostream>

namespace
{
    bool Near(double Value, double Expected, double Tolerance)
    {
        return std::fabs(Value - Expected) <= Tolerance;
    }
}

int main()
{
    // Sherbrooke segment beside the park spawn, and a closer footway that must not win.
    const QuebecStreetLook::FSegment Narrow{38700., -7600., 38900., -7400., 380.f};
    const QuebecStreetLook::FSegment Avenue{36384.939, -13092.345, 38188.081, -4938.155, 1400.f};
    const QuebecStreetLook::FSegment Segments[] = {Narrow, Avenue};
    const double SpawnX = 38793.0165416717;
    const double SpawnY = -7522.815200551502;
    const double Authored = 77.53080143026988;
    const double Aimed = QuebecStreetLook::AimYaw(SpawnX, SpawnY, Segments, 2, Authored);
    if (!Near(Aimed, 110.076, 0.05))
    {
        std::cerr << "spawn aim " << Aimed << "\n";
        return 1;
    }
    // An unset yaw still prefers the same direction down the avenue.
    const double FromZero = QuebecStreetLook::AimYaw(SpawnX, SpawnY, Segments, 2, 0.);
    if (!Near(FromZero, Aimed, 0.01))
    {
        std::cerr << "zero fallback " << FromZero << "\n";
        return 1;
    }
    // Far from every avenue, the authored yaw stays.
    const double Kept = QuebecStreetLook::AimYaw(0., 0., Segments, 2, 12.);
    if (!Near(Kept, 12., 0.001))
    {
        std::cerr << "distant yaw " << Kept << "\n";
        return 1;
    }
    // A narrow street underfoot is not an avenue.
    const double NarrowOnly = QuebecStreetLook::AimYaw(38800., -7500., &Narrow, 1, 5.);
    if (!Near(NarrowOnly, 5., 0.001))
    {
        std::cerr << "narrow yaw " << NarrowOnly << "\n";
        return 1;
    }
    std::cout << "NORD_STREET_AIM_OK " << Aimed << "\n";
    return 0;
}
