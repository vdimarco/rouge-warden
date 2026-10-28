#pragma once

// Engine-independent beat length. No Unreal includes, so Scripts/test_beat_pace.py can build this.
// The card says which stop this is, and about how long the next leg is at a walk.
// A sprint is faster. The card names that shorter time when rounding makes it shorter.
// On foot, the clock the player sees is the time left to the diamond, not that next leg.
// Inside the widest step reach the diamond is the work, so the clock drops.

#include "QuebecBlankRules.h"
#include "QuebecConvoyRules.h"
#include "QuebecCourtRules.h"
#include "QuebecPondRules.h"
#include "QuebecRescueRules.h"
#include "QuebecShowRules.h"

#include <cmath>

namespace QuebecPace
{
    inline constexpr double WalkCmPerSecond = 450.;
    inline constexpr double SprintCmPerSecond = 800.;

    struct FBeat
    {
        int Index = 0;
        int Count = 0;
        int WalkSeconds = 0;
        int SprintSeconds = 0;
        // Terrace legs use the live objective. The caller measures that distance.
        bool bMeasureWalk = false;
    };

    inline int SecondsAt(double DistanceCm, double CmPerSecond)
    {
        if (!(DistanceCm > 0.) || !(CmPerSecond > 0.)) return 0;
        const int Rounded = static_cast<int>(std::lround(DistanceCm / CmPerSecond));
        return Rounded < 1 ? 1 : Rounded;
    }

    inline int WalkSeconds(double DistanceCm)
    {
        return SecondsAt(DistanceCm, WalkCmPerSecond);
    }

    inline int SprintSeconds(double DistanceCm)
    {
        return SecondsAt(DistanceCm, SprintCmPerSecond);
    }

    // Time left from where you stand to the diamond you are walking toward.
    // The stored leg on FBeat stays the distance from this post to the next one.
    inline void TimeLeft(double DistanceCm, int& OutWalk, int& OutSprint)
    {
        if (!(DistanceCm > QuebecPondRules::Reach))
        {
            OutWalk = 0;
            OutSprint = 0;
            return;
        }
        OutWalk = WalkSeconds(DistanceCm);
        OutSprint = SprintSeconds(DistanceCm);
    }

    template <typename ObjectiveFn>
    inline FBeat Linear(int Step, int Banked, ObjectiveFn Objective)
    {
        FBeat Beat;
        if (Step < 0 || Step >= Banked) return Beat;
        Beat.Index = Step + 1;
        Beat.Count = Banked;
        if (Step + 1 < Banked)
        {
            const auto Here = Objective(Step);
            const auto Next = Objective(Step + 1);
            const double Distance = std::hypot(Next.X - Here.X, Next.Y - Here.Y);
            Beat.WalkSeconds = WalkSeconds(Distance);
            Beat.SprintSeconds = SprintSeconds(Distance);
        }
        return Beat;
    }

    // Four player stops. The followspot and the backdrop share one slot, in either order.
    inline FBeat Show(int Step)
    {
        FBeat Beat;
        Beat.Count = 4;
        const auto Curtain = QuebecShowRules::Objective(QuebecShowRules::StepCue);
        if (Step == QuebecShowRules::StepArrive)
        {
            Beat.Index = 1;
            const auto Here = QuebecShowRules::Objective(Step);
            const auto Stage = QuebecShowRules::Objective(QuebecShowRules::StepChoice);
            const double Distance = std::hypot(Stage.X - Here.X, Stage.Y - Here.Y);
            Beat.WalkSeconds = WalkSeconds(Distance);
            Beat.SprintSeconds = SprintSeconds(Distance);
        }
        else if (Step == QuebecShowRules::StepChoice)
            Beat.Index = 2;
        else if (Step == QuebecShowRules::StepSpot || Step == QuebecShowRules::StepDrop)
        {
            Beat.Index = 3;
            const auto Here = QuebecShowRules::Objective(Step);
            const double Distance = std::hypot(Curtain.X - Here.X, Curtain.Y - Here.Y);
            Beat.WalkSeconds = WalkSeconds(Distance);
            Beat.SprintSeconds = SprintSeconds(Distance);
        }
        else if (Step == QuebecShowRules::StepCue)
            Beat.Index = 4;
        else
            Beat.Count = 0;
        return Beat;
    }

    // Any order. The count is groups, not a walk.
    inline FBeat Rescue(int Mask)
    {
        FBeat Beat;
        int Freed = 0;
        if ((Mask & QuebecRescueRules::BitTerrace) != 0) ++Freed;
        if ((Mask & QuebecRescueRules::BitPond) != 0) ++Freed;
        if ((Mask & QuebecRescueRules::BitCourt) != 0) ++Freed;
        if (Freed >= QuebecRescueRules::GroupCount) return Beat;
        Beat.Index = Freed + 1;
        Beat.Count = QuebecRescueRules::GroupCount;
        return Beat;
    }

    // Mission 1, before the race. The park and the release are a drive, not a walk.
    inline FBeat Terrace(int Phase)
    {
        FBeat Beat;
        if (Phase < 0 || Phase > 4) return Beat;
        Beat.Index = Phase + 1;
        Beat.Count = 5;
        Beat.bMeasureWalk = Phase <= 2;
        return Beat;
    }
}
