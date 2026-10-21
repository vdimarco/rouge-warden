#pragma once

// Engine-independent rules for mission 6, Nobody Left in the Picture.
// No Unreal includes, so Scripts/test_rescue_rules.py can build this with the system compiler.
// Three short pulls, any order, on dry ground near the terrace, the pond and the court.
// RescueMask is session state. The v1 save still stores CompletedMissions 0–2.

#include <cmath>
#include <cstdint>

namespace QuebecRescueRules
{
    struct FSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    inline constexpr int GroupTerrace = 0;
    inline constexpr int GroupPond = 1;
    inline constexpr int GroupCourt = 2;
    inline constexpr int GroupCount = 3;
    inline constexpr int BitTerrace = 1;
    inline constexpr int BitPond = 2;
    inline constexpr int BitCourt = 4;
    inline constexpr int Done = 7;

    inline constexpr FSpot Terrace = {10200., 5200., 0.};
    inline constexpr FSpot Pond = {-1800., 10000., 0.};
    inline constexpr FSpot Court = {18000., 28000., 0.};
    inline constexpr FSpot Posts[GroupCount] = {Terrace, Pond, Court};

    inline constexpr double Reach = 200.;
    // Terrace's south side is water, so that recover steps east. The other two step south.
    inline constexpr double RecoverOffset = 700.;

    inline double SpotDistance(const FSpot& A, const FSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    inline bool GroupOpen(int Mask, int Group)
    {
        if (Group < 0 || Group >= GroupCount) return false;
        if (Mask < 0 || Mask >= Done) return false;
        return (Mask & (1 << Group)) == 0;
    }

    inline int Apply(int Mask, int Group)
    {
        if (!GroupOpen(Mask, Group)) return Mask;
        return Mask | (1 << Group);
    }

    inline FSpot Objective(int Mask)
    {
        for (int Group = 0; Group < GroupCount; ++Group)
            if (GroupOpen(Mask, Group)) return Posts[Group];
        return Terrace;
    }

    inline FSpot RecoverAt(int Mask)
    {
        const FSpot Spot = Objective(Mask);
        if (Spot.X == Terrace.X && Spot.Y == Terrace.Y) return {Spot.X + RecoverOffset, Spot.Y, Spot.Z};
        return {Spot.X, Spot.Y - RecoverOffset, Spot.Z};
    }

    inline bool OffersRescue(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, int Mask)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && Mask >= 0 && Mask < Done;
    }

    inline bool GuidesAfterRescue(bool bCampaignComplete, bool bPondBanked, bool bCourtBanked, bool bShowBanked, int Mask)
    {
        return bCampaignComplete && bPondBanked && bCourtBanked && bShowBanked && Mask >= Done;
    }

    // Posts stay visible once the show is banked, including after the last group is out.
    inline bool PartVisible(int Part)
    {
        return Part >= 0 && Part < GroupCount;
    }
}
