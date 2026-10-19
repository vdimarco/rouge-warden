// Offline UE 5.x API stub: GameFramework/MovementComponent.h
#pragma once
#include "Components/ActorComponent.h"
class USceneComponent;
class UPrimitiveComponent;
class APhysicsVolume;
enum class EPlaneConstraintAxisSetting : uint8 { Custom, X, Y, Z, UseGlobalPhysicsSetting };
class UMovementComponent : public UActorComponent
{
    UESTUB_UCLASS_BODY(UMovementComponent, UActorComponent)
    UMovementComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<USceneComponent> UpdatedComponent;
    TObjectPtr<UPrimitiveComponent> UpdatedPrimitive;
    FVector Velocity;
    uint8 bConstrainToPlane : 1;
    uint8 bSnapToPlaneAtStart : 1;
    uint8 bUpdateOnlyIfRendered : 1;
    uint8 bAutoUpdateTickRegistration : 1;
    uint8 bTickBeforeOwner : 1;
    uint8 bAutoRegisterUpdatedComponent : 1;
    virtual void SetUpdatedComponent(USceneComponent* NewUpdatedComponent);
    virtual float GetGravityZ() const;
    virtual FVector GetGravityDirection() const;
    virtual float GetMaxSpeed() const;
    virtual bool IsExceedingMaxSpeed(float MaxSpeed) const;
    virtual void StopMovementImmediately();
    virtual void UpdateComponentVelocity();
    virtual bool IsMoveInputIgnored() const;
    APhysicsVolume* GetPhysicsVolume() const;
    bool IsInWater() const;
    virtual void SetPlaneConstraintEnabled(bool bEnabled);
    virtual void SetPlaneConstraintNormal(FVector PlaneNormal);
    virtual void SetPlaneConstraintAxisSetting(EPlaneConstraintAxisSetting NewAxisSetting);
    bool MoveUpdatedComponent(const FVector& Delta, const FQuat& NewRotation, bool bSweep, FHitResult* OutHit = nullptr, ETeleportType Teleport = ETeleportType::None);
    bool MoveUpdatedComponent(const FVector& Delta, const FRotator& NewRotation, bool bSweep, FHitResult* OutHit = nullptr, ETeleportType Teleport = ETeleportType::None);
    bool K2_MoveUpdatedComponent(FVector Delta, FRotator NewRotation, FHitResult& OutHit, bool bSweep = true, bool bTeleport = false);
    bool SafeMoveUpdatedComponent(const FVector& Delta, const FQuat& NewRotation, bool bSweep, FHitResult& OutHit, ETeleportType Teleport = ETeleportType::None);
    bool SafeMoveUpdatedComponent(const FVector& Delta, const FRotator& NewRotation, bool bSweep, FHitResult& OutHit, ETeleportType Teleport = ETeleportType::None);
    virtual float SlideAlongSurface(const FVector& Delta, float Time, const FVector& Normal, FHitResult& Hit, bool bHandleImpact = false);
    virtual FVector ComputeSlideVector(const FVector& Delta, const float Time, const FVector& Normal, const FHitResult& Hit) const;
    virtual void HandleImpact(const FHitResult& Hit, float TimeSlice = 0.f, const FVector& MoveDelta = FVector::ZeroVector);
    virtual void TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
};
