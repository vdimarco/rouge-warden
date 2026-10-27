#pragma once

// A footfall while the player is walking. No cooked asset and no Unreal types.
//
// The body rock in QuebecSway plants twice a cycle: the bob is sin(2·phase).
// At a walk that half-cycle is the stride. The rock's rate stops rising once
// the walk lean is full, so a faster pace keeps the same stride length and
// the plants come sooner. A hitch plays at most a few taps and drops the rest,
// so one long frame does not fire a burst on the next tick.
//
// Perry R. Cook, Real Sound Synthesis for Interactive Applications (2002):
// a strike is a short damped burst, not a held tone. This tap sits under the
// impact thud.

#include "QuebecPace.h"
#include "QuebecSway.h"

#include <cmath>
#include <cstdint>

namespace QuebecStep
{
    inline constexpr int SampleRate = 22050;
    inline constexpr int Frames = 1540;
    inline constexpr double Peak = 0.22;
    inline constexpr int MaxStepsPerTick = 4;

    inline double WalkInterval()
    {
        return 3.14159265358979323846 / QuebecSway::WalkOmega;
    }

    inline double StrideCm()
    {
        return QuebecPace::WalkCmPerSecond * WalkInterval();
    }

    inline bool Moving(double Speed)
    {
        return std::isfinite(Speed) && Speed > QuebecSway::MoveSpeed;
    }

    // How many plants fell. TraveledCm keeps the leftover of the current stride.
    inline int Consume(double& TraveledCm, double Speed, double DeltaSeconds)
    {
        if (!Moving(Speed) || !(DeltaSeconds > 0.) || !std::isfinite(DeltaSeconds) || !std::isfinite(TraveledCm))
            return 0;
        TraveledCm += Speed * DeltaSeconds;
        const double Stride = StrideCm();
        if (!(Stride > 0.)) return 0;
        int Steps = 0;
        while (TraveledCm >= Stride && Steps < MaxStepsPerTick)
        {
            TraveledCm -= Stride;
            ++Steps;
        }
        if (TraveledCm >= Stride)
            TraveledCm = std::fmod(TraveledCm, Stride);
        return Steps;
    }

    inline std::uint32_t HashFrame(int Frame, int Foot)
    {
        std::uint32_t Mixed = static_cast<std::uint32_t>(Frame) * 2u;
        Mixed += static_cast<std::uint32_t>(Foot & 1);
        std::uint32_t X = Mixed * 2246822519u + 3266489917u;
        X = (X ^ (X >> 16)) * 0x7feb352du;
        X = (X ^ (X >> 15)) * 0x846ca68bu;
        return X ^ (X >> 16);
    }

    inline double SampleAt(int Frame, int Foot)
    {
        if (Frame < 0 || Frame >= Frames) return 0.;
        const double Time = static_cast<double>(Frame) / static_cast<double>(SampleRate);
        const double Attack = Time < 0.003 ? Time / 0.003 : 1.;
        const double Envelope = Attack * std::exp(-Time * 55.);
        const double Hertz = (Foot & 1) == 0 ? 118. : 164.;
        const double Body = std::sin(6.283185307179586 * Hertz * Time);
        const double Noise = static_cast<double>(HashFrame(Frame, Foot) & 65535u) / 32767.5 - 1.;
        const double Grain = Time < 0.010 ? Noise * (1. - Time / 0.010) : 0.;
        return (Body * 0.22 + Grain * 0.9) * Envelope * Peak;
    }
}
