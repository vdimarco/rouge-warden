#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/HUD.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
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
private:
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Pieces;
    UPROPERTY() TObjectPtr<USkeletalMeshComponent> GeneratedBody;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> HandProp;
    UPROPERTY() TObjectPtr<UAnimSequence> WalkAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> RunAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> IdleAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> CurrentAnimation;
    UPROPERTY() TObjectPtr<UTextRenderComponent> Label;
    float RouteLength = 0.f;
    UFUNCTION() void UpdateRouteLength();
    UFUNCTION() void ApplyAppearance();
};

UCLASS()
class QUEBEC_API AQuebecCharacter : public ACharacter
{
    GENERATED_BODY()
    friend class FQuebecCrewAnimationTest;
    friend class FQuebecGraphicNovelControlsTest;
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
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    void SetInVehicle(bool bNewInVehicle);
    UFUNCTION() bool ConfigureCrewAnimation();

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
    UFUNCTION() void ApplyCrewAppearance();
    UFUNCTION() void MoveForward(float Value);
    UFUNCTION() void MoveRight(float Value);
    UFUNCTION() void StartSprint();
    UFUNCTION() void StopSprint();
    UFUNCTION(Server, Reliable) void ServerSetSprint(bool bSprint);
    UFUNCTION() void OnRep_InVehicle();
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
    friend class FQuebecBrowserInputReleaseTest;
    friend class FQuebecGraphicNovelCandidateTest;
public:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaTime) override;
    virtual void PawnLeavingGame() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    AQuebecCar* FindInteractableCar() const;
    AQuebecParkResident* FindInteractableResident() const;
    bool IsComicStyle() const { return bComicStyle; }
    void ShowInteractionMessage(const FString& Message) { ClientInteractionMessage(Message); }
    // Console commands for the shared sky. The host applies them; they do nothing without a sky.
    UFUNCTION(Exec) void NordWeather(const FString& Weather);
    UFUNCTION(Exec) void NordTime(float Hours);
    UFUNCTION(Exec) void NordSkyFreeze(int32 Frozen);
    UPROPERTY(VisibleAnywhere, Transient) FString ResidentCaption;
    UPROPERTY(VisibleAnywhere, Transient) float ResidentCaptionUntil = 0.f;

private:
    UPROPERTY() TObjectPtr<AQuebecCharacter> WalkingCharacter;
    UPROPERTY() TObjectPtr<UMaterialInterface> ComicMaterial;
    bool bComicStyle = false;
    bool bSkyGrading = false;
    float CaptureClock = 0.f;
    int32 CaptureStep = 0;
    float CampaignAimElapsed = 0.f;
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
    void ExitCar(AQuebecCar* Car);
};

UCLASS()
class QUEBEC_API AQuebecHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void DrawHUD() override;
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
};

UCLASS()
class QUEBEC_API AQuebecGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AQuebecGameMode();
    virtual void BeginPlay() override;
};
