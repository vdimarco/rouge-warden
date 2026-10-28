// Offline UE 5.x API stub: GameFramework/NavMovementComponent.h
#pragma once
#include "GameFramework/MovementComponent.h"
#include "AI/Navigation/NavigationTypes.h"
class UNavMovementComponent : public UMovementComponent
{
    UESTUB_UCLASS_BODY(UNavMovementComponent, UMovementComponent)
    UNavMovementComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FNavAgentProperties NavAgentProps;
    uint8 bUseAccelerationForPaths : 1;
    uint8 bUseFixedBrakingDistanceForPaths : 1;
    float FixedPathBrakingDistance;
    FNavAgentProperties& GetNavAgentPropertiesRef();
    const FNavAgentProperties& GetNavAgentPropertiesRef() const;
    virtual void StopActiveMovement();
    void StopMovementKeepPathing();
    virtual void RequestDirectMove(const FVector& MoveVelocity, bool bForceMaxSpeed);
    virtual void RequestPathMove(const FVector& MoveInput);
    virtual bool CanStartPathFollowing() const;
    virtual bool CanStopPathFollowing() const;
    virtual bool IsFalling() const;
    virtual bool IsMovingOnGround() const;
    virtual bool IsCrouching() const;
    virtual bool IsSwimming() const;
    virtual bool IsFlying() const;
    bool CanEverCrouch() const;
    bool CanEverJump() const;
    bool CanEverMoveOnGround() const;
    bool CanEverSwim() const;
    bool CanEverFly() const;
    void SetJumpAllowed(bool bAllowed);
    bool IsJumpAllowed() const;
    virtual void StopMovementImmediately() override;
};
