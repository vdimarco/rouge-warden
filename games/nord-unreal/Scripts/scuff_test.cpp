#include "QuebecScuff.h"

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
    if (!(QuebecScuff::Count * QuebecScuff::Interval >= QuebecScuff::Life))
    {
        std::cerr << "a puff would be reused before it fades\n";
        return 1;
    }
    const QuebecScuff::FPuff Born = QuebecScuff::At(0., 0);
    if (!Near(Born.Back, 0., 1e-6) || !Near(Born.Up, 6., 1e-6) || !Near(Born.Radius, 12., 1e-6) || !Near(Born.Side, -8., 1e-6))
    {
        std::cerr << "birth puff moved\n";
        return 1;
    }
    const QuebecScuff::FPuff Mid = QuebecScuff::At(0.52, 1);
    if (!Near(Mid.Back, 0.52 * 84., 1e-6) || !Near(Mid.Side, 8., 1e-6) || !(Mid.Radius > Born.Radius))
    {
        std::cerr << "mid puff back " << Mid.Back << " radius " << Mid.Radius << "\n";
        return 1;
    }
    const QuebecScuff::FPuff Dead = QuebecScuff::At(QuebecScuff::Life, 0);
    if (!(Dead.Radius < 0.05))
    {
        std::cerr << "a finished puff still has radius " << Dead.Radius << "\n";
        return 1;
    }
    if (!(Mid.Up > Born.Up + 20.))
    {
        std::cerr << "the puff should rise\n";
        return 1;
    }
    std::cout << "NORD_SCUFF_OK " << Mid.Back << " " << Mid.Radius << "\n";
    return 0;
}
