#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "Engine/NetSerialization.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Character.h"
#include "QuebecGTA.h"
#include "QuebecPolice.generated.h"

class AQuebecCar;
class APlayerController;
class APlayerState;
class UAnimSequence;
class UAudioComponent;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class UPointLightComponent;
class USkeletalMesh;
class USkeletalMeshComponent;
class USoundWaveProcedural;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

// Police helpers that the HUD and side jobs can read. QuebecCrime in QuebecGTA.h is the main interface.
namespace QuebecPolice
{
    // The street garage that clears stars when a player drives in unseen (a lane of Avenue De Lorimier's grid,
    // south-east of the start; QuebecPolice.cpp).
    QUEBEC_API FVector GarageLocation();
    inline constexpr float GarageRadius = 600.f;
    inline constexpr float GarageCooldown = 15.f;
}

/**
 * A police officer or one of the Curator's ink goons. No controller and no navmesh: the server steers it with
 * AddMovementInput, probing ahead for walls and cars. The capsule overlaps pawns, like residents, so cars knock
 * officers down through QuebecPeople::StrikeWithCar instead of stopping against them.
 */
UCLASS()
class QUEBEC_API AQuebecOfficer : public ACharacter
{
    GENERATED_BODY()
    friend class FQuebecPoliceOfficerTest;
public:
    static constexpr uint8 FactionPolice = 0;
    static constexpr uint8 FactionGoon = 1;

    AQuebecOfficer();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UPROPERTY(VisibleAnywhere, Replicated) uint8 Faction = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float Health = 100.f;

    // Server: Location is a point near the ground; the officer stands on the floor below it.
    static AQuebecOfficer* SpawnOfficer(UWorld* World, const FVector& Location, float Yaw, uint8 NewFaction);
    // Server: damage and a comic tumble. A car or a strong blow knocks the officer down; at zero health it stays
    // down and is removed a few seconds later. False when already down. Crimes are reported by QuebecPeople::Hit.
    bool ReceiveHit(EQuebecHitKind Kind, float Damage, const FVector& Push, AController* HitBy);
    bool IsDown() const;
    bool IsKnockedOut() const { return bKnockedOut; }
    FVector GetAimPoint() const;
    // Goons attack this player and police chase them. Takes a controller, a pawn or a player state.
    void SetTargetPlayer(AActor* Player);
    AController* GetTargetController() const { return TargetController.Get(); }
    APawn* GetTargetPawn() const;
    // Server: the dispatcher steers police at the last known position instead of the true one.
    void SetGoal(const FVector& Point);
    // Server: the police car this officer came from; the officer walks back to it when the chase ends.
    void SetHomeCar(AQuebecCar* Car);
    AQuebecCar* GetHomeCar() const { return HomeCar.Get(); }
    bool IsLeaving() const { return bLeaving; }

    // Every peer: a shot (0), a thrown ink blob (1) or a punch (2).
    UFUNCTION(NetMulticast, Unreliable) void MulticastAttack(FVector_NetQuantize From, FVector_NetQuantize To, uint8 Kind, bool bHit);

private:
    // GetMesh() stays empty so movement smoothing moves it; Pose hangs under it at hip height and carries the tumble.
    UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Pose;
    UPROPERTY(VisibleAnywhere) TObjectPtr<USkeletalMeshComponent> Body;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Shapes;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> FallbackBody;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> DazedStars;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> Blob;
    UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
    UPROPERTY() TObjectPtr<UStaticMesh> SphereMesh;
    UPROPERTY() TObjectPtr<UStaticMesh> CylinderMesh;
    UPROPERTY() TObjectPtr<USkeletalMesh> PoliceBodyMesh;
    UPROPERTY() TObjectPtr<USkeletalMesh> GoonBodyMesh;
    UPROPERTY() TObjectPtr<UAnimSequence> PoliceWalk;
    UPROPERTY() TObjectPtr<UAnimSequence> PoliceIdle;
    UPROPERTY() TObjectPtr<UAnimSequence> GoonWalk;
    UPROPERTY() TObjectPtr<UAnimSequence> GoonIdle;
    UPROPERTY() TObjectPtr<UAnimSequence> CurrentClip;

    // Knockdown, replicated as a server start time and the QuebecKnock launch so every peer draws the same tumble.
    UPROPERTY(Replicated) float KnockStartedAt = -100.f;
    UPROPERTY(Replicated) float KnockForward = 0.f;
    UPROPERTY(Replicated) float KnockUp = 0.f;
    UPROPERTY(Replicated) float KnockSpin = 0.f;
    UPROPERTY(Replicated) float KnockLieSeconds = 0.f;
    UPROPERTY(Replicated) bool bKnockedOut = false;

    TWeakObjectPtr<AController> TargetController;
    TWeakObjectPtr<AActor> TargetActor;
    TWeakObjectPtr<AQuebecCar> HomeCar;
    FVector Goal = FVector::ZeroVector;
    float GoalAt = -100.f;
    bool bLeaving = false;
    bool bPoseApplied = false;
    bool bKnockMoving = false;
    float BodyHeight = 182.f;
    float NextAttackAt = 0.f;
    float NextThrowAt = 0.f;
    float StaggerUntil = 0.f;
    float NextProbeAt = 0.f;
    FVector SteerDirection = FVector::ZeroVector;
    float NextSightAt = 0.f;
    bool bSight = false;
    float BlobStartedAt = -10.f;
    bool bBlobHit = false;
    FVector BlobFrom = FVector::ZeroVector;
    FVector BlobTo = FVector::ZeroVector;

    void ApplyLook();
    UStaticMeshComponent* AddShape(FName Name, UStaticMesh* Mesh, USceneComponent* Parent, const FVector& Location, const FVector& Size, UMaterialInterface* Material);
    float ServerTime() const;
    float KnockEndsAt() const;
    void Think(float DeltaSeconds, float Now);
    FVector Steer(const FVector& Point, const AActor* Ignore, float Now);
    bool CanSee(const AActor* Target, float Now);
    void Attack(APawn* Target, float Range, float Now);
    void UpdatePose(float Now);
    void UpdateAnimation();
    void UpdateBlob(float LocalNow);
};

/** Paint, light bar and siren on a police car. Added by QuebecCrime::DecoratePoliceCar on every peer. */
UCLASS()
class QUEBEC_API UQuebecPoliceLivery : public USceneComponent
{
    GENERATED_BODY()
public:
    UQuebecPoliceLivery();
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    // Builds the pieces once, then shows them while the car has bPolice and hides them otherwise.
    void Refresh();
    bool IsSirenSounding() const;

private:
    UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Pieces;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BandLeft;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BandRight;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BarBase;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> RedLamp;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BlueLamp;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> Words;
    UPROPERTY() TObjectPtr<UPointLightComponent> RedLight;
    UPROPERTY() TObjectPtr<UPointLightComponent> BlueLight;
    UPROPERTY() TObjectPtr<UAudioComponent> SirenAudio;
    UPROPERTY() TObjectPtr<USoundWaveProcedural> SirenWave;
    UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> WhitePaint;
    UPROPERTY() TObjectPtr<UMaterialInterface> WhiteFallback;
    UPROPERTY() TObjectPtr<UMaterialInterface> BandPaint;
    UPROPERTY() TObjectPtr<UMaterialInterface> RedOn;
    UPROPERTY() TObjectPtr<UMaterialInterface> BlueOn;
    UPROPERTY() TObjectPtr<UMaterialInterface> LampOff;
    UPROPERTY() TObjectPtr<UStaticMesh> FittedBody;
    bool bBuilt = false;
    bool bLiveryShown = false;
    float RepaintClock = 0.f;
    float SirenClock = 0.f;
    // Read position in the precomputed 1.2 s siren loop.
    int32 SirenCursor = 0;
    int32 LampPhase = -1;

    AQuebecCar* GetCar() const;
    void Build();
    void Fit();
    void Repaint();
    void Show(bool bShow);
    void UpdateSiren(float DeltaTime, bool bSounding);
};

// Server-side bookkeeping for one wanted player and one police car. Plain structs: never replicated.
struct FQuebecPoliceRecord
{
    double LastCrimeAt[8] = {-1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9};
    FVector LastSeen = FVector::ZeroVector;
    FVector LastSeenVelocity = FVector::ZeroVector;
    float LastSeenAt = -100.f;
    bool bSeen = false;
    float ArrestHeld = 0.f;
    bool bArrestPending = false;
    float GarageReadyAt = 0.f;
    float NextSpawnAt = 0.f;
};

struct FQuebecPoliceUnit
{
    TWeakObjectPtr<AQuebecCar> Car;
    TWeakObjectPtr<APlayerState> Target;
    TWeakObjectPtr<AQuebecOfficer> Officer;
    TArray<FVector> Path;
    int32 PathIndex = 0;
    FVector PathGoal = FVector::ZeroVector;
    float PathAt = -100.f;
    FVector Wander = FVector::ZeroVector;
    bool bWandering = false;
    float StuckFor = 0.f;
    float ReverseUntil = 0.f;
    int32 StuckCount = 0;
    float UnseenFor = 0.f;
    float GiveUpAt = -1.f;
    float WaitSince = -1.f;
    bool bOfficerOut = false;
    uint32 Seed = 1;
};

/**
 * Server police dispatcher: wanted stars per player, witnesses, police cars and officers, arrests and the garage.
 * GameMode spawns one after the Toronto return unless -NordNoCampaign or -NordNoPolice. It spawns no unit until a
 * player has stars, so ambient population counts and QA fixtures are unchanged. The garage sign is built on every peer.
 */
UCLASS()
class QUEBEC_API AQuebecPoliceDispatch : public AActor
{
    GENERATED_BODY()
    friend class FQuebecPoliceDispatchTest;
public:
    AQuebecPoliceDispatch();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    static AQuebecPoliceDispatch* Find(const UWorld* World);

    // Server entry points behind QuebecCrime::Report and SetStars.
    void ReportCrime(AController* Offender, EQuebecCrime Crime, const FVector& Where);
    void ApplyStars(AController* Player, int32 NewStars);
    // Server: a police car or officer sees Point now (cone, range and line of sight). Ignore is the watched pawn.
    bool PoliceSee(const FVector& Point, const AActor* Ignore) const;
    int32 CountCars() const;
    int32 CountOfficers(const APlayerState* Target = nullptr) const;

private:
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
    UPROPERTY() TObjectPtr<UStaticMesh> CylinderMesh;
    TMap<TWeakObjectPtr<APlayerState>, FQuebecPoliceRecord> Records;
    TArray<FQuebecPoliceUnit> Units;
    TArray<TWeakObjectPtr<AQuebecCar>> Wrecks;
    TArray<TWeakObjectPtr<AQuebecOfficer>> Officers;
    TArray<bool> RoadOpen;
    // Closed roads are found a few sweeps per tick from BeginPlay; routes treat unscanned roads as open.
    bool bRoadsChecked = false;
    int32 RoadScanNext = 0;
    float VisionClock = 0.f;
    float ManageClock = 0.f;
    uint32 SpawnSeed = 7919;

    void BuildGarage();
    void ScanRoads(int32 Budget);
    FQuebecPoliceRecord& RecordFor(APlayerState* State);
    void TickPlayers(float Now, float DeltaSeconds, bool bVision);
    void ManageUnits(float Now, float Interval);
    void DriveUnits(float Now, float DeltaSeconds);
    void SteerOfficers(float Now);
    bool TrySpawnCar(APlayerController* Player, float Now);
    void DeployOfficer(FQuebecPoliceUnit& Unit, APlayerController* Player);
    void Arrest(APlayerController* Player, AQuebecPlayerState* State, float Now);
    void StartGiveUp(FQuebecPoliceUnit& Unit, float Now);
    bool InAnyView(const FVector& Point, const AActor* Ignore) const;
    float NearestPlayerDistance(const FVector& Point) const;
};
