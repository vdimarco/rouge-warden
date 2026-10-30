#pragma once

// One callout per handbrake slide. The car passes its own speed and sideways speed.
// The tire scream plays while the slide lasts. The banner comes when the slide ends, and grades it.
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
    // A slide that never ends still gets its banner at this length.
    inline constexpr float MaxSeconds = 2.5f;
    // Grades by the peak sideways speed. A full turn after 3 s of gas peaks near 600 cm/s,
    // a full turn at top speed near 820 cm/s, and a half turn near 370 cm/s.
    inline constexpr float BigLateral = 550.f;
    inline constexpr float HugeLateral = 700.f;

    enum class EGrade : int { None = 0, Slide, Big, Huge };

    inline EGrade GradeFor(float PeakLateral)
    {
        if (PeakLateral >= HugeLateral) return EGrade::Huge;
        if (PeakLateral >= BigLateral) return EGrade::Big;
        return EGrade::Slide;
    }

    // The banner title. Plain English, like the other notices.
    inline const char* Title(EGrade Grade)
    {
        switch (Grade)
        {
        case EGrade::Huge: return "HUGE SLIDE";
        case EGrade::Big: return "BIG SLIDE";
        case EGrade::Slide: return "SLIDE";
        default: return "";
        }
    }

    // A slide that pays within this long of the last pay adds a link. In the test drive, getting
    // back up to speed and sliding again takes about 4.2 s, so a quick driver chains and a coast starts over.
    inline constexpr float ChainSeconds = 5.f;
    // The count stops here, so the title keeps one digit.
    inline constexpr int MaxChain = 9;

    // The grade, then the count for a chain: BIG SLIDE, then BIG SLIDE x2.
    inline void ChainTitle(EGrade Grade, int Chain, char (&Out)[24])
    {
        if (Chain <= 1) std::snprintf(Out, sizeof Out, "%s", Title(Grade));
        else std::snprintf(Out, sizeof Out, "%s x%d", Title(Grade), Chain < MaxChain ? Chain : MaxChain);
    }

    struct FState
    {
        float Held = 0.f;
        float Peak = 0.f;
        float SincePay = AgainSeconds;
        bool bPaid = false;
        int Pays = 0;
        // Slides in a row, each paid within ChainSeconds of the one before. 1 for a lone slide.
        int Chain = 0;
        // The last banner: its grade, how long the slide held and its peak sideways speed.
        EGrade LastGrade = EGrade::None;
        float LastSeconds = 0.f;
        float LastPeak = 0.f;

        // True on the frame a slide earns its banner: when it ends, or when it reaches MaxSeconds.
        // bVoid ends a slide without a banner, for a failsafe stop.
        bool Tick(float Delta, float Speed, float Lateral, bool bBrake, bool bVoid = false)
        {
            if (Delta > 0.f) SincePay += Delta;
            const bool bLive = !bVoid && bBrake && std::fabs(Speed) >= MinSpeed && std::fabs(Lateral) >= MinLateral;
            if (bLive)
            {
                if (Delta > 0.f) Held += Delta;
                Peak = std::fabs(Lateral) > Peak ? std::fabs(Lateral) : Peak;
                if (bPaid || Held < MaxSeconds) return false;
                return Pay();
            }
            const bool bEnded = !bVoid && !bPaid && Held > 0.f;
            const bool bPays = bEnded && Pay();
            Held = 0.f;
            Peak = 0.f;
            bPaid = false;
            return bPays;
        }

    private:
        bool Pay()
        {
            if (Held < HoldSeconds || SincePay < AgainSeconds) return false;
            bPaid = true;
            Chain = Pays > 0 && SincePay <= ChainSeconds ? (Chain < MaxChain ? Chain + 1 : MaxChain) : 1;
            SincePay = 0.f;
            ++Pays;
            LastGrade = GradeFor(Peak);
            LastSeconds = Held;
            LastPeak = Peak;
            return true;
        }
    };
}
