#include "QuebecExhaust.h"

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
    const QuebecExhaust::FPuff Born = QuebecExhaust::At(0., 1);
    if (!Near(Born.Back, 0., 1e-6) || !Near(Born.Up, 0., 1e-6) || !Near(Born.Swell, 0.16, 1e-6) || !Near(Born.Side, 0., 1e-6))
    {
        std::cerr << "birth puff moved\n";
        return 1;
    }
    const QuebecExhaust::FPuff Mid = QuebecExhaust::At(0.55, 0);
    if (!Near(Mid.Back, 0.55 * 160., 1e-4) || !Near(Mid.Up, 0.55 * 180., 1e-4) || !(Mid.Swell > Born.Swell) || !(Mid.Side < 0.))
    {
        std::cerr << "mid puff back " << Mid.Back << " swell " << Mid.Swell << "\n";
        return 1;
    }
    const QuebecExhaust::FPuff Dead = QuebecExhaust::At(QuebecExhaust::Life, 2);
    if (!(Dead.Swell < 0.01) || !(Dead.Side > 0.))
    {
        std::cerr << "a finished puff still has swell " << Dead.Swell << "\n";
        return 1;
    }
    if (!(Mid.Up > Born.Up + 90.))
    {
        std::cerr << "the puff should rise\n";
        return 1;
    }
    int Live = 0;
    for (int Slot = 0; Slot < QuebecExhaust::Count; ++Slot)
    {
        const double Age = 0.05 + Slot * QuebecExhaust::Interval;
        if (Age >= 0. && Age < QuebecExhaust::Life && QuebecExhaust::At(Age, Slot).Swell > 0.05) ++Live;
    }
    if (Live != QuebecExhaust::Count)
    {
        std::cerr << "live puffs " << Live << "\n";
        return 1;
    }
    std::cout << "NORD_EXHAUST_OK " << Live << " " << Mid.Up << " " << Mid.Swell << "\n";
    return 0;
}
