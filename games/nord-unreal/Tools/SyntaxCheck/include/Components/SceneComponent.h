// Offline UE 5.x API stub: Components/SceneComponent.h
#pragma once
#include "Components/ActorComponent.h"

class APhysicsVolume;
class USceneComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FIsRootComponentChanged, USceneComponent*, UpdatedComponent, bool, bIsRootComponent);
DECLARE_EVENT_ThreeParams(USceneComponent, FTransformUpdated, USceneComponent*, EUpdateTransformFlags, ETeleportType);

class USceneComponent : public UActorComponent
{
    UESTUB_UCLASS_BODY(USceneComponent, UActorComponent)
    USceneComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());

    FBoxSphereBounds Bounds;
    TEnumAsByte<EComponentMobility::Type> Mobility;
    FVector ComponentVelocity;
    uint8 bShouldUpdatePhysicsVolume : 1;
    uint8 bVisualizeComponent : 1;
    FTransformUpdated TransformUpdated;
    static const FName& GetDefaultSceneRootVariableName();

    // attachment
    void SetupAttachment(USceneComponent* InParent, FName InSocketName = NAME_None);
    bool AttachToComponent(USceneComponent* InParent, const FAttachmentTransformRules& AttachmentRules, FName InSocketName = NAME_None);
    bool K2_AttachToComponent(USceneComponent* Parent, FName SocketName, EAttachmentRule LocationRule, EAttachmentRule RotationRule, EAttachmentRule ScaleRule, bool bWeldSimulatedBodies);
    virtual void DetachFromComponent(const FDetachmentTransformRules& DetachmentRules);
    void K2_DetachFromComponent(EDetachmentRule LocationRule = EDetachmentRule::KeepRelative, EDetachmentRule RotationRule = EDetachmentRule::KeepRelative, EDetachmentRule ScaleRule = EDetachmentRule::KeepRelative, bool bCallModify = true);
    USceneComponent* GetAttachParent() const;
    AActor* GetAttachParentActor() const;
    FName GetAttachSocketName() const;
    const TArray<TObjectPtr<USceneComponent>>& GetAttachChildren() const;
    void GetChildrenComponents(bool bIncludeAllDescendants, TArray<USceneComponent*>& Children) const;
    int32 GetNumChildrenComponents() const;
    USceneComponent* GetChildComponent(int32 ChildIndex) const;
    void GetParentComponents(TArray<USceneComponent*>& Parents) const;
    bool IsAttachedTo(const USceneComponent* TestComp) const;
    virtual bool CanAttachAsChild(const USceneComponent* ChildComponent, FName SocketName) const;
    // sockets
    virtual FTransform GetSocketTransform(FName InSocketName, ERelativeTransformSpace TransformSpace = RTS_World) const;
    virtual FVector GetSocketLocation(FName InSocketName) const;
    virtual FRotator GetSocketRotation(FName InSocketName) const;
    virtual FQuat GetSocketQuaternion(FName InSocketName) const;
    virtual bool DoesSocketExist(FName InSocketName) const;
    virtual bool HasAnySockets() const;
    virtual void GetSocketWorldLocationAndRotation(FName InSocketName, FVector& OutLocation, FRotator& OutRotation) const;
    TArray<FName> GetAllSocketNames() const;
    // relative transform
    FVector GetRelativeLocation() const;
    FRotator GetRelativeRotation() const;
    FVector GetRelativeScale3D() const;
    FTransform GetRelativeTransform() const;
    void SetRelativeLocation(FVector NewLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetRelativeRotation(FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetRelativeRotation(const FQuat& NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetRelativeLocationAndRotation(FVector NewLocation, FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetRelativeLocationAndRotation(FVector NewLocation, const FQuat& NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    virtual void SetRelativeScale3D(FVector NewScale3D);
    void SetRelativeTransform(const FTransform& NewTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void ResetRelativeTransform();
    void AddRelativeLocation(FVector DeltaLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddRelativeRotation(FRotator DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddRelativeRotation(const FQuat& DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddLocalOffset(FVector DeltaLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddLocalRotation(FRotator DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddLocalRotation(const FQuat& DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddLocalTransform(const FTransform& DeltaTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    // world transform
    void SetWorldLocation(FVector NewLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetWorldRotation(FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetWorldRotation(const FQuat& NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetWorldScale3D(FVector NewScale);
    void SetWorldTransform(const FTransform& NewTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetWorldLocationAndRotation(FVector NewLocation, FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetWorldLocationAndRotation(FVector NewLocation, const FQuat& NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetWorldLocationAndRotationNoPhysics(const FVector& NewLocation, const FRotator& NewRotation);
    void AddWorldOffset(FVector DeltaLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddWorldRotation(FRotator DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddWorldRotation(const FQuat& DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddWorldTransform(const FTransform& DeltaTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    bool MoveComponent(const FVector& Delta, const FQuat& NewRotation, bool bSweep, FHitResult* OutHit = nullptr, EMoveComponentFlags MoveFlags = MOVECOMP_NoFlags, ETeleportType Teleport = ETeleportType::None);
    bool MoveComponent(const FVector& Delta, const FRotator& NewRotation, bool bSweep, FHitResult* OutHit = nullptr, EMoveComponentFlags MoveFlags = MOVECOMP_NoFlags, ETeleportType Teleport = ETeleportType::None);
    FVector GetComponentLocation() const;
    FRotator GetComponentRotation() const;
    FQuat GetComponentQuat() const;
    FVector GetComponentScale() const;
    const FTransform& GetComponentTransform() const;
    const FTransform& GetComponentToWorld() const;
    FVector GetForwardVector() const;
    FVector GetRightVector() const;
    FVector GetUpVector() const;
    virtual FVector GetComponentVelocity() const;
    void UpdateComponentToWorld(EUpdateTransformFlags UpdateTransformFlags = EUpdateTransformFlags::None, ETeleportType Teleport = ETeleportType::None);
    void UpdateBounds();
    virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const;
    // absolute flags
    void SetUsingAbsoluteLocation(bool bInAbsoluteLocation);
    void SetUsingAbsoluteRotation(bool bInAbsoluteRotation);
    void SetUsingAbsoluteScale(bool bInAbsoluteScale);
    void SetAbsolute(bool bNewAbsoluteLocation = false, bool bNewAbsoluteRotation = false, bool bNewAbsoluteScale = false);
    bool IsUsingAbsoluteLocation() const;
    bool IsUsingAbsoluteRotation() const;
    bool IsUsingAbsoluteScale() const;
    // visibility
    void SetVisibility(bool bNewVisibility, bool bPropagateToChildren = false);
    void ToggleVisibility(bool bPropagateToChildren = false);
    bool GetVisibleFlag() const;
    virtual bool IsVisible() const;
    void SetHiddenInGame(bool NewHidden, bool bPropagateToChildren = false);
    bool IsVisibleInEditor() const;
    bool ShouldRender() const;
    // mobility / physics volume
    virtual void SetMobility(EComponentMobility::Type NewMobility);
    bool IsMoveable() const;
    bool IsSimulatingPhysics(FName BoneName = NAME_None) const;
    bool IsAnySimulatingPhysics() const;
    void SetShouldUpdatePhysicsVolume(bool bInShouldUpdatePhysicsVolume);
    bool GetShouldUpdatePhysicsVolume() const;
    APhysicsVolume* GetPhysicsVolume() const;
    virtual void SetPhysicsVolume(APhysicsVolume* NewVolume, bool bTriggerNotifiers);
    virtual void UpdatePhysicsVolume(bool bTriggerNotifiers);
    // overrides
    virtual void OnRegister() override;
    virtual void BeginDestroy() override;
    virtual void DestroyComponent(bool bPromoteChildren = false) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
protected:
    virtual void OnUpdateTransform(EUpdateTransformFlags UpdateTransformFlags, ETeleportType Teleport = ETeleportType::None);
    virtual void OnAttachmentChanged();
    virtual void OnChildAttached(USceneComponent* ChildComponent);
    virtual void OnChildDetached(USceneComponent* ChildComponent);
    virtual void OnVisibilityChanged();
    virtual void OnHiddenInGameChanged();
};
