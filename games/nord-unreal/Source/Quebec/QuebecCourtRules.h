#pragma once

// Engine-independent rules for mission 4, Match Pointless.
// No Unreal includes, so Scripts/test_court_rules.py can build this with the system compiler.
// Positions are centimetres on the first mapped tennis court (OSM 236077376), X east, Y north.
// CourtStep is stored on the version-3 tail. A version-1 slot still stores CompletedMissions 0–2 and starts this beat over.
// Display text lives in QuebecCampaign.cpp.

#include <cmath>
#include <cstdint>

namespace QuebecCourtRules
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    // Walk on, score the gold panel once, bank the ball into the return gate, pull, banked.
    inline constexpr int StepArrive = 0;
    inline constexpr int StepRally = 1;
    inline constexpr int StepRedirect = 2;
    inline constexpr int StepPull = 3;
    inline constexpr int StepBanked = 4;

    // The court ring, OSM way 236077376, closed by the caller. Long axis is the net_axis in layout.json.
    inline constexpr FSpot CourtRing[4] = {
        {19857.178393426824, 31430.088800044843, 0.},
        {20768.10822193427, 30821.168400047725, 0.},
        {19453.967159405023, 28854.143999999196, 0.},
        {18543.037330897583, 29461.951199983305, 0.}
    };

    inline constexpr FSpot Arrive = {20211., 30974., 0.};
    inline constexpr int PanelCount = 3;
    inline constexpr int BankPanel = 1;
    inline constexpr int GoldPanel = 2;
    inline constexpr FSpot Panels[PanelCount] = {
        {19878., 30475., 0.},
        {19545., 29976., 0.},
        {19211., 29477., 0.}
    };
    inline constexpr FSpot ReturnGate = {19988., 29920., 0.};
    inline constexpr FSpot Clamp = {19738., 29546., 0.};

    inline constexpr double Reach = 200.;
    inline constexpr double PanelPeriod = 1.6;
    inline constexpr double SweepPeriod = 3.2;
    inline constexpr double SweepDangerSeconds = 0.9;
    inline constexpr double SweepTelegraphSeconds = 0.7;
    inline constexpr double RecoverNorth = 700.;

    inline constexpr int PartCount = 8;
    inline constexpr int PartBall = 6;
    inline constexpr int PartInk = 7;
    inline constexpr int PartClamp = 5;

    enum class EAct : uint8_t { Walk, Score, Bank, Use };

    inline double SpotDistance(const FSpot& A, const FSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    inline bool InsideCourt(double X, double Y)
    {
        bool Hit = false;
        for (int Index = 0; Index < 4; ++Index)
        {
            const FSpot& A = CourtRing[Index];
            const FSpot& B = CourtRing[(Index + 1) % 4];
            const bool Cross = (A.Y > Y) != (B.Y > Y);
            if (!Cross) continue;
            const double XHit = (B.X - A.X) * (Y - A.Y) / (B.Y - A.Y) + A.X;
            if (X < XHit) Hit = !Hit;
        }
        return Hit;
    }

    inline double Wrap(double Time, double Period)
    {
        double Wrapped = std::fmod(Time, Period);
        if (Wrapped < 0.) Wrapped += Period;
        return Wrapped;
    }

    // Which panel the oversized ball is on. The cycle is longer than a campaign tick, so the
    // panel does not skip a stop between samples.
    inline int BallPanel(double Time)
    {
        const double Wrapped = Wrap(Time, PanelPeriod * 3.);
        if (Wrapped < PanelPeriod) return 0;
        if (Wrapped < PanelPeriod * 2.) return 1;
        return 2;
    }

    inline FSpot BallSpot(double Time)
    {
        return Panels[BallPanel(Time)];
    }

    inline double SweepPhase(double Time)
    {
        return Wrap(Time, SweepPeriod);
    }

    // A held chain lengthens the ink. Chain 0 keeps the taught window. The cap leaves the warning and a clear gap.
    inline double DangerSeconds(int Chain)
    {
        if (Chain < 0) Chain = 0;
        if (Chain > 6) Chain = 6;
        const double Grown = SweepDangerSeconds + 0.16 * static_cast<double>(Chain);
        const double Cap = SweepPeriod - SweepTelegraphSeconds - 0.40;
        return Grown < Cap ? Grown : Cap;
    }

    inline double ClearSeconds(int Chain)
    {
        const double Clear = SweepPeriod - DangerSeconds(Chain) - SweepTelegraphSeconds;
        return Clear > 0. ? Clear : 0.;
    }

    inline bool SweepDanger(double Time, int Chain = 0)
    {
        return SweepPhase(Time) < DangerSeconds(Chain);
    }

    inline bool SweepTelegraph(double Time)
    {
        return SweepPhase(Time) > SweepPeriod - SweepTelegraphSeconds;
    }

    // The first quarter-second the ball spends on the middle panel, once the ink is clear.
    // A long chain pushes the ink over that slice. The later part of the panel still banks.
    inline constexpr double CloseSeconds = 0.25;

    inline bool CloseCall(double Time, int Chain)
    {
        const double Wrapped = Wrap(Time, PanelPeriod * 3.);
        if (Wrapped < PanelPeriod || Wrapped >= PanelPeriod * 2.) return false;
        if (Wrapped - PanelPeriod >= CloseSeconds) return false;
        return !SweepDanger(Time, Chain) && !SweepTelegraph(Time);
    }

    inline int Apply(int Step, EAct Action, int Panel, double Time, int Chain = 0)
    {
        if (Step == StepArrive && Action == EAct::Walk) return StepRally;
        if (Step == StepRally && Action == EAct::Score && Panel == GoldPanel && BallPanel(Time) == GoldPanel)
            return StepRedirect;
        if (Step == StepRedirect && Action == EAct::Bank && BallPanel(Time) == BankPanel && !SweepDanger(Time, Chain))
            return StepPull;
        if (Step == StepPull && Action == EAct::Use) return StepBanked;
        return Step;
    }

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepArrive: return Arrive;
        case StepRally: return Panels[GoldPanel];
        case StepRedirect: return ReturnGate;
        case StepPull: return Clamp;
        default: return Clamp;
        }
    }

    inline FSpot RecoverAt(int Step)
    {
        const FSpot Spot = Objective(Step);
        return {Spot.X, Spot.Y + RecoverNorth, Spot.Z};
    }

    // Mission 4 offers only after the picnic is banked. Side jobs wait until the court is banked too.
    inline bool OffersCourt(bool bCampaignComplete, bool bPondBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && Step >= StepArrive && Step < StepBanked;
    }

    inline bool GuidesAfterCourt(bool bCampaignComplete, bool bPondBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && Step >= StepBanked;
    }

    // Posts: 0 arrive, 1–3 panels, 4 gate, 5 clamp, 6 ball, 7 ink.
    // Hidden until the picnic is banked. After the clamp, only the clamp stays.
    inline bool PartVisible(int Step, int Part, double Time, int Chain = 0)
    {
        if (Part < 0 || Part >= PartCount) return false;
        if (Step >= StepBanked) return Part == PartClamp;
        if (Part == 0) return Step == StepArrive;
        if (Part >= 1 && Part <= 3) return Step == StepRally || Step == StepRedirect;
        if (Part == 4) return Step == StepRedirect || Step == StepPull;
        if (Part == PartClamp) return Step == StepPull;
        if (Part == PartBall) return Step == StepRally || Step == StepRedirect;
        if (Part == PartInk) return Step == StepRedirect && (SweepDanger(Time, Chain) || SweepTelegraph(Time));
        return false;
    }
}
