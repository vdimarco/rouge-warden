#include "QuebecSway.h"

#include <cmath>
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
    const QuebecSway::FPose Rest = QuebecSway::Pose(0., 180.);
    if (!Near(Rest.Roll, 0., 1e-6) || !Near(Rest.Bob, 0., 1e-6) || !Near(Rest.Side, 0., 1e-6) || !Near(Rest.Pitch, 0., 1e-6))
    {
        std::cerr << "rest pose moved\n";
        return 1;
    }
    const double WalkPeak = (3.14159265358979323846 * 0.5) / QuebecSway::WalkOmega;
    const QuebecSway::FPose Walk = QuebecSway::Pose(WalkPeak, 180.);
    if (!Near(Walk.Roll, QuebecSway::WalkRoll, 1e-6) || !Near(Walk.Side, QuebecSway::WalkSide, 1e-6))
    {
        std::cerr << "walk peak roll " << Walk.Roll << " side " << Walk.Side << "\n";
        return 1;
    }
    if (!Near(Walk.Bob, 0., 1e-6) || !Near(Walk.Pitch, 0., 1e-6))
    {
        std::cerr << "walk peak should be a pure lean\n";
        return 1;
    }
    const double IdlePeak = (3.14159265358979323846 * 0.5) / QuebecSway::IdleOmega;
    const QuebecSway::FPose Idle = QuebecSway::Pose(IdlePeak, 0.);
    if (!Near(Idle.Roll, QuebecSway::WalkRoll * QuebecSway::IdleShare, 1e-6))
    {
        std::cerr << "idle roll " << Idle.Roll << "\n";
        return 1;
    }
    if (!(std::fabs(Walk.Roll) > std::fabs(Idle.Roll) + 5.))
    {
        std::cerr << "walk lean should read larger than idle\n";
        return 1;
    }
    const QuebecSway::FPose Gate = QuebecSway::Pose(WalkPeak, QuebecSway::MoveSpeed);
    const QuebecSway::FPose Still = QuebecSway::Pose(WalkPeak, 0.);
    if (!Near(Gate.Roll, Still.Roll, 1e-6))
    {
        std::cerr << "speed at the idle gate should not walk\n";
        return 1;
    }
    const QuebecSway::FPose Moving = QuebecSway::Pose(WalkPeak, QuebecSway::MoveSpeed + 0.01);
    if (!Near(Moving.Roll, QuebecSway::WalkRoll, 1e-6))
    {
        std::cerr << "speed just above the gate should walk\n";
        return 1;
    }
    std::cout << "NORD_SWAY_OK " << Walk.Roll << " " << Idle.Roll << "\n";
    return 0;
}
