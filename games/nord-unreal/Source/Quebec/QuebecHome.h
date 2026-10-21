#pragma once

// Engine-independent rules for mission 10, putting the day away.
// No Unreal includes, so Scripts/test_home.py can build this with the system compiler.
// Ride the park bike back to the stand, paddle the pedalo back to the berth, then walk the south bank.
// HomeStep is session state. The v1 save still stores CompletedMissions 0–2.
// The seven story banks stay seven. This beat pays a flat purse and does not take a chain link.

#include "QuebecCycle.h"
#include "QuebecRide.h"
#include "QuebecWade.h"

namespace QuebecHome
{
    inline constexpr int StepBike = 0;
    inline constexpr int StepBoat = 1;
    inline constexpr int StepWalk = 2;
    inline constexpr int StepBanked = 3;

    inline constexpr double StandX = QuebecCycle::StandX;
    inline constexpr double StandY = QuebecCycle::StandY;
    // Twelve metres south of the stand, outside the door reach, on the dry east side.
    inline constexpr double StandRecoverX = 34800.;
    inline constexpr double StandRecoverY = -5200.;

    inline constexpr double BerthX = QuebecRide::BerthX;
    inline constexpr double BerthY = QuebecRide::BerthY;
    // Six metres south of the berth. The deck itself sits inside the door reach.
    inline constexpr double BerthRecoverX = -7432.056481612848;
    inline constexpr double BerthRecoverY = 2874.9266244292967;

    inline constexpr double BankX = QuebecWade::BankX;
    inline constexpr double BankY = QuebecWade::BankY;
    // Further along the dry bank, away from the float, outside the bank's reach.
    inline constexpr double BankRecoverX = 6686.552146593498;
    inline constexpr double BankRecoverY = -7480.029072974707;

    inline constexpr double Reach = 450.;
    inline constexpr int Pay = 420;

    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
    };

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepBike: return FSpot{StandX, StandY};
        case StepBoat: return FSpot{BerthX, BerthY};
        case StepWalk: return FSpot{BankX, BankY};
        default: return FSpot{BankX, BankY};
        }
    }

    inline FSpot RecoverAt(int Step)
    {
        switch (Step)
        {
        case StepBike: return FSpot{StandRecoverX, StandRecoverY};
        case StepBoat: return FSpot{BerthRecoverX, BerthRecoverY};
        case StepWalk: return FSpot{BankRecoverX, BankRecoverY};
        default: return FSpot{BankRecoverX, BankRecoverY};
        }
    }

    // The bike step wants the bike at the stand. The boat step wants the pedalo at the berth.
    // The walk step wants a dry walker at the bank. A later place does not skip. Banked stays banked.
    inline int Apply(int Step, bool bBike, bool bPedalo, bool bWalking, bool bAtStand, bool bAtBerth, bool bAtBank)
    {
        if (Step < StepBike || Step >= StepBanked) return Step;
        if (Step == StepBike && bBike && !bPedalo && bAtStand) return StepBoat;
        if (Step == StepBoat && bPedalo && !bBike && bAtBerth) return StepWalk;
        if (Step == StepWalk && bWalking && !bBike && !bPedalo && bAtBank) return StepBanked;
        return Step;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepWalk && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, bool bConvoyBanked, bool bBlankBanked, bool bTourBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && bConvoyBanked && bBlankBanked && bTourBanked
            && Step >= StepBike && Step < StepBanked;
    }

    inline bool GuidesAfter(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, bool bConvoyBanked, bool bBlankBanked, bool bTourBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && bConvoyBanked && bBlankBanked && bTourBanked
            && Step >= StepBanked;
    }
}
