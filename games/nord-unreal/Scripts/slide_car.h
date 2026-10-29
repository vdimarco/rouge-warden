#pragma once

// The player car of QuebecGameplay.cpp, stepped without Unreal. Shared by the slide tests.
// A phase is a held input: seconds, handbrake, steer and gas.

#include "../Source/Quebec/QuebecSlide.h"
#include "../Source/Quebec/QuebecSteerAssist.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace SlideCar
{
    struct FSample
    {
        float Time = 0.f;
        float Speed = 0.f;
        float Lateral = 0.f;
        int Pays = 0;
        bool bBrake = false;
    };

    struct FCar
    {
        float Speed = 0.f;
        float Lateral = 0.f;
        float Yaw = 0.f;
        float SteeringState = 0.f;
        float DriveThrottle = 0.f;
        float PeakLateral = 0.f;
        QuebecSlide::FState Slide;

        // One substep of the player car in QuebecGameplay.cpp: pedal slew, the handbrake brake,
        // the bicycle yaw, the momentum split and the grip. No collision and no road assist.
        void Advance(float Dt, bool bBrake, float Steer, bool bGas)
        {
            const float Throttle = bGas ? 1.f : 0.f;
            DriveThrottle = QuebecSteer::MoveToward(DriveThrottle, Throttle, Dt, QuebecSteer::ThrottleRate);
            SteeringState = QuebecSteer::MoveToward(SteeringState, Steer, Dt,
                QuebecSteer::TurnInRate(Speed, Steer, SteeringState, false));
            if (bBrake)
                Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 2300.f);
            else if (Throttle * Speed < 0.f)
                Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 3200.f * std::fabs(Throttle));
            else if (std::fabs(Throttle) > .01f)
            {
                const float Corner = QuebecSteer::Lerp(2400.f, 900.f,
                    QuebecSteer::Clamp((std::fabs(SteeringState) - .2f) / .8f, 0.f, 1.f));
                if (Throttle > 0.f && std::fabs(SteeringState) > .2f && Speed > Corner)
                    Speed = QuebecSteer::MoveToward(Speed, Corner, Dt, 1200.f);
                else
                {
                    const float Power = QuebecSteer::Lerp(1050.f, 700.f,
                        QuebecSteer::Clamp(std::fabs(Speed) / 3000.f, 0.f, 1.f));
                    const float Requested = std::max(0.f, DriveThrottle * (Throttle > 0.f ? 1.f : -1.f)) * (Throttle > 0.f ? 1.f : -1.f);
                    Speed += Requested * Power * Dt;
                    Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 100.f + Speed * Speed * .000035f);
                }
            }
            else Speed = QuebecSteer::MoveToward(Speed, 0.f, Dt, 360.f + Speed * Speed * .000035f);
            Speed = QuebecSteer::Clamp(Speed, -950.f, 3000.f);

            const float YawRad = Yaw * (QuebecSteer::Pi / 180.f);
            const float ForwardX = std::cos(YawRad);
            const float ForwardY = std::sin(YawRad);
            const float RightX = -std::sin(YawRad);
            const float RightY = std::cos(YawRad);
            const float MomentumX = ForwardX * Speed + RightX * Lateral;
            const float MomentumY = ForwardY * Speed + RightY * Lateral;
            if (std::fabs(Speed) > 15.f)
                Yaw += QuebecSteer::YawRateFor(Speed, SteeringState, bBrake) * Dt;
            const float Yaw2 = Yaw * (QuebecSteer::Pi / 180.f);
            const float Forward2X = std::cos(Yaw2);
            const float Forward2Y = std::sin(Yaw2);
            const float Right2X = -std::sin(Yaw2);
            const float Right2Y = std::cos(Yaw2);
            Speed = MomentumX * Forward2X + MomentumY * Forward2Y;
            Lateral = MomentumX * Right2X + MomentumY * Right2Y;
            const float Grip = bBrake ? 1.15f : 8.f;
            Lateral += (0.f - Lateral) * QuebecSteer::Clamp(Dt * Grip, 0.f, 1.f);
            const float Cap = std::fabs(Speed) * .7f + 80.f;
            Lateral = QuebecSteer::Clamp(Lateral, -Cap, Cap);
            if (std::fabs(Speed) < 100.f)
                Lateral = QuebecSteer::MoveToward(Lateral, 0.f, Dt, 3600.f);
            PeakLateral = std::max(PeakLateral, std::fabs(Lateral));
            Slide.Tick(Dt, Speed, Lateral, bBrake, false);
        }
    };

    struct FPhase
    {
        float Seconds;
        bool bBrake;
        float Steer;
        bool bGas;
    };

    inline FCar Play(const FPhase* Phases, int Count, std::vector<FSample>* Trace)
    {
        FCar Car;
        float Time = 0.f;
        const float Dt = 1.f / 60.f;
        for (int Phase = 0; Phase < Count; ++Phase)
        {
            const int Steps = static_cast<int>(std::lround(Phases[Phase].Seconds / Dt));
            for (int Step = 0; Step < Steps; ++Step)
            {
                Car.Advance(Dt, Phases[Phase].bBrake, Phases[Phase].Steer, Phases[Phase].bGas);
                Time += Dt;
                if (Trace) Trace->push_back({Time, Car.Speed, Car.Lateral, Car.Slide.Pays, Phases[Phase].bBrake});
            }
        }
        return Car;
    }
}
