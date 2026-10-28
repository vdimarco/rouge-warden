#pragma once

// Engine-independent rules for mission 8, Leave the Last Page Blank.
// No Unreal includes, so Scripts/test_blank_rules.py can build this with the system compiler.
// Three projection gates in order on dry ground south of the theatre, then one pull that leaves the page blank.
// BlankStep is stored on the version-3 tail. A version-1 slot still stores CompletedMissions 0–2 and starts this beat over.

#include <cmath>
#include <cstdint>

namespace QuebecBlankRules
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    inline constexpr int StepGateA = 0;
    inline constexpr int StepGateB = 1;
    inline constexpr int StepGateC = 2;
    inline constexpr int StepCue = 3;
    inline constexpr int StepBanked = 4;

    // South of the theatre loading edge. Checked dry against LaFontaineWater.h.
    inline constexpr FSpot GateA = {-8600., 0., 0.};
    inline constexpr FSpot GateARecover = {-9300., 0., 0.};
    inline constexpr FSpot GateB = {-10400., 0., 0.};
    inline constexpr FSpot GateBRecover = {-11100., 0., 0.};
    inline constexpr FSpot GateC = {-6800., 0., 0.};
    inline constexpr FSpot GateCRecover = {-6100., 0., 0.};
    inline constexpr FSpot Cue = {-8600., -900., 0.};
    inline constexpr FSpot CueRecover = {-8600., -1600., 0.};
    // Southeast of the blank page, off its recover post, on the same dry ground.
    inline constexpr FSpot Keep = {-7528., -1800., 0.};
    // Less than the blank page's chain base, so selling the page pays less than leaving it blank.
    inline constexpr int KeepPay = 200;

    enum class EPage : uint8_t { Blank = 0, Sold = 1 };

    inline constexpr double Reach = 200.;

    inline constexpr int PartCount = 6;
    inline constexpr int PartGateA = 0;
    inline constexpr int PartGateB = 1;
    inline constexpr int PartGateC = 2;
    inline constexpr int PartCue = 3;
    inline constexpr int PartPage = 4;
    inline constexpr int PartKeep = 5;

    enum class EAct : uint8_t { Walk, Use };

    inline double SpotDistance(const FSpot& A, const FSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    inline int Apply(int Step, EAct Action)
    {
        if (Step == StepGateA && Action == EAct::Walk) return StepGateB;
        if (Step == StepGateB && Action == EAct::Walk) return StepGateC;
        if (Step == StepGateC && Action == EAct::Walk) return StepCue;
        if (Step == StepCue && Action == EAct::Use) return StepBanked;
        return Step;
    }

    struct FFinish
    {
        int Step = 0;
        int Cash = 0;
        bool bBankChain = false;
    };

    // Leaving the page blank banks the chain. Selling it ends the page, pays the curator's price, and does not.
    inline FFinish Finish(int Step, EPage Page, bool bAlreadySold)
    {
        FFinish Out;
        Out.Step = Step;
        if (Step != StepCue) return Out;
        Out.Step = StepBanked;
        if (Page == EPage::Sold)
        {
            Out.Cash = bAlreadySold ? 0 : KeepPay;
            Out.bBankChain = false;
        }
        else Out.bBankChain = true;
        return Out;
    }

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepGateA: return GateA;
        case StepGateB: return GateB;
        case StepGateC: return GateC;
        case StepCue: return Cue;
        default: return Cue;
        }
    }

    inline FSpot RecoverAt(int Step)
    {
        switch (Step)
        {
        case StepGateA: return GateARecover;
        case StepGateB: return GateBRecover;
        case StepGateC: return GateCRecover;
        case StepCue: return CueRecover;
        default: return CueRecover;
        }
    }

    inline bool OffersBlank(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, bool bConvoyBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && bConvoyBanked
            && Step >= StepGateA && Step < StepBanked;
    }

    inline bool GuidesAfterBlank(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, bool bConvoyBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && bConvoyBanked
            && Step >= StepBanked;
    }

    inline bool PartVisible(int Step, int Part)
    {
        if (Part < 0 || Part >= PartCount) return false;
        if (Step >= StepBanked) return Part == PartPage;
        if (Part == PartGateA) return Step == StepGateA;
        if (Part == PartGateB) return Step == StepGateB;
        if (Part == PartGateC) return Step == StepGateC;
        if (Part == PartCue) return Step == StepCue;
        if (Part == PartKeep) return Step == StepCue;
        return false;
    }
}
