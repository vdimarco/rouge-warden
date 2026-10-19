#pragma once

// Engine-independent comic knockdown: a ballistic launch, one small bounce, a dazed lie and a 0.8 s stand-up.
// No Unreal includes, so Scripts/test_knock_model.py can build and run it with the system compiler.
// Every peer samples the same pose from a replicated start time, so a knockdown costs a few replicated floats.
// Distances are cm, speeds cm/s, angles degrees. Forward runs along the planar push. Pitch tumbles the body toward
// the push (0 upright, 90 lying with the head along the push) and stays continuous, so whole flips add 360.
// Roll turns the body about the push. Gravity is the engine default, 980 cm/s².

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <utility>

namespace QuebecKnock
{
    enum class EPhase : uint8_t { Airborne, Landing, Lying, StandingUp, Done };
    // Mirrors EQuebecHitKind in QuebecGTA.h.
    enum class EHit : uint8_t { Car, Melee, Bullet };

    inline constexpr float Gravity = 980.f;
    inline constexpr float StandSeconds = .8f;
    // The bounce keeps this share of the landing fall speed, and BounceGrip of the planar speed.
    inline constexpr float Restitution = .3f;
    inline constexpr float BounceGrip = .45f;
    // A short scrub along the ground after the bounce.
    inline constexpr float SlideSeconds = .3f;
    // Standing and lying hip heights above the ground; the tumble pivots about the hips.
    inline constexpr float HipHeight = 95.f;
    inline constexpr float LyingHipHeight = 18.f;
    // Slower car contact shoves or blocks; faster contact knocks a person down.
    inline constexpr float CarKnockSpeed = 450.f;
    // Melee below this damage is a punch. Two punches inside PunchMemorySeconds knock a civilian down.
    inline constexpr float PunchDamageLimit = 20.f;
    inline constexpr float PunchMemorySeconds = 4.f;

    struct FLaunch
    {
        float Forward = 0.f;      // planar launch speed along the push
        float Up = 400.f;         // vertical launch speed
        float Spin = 540.f;       // tumble rate; negative tumbles backward, toward the cause
        float LieSeconds = 1.6f;  // dazed time on the ground after the bounce
        float GroundDelta = 0.f;  // landing ground height minus start ground height
    };

    struct FTimeline
    {
        float Flight = 0.f;       // first arc
        float Bounce = 0.f;       // second, small arc
        float Landed = 0.f;       // bounce and scrub over: lying starts
        float StandStarts = 0.f;
        float Total = 0.f;
        float RestForward = 0.f;  // planar distance where the person stands up
    };

    struct FPose
    {
        EPhase Phase = EPhase::Done;
        float Forward = 0.f;      // planar travel along the push
        float Ground = 0.f;       // ground height under the body, relative to the start
        float Lift = 0.f;         // ballistic height above that ground
        float Hip = HipHeight;    // hip height of the posed body above the ground under it
        float Pitch = 0.f;
        float Roll = 0.f;
        bool bDazed = false;      // stars circle the head
    };

    namespace Detail
    {
        inline constexpr float Pi = 3.14159265f;
        inline float Finite(float Value, float Fallback) { return std::isfinite(Value) ? Value : Fallback; }
        inline float Smooth(float Value)
        {
            const float T = std::clamp(Value, 0.f, 1.f);
            return T * T * (3.f - 2.f * T);
        }
        inline float Turn(float Spin) { return Spin < 0.f ? -1.f : 1.f; }
    }

    // Clamps every input to a finite, playable range; a landing higher than the arc can reach is lowered.
    inline FLaunch Sanitize(FLaunch Launch)
    {
        Launch.Forward = std::clamp(Detail::Finite(Launch.Forward, 0.f), 0.f, 3000.f);
        Launch.Up = std::clamp(Detail::Finite(Launch.Up, 400.f), 100.f, 2000.f);
        Launch.Spin = std::clamp(Detail::Finite(Launch.Spin, 540.f), -1440.f, 1440.f);
        Launch.LieSeconds = std::clamp(Detail::Finite(Launch.LieSeconds, 1.6f), 0.f, 100000.f);
        const float Highest = .8f * Launch.Up * Launch.Up / (2.f * Gravity);
        Launch.GroundDelta = std::clamp(Detail::Finite(Launch.GroundDelta, 0.f), -300.f, Highest);
        return Launch;
    }

    inline FTimeline Timeline(const FLaunch& Input)
    {
        const FLaunch Launch = Sanitize(Input);
        FTimeline Result;
        // Land exactly on the destination ground: Up t - g t^2 / 2 = GroundDelta, the later root.
        const float Discriminant = std::max(0.f, Launch.Up * Launch.Up - 2.f * Gravity * Launch.GroundDelta);
        Result.Flight = (Launch.Up + std::sqrt(Discriminant)) / Gravity;
        const float Fall = Gravity * Result.Flight - Launch.Up;
        Result.Bounce = 2.f * Restitution * Fall / Gravity;
        Result.Landed = Result.Flight + Result.Bounce + SlideSeconds;
        Result.StandStarts = Result.Landed + Launch.LieSeconds;
        Result.Total = Result.StandStarts + StandSeconds;
        const float BounceSpeed = Launch.Forward * BounceGrip;
        Result.RestForward = Launch.Forward * Result.Flight + BounceSpeed * Result.Bounce + .25f * BounceSpeed * SlideSeconds;
        return Result;
    }

    inline FPose Sample(const FLaunch& Input, float Time)
    {
        const FLaunch Launch = Sanitize(Input);
        const FTimeline Line = Timeline(Launch);
        const float T = std::max(0.f, Detail::Finite(Time, 0.f));
        const float Turn = Detail::Turn(Launch.Spin);
        // Whole flips during the flight, so the body lands flat on its back.
        const float Flips = std::max(0.f, std::round((std::fabs(Launch.Spin) * Line.Flight - 90.f) / 360.f));
        const float Lying = Turn * (90.f + 360.f * Flips);
        const float BounceSpeed = Launch.Forward * BounceGrip;
        FPose Pose;
        Pose.Ground = Launch.GroundDelta;
        Pose.Hip = LyingHipHeight;
        Pose.Pitch = Lying;
        if (T < Line.Flight)
        {
            const float S = T / Line.Flight;
            Pose.Phase = EPhase::Airborne;
            Pose.Forward = Launch.Forward * T;
            Pose.Ground = Launch.GroundDelta * S;
            Pose.Lift = std::max(0.f, Launch.Up * T - .5f * Gravity * T * T - Pose.Ground);
            Pose.Hip = HipHeight + (LyingHipHeight - HipHeight) * Detail::Smooth(S);
            Pose.Pitch = Lying * S;
            Pose.Roll = 20.f * Turn * std::sin(Detail::Pi * S);
            return Pose;
        }
        Pose.Forward = Launch.Forward * Line.Flight;
        Pose.bDazed = true;
        if (T < Line.Landed)
        {
            const float U = T - Line.Flight;
            Pose.Phase = EPhase::Landing;
            if (U < Line.Bounce)
            {
                const float Rise = .5f * Gravity * Line.Bounce;
                Pose.Forward += BounceSpeed * U;
                Pose.Lift = std::max(0.f, Rise * U - .5f * Gravity * U * U);
                Pose.Pitch = Lying - Turn * 12.f * std::sin(Detail::Pi * U / Line.Bounce);
            }
            else
            {
                // Scrub from half the bounce speed to rest, decelerating evenly.
                const float V = U - Line.Bounce, Start = .5f * BounceSpeed;
                Pose.Forward += BounceSpeed * Line.Bounce + Start * (V - V * V / (2.f * SlideSeconds));
            }
            return Pose;
        }
        Pose.Forward = Line.RestForward;
        if (T < Line.StandStarts)
        {
            const float U = T - Line.Landed;
            Pose.Phase = EPhase::Lying;
            // A dazed sway that starts and ends flat.
            Pose.Roll = 6.f * std::sin(3.f * Detail::Pi * U) * std::sin(Detail::Pi * std::min(1.f, U / std::max(Launch.LieSeconds, .01f)));
            return Pose;
        }
        if (T < Line.Total)
        {
            const float S = Detail::Smooth((T - Line.StandStarts) / StandSeconds);
            Pose.Phase = EPhase::StandingUp;
            Pose.Hip = LyingHipHeight + (HipHeight - LyingHipHeight) * S;
            Pose.Pitch = Lying - Turn * 90.f * S;
            return Pose;
        }
        Pose.Phase = EPhase::Done;
        Pose.Hip = HipHeight;
        Pose.Pitch = Lying - Turn * 90.f;
        Pose.bDazed = false;
        return Pose;
    }

    // The lie that makes the stand-up start at Elapsed: ends an open-ended K.-O. lie now, or right after landing.
    inline float LieToStandAt(const FLaunch& Launch, float Elapsed)
    {
        FLaunch NoLie = Launch;
        NoLie.LieSeconds = 0.f;
        return std::max(0.f, Detail::Finite(Elapsed, 0.f) - Timeline(NoLie).Landed);
    }

    // Tumble rate for a planar launch speed, so peers that know only the replicated push agree on it.
    inline float SpinFor(float Forward)
    {
        return std::clamp(240.f + 1.1f * std::max(0.f, Detail::Finite(Forward, 0.f)), 420.f, 900.f);
    }

    // A car strike: the person flies along the car's travel, farther and higher for a faster car.
    inline FLaunch CarLaunch(float ImpactSpeed)
    {
        const float Impact = std::max(0.f, Detail::Finite(ImpactSpeed, 0.f));
        FLaunch Launch;
        Launch.Forward = std::clamp(.35f * Impact, 220.f, 600.f);
        Launch.Up = std::clamp(260.f + .1f * Impact, 330.f, 500.f);
        Launch.Spin = SpinFor(Launch.Forward);
        Launch.LieSeconds = 1.6f;
        return Launch;
    }

    // A punch, a swing or a shot: a short hop along the hit, and a longer lie for a heavier hit.
    inline FLaunch HitLaunch(float Damage)
    {
        const float Hit = std::clamp(Detail::Finite(Damage, 0.f), 0.f, 100.f);
        FLaunch Launch;
        Launch.Forward = 160.f + 5.f * Hit;
        Launch.Up = 300.f + 2.f * Hit;
        Launch.Spin = SpinFor(Launch.Forward);
        Launch.LieSeconds = 1.4f + .02f * Hit;
        return Launch;
    }

    // Car contact in the car's frame: does a point moving from (FromX, FromY) to (ToX, ToY) relative to the car pass
    // through the box with half extents HalfX, HalfY (already grown by the person's radius)? A slab test on the whole
    // segment, so a fast step never tunnels past a thin person.
    inline bool SweptBoxHit(float FromX, float FromY, float ToX, float ToY, float HalfX, float HalfY)
    {
        if (!std::isfinite(FromX) || !std::isfinite(FromY) || !std::isfinite(ToX) || !std::isfinite(ToY)) return false;
        float Enter = 0.f, Leave = 1.f;
        const float Starts[2] = {FromX, FromY}, Moves[2] = {ToX - FromX, ToY - FromY}, Halves[2] = {HalfX, HalfY};
        for (int Axis = 0; Axis < 2; ++Axis)
        {
            if (std::fabs(Moves[Axis]) < 1e-6f)
            {
                if (std::fabs(Starts[Axis]) > Halves[Axis]) return false;
                continue;
            }
            float Near = (-Halves[Axis] - Starts[Axis]) / Moves[Axis], Far = (Halves[Axis] - Starts[Axis]) / Moves[Axis];
            if (Near > Far) std::swap(Near, Far);
            Enter = std::max(Enter, Near);
            Leave = std::min(Leave, Far);
            if (Enter > Leave) return false;
        }
        return true;
    }

    // What a person does when a fast car comes at them. Someone inside the car's body path (its half width, a person's
    // radius and a small margin) freezes and braces, so an aimed hit lands; only people beside the path dive away from it.
    // Beyond WarnHalfWidth the car is no threat. Lateral is the person's signed distance from the car's centre line.
    enum class ECarReaction : uint8_t { None, Flinch, Dive };
    inline constexpr float InPathHalfWidth = 90.f + 35.f + 20.f;
    inline constexpr float WarnHalfWidth = 260.f;
    inline ECarReaction CarReaction(float Lateral)
    {
        const float Offset = std::fabs(Detail::Finite(Lateral, WarnHalfWidth + 1.f));
        return Offset <= InPathHalfWidth ? ECarReaction::Flinch : Offset <= WarnHalfWidth ? ECarReaction::Dive : ECarReaction::None;
    }

    // Civilians: a car above CarKnockSpeed, any weapon (a shot or a swing), or a second punch knocks them down.
    // Strength is the car speed for EHit::Car and the damage otherwise; RecentPunches counts earlier punches still remembered.
    inline bool CivilianGoesDown(EHit Kind, float Strength, int RecentPunches)
    {
        const float Value = Detail::Finite(Strength, 0.f);
        switch (Kind)
        {
        case EHit::Car: return Value > CarKnockSpeed;
        case EHit::Bullet: return true;
        case EHit::Melee: return Value >= PunchDamageLimit || RecentPunches >= 1;
        }
        return false;
    }
}
