#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/HUD.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "QuebecSteerAssist.h" // Lag-tolerant driving: AQuebecCar keeps a QuebecSteer::FAssistState.
#include "Engine/TimerHandle.h" // Traffic street life: AQuebecCar blinks its signal lamps on a timer.
#include "QuebecTrafficModel.h" // Traffic street life: ARRÊT stops, yielding and curb stops.
#include "QuebecGameplay.generated.h"

class UAnimSequence;
class UBlendSpace;
class USkeletalMeshComponent;
class UBoxComponent;
class UCameraComponent;
class UMaterialInterface;
class USpringArmComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class UHierarchicalInstancedStaticMeshComponent;
class APhysicsVolume;
class USoundBase;

enum class EQuebecFeedbackCue : uint8 { Checkpoint, Complete, Dialogue };

// Two fixed map origins. Unknown/synthetic worlds retain the Montréal defaults.
namespace QuebecDistrict
{
    struct FSettings
    {
        FVector PlayerSpawn;
        FVector CarSpawn;
        const FVector (*RoadSegments)[2];
        int32 RoadCount;
        const TCHAR* City;
        const TCHAR* SurveyCredit;
    };
    QUEBEC_API bool IsTorontoMapName(const FString& MapName);
    QUEBEC_API bool IsToronto(const UWorld* World);
    QUEBEC_API const FSettings& ForWorld(const UWorld* World);
}

// Planar car-to-car impact between two equal-mass cars, as velocity changes (cm/s) and spin changes (deg/s).
namespace QuebecCarImpact
{
    struct FResult
    {
        FVector DeltaA = FVector::ZeroVector; // Car B receives -DeltaA.
        float SpinA = 0.f;
        float SpinB = 0.f;
        bool bImpact = false;
    };
    // Normal points from B toward A; arms run from each car's centre to the contact point.
    QUEBEC_API FResult Resolve(const FVector& VelocityA, const FVector& VelocityB, const FVector& Normal, const FVector& ArmA, const FVector& ArmB);
}

UCLASS()
class QUEBEC_API AQuebecParkInstances : public AActor
{
    GENERATED_BODY()
public:
    AQuebecParkInstances();
    UPROPERTY(VisibleAnywhere) TObjectPtr<UHierarchicalInstancedStaticMeshComponent> Instances;
};

UCLASS()
class QUEBEC_API AQuebecParkResident : public AActor
{
    GENERATED_BODY()
    friend class FQuebecResidentReactionTest;
public:
    AQuebecParkResident();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    UPROPERTY(EditAnywhere, ReplicatedUsing=ApplyAppearance) int32 Style = 0;
    UPROPERTY(EditAnywhere, ReplicatedUsing=UpdateRouteLength) TArray<FVector> Route;
    UPROPERTY(EditAnywhere, Replicated) float Phase = 0.f;
    // 0 walks, 1 jogs, 2 stays with a social pair. Shared time drives all peers.
    UPROPERTY(EditAnywhere, Replicated, meta=(ClampMin="0", ClampMax="2")) int32 Activity = 0;
    UPROPERTY(EditAnywhere, Replicated, meta=(ClampMin="40", ClampMax="260")) float Pace = 85.f;
    UPROPERTY(EditAnywhere, Replicated, meta=(ClampMin="1", ClampMax="10")) float PauseSeconds = 4.f;
    static const TCHAR* NameForStyle(int32 Index);
    static const TCHAR* DialogueForStyle(int32 Index);
    bool Acknowledge(AActor* Player, bool bManual = false);
    // People: knockdowns, flight and companions (QuebecPeople.cpp, QuebecLife.cpp). Every peer poses the tumble from the
    // replicated knock and the shared server time; the server moves the root and holds the route clock until it is back.
    // Server: knocks the resident down with launch velocity Push (cm/s) from Cause. False when hidden, worn or already down.
    bool Knock(const FVector& Push, const FVector& Cause, float LieSeconds = 1.6f);
    // Server: runs away from Source for Seconds, then walks back to the route. False when hidden, worn or down.
    bool Flee(const FVector& Source, float Seconds);
    // Tumbling, lying or standing up, on every peer.
    bool IsKnockedDown() const;
    bool IsAway() const { return Stride != 0; }
    FVector GetAimPoint() const;
    // QuebecLife::ECompanion: 0 none, 1 leashed dog, 2 stroller, 3 grocery bags. The game mode sets it before FinishSpawning.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Companion) uint8 Companion = 0;
private:
    friend class FQuebecPeopleResidentKnockTest;
    friend class FQuebecPeopleCompanionTest;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Pieces;
    UPROPERTY() TObjectPtr<USkeletalMeshComponent> GeneratedBody;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> HandProp;
    UPROPERTY() TObjectPtr<UAnimSequence> WalkAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> RunAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> IdleAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> CurrentAnimation;
    UPROPERTY() TObjectPtr<UTextRenderComponent> Label;
    float RouteLength = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float ReactionStartedAt = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float ReactionUntil = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float RouteDelay = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float ReactionYaw = 0.f;
    float NextReactionAt = 0.f;
    float RouteTime(float ServerTime) const;
    UFUNCTION() void UpdateRouteLength();
    UFUNCTION() void ApplyAppearance();
    // People: knock and flight state. Stride is 0 on the route, 1 knocked down, 2 running away, 3 walking back.
    UPROPERTY(VisibleAnywhere, Replicated) uint8 Stride = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockStartedAt = -1000.f;
    UPROPERTY(VisibleAnywhere, Replicated) FVector KnockOrigin = FVector::ZeroVector;
    UPROPERTY(VisibleAnywhere, Replicated) FVector KnockPush = FVector::ZeroVector;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockLieSeconds = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockGround = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockYaw = 0.f;
    UPROPERTY() TObjectPtr<UAnimSequence> JumpAnimation;
    UPROPERTY() TObjectPtr<class UQuebecCompanionRig> CompanionRig;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> DazedStars;
    TArray<FVector> PiecePivots;
    FVector AwayHome = FVector::ZeroVector;
    FVector FleeSource = FVector::ZeroVector;
    FVector FleeHeading = FVector::ZeroVector;
    float AwayHomeYaw = 0.f;
    float FleeUntil = 0.f;
    float NextFleeProbe = 0.f;
    float StreetGroundZ = 0.f;
    bool bKnockPose = false;
    bool IsKnockActive(float ServerTime) const;
    void BeginAway(float Now);
    void FinishAway(float Now);
    void TickAway(float ServerTime, float DeltaSeconds);
    bool StreetLifeAnimation(float ServerTime, UAnimSequence*& Animation, float& Clock) const;
    void PoseStreetLife(float ServerTime, bool bRouteWalking, bool bRoutePause, bool bReturnLeg, float PauseClock, float StrideClock);
    void ResetKnockPose();
    void RefreshCompanion();
    UFUNCTION() void OnRep_Companion();
};

UCLASS()
class QUEBEC_API AQuebecCharacter : public ACharacter
{
    GENERATED_BODY()
    friend class FQuebecCrewAnimationTest;
    friend class FQuebecSavedCrewLocomotionTest;
    friend class FQuebecGraphicNovelControlsTest;
    friend class FQuebecTripoPilotTest;
    friend class FQuebecDistrictRuntimeTest;
public:
    AQuebecCharacter();
    virtual void BeginPlay() override;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=ApplyCrewAppearance) int32 CrewStyle = 9;
    void CycleCrew();
    // Picks crew style 3-10. Returns false when another player already wears it.
    bool ChooseCrew(int32 Style);
    // True when a player character other than Except wears Style.
    static bool IsCrewTaken(const UWorld* World, int32 Style, const AQuebecCharacter* Except = nullptr);
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void Jump() override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    void SetInVehicle(bool bNewInVehicle);
    UFUNCTION() bool ConfigureCrewAnimation();
    // People: comic knockdown (QuebecPeople.cpp). Server: launch along Push (cm/s) and lie LieSeconds; bStayDown keeps the
    // player down until EndKnock (K.-O.). EndKnock starts the 0.8 s stand-up now. Every peer poses the mesh from the knock.
    void StartKnock(const FVector& Push, float LieSeconds, bool bStayDown);
    void EndKnock();
    bool IsKnocked() const;
    // Knocked down, or knocked out or arrested on the player state: no walking, jumping, sprinting or E.
    bool IsInputLocked() const;
    // Every peer, after movement and network smoothing (UQuebecKnockPoser): tumbles the mesh about the hips.
    void ApplyKnockPose();
    // Server: the car that knocked this player passes through it for Seconds.
    void IgnoreCarBriefly(AActor* Car, float Seconds);

private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> CameraArm;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_InVehicle) bool bInVehicle = false;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> CrewProp;
    UPROPERTY() TObjectPtr<UAnimSequence> CrewWalk;
    UPROPERTY() TObjectPtr<UAnimSequence> CrewIdle;
    UPROPERTY() TObjectPtr<UAnimSequence> CrewRun;
    UPROPERTY() TObjectPtr<UAnimSequence> CrewJump;
    UPROPERTY() TObjectPtr<UBlendSpace> CrewLocomotion;
    bool bCrewWasFalling = false;
    float CrewLandingTime = 1.f;
    float CrewAnimationTime = 0.f;
    float CrewPoseElapsed = 0.f;
    UPROPERTY() TObjectPtr<UAnimSequence> CrewAnimation;
    UPROPERTY() TObjectPtr<APhysicsVolume> SwimVolume;
    UPROPERTY() TArray<TObjectPtr<AActor>> SwimFloors;
    bool bSwimPoseActive = false;
    float SwimStrokeUntil = 0.f;
    UFUNCTION(Server, Reliable) void ServerSwimStroke();
    void UpdateSwimming(float DeltaSeconds);
    UFUNCTION() void ApplyCrewAppearance();
    UFUNCTION() void MoveForward(float Value);
    UFUNCTION() void MoveRight(float Value);
    UFUNCTION() void StartSprint();
    UFUNCTION() void StopSprint();
    UFUNCTION(Server, Reliable) void ServerSetSprint(bool bSprint);
    UFUNCTION() void OnRep_InVehicle();
    // People: knock state; the mesh pose is local to each peer.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Knock) float KnockStartedAt = -1000.f;
    UPROPERTY(VisibleAnywhere, Replicated) FVector KnockPush = FVector::ZeroVector;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockLieSeconds = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bKnockStayDown = false;
    UPROPERTY() TObjectPtr<class UQuebecKnockPoser> KnockPoser;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> KnockStars;
    TWeakObjectPtr<AActor> KnockIgnoredCar;
    float KnockIgnoreUntil = 0.f;
    FTransform KnockMeshBase = FTransform::Identity;
    bool bKnockPose = false;
    UFUNCTION() void OnRep_Knock();
    UFUNCTION(Client, Reliable) void ClientKnockLaunch(FVector Push);

    // Combat (QuebecCombat.cpp): weapons, aim assist and firing for a walking player.
public:
    bool IsAiming() const { return bCombatAiming; }
    // Possessed, on foot, not swimming, not knocked, down or otherwise input-locked.
    bool CanUseWeapons() const;
    // Both peers: let go of Fire and Aim, for a disconnected browser, a K.-O. or a respawn.
    void ReleaseCombatInput();
    // Server: fire or swing the current weapon. Only the planar part of AimDirection picks the target.
    void FireWeapon(const FVector& AimOrigin, const FVector& AimDirection);
private:
    UPROPERTY() TObjectPtr<USceneComponent> WeaponPivot;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> WeaponParts;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> PunchFist;
    TWeakObjectPtr<AActor> AimLock;
    TWeakObjectPtr<AActor> MeleeTarget;
    bool bFireHeld = false;
    bool bCombatAiming = false;
    uint8 ShownWeapon = 255;
    uint8 MeleeWeapon = 0;
    uint8 SwingWeapon = 0;
    float AimLockSince = -100.f;
    float AimLockRefreshAt = 0.f;
    float LastAimOrFireAt = -100.f;
    float NextLocalFireAt = 0.f;
    float NextServerFireAt = 0.f;
    float NextGunfireReportAt = 0.f;
    float NextGunAlarmAt = 0.f;
    float MeleeHitAt = -1.f;
    float SwingStartedAt = -100.f;
    float ShotKickAt = -100.f;
    float LastShotWordAt = -100.f;
    float AimBlend = 0.f;
    void TickCombat(float DeltaSeconds);
    void TickCombatServer(float Now);
    void UpdateHeldWeapon();
    void AnimateHeldWeapon(float Now);
    void UpdateAimCamera(float DeltaSeconds);
    void SetCombatAiming(bool bNewAiming);
    void SendFire();
    FVector LocalAimDirection() const;
    UFUNCTION() void StartFire();
    UFUNCTION() void StopFire();
    UFUNCTION() void StartAim();
    UFUNCTION() void StopAim();
    UFUNCTION() void CycleWeapon();
    UFUNCTION() void TurnView(float Value);
    UFUNCTION(Server, Reliable) void ServerFire(FVector_NetQuantize AimOrigin, FVector_NetQuantizeNormal AimDirection);
    UFUNCTION(Server, Reliable) void ServerSetAim(bool bNewAiming);
    UFUNCTION(Server, Reliable) void ServerNextWeapon();
    UFUNCTION(NetMulticast, Unreliable) void MulticastShot(FVector_NetQuantize Muzzle, FVector_NetQuantize Impact, uint8 Slot, bool bHit, float Yaw);
    UFUNCTION(NetMulticast, Unreliable) void MulticastSwing(uint8 Slot, float Yaw);
    UFUNCTION(NetMulticast, Unreliable) void MulticastImpact(FVector_NetQuantize Point, uint8 Slot);
};

UCLASS()
class QUEBEC_API AQuebecCar : public APawn
{
    GENERATED_BODY()
    friend class FQuebecBrowserInputReleaseTest;
public:
    AQuebecCar();
    virtual void BeginPlay() override;
    virtual void PossessedBy(AController* NewController) override;
    virtual void PawnClientRestart() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<AQuebecCharacter> Occupant;
    UPROPERTY(VisibleAnywhere, Replicated) float Speed = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float LateralSpeed = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bHandbrake = false;
    UPROPERTY(EditAnywhere, ReplicatedUsing=ApplyPaint) int32 PaintStyle = 0;
    UPROPERTY(EditAnywhere, ReplicatedUsing=ApplyPaint) int32 BodyProfile = 0;
    UPROPERTY(VisibleAnywhere, Replicated) bool bTraffic = false;
    void SetTrafficRoute(int32 Segment, bool bForward, const TArray<bool>& AllowedRoads);
    void StopInput();
    void ResetMotion();
    bool CanFitAt(const FVector& Point, const FQuat& Rotation, const AActor* Ignore = nullptr) const;
    FVector PlanarVelocity() const;
    // A struck car slides on locked tyres for KnockSeconds, then returns to parked, traffic or driver control.
    void ReceiveImpact(const FVector& DeltaVelocity, float DeltaSpin, float KnockSeconds);

    // Street systems (QuebecDrive.cpp). Server: an AI driver (police, side jobs) writes the inputs a player would and
    // the car drives the player handling model every frame. The remote-input failsafe does not apply while it is set.
    // A traffic car leaves its route for good. Ignored while a player drives the car.
    void SetAutopilot(float NewThrottle, float NewSteering, bool bNewHandbrake);
    // Server: the AI driver lets go; the car brakes to a stop like any unoccupied car.
    void ClearAutopilot();
    bool HasAutopilot() const { return bAutopilot; }
    virtual void UnPossessed() override;
    // Painted and equipped by QuebecCrime::DecoratePoliceCar on every peer.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Police) bool bPolice = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bSiren = false;
    // 0..100. At 100 the car is wrecked: it ignores throttle and smokes. Hard hits on walls and cars add damage.
    UPROPERTY(VisibleAnywhere, Replicated) float BodyDamage = 0.f;
    // Server.
    void AddBodyDamage(float Amount, AController* DamagedBy);
    bool IsWrecked() const { return BodyDamage >= 100.f; }
    // The controller of the player in the driver's seat, else null (AI, traffic and parked cars).
    AController* GetDriverController() const;
    // Server: sets bPolice and decorates the car.
    void SetPolice(bool bNewPolice);
    UFUNCTION() void OnRep_Police();

private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Collision; // Saved-map compatibility.
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Hull;
    UPROPERTY() TArray<TObjectPtr<UStaticMesh>> CollisionMeshes;
    UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> CameraArm;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
    UPROPERTY() TObjectPtr<class UAudioComponent> DriveAudio;
    UPROPERTY() TObjectPtr<class USoundWaveProcedural> DriveWave;
    float LastDriveInputTime = 0.f;
    float Throttle = 0.f;
    float Steering = 0.f;
    float VerticalSpeed = 0.f;
    float YawRate = 0.f;
    float KnockTime = 0.f;
    float LastLookTime = -10.f;
    float WheelAngle = 0.f;
    float DriveThrottle = 0.f;
    float SteeringState = 0.f;
    float WheelSteering = 0.f;
    float AudioPhase = 0.f;
    float AudioFrequency = 35.f;
    float TirePhase = 0.f;
    uint32 AudioNoise = 0x35a72f19;
    UPROPERTY(Replicated) float VisualSteering = 0.f;
    int32 TrafficSegment = INDEX_NONE;
    bool bTrafficForward = true;
    int32 TrafficTurns = 0;
    TArray<bool> TrafficRoadMask;
    FVector TrafficJunction = FVector::ZeroVector;
    bool bJunctionReserved = false;
    bool bJunctionEntered = false;
    void UpdateTraffic();
    void SimulateDrive(float Step, bool bFailsafe);
    void MoveWithCollision(float Step, const FVector& Travel);
    bool WheelSupport(const FVector& Point, FRotator& Rotation, double& Height, bool& bTooHigh) const;
    bool bGrounded = false;
    FTransform GroundedTransform;
    void UpdateDriveAudio(float DeltaSeconds);
    UFUNCTION() void ApplyPaint();
    UFUNCTION() void MoveForward(float Value);
    UFUNCTION() void MoveRight(float Value);
    void LookYaw(float Value);
    void LookPitch(float Value);
    UFUNCTION() void ApplyHandbrake();
    UFUNCTION() void ReleaseHandbrake();
    UFUNCTION(Server, Unreliable) void ServerSetDrive(float NewThrottle, float NewSteering, bool bNewHandbrake);

    // Lag-tolerant driving and the street contract (QuebecDrive.cpp).
    bool bAutopilot = false;
    bool bAutopilotHandbrake = false;
    float AutopilotThrottle = 0.f;
    float AutopilotSteering = 0.f;
    // A player car on a road gets the steering assist, the glancing-wall turn and the stuck nudge; off-road is unchanged.
    bool bSteerAssist = false;
    QuebecSteer::FAssistState SteerAssist;
    FVector LastWallNormal = FVector::ZeroVector;
    float NextRamReportAt = 0.f;
    // People this car knocked down, driven past instead of treated as walls until PassedBodiesUntil.
    TArray<TWeakObjectPtr<AActor>> PassedBodies;
    TArray<float> PassedBodiesUntil;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> SmokePuffs;
    TArray<float> SmokePuffBorn;
    float SmokeSeenDamage = 0.f;
    float SmokeSince = -1000.f;
    float NextSmokeAt = 0.f;
    int32 NextSmokePuff = 0;
    bool bSmokeTicking = false;
    void PrepareDriveAssist();
    float AssistedYawRate() const;
    bool PassStruckPerson(const FHitResult& Hit, const FVector& From, const FVector& Travel);
    void OnCarImpact(AQuebecCar* Other, float Closing, const FVector& Where);
    void OnWallImpact(const FVector& Normal, float Closing, float Step);
    bool SlideAlongStep(const FVector& Before, const FVector& Travel);
    void FinishDriveTick(const FVector& From, bool bStriker, float DeltaSeconds);
    void NudgeStuckCar();
    void UpdateDamageSmoke(float DeltaSeconds);

    // Traffic street life (QuebecTrafficLife.cpp), ambient traffic only: full stops at mapped ARRÊT junctions,
    // yielding to people in the lane ahead, and now and then a curb stop with signals and hazard lights.
    friend class FQuebecTrafficStopSignTest;
    friend class FQuebecTrafficYieldTest;
    friend class FQuebecTrafficCurbStopTest;
    // QuebecTrafficModel::SignalOff, SignalLeft, SignalRight or SignalHazard. Every peer blinks the lamps from it.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_TrafficSignal) uint8 TrafficSignal = 0;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> TrafficLamps;
    QuebecTrafficModel::FStopGate TrafficStop;
    QuebecTrafficModel::FYield TrafficYield;
    QuebecTrafficModel::FCurbStop TrafficCurb;
    float TrafficClock = -1.f;
    bool bTrafficLampsLit = false;
    FTimerHandle TrafficBlinkTimer;
    // Server, from UpdateTraffic: the speed limit after stops, people and curb stops. Direction is the lane direction
    // and Projection the car's distance along TrafficSegment.
    float UpdateTrafficLife(float DesiredSpeed, const FVector& Direction, float Projection);
    // Lateral shift of the steering target toward the curb, at a point Along the current segment.
    float TrafficCurbShift(float Along) const { return TrafficCurb.Shift(Along); }
    void SetTrafficSignal(uint8 NewSignal);
    void BlinkTrafficSignal();
    UFUNCTION() void OnRep_TrafficSignal();
    // Server: forgets stop holds, yielding and any curb stop, and turns the lamps off. Runs by itself once a car stops
    // being traffic (a player, an autopilot or a wreck takes it); any path that clears bTraffic may also call it.
    void ClearTrafficLife();
};

UCLASS()
class QUEBEC_API AQuebecGameState : public AGameStateBase
{
    GENERATED_BODY()
public:
    static constexpr int32 MissionCount = 3;
    static const FVector MissionLocations[MissionCount];
    static const TCHAR* MissionLabels[MissionCount];
    UPROPERTY(Replicated, BlueprintReadOnly) int32 MissionIndex = 0;
    // Crew styles 3-10 that a player wears, one bit per style. The server sets it; clients cannot see every player character.
    UPROPERTY(Replicated) int32 WornCrewMask = 0;
    AQuebecGameState();
    virtual void Tick(float DeltaSeconds) override;
    bool IsCrewWorn(int32 Style) const { return Style >= 3 && Style <= 10 && (WornCrewMask & (1 << Style)) != 0; }
    static bool CanAdvanceMission(int32 Index, const FVector& Position);
    bool AdvanceMissionNear(const FVector& Position);
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};

UCLASS()
class QUEBEC_API AQuebecController : public APlayerController
{
    GENERATED_BODY()
    friend class FQuebecFeedbackAssetsTest;
    friend class FQuebecMusicAssetsTest;
    friend class FQuebecMusicSelectionTest;
    friend class FQuebecBrowserInputReleaseTest;
    friend class FQuebecGraphicNovelCandidateTest;
public:
    AQuebecController();
    void PlayFeedback(EQuebecFeedbackCue Cue);
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaTime) override;
    virtual void PawnLeavingGame() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    AQuebecCar* FindInteractableCar() const;
    AQuebecParkResident* FindInteractableResident() const;
    void TickResidentGreetings(float DeltaTime);
    bool IsComicStyle() const { return bComicStyle; }
    void ShowInteractionMessage(const FString& Message) { ClientInteractionMessage(Message); }
    // Console commands for the shared sky. The host applies them; they do nothing without a sky.
    UFUNCTION(Exec) void NordWeather(const FString& Weather);
    UFUNCTION(Exec) void NordTime(float Hours);
    UFUNCTION(Exec) void NordSkyFreeze(int32 Frozen);
    UPROPERTY(VisibleAnywhere, Transient) FString ResidentCaption;
    UPROPERTY(VisibleAnywhere, Transient) float ResidentCaptionUntil = 0.f;
    // Street notices (JOBS, QuebecGameHUD.cpp): a banner channel apart from ResidentCaption, so story captions,
    // greetings and their QA checks are unaffected. QuebecNotice::Show sends it; the HUD draws GameNotice*.
    UFUNCTION(Client, Reliable) void ClientGameNotice(const FString& Title, const FString& Detail, float Seconds);
    // Client: a notice that arrived while another was fresh shows once that one has had a second on screen.
    void TickGameNotice();
    UPROPERTY(VisibleAnywhere, Transient) FString GameNoticeTitle;
    UPROPERTY(VisibleAnywhere, Transient) FString GameNoticeDetail;
    UPROPERTY(VisibleAnywhere, Transient) float GameNoticeStart = 0.f;
    UPROPERTY(VisibleAnywhere, Transient) float GameNoticeUntil = 0.f;
    FString PendingNoticeTitle;
    FString PendingNoticeDetail;
    float PendingNoticeSeconds = 0.f;
    // Sender side: the same notice within 1.5 s is dropped.
    FString LastNoticeKey;
    float LastNoticeAt = -10.f;

private:
    UPROPERTY() TArray<TObjectPtr<USoundBase>> FeedbackSounds;
    UPROPERTY() TObjectPtr<class UAudioComponent> MusicAudio;
    UPROPERTY() TObjectPtr<USoundBase> NeighborhoodMusic;
    UPROPERTY() TObjectPtr<USoundBase> RaceMusic;
    void UpdateMusic(bool bRacing);
    UPROPERTY() TObjectPtr<AQuebecCharacter> WalkingCharacter;
    UPROPERTY() TObjectPtr<UMaterialInterface> ComicMaterial;
    bool bComicStyle = false;
    bool bSkyGrading = false;
    float CaptureClock = 0.f;
    int32 CaptureStep = 0;
    float CampaignAimElapsed = 0.f;
    float ResidentGreetingElapsed = 0.f;
    float NextResidentGreetingAt = 0.f;
    float BrowserStateElapsed = 0.f;
    FString BrowserStreamerId;
    void BindBrowserInputRelease();
    void UnbindBrowserInputRelease();
    void BrowserDataTrackClosed(FString StreamerId, FString PlayerId);
    void BrowserDisconnected(FString StreamerId);
    UFUNCTION(Server, Reliable) void ServerReleaseBrowserInput();
    UFUNCTION() void RetryCampaign();
    UFUNCTION() void ReplayCampaign();
    UFUNCTION(Server, Reliable) void ServerRetryCampaign();
    UFUNCTION(Server, Reliable) void ServerReplayCampaign();
    UFUNCTION(Server, Unreliable) void ServerCampaignAim(float Yaw, float Pitch);
    UFUNCTION() void NextCharacter();
    UFUNCTION(Server, Reliable) void ServerNextCharacter();
    // Keys 1-8 pick crew styles 3-10 directly.
    void ChooseCrewKey(int32 Slot);
    UFUNCTION(Server, Reliable) void ServerChooseCrew(int32 Style);
    UFUNCTION() void ToggleComicStyle();
    void ApplyComicStyle();
    void ApplySkyGrading();
    UFUNCTION(Server, Reliable) void ServerNordWeather(const FString& Weather);
    UFUNCTION(Server, Reliable) void ServerNordTime(float Hours);
    UFUNCTION(Server, Reliable) void ServerNordSkyFreeze(bool bFrozen);
    void TickCapture(float DeltaTime);
    UFUNCTION() void Interact();
    UFUNCTION(Server, Reliable) void ServerInteract();
    UFUNCTION(Client, Reliable) void ClientInteractionMessage(const FString& Message);
    UFUNCTION(Client, Reliable) void ClientResidentGreeting(const FString& Message);
    void ExitCar(AQuebecCar* Car);
};

UCLASS()
class QUEBEC_API AQuebecHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void DrawHUD() override;
    bool CanShowResidentGreeting() const;
private:
    int32 LastMissionIndex = -1;
    float FirstHUDTime = -1.f;
    FString LastBriefing;
    float BriefingUntil = 0.f;
    float BriefingPausedAt = -1.f;
    float CompletionTime = -10.f;
    FString SoundWord;
    float SoundWordTime = -10.f;
    bool bWasFalling = false;
    bool bWasHandbrake = false;
    float LastCarSpeed = 0.f;
    void TriggerSoundWord(const TCHAR* Word);
    // Street HUD (JOBS, QuebecGameHUD.cpp): wanted stars, vitals, weapon, cash and side-job column; centre banners;
    // aim reticle; radar blips. DrawHUD passes its radar box and the top of the free view.
    void DrawStreetHUD(float UIScale, bool bTall, bool bTouch, float RadarX, float RadarY, float RadarSize, float ViewTop);
    // Width in UI units that the status column takes left of the radar, 0 while the street is calm.
    float StreetColumnWidth() const;
    // Side-job marker prompt for the local walker, empty elsewhere.
    FString StreetPrompt() const;
    int32 LastJobSerial = -1;
    float JobBannerAt = -10.f;
    int32 LastStars = 0;
    float StarsChangedAt = -10.f;
    int32 LastCash = -1;
    float CashChangedAt = -10.f;
    float LastHealth = 100.f;
    float HurtAt = -10.f;
};

UCLASS()
class QUEBEC_API AQuebecGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AQuebecGameMode();
    virtual void BeginPlay() override;
    virtual AActor* ChoosePlayerStart_Implementation(AController* Player) override;
};
