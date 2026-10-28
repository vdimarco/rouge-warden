#pragma once

// Engine-independent rules for mission 5, Standing Ovation.
// No Unreal includes, so Scripts/test_show_rules.py can build this with the system compiler.
// Positions are centimetres on dry ground south of the west pond, in front of the Théâtre de Verdure sign.
// The sign itself sits on the pond island; these spots stay off the water.
// ShowStep is stored on the version-3 tail. A version-1 slot still stores CompletedMissions 0–2 and starts this beat over.
// Display text lives in QuebecCampaign.cpp.

#include <cmath>
#include <cstdint>

namespace QuebecShowRules
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    // Walk to the loading edge, set the two stations in either order, then call the curtain.
    inline constexpr int StepArrive = 0;
    inline constexpr int StepChoice = 1;
    inline constexpr int StepSpot = 2;
    inline constexpr int StepDrop = 3;
    inline constexpr int StepCue = 4;
    inline constexpr int StepBanked = 5;

    inline constexpr FSpot Loading = {-8600., 1800., 0.};
    inline constexpr FSpot Followspot = {-9800., 2200., 0.};
    inline constexpr FSpot Backdrop = {-7400., 2200., 0.};
    inline constexpr FSpot Stage = {-8600., 2600., 0.};

    inline constexpr double Reach = 200.;
    // South, away from the pond. North of the stage is water.
    inline constexpr double RecoverSouth = 700.;

    inline constexpr int PartCount = 9;
    inline constexpr int PartSpot = 1;
    inline constexpr int PartDrop = 2;
    inline constexpr int PartCue = 3;
    inline constexpr int PartPanel0 = 4;
    inline constexpr int PartSouvenir = 8;

    enum class EAct : uint8_t { Walk, Spot, Drop, Cue };

    inline double SpotDistance(const FSpot& A, const FSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    inline int Apply(int Step, EAct Action)
    {
        if (Step == StepArrive && Action == EAct::Walk) return StepChoice;
        if (Step == StepChoice && Action == EAct::Spot) return StepSpot;
        if (Step == StepChoice && Action == EAct::Drop) return StepDrop;
        if (Step == StepSpot && Action == EAct::Drop) return StepCue;
        if (Step == StepDrop && Action == EAct::Spot) return StepCue;
        if (Step == StepCue && Action == EAct::Cue) return StepBanked;
        return Step;
    }

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepArrive: return Loading;
        case StepChoice: return Stage;
        case StepSpot: return Backdrop;
        case StepDrop: return Followspot;
        case StepCue: return Loading;
        default: return Stage;
        }
    }

    // The step that follows this one. The choice has two legal stations, so it has no single next stop.
    // After either station, the curtain is next. The finished station is not.
    inline int NextStep(int Step)
    {
        if (Step == StepArrive) return StepChoice;
        if (Step == StepSpot || Step == StepDrop) return StepCue;
        return -1;
    }

    inline FSpot RecoverAt(int Step)
    {
        const FSpot Spot = Objective(Step);
        return {Spot.X, Spot.Y - RecoverSouth, Spot.Z};
    }

    inline bool OffersShow(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && Step >= StepArrive && Step < StepBanked;
    }

    inline bool GuidesAfterShow(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && Step >= StepBanked;
    }

    // Posts: 0 loading disc, 1 followspot, 2 backdrop, 3 curtain mark, 4–7 page panels, 8 souvenir.
    // Hidden until the court is banked. After the curtain, the four panels and the souvenir stay.
    inline bool PartVisible(int Step, int Part)
    {
        if (Part < 0 || Part >= PartCount) return false;
        if (Step >= StepBanked) return Part >= PartPanel0;
        if (Part == 0) return Step == StepArrive;
        if (Part == PartSpot) return Step == StepChoice || Step == StepDrop;
        if (Part == PartDrop) return Step == StepChoice || Step == StepSpot;
        if (Part == PartCue) return Step == StepCue;
        return false;
    }
}
