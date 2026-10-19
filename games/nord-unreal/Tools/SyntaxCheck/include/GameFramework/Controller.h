// Offline UE 5.x API stub: GameFramework/Controller.h
#pragma once
#include "GameFramework/Actor.h"
class APawn;
class ACharacter;
class APlayerState;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnPossessedPawnChanged, APawn*, OldPawn, APawn*, NewPawn);

class AController : public AActor
{
    UESTUB_UCLASS_BODY(AController, AActor)
    AController(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<APlayerState> PlayerState;
    uint8 bAttachToPawn : 1;
    FName StateName;
    FOnPossessedPawnChanged OnPossessedPawnChanged;

    void Possess(APawn* InPawn);
    void UnPossess();
    APawn* GetPawn() const;
    template <class T> T* GetPawn() const { return Cast<T>(GetPawn()); }
    template <class T> T* GetPawnChecked() const { return CastChecked<T>(GetPawn()); }
    APawn* K2_GetPawn() const;
    ACharacter* GetCharacter() const;
    template <class T> T* GetPlayerState() const { return Cast<T>(PlayerState); }
    virtual void SetPawn(APawn* InPawn);
    virtual FRotator GetControlRotation() const;
    virtual void SetControlRotation(const FRotator& NewRotation);
    virtual void SetInitialLocationAndRotation(const FVector& NewLocation, const FRotator& NewRotation);
    virtual void GetPlayerViewPoint(FVector& Location, FRotator& Rotation) const;
    virtual bool LineOfSightTo(const class AActor* Other, FVector ViewPoint = FVector(ForceInit), bool bAlternateChecks = false) const;
    bool IsLocalController() const;
    bool IsLocalPlayerController() const;
    bool IsPlayerController() const;
    virtual AActor* GetViewTarget() const;
    void ClientSetRotation(FRotator NewRotation, bool bResetCamera = false);
    void ClientSetLocation(FVector NewLocation, FRotator NewRotation);
    virtual void SetIgnoreMoveInput(bool bNewMoveInput);
    virtual void ResetIgnoreMoveInput();
    virtual bool IsMoveInputIgnored() const;
    virtual void SetIgnoreLookInput(bool bNewLookInput);
    virtual void ResetIgnoreLookInput();
    virtual bool IsLookInputIgnored() const;
    virtual void ResetIgnoreInputFlags();
    virtual void StopMovement();
    virtual void InitPlayerState();
    virtual void CleanupPlayerState();
    virtual void GameHasEnded(class AActor* EndGameFocus = nullptr, bool bIsWinner = false);
    virtual void FailedToSpawnPawn();
    virtual void PawnPendingDestroy(APawn* inPawn);
    virtual void ChangeState(FName NewState);
    bool IsInState(FName InStateName) const;
    FName GetStateName() const;
    virtual void OnRep_Pawn();
    virtual void OnRep_PlayerState();
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void Reset() override;
    virtual void Destroyed() override;
protected:
    virtual void OnPossess(APawn* InPawn);
    virtual void OnUnPossess();
};
