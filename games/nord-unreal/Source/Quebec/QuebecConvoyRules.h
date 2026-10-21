#pragma once

// Engine-independent rules for mission 7, Can't Tow Tomorrow.
// No Unreal includes, so Scripts/test_convoy_rules.py can build this with the system compiler.
// Three authored stops on the street ring, beside the race gates: read the beam, pull the feeder
// in the gap, invert the plate, then take the escape gate.
// ConvoyStep is session state. The v1 save still stores CompletedMissions 0–2.

#include <cmath>
#include <cstdint>

namespace QuebecConvoyRules
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    inline constexpr int StepArrive = 0;
    inline constexpr int StepGap = 1;
    inline constexpr int StepInvert = 2;
    inline constexpr int StepEscape = 3;
    inline constexpr int StepBanked = 4;

    // Sidewalk side of the surveyed race loop, clear of the gates. Y is south of both ponds.
    inline constexpr FSpot Feeder = {30609., -24632., 0.};
    inline constexpr FSpot FeederRecover = {30035., -24232., 0.};
    inline constexpr FSpot Projector = {35249., -24633., 0.};
    inline constexpr FSpot ProjectorRecover = {35942., -24728., 0.};
    inline constexpr FSpot Escape = {32789., -21585., 0.};
    inline constexpr FSpot EscapeRecover = {32227., -21167., 0.};

    inline constexpr double Reach = 200.;
    inline constexpr double BeamPeriod = 3.2;
    inline constexpr double BeamDangerSeconds = 1.0;
    inline constexpr double BeamTelegraphSeconds = 0.6;

    inline constexpr int PartCount = 5;
    inline constexpr int PartFeeder = 0;
    inline constexpr int PartBeam = 1;
    inline constexpr int PartProjector = 2;
    inline constexpr int PartEscape = 3;
    inline constexpr int PartPlate = 4;

    enum class EAct : uint8_t { Walk, Pull, Use };

    inline double SpotDistance(const FSpot& A, const FSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    inline double Wrap(double Time, double Period)
    {
        double Wrapped = std::fmod(Time, Period);
        if (Wrapped < 0.) Wrapped += Period;
        return Wrapped;
    }

    inline double BeamPhase(double Time)
    {
        return Wrap(Time, BeamPeriod);
    }

    inline bool BeamDanger(double Time)
    {
        return BeamPhase(Time) < BeamDangerSeconds;
    }

    inline bool BeamTelegraph(double Time)
    {
        return BeamPhase(Time) > BeamPeriod - BeamTelegraphSeconds;
    }

    inline int Apply(int Step, EAct Action, double Time)
    {
        if (Step == StepArrive && Action == EAct::Walk) return StepGap;
        if (Step == StepGap && Action == EAct::Pull && !BeamDanger(Time)) return StepInvert;
        if (Step == StepInvert && Action == EAct::Use) return StepEscape;
        if (Step == StepEscape && Action == EAct::Use) return StepBanked;
        return Step;
    }

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepArrive:
        case StepGap: return Feeder;
        case StepInvert: return Projector;
        case StepEscape: return Escape;
        default: return Escape;
        }
    }

    inline FSpot RecoverAt(int Step)
    {
        switch (Step)
        {
        case StepArrive:
        case StepGap: return FeederRecover;
        case StepInvert: return ProjectorRecover;
        case StepEscape: return EscapeRecover;
        default: return EscapeRecover;
        }
    }

    inline bool OffersConvoy(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone
            && Step >= StepArrive && Step < StepBanked;
    }

    inline bool GuidesAfterConvoy(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && Step >= StepBanked;
    }

    // Posts stay hidden until the groups are out. The beam shows only while it is painting or about to.
    inline bool PartVisible(int Step, int Part, double Time)
    {
        if (Part < 0 || Part >= PartCount) return false;
        if (Step >= StepBanked) return Part == PartPlate;
        if (Part == PartFeeder) return Step == StepArrive || Step == StepGap;
        if (Part == PartBeam) return Step == StepGap && (BeamDanger(Time) || BeamTelegraph(Time));
        if (Part == PartProjector) return Step == StepInvert;
        if (Part == PartEscape) return Step == StepEscape;
        return false;
    }
}
