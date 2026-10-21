#pragma once

// Engine-independent rules for mission 9, the tour across the park.
// No Unreal includes, so Scripts/test_tour.py can build this with the system compiler.
// Ride the park bike to the east mark, paddle the pedalo to the north buoy, then swim to the south float.
// TourStep is session state. The v1 save still stores CompletedMissions 0–2.
// The seven story banks stay seven. This tour pays a flat purse and does not take a chain link.

#include "QuebecCycle.h"
#include "QuebecLap.h"
#include "QuebecRide.h"
#include "QuebecWade.h"

#include <cmath>

namespace QuebecTour
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    inline constexpr int StepBike = 0;
    inline constexpr int StepBoat = 1;
    inline constexpr int StepSwim = 2;
    inline constexpr int StepBanked = 3;

    // Dry ground east of the bike stand, a short ride away, outside the stand's door reach.
    inline constexpr double BikeX = 40000.;
    inline constexpr double BikeY = -4000.;
    inline constexpr double BikeRecoverX = 40000.;
    inline constexpr double BikeRecoverY = -5200.;
    // The north-pond buoy the pedalo already laps.
    inline constexpr double BoatX = QuebecLap::BuoyX;
    inline constexpr double BoatY = QuebecLap::BuoyY;
    inline constexpr double BoatRecoverX = QuebecRide::BerthX;
    inline constexpr double BoatRecoverY = QuebecRide::BerthY;
    // The south-pond float, and the dry bank a swimmer can be set back on.
    inline constexpr double FloatX = QuebecWade::BuoyX;
    inline constexpr double FloatY = QuebecWade::BuoyY;
    inline constexpr double FloatRecoverX = QuebecWade::BankX;
    inline constexpr double FloatRecoverY = QuebecWade::BankY;

    inline constexpr double Reach = 450.;
    inline constexpr int Pay = 360;

    inline FSpot Objective(int Step)
    {
        switch (Step)
        {
        case StepBike: return FSpot{BikeX, BikeY, 0.};
        case StepBoat: return FSpot{BoatX, BoatY, 0.};
        case StepSwim: return FSpot{FloatX, FloatY, 0.};
        default: return FSpot{FloatX, FloatY, 0.};
        }
    }

    inline FSpot RecoverAt(int Step)
    {
        switch (Step)
        {
        case StepBike: return FSpot{BikeRecoverX, BikeRecoverY, 0.};
        case StepBoat: return FSpot{BoatRecoverX, BoatRecoverY, 0.};
        case StepSwim: return FSpot{FloatRecoverX, FloatRecoverY, 0.};
        default: return FSpot{FloatRecoverX, FloatRecoverY, 0.};
        }
    }

    // The bike step wants the bike at the east mark. The boat step wants the pedalo at the buoy.
    // The swim step wants a swimmer at the float. A later place does not skip. Banked stays banked.
    inline int Apply(int Step, bool bBike, bool bPedalo, bool bSwimming, bool bAtBike, bool bAtBoat, bool bAtFloat)
    {
        if (Step < StepBike || Step >= StepBanked) return Step;
        if (Step == StepBike && bBike && !bPedalo && bAtBike) return StepBoat;
        if (Step == StepBoat && bPedalo && !bBike && bAtBoat) return StepSwim;
        if (Step == StepSwim && bSwimming && !bBike && !bPedalo && bAtFloat) return StepBanked;
        return Step;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepSwim && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, bool bConvoyBanked, bool bBlankBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && bConvoyBanked && bBlankBanked
            && Step >= StepBike && Step < StepBanked;
    }

    inline bool GuidesAfter(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, bool bRescueDone, bool bConvoyBanked, bool bBlankBanked, int Step)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && bRescueDone && bConvoyBanked && bBlankBanked
            && Step >= StepBanked;
    }
}
