#pragma once

// How much of the run belongs at a given speed. Walk is 450 cm/s and sprint is 800.
// The hoodie graph blends the two clips by this share. A body with no run clip
// still cuts from the walk to the run at 520.

namespace QuebecGait
{
    inline double WalkRunShare(double SpeedCmPerSecond)
    {
        constexpr double Walk = 450.;
        constexpr double Sprint = 800.;
        if (SpeedCmPerSecond <= Walk) return 0.;
        if (SpeedCmPerSecond >= Sprint) return 1.;
        return (SpeedCmPerSecond - Walk) / (Sprint - Walk);
    }
}
