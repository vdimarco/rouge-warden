// Offline UE 5.x API stub: GameFramework/Character.h
#pragma once
#include "GameFramework/Pawn.h"
class UCapsuleComponent;
class USkeletalMeshComponent;
class UCharacterMovementComponent;
class UAnimMontage;
class UArrowComponent;
class UPrimitiveComponent;
class ACharacter;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FLandedSignature, const FHitResult&, Hit);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FMovementModeChangedSignature, class ACharacter*, Character, EMovementMode, PrevMovementMode, uint8, PreviousCustomMode);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FCharacterMovementUpdatedSignature, float, DeltaSeconds, FVector, OldLocation, FVector, OldVelocity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCharacterReachedApexSignature, ACharacter*, Character);

class ACharacter : public APawn
{
    UESTUB_UCLASS_BODY(ACharacter, APawn)
    ACharacter(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static FName MeshComponentName;
    static FName CharacterMovementComponentName;
    static FName CapsuleComponentName;
    float CrouchedEyeHeight;
    uint32 bIsCrouched : 1;
    uint32 bProxyIsJumpForceApplied : 1;
    uint32 bPressedJump : 1;
    uint32 bClientUpdating : 1;
    uint32 bClientWasFalling : 1;
    uint32 bClientResimulateRootMotion : 1;
    uint32 bClientResimulateRootMotionSources : 1;
    uint32 bSimGravityDisabled : 1;
    uint32 bClientCheckEncroachmentOnNetUpdate : 1;
    uint32 bServerMoveIgnoreRootMotion : 1;
    uint32 bWasJumping : 1;
    float JumpKeyHoldTime;
    float JumpForceTimeRemaining;
    float ProxyJumpForceStartedTime;
    float JumpMaxHoldTime;
    int32 JumpMaxCount;
    int32 JumpCurrentCount;
    int32 JumpCurrentCountPreJump;
    FLandedSignature LandedDelegate;
    FMovementModeChangedSignature MovementModeChangedDelegate;
    FCharacterMovementUpdatedSignature OnCharacterMovementUpdated;
    FCharacterReachedApexSignature OnReachedJumpApex;

    USkeletalMeshComponent* GetMesh() const;
    UCharacterMovementComponent* GetCharacterMovement() const;
    template <class T> T* GetCharacterMovement() const { return CastChecked<T>(GetCharacterMovement(), ECastCheckedType::NullAllowed); }
    UCapsuleComponent* GetCapsuleComponent() const;
#if WITH_EDITORONLY_DATA
    UArrowComponent* GetArrowComponent() const;
#endif
    virtual void Jump();
    virtual void StopJumping();
    bool CanJump() const;
    virtual bool CanJumpInternal_Implementation() const;
    virtual void ResetJumpState();
    bool IsJumpProvidingForce() const;
    virtual void CheckJumpInput(float DeltaTime);
    virtual void ClearJumpInput(float DeltaTime);
    virtual float GetJumpMaxHoldTime() const;
    virtual void LaunchCharacter(FVector LaunchVelocity, bool bXYOverride, bool bZOverride);
    virtual void Crouch(bool bClientSimulation = false);
    virtual void UnCrouch(bool bClientSimulation = false);
    virtual bool CanCrouch() const;
    virtual void OnStartCrouch(float HalfHeightAdjust, float ScaledHalfHeightAdjust);
    virtual void OnEndCrouch(float HalfHeightAdjust, float ScaledHalfHeightAdjust);
    virtual void Landed(const FHitResult& Hit);
    virtual void Falling();
    virtual void NotifyJumpApex();
    virtual void OnJumped_Implementation();
    virtual void OnMovementModeChanged(EMovementMode PrevMovementMode, uint8 PreviousCustomMode = 0);
    virtual void OnWalkingOffLedge_Implementation(const FVector& PreviousFloorImpactNormal, const FVector& PreviousFloorContactNormal, const FVector& PreviousLocation, float TimeDelta);
    virtual float PlayAnimMontage(class UAnimMontage* AnimMontage, float InPlayRate = 1.f, FName StartSectionName = NAME_None);
    virtual void StopAnimMontage(class UAnimMontage* AnimMontage = nullptr);
    class UAnimMontage* GetCurrentMontage() const;
    bool IsPlayingRootMotion() const;
    bool IsPlayingNetworkedRootMotionMontage() const;
    float GetAnimRootMotionTranslationScale() const;
    void SetAnimRootMotionTranslationScale(float InAnimRootMotionTranslationScale = 1.f);
    virtual UPawnMovementComponent* GetMovementComponent() const override;
    virtual void PossessedBy(AController* NewController) override;
    virtual void UnPossessed() override;
    virtual void PawnClientRestart() override;
    virtual void TurnOff() override;
    virtual void Restart() override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PostInitializeComponents() override;
    virtual void BeginPlay() override;
    virtual void GetSimpleCollisionCylinder(float& CollisionRadius, float& CollisionHalfHeight) const override;
    virtual bool TeleportTo(const FVector& DestLocation, const FRotator& DestRotation, bool bIsATest = false, bool bNoCheck = false) override;
protected:
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
};
