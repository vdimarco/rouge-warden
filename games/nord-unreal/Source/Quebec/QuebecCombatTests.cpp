#include "QuebecCombat.h"
#include "QuebecAimModel.h"
#include "QuebecCampaign.h"
#include "QuebecGameplay.h"
#include "QuebecPlayerState.h"
#include "LaFontaineMap.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Misc/AutomationTest.h"
#include <limits>

namespace
{
    // One walking player with a QuebecPlayerState on a floor that covers both respawn points. No game mode, city,
    // campaign or save slot is loaded; BeginPlay is not dispatched.
    struct FCombatWorld
    {
        UWorld* World = nullptr;
        AQuebecController* Player = nullptr;
        AQuebecPlayerState* Stats = nullptr;
        AQuebecCharacter* Walker = nullptr;

        FCombatWorld()
        {
            UWorld::InitializationValues Initialization;
            Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
            if (!World) return;
            AActor* Floor = World->SpawnActor<AActor>();
            UBoxComponent* FloorBox = NewObject<UBoxComponent>(Floor);
            Floor->SetRootComponent(FloorBox);
            FloorBox->SetBoxExtent(FVector(100000., 100000., 20.));
            FloorBox->SetCollisionProfileName(TEXT("BlockAll"));
            FloorBox->RegisterComponent();
            Floor->SetActorLocation(FVector(0., 0., -20.));
            FActorSpawnParameters Spawn;
            Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            Player = World->SpawnActor<AQuebecController>();
            if (!Player) return;
            FActorSpawnParameters Owned;
            Owned.Owner = Player;
            Stats = World->SpawnActor<AQuebecPlayerState>(FVector::ZeroVector, FRotator::ZeroRotator, Owned);
            Walker = World->SpawnActor<AQuebecCharacter>(FVector(0., 0., 100.), FRotator::ZeroRotator, Spawn);
            if (!Stats || !Walker) return;
            Player->PlayerState = Stats;
            Player->SetAsLocalPlayerController();
            // Reflected RPCs (the multicasts and the notice banner) run only after this.
            World->InitializeActorsForPlay(FURL());
            Player->Possess(Walker);
        }
        ~FCombatWorld() { if (World) World->DestroyWorld(false); }
        bool Ready() const { return Player && Stats && Walker && Walker->GetController() == Player && QuebecCombat::State(Walker) == Stats; }
        void At(double Seconds) const { World->TimeSeconds = Seconds; }
    };
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatWeaponTableTest, "Quebec.Combat.WeaponTable",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatWeaponTableTest::RunTest(const FString& Parameters)
{
    using namespace QuebecCombatModel;
    TestEqual(TEXT("One weapon row per EQuebecWeapon"), WeaponCount, static_cast<int32>(EQuebecWeapon::Count));
    const FWeapon& Fists = Weapon(static_cast<int32>(EQuebecWeapon::Fists));
    const FWeapon& Stick = Weapon(static_cast<int32>(EQuebecWeapon::HockeyStick));
    const FWeapon& Pistol = Weapon(static_cast<int32>(EQuebecWeapon::Pistol));
    const FWeapon& Smg = Weapon(static_cast<int32>(EQuebecWeapon::SMG));
    const FWeapon& Shotgun = Weapon(static_cast<int32>(EQuebecWeapon::Shotgun));
    TestTrue(TEXT("Fists are melee: 12 damage at 1.6 m"), Fists.bMelee && Fists.Damage == 12. && Fists.Range == 160.);
    TestTrue(TEXT("The hockey stick is melee: 30 damage at 2.2 m"), Stick.bMelee && Stick.Damage == 30. && Stick.Range == 220.);
    TestTrue(TEXT("The pistol fires 25 damage every 0.35 s to 45 m with 12 rounds a pickup"),
        !Pistol.bMelee && !Pistol.bAutomatic && Pistol.Damage == 25. && Pistol.Interval == .35 && Pistol.Range == 4500. && Pistol.AmmoPerPickup == 12);
    TestTrue(TEXT("The SMG is automatic: 12 damage every 0.09 s to 35 m with 40 rounds a pickup"),
        Smg.bAutomatic && Smg.Damage == 12. && Smg.Interval == .09 && Smg.Range == 3500. && Smg.AmmoPerPickup == 40);
    TestTrue(TEXT("The shotgun fires 6 pellets of 10 every 0.9 s to 18 m with 8 shells a pickup"),
        Shotgun.Pellets == 6 && Shotgun.Damage == 10. && Shotgun.Interval == .9 && Shotgun.Range == 1800. && Shotgun.AmmoPerPickup == 8);
    TestEqual(TEXT("Every shotgun pellet lands point blank"), DamageAt(Shotgun, 0.), 60.);
    TestEqual(TEXT("Two shotgun pellets land at full range"), PelletsThatHit(Shotgun, Shotgun.Range), 2);
    for (int32 Slot = 0; Slot < WeaponCount; ++Slot)
    {
        TestTrue(FString::Printf(TEXT("Weapon %d has a French name"), Slot), FCString::Strlen(QuebecCombat::WeaponName(static_cast<EQuebecWeapon>(Slot))) > 0);
        TestTrue(FString::Printf(TEXT("Weapon %d fires at a positive interval"), Slot), Weapon(Slot).Interval > 0.);
    }
    TestEqual(TEXT("Ten pickups"), PickupSpotCount, 10);
    TestEqual(TEXT("A K.-O. lasts 4 s"), KnockOutSeconds, 4.);
    TestEqual(TEXT("Pickups come back after 60 s"), PickupRespawnSeconds, 60.);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatAimLockTest, "Quebec.Combat.AimLock",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatAimLockTest::RunTest(const FString& Parameters)
{
    const auto At = [](double Degrees, double Distance)
    {
        return QuebecAim::FPoint{FMath::Cos(FMath::DegreesToRadians(Degrees)) * Distance, FMath::Sin(FMath::DegreesToRadians(Degrees)) * Distance, 0.};
    };
    QuebecAim::FTarget Targets[2];
    Targets[0].Key = 1;
    Targets[0].Point = At(0., 1500.);
    Targets[1].Key = 2;
    Targets[1].Point = At(15., 1500.);
    const QuebecAim::FSettings Settings;
    QuebecAim::FLock Lock;
    const QuebecAim::FPoint Origin;
    QuebecAim::FChoice Choice = QuebecAim::Choose(Origin, At(0., 1.), Targets, 2, Settings, Lock, 0.);
    TestEqual(TEXT("The centred target is locked"), Choice.Index, 0);
    Targets[1].Point = At(35., 1500.);
    Choice = QuebecAim::Choose(Origin, At(30., 1.), Targets, 2, Settings, Lock, 1.);
    TestTrue(TEXT("The lock holds at 30 degrees although another target is centred"), Choice.Index == 0 && Choice.bKept);
    Choice = QuebecAim::Choose(Origin, At(30., 1.), Targets, 2, Settings, Lock, 4.5);
    TestEqual(TEXT("After 4 s the centred target wins"), Choice.Index, 1);
    Choice = QuebecAim::Choose(Origin, At(90., 1.), Targets, 2, Settings, Lock, 5.);
    TestTrue(TEXT("Nothing in the cone clears the lock"), Choice.Index == -1 && Lock.Key == 0u);
    Targets[0].bDown = true;
    Choice = QuebecAim::Choose(Origin, At(0., 1.), Targets, 1, Settings, Lock, 6.);
    TestEqual(TEXT("A knocked-down person is never chosen"), Choice.Index, -1);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatKnockOutTest, "Quebec.Combat.ArmourAndKnockOut",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatKnockOutTest::RunTest(const FString& Parameters)
{
    FCombatWorld Fixture;
    if (!TestTrue(TEXT("A walking player with a street player state"), Fixture.Ready())) return false;
    AQuebecPlayerState* Stats = Fixture.Stats;
    AQuebecCharacter* Walker = Fixture.Walker;
    TestTrue(TEXT("The game mode uses the street player state"),
        GetDefault<AQuebecGameMode>()->PlayerStateClass.Get() == AQuebecPlayerState::StaticClass());
    Stats->Armor = 50.f;
    QuebecCombat::DamagePlayer(Walker, 30.f, nullptr);
    TestEqual(TEXT("Armour absorbs damage first"), Stats->Armor, 20.f);
    TestEqual(TEXT("Health is untouched while armour lasts"), Stats->Health, 100.f);
    QuebecCombat::DamagePlayer(Walker, 40.f, nullptr);
    TestEqual(TEXT("Armour runs out"), Stats->Armor, 0.f);
    TestEqual(TEXT("The rest comes off health"), Stats->Health, 80.f);
    QuebecCombat::DamagePlayer(Walker, -5.f, nullptr);
    TestEqual(TEXT("Negative damage is ignored"), Stats->Health, 80.f);
    TestTrue(TEXT("A healthy walker can use weapons"), Walker->CanUseWeapons());
    Fixture.At(10.);
    QuebecCombat::DamagePlayer(Walker, 500.f, nullptr);
    TestEqual(TEXT("Health stops at zero"), Stats->Health, 0.f);
    TestTrue(TEXT("Zero health is a K.-O."), Stats->GetDownState() == EQuebecDownState::KnockedOut);
    TestEqual(TEXT("The K.-O. banner runs 4 s"), Stats->DownUntil, 14.f, .01f);
    TestTrue(TEXT("A knocked-out player lies down"), Walker->IsKnocked());
    TestTrue(TEXT("A knocked-out player cannot move"), Walker->IsInputLocked());
    TestFalse(TEXT("A knocked-out player cannot fire"), Walker->CanUseWeapons());
    TestTrue(TEXT("The pawn is never destroyed"), IsValid(Walker) && Walker->GetController() == Fixture.Player);
    QuebecCombat::DamagePlayer(Walker, 10.f, nullptr);
    TestEqual(TEXT("Damage while down changes nothing"), Stats->DownUntil, 14.f, .01f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatRespawnTest, "Quebec.Combat.RespawnKeepsCash",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatRespawnTest::RunTest(const FString& Parameters)
{
    FCombatWorld Fixture;
    if (!TestTrue(TEXT("A walking player with a street player state"), Fixture.Ready())) return false;
    AQuebecPlayerState* Stats = Fixture.Stats;
    AQuebecCharacter* Walker = Fixture.Walker;
    const AQuebecCharacter* Original = Walker;
    Stats->Cash = 450;
    Stats->OwnedWeapons = 1 | (1 << static_cast<int32>(EQuebecWeapon::Pistol));
    Stats->Ammo[static_cast<int32>(EQuebecWeapon::Pistol)] = 9;
    Stats->Weapon = static_cast<uint8>(EQuebecWeapon::Pistol);
    Stats->Stars = 3;
    Stats->Heat = 120.f;
    Fixture.At(20.);
    QuebecCombat::DamagePlayer(Walker, 200.f, nullptr);
    if (!TestTrue(TEXT("The player is knocked out"), Stats->IsDown())) return false;
    Fixture.At(23.9);
    Walker->Tick(1.f / 60.f);
    TestTrue(TEXT("The player stays down for the whole banner"), Stats->IsDown());
    Fixture.At(24.1);
    Walker->Tick(1.f / 60.f);
    TestFalse(TEXT("After 4 s the player stands up again"), Stats->IsDown());
    TestEqual(TEXT("Respawn restores full health"), Stats->Health, AQuebecPlayerState::MaxHealth);
    TestEqual(TEXT("Respawn keeps the cash"), Stats->Cash, 450);
    TestEqual(TEXT("Respawn clears the stars"), static_cast<int32>(Stats->Stars), 0);
    TestEqual(TEXT("Respawn clears the heat"), Stats->Heat, 0.f);
    TestEqual(TEXT("Respawn keeps only the fists"), Stats->OwnedWeapons, 1);
    TestEqual(TEXT("Respawn empties the guns"), Stats->AmmoFor(EQuebecWeapon::Pistol), 0);
    TestTrue(TEXT("Respawn holds the fists"), Stats->CurrentWeapon() == EQuebecWeapon::Fists);
    const FVector Hospital = QuebecCombat::RespawnPoint(Fixture.World, EQuebecDownState::KnockedOut);
    TestTrue(TEXT("A K.-O. returns at the Hôpital Notre-Dame stop"), FVector::Dist2D(Walker->GetActorLocation(), Hospital) < 600.);
    TestEqual(TEXT("The respawn stands on the ground"), Walker->GetActorLocation().Z, 100., 15.);
    TestTrue(TEXT("The same pawn stays possessed"), Walker == Original && Walker->GetController() == Fixture.Player);
    AddInfo(FString::Printf(TEXT("Respawned at %s"), *Walker->GetActorLocation().ToString()));

    Stats->DownState = static_cast<uint8>(EQuebecDownState::Arrested);
    QuebecCombat::Respawn(Fixture.Player, EQuebecDownState::Arrested);
    const FVector Station = QuebecCombat::RespawnPoint(Fixture.World, EQuebecDownState::Arrested);
    TestTrue(TEXT("An arrest returns at Poste de quartier 38"), FVector::Dist2D(Walker->GetActorLocation(), Station) < 600.);
    TestFalse(TEXT("The arrest is over after the respawn"), Stats->IsDown());
    TestEqual(TEXT("An arrest keeps the cash too"), Stats->Cash, 450);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatPickupTest, "Quebec.Combat.PickupGrantsAndRespawns",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatPickupTest::RunTest(const FString& Parameters)
{
    FCombatWorld Fixture;
    if (!TestTrue(TEXT("A walking player with a street player state"), Fixture.Ready())) return false;
    AQuebecPlayerState* Stats = Fixture.Stats;
    const FVector Feet = Fixture.Walker->GetActorLocation() - FVector(0., 0., 96.);
    AQuebecWeaponPickup* Pistol = AQuebecWeaponPickup::SpawnPickup(Fixture.World, QuebecCombatModel::EPickupKind::Pistol, Feet);
    AQuebecWeaponPickup* Kit = AQuebecWeaponPickup::SpawnPickup(Fixture.World, QuebecCombatModel::EPickupKind::Health, Feet);
    AQuebecWeaponPickup* Vest = AQuebecWeaponPickup::SpawnPickup(Fixture.World, QuebecCombatModel::EPickupKind::Armor, Feet + FVector(400., 0., 0.));
    if (!TestTrue(TEXT("Pickups spawn"), Pistol && Kit && Vest)) return false;
    Fixture.At(5.);
    Pistol->Tick(.2f);
    TestTrue(TEXT("Walking onto the pistol takes it"), Stats->HasWeapon(EQuebecWeapon::Pistol));
    TestEqual(TEXT("The pistol comes with 12 rounds"), Stats->AmmoFor(EQuebecWeapon::Pistol), 12);
    TestTrue(TEXT("A new gun is equipped"), Stats->CurrentWeapon() == EQuebecWeapon::Pistol);
    TestFalse(TEXT("A taken pickup disappears"), Pistol->IsAvailable());
    TestEqual(TEXT("It comes back after 60 s"), Pistol->RespawnAt, 65.f, .01f);
    Pistol->Tick(.2f);
    TestEqual(TEXT("A taken pickup gives nothing more"), Stats->AmmoFor(EQuebecWeapon::Pistol), 12);
    Fixture.At(64.9);
    Pistol->Tick(.2f);
    TestFalse(TEXT("It is still gone just before 60 s"), Pistol->IsAvailable());
    Fixture.At(65.1);
    Pistol->Tick(.2f);
    TestTrue(TEXT("It is back after 60 s"), Pistol->IsAvailable());
    Pistol->Tick(.2f);
    TestEqual(TEXT("Taking it again adds rounds"), Stats->AmmoFor(EQuebecWeapon::Pistol), 24);

    Kit->Tick(.2f);
    TestTrue(TEXT("A health kit stays for someone who needs it"), Kit->IsAvailable());
    QuebecCombat::DamagePlayer(Fixture.Walker, 60.f, nullptr);
    Kit->Tick(.2f);
    TestEqual(TEXT("A health kit gives 50 health"), Stats->Health, 90.f);
    TestFalse(TEXT("The used kit disappears"), Kit->IsAvailable());

    Vest->Tick(.2f);
    TestEqual(TEXT("A vest out of reach gives nothing"), Stats->Armor, 0.f);
    Fixture.Walker->SetActorLocation(Fixture.Walker->GetActorLocation() + FVector(380., 0., 0.));
    Vest->Tick(.2f);
    TestEqual(TEXT("A vest gives 50 armour"), Stats->Armor, 50.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatFireRulesTest, "Quebec.Combat.FireRules",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatFireRulesTest::RunTest(const FString& Parameters)
{
    FCombatWorld Fixture;
    if (!TestTrue(TEXT("A walking player with a street player state"), Fixture.Ready())) return false;
    AQuebecPlayerState* Stats = Fixture.Stats;
    AQuebecCharacter* Walker = Fixture.Walker;
    const int32 Slot = static_cast<int32>(EQuebecWeapon::Pistol);
    Stats->OwnedWeapons |= 1 << Slot;
    Stats->Ammo[Slot] = 2;
    Stats->Weapon = static_cast<uint8>(Slot);
    Fixture.At(20.);
    Walker->FireWeapon(Walker->GetActorLocation(), FVector(1., 0., 0.));
    TestEqual(TEXT("A shot uses one round"), Stats->AmmoFor(EQuebecWeapon::Pistol), 1);
    Walker->FireWeapon(Walker->GetActorLocation(), FVector(1., 0., 0.));
    TestEqual(TEXT("The server holds the pistol to one shot per 0.35 s"), Stats->AmmoFor(EQuebecWeapon::Pistol), 1);
    Fixture.At(20.4);
    Walker->FireWeapon(Walker->GetActorLocation(), FVector(FMath::Sqrt(.5), FMath::Sqrt(.5), 0.));
    TestEqual(TEXT("The next shot fires after the interval"), Stats->AmmoFor(EQuebecWeapon::Pistol), 0);
    TestEqual(TEXT("A shot with no target faces the aim"), static_cast<float>(Walker->GetActorRotation().Yaw), 45.f, .5f);
    Fixture.At(20.8);
    Walker->FireWeapon(Walker->GetActorLocation(), FVector(1., 0., 0.));
    TestTrue(TEXT("An empty gun is put away for the fists"), Stats->CurrentWeapon() == EQuebecWeapon::Fists);
    Walker->FireWeapon(Walker->GetActorLocation(), FVector(std::numeric_limits<double>::quiet_NaN(), 0., 0.));
    TestFalse(TEXT("A NaN aim never reaches the transform"), Walker->GetActorRotation().ContainsNaN());
    QuebecCombat::DamagePlayer(Walker, 200.f, nullptr);
    Stats->OwnedWeapons |= 1 << Slot;
    Stats->Ammo[Slot] = 5;
    Stats->Weapon = static_cast<uint8>(Slot);
    Fixture.At(30.);
    Walker->FireWeapon(Walker->GetActorLocation(), FVector(1., 0., 0.));
    TestEqual(TEXT("A knocked-out player cannot fire"), Stats->AmmoFor(EQuebecWeapon::Pistol), 5);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCombatPickupClearanceTest, "Quebec.Combat.PickupClearance",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCombatPickupClearanceTest::RunTest(const FString& Parameters)
{
    // The live campaign anchors, so the engine-free table in QuebecCombatModel.h cannot go stale unnoticed.
    const AQuebecCampaign* Campaign = GetDefault<AQuebecCampaign>();
    if (!TestTrue(TEXT("The campaign defaults carry the race route"), Campaign && Campaign->RaceGates.Num() == 7 && Campaign->RaceDirections.Num() == 7))
        return false;
    TArray<FVector> Anchors = {Campaign->WorklightLocation, Campaign->JumpGateLocation, Campaign->FirstClampLocation,
        Campaign->CarLightLocation, Campaign->FinalClampLocation, FVector(5550., 1700., 102.), Campaign->TrapLocation,
        LaFontaine::Spawn, LaFontaine::CarSpawn, LaFontaine::Missions[0], LaFontaine::Missions[1], LaFontaine::Missions[2]};
    Anchors.Append(Campaign->RaceGates);
    const FVector Start = Campaign->RaceDirections[0];
    Anchors.Add(Campaign->RaceGates[0] - Start * 650. + FVector(-Start.Y, Start.X, 0.).GetSafeNormal() * 145.);
    for (int32 Index = 0; Index < QuebecCombatModel::QAAnchorCount; ++Index)
        Anchors.Add(FVector(QuebecCombatModel::QAAnchors[Index].X, QuebecCombatModel::QAAnchors[Index].Y, 0.));
    for (int32 Gate = 0; Gate < 6; ++Gate)
    {
        const QuebecCombatModel::FAnchor& Copy = QuebecCombatModel::QAAnchors[8 + Gate];
        TestTrue(FString::Printf(TEXT("The pickup table's gate %d matches the campaign"), Gate),
            FVector::Dist2D(FVector(Copy.X, Copy.Y, 0.), Campaign->RaceGates[Gate]) < 5.);
    }
    double Closest = 1.e9;
    for (const QuebecCombatModel::FSpot& Spot : QuebecCombatModel::PickupSpots)
        for (const FVector& Anchor : Anchors)
        {
            const double Distance = FVector::Dist2D(FVector(Spot.X, Spot.Y, 0.), Anchor);
            Closest = FMath::Min(Closest, Distance);
            if (Distance < QuebecCombatModel::PickupClearance)
                AddError(FString::Printf(TEXT("Pickup at %.0f,%.0f is %.0f cm from QA anchor %s"), Spot.X, Spot.Y, Distance, *Anchor.ToString()));
        }
    AddInfo(FString::Printf(TEXT("Closest pickup to a QA anchor: %.0f cm"), Closest));
    TestTrue(TEXT("Every pickup is at least 15 m from every QA anchor"), Closest >= QuebecCombatModel::PickupClearance);
    return true;
}
#endif
