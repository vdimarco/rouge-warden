#pragma once

// Combat rules for NORD: the weapon table, armour, shotgun spread, pickup spots and respawn points.
// No Unreal includes, so Scripts/test_aim_model.py can build and run it with the system compiler.
// Units are centimetres, seconds and hit points. Weapon slots follow EQuebecWeapon in QuebecGTA.h.

namespace QuebecCombatModel
{
    enum class ESlot : unsigned char { Fists, HockeyStick, Pistol, SMG, Shotgun, Count };

    struct FWeapon
    {
        ESlot Slot;
        bool bMelee;
        bool bAutomatic;        // Holding Fire keeps firing.
        double Damage;          // Per hit, or per pellet.
        int Pellets;            // Shots per trigger pull.
        double Interval;        // Seconds between shots or swings.
        double Range;           // Melee reach or the farthest lock.
        int AmmoPerPickup;      // 0 for melee weapons.
        int MaxAmmo;
        double HitDelay;        // Melee: seconds from the swing to the hit.
        double Push;            // Planar knock push given to the person hit, cm/s.
    };

    inline constexpr FWeapon Weapons[] = {
        {ESlot::Fists,       true,  false, 12., 1, .45,  160.,  0,  0,   .15, 320.},
        {ESlot::HockeyStick, true,  false, 30., 1, .70,  220.,  0,  0,   .22, 620.},
        {ESlot::Pistol,      false, false, 25., 1, .35,  4500., 12, 48,  0.,  260.},
        {ESlot::SMG,         false, true,  12., 1, .09,  3500., 40, 160, 0.,  200.},
        {ESlot::Shotgun,     false, false, 10., 6, .90,  1800., 8,  32,  0.,  520.},
    };
    inline constexpr int WeaponCount = static_cast<int>(ESlot::Count);
    static_assert(sizeof(Weapons) / sizeof(Weapons[0]) == static_cast<unsigned>(WeaponCount), "One row per weapon slot");

    inline const FWeapon& Weapon(int Slot)
    {
        return Weapons[Slot >= 0 && Slot < WeaponCount ? Slot : 0];
    }

    // Melee forgives a little: the target's capsule radius and the stream delay.
    inline constexpr double MeleeSlack = 60.;
    // Melee snaps the attacker's yaw toward a target up to this far off the aim.
    inline constexpr double MeleeSnapDegrees = 90.;
    // Car bodies take this share of weapon damage (100 body damage wrecks a car).
    inline constexpr double CarDamageScale = .2;
    // A shot near people counts as gunfire at most this often per shooter.
    inline constexpr double GunfireReportSeconds = 3.;
    inline constexpr double GunfireWitnessRadius = 3000.;
    inline constexpr double GunfireAlarmRadius = 2500.;
    // The server accepts a shot this early, so client and server clocks need not agree exactly.
    inline constexpr double FireSlack = .03;

    inline bool CanFireAt(double Now, double NextFireAt)
    {
        return Now + FireSlack >= NextFireAt;
    }

    // Pellets that reach the target: all of them up close, fewer at range, never none.
    inline int PelletsThatHit(const FWeapon& Stats, double Distance)
    {
        if (Stats.Pellets <= 1) return Stats.Pellets;
        double Fraction = Stats.Range > 0. ? Distance / Stats.Range : 0.;
        Fraction = Fraction < 0. ? 0. : Fraction > 1. ? 1. : Fraction;
        const int Hits = static_cast<int>(static_cast<double>(Stats.Pellets) * (1. - .6 * Fraction) + .5);
        return Hits < 1 ? 1 : Hits > Stats.Pellets ? Stats.Pellets : Hits;
    }

    // Damage a single trigger pull or swing deals to a target at Distance.
    inline double DamageAt(const FWeapon& Stats, double Distance)
    {
        return Stats.Damage * static_cast<double>(PelletsThatHit(Stats, Distance));
    }

    inline int AddAmmo(const FWeapon& Stats, int Current, int Added)
    {
        const int Total = Current + Added;
        return Total < 0 ? 0 : Total > Stats.MaxAmmo ? Stats.MaxAmmo : Total;
    }

    // Vitals.
    inline constexpr double MaxHealth = 100.;
    inline constexpr double MaxArmor = 100.;
    inline constexpr double KnockOutSeconds = 4.;

    struct FVitals
    {
        double Health;
        double Armor;
    };

    // Armour absorbs damage first; what is left comes off health. Neither goes below zero.
    inline FVitals Absorb(FVitals Before, double Damage)
    {
        if (!(Damage > 0.)) return Before;
        const double Armor = Before.Armor > 0. ? Before.Armor : 0.;
        const double Soaked = Damage < Armor ? Damage : Armor;
        const double Left = Before.Health - (Damage - Soaked);
        return {Left > 0. ? Left : 0., Armor - Soaked};
    }

    inline bool IsKnockedOut(const FVitals& Vitals) { return Vitals.Health <= 0.; }

    // A player inside a car takes half of a hit; the car body takes 60% of it as body damage.
    inline constexpr double DriverDamageScale = .5;
    inline constexpr double DriverHitBodyScale = .6;

    // Pickups.
    enum class EPickupKind : unsigned char { HockeyStick, Pistol, SMG, Shotgun, Armor, Health, Count };
    inline constexpr double PickupRespawnSeconds = 60.;
    inline constexpr double PickupGrant = 50.;          // Armour or health from one vest or kit.
    inline constexpr double PickupRadius = 150.;        // Planar reach of a walking player.
    inline constexpr double PickupHeight = 200.;
    inline constexpr double PickupClearance = 1500.;    // From every QA anchor.

    // The weapon slot a pickup grants, or -1 for armour and health.
    inline int PickupWeaponSlot(EPickupKind Kind)
    {
        switch (Kind)
        {
        case EPickupKind::HockeyStick: return static_cast<int>(ESlot::HockeyStick);
        case EPickupKind::Pistol: return static_cast<int>(ESlot::Pistol);
        case EPickupKind::SMG: return static_cast<int>(ESlot::SMG);
        case EPickupKind::Shotgun: return static_cast<int>(ESlot::Shotgun);
        default: return -1;
        }
    }

    struct FSpot
    {
        EPickupKind Kind;
        double X;
        double Y;
    };

    // Street and park points from the OSM snapshot (Data/LaFontaine/osm.xml, ODbL), projected like
    // Scripts/prepare_lafontaine.py. Z comes from a ground trace at BeginPlay.
    inline constexpr FSpot PickupSpots[] = {
        {EPickupKind::HockeyStick, -18689., 12828.},  // Parc La Fontaine, path on the west pond.
        {EPickupKind::HockeyStick, 11531., -10783.},  // Parc La Fontaine, path by the loungers on the east pond.
        {EPickupKind::Pistol, -29913., 21301.},       // Ruelle behind Dépanneur De-Ro, Rue De La Roche.
        {EPickupKind::SMG, 41225., -13341.},          // Planted ruelle off Rue Panet (OSM way 347132484).
        {EPickupKind::Shotgun, 62176., -3811.},       // Parc Persillier-Lachapelle path, in the east.
        {EPickupKind::Armor, -24473., -11812.},       // Avenue Duluth Est sidewalk.
        {EPickupKind::Armor, 20868., 26312.},         // Parc La Fontaine, north-east path.
        {EPickupKind::Health, 47371., -10524.},       // Parc Monseigneur-Lartigue path.
        {EPickupKind::Health, 25776., 6476.},         // Parc La Fontaine path near Calixa-Lavallée.
        {EPickupKind::Health, 1859., 47073.},         // Parc La Fontaine path near Rue Rachel.
    };
    inline constexpr int PickupSpotCount = static_cast<int>(sizeof(PickupSpots) / sizeof(PickupSpots[0]));

    struct FAnchor
    {
        const char* Name;
        double X;
        double Y;
    };

    // Points the host QA suites stand on (campaign-hud.md section 9.2). The race gates come from
    // AQuebecCampaign::SetupRaceRoute; the native test checks these against the live campaign values.
    inline constexpr FAnchor QAAnchors[] = {
        {"Worklight", 5550., 2460.}, {"JumpGate", 5550., 2820.}, {"FirstClamp", 5550., 3270.},
        {"CarLight", 5700., 2200.}, {"FinalClamp", 5550., 3520.}, {"LightCar", 5550., 1700.},
        {"LoanCar", 34995.75, -20370.36}, {"Trap", 34862.53, -22670.89},
        {"Gate0", 34491.36, -20805.24}, {"Gate1", 32525.37, -23455.59}, {"Gate2", 30379.64, -27163.85},
        {"Gate3", 31304.99, -26721.52}, {"Gate4", 34095.90, -26300.20}, {"Gate5", 34317.66, -22595.97},
        {"Mission0", 10998.941, -2417.723}, {"Mission1", -8258.421, 4915.891}, {"Mission2", 7558.846, 41024.760},
        {"Spawn", 38793.017, -7522.815}, {"Car", 37671.380, -7274.787}, {"WalkStart", 37887.30, -6298.37},
    };
    inline constexpr int QAAnchorCount = static_cast<int>(sizeof(QAAnchors) / sizeof(QAAnchors[0]));

    // Respawn points: the Hôpital Notre-Dame stop on Sherbrooke after a K.-O., Poste de quartier 38 on Rachel
    // after an arrest.
    inline constexpr double HospitalX = 44072., HospitalY = 17544.;
    inline constexpr double StationX = -40878., StationY = 5405.;
}
