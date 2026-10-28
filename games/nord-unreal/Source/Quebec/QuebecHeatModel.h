#pragma once

// Engine-independent wanted level: heat per crime, stars, the search countdown, witnesses, arrests and unit caps.
// No Unreal includes, so Scripts/test_heat_model.py can build and run it with the system compiler.
// Distances are centimetres, times are seconds, angles are degrees.

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace QuebecHeat
{
    // Same order as EQuebecCrime in QuebecGTA.h; QuebecPolice.cpp checks the count.
    enum class ECrime : uint8_t { HitPerson, AttackPerson, Gunfire, HitCar, StealCar, RamPolice, AttackPolice, DownPolice };
    inline constexpr int CrimeCount = 8;
    inline constexpr int MaxStars = 5;
    // Heat needed for 1-5 stars.
    inline constexpr float StarHeat[MaxStars] = {10.f, 45.f, 100.f, 180.f, 300.f};
    inline constexpr float MaxHeat = 400.f;
    // Heat above the current star's threshold fades slowly, so a near miss toward the next star is forgotten.
    inline constexpr float HeatFadePerSecond = 1.f;
    inline constexpr float SearchBaseSeconds = 15.f;
    inline constexpr float SearchSecondsPerStar = 10.f;

    inline float CrimeHeat(ECrime Crime)
    {
        switch (Crime)
        {
        case ECrime::HitPerson: return 30.f;
        case ECrime::AttackPerson: return 25.f;
        case ECrime::Gunfire: return 12.f;
        case ECrime::HitCar: return 6.f;
        case ECrime::StealCar: return 15.f;
        case ECrime::RamPolice: return 40.f;
        case ECrime::AttackPolice: return 60.f;
        case ECrime::DownPolice: return 120.f;
        }
        return 0.f;
    }

    // Seconds before the same crime adds heat again, so one burst of fire or one long scrape counts once.
    inline float CrimeCooldown(ECrime Crime)
    {
        switch (Crime)
        {
        case ECrime::Gunfire: return 3.f;
        case ECrime::HitCar: return 1.5f;
        case ECrime::RamPolice: return 1.5f;
        case ECrime::AttackPerson: return .4f;
        default: return 0.f;
        }
    }

    inline bool CrimeReady(ECrime Crime, double LastAt, double Now)
    {
        return Now - LastAt >= static_cast<double>(CrimeCooldown(Crime));
    }

    // The police always know about crimes against themselves.
    inline bool AlwaysWitnessed(ECrime Crime)
    {
        return Crime == ECrime::RamPolice || Crime == ECrime::AttackPolice || Crime == ECrime::DownPolice;
    }

    inline int StarsForHeat(float Heat)
    {
        int Stars = 0;
        while (Stars < MaxStars && Heat >= StarHeat[Stars]) ++Stars;
        return Stars;
    }

    // The lowest heat that still gives this many stars; zero for none.
    inline float StarFloor(int Stars)
    {
        return Stars <= 0 ? 0.f : StarHeat[std::min(Stars, MaxStars) - 1];
    }

    inline float SearchSeconds(int Stars)
    {
        return SearchBaseSeconds + SearchSecondsPerStar * static_cast<float>(std::clamp(Stars, 0, MaxStars));
    }

    struct FWanted
    {
        float Heat = 0.f;
        int Stars = 0;
        // While searching, no unit sees the player and the stars blink; one drops when SearchEndsAt passes.
        bool bSearching = false;
        double SearchEndsAt = 0.0;
    };

    // A witnessed crime. Returns how many stars it added. A crime restarts a running search: the police know again.
    inline int AddCrime(FWanted& Wanted, ECrime Crime, double Now)
    {
        const int Before = Wanted.Stars;
        Wanted.Heat = std::min(MaxHeat, Wanted.Heat + CrimeHeat(Crime));
        Wanted.Stars = std::max(Wanted.Stars, StarsForHeat(Wanted.Heat));
        if (Wanted.bSearching) Wanted.SearchEndsAt = Now + static_cast<double>(SearchSeconds(Wanted.Stars));
        return Wanted.Stars - Before;
    }

    // One step. Heat never falls below the current star's threshold. Seen: the stars hold. Unseen: the countdown
    // runs; when it ends one star drops and, above zero, a fresh countdown starts for the lower level.
    // Returns the change in stars (0 or -1).
    inline int Tick(FWanted& Wanted, double Now, float DeltaSeconds, bool bSeen)
    {
        const float Floor = StarFloor(Wanted.Stars);
        if (Wanted.Heat > Floor) Wanted.Heat = std::max(Floor, Wanted.Heat - HeatFadePerSecond * std::max(DeltaSeconds, 0.f));
        else Wanted.Heat = Floor;
        if (Wanted.Stars <= 0 || bSeen)
        {
            Wanted.Stars = std::max(Wanted.Stars, 0);
            Wanted.bSearching = false;
            return 0;
        }
        if (!Wanted.bSearching)
        {
            Wanted.bSearching = true;
            Wanted.SearchEndsAt = Now + static_cast<double>(SearchSeconds(Wanted.Stars));
            return 0;
        }
        if (Now < Wanted.SearchEndsAt) return 0;
        --Wanted.Stars;
        Wanted.Heat = StarFloor(Wanted.Stars);
        Wanted.bSearching = Wanted.Stars > 0;
        Wanted.SearchEndsAt = Wanted.bSearching ? Now + static_cast<double>(SearchSeconds(Wanted.Stars)) : 0.0;
        return -1;
    }

    // Side jobs and the garage set the level directly.
    inline void SetStars(FWanted& Wanted, int Stars)
    {
        Wanted.Stars = std::clamp(Stars, 0, MaxStars);
        Wanted.Heat = StarFloor(Wanted.Stars);
        Wanted.bSearching = false;
        Wanted.SearchEndsAt = 0.0;
    }

    struct FVec
    {
        double X = 0.0;
        double Y = 0.0;
        double Z = 0.0;
    };

    enum class EWatcher : uint8_t { OfficerOnFoot, PoliceCar };
    inline constexpr double FootHalfAngle = 55.0;
    inline constexpr double FootRange = 4000.0;
    inline constexpr double CarHalfAngle = 35.0;
    inline constexpr double CarRange = 7000.0;
    // A unit notices anything this close, whichever way it faces.
    inline constexpr double AwarenessRange = 800.0;
    inline constexpr double CivilianRange = 2500.0;
    inline constexpr int CiviliansNeeded = 2;

    // Cone and range only; the caller adds a line-of-sight trace.
    inline bool InView(EWatcher Watcher, const FVec& Eye, const FVec& Forward, const FVec& Target)
    {
        const double DX = Target.X - Eye.X, DY = Target.Y - Eye.Y, DZ = Target.Z - Eye.Z;
        const double Distance = std::sqrt(DX * DX + DY * DY + DZ * DZ);
        if (Distance <= AwarenessRange) return true;
        const bool bCar = Watcher == EWatcher::PoliceCar;
        if (Distance > (bCar ? CarRange : FootRange)) return false;
        const double Length = std::sqrt(Forward.X * Forward.X + Forward.Y * Forward.Y + Forward.Z * Forward.Z);
        if (Length <= 1e-9) return false;
        const double Cosine = (Forward.X * DX + Forward.Y * DY + Forward.Z * DZ) / (Length * Distance);
        const double HalfAngle = (bCar ? CarHalfAngle : FootHalfAngle) * 3.14159265358979323846 / 180.0;
        return Cosine >= std::cos(HalfAngle);
    }

    inline bool CiviliansWitness(int CiviliansNear)
    {
        return CiviliansNear >= CiviliansNeeded;
    }

    // Arrest: a police officer within reach of a slow player on foot, held for ArrestHoldSeconds without a break.
    inline constexpr double ArrestReach = 150.0;
    inline constexpr float ArrestMaxSpeed = 150.f;
    inline constexpr float ArrestHoldSeconds = 2.f;
    // The banner shows this long before the player returns at the police station.
    inline constexpr float ArrestBannerSeconds = 4.f;

    struct FArrest
    {
        float Held = 0.f;
    };

    // Returns true on the step the hold completes.
    inline bool TickArrest(FArrest& Arrest, bool bOfficerInReach, float PlayerSpeed, float DeltaSeconds)
    {
        if (!bOfficerInReach || PlayerSpeed >= ArrestMaxSpeed)
        {
            Arrest.Held = 0.f;
            return false;
        }
        const bool bWasHeld = Arrest.Held >= ArrestHoldSeconds;
        Arrest.Held += std::max(DeltaSeconds, 0.f);
        return !bWasHeld && Arrest.Held >= ArrestHoldSeconds;
    }

    // Units per player for a star level, and world caps: two co-op viewers already share one GPU.
    inline constexpr int WorldCarCap = 4;
    inline constexpr int WorldOfficerCap = 4;

    inline int MaxPoliceCars(int Stars)
    {
        constexpr int Cars[MaxStars + 1] = {0, 1, 2, 3, 4, 4};
        return Cars[std::clamp(Stars, 0, MaxStars)];
    }

    // At one or two stars an officer only steps out to make an arrest; from three stars officers also shoot.
    inline int MaxOfficers(int Stars)
    {
        constexpr int Officers[MaxStars + 1] = {0, 1, 2, 3, 4, 4};
        return Officers[std::clamp(Stars, 0, MaxStars)];
    }

    inline bool OfficersShoot(int Stars)
    {
        return Stars >= 3;
    }

    // Units that lose the player wander this far around the last seen point.
    inline double SearchRadius(int Stars)
    {
        constexpr double Radius[MaxStars + 1] = {0.0, 12000.0, 18000.0, 25000.0, 32000.0, 40000.0};
        return Radius[std::clamp(Stars, 0, MaxStars)];
    }

    // An officer's shot: more likely close, less likely at a moving or driving target.
    inline float ShotHitChance(double Distance, float TargetSpeed, bool bTargetDriving)
    {
        const double Range = std::clamp((Distance - 500.0) / 2000.0, 0.0, 1.0);
        float Chance = static_cast<float>(.55 + (.15 - .55) * Range);
        if (TargetSpeed > 400.f) Chance *= .6f;
        if (bTargetDriving) Chance *= .7f;
        return Chance;
    }
}
