#pragma once

// A near miss: the player's car passes another car close and fast, and touches nothing.
// The car passes where the other car sits in its own frame, now and one step ago.
// No Unreal includes, so Scripts/test_near_miss.py can build and run it with the system compiler.
// Distances are cm, speeds are cm/s and times are seconds.

#include <cmath>

namespace QuebecNearMiss
{
    // About 54 km/h. A crawl past a parked car is not a near miss.
    inline constexpr float MinSpeed = 1500.f;
    // Centre to centre, side to side. Two 190 cm cars at 330 cm leave about 1.4 m between the doors.
    inline constexpr float MaxSide = 330.f;
    // Any contact this recently voids the pass, so a scrape along a car is not a near miss.
    inline constexpr float CleanSeconds = 1.f;
    // One banner, then a gap, so a line of parked cars does not machine-gun.
    inline constexpr float AgainSeconds = 1.5f;
    inline constexpr float NoticeSeconds = 1.6f;

    // The other car's place in this car's frame: Ahead along the nose, Side to the right.
    struct FOffset
    {
        float Ahead = 0.f;
        float Side = 0.f;
    };

    // True when the other car's centre crosses from ahead to level or behind, close at the side.
    inline bool Passed(const FOffset& Before, const FOffset& Now)
    {
        return Before.Ahead > 0.f && Now.Ahead <= 0.f && std::fabs(Now.Side) <= MaxSide;
    }

    // km/h for the banner detail, rounded.
    inline int Kmh(float Speed)
    {
        return static_cast<int>(std::lround(std::fabs(Speed) * .036f));
    }

    struct FState
    {
        float SinceContact = CleanSeconds;
        float SincePay = AgainSeconds;
        int Pays = 0;

        // Call every step, before any Pass, with whether the car touched anything this step.
        void Tick(float Delta, bool bContact)
        {
            if (Delta > 0.f)
            {
                SinceContact += Delta;
                SincePay += Delta;
            }
            if (bContact) SinceContact = 0.f;
        }

        // True when this pass earns a banner.
        bool Pass(float Speed, const FOffset& Before, const FOffset& Now)
        {
            if (std::fabs(Speed) < MinSpeed || !Passed(Before, Now)) return false;
            if (SinceContact < CleanSeconds || SincePay < AgainSeconds) return false;
            SincePay = 0.f;
            ++Pays;
            return true;
        }
    };
}
