// Standalone test for Source/Quebec/QuebecAimModel.h and QuebecCombatModel.h. Built and run by Scripts/test_aim_model.py.
// With QUEBEC_AIM_STRICT the Unreal macro names are poisoned before the headers are read, so the
// headers cannot use them. Pass --table to print the weapon and pickup tables.

#ifdef QUEBEC_AIM_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FMath int32 uint8
#endif
#include "../Source/Quebec/QuebecAimModel.h"
#include "../Source/Quebec/QuebecCombatModel.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <initializer_list>

using namespace QuebecAim;
namespace Model = QuebecCombatModel;

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    bool Near(double A, double B, double Tolerance = 1.e-9) { return std::fabs(A - B) <= Tolerance; }

    // A point at Distance along a planar heading of Degrees from the origin.
    FPoint At(double Degrees, double Distance, double Height = 0.)
    {
        const double Radians = Degrees / DegreesPerRadian;
        return FPoint{std::cos(Radians) * Distance, std::sin(Radians) * Distance, Height};
    }

    FTarget Person(unsigned Key, double Degrees, double Distance)
    {
        FTarget Target;
        Target.Key = Key;
        Target.Point = At(Degrees, Distance);
        return Target;
    }

    const FPoint Origin{0., 0., 0.};
    const FPoint East{1., 0., 0.};

    void TestCone()
    {
        const FSettings Settings;
        FLock Lock;
        const FTarget Targets[] = {Person(1, 20., 1000.), Person(2, 4., 1100.), Person(3, 26., 300.)};
        FChoice Choice = Choose(Origin, East, Targets, 3, Settings, Lock, 0.);
        Expect(Choice.Index == 1, "the centred target wins over one at 20 degrees (got %d)", Choice.Index);
        Expect(Lock.Key == 2 && Near(Lock.AcquiredAt, 0.), "a fresh choice locks its key and time");
        Expect(Near(Choice.AngleDegrees, 4., 1.e-6) && Near(Choice.Distance, 1100., 1.e-6), "the choice reports angle and distance");

        FTarget Outside[] = {Person(4, 25.5, 500.), Person(5, 0., 4600.), Person(6, 0., 800.)};
        Outside[2].bDown = true;
        Lock = FLock();
        Choice = Choose(Origin, East, Outside, 3, Settings, Lock, 0.);
        Expect(Choice.Index == -1 && Lock.Key == 0, "outside the cone, beyond range and down targets are never chosen");

        FTarget High = Person(7, 0., 300.);
        High.Point.Z = 400.;
        Choice = Choose(Origin, East, &High, 1, Settings, Lock, 0.);
        Expect(Choice.Index == -1, "a target on a balcony far above the shooter is ignored");
        High.Point.Z = 150.;
        Choice = Choose(Origin, East, &High, 1, Settings, Lock, 0.);
        Expect(Choice.Index == 0, "a target a little above the shooter is chosen");

        // Only the planar aim counts: the camera always looks down between -25 and -5 degrees.
        const FPoint Down{std::cos(20. / DegreesPerRadian), 0., -std::sin(20. / DegreesPerRadian)};
        Lock = FLock();
        Choice = Choose(Origin, Down, Targets, 3, Settings, Lock, 0.);
        Expect(Choice.Index == 1, "a camera pitched down still locks the target ahead");

        Choice = Choose(Origin, FPoint{0., 0., -1.}, Targets, 3, Settings, Lock, 0.);
        Expect(Choice.Index == -1 && Lock.Key == 0, "a straight-down aim chooses nothing and clears the lock");
        Choice = Choose(Origin, East, nullptr, 0, Settings, Lock, 0.);
        Expect(Choice.Index == -1, "no candidates chooses nothing");
    }

    void TestHysteresis()
    {
        const FSettings Settings;
        FLock Lock;
        FTarget Targets[] = {Person(10, 0., 1500.), Person(11, 15., 1500.)};
        FChoice Choice = Choose(Origin, East, Targets, 2, Settings, Lock, 10.);
        Expect(Choice.Index == 0 && Lock.Key == 10, "the player locks the target ahead");

        // The player swings 30 degrees toward the second target; the first is now at 30, the second at 15.
        const FPoint Swung{std::cos(30. / DegreesPerRadian), std::sin(30. / DegreesPerRadian), 0.};
        Targets[1].Point = At(35., 1500.);
        Choice = Choose(Origin, Swung, Targets, 2, Settings, Lock, 11.);
        Expect(Choice.Index == 0 && Choice.bKept, "the lock holds inside 35 degrees although another target is centred");
        Expect(Near(Lock.AcquiredAt, 10.), "keeping a lock does not restart its timer");

        // Past 35 degrees the lock breaks at once.
        const FPoint Far{std::cos(36. / DegreesPerRadian), std::sin(36. / DegreesPerRadian), 0.};
        Choice = Choose(Origin, Far, Targets, 2, Settings, Lock, 11.5);
        Expect(Choice.Index == 1 && !Choice.bKept && Lock.Key == 11, "beyond 35 degrees the centred target takes the lock");

        // The lock timer: after 4 s a better target wins even inside 35 degrees.
        Lock = FLock{10, 20.};
        Choice = Choose(Origin, Swung, Targets, 2, Settings, Lock, 23.9);
        Expect(Choice.Index == 0 && Choice.bKept, "the lock holds just before 4 s");
        Choice = Choose(Origin, Swung, Targets, 2, Settings, Lock, 24.);
        Expect(Choice.Index == 1 && !Choice.bKept, "after 4 s the best target in the cone wins (got %d)", Choice.Index);

        // A fresh choice of the same target restarts the timer.
        Lock = FLock{10, 0.};
        Choice = Choose(Origin, East, Targets, 2, Settings, Lock, 5.);
        Expect(Choice.Index == 0 && !Choice.bKept && Near(Lock.AcquiredAt, 5.), "re-choosing the same target restarts its lock timer");

        // The lock survives a little extra distance, and is dropped when its target goes down.
        Lock = FLock{10, 0.};
        Targets[0].Point = At(0., 4500. * 1.1);
        Choice = Choose(Origin, East, Targets, 2, Settings, Lock, 1.);
        Expect(Choice.Index == 0 && Choice.bKept, "a lock drifting to 1.1x range is kept");
        Targets[0].bDown = true;
        Targets[1].Point = At(10., 1500.);
        Choice = Choose(Origin, East, Targets, 2, Settings, Lock, 1.5);
        Expect(Choice.Index == 1 && Lock.Key == 11, "a knocked-down lock is dropped for the next target");

        // Targets without identity never keep a lock.
        FTarget Anonymous = Person(0, 30., 500.);
        Lock = FLock{0, 0.};
        Choice = Choose(Origin, East, &Anonymous, 1, Settings, Lock, 1.);
        Expect(Choice.Index == -1, "a target without a key gets no hysteresis");
    }

    void TestPriorities()
    {
        const FSettings Settings;
        FLock Lock;
        FTarget Civilian = Person(20, 8., 1500.), Officer = Person(21, 15., 1500.);
        Officer.bThreat = true;
        const FTarget Pair[] = {Civilian, Officer};
        FChoice Choice = Choose(Origin, East, Pair, 2, Settings, Lock, 0.);
        Expect(Choice.Index == 1, "an officer chasing the player wins a close call over a civilian");

        FTarget Car = Person(22, 2., 1500.);
        Car.Penalty = .45;
        const FTarget Mixed[] = {Car, Person(23, 12., 1500.)};
        Lock = FLock();
        Choice = Choose(Origin, East, Mixed, 2, Settings, Lock, 0.);
        Expect(Choice.Index == 1, "a person wins a close call over a car");
        const FTarget CarOnly[] = {Car};
        Lock = FLock();
        Choice = Choose(Origin, East, CarOnly, 1, Settings, Lock, 0.);
        Expect(Choice.Index == 0, "a car alone in the cone is chosen");

        const FTarget Depth[] = {Person(24, 3., 3000.), Person(25, 3., 600.)};
        Lock = FLock();
        Choice = Choose(Origin, East, Depth, 2, Settings, Lock, 0.);
        Expect(Choice.Index == 1, "the nearer of two equally centred targets wins");
    }

    void TestMelee()
    {
        // Melee uses the same chooser with a 90 degree cone and the weapon reach.
        FSettings Settings;
        const Model::FWeapon& Fists = Model::Weapon(static_cast<int>(Model::ESlot::Fists));
        Settings.ConeDegrees = Model::MeleeSnapDegrees;
        Settings.KeepConeDegrees = Model::MeleeSnapDegrees;
        Settings.Range = Fists.Range + Model::MeleeSlack;
        FLock Lock;
        const FTarget Side[] = {Person(30, 80., 150.)};
        FChoice Choice = Choose(Origin, East, Side, 1, Settings, Lock, 0.);
        Expect(Choice.Index == 0, "a punch turns up to 90 degrees toward a person beside the player");
        const FTarget Behind[] = {Person(31, 100., 150.)};
        Lock = FLock();
        Choice = Choose(Origin, East, Behind, 1, Settings, Lock, 0.);
        Expect(Choice.Index == -1, "a person behind the player is not punched");
        const FTarget OutOfReach[] = {Person(32, 0., 240.)};
        Choice = Choose(Origin, East, OutOfReach, 1, Settings, Lock, 0.);
        Expect(Choice.Index == -1, "fists do not reach 2.4 m");
        Settings.Range = Model::Weapon(static_cast<int>(Model::ESlot::HockeyStick)).Range + Model::MeleeSlack;
        Choice = Choose(Origin, East, OutOfReach, 1, Settings, Lock, 0.);
        Expect(Choice.Index == 0, "the hockey stick reaches 2.4 m");
    }

    void TestWeaponTable()
    {
        const Model::FWeapon& Fists = Model::Weapon(0);
        const Model::FWeapon& Stick = Model::Weapon(1);
        const Model::FWeapon& Pistol = Model::Weapon(2);
        const Model::FWeapon& Smg = Model::Weapon(3);
        const Model::FWeapon& Shotgun = Model::Weapon(4);
        Expect(Model::WeaponCount == 5, "five weapon slots");
        for (int Slot = 0; Slot < Model::WeaponCount; ++Slot)
        {
            const Model::FWeapon& Stats = Model::Weapon(Slot);
            Expect(static_cast<int>(Stats.Slot) == Slot, "row %d is slot %d", Slot, Slot);
            Expect(Stats.Interval > 0. && Stats.Range > 0. && Stats.Damage > 0. && Stats.Pellets >= 1, "row %d has usable numbers", Slot);
            Expect(Stats.bMelee == (Stats.AmmoPerPickup == 0), "row %d: only guns use ammo", Slot);
            Expect(Stats.bMelee == (Stats.HitDelay > 0.), "row %d: only melee has a hit delay", Slot);
            Expect(Stats.MaxAmmo >= Stats.AmmoPerPickup, "row %d: one pickup fits", Slot);
        }
        Expect(Fists.bMelee && Near(Fists.Damage, 12.) && Near(Fists.Range, 160.), "fists: melee, 12 damage, 1.6 m");
        Expect(Stick.bMelee && Near(Stick.Damage, 30.) && Near(Stick.Range, 220.), "hockey stick: melee, 30 damage, 2.2 m");
        Expect(!Pistol.bMelee && !Pistol.bAutomatic && Near(Pistol.Damage, 25.) && Near(Pistol.Interval, .35) &&
            Pistol.AmmoPerPickup == 12 && Near(Pistol.Range, 4500.), "pistol: 25 damage, 0.35 s, 12 rounds, 45 m");
        Expect(Smg.bAutomatic && Near(Smg.Damage, 12.) && Near(Smg.Interval, .09) && Smg.AmmoPerPickup == 40 &&
            Near(Smg.Range, 3500.), "SMG: automatic, 12 damage, 0.09 s, 40 rounds, 35 m");
        Expect(Shotgun.Pellets == 6 && Near(Shotgun.Damage, 10.) && Near(Shotgun.Interval, .9) &&
            Shotgun.AmmoPerPickup == 8 && Near(Shotgun.Range, 1800.), "shotgun: 6 x 10 damage, 0.9 s, 8 shells, 18 m");
        Expect(&Model::Weapon(-1) == &Fists && &Model::Weapon(9) == &Fists, "an unknown slot falls back to fists");

        Expect(Model::PelletsThatHit(Shotgun, 0.) == 6 && Near(Model::DamageAt(Shotgun, 0.), 60.), "all six pellets hit point blank");
        Expect(Model::PelletsThatHit(Shotgun, 900.) == 4, "four pellets hit at half range (got %d)", Model::PelletsThatHit(Shotgun, 900.));
        Expect(Model::PelletsThatHit(Shotgun, 1800.) == 2 && Model::PelletsThatHit(Shotgun, 9000.) == 2, "two pellets hit at and beyond range");
        Expect(Model::PelletsThatHit(Pistol, 4000.) == 1 && Near(Model::DamageAt(Pistol, 4000.), 25.), "single-shot weapons always land their one bullet");
        Expect(Model::AddAmmo(Pistol, 40, 12) == 48 && Model::AddAmmo(Smg, 0, 40) == 40 && Model::AddAmmo(Pistol, 3, -9) == 0, "ammo is capped at both ends");
        Expect(Model::CanFireAt(1.0, 1.02) && !Model::CanFireAt(1.0, 1.05), "the server accepts a shot 30 ms early, not 50 ms");
    }

    void TestArmour()
    {
        Model::FVitals Vitals{100., 50.};
        Vitals = Model::Absorb(Vitals, 30.);
        Expect(Near(Vitals.Health, 100.) && Near(Vitals.Armor, 20.), "armour absorbs damage first");
        Vitals = Model::Absorb(Vitals, 40.);
        Expect(Near(Vitals.Health, 80.) && Near(Vitals.Armor, 0.), "damage past the armour comes off health");
        Vitals = Model::Absorb(Vitals, -10.);
        Expect(Near(Vitals.Health, 80.), "negative damage heals nothing");
        Vitals = Model::Absorb(Vitals, std::nan(""));
        Expect(Near(Vitals.Health, 80.), "NaN damage is ignored");
        Expect(!Model::IsKnockedOut(Vitals), "80 health is standing");
        Vitals = Model::Absorb(Vitals, 200.);
        Expect(Near(Vitals.Health, 0.) && Model::IsKnockedOut(Vitals), "health stops at zero and the player is knocked out");
        Expect(Near(Model::KnockOutSeconds, 4.), "the K.-O. banner lasts 4 s");
        // A driver shot through the car: an officer's 8-point shot takes 4 from the driver and 4.8 from the car body.
        Expect(Near(8. * Model::DriverDamageScale, 4.) && Near(8. * Model::DriverHitBodyScale, 4.8), "a driver takes half a hit through the car");
    }

    void TestPickups()
    {
        int Counts[static_cast<int>(Model::EPickupKind::Count)] = {};
        double Closest = 1.e18;
        for (int Index = 0; Index < Model::PickupSpotCount; ++Index)
        {
            const Model::FSpot& Spot = Model::PickupSpots[Index];
            ++Counts[static_cast<int>(Spot.Kind)];
            Expect(Spot.X >= -43675. && Spot.X <= 75373. && Spot.Y >= -46754. && Spot.Y <= 69018.,
                "pickup %d sits inside the playable Plateau bounds", Index);
            for (int Anchor = 0; Anchor < Model::QAAnchorCount; ++Anchor)
            {
                const Model::FAnchor& Point = Model::QAAnchors[Anchor];
                const double Distance = std::hypot(Spot.X - Point.X, Spot.Y - Point.Y);
                Closest = Distance < Closest ? Distance : Closest;
                Expect(Distance >= Model::PickupClearance, "pickup %d is %.0f cm from QA anchor %s", Index, Distance, Point.Name);
            }
            for (int Other = 0; Other < Index; ++Other)
                Expect(std::hypot(Spot.X - Model::PickupSpots[Other].X, Spot.Y - Model::PickupSpots[Other].Y) >= 3000.,
                    "pickups %d and %d are at least 30 m apart", Other, Index);
        }
        Expect(Model::PickupSpotCount == 10, "ten pickups");
        Expect(Counts[0] == 2 && Counts[1] == 1 && Counts[2] == 1 && Counts[3] == 1 && Counts[4] == 2 && Counts[5] == 3,
            "two sticks, a pistol, an SMG, a shotgun, two vests and three health kits");
        Expect(Closest >= 1500., "closest anchor %.0f cm", Closest);
        Expect(Model::PickupWeaponSlot(Model::EPickupKind::Shotgun) == static_cast<int>(Model::ESlot::Shotgun) &&
            Model::PickupWeaponSlot(Model::EPickupKind::Health) == -1, "pickups map to weapon slots");
        Expect(Near(Model::PickupRespawnSeconds, 60.) && Near(Model::PickupGrant, 50.), "pickups respawn after 60 s and give 50");
        for (const double* Point : {&Model::HospitalX, &Model::StationX})
            Expect(*Point >= -43675. && *Point <= 75373., "respawn points are inside the bounds");
    }

    void PrintTable()
    {
        static const char* Names[] = {"Fists", "HockeyStick", "Pistol", "SMG", "Shotgun"};
        for (int Slot = 0; Slot < Model::WeaponCount; ++Slot)
        {
            const Model::FWeapon& Stats = Model::Weapon(Slot);
            std::printf("%-12s melee=%d auto=%d damage=%5.1f x%d interval=%.2fs range=%5.0fcm ammo=%3d/%3d dps=%6.1f\n",
                Names[Slot], Stats.bMelee ? 1 : 0, Stats.bAutomatic ? 1 : 0, Stats.Damage, Stats.Pellets, Stats.Interval,
                Stats.Range, Stats.AmmoPerPickup, Stats.MaxAmmo, Model::DamageAt(Stats, 0.) / Stats.Interval);
        }
        static const char* Kinds[] = {"HockeyStick", "Pistol", "SMG", "Shotgun", "Armor", "Health"};
        for (int Index = 0; Index < Model::PickupSpotCount; ++Index)
        {
            const Model::FSpot& Spot = Model::PickupSpots[Index];
            double Closest = 1.e18;
            const char* Name = "";
            for (int Anchor = 0; Anchor < Model::QAAnchorCount; ++Anchor)
            {
                const double Distance = std::hypot(Spot.X - Model::QAAnchors[Anchor].X, Spot.Y - Model::QAAnchors[Anchor].Y);
                if (Distance < Closest) { Closest = Distance; Name = Model::QAAnchors[Anchor].Name; }
            }
            std::printf("pickup %-11s (%7.0f,%7.0f) nearest anchor %-9s %6.0f cm\n", Kinds[static_cast<int>(Spot.Kind)], Spot.X, Spot.Y, Name, Closest);
        }
    }
}

int main(int ArgumentCount, char** Arguments)
{
    TestCone();
    TestHysteresis();
    TestPriorities();
    TestMelee();
    TestWeaponTable();
    TestArmour();
    TestPickups();
    if (ArgumentCount > 1 && std::strcmp(Arguments[1], "--table") == 0) PrintTable();
    if (Failures)
    {
        std::fprintf(stderr, "%d of %d checks failed\n", Failures, Assertions);
        return 1;
    }
    std::printf("NORD aim and combat model: %d checks passed\n", Assertions);
    return 0;
}
