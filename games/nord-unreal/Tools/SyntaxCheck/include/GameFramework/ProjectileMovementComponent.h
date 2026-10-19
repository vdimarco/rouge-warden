// Offline UE 5.x API stub: GameFramework/ProjectileMovementComponent.h
#pragma once
#include "GameFramework/MovementComponent.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnProjectileBounceDelegate, const FHitResult&, ImpactResult, const FVector&, ImpactVelocity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnProjectileStopDelegate, const FHitResult&, ImpactResult);
class UProjectileMovementComponent : public UMovementComponent
{
    UESTUB_UCLASS_BODY(UProjectileMovementComponent, UMovementComponent)
    UProjectileMovementComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float InitialSpeed;
    float MaxSpeed;
    uint8 bRotationFollowsVelocity : 1;
    uint8 bRotationRemainsVertical : 1;
    uint8 bShouldBounce : 1;
    uint8 bInitialVelocityInLocalSpace : 1;
    uint8 bForceSubStepping : 1;
    uint8 bSimulationEnabled : 1;
    uint8 bSweepCollision : 1;
    uint8 bIsHomingProjectile : 1;
    uint8 bBounceAngleAffectsFriction : 1;
    uint8 bIsSliding : 1;
    uint8 bInterpMovement : 1;
    uint8 bInterpRotation : 1;
    float PreviousHitTime;
    FVector PreviousHitNormal;
    float ProjectileGravityScale;
    float Buoyancy;
    float Bounciness;
    float Friction;
    float BounceVelocityStopSimulatingThreshold;
    float MinFrictionFraction;
    FOnProjectileBounceDelegate OnProjectileBounce;
    FOnProjectileStopDelegate OnProjectileStop;
    float HomingAccelerationMagnitude;
    TWeakObjectPtr<USceneComponent> HomingTargetComponent;
    float MaxSimulationTimeStep;
    int32 MaxSimulationIterations;
    int32 BounceAdditionalIterations;
    void SetVelocityInLocalSpace(FVector NewVelocity);
    void SetInterpolatedComponent(USceneComponent* Component);
    void MoveInterpolationTarget(const FVector& NewLocation, const FRotator& NewRotation);
    void ResetInterpolation();
    bool IsInterpolationComplete() const;
    virtual void StopSimulating(const FHitResult& HitResult);
    bool HasStoppedSimulation();
    virtual FVector ComputeVelocity(FVector InitialVelocity, float DeltaTime) const;
    virtual FVector ComputeAcceleration(const FVector& InVelocity, float DeltaTime) const;
    virtual FVector ComputeHomingAcceleration(const FVector& InVelocity, float DeltaTime) const;
    virtual float GetGravityZ() const override;
    virtual float GetMaxSpeed() const override;
    FVector LimitVelocity(FVector NewVelocity) const;
    virtual void InitializeComponent() override;
    virtual void TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    virtual void HandleImpact(const FHitResult& Hit, float TimeSlice = 0.f, const FVector& MoveDelta = FVector::ZeroVector) override;
};
