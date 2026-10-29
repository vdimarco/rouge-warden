#pragma once

// One callout per handbrake slide, and a count when slides come close together. The car passes its own speed and sideways speed.
// No Unreal includes, so Scripts/test_slide.py can build and run it with the system compiler.
// Speeds are cm/s and times are seconds.

#include <cmath>
#include <cstdio>

namespace QuebecSlide
{
    // The handbrake yaw boost already starts at this speed. Below it the car is just stopping.
    inline constexpr float MinSpeed = 450.f;
    // A shove, not a lane wiggle. A gripped turn stays under this.
    inline constexpr float MinLateral = 180.f;
    // The sideways shove has to last. A tap of the brake does not.
    inline constexpr float HoldSeconds = 0.35f;
    // Matches the notice channel, which drops the same banner inside 1.5 s.
    inline constexpr float AgainSeconds = 1.5f;
    inline constexpr float NoticeSeconds = 1.6f;
    // A slide that pays within this long of the last pay adds a link. The scripted re-slide
    // takes about 4.2 s to get back up to speed, so a quick driver can chain and a slow one starts over.
    inline constexpr float ChainSeconds = 5.f;
    // The count stops here, so the title keeps one digit.
    inline constexpr int MaxChain = 9;

    // SLIDE for one, SLIDE x2 through SLIDE x9 for a chain.
    inline void Title(int Chain, char (&Out)[16])
    {
        if (Chain <= 1) std::snprintf(Out, sizeof Out, "SLIDE");
        else std::snprintf(Out, sizeof Out, "SLIDE x%d", Chain < MaxChain ? Chain : MaxChain);
    }

    struct FState
    {
        float Held = 0.f;
        float SincePay = AgainSeconds;
        bool bPaid = false;
        int Pays = 0;
        int Chain = 0;

        // True on the frame a slide earns its banner.
        bool Tick(float Delta, float Speed, float Lateral, bool bBrake)
        {
            if (Delta > 0.f) SincePay += Delta;
            const bool bLive = bBrake && std::fabs(Speed) >= MinSpeed && std::fabs(Lateral) >= MinLateral;
            if (!bLive)
            {
                Held = 0.f;
                bPaid = false;
                return false;
            }
            if (Delta > 0.f) Held += Delta;
            if (bPaid || Held < HoldSeconds || SincePay < AgainSeconds) return false;
            bPaid = true;
            Chain = Pays > 0 && SincePay <= ChainSeconds ? (Chain < MaxChain ? Chain + 1 : MaxChain) : 1;
            SincePay = 0.f;
            ++Pays;
            return true;
        }
    };
}
