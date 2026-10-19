#include "QuebecCombat.h"
#include "QuebecAimModel.h"
#include "QuebecGameplay.h"
#include "QuebecPlayerState.h"
#include "QuebecPolice.h"

#include "Camera/PlayerCameraManager.h"
#include "Components/AudioComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "Sound/SoundWaveProcedural.h"
#include "UObject/ConstructorHelpers.h"

static_assert(QuebecCombatModel::WeaponCount == static_cast<int32>(EQuebecWeapon::Count), "The weapon table follows EQuebecWeapon");
static_assert(static_cast<int32>(QuebecCombatModel::ESlot::HockeyStick) == static_cast<int32>(EQuebecWeapon::HockeyStick) &&
    static_cast<int32>(QuebecCombatModel::ESlot::Shotgun) == static_cast<int32>(EQuebecWeapon::Shotgun), "Weapon slots match");
static_assert(AQuebecPlayerState::WeaponCount == QuebecCombatModel::WeaponCount, "One ammo entry per weapon");

namespace
{
    constexpr float CombatAimTurnScale = .55f;
    constexpr float CombatArmLength = 420.f;
    constexpr float CombatAimArmLength = 260.f;
    constexpr float CombatLockRefreshSeconds = .2f;
    constexpr float CombatLockIdleSeconds = 1.f;
    constexpr float CombatSwingSeconds = .3f;
    constexpr float CombatMeleeLagSlack = 40.f;
    constexpr int32 CombatMaxEffects = 32;
    // Beyond these distances from the local camera a shot shows no tracer, flash or word, and then makes no sound.
    constexpr double CombatEffectRange = 12000.;
    constexpr double CombatSoundRange = 15000.;
    // Pickups spin only while rendered and this close to the local camera.
    constexpr double CombatPickupSpinRange = 6000.;
    // Police chasing the shooter are threats, but goons still win close calls with them.
    constexpr double CombatPoliceThreatPenalty = .2;
    constexpr float CombatWeaponCycleSeconds = .15f;
    const FVector CombatSocketOffset(0., 0., 55.);
    const FVector CombatAimSocketOffset(0., 70., 62.);

    const TCHAR* const CombatWeaponNames[] = {
        TEXT("POINGS"), TEXT("BÂTON DE HOCKEY"), TEXT("PISTOLET"), TEXT("MITRAILLETTE"), TEXT("FUSIL À POMPE")
    };
    const TCHAR* const CombatPickupNames[] = {
        TEXT("BÂTON DE HOCKEY"), TEXT("PISTOLET"), TEXT("MITRAILLETTE"), TEXT("FUSIL À POMPE"), TEXT("VESTE PARE-BALLES"),
        TEXT("TROUSSE DE SOINS")
    };
    // Original comic words, one per weapon slot.
    const TCHAR* const CombatWords[] = {TEXT("POW!"), TEXT("CLAC!"), TEXT("PAN!"), TEXT("RA-TA-TA!"), TEXT("BOUM!")};
    const FColor CombatWordColors[] = {
        FColor(255, 255, 255), FColor(255, 238, 193), FColor(255, 222, 60), FColor(255, 140, 40), FColor(255, 70, 50)
    };
    static_assert(UE_ARRAY_COUNT(CombatWeaponNames) == QuebecCombatModel::WeaponCount, "One name per weapon");
    static_assert(UE_ARRAY_COUNT(CombatWords) == QuebecCombatModel::WeaponCount, "One word per weapon");
    static_assert(UE_ARRAY_COUNT(CombatPickupNames) == static_cast<int32>(QuebecCombatModel::EPickupKind::Count), "One name per pickup");

    const TCHAR* const CombatInk = TEXT("/Game/ParkComic/M_Ink.M_Ink");
    const TCHAR* const CombatWood = TEXT("/Game/ParkComic/M_Wood.M_Wood");
    const TCHAR* const CombatBronze = TEXT("/Game/ParkComic/M_Bronze.M_Bronze");
    const TCHAR* const CombatGlow = TEXT("/Game/Materials/M_Light.M_Light");

    // Replicated times (down state, pickup respawn) use the shared server clock.
    float CombatNow(const UWorld* World)
    {
        if (!World) return 0.f;
        if (const AGameStateBase* GameState = World->GetGameState()) return static_cast<float>(GameState->GetServerWorldTimeSeconds());
        return static_cast<float>(World->GetTimeSeconds());
    }

    UMaterialInterface* CombatMaterial(const TCHAR* Path)
    {
        return LoadObject<UMaterialInterface>(nullptr, Path, nullptr, LOAD_NoWarn);
    }

    UStaticMesh* CombatShape(const TCHAR* Name)
    {
        return LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("/Engine/BasicShapes/%s.%s"), Name, Name));
    }

    // One basic-shape piece of a model, sized in centimetres, with no collision.
    UStaticMeshComponent* CombatPart(AActor* Owner, USceneComponent* Parent, const TCHAR* Shape, const FVector& Center,
        const FVector& Size, const FRotator& Rotation, const TCHAR* Material, TArray<TObjectPtr<UStaticMeshComponent>>& Parts)
    {
        UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(Owner);
        Owner->AddInstanceComponent(Part);
        Part->SetupAttachment(Parent);
        Part->SetStaticMesh(CombatShape(Shape));
        Part->SetRelativeLocationAndRotation(Center, Rotation);
        Part->SetRelativeScale3D(Size / 100.);
        Part->SetMobility(EComponentMobility::Movable);
        Part->SetCollisionProfileName(TEXT("NoCollision"));
        Part->SetGenerateOverlapEvents(false);
        Part->SetCanEverAffectNavigation(false);
        // Small moving parts: a shadow would invalidate cached shadow pages every frame for little gain.
        Part->SetCastShadow(false);
        if (UMaterialInterface* Mat = CombatMaterial(Material)) Part->SetMaterial(0, Mat);
        Part->RegisterComponent();
        Parts.Add(Part);
        return Part;
    }

    // The car a character rides in, if any.
    AQuebecCar* CombatCarCarrying(const AActor* Character)
    {
        AQuebecCar* Car = Character ? Cast<AQuebecCar>(Character->GetAttachParentActor()) : nullptr;
        return Car && Car->Occupant.Get() == Character ? Car : nullptr;
    }

    bool CombatTargetDown(const AActor* Target)
    {
        if (const AQuebecCar* Car = Cast<AQuebecCar>(Target)) return Car->IsWrecked();
        return QuebecPeople::IsDown(Target);
    }

    FVector CombatAimPoint(const AActor* Target)
    {
        if (Cast<AQuebecCar>(Target)) return Target->GetActorLocation() + FVector(0., 0., 60.);
        return QuebecPeople::AimPoint(Target);
    }

    // A civilian who can witness gunfire: not a player, not an officer and not a goon.
    bool CombatIsCivilian(const AActor* Person)
    {
        return Person && QuebecPeople::IsPerson(Person) && !Cast<AQuebecCharacter>(Person) && !Cast<AQuebecOfficer>(Person);
    }

    // The local viewer's eye, on peers that render.
    bool CombatLocalEye(const UWorld* World, FVector& Eye)
    {
        const APlayerController* Local = World ? World->GetFirstPlayerController() : nullptr;
        if (!Local) return false;
        FRotator View;
        Local->GetPlayerViewPoint(Eye, View);
        return true;
    }

    // Procedural bangs, like the car engine: a decaying low body plus filtered noise, peaks near 0.3. Every buffer
    // is the same each time, so each is synthesised once and reused.
    struct FCombatBang
    {
        float Seconds;
        float Pitch;
        float BodyGain;
        float NoiseGain;
        float Decay;
        float Tone;
    };
    constexpr int32 CombatBangGunImpact = 5;
    const FCombatBang CombatBangs[] = {
        {.14f, 95.f, .20f, .07f, .030f, .20f},   // Fists: POW!
        {.10f, 900.f, .10f, .14f, .012f, .90f},  // Stick: CLAC!
        {.28f, 140.f, .12f, .20f, .035f, .55f},  // Pistol: PAN!
        {.12f, 180.f, .08f, .16f, .020f, .60f},  // SMG: RA-TA-TA!
        {.45f, 80.f, .14f, .18f, .070f, .35f},   // Shotgun: BOUM!
        {.08f, 110.f, .10f, .04f, .020f, .30f},  // A bullet landing: a short thud.
    };
    static_assert(UE_ARRAY_COUNT(CombatBangs) == QuebecCombatModel::WeaponCount + 1, "One bang per weapon plus the bullet thud");

    const TArray<int16>& CombatBangSamples(int32 Index)
    {
        static TArray<int16> Cache[UE_ARRAY_COUNT(CombatBangs)];
        TArray<int16>& Samples = Cache[Index];
        if (!Samples.IsEmpty()) return Samples;
        const FCombatBang& Sound = CombatBangs[Index];
        const int32 Frames = FMath::Max(1, static_cast<int32>(24000.f * Sound.Seconds));
        Samples.SetNumUninitialized(Frames);
        uint32 Noise = 0x2545f491u ^ (static_cast<uint32>(Index) * 2654435761u);
        float Filtered = 0.f;
        for (int32 Frame = 0; Frame < Frames; ++Frame)
        {
            const float Clock = static_cast<float>(Frame) / 24000.f;
            Noise = Noise * 1664525u + 1013904223u;
            const float White = static_cast<float>(Noise >> 8) / 8388607.5f - 1.f;
            Filtered += (White - Filtered) * Sound.Tone;
            const float Sweep = Sound.Pitch * Clock * (1.f - .4f * Clock / Sound.Seconds);
            const float Body = FMath::Sin(2.f * PI * Sweep) * Sound.BodyGain * FMath::Exp(-Clock / (Sound.Decay * 2.f));
            const float Hiss = Filtered * Sound.NoiseGain * FMath::Exp(-Clock / Sound.Decay);
            const float Attack = FMath::Min(1.f, Clock / .002f);
            Samples[Frame] = static_cast<int16>(FMath::Clamp((Body + Hiss) * Attack, -1.f, 1.f) * 32767.f);
        }
        return Samples;
    }

    FVector CombatMuzzle(const AQuebecCharacter* Shooter, float Yaw)
    {
        return Shooter->GetActorLocation() + FRotator(0., Yaw, 0.).RotateVector(FVector(62., 20., 38.));
    }

    // Ground under Desired with room for a standing player: the point itself, then two rings around it.
    bool CombatFindStandingSpot(UWorld* World, const FVector& Desired, const AActor* IgnoreA, const AActor* IgnoreB, FVector& Out)
    {
        if (!World) return false;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(NordCombatStand), false, IgnoreA);
        if (IgnoreB) Query.AddIgnoredActor(IgnoreB);
        for (int32 Ring = 0; Ring < 3; ++Ring)
            for (int32 Step = 0; Step < (Ring == 0 ? 1 : 8); ++Step)
            {
                const FVector Column = Desired + FRotator(0., Step * 45., 0.).Vector() * (Ring * 250.);
                FHitResult Floor;
                if (!World->LineTraceSingleByChannel(Floor, FVector(Column.X, Column.Y, Desired.Z + 800.),
                    FVector(Column.X, Column.Y, Desired.Z - 1500.), ECC_Visibility, Query) || Floor.ImpactNormal.Z < .7f) continue;
                const FVector Standing = Floor.ImpactPoint + FVector(0., 0., 100.);
                if (World->OverlapBlockingTestByChannel(Standing, FQuat::Identity, ECC_Pawn,
                    FCollisionShape::MakeCapsule(42.f, 96.f), Query)) continue;
                Out = Standing;
                return true;
            }
        return false;
    }

    // Takes a character out of its car without the door check: a K.-O. or a respawn must always succeed.
    void CombatEject(AQuebecController* Player, AQuebecCharacter* Character, AQuebecCar* Car, const FVector& Spot, float Yaw)
    {
        const FRotator Facing(0., Yaw, 0.);
        Character->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
        Character->SetInVehicle(false);
        Character->TeleportTo(Spot, Facing, false, true);
        Car->Occupant = nullptr;
        Car->StopInput();
        if (!Player) return;
        if (Player->GetPawn() == Car) Player->Possess(Character);
        Player->ForgetWalkingCharacter();
        Player->SetControlRotation(Facing);
        Player->ClientSetRotation(Facing);
    }

    // Server: the target of a shot or swing, through QuebecAimModel. Lock and LockSince carry the hysteresis.
    AActor* CombatChooseTarget(AQuebecCharacter* Shooter, const QuebecCombatModel::FWeapon& Row, const FVector& Origin,
        const FVector& Aim, TWeakObjectPtr<AActor>& Lock, float& LockSince, float Now)
    {
        UWorld* World = Shooter->GetWorld();
        QuebecAim::FSettings Settings;
        if (Row.bMelee)
        {
            Settings.ConeDegrees = Settings.KeepConeDegrees = QuebecCombatModel::MeleeSnapDegrees;
            Settings.Range = Row.Range + QuebecCombatModel::MeleeSlack;
            Settings.KeepRangeScale = 1.;
            Settings.MaxElevationDegrees = 60.;
        }
        else Settings.Range = Row.Range;
        const double Reach = Settings.Range * Settings.KeepRangeScale;
        TArray<AActor*> People;
        QuebecPeople::Gather(World, Origin, static_cast<float>(Reach) + 100.f, People);
        TArray<AActor*> Actors;
        TArray<QuebecAim::FTarget> Targets;
        const auto AddTarget = [&Actors, &Targets, Shooter](AActor* Candidate, double Penalty)
        {
            const FVector Point = CombatAimPoint(Candidate);
            QuebecAim::FTarget Entry;
            Entry.Point = QuebecAim::FPoint{Point.X, Point.Y, Point.Z};
            Entry.Key = Candidate->GetUniqueID();
            Entry.bDown = CombatTargetDown(Candidate);
            Entry.bThreat = QuebecCrime::IsHostile(Candidate, Shooter);
            Entry.Penalty = Penalty + (Entry.bThreat && QuebecCrime::IsPolice(Candidate) ? CombatPoliceThreatPenalty : 0.);
            Actors.Add(Candidate);
            Targets.Add(Entry);
        };
        // The other player is a co-op partner and is never auto-targeted.
        for (AActor* Person : People)
            if (Person && Person != Shooter && !Cast<AQuebecCharacter>(Person)) AddTarget(Person, 0.);
        if (!Row.bMelee)
            for (TActorIterator<AQuebecCar> It(World); It; ++It)
            {
                AQuebecCar* Car = *It;
                if (Car->IsWrecked() || FVector::DistSquared(Car->GetActorLocation(), Origin) > FMath::Square(Reach)) continue;
                const AController* Driver = Car->GetDriverController();
                if (Driver && Driver->IsPlayerController()) continue;
                // Parked cars are scenery; moving traffic, police and job cars can be shot.
                if (Car->bPolice || Car->bTraffic || Car->HasAutopilot()) AddTarget(Car, .45);
            }
        QuebecAim::FLock AimLock;
        AimLock.Key = Lock.IsValid() ? Lock->GetUniqueID() : 0u;
        AimLock.AcquiredAt = LockSince;
        const QuebecAim::FChoice Choice = QuebecAim::Choose(QuebecAim::FPoint{Origin.X, Origin.Y, Origin.Z},
            QuebecAim::FPoint{Aim.X, Aim.Y, Aim.Z}, Targets.GetData(), Targets.Num(), Settings, AimLock, Now);
        if (Choice.Index < 0 || !Actors.IsValidIndex(Choice.Index))
        {
            Lock = nullptr;
            return nullptr;
        }
        Lock = Actors[Choice.Index];
        LockSince = static_cast<float>(AimLock.AcquiredAt);
        return Actors[Choice.Index];
    }

    // Server: true when nothing in the world blocks the line. Stop is where the line ends.
    bool CombatClearLine(UWorld* World, const FVector& From, const FVector& To, const AActor* Shooter, const AActor* Target, FVector& Stop)
    {
        FCollisionQueryParams Query(SCENE_QUERY_STAT(NordCombatShot), false, Shooter);
        if (Target) Query.AddIgnoredActor(Target);
        FHitResult Hit;
        if (World->LineTraceSingleByChannel(Hit, From, To, ECC_Visibility, Query))
        {
            Stop = Hit.ImpactPoint;
            return false;
        }
        Stop = To;
        return true;
    }

    // Server: a weapon landed. People are knocked and hurt through QuebecPeople; cars take body damage.
    void CombatApplyHit(AQuebecCharacter* Shooter, AActor* Target, const QuebecCombatModel::FWeapon& Row, float Damage, const FVector& Direction)
    {
        AController* Attacker = Shooter->GetController();
        if (AQuebecCar* Car = Cast<AQuebecCar>(Target))
        {
            Car->AddBodyDamage(Damage * static_cast<float>(QuebecCombatModel::CarDamageScale), Attacker);
            if (Car->bPolice) QuebecCrime::Report(Attacker, EQuebecCrime::AttackPolice, Car->GetActorLocation());
            return;
        }
        const FVector Push = Direction.GetSafeNormal2D() * Row.Push + FVector(0., 0., Row.bMelee ? 180. : 120.);
        QuebecPeople::Hit(Target, Row.bMelee ? EQuebecHitKind::Melee : EQuebecHitKind::Bullet, Damage, Push, Attacker);
    }

    // Server: zero health. The pawn is never destroyed; it lies down until the respawn.
    void CombatKnockOut(AQuebecCharacter* Victim, AQuebecPlayerState* Stats, AController* Attacker)
    {
        UWorld* World = Victim->GetWorld();
        Stats->Health = 0.f;
        Stats->DownState = static_cast<uint8>(EQuebecDownState::KnockedOut);
        Stats->DownUntil = CombatNow(World) + static_cast<float>(QuebecCombatModel::KnockOutSeconds);
        Stats->LockedTarget = nullptr;
        Stats->Changed();
        AQuebecController* Player = Cast<AQuebecController>(Stats->GetOwner());
        if (AQuebecCar* Car = CombatCarCarrying(Victim))
        {
            // A driver who goes down tumbles out beside the car, so the down state and the respawn see a walker.
            const FVector Side = Car->GetActorLocation() + Car->GetActorRightVector() * 230.;
            FVector Spot;
            if (!CombatFindStandingSpot(World, Side, Car, Victim, Spot)) Spot = Side + FVector(0., 0., 100.);
            CombatEject(Player, Victim, Car, Spot, static_cast<float>(Car->GetActorRotation().Yaw));
        }
        Victim->ReleaseCombatInput();
        FVector Push(0., 0., 220.);
        if (const APawn* AttackerPawn = Attacker ? Attacker->GetPawn() : nullptr)
            Push += (Victim->GetActorLocation() - AttackerPawn->GetActorLocation()).GetSafeNormal2D() * 260.;
        Victim->StartKnock(Push, static_cast<float>(QuebecCombatModel::KnockOutSeconds), true);
        if (Player) QuebecNotice::Show(Player, TEXT("K.-O."), TEXT("Retour à l'Hôpital Notre-Dame"), static_cast<float>(QuebecCombatModel::KnockOutSeconds));
        UE_LOG(LogTemp, Display, TEXT("NORD_COMBAT knockout player=%s by=%s"), *GetNameSafe(Victim), *GetNameSafe(Attacker));
    }

    // Every peer: the vest and the health kit, which are not weapons.
    void CombatBuildSupplyModel(AActor* Owner, USceneComponent* Parent, QuebecCombatModel::EPickupKind Kind,
        TArray<TObjectPtr<UStaticMeshComponent>>& Parts)
    {
        const FRotator Flat = FRotator::ZeroRotator;
        if (Kind == QuebecCombatModel::EPickupKind::Armor)
        {
            CombatPart(Owner, Parent, TEXT("Cube"), FVector::ZeroVector, FVector(44., 18., 56.), Flat, TEXT("/Game/ParkComic/M_Navy.M_Navy"), Parts);
            CombatPart(Owner, Parent, TEXT("Cube"), FVector(0., 0., 8.), FVector(46., 19., 8.), Flat, TEXT("/Game/ParkComic/M_Gold.M_Gold"), Parts);
            for (const double Side : {-14., 14.})
                CombatPart(Owner, Parent, TEXT("Cube"), FVector(Side, 0., 31.), FVector(10., 19., 8.), Flat, TEXT("/Game/ParkComic/M_Navy.M_Navy"), Parts);
            return;
        }
        CombatPart(Owner, Parent, TEXT("Cube"), FVector::ZeroVector, FVector(40., 28., 28.), Flat, TEXT("/Game/ParkComic/M_White.M_White"), Parts);
        CombatPart(Owner, Parent, TEXT("Cube"), FVector::ZeroVector, FVector(26., 29.5, 8.), Flat, TEXT("/Game/ParkComic/M_Red.M_Red"), Parts);
        CombatPart(Owner, Parent, TEXT("Cube"), FVector::ZeroVector, FVector(8., 29.5, 22.), Flat, TEXT("/Game/ParkComic/M_Red.M_Red"), Parts);
        CombatPart(Owner, Parent, TEXT("Cube"), FVector(0., 0., 16.), FVector(14., 6., 4.), Flat, CombatInk, Parts);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// The shared QuebecCombat contract (QuebecGTA.h) and helpers (QuebecCombat.h).

AQuebecPlayerState* QuebecCombat::State(const AActor* PawnOrController)
{
    if (!PawnOrController) return nullptr;
    if (const AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(PawnOrController)) return const_cast<AQuebecPlayerState*>(Stats);
    if (const AController* AsController = Cast<AController>(PawnOrController)) return AsController->GetPlayerState<AQuebecPlayerState>();
    if (const APawn* AsPawn = Cast<APawn>(PawnOrController))
    {
        if (AQuebecPlayerState* Stats = AsPawn->GetPlayerState<AQuebecPlayerState>()) return Stats;
        // A driver's character is unpossessed while the car carries it; the car holds the player state.
        if (const AQuebecCar* Car = CombatCarCarrying(AsPawn)) return Car->GetPlayerState<AQuebecPlayerState>();
    }
    return nullptr;
}

void QuebecCombat::DamagePlayer(AQuebecCharacter* Victim, float Damage, AController* Instigator)
{
    if (!Victim || !Victim->HasAuthority() || !FMath::IsFinite(Damage) || Damage <= 0.f) return;
    AQuebecPlayerState* Stats = State(Victim);
    if (!Stats || Stats->IsDown()) return;
    // A driver hit through the car (an officer's shot, a goon's ink) takes half; the car body takes the blow.
    float Taken = Damage;
    if (AQuebecCar* Car = CombatCarCarrying(Victim))
    {
        Car->AddBodyDamage(Damage * static_cast<float>(QuebecCombatModel::DriverHitBodyScale), Instigator);
        Taken = Damage * static_cast<float>(QuebecCombatModel::DriverDamageScale);
    }
    const QuebecCombatModel::FVitals After = QuebecCombatModel::Absorb({Stats->Health, Stats->Armor}, Taken);
    Stats->Health = static_cast<float>(After.Health);
    Stats->Armor = static_cast<float>(After.Armor);
    UE_LOG(LogTemp, Display, TEXT("NORD_COMBAT damage player=%s amount=%.1f health=%.1f armor=%.1f"),
        *GetNameSafe(Victim), Taken, Stats->Health, Stats->Armor);
    if (!QuebecCombatModel::IsKnockedOut(After))
    {
        Stats->Changed();
        return;
    }
    CombatKnockOut(Victim, Stats, Instigator);
}

void QuebecCombat::Respawn(AQuebecController* Player, EQuebecDownState Kind)
{
    if (!Player || !Player->HasAuthority()) return;
    UWorld* World = Player->GetWorld();
    AQuebecCar* Car = Cast<AQuebecCar>(Player->GetPawn());
    AQuebecCharacter* Character = Car ? Car->Occupant.Get() : Cast<AQuebecCharacter>(Player->GetPawn());
    if (!Character) return;
    const EQuebecDownState Place = Kind == EQuebecDownState::Arrested ? Kind : EQuebecDownState::KnockedOut;
    FVector Spot;
    if (!CombatFindStandingSpot(World, RespawnPoint(World, Place), Car, Character, Spot))
        Spot = QuebecDistrict::ForWorld(World).PlayerSpawn;
    if (Car) CombatEject(Player, Character, Car, Spot, 0.f);
    else
    {
        Character->GetCharacterMovement()->StopMovementImmediately();
        Character->TeleportTo(Spot, FRotator::ZeroRotator, false, true);
        Player->SetControlRotation(FRotator::ZeroRotator);
        Player->ClientSetRotation(FRotator::ZeroRotator);
    }
    Character->EndKnock();
    Character->ReleaseCombatInput();
    if (AQuebecPlayerState* Stats = State(Player)) Stats->ResetForRespawn();
    UE_LOG(LogTemp, Display, TEXT("NORD_COMBAT respawn player=%s kind=%d x=%.0f y=%.0f"),
        *GetNameSafe(Character), static_cast<int32>(Place), Spot.X, Spot.Y);
}

const TCHAR* QuebecCombat::WeaponName(EQuebecWeapon Weapon)
{
    const int32 Slot = static_cast<int32>(Weapon);
    return Slot >= 0 && Slot < QuebecCombatModel::WeaponCount ? CombatWeaponNames[Slot] : CombatWeaponNames[0];
}

const TCHAR* QuebecCombat::PickupName(QuebecCombatModel::EPickupKind Kind)
{
    const int32 Index = static_cast<int32>(Kind);
    return Index >= 0 && Index < UE_ARRAY_COUNT(CombatPickupNames) ? CombatPickupNames[Index] : TEXT("");
}

FVector QuebecCombat::RespawnPoint(const UWorld* World, EQuebecDownState Kind)
{
    if (QuebecDistrict::IsToronto(World)) return QuebecDistrict::ForWorld(World).PlayerSpawn;
    return Kind == EQuebecDownState::Arrested ? FVector(QuebecCombatModel::StationX, QuebecCombatModel::StationY, 110.)
        : FVector(QuebecCombatModel::HospitalX, QuebecCombatModel::HospitalY, 110.);
}

bool QuebecCombat::GrantPickup(AQuebecPlayerState* Stats, QuebecCombatModel::EPickupKind Kind)
{
    if (!Stats || Stats->IsDown()) return false;
    const float Grant = static_cast<float>(QuebecCombatModel::PickupGrant);
    if (Kind == QuebecCombatModel::EPickupKind::Armor)
    {
        if (Stats->Armor >= AQuebecPlayerState::MaxArmor - .5f) return false;
        Stats->Armor = FMath::Min(AQuebecPlayerState::MaxArmor, Stats->Armor + Grant);
    }
    else if (Kind == QuebecCombatModel::EPickupKind::Health)
    {
        if (Stats->Health >= AQuebecPlayerState::MaxHealth - .5f) return false;
        Stats->Health = FMath::Min(AQuebecPlayerState::MaxHealth, Stats->Health + Grant);
    }
    else
    {
        const int32 Slot = QuebecCombatModel::PickupWeaponSlot(Kind);
        if (Slot <= 0 || Slot >= QuebecCombatModel::WeaponCount) return false;
        const QuebecCombatModel::FWeapon& Row = QuebecCombatModel::Weapon(Slot);
        const EQuebecWeapon Which = static_cast<EQuebecWeapon>(Slot);
        const bool bNew = !Stats->HasWeapon(Which);
        if (!bNew && (Row.bMelee || Stats->AmmoFor(Which) >= Row.MaxAmmo)) return false;
        if (Stats->Ammo.Num() < AQuebecPlayerState::WeaponCount) Stats->Ammo.SetNumZeroed(AQuebecPlayerState::WeaponCount);
        Stats->OwnedWeapons |= 1 << Slot;
        Stats->Ammo[Slot] = QuebecCombatModel::AddAmmo(Row, Stats->Ammo[Slot], Row.AmmoPerPickup);
        if (bNew) Stats->Weapon = static_cast<uint8>(Slot);
    }
    Stats->Changed();
    return true;
}

EQuebecWeapon QuebecCombat::NextOwnedWeapon(const AQuebecPlayerState* Stats)
{
    if (!Stats) return EQuebecWeapon::Fists;
    for (int32 Step = 1; Step <= QuebecCombatModel::WeaponCount; ++Step)
    {
        const int32 Slot = (Stats->Weapon + Step) % QuebecCombatModel::WeaponCount;
        const EQuebecWeapon Candidate = static_cast<EQuebecWeapon>(Slot);
        if (Slot == 0 || (Stats->HasWeapon(Candidate) && (QuebecCombatModel::Weapon(Slot).bMelee || Stats->AmmoFor(Candidate) > 0)))
            return Candidate;
    }
    return EQuebecWeapon::Fists;
}

int32 QuebecCombat::SpawnPickups(UWorld* World)
{
    if (!World || World->GetNetMode() == NM_Client || QuebecDistrict::IsToronto(World)) return 0;
    int32 Spawned = 0;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(NordPickupGround), false);
    for (const QuebecCombatModel::FSpot& Spot : QuebecCombatModel::PickupSpots)
    {
        // Start the trace low so it finds the street or the path, not a canopy or a balcony.
        FVector Ground(Spot.X, Spot.Y, 10.);
        FHitResult Floor;
        if (World->LineTraceSingleByChannel(Floor, FVector(Spot.X, Spot.Y, 400.), FVector(Spot.X, Spot.Y, -600.), ECC_Visibility, Query) &&
            Floor.ImpactNormal.Z > .7f)
            Ground.Z = Floor.ImpactPoint.Z;
        if (AQuebecWeaponPickup::SpawnPickup(World, Spot.Kind, Ground)) ++Spawned;
    }
    UE_LOG(LogTemp, Display, TEXT("NORD_COMBAT pickups=%d"), Spawned);
    return Spawned;
}

void QuebecCombat::BuildWeaponModel(AActor* Owner, USceneComponent* Parent, int32 Slot, float Scale,
    TArray<TObjectPtr<UStaticMeshComponent>>& Parts)
{
    if (!Owner || !Parent) return;
    // Each model sits in its own frame: the grip at the origin, the barrel or blade along +X, up along +Z.
    const double Size = Scale;
    const FRotator Flat = FRotator::ZeroRotator, Barrel(-90., 0., 0.);
    const auto Piece = [Owner, Parent, Size, &Parts](const TCHAR* Shape, const FVector& Center, const FVector& Extent,
        const FRotator& Rotation, const TCHAR* Material)
    {
        CombatPart(Owner, Parent, Shape, Center * Size, Extent * Size, Rotation, Material, Parts);
    };
    switch (static_cast<QuebecCombatModel::ESlot>(Slot))
    {
    case QuebecCombatModel::ESlot::HockeyStick:
        Piece(TEXT("Cube"), FVector(0., 0., -55.), FVector(4., 3., 150.), Flat, CombatWood);
        Piece(TEXT("Cube"), FVector(14., 0., -128.), FVector(34., 4., 10.), Flat, CombatInk);
        Piece(TEXT("Cube"), FVector(0., 0., 14.), FVector(5., 4., 12.), Flat, CombatInk);
        break;
    case QuebecCombatModel::ESlot::Pistol:
        Piece(TEXT("Cube"), FVector(8., 0., 8.), FVector(24., 5., 7.), Flat, CombatInk);
        Piece(TEXT("Cube"), FVector(0., 0., 0.), FVector(6., 4.5, 13.), Flat, CombatWood);
        Piece(TEXT("Cylinder"), FVector(21., 0., 9.), FVector(2.4, 2.4, 4.), Barrel, CombatBronze);
        break;
    case QuebecCombatModel::ESlot::SMG:
        Piece(TEXT("Cube"), FVector(8., 0., 7.), FVector(32., 6., 9.), Flat, CombatInk);
        Piece(TEXT("Cube"), FVector(6., 0., -6.), FVector(5., 4., 16.), Flat, CombatInk);
        Piece(TEXT("Cube"), FVector(-14., 0., 6.), FVector(14., 4., 6.), Flat, CombatWood);
        Piece(TEXT("Cube"), FVector(0., 0., -2.), FVector(5., 4., 10.), Flat, CombatInk);
        Piece(TEXT("Cylinder"), FVector(28., 0., 8.), FVector(2.5, 2.5, 10.), Barrel, CombatBronze);
        break;
    case QuebecCombatModel::ESlot::Shotgun:
        Piece(TEXT("Cylinder"), FVector(32., 0., 9.), FVector(4., 4., 60.), Barrel, CombatInk);
        Piece(TEXT("Cylinder"), FVector(24., 0., 5.), FVector(6., 6., 14.), Barrel, CombatWood);
        Piece(TEXT("Cube"), FVector(-14., 0., 4.), FVector(30., 5., 9.), Flat, CombatWood);
        Piece(TEXT("Cube"), FVector(2., 0., 8.), FVector(16., 6., 9.), Flat, CombatInk);
        break;
    default:
        break;
    }
}

// ---------------------------------------------------------------------------------------------------------------
// AQuebecCharacter: weapons for a walking player.

bool AQuebecCharacter::CanUseWeapons() const
{
    if (!Controller || bInVehicle || IsInputLocked() || GetCharacterMovement()->IsSwimming()) return false;
    const AQuebecPlayerState* Stats = QuebecCombat::State(this);
    return Stats && !Stats->IsDown();
}

void AQuebecCharacter::ReleaseCombatInput()
{
    // Runs on both peers (SetInVehicle and OnRep_InVehicle, K.-O., respawn, a lost browser), so the server's
    // automatic fire stops without a call from a client that may no longer own this character.
    bFireHeld = false;
    PendingWeaponCycles = 0;
    MeleeHitAt = -1.f;
    MeleeTarget = nullptr;
    SetCombatAiming(false);
    if (HasAuthority()) AimLock = nullptr;
    if (AimBlend > 0.f && CameraArm)
    {
        AimBlend = 0.f;
        CameraArm->TargetArmLength = CombatArmLength;
        CameraArm->SocketOffset = CombatSocketOffset;
    }
}

void AQuebecCharacter::SetCombatAiming(bool bNewAiming)
{
    if (bCombatAiming == bNewAiming) return;
    bCombatAiming = bNewAiming;
    // Aiming turns the body with the camera instead of the walking direction, like an over-the-shoulder shooter.
    bUseControllerRotationYaw = bNewAiming;
    GetCharacterMovement()->bOrientRotationToMovement = !bNewAiming;
}

FVector AQuebecCharacter::LocalAimDirection() const
{
    const FRotator View = Controller ? Controller->GetControlRotation() : GetActorRotation();
    return FRotator(0., View.Yaw, 0.).Vector();
}

void AQuebecCharacter::StartFire()
{
    bFireHeld = true;
    SendFire();
}

void AQuebecCharacter::StopFire()
{
    const bool bWasHeld = bFireHeld;
    bFireHeld = false;
    if (bWasHeld) ServerStopFire();
}

void AQuebecCharacter::StartAim()
{
    if (!CanUseWeapons()) return;
    SetCombatAiming(true);
    ServerSetAim(true);
}

void AQuebecCharacter::StopAim()
{
    const bool bWasAiming = bCombatAiming;
    SetCombatAiming(false);
    if (bWasAiming) ServerSetAim(false);
}

void AQuebecCharacter::CycleWeapon()
{
    // Wheel notches pile up here and go to the server together (TickCombat).
    PendingWeaponCycles = static_cast<uint8>(FMath::Min(PendingWeaponCycles + 1, QuebecCombatModel::WeaponCount - 1));
}

void AQuebecCharacter::TurnView(float Value)
{
    // Aiming turns the camera slower so a thumb or a mouse can settle on a target over the stream.
    AddControllerYawInput(bCombatAiming ? Value * CombatAimTurnScale : Value);
}

void AQuebecCharacter::SendFire()
{
    if (!CanUseWeapons()) return;
    const AQuebecPlayerState* Stats = QuebecCombat::State(this);
    const float Now = static_cast<float>(GetWorld()->GetTimeSeconds());
    if (!Stats || Now < NextLocalFireAt) return;
    // One reliable call per press; an automatic weapon keeps firing on the server until the release.
    NextLocalFireAt = Now + .06f;
    ServerFire(GetActorLocation(), LocalAimDirection());
}

void AQuebecCharacter::ServerFire_Implementation(FVector_NetQuantize AimOrigin, FVector_NetQuantizeNormal AimDirection)
{
    bFireHeld = true;
    FireWeapon(AimOrigin, AimDirection);
}

void AQuebecCharacter::ServerStopFire_Implementation() { bFireHeld = false; }

void AQuebecCharacter::ServerSetAim_Implementation(bool bNewAiming)
{
    SetCombatAiming(bNewAiming && CanUseWeapons());
    if (bCombatAiming) LastAimOrFireAt = static_cast<float>(GetWorld()->GetTimeSeconds());
}

void AQuebecCharacter::ServerCycleWeapon_Implementation(uint8 Steps)
{
    AQuebecPlayerState* Stats = QuebecCombat::State(this);
    if (!Stats || Stats->IsDown()) return;
    const uint8 Before = Stats->Weapon;
    for (int32 Step = 0; Step < FMath::Clamp(static_cast<int32>(Steps), 1, QuebecCombatModel::WeaponCount - 1); ++Step)
        Stats->Weapon = static_cast<uint8>(QuebecCombat::NextOwnedWeapon(Stats));
    if (Stats->Weapon == Before) return;
    MeleeHitAt = -1.f;
    Stats->Changed();
}

void AQuebecCharacter::FireWeapon(const FVector& AimOrigin, const FVector& AimDirection)
{
    if (!HasAuthority() || !CanUseWeapons()) return;
    AQuebecPlayerState* Stats = QuebecCombat::State(this);
    UWorld* World = GetWorld();
    const float Now = static_cast<float>(World->GetTimeSeconds());
    if (!Stats || !QuebecCombatModel::CanFireAt(Now, NextServerFireAt)) return;
    // The client only says where it aims; the server owns the origin, the target and the hit.
    const FVector Origin = !AimOrigin.ContainsNaN() && FVector::DistSquared(AimOrigin, GetActorLocation()) < FMath::Square(300.)
        ? AimOrigin : GetActorLocation();
    FVector Aim = AimDirection.ContainsNaN() ? FVector::ZeroVector : FVector(AimDirection.X, AimDirection.Y, 0.);
    if (!Aim.Normalize()) Aim = GetActorForwardVector();
    int32 Slot = Stats->Weapon;
    if (Slot >= QuebecCombatModel::WeaponCount || !Stats->HasWeapon(static_cast<EQuebecWeapon>(Slot))) Slot = 0;
    const QuebecCombatModel::FWeapon& Row = QuebecCombatModel::Weapon(Slot);
    if (!Row.bMelee && Stats->AmmoFor(static_cast<EQuebecWeapon>(Slot)) <= 0)
    {
        // Empty: put the gun away like GTA does and let the next press use what is left.
        Stats->Weapon = static_cast<uint8>(QuebecCombat::NextOwnedWeapon(Stats));
        Stats->Changed();
        return;
    }
    // Keep the cadence of held automatic fire: the next shot is due one interval after the last one was due.
    NextServerFireAt = (Now - NextServerFireAt < Row.Interval ? NextServerFireAt : Now) + static_cast<float>(Row.Interval);
    LastAimOrFireAt = Now;
    if (!Row.bMelee)
    {
        Stats->Ammo[Slot] = FMath::Max(0, Stats->Ammo[Slot] - 1);
        Stats->Changed();
    }
    AActor* Target = CombatChooseTarget(this, Row, Origin, Aim, AimLock, AimLockSince, Now);
    const FVector TargetPoint = Target ? CombatAimPoint(Target) : Origin + Aim * Row.Range;
    const float Yaw = static_cast<float>((Target ? (TargetPoint - Origin).GetSafeNormal2D() : Aim).Rotation().Yaw);
    // Snap the body toward the target: up to 90 degrees for melee, inside the 25 degree cone for guns.
    SetActorRotation(FRotator(0., Yaw, 0.));
    if (Row.bMelee)
    {
        MeleeTarget = Target;
        MeleeWeapon = static_cast<uint8>(Slot);
        MeleeHitAt = Now + static_cast<float>(Row.HitDelay);
        MulticastSwing(static_cast<uint8>(Slot), Yaw);
        return;
    }
    const FVector Muzzle = CombatMuzzle(this, Yaw);
    FVector Impact;
    bool bHit = false;
    if (Target)
    {
        bHit = CombatClearLine(World, Muzzle, TargetPoint, this, Target, Impact);
        if (bHit)
        {
            const double Distance = FVector::Dist2D(Origin, TargetPoint);
            CombatApplyHit(this, Target, Row, static_cast<float>(QuebecCombatModel::DamageAt(Row, Distance)), TargetPoint - Origin);
        }
    }
    else CombatClearLine(World, Muzzle, Muzzle + Aim * Row.Range, this, nullptr, Impact);
    MulticastShot(Muzzle, Impact, static_cast<uint8>(Slot), bHit, Yaw);
    // A shot near civilians is a crime the police can hear about, and the street runs from it. Shots at goons, or
    // at police already chasing the shooter, are not reported as gunfire; a civilian actually hit is reported by
    // QuebecPeople::Hit as an attack.
    const bool bAtHostile = Target && QuebecCrime::IsHostile(Target, this);
    if (!bAtHostile && Now >= NextGunfireReportAt)
    {
        TArray<AActor*> Witnesses;
        QuebecPeople::Gather(World, Muzzle, static_cast<float>(QuebecCombatModel::GunfireWitnessRadius), Witnesses);
        if (Witnesses.ContainsByPredicate([](const AActor* Person) { return CombatIsCivilian(Person); }))
        {
            QuebecCrime::Report(GetController(), EQuebecCrime::Gunfire, Muzzle);
            NextGunfireReportAt = Now + static_cast<float>(QuebecCombatModel::GunfireReportSeconds);
        }
    }
    if (Now >= NextGunAlarmAt)
    {
        QuebecPeople::Alarm(World, Muzzle, static_cast<float>(QuebecCombatModel::GunfireAlarmRadius));
        NextGunAlarmAt = Now + 1.f;
    }
    UE_LOG(LogTemp, Verbose, TEXT("NORD_COMBAT shot weapon=%d target=%s hit=%d"), Slot, *GetNameSafe(Target), bHit ? 1 : 0);
}

void AQuebecCharacter::TickCombat(float DeltaSeconds)
{
    const float Now = static_cast<float>(GetWorld()->GetTimeSeconds());
    if (bCombatAiming && Controller && !CanUseWeapons()) SetCombatAiming(false);
    if (IsLocallyControlled())
    {
        UpdateAimCamera(DeltaSeconds);
        if (PendingWeaponCycles > 0 && Now >= NextWeaponCycleAt)
        {
            ServerCycleWeapon(PendingWeaponCycles);
            PendingWeaponCycles = 0;
            NextWeaponCycleAt = Now + CombatWeaponCycleSeconds;
        }
    }
    if (GetNetMode() != NM_DedicatedServer)
    {
        UpdateHeldWeapon();
        AnimateHeldWeapon(Now);
    }
    if (HasAuthority()) TickCombatServer(Now);
}

void AQuebecCharacter::TickCombatServer(float Now)
{
    AQuebecPlayerState* Stats = QuebecCombat::State(this);
    if (!Stats) return;
    if (Stats->IsDown())
    {
        // The K.-O. or ARRÊTÉ banner has run its 4 s: stand up at the hospital or the police station.
        if (CombatNow(GetWorld()) >= Stats->DownUntil)
            if (AQuebecController* Player = Cast<AQuebecController>(GetController())) QuebecCombat::Respawn(Player, Stats->GetDownState());
        return;
    }
    // A swing lands a moment after it starts, if its target is still in reach and in sight.
    if (MeleeHitAt >= 0.f && Now >= MeleeHitAt)
    {
        MeleeHitAt = -1.f;
        AActor* Target = MeleeTarget.Get();
        MeleeTarget = nullptr;
        const QuebecCombatModel::FWeapon& Row = QuebecCombatModel::Weapon(MeleeWeapon);
        if (Target && CanUseWeapons() && !CombatTargetDown(Target))
        {
            const FVector Point = CombatAimPoint(Target);
            const FVector Offset = Point - GetActorLocation();
            FVector Stop;
            if (Offset.Size2D() <= Row.Range + QuebecCombatModel::MeleeSlack + CombatMeleeLagSlack && FMath::Abs(Offset.Z) < 200. &&
                CombatClearLine(GetWorld(), GetActorLocation() + FVector(0., 0., 40.), Point, this, Target, Stop))
            {
                CombatApplyHit(this, Target, Row, static_cast<float>(Row.Damage), Offset);
                MulticastImpact(Point, MeleeWeapon);
            }
        }
    }
    // Held Fire: an automatic weapon keeps firing here, so a burst costs the client two reliable calls.
    if (bFireHeld && QuebecCombatModel::Weapon(Stats->Weapon).bAutomatic && Now >= NextServerFireAt)
        FireWeapon(GetActorLocation(), LocalAimDirection());
    // While aiming, keep a lock for the HUD reticle; it drops a second after the player stops aiming and firing.
    if (bCombatAiming && Now >= AimLockRefreshAt && CanUseWeapons())
    {
        AimLockRefreshAt = Now + CombatLockRefreshSeconds;
        LastAimOrFireAt = Now;
        CombatChooseTarget(this, QuebecCombatModel::Weapon(Stats->Weapon), GetActorLocation(), LocalAimDirection(), AimLock, AimLockSince, Now);
    }
    if (AimLock.IsValid() && (CombatTargetDown(AimLock.Get()) || Now - LastAimOrFireAt > CombatLockIdleSeconds || !CanUseWeapons()))
        AimLock = nullptr;
    AActor* Locked = AimLock.Get();
    if (Stats->LockedTarget.Get() != Locked)
    {
        Stats->LockedTarget = Locked;
        Stats->Changed();
    }
}

void AQuebecCharacter::UpdateAimCamera(float DeltaSeconds)
{
    const float Goal = bCombatAiming ? 1.f : 0.f;
    if (AimBlend == Goal) return;
    AimBlend = FMath::FInterpConstantTo(AimBlend, Goal, DeltaSeconds, 5.f);
    // Over the right shoulder and closer; KeepCharacterInView still clamps the pitch to -25..-5.
    const float Blend = FMath::SmoothStep(0.f, 1.f, AimBlend);
    CameraArm->TargetArmLength = FMath::Lerp(CombatArmLength, CombatAimArmLength, Blend);
    CameraArm->SocketOffset = CombatSocketOffset + (CombatAimSocketOffset - CombatSocketOffset) * static_cast<double>(Blend);
}

void AQuebecCharacter::UpdateHeldWeapon()
{
    const AQuebecPlayerState* Stats = QuebecCombat::State(this);
    const uint8 Slot = Stats && Stats->Weapon < QuebecCombatModel::WeaponCount ? Stats->Weapon : 0;
    if (Slot == ShownWeapon) return;
    ShownWeapon = Slot;
    for (UStaticMeshComponent* Part : WeaponParts)
        if (Part) Part->DestroyComponent();
    WeaponParts.Reset();
    // The crew member's own plunger or tube goes away while a weapon is in hand.
    CrewProp->SetVisibility(Slot == 0);
    if (Slot == 0) return;
    if (!WeaponPivot)
    {
        WeaponPivot = NewObject<USceneComponent>(this);
        AddInstanceComponent(WeaponPivot);
        // Crew skeletons carry a RightHand socket (the plunger uses it); other meshes hold it at the hip.
        if (GetMesh()->DoesSocketExist(TEXT("RightHand"))) WeaponPivot->SetupAttachment(GetMesh(), TEXT("RightHand"));
        else
        {
            WeaponPivot->SetupAttachment(GetCapsuleComponent());
            WeaponPivot->SetRelativeLocation(FVector(26., 24., 4.));
        }
        // The hand bone's axes differ between rigs, so the weapon takes its rotation from the body instead.
        WeaponPivot->SetUsingAbsoluteRotation(true);
        WeaponPivot->RegisterComponent();
    }
    QuebecCombat::BuildWeaponModel(this, WeaponPivot, Slot, 1.f, WeaponParts);
}

void AQuebecCharacter::AnimateHeldWeapon(float Now)
{
    const float SwingAge = Now - SwingStartedAt;
    const float SwingPhase = FMath::Clamp(SwingAge / CombatSwingSeconds, 0.f, 1.f);
    const bool bSwinging = SwingAge >= 0.f && SwingAge < CombatSwingSeconds;
    if (WeaponPivot && ShownWeapon != 0)
    {
        const QuebecCombatModel::FWeapon& Row = QuebecCombatModel::Weapon(ShownWeapon);
        // The stick tilts its blade forward; guns point ahead and kick up for a moment after each shot.
        FRotator Hold(Row.bMelee ? 35. : 0., GetActorRotation().Yaw, 0.);
        if (Row.bMelee && bSwinging)
        {
            Hold.Yaw += FMath::Lerp(-75.f, 60.f, SwingPhase);
            Hold.Pitch += 40.f * FMath::Sin(SwingPhase * PI);
        }
        else if (!Row.bMelee) Hold.Pitch += 14.f * FMath::Clamp(1.f - (Now - ShotKickAt) / .1f, 0.f, 1.f);
        WeaponPivot->SetWorldRotation(Hold);
    }
    // Fists: a comic glove shoots out from the chest and comes back.
    const bool bPunching = ShownWeapon == 0 && SwingWeapon == 0 && bSwinging;
    if (bPunching && !PunchFist)
    {
        TArray<TObjectPtr<UStaticMeshComponent>> Glove;
        PunchFist = CombatPart(this, GetCapsuleComponent(), TEXT("Sphere"), FVector::ZeroVector, FVector(16., 16., 16.),
            FRotator::ZeroRotator, TEXT("/Game/ParkComic/M_Cream.M_Cream"), Glove);
        PunchFist->SetCastShadow(false);
    }
    if (PunchFist)
    {
        PunchFist->SetVisibility(bPunching);
        if (bPunching) PunchFist->SetRelativeLocation(FVector(30. + 55. * FMath::Sin(SwingPhase * PI), 22., 38.));
    }
}

void AQuebecCharacter::MulticastSwing_Implementation(uint8 Slot, float Yaw)
{
    if (!HasAuthority()) SetActorRotation(FRotator(0., Yaw, 0.));
    SwingStartedAt = static_cast<float>(GetWorld()->GetTimeSeconds());
    SwingWeapon = Slot;
}

void AQuebecCharacter::MulticastShot_Implementation(FVector_NetQuantize Muzzle, FVector_NetQuantize Impact, uint8 Slot, bool bHit, float Yaw)
{
    if (!HasAuthority()) SetActorRotation(FRotator(0., Yaw, 0.));
    if (GetNetMode() == NM_DedicatedServer) return;
    const float Now = static_cast<float>(GetWorld()->GetTimeSeconds());
    ShotKickAt = Now;
    // RA-TA-TA! once per burst, not on every bullet.
    const bool bWord = Slot != static_cast<uint8>(EQuebecWeapon::SMG) || Now - LastShotWordAt > .45f;
    if (bWord) LastShotWordAt = Now;
    AQuebecCombatFX::PlayShot(GetWorld(), Muzzle, Impact, Slot, bHit, bWord);
}

void AQuebecCharacter::MulticastImpact_Implementation(FVector_NetQuantize Point, uint8 Slot)
{
    if (GetNetMode() == NM_DedicatedServer) return;
    AQuebecCombatFX::PlayImpact(GetWorld(), Point, Slot);
}

// ---------------------------------------------------------------------------------------------------------------
// AQuebecWeaponPickup

AQuebecWeaponPickup::AQuebecWeaponPickup()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetNetUpdateFrequency(2.f);
    Base = CreateDefaultSubobject<USceneComponent>(TEXT("PickupBase"));
    SetRootComponent(Base);
    Spinner = CreateDefaultSubobject<USceneComponent>(TEXT("PickupSpinner"));
    Spinner->SetupAttachment(Base);
    Spinner->SetRelativeLocation(FVector(0., 0., 75.));
    Ring = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("PickupRing"));
    Ring->SetupAttachment(Base);
    Ring->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Ring->SetCastShadow(false);
    Ring->SetCanEverAffectNavigation(false);
}

AQuebecWeaponPickup* AQuebecWeaponPickup::SpawnPickup(UWorld* World, QuebecCombatModel::EPickupKind NewKind, const FVector& Location)
{
    if (!World || NewKind >= QuebecCombatModel::EPickupKind::Count) return nullptr;
    const FTransform Transform(Location);
    AQuebecWeaponPickup* Pickup = World->SpawnActorDeferred<AQuebecWeaponPickup>(AQuebecWeaponPickup::StaticClass(), Transform,
        nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
    if (!Pickup) return nullptr;
    Pickup->Kind = static_cast<uint8>(NewKind);
    Pickup->FinishSpawning(Transform);
    return Pickup;
}

void AQuebecWeaponPickup::BeginPlay()
{
    Super::BeginPlay();
    if (GetNetMode() != NM_DedicatedServer) BuildModel();
}

void AQuebecWeaponPickup::BuildModel()
{
    if (BuiltKind == Kind) return;
    BuiltKind = Kind;
    for (UStaticMeshComponent* Part : ModelParts)
        if (Part) Part->DestroyComponent();
    ModelParts.Reset();
    const QuebecCombatModel::EPickupKind Which = GetKind();
    const int32 Slot = QuebecCombatModel::PickupWeaponSlot(Which);
    if (Slot > 0) QuebecCombat::BuildWeaponModel(this, Spinner, Slot, Slot == static_cast<int32>(QuebecCombatModel::ESlot::HockeyStick) ? .5f : 1.7f, ModelParts);
    else CombatBuildSupplyModel(this, Spinner, Which, ModelParts);
    // A ring of glowing tiles on the ground: white-gold for weapons, lime for vests, red for health.
    Ring->ClearInstances();
    Ring->SetStaticMesh(CombatShape(TEXT("Cube")));
    const TCHAR* RingMaterial = Slot > 0 ? CombatGlow : Which == QuebecCombatModel::EPickupKind::Armor
        ? TEXT("/Game/ParkComic/M_Lime.M_Lime") : TEXT("/Game/ParkComic/M_Red.M_Red");
    if (UMaterialInterface* Mat = CombatMaterial(RingMaterial)) Ring->SetMaterial(0, Mat);
    for (int32 Tile = 0; Tile < 16; ++Tile)
    {
        const double Angle = Tile * 22.5;
        Ring->AddInstance(FTransform(FRotator(0., Angle + 90., 0.), FRotator(0., Angle, 0.).Vector() * 70. + FVector(0., 0., 3.),
            FVector(.26, .06, .03)));
    }
    OnRep_Available();
}

void AQuebecWeaponPickup::OnRep_Kind()
{
    if (GetNetMode() != NM_DedicatedServer && HasActorBegunPlay()) BuildModel();
}

void AQuebecWeaponPickup::OnRep_Available()
{
    Spinner->SetVisibility(bAvailable, true);
    Ring->SetVisibility(bAvailable);
}

void AQuebecWeaponPickup::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    UWorld* World = GetWorld();
    // Spin only where someone can see it: rendered recently and within 60 m of the local camera.
    FVector Eye;
    if (bAvailable && GetNetMode() != NM_DedicatedServer && WasRecentlyRendered(.25f) && CombatLocalEye(World, Eye) &&
        FVector::DistSquared(Eye, GetActorLocation()) < FMath::Square(CombatPickupSpinRange))
    {
        const float Clock = static_cast<float>(World->GetTimeSeconds());
        Spinner->SetRelativeLocationAndRotation(FVector(0., 0., 75. + 8. * FMath::Sin(Clock * 2.2f)),
            FRotator(0., FMath::Fmod(Clock * 90.f, 360.f), 0.));
    }
    if (!HasAuthority()) return;
    if (!bAvailable)
    {
        if (CombatNow(World) < RespawnAt) return;
        bAvailable = true;
        OnRep_Available();
        ForceNetUpdate();
        return;
    }
    TouchElapsed += DeltaSeconds;
    if (TouchElapsed < .1f) return;
    TouchElapsed = 0.f;
    for (TActorIterator<AQuebecCharacter> It(World); It; ++It)
        if (TryGive(*It)) return;
}

bool AQuebecWeaponPickup::TryGive(AQuebecCharacter* Taker)
{
    // Walking players only: a driver's character rides hidden in the car and cannot use weapons.
    if (!HasAuthority() || !bAvailable || !Taker || !Taker->CanUseWeapons()) return false;
    const FVector Offset = Taker->GetActorLocation() - GetActorLocation();
    if (Offset.SizeSquared2D() > FMath::Square(QuebecCombatModel::PickupRadius) || FMath::Abs(Offset.Z) > QuebecCombatModel::PickupHeight)
        return false;
    const QuebecCombatModel::EPickupKind Which = GetKind();
    if (!QuebecCombat::GrantPickup(QuebecCombat::State(Taker), Which)) return false;
    bAvailable = false;
    RespawnAt = CombatNow(GetWorld()) + static_cast<float>(QuebecCombatModel::PickupRespawnSeconds);
    OnRep_Available();
    ForceNetUpdate();
    const int32 Slot = QuebecCombatModel::PickupWeaponSlot(Which);
    const FString Detail = Which == QuebecCombatModel::EPickupKind::Armor ? FString(TEXT("+50 armure"))
        : Which == QuebecCombatModel::EPickupKind::Health ? FString(TEXT("+50 santé"))
        : QuebecCombatModel::Weapon(Slot).bMelee ? FString(TEXT("F ou clic gauche / frapper"))
        : FString::Printf(TEXT("+%d munitions  /  Q change d'arme"), QuebecCombatModel::Weapon(Slot).AmmoPerPickup);
    if (AController* Player = Taker->GetController()) QuebecNotice::Show(Player, QuebecCombat::PickupName(Which), Detail, 2.5f);
    UE_LOG(LogTemp, Display, TEXT("NORD_COMBAT pickup kind=%d player=%s"), static_cast<int32>(Kind), *GetNameSafe(Taker));
    return true;
}

void AQuebecWeaponPickup::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecWeaponPickup, Kind);
    DOREPLIFETIME(AQuebecWeaponPickup, bAvailable);
    DOREPLIFETIME(AQuebecWeaponPickup, RespawnAt);
}

// ---------------------------------------------------------------------------------------------------------------
// AQuebecCombatFX

AQuebecCombatFX::AQuebecCombatFX()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = false;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    // Both folders are always cooked; the optional finders keep a missing asset from failing anything.
    static ConstructorHelpers::FObjectFinderOptional<UMaterialInterface> GlowAsset(TEXT("/Game/Materials/M_Light.M_Light"));
    static ConstructorHelpers::FObjectFinderOptional<UMaterialInterface> TextAsset(TEXT("/Game/ParkComic/M_Text.M_Text"));
    UMaterialInterface* Glow = GlowAsset.Get();
    Base = CreateDefaultSubobject<USceneComponent>(TEXT("EffectBase"));
    SetRootComponent(Base);
    for (int32 Index = 0; Index < TracerCount; ++Index)
    {
        UStaticMeshComponent* Tracer = CreateDefaultSubobject<UStaticMeshComponent>(*FString::Printf(TEXT("Tracer%d"), Index));
        Tracer->SetupAttachment(Base);
        Tracer->SetStaticMesh(CylinderAsset.Object);
        if (Glow) Tracer->SetMaterial(0, Glow);
        Tracer->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Tracer->SetCastShadow(false);
        Tracer->SetVisibility(false);
        Tracers.Add(Tracer);
    }
    Flash = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MuzzleFlash"));
    Flash->SetupAttachment(Base);
    Flash->SetStaticMesh(SphereAsset.Object);
    if (Glow) Flash->SetMaterial(0, Glow);
    Flash->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Flash->SetCastShadow(false);
    Flash->SetVisibility(false);
    FlashLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("MuzzleLight"));
    FlashLight->SetupAttachment(Base);
    FlashLight->SetIntensityUnits(ELightUnits::Candelas);
    FlashLight->SetIntensity(0.f);
    FlashLight->SetAttenuationRadius(650.f);
    FlashLight->SetLightColor(FLinearColor(1.f, .78f, .4f));
    FlashLight->SetCastShadows(false);
    FlashLight->SetVisibility(false);
    Word = CreateDefaultSubobject<UTextRenderComponent>(TEXT("ImpactWord"));
    Word->SetupAttachment(Base);
    Word->SetHorizontalAlignment(EHTA_Center);
    Word->SetVerticalAlignment(EVRTA_TextCenter);
    if (UMaterialInterface* TextMaterial = TextAsset.Get()) Word->SetTextMaterial(TextMaterial);
    Word->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Word->SetVisibility(false);
    Audio = CreateDefaultSubobject<UAudioComponent>(TEXT("Bang"));
    Audio->SetupAttachment(Base);
    Audio->bAutoActivate = false;
    Audio->bAllowSpatialization = false;
}

AQuebecCombatFX* AQuebecCombatFX::Begin(UWorld* World, const FVector& Location)
{
    if (!World || World->GetNetMode() == NM_DedicatedServer) return nullptr;
    // A pool per world: an idle effect is reused, and a burst from every gun on the map stays bounded.
    int32 Alive = 0;
    for (TActorIterator<AQuebecCombatFX> It(World); It; ++It)
    {
        ++Alive;
        if (It->bBusy) continue;
        It->Restart(Location);
        return *It;
    }
    if (Alive >= CombatMaxEffects) return nullptr;
    FActorSpawnParameters Parameters;
    Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    Parameters.ObjectFlags |= RF_Transient;
    AQuebecCombatFX* Effect = World->SpawnActor<AQuebecCombatFX>(Location, FRotator::ZeroRotator, Parameters);
    if (Effect) Effect->Restart(Location);
    return Effect;
}

void AQuebecCombatFX::Restart(const FVector& Location)
{
    SetActorLocation(Location);
    Age = 0.f;
    FlashSeconds = 0.f;
    TracerLengths.Reset();
    for (UStaticMeshComponent* Tracer : Tracers) Tracer->SetVisibility(false);
    Flash->SetVisibility(false);
    FlashLight->SetVisibility(false);
    Word->SetVisibility(false);
    Word->SetWorldScale3D(FVector::OneVector);
    bWordShown = false;
    bBusy = true;
    SetActorTickEnabled(true);
}

void AQuebecCombatFX::Finish()
{
    for (UStaticMeshComponent* Tracer : Tracers) Tracer->SetVisibility(false);
    Flash->SetVisibility(false);
    FlashLight->SetVisibility(false);
    Word->SetVisibility(false);
    bWordShown = false;
    bBusy = false;
    SetActorTickEnabled(false);
}

void AQuebecCombatFX::PlayShot(UWorld* World, const FVector& Muzzle, const FVector& Impact, int32 Slot, bool bHit, bool bWord)
{
    // Far from the local camera a shot is only a quieter bang, and past 150 m nothing at all.
    FVector Eye;
    const double Distance = CombatLocalEye(World, Eye) ? FMath::Min(FVector::Dist(Eye, Muzzle), FVector::Dist(Eye, Impact)) : 0.;
    if (Distance > CombatSoundRange) return;
    AQuebecCombatFX* Effect = Begin(World, Muzzle);
    if (!Effect) return;
    const int32 Safe = FMath::Clamp(Slot, 0, QuebecCombatModel::WeaponCount - 1);
    Effect->PlayBang(Safe, static_cast<float>(1. - Distance / CombatSoundRange));
    if (Distance > CombatEffectRange) return;
    const FVector Path = Impact - Muzzle;
    const double Length = FMath::Max(Path.Size(), 10.);
    const FVector Forward = Path.GetSafeNormal();
    const int32 Count = FMath::Min(QuebecCombatModel::Weapon(Safe).Pellets, TracerCount);
    for (int32 Index = 0; Index < Count; ++Index)
    {
        // Thin stretched cylinders: the basic shape is 100 cm tall along Z.
        const FVector Direction = Index == 0 ? Forward
            : FRotator(FMath::FRandRange(-4.f, 4.f), FMath::FRandRange(-6.f, 6.f), 0.).RotateVector(Forward);
        UStaticMeshComponent* Tracer = Effect->Tracers[Index];
        Tracer->SetWorldLocationAndRotation(Muzzle + Direction * Length * .5, FRotationMatrix::MakeFromZ(Direction).Rotator());
        Tracer->SetWorldScale3D(FVector(.025, .025, Length / 100.));
        Tracer->SetVisibility(true);
        Effect->TracerLengths.Add(static_cast<float>(Length));
    }
    const bool bShotgun = Safe == static_cast<int32>(EQuebecWeapon::Shotgun);
    Effect->Flash->SetWorldScale3D(FVector(bShotgun ? .32 : .2));
    Effect->Flash->SetVisibility(true);
    Effect->FlashLight->SetIntensity(bShotgun ? 1600.f : 900.f);
    Effect->FlashLight->SetVisibility(true);
    Effect->FlashSeconds = .06f;
    if (bWord)
        Effect->ShowWord(bHit ? Impact + FVector(0., 0., 55.) : Muzzle + FVector(0., 0., 45.), CombatWords[Safe], CombatWordColors[Safe],
            bHit ? 80.f : 55.f);
}

void AQuebecCombatFX::PlayImpact(UWorld* World, const FVector& Point, int32 Slot)
{
    FVector Eye;
    const double Distance = CombatLocalEye(World, Eye) ? FVector::Dist(Eye, Point) : 0.;
    if (Distance > CombatSoundRange) return;
    AQuebecCombatFX* Effect = Begin(World, Point);
    if (!Effect) return;
    const int32 Safe = FMath::Clamp(Slot, 0, QuebecCombatModel::WeaponCount - 1);
    // Guns already banged at the muzzle; a bullet landing adds only a short thud.
    Effect->PlayBang(Safe >= static_cast<int32>(EQuebecWeapon::Pistol) ? CombatBangGunImpact : Safe,
        static_cast<float>(1. - Distance / CombatSoundRange));
    if (Distance <= CombatEffectRange) Effect->ShowWord(Point + FVector(0., 0., 50.), CombatWords[Safe], CombatWordColors[Safe], 85.f);
}

void AQuebecCombatFX::ShowWord(const FVector& Point, const TCHAR* Text, const FColor& Color, float Size)
{
    WordAnchor = Point;
    bWordShown = true;
    Word->SetText(FText::FromString(Text));
    Word->SetTextRenderColor(Color);
    // The glyph size is set once; the pop animates the transform scale, which does not rebuild the text mesh.
    Word->SetWorldSize(Size);
    Word->SetWorldLocation(Point);
    Word->SetWorldScale3D(FVector(.2));
    Word->SetVisibility(true);
    FaceLocalCamera();
}

void AQuebecCombatFX::FaceLocalCamera()
{
    FVector Eye;
    if (CombatLocalEye(GetWorld(), Eye)) Word->SetWorldRotation((Eye - Word->GetComponentLocation()).Rotation());
}

void AQuebecCombatFX::PlayBang(int32 BangIndex, float Volume)
{
    UWorld* World = GetWorld();
    if (!World || !World->AllowAudioPlayback() || Volume <= 0.f) return;
    const int32 Safe = FMath::Clamp(BangIndex, 0, static_cast<int32>(UE_ARRAY_COUNT(CombatBangs)) - 1);
    const TArray<int16>& Samples = CombatBangSamples(Safe);
    if (!Wave)
    {
        Wave = NewObject<USoundWaveProcedural>(this);
        Wave->SetSampleRate(24000);
        Wave->NumChannels = 1;
        Audio->SetSound(Wave);
    }
    // The pooled wave is rewound and refilled from the cached buffer: no synthesis and no new object per shot.
    if (Audio->IsPlaying()) Audio->Stop();
    Wave->ResetAudio();
    Wave->Duration = CombatBangs[Safe].Seconds + .05f;
    Wave->QueueAudio(reinterpret_cast<const uint8*>(Samples.GetData()), Samples.Num() * static_cast<int32>(sizeof(int16)));
    Audio->SetVolumeMultiplier(FMath::Clamp(Volume, 0.f, 1.f));
    Audio->Play();
}

void AQuebecCombatFX::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!bBusy) return;
    Age += DeltaSeconds;
    // Tracers thin out over 0.12 s, the flash lasts a few frames, the word pops, rises and goes.
    const float Thickness = .025f * FMath::Clamp(1.f - Age / .12f, 0.f, 1.f);
    for (int32 Index = 0; Index < TracerLengths.Num() && Index < Tracers.Num(); ++Index)
    {
        if (Thickness <= 0.f) Tracers[Index]->SetVisibility(false);
        else Tracers[Index]->SetWorldScale3D(FVector(Thickness, Thickness, TracerLengths[Index] / 100.f));
    }
    if (Thickness <= 0.f) TracerLengths.Reset();
    if (Age > FlashSeconds && Flash->IsVisible())
    {
        Flash->SetVisibility(false);
        FlashLight->SetVisibility(false);
    }
    if (bWordShown)
    {
        const float Pop = Age < .08f ? 1.3f * Age / .08f : FMath::Lerp(1.3f, 1.f, FMath::Clamp((Age - .08f) / .1f, 0.f, 1.f));
        Word->SetWorldScale3D(FVector(FMath::Max(Pop, .2f)));
        Word->SetWorldLocation(WordAnchor + FVector(0., 0., 40. * Age));
        FaceLocalCamera();
        if (Age > .6f)
        {
            Word->SetVisibility(false);
            bWordShown = false;
        }
    }
    if (Age > .9f) Finish();
}
