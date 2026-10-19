// Standalone test for Source/Quebec/QuebecKnockModel.h. Built and run by Scripts/test_knock_model.py.
// With QUEBEC_KNOCK_STRICT the Unreal macro names are poisoned before the header is read, so the
// header cannot use them. Pass --table to print the pose over time for a 1500 cm/s car strike.

#ifdef QUEBEC_KNOCK_STRICT
#include <algorithm>
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG
#endif
#include "../Source/Quebec/QuebecKnockModel.h"

#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <limits>

using namespace QuebecKnock;

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition)
        {
            return;
        }
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    template <typename Left, typename Right>
    bool Near(Left A, Right B, double Tolerance)
    {
        return std::fabs(static_cast<double>(A) - static_cast<double>(B)) <= Tolerance;
    }

    // Distance between two angles on the circle, in degrees.
    template <typename Left>
    double AngleGap(Left A, double B)
    {
        const double Gap = std::fmod(std::fabs(static_cast<double>(A) - B), 360.0);
        return std::min(Gap, 360.0 - Gap);
    }

    const char* Name(EPhase Phase)
    {
        switch (Phase)
        {
        case EPhase::Airborne: return "airborne";
        case EPhase::Landing: return "landing";
        case EPhase::Lying: return "lying";
        case EPhase::StandingUp: return "standing-up";
        case EPhase::Done: return "done";
        }
        return "?";
    }

    bool Finite(const FPose& Pose)
    {
        return std::isfinite(Pose.Forward) && std::isfinite(Pose.Ground) && std::isfinite(Pose.Lift) && std::isfinite(Pose.Hip) &&
            std::isfinite(Pose.Pitch) && std::isfinite(Pose.Roll);
    }

    // Walks a launch in 1 ms steps: phases only move forward, nothing jumps at a seam, and exactly one bounce follows the landing.
    void CheckContinuity(const char* Label, const FLaunch& Launch)
    {
        const FLaunch Clean = Sanitize(Launch);
        const FTimeline Line = Timeline(Clean);
        const float Step = .001f;
        FPose Previous = Sample(Clean, 0.f);
        int Apexes = 0, LandingApexes = 0;
        float PreviousRise = 0.f;
        const int Steps = static_cast<int>((Line.Total + .5f) / Step);
        for (int I = 1; I <= Steps; ++I)
        {
            const float Time = static_cast<float>(I) * Step;
            const FPose Pose = Sample(Clean, Time);
            Expect(Finite(Pose), "%s: finite pose at %.3f s", Label, static_cast<double>(Time));
            Expect(static_cast<int>(Pose.Phase) >= static_cast<int>(Previous.Phase), "%s: phase never goes back at %.3f s (%s after %s)",
                Label, static_cast<double>(Time), Name(Pose.Phase), Name(Previous.Phase));
            const double Planar = static_cast<double>(Clean.Forward) * static_cast<double>(Step) * 1.01 + .01;
            Expect(std::fabs(static_cast<double>(Pose.Forward - Previous.Forward)) <= Planar, "%s: forward continuous at %.3f s (%.3f -> %.3f)",
                Label, static_cast<double>(Time), static_cast<double>(Previous.Forward), static_cast<double>(Pose.Forward));
            Expect(Pose.Forward + .001f >= Previous.Forward, "%s: never slides back toward the cause at %.3f s", Label, static_cast<double>(Time));
            const double Fastest = std::sqrt(static_cast<double>(Clean.Up * Clean.Up) + 2.0 * 980.0 * std::max(0.0, -static_cast<double>(Clean.GroundDelta)));
            const double Vertical = (Fastest + 10.0) * static_cast<double>(Step) + .05;
            Expect(std::fabs(static_cast<double>((Pose.Lift + Pose.Ground) - (Previous.Lift + Previous.Ground))) <= Vertical,
                "%s: height continuous at %.3f s", Label, static_cast<double>(Time));
            Expect(std::fabs(static_cast<double>(Pose.Hip - Previous.Hip)) <= 1.0, "%s: hip continuous at %.3f s", Label, static_cast<double>(Time));
            const double Turn = std::fabs(static_cast<double>(Clean.Spin)) * static_cast<double>(Step) * 3.0 + 1.0;
            Expect(std::fabs(static_cast<double>(Pose.Pitch - Previous.Pitch)) <= Turn, "%s: pitch continuous at %.3f s (%.2f -> %.2f)",
                Label, static_cast<double>(Time), static_cast<double>(Previous.Pitch), static_cast<double>(Pose.Pitch));
            Expect(std::fabs(static_cast<double>(Pose.Roll - Previous.Roll)) <= 1.0, "%s: roll continuous at %.3f s", Label, static_cast<double>(Time));
            Expect(Pose.Lift >= 0.f, "%s: never below the ground at %.3f s", Label, static_cast<double>(Time));
            const float Rise = Pose.Lift - Previous.Lift;
            if (PreviousRise > 0.f && Rise <= 0.f)
            {
                ++Apexes;
                if (Pose.Phase == EPhase::Landing)
                {
                    ++LandingApexes;
                }
            }
            PreviousRise = Rise;
            Previous = Pose;
        }
        Expect(Apexes == 2 && LandingApexes == 1, "%s: one arc and exactly one bounce (apexes %d, bounce apexes %d)", Label, Apexes, LandingApexes);
    }
}

int main(int ArgumentCount, char** Arguments)
{
    const FLaunch Car = CarLaunch(1500.f);
    const FTimeline Line = Timeline(Car);
    if (ArgumentCount > 1 && std::strcmp(Arguments[1], "--table") == 0)
    {
        std::printf("time_s phase forward_cm ground_cm lift_cm hip_cm pitch_deg roll_deg dazed\n");
        for (int I = 0; static_cast<float>(I) * .1f <= Line.Total + .2f; ++I)
        {
            const float Time = static_cast<float>(I) * .1f;
            const FPose Pose = Sample(Car, Time);
            std::printf("%.1f %s %.1f %.1f %.1f %.1f %.1f %.1f %d\n", static_cast<double>(Time), Name(Pose.Phase), static_cast<double>(Pose.Forward),
                static_cast<double>(Pose.Ground), static_cast<double>(Pose.Lift), static_cast<double>(Pose.Hip), static_cast<double>(Pose.Pitch),
                static_cast<double>(Pose.Roll), Pose.bDazed ? 1 : 0);
        }
        return 0;
    }

    // Ballistic arc with gravity 980 cm/s^2.
    Expect(Near(Line.Flight, 2.0 * static_cast<double>(Car.Up) / 980.0, 1e-4), "flat flight time is 2 Up / g (%.4f)", static_cast<double>(Line.Flight));
    const FPose Apex = Sample(Car, Line.Flight * .5f);
    Expect(Near(Apex.Lift, static_cast<double>(Car.Up * Car.Up) / (2.0 * 980.0), .5), "apex height is Up^2 / 2g (%.2f)", static_cast<double>(Apex.Lift));
    Expect(Apex.Phase == EPhase::Airborne && !Apex.bDazed, "the apex is airborne and not yet dazed");
    Expect(Near(Sample(Car, Line.Flight * .25f).Forward, static_cast<double>(Car.Forward * Line.Flight) * .25, .01), "planar flight keeps the launch speed");

    // One small bounce, then a scrub, a lie and a 0.8 s stand-up.
    Expect(Near(Line.Bounce, 2.0 * .3 * static_cast<double>(Car.Up) / 980.0, 1e-4), "the bounce keeps 30 percent of the fall speed");
    const FPose Bounce = Sample(Car, Line.Flight + Line.Bounce * .5f);
    Expect(Bounce.Phase == EPhase::Landing && Bounce.Lift > 1.f && Bounce.Lift < Apex.Lift * .1f, "the bounce is small (%.2f cm)", static_cast<double>(Bounce.Lift));
    Expect(Near(Line.Total - Line.StandStarts, 0.8, 1e-5), "standing up takes 0.8 s");
    Expect(Near(Line.StandStarts - Line.Landed, static_cast<double>(Car.LieSeconds), 1e-5), "the person lies for LieSeconds");
    const FPose Lying = Sample(Car, (Line.Landed + Line.StandStarts) * .5f);
    Expect(Lying.Phase == EPhase::Lying && Lying.bDazed, "lying is dazed");
    Expect(AngleGap(Lying.Pitch, 90.0) < 1e-3, "lies flat with the head along the push (%.2f)", static_cast<double>(Lying.Pitch));
    Expect(Near(Lying.Hip, LyingHipHeight, 1e-4) && Near(Lying.Lift, 0.0, 1e-4), "lying hips rest on the ground");
    Expect(std::fabs(Lying.Roll) <= 6.f, "the dazed sway stays small");
    const FPose Rising = Sample(Car, Line.StandStarts + .4f);
    Expect(Rising.Phase == EPhase::StandingUp && Rising.bDazed && Rising.Hip > LyingHipHeight && Rising.Hip < HipHeight, "standing up raises the hips");
    const FPose Done = Sample(Car, Line.Total + .01f);
    Expect(Done.Phase == EPhase::Done && !Done.bDazed, "the knockdown ends");
    Expect(AngleGap(Done.Pitch, 0.0) < 1e-3 && Near(Done.Hip, HipHeight, 1e-4) && Done.Roll == 0.f, "ends upright");
    Expect(Near(Done.Forward, Line.RestForward, 1e-3), "stands up at the rest distance (%.1f cm)", static_cast<double>(Done.Forward));
    Expect(Sample(Car, 1000.f).Phase == EPhase::Done, "long after, still done");
    Expect(Sample(Car, -5.f).Phase == EPhase::Airborne && Sample(Car, -5.f).Forward == 0.f, "a time before the knock is the launch pose");

    // Phases in order at their seams.
    Expect(Sample(Car, Line.Flight - .001f).Phase == EPhase::Airborne && Sample(Car, Line.Flight + .001f).Phase == EPhase::Landing, "airborne then landing");
    Expect(Sample(Car, Line.Landed - .001f).Phase == EPhase::Landing && Sample(Car, Line.Landed + .001f).Phase == EPhase::Lying, "landing then lying");
    Expect(Sample(Car, Line.StandStarts - .001f).Phase == EPhase::Lying && Sample(Car, Line.StandStarts + .001f).Phase == EPhase::StandingUp, "lying then standing up");
    Expect(Sample(Car, Line.Total - .001f).Phase == EPhase::StandingUp && Sample(Car, Line.Total + .001f).Phase == EPhase::Done, "standing up then done");

    CheckContinuity("car 1500", Car);
    CheckContinuity("car 450", CarLaunch(450.f));
    CheckContinuity("car 3000", CarLaunch(3000.f));
    CheckContinuity("punch", HitLaunch(12.f));
    CheckContinuity("shotgun", HitLaunch(60.f));
    FLaunch Backward = Car;
    Backward.Spin = -600.f;
    CheckContinuity("backward", Backward);
    Expect(AngleGap(Sample(Backward, (Timeline(Backward).Landed + Timeline(Backward).StandStarts) * .5f).Pitch, -90.0) < 1e-3, "a backward tumble lies head toward the cause");
    FLaunch Uphill = Car;
    Uphill.GroundDelta = 25.f;
    CheckContinuity("uphill", Uphill);
    FLaunch Downhill = Car;
    Downhill.GroundDelta = -60.f;
    CheckContinuity("downhill", Downhill);

    // Landing on a different ground height.
    const FTimeline UpLine = Timeline(Uphill);
    const FPose Landed = Sample(Uphill, UpLine.Flight);
    Expect(Near(Landed.Ground, 25.0, 1e-4) && Near(Landed.Lift, 0.0, .01), "lands on a higher curb exactly");
    Expect(UpLine.Flight < Line.Flight && Timeline(Downhill).Flight > Line.Flight, "higher ground lands sooner, lower ground later");
    FLaunch Roof = Car;
    Roof.GroundDelta = 5000.f;
    const FLaunch CleanRoof = Sanitize(Roof);
    Expect(CleanRoof.GroundDelta < static_cast<float>(static_cast<double>(Car.Up * Car.Up) / (2.0 * 980.0)), "unreachable ground is lowered to what the arc reaches");
    Expect(std::isfinite(Timeline(Roof).Total), "unreachable ground still lands");

    // Non-finite input never produces a non-finite pose.
    const float NaN = std::numeric_limits<float>::quiet_NaN(), Infinity = std::numeric_limits<float>::infinity();
    FLaunch Broken;
    Broken.Forward = NaN;
    Broken.Up = Infinity;
    Broken.Spin = -Infinity;
    Broken.LieSeconds = NaN;
    Broken.GroundDelta = NaN;
    for (float Time : {0.f, .3f, 1.f, 2.f, 5.f, NaN, Infinity})
    {
        Expect(Finite(Sample(Broken, Time)), "non-finite input stays finite at %f", static_cast<double>(Time));
    }
    Expect(std::isfinite(Timeline(Broken).Total), "non-finite input has a finite timeline");

    // K.-O.: an open-ended lie ends when asked, with the 0.8 s stand-up after it.
    FLaunch KnockOut = Car;
    KnockOut.LieSeconds = 100000.f;
    Expect(Sample(KnockOut, 60.f).Phase == EPhase::Lying, "a K.-O. stays down");
    KnockOut.LieSeconds = LieToStandAt(KnockOut, 60.f);
    Expect(Sample(KnockOut, 60.001f).Phase == EPhase::StandingUp && Sample(KnockOut, 60.81f).Phase == EPhase::Done, "standing up starts when the K.-O. ends");
    KnockOut.LieSeconds = LieToStandAt(KnockOut, .2f);
    Expect(KnockOut.LieSeconds == 0.f && Sample(KnockOut, Timeline(KnockOut).Landed + .01f).Phase == EPhase::StandingUp,
        "ending a K.-O. mid-air stands up right after landing");

    // Launch rules.
    Expect(CarLaunch(600.f).Forward < CarLaunch(1500.f).Forward && CarLaunch(1500.f).Forward <= CarLaunch(4000.f).Forward, "a faster car throws farther");
    Expect(Timeline(CarLaunch(3000.f)).RestForward < 800.f, "even a top-speed strike stays inside a street (%.0f cm)", static_cast<double>(Timeline(CarLaunch(3000.f)).RestForward));
    Expect(Timeline(HitLaunch(12.f)).RestForward < Timeline(HitLaunch(60.f)).RestForward, "a heavier hit throws farther");
    Expect(!CivilianGoesDown(EHit::Car, 450.f, 0) && CivilianGoesDown(EHit::Car, 451.f, 0), "a car above 450 cm/s knocks a civilian down");
    Expect(CivilianGoesDown(EHit::Bullet, 1.f, 0), "any shot knocks a civilian down");
    Expect(CivilianGoesDown(EHit::Melee, 30.f, 0), "a hockey stick knocks a civilian down");
    Expect(!CivilianGoesDown(EHit::Melee, 12.f, 0) && CivilianGoesDown(EHit::Melee, 12.f, 1), "the second punch knocks a civilian down");
    Expect(!CivilianGoesDown(EHit::Car, NaN, 0), "a broken speed does not knock down");

    std::printf("car 1500 cm/s: flight %.3f s, bounce %.3f s, lying %.3f-%.3f s, done %.3f s, rest %.0f cm\n", static_cast<double>(Line.Flight),
        static_cast<double>(Line.Bounce), static_cast<double>(Line.Landed), static_cast<double>(Line.StandStarts), static_cast<double>(Line.Total),
        static_cast<double>(Line.RestForward));
    if (Failures)
    {
        std::printf("%d of %d knock model checks failed\n", Failures, Assertions);
        return 1;
    }
    std::printf("NORD_KNOCK_MODEL %d checks passed\n", Assertions);
    return 0;
}
