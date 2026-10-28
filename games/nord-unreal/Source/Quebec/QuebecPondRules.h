#pragma once

// Engine-independent rules for mission 3, Still Life, Moving Target.
// No Unreal includes, so Scripts/test_pond_rules.py can build this with the system compiler.
// Positions are game-frame centimetres (X east, Y north), north of the surveyed west pond.
// PondStep is stored on the version-3 tail. A version-1 slot still stores CompletedMissions 0–2 and starts this beat over.
// Display text lives in QuebecCampaign.cpp.

#include <cmath>
#include <cstdint>

namespace QuebecPondRules
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    // Shore, tag the steady beam, near lock, far lock, sprint the opened path, pull, banked.
    inline constexpr int StepShore = 0;
    inline constexpr int StepTag = 1;
    inline constexpr int StepNear = 2;
    inline constexpr int StepFar = 3;
    inline constexpr int StepDash = 4;
    inline constexpr int StepPull = 5;
    inline constexpr int StepBanked = 6;

    // Authored on the north shore. The surveyed west-pond outer ring peaks at y 10911.6,
    // and the east pond stays south of y 8920, so every point here is on land.
    inline constexpr FSpot ShoreLookout = {-7600., 11400., 0.};
    inline constexpr int BeamCount = 3;
    inline constexpr int FalseBeam = 1;
    inline constexpr FSpot Beams[BeamCount] = {
        {-9800., 12200., 0.},
        {-7600., 12600., 0.},
        {-5400., 12200., 0.}
    };
    inline constexpr FSpot NearLock = {-7600., 14800., 0.};
    inline constexpr FSpot FarLock = {-4200., 13600., 0.};
    inline constexpr FSpot DashEnd = {-2500., 12400., 0.};
    inline constexpr FSpot Picnic = {-1800., 11600., 0.};

    inline constexpr double Reach = 280.;
    inline constexpr double BlinkPeriod = 2.4;
    inline constexpr double BlinkOn = 1.2;
    // Walk is 450 cm/s and sprint is 800. The dash only counts at a run.
    inline constexpr double SprintSpeed = 650.;
    // The opened path has to be a path. Standing on the finish does not arm it.
    inline constexpr double DashWasFar = 450.;
    // North of the step, on land, and outside Reach, so Recover does not complete the step.
    // The pond is to the south, so the offset does not drop the player in the water.
    inline constexpr double RecoverNorth = 700.;

    inline constexpr int PartCount = 8;
    inline constexpr int PartPicnic = 7;

    enum class EAct : uint8_t { Arrive, Tag, Use, SprintIn };

    inline double SpotDistance(const FSpot& A, const FSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    // The false postcard beam stays lit. The other two blink together, so the steady one is identifiable.
    inline bool BeamLit(int Beam, double Time)
    {
        if (Beam == FalseBeam) return true;
        if (Beam < 0 || Beam >= BeamCount) return false;
        double Wrapped = std::fmod(Time, BlinkPeriod);
        if (Wrapped < 0.) Wrapped += BlinkPeriod;
        return Wrapped < BlinkOn;
    }

    inline int Apply(int Step, EAct Action, int Beam, bool bSprint)
    {
        if (Step == StepShore && Action == EAct::Arrive) return StepTag;
        if (Step == StepTag && Action == EAct::Tag && Beam == FalseBeam) return StepNear;
        if (Step == StepNear && Action == EAct::Use) return StepFar;
        if (Step == StepFar && Action == EAct::Use) return StepDash;
        if (Step == StepDash && Action == EAct::SprintIn && bSprint) return StepPull;
        if (Step == StepPull && Action == EAct::Use) return StepBanked;
        return Step;
    }

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepShore: return ShoreLookout;
        case StepTag: return Beams[FalseBeam];
        case StepNear: return NearLock;
        case StepFar: return FarLock;
        case StepDash: return DashEnd;
        case StepPull: return Picnic;
        default: return Picnic;
        }
    }

    inline FSpot RecoverAt(int Step)
    {
        const FSpot Spot = Objective(Step);
        return {Spot.X, Spot.Y + RecoverNorth, Spot.Z};
    }

    // Latch this when a dash sample was farther than DashWasFar. The finish then counts on the
    // tick that enters the reach ring while sprinting. A 450 cm gate cannot close in one 50 ms
    // tick at sprint speed, so the latch is what makes the path readable at the campaign tick.
    inline void NoteDash(bool& bWasFar, double Distance)
    {
        if (Distance > DashWasFar) bWasFar = true;
    }

    inline bool SprintCross(bool bWasFar, double PreviousDistance, double Distance, double Speed)
    {
        return bWasFar && PreviousDistance > Reach && Distance <= Reach && Speed >= SprintSpeed;
    }

    inline bool OffersPond(bool bCampaignComplete, int Step)
    {
        return bCampaignComplete && Step >= StepShore && Step < StepBanked;
    }

    inline bool GuidesSideJobs(bool bCampaignComplete, int Step)
    {
        return bCampaignComplete && Step >= StepBanked;
    }

    // World posts: 0 shore, 1–3 beams, 4 near lock, 5 far lock, 6 dash post, 7 picnic.
    // After the picnic is banked only the picnic stays. Callers hide every post until the story
    // phase is complete, so mission 1 and 2 never show this shore.
    inline bool PartVisible(int Step, int Part, double Time)
    {
        if (Part < 0 || Part >= PartCount) return false;
        if (Step >= StepBanked) return Part == PartPicnic;
        if (Part == 0) return Step == StepShore;
        if (Part >= 1 && Part <= BeamCount) return Step == StepTag && BeamLit(Part - 1, Time);
        if (Part == 4) return Step == StepNear;
        if (Part == 5) return Step == StepFar;
        if (Part == 6) return Step == StepDash;
        if (Part == PartPicnic) return Step == StepPull;
        return false;
    }

    // Stay on the postcard. The decoys blink, and this beam does not. Leaving for more than a second drops it.
    inline constexpr int TagHoldSeconds = 4;
    inline constexpr double TagGraceSeconds = 1.;

    struct FTagHold
    {
        double Inside = 0.;
        double Outside = 0.;
        bool bDone = false;
        bool bDropped = false;
    };

    inline bool TagInside(int Beam)
    {
        return Beam == FalseBeam;
    }

    // The clock runs only on the postcard. A blinking beam is not an inside sample.
    inline FTagHold AdvanceTag(double Inside, double Outside, bool bInside, double Dt)
    {
        FTagHold Out;
        if (!(Dt > 0.)) Dt = 0.;
        if (bInside)
        {
            Out.Inside = Inside + Dt;
            Out.Outside = 0.;
            Out.bDone = Out.Inside >= static_cast<double>(TagHoldSeconds);
        }
        else
        {
            Out.Inside = Inside;
            Out.Outside = Outside + Dt;
            Out.bDropped = Out.Outside > TagGraceSeconds;
        }
        return Out;
    }

    inline int SecondsLeft(double Inside)
    {
        if (!(Inside > 0.)) return TagHoldSeconds;
        const double Left = static_cast<double>(TagHoldSeconds) - Inside;
        if (!(Left > 0.)) return 0;
        return static_cast<int>(std::ceil(Left));
    }

    // True when the decoy beams change state between two samples. Callers sample faster than
    // BlinkOn, so one campaign tick crosses at most one edge. A backwards or equal clock does not tick.
    inline bool BlinkEdge(double PreviousTime, double Time)
    {
        if (!(Time > PreviousTime)) return false;
        return BeamLit(0, PreviousTime) != BeamLit(0, Time);
    }
}
