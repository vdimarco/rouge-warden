// Offline UE 5.x API stub: GameFramework/Pawn.h
#pragma once
#include "GameFramework/Actor.h"
class AController;
class APlayerController;
class APlayerState;
class UInputComponent;
class UPawnMovementComponent;
class UPawnNoiseEmitterComponent;
class APhysicsVolume;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FPawnControllerChangedSignature, APawn*, Pawn, AController*, OldController, AController*, NewController);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FPawnRestartedSignature, APawn*, Pawn, AController*, NewController);

class APawn : public AActor
{
    UESTUB_UCLASS_BODY(APawn, AActor)
    APawn(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    uint32 bUseControllerRotationPitch : 1;
    uint32 bUseControllerRotationYaw : 1;
    uint32 bUseControllerRotationRoll : 1;
    uint32 bCanAffectNavigationGeneration : 1;
    uint32 bProcessingOutsideWorldBounds : 1;
    float BaseEyeHeight;
    TEnumAsByte<EAutoReceiveInput::Type> AutoPossessPlayer;
    EAutoPossessAI AutoPossessAI;
    TSubclassOf<AController> AIControllerClass;
    TObjectPtr<AController> Controller;
    TObjectPtr<AController> PreviousController;
    FPawnControllerChangedSignature ReceiveControllerChangedDelegate;
    FPawnRestartedSignature ReceiveRestartedDelegate;

    AController* GetController() const;
    template <class T> T* GetController() const { return Cast<T>(GetController()); }
    APlayerState* GetPlayerState() const;
    template <class T> T* GetPlayerState() const { return Cast<T>(GetPlayerState()); }
    void SetPlayerState(APlayerState* NewPlayerState);
    APlayerController* GetLocalViewingPlayerController() const;
    virtual bool IsLocallyControlled() const;
    virtual bool IsLocallyViewed() const;
    virtual bool IsPlayerControlled() const;
    bool IsBotControlled() const;
    bool IsControlled() const;
    bool IsPawnControlled() const;
    FRotator GetControlRotation() const;
    virtual FRotator GetViewRotation() const;
    virtual FRotator GetBaseAimRotation() const;
    virtual FVector GetPawnViewLocation() const;
    virtual FVector GetNavAgentLocation() const;
    virtual UPawnMovementComponent* GetMovementComponent() const;
    virtual void AddMovementInput(FVector WorldDirection, float ScaleValue = 1.0f, bool bForce = false);
    FVector GetPendingMovementInputVector() const;
    FVector GetLastMovementInputVector() const;
    FVector K2_GetMovementInputVector() const;
    virtual FVector ConsumeMovementInputVector();
    virtual void AddControllerPitchInput(float Val);
    virtual void AddControllerYawInput(float Val);
    virtual void AddControllerRollInput(float Val);
    virtual bool IsMoveInputIgnored() const;
    virtual void PossessedBy(AController* NewController);
    virtual void UnPossessed();
    virtual void Restart();
    virtual void PawnClientRestart();
    virtual void NotifyRestarted();
    virtual void NotifyControllerChanged();
    virtual void DetachFromControllerPendingDestroy();
    virtual void SpawnDefaultController();
    virtual void TurnOff();
    virtual void OnRep_Controller();
    virtual void OnRep_PlayerState();
    virtual void PawnStartFire(uint8 FireModeNum = 0);
    virtual void LaunchPawn(FVector LaunchVelocity, bool bXYOverride, bool bZOverride);
    virtual FVector GetGravityDirection() const;
    virtual APhysicsVolume* GetPawnPhysicsVolume() const;
    virtual bool ShouldTakeDamage(float Damage, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) const;
    virtual float TakeDamage(float Damage, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;
    virtual FVector GetVelocity() const override;
    virtual void BecomeViewTarget(APlayerController* PC) override;
    virtual void GetActorEyesViewPoint(FVector& OutLocation, FRotator& OutRotation) const override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PostInitializeComponents() override;
    virtual void Destroyed() override;
    virtual void EnableInput(APlayerController* PlayerController) override;
    virtual void DisableInput(APlayerController* PlayerController) override;
protected:
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent);
    virtual UInputComponent* CreatePlayerInputComponent();
    virtual void DestroyPlayerInputComponent();
};
