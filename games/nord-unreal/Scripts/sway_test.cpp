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
    const double WalkPeak = 3.14159265358979323846 * 0.5;
    const QuebecSway::FPose Walk = QuebecSway::Pose(WalkPeak, QuebecSway::WalkSpeed);
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
    const QuebecSway::FPose Idle = QuebecSway::Pose(WalkPeak, 0.);
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
    if (!Near(Gate.Roll, Still.Roll, 1e-6) || !Near(QuebecSway::OmegaFor(QuebecSway::MoveSpeed), QuebecSway::IdleOmega, 1e-6))
    {
        std::cerr << "speed at the idle gate should not walk\n";
        return 1;
    }
    const double JustOver = QuebecSway::MoveSpeed + 0.01;
    const QuebecSway::FPose Nudge = QuebecSway::Pose(WalkPeak, JustOver);
    if (!(Nudge.Roll < Idle.Roll + 0.05))
    {
        std::cerr << "crossing the gate snapped the lean to " << Nudge.Roll << "\n";
        return 1;
    }
    const double Held = 1.25;
    if (!Near(QuebecSway::Advance(Held, 0., 0.), Held, 1e-9) || !Near(QuebecSway::Advance(Held, 0., QuebecSway::WalkSpeed), Held, 1e-9))
    {
        std::cerr << "a speed change with no time must not jump the phase\n";
        return 1;
    }
    const double IdleStep = QuebecSway::Advance(Held, 0.05, 0.);
    const double WalkStep = QuebecSway::Advance(Held, 0.05, QuebecSway::WalkSpeed);
    if (!(WalkStep > IdleStep && WalkStep - IdleStep < 0.05 * (QuebecSway::WalkOmega - QuebecSway::IdleOmega) + 1e-6))
    {
        std::cerr << "one tick should only advance by omega, idle " << IdleStep << " walk " << WalkStep << "\n";
        return 1;
    }
    std::cout << "NORD_SWAY_OK " << Walk.Roll << " " << Idle.Roll << "\n";
    return 0;
}
