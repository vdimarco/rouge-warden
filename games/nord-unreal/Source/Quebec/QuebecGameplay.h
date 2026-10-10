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
    UPROPERTY(EditAnywhere) TArray<FVector> Route;
    UPROPERTY(EditAnywhere) float Phase = 0.f;
    static const TCHAR* NameForStyle(int32 Index);
    static const TCHAR* DialogueForStyle(int32 Index);
private:
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Pieces;
    UPROPERTY() TObjectPtr<USkeletalMeshComponent> GeneratedBody;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> HandProp;
    UPROPERTY() TObjectPtr<UAnimSequence> WalkAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> IdleAnimation;
    UPROPERTY() TObjectPtr<UAnimSequence> CurrentAnimation;
    UPROPERTY() TObjectPtr<UTextRenderComponent> Label;
    float RouteLength = 0.f;
    UFUNCTION() void ApplyAppearance();
};

UCLASS()
class QUEBEC_API AQuebecCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    AQuebecCharacter();
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    void SetInVehicle(bool bNewInVehicle);

private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> CameraArm;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_InVehicle) bool bInVehicle = false;
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
public:
    AQuebecCar();
    virtual void BeginPlay() override;
    virtual void PossessedBy(AController* NewController) override;
    virtual void PawnClientRestart() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<AQuebecCharacter> Occupant;
    UPROPERTY(Replicated) float Speed = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bHandbrake = false;
    UPROPERTY(EditAnywhere) int32 PaintStyle = 0;
    void StopInput();

private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Collision;
    UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> CameraArm;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
    float LastDriveInputTime = 0.f;
    float Throttle = 0.f;
    float Steering = 0.f;
    float VerticalSpeed = 0.f;
    float LastLookTime = -10.f;
    float WheelAngle = 0.f;
    UPROPERTY(Replicated) float VisualSteering = 0.f;
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
    static bool CanAdvanceMission(int32 Index, const FVector& Position);
    bool AdvanceMissionNear(const FVector& Position);
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};

UCLASS()
class QUEBEC_API AQuebecController : public APlayerController
{
    GENERATED_BODY()
public:
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaTime) override;
    virtual void PawnLeavingGame() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    AQuebecCar* FindInteractableCar() const;
    AQuebecParkResident* FindInteractableResident() const;
    bool IsComicStyle() const { return bComicStyle; }
    UPROPERTY(VisibleAnywhere, Transient) FString ResidentCaption;
    UPROPERTY(VisibleAnywhere, Transient) float ResidentCaptionUntil = 0.f;

private:
    UPROPERTY() TObjectPtr<AQuebecCharacter> WalkingCharacter;
    UPROPERTY() TObjectPtr<UMaterialInterface> ComicMaterial;
    bool bComicStyle = true;
    float CaptureClock = 0.f;
    int32 CaptureStep = 0;
    UFUNCTION() void ToggleComicStyle();
    void ApplyComicStyle();
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
};
