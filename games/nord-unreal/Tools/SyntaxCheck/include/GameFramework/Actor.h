// Offline UE 5.x API stub: GameFramework/Actor.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
#include "Engine/EngineBaseTypes.h"
#include "Components/ActorComponent.h"
#include "Components/SceneComponent.h"
#include "Templates/SubclassOf.h"

class AActor;
class APawn;
class AController;
class APlayerController;
class UInputComponent;
class UPrimitiveComponent;
class UDamageType;
class UWorld;
class ULevel;
class UGameInstance;
class UNetConnection;
class UPlayer;
class FTimerManager;
struct FDamageEvent;
class FComponentInstanceDataCache;
struct FKey;

DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_FiveParams(FTakeAnyDamageSignature, AActor, OnTakeAnyDamage, AActor*, DamagedActor, float, Damage, const class UDamageType*, DamageType, class AController*, InstigatedBy, AActor*, DamageCauser);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_NineParams(FTakePointDamageSignature, AActor, OnTakePointDamage, AActor*, DamagedActor, float, Damage, class AController*, InstigatedBy, FVector, HitLocation, class UPrimitiveComponent*, FHitComponent, FName, BoneName, FVector, ShotFromDirection, const class UDamageType*, DamageType, AActor*, DamageCauser);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_SevenParams(FTakeRadialDamageSignature, AActor*, DamagedActor, float, Damage, const class UDamageType*, DamageType, FVector, Origin, const FHitResult&, HitInfo, class AController*, InstigatedBy, AActor*, DamageCauser);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_TwoParams(FActorBeginOverlapSignature, AActor, OnActorBeginOverlap, AActor*, OverlappedActor, AActor*, OtherActor);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_TwoParams(FActorEndOverlapSignature, AActor, OnActorEndOverlap, AActor*, OverlappedActor, AActor*, OtherActor);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_FourParams(FActorHitSignature, AActor, OnActorHit, AActor*, SelfActor, AActor*, OtherActor, FVector, NormalImpulse, const FHitResult&, Hit);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_OneParam(FActorBeginCursorOverSignature, AActor, OnBeginCursorOver, AActor*, TouchedActor);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_OneParam(FActorEndCursorOverSignature, AActor, OnEndCursorOver, AActor*, TouchedActor);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_TwoParams(FActorOnClickedSignature, AActor, OnClicked, AActor*, TouchedActor, FKey, ButtonPressed);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_OneParam(FActorDestroyedSignature, AActor, OnDestroyed, AActor*, DestroyedActor);
DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_TwoParams(FActorEndPlaySignature, AActor, OnEndPlay, AActor*, Actor, EEndPlayReason::Type, EndPlayReason);

class AActor : public UObject
{
    UESTUB_UCLASS_BODY(AActor, UObject)
    AActor();
    AActor(const FObjectInitializer& ObjectInitializer);

    FActorTickFunction PrimaryActorTick;
    uint8 bNetTemporary : 1;
    uint8 bOnlyRelevantToOwner : 1;
    uint8 bAlwaysRelevant : 1;
    uint8 bNetLoadOnClient : 1;
    uint8 bNetUseOwnerRelevancy : 1;
    uint8 bRelevantForNetworkReplays : 1;
    uint8 bReplayRewindable : 1;
    uint8 bAllowTickBeforeBeginPlay : 1;
    uint8 bBlockInput : 1;
    uint8 bFindCameraComponentWhenViewTarget : 1;
    uint8 bGenerateOverlapEventsDuringLevelStreaming : 1;
    uint8 bEnableAutoLODGeneration : 1;
    uint8 bIsEditorOnlyActor : 1;
    uint8 bAutoDestroyWhenFinished : 1;
    uint8 bCanBeInCluster : 1;
    uint8 bIgnoresOriginShifting : 1;
    TEnumAsByte<ENetDormancy> NetDormancy;
    ESpawnActorCollisionHandlingMethod SpawnCollisionHandlingMethod;
    TEnumAsByte<EAutoReceiveInput::Type> AutoReceiveInput;
    int32 InputPriority;
    TObjectPtr<UInputComponent> InputComponent;
    float NetPriority;
    float InitialLifeSpan;
    float CustomTimeDilation;
    TArray<FName> Tags;
    TArray<FName> Layers;
    FTakeAnyDamageSignature OnTakeAnyDamage;
    FTakePointDamageSignature OnTakePointDamage;
    FTakeRadialDamageSignature OnTakeRadialDamage;
    FActorBeginOverlapSignature OnActorBeginOverlap;
    FActorEndOverlapSignature OnActorEndOverlap;
    FActorBeginCursorOverSignature OnBeginCursorOver;
    FActorEndCursorOverSignature OnEndCursorOver;
    FActorOnClickedSignature OnClicked;
    FActorHitSignature OnActorHit;
    FActorDestroyedSignature OnDestroyed;
    FActorEndPlaySignature OnEndPlay;

    // world / game
    virtual UWorld* GetWorld() const override final;
    class FTimerManager& GetWorldTimerManager() const;
    UGameInstance* GetGameInstance() const;
    template <class T> T* GetGameInstance() const { return Cast<T>(GetGameInstance()); }
    ULevel* GetLevel() const;
    float GetGameTimeSinceCreation() const;
    float GetActorTimeDilation() const;
    // networking
    bool HasAuthority() const;
    ENetRole GetLocalRole() const;
    ENetRole GetRemoteRole() const;
    ENetMode GetNetMode() const;
    bool IsNetMode(ENetMode Mode) const;
    bool HasLocalNetOwner() const;
    bool HasNetOwner() const;
    bool GetIsReplicated() const;
    void SetReplicates(bool bInReplicates);
    virtual void SetReplicateMovement(bool bInReplicateMovement);
    bool IsReplicatingMovement() const;
    void SetReplicatingMovement(bool bInReplicateMovement);
    virtual void SetAutonomousProxy(const bool bInAutonomousProxy, const bool bAllowForcePropertyCompare = true);
    void SetNetUpdateFrequency(float InNetUpdateFrequency);
    float GetNetUpdateFrequency() const;
    void SetMinNetUpdateFrequency(float InMinNetUpdateFrequency);
    float GetMinNetUpdateFrequency() const;
    void SetNetCullDistanceSquared(float DistanceSq);
    float GetNetCullDistanceSquared() const;
    virtual void ForceNetUpdate();
    void FlushNetDormancy();
    void SetNetDormancy(ENetDormancy NewDormancy);
    bool IsNetStartupActor() const;
    virtual UNetConnection* GetNetConnection() const;
    virtual UPlayer* GetNetOwningPlayer();
    virtual bool IsNetRelevantFor(const AActor* RealViewer, const AActor* ViewTarget, const FVector& SrcLocation) const;
    virtual void PreReplication(class IRepChangedPropertyTracker& ChangedPropertyTracker);
    virtual void OnRep_ReplicatedMovement();
    virtual void PostNetReceiveLocationAndRotation();
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    // ownership
    AActor* GetOwner() const;
    template <class T> T* GetOwner() const { return Cast<T>(GetOwner()); }
    virtual void SetOwner(AActor* NewOwner);
    bool IsOwnedBy(const AActor* TestOwner) const;
    APawn* GetInstigator() const;
    template <class T> T* GetInstigator() const { return Cast<T>(GetInstigator()); }
    AController* GetInstigatorController() const;
    template <class T> T* GetInstigatorController() const { return Cast<T>(GetInstigatorController()); }
    void SetInstigator(APawn* InInstigator);
    // transform
    FVector GetActorLocation() const;
    FRotator GetActorRotation() const;
    FQuat GetActorQuat() const;
    FVector GetActorScale() const;
    FVector GetActorScale3D() const;
    FVector GetActorRelativeScale3D() const;
    const FTransform& GetActorTransform() const;
    const FTransform& GetTransform() const;
    FVector GetActorForwardVector() const;
    FVector GetActorRightVector() const;
    FVector GetActorUpVector() const;
    virtual FVector GetVelocity() const;
    void GetActorBounds(bool bOnlyCollidingComponents, FVector& Origin, FVector& BoxExtent, bool bIncludeFromChildActors = false) const;
    virtual FBox GetComponentsBoundingBox(bool bNonColliding = false, bool bIncludeFromChildActors = false) const;
    virtual void GetSimpleCollisionCylinder(float& CollisionRadius, float& CollisionHalfHeight) const;
    float GetSimpleCollisionRadius() const;
    float GetSimpleCollisionHalfHeight() const;
    virtual FVector GetTargetLocation(AActor* RequestedBy = nullptr) const;
    virtual void GetActorEyesViewPoint(FVector& OutLocation, FRotator& OutRotation) const;
    bool SetActorLocation(const FVector& NewLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    bool K2_SetActorLocation(FVector NewLocation, bool bSweep, FHitResult& SweepHitResult, bool bTeleport);
    bool SetActorRotation(FRotator NewRotation, ETeleportType Teleport = ETeleportType::None);
    bool SetActorRotation(const FQuat& NewRotation, ETeleportType Teleport = ETeleportType::None);
    bool SetActorLocationAndRotation(FVector NewLocation, FRotator NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    bool SetActorLocationAndRotation(FVector NewLocation, const FQuat& NewRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetActorScale3D(FVector NewScale3D);
    void SetActorRelativeLocation(FVector NewRelativeLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetActorRelativeRotation(FRotator NewRelativeRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetActorRelativeRotation(const FQuat& NewRelativeRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void SetActorRelativeScale3D(FVector NewRelativeScale);
    void SetActorRelativeTransform(const FTransform& NewRelativeTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    bool SetActorTransform(const FTransform& NewTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorWorldOffset(FVector DeltaLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorWorldRotation(FRotator DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorWorldRotation(const FQuat& DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorWorldTransform(const FTransform& DeltaTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorLocalOffset(FVector DeltaLocation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorLocalRotation(FRotator DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorLocalRotation(const FQuat& DeltaRotation, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    void AddActorLocalTransform(const FTransform& NewTransform, bool bSweep = false, FHitResult* OutSweepHitResult = nullptr, ETeleportType Teleport = ETeleportType::None);
    virtual bool TeleportTo(const FVector& DestLocation, const FRotator& DestRotation, bool bIsATest = false, bool bNoCheck = false);
    bool K2_TeleportTo(FVector DestLocation, FRotator DestRotation);
    float GetDistanceTo(const AActor* OtherActor) const;
    float GetSquaredDistanceTo(const AActor* OtherActor) const;
    float GetHorizontalDistanceTo(const AActor* OtherActor) const;
    double GetSquaredHorizontalDistanceTo(const AActor* OtherActor) const;
    float GetVerticalDistanceTo(const AActor* OtherActor) const;
    float GetDotProductTo(const AActor* OtherActor) const;
    float GetHorizontalDotProductTo(const AActor* OtherActor) const;
    // lifetime
    bool Destroy(bool bNetForce = false, bool bShouldModifyLevel = true);
    void K2_DestroyActor();
    virtual void SetLifeSpan(float InLifespan);
    virtual float GetLifeSpan() const;
    bool IsActorBeingDestroyed() const;
    bool IsPendingKillPending() const;
    bool HasActorBegunPlay() const;
    bool IsActorBeginningPlay() const;
    bool IsActorInitialized() const;
    void DispatchBeginPlay(bool bFromLevelStreaming = false);
    // deferred spawning (UWorld::SpawnActorDeferred / UGameplayStatics::FinishSpawningActor)
    void FinishSpawning(const FTransform& Transform, bool bIsDefaultTransform = false, const FComponentInstanceDataCache* InstanceDataCache = nullptr, ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::OverrideRootScale);
    void PostSpawnInitialize(FTransform const& SpawnTransform, AActor* InOwner, APawn* InInstigator, bool bRemoteOwned, bool bNoFail, bool bDeferConstruction, ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::MultiplyWithRoot);
    void ExecuteConstruction(const FTransform& Transform, const struct FRotationConversionCache* TransformRotationCache, const FComponentInstanceDataCache* InstanceDataCache, bool bIsDefaultTransform = false, ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::OverrideRootScale);
    void RerunConstructionScripts();
    virtual void Reset();
    // visibility / collision / tick
    bool IsHidden() const;
    void SetHidden(const bool bInHidden);
    virtual void SetActorHiddenInGame(bool bNewHidden);
    virtual void SetActorEnableCollision(bool bNewActorEnableCollision);
    bool GetActorEnableCollision() const;
    void SetCanBeDamaged(bool bInCanBeDamaged);
    bool CanBeDamaged() const;
    void SetActorTickEnabled(bool bEnabled);
    bool IsActorTickEnabled() const;
    void SetActorTickInterval(float TickInterval);
    float GetActorTickInterval() const;
    void SetTickGroup(ETickingGroup NewTickGroup);
    void SetTickableWhenPaused(bool bTickableWhenPaused);
    void AddTickPrerequisiteActor(AActor* PrerequisiteActor);
    void AddTickPrerequisiteComponent(UActorComponent* PrerequisiteComponent);
    virtual void Tick(float DeltaSeconds);
    virtual void TickActor(float DeltaTime, enum ELevelTick TickType, FActorTickFunction& ThisTickFunction);
    virtual bool ShouldTickIfViewportsOnly() const;
    bool WasRecentlyRendered(float Tolerance = 0.2f) const;
    // tags / components
    bool ActorHasTag(FName Tag) const;
    USceneComponent* GetRootComponent() const;
    USceneComponent* K2_GetRootComponent() const;
    bool SetRootComponent(USceneComponent* NewRootComponent);
    virtual USceneComponent* GetDefaultAttachComponent() const;
    UActorComponent* FindComponentByClass(const TSubclassOf<UActorComponent> ComponentClass) const;
    template <class T> T* FindComponentByClass() const { static_assert(std::is_base_of_v<UActorComponent, T>, "'T' template parameter to FindComponentByClass must be derived from UActorComponent"); return nullptr; }
    UActorComponent* GetComponentByClass(TSubclassOf<UActorComponent> ComponentClass) const;
    template <class T> T* GetComponentByClass() const { static_assert(std::is_base_of_v<UActorComponent, T>, "'T' template parameter to GetComponentByClass must be derived from UActorComponent"); return nullptr; }
    UActorComponent* FindComponentByTag(TSubclassOf<UActorComponent> ComponentClass, const FName& Tag) const;
    template <class T> T* FindComponentByTag(const FName& Tag) const { static_assert(std::is_base_of_v<UActorComponent, T>, "FindComponentByTag: T must be a component"); return nullptr; }
    TArray<UActorComponent*> GetComponentsByTag(TSubclassOf<UActorComponent> ComponentClass, FName Tag) const;
    template <class ComponentType, class AllocatorType> void GetComponents(TArray<ComponentType*, AllocatorType>& OutComponents, bool bIncludeFromChildActors = false) const
    { static_assert(std::is_base_of_v<UActorComponent, ComponentType>, "'ComponentType' template parameter to GetComponents must be derived from UActorComponent"); }
    template <class ComponentType, class AllocatorType> void GetComponents(TArray<TObjectPtr<ComponentType>, AllocatorType>& OutComponents, bool bIncludeFromChildActors = false) const
    { static_assert(std::is_base_of_v<UActorComponent, ComponentType>, "'ComponentType' template parameter to GetComponents must be derived from UActorComponent"); }
    template <class ComponentType, class AllocatorType> void GetComponents(TSubclassOf<UActorComponent> ComponentClass, TArray<ComponentType*, AllocatorType>& OutComponents, bool bIncludeFromChildActors = false) const;
    void GetComponents(TSet<UActorComponent*>& OutComponents, bool bIncludeFromChildActors = false) const;
    const TSet<UActorComponent*>& GetComponents() const;
    void AddInstanceComponent(UActorComponent* Component);
    void RemoveInstanceComponent(UActorComponent* Component);
    void ClearInstanceComponents(bool bDestroyComponents);
    const TArray<UActorComponent*>& GetInstanceComponents() const;
    void AddOwnedComponent(UActorComponent* Component);
    void RemoveOwnedComponent(UActorComponent* Component);
    void RegisterAllComponents();
    void UnregisterAllComponents(bool bForReregister = false);
    void ReregisterAllComponents();
    void UpdateComponentTransforms();
    void UpdateOverlaps(bool bDoNotifies = true);
    // attachment
    bool AttachToActor(AActor* ParentActor, const FAttachmentTransformRules& AttachmentRules, FName SocketName = NAME_None);
    bool AttachToComponent(USceneComponent* Parent, const FAttachmentTransformRules& AttachmentRules, FName SocketName = NAME_None);
    void DetachFromActor(const FDetachmentTransformRules& DetachmentRules);
    void DetachAllSceneComponents(class USceneComponent* InParentComponent, const FDetachmentTransformRules& DetachmentRules);
    AActor* GetAttachParentActor() const;
    FName GetAttachParentSocketName() const;
    void GetAttachedActors(TArray<AActor*>& OutActors, bool bResetArray = true, bool bRecursivelyIncludeAttachedActors = false) const;
    AActor* GetParentActor() const;
    class UChildActorComponent* GetParentComponent() const;
    // overlap / hit / damage
    bool IsOverlappingActor(const AActor* Other) const;
    void GetOverlappingActors(TArray<AActor*>& OverlappingActors, TSubclassOf<AActor> ClassFilter = nullptr) const;
    void GetOverlappingActors(TSet<AActor*>& OverlappingActors, TSubclassOf<AActor> ClassFilter = nullptr) const;
    void GetOverlappingComponents(TArray<UPrimitiveComponent*>& OverlappingComponents) const;
    virtual void NotifyActorBeginOverlap(AActor* OtherActor);
    virtual void NotifyActorEndOverlap(AActor* OtherActor);
    virtual void NotifyActorBeginCursorOver();
    virtual void NotifyActorEndCursorOver();
    virtual void NotifyActorOnClicked(FKey ButtonPressed);
    virtual void NotifyHit(class UPrimitiveComponent* MyComp, AActor* Other, class UPrimitiveComponent* OtherComp, bool bSelfMoved, FVector HitLocation, FVector HitNormal, FVector NormalImpulse, const FHitResult& Hit);
    virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, class AController* EventInstigator, AActor* DamageCauser);
    virtual void BecomeViewTarget(class APlayerController* PC);
    virtual void EndViewTarget(class APlayerController* PC);
    virtual void CalcCamera(float DeltaTime, struct FMinimalViewInfo& OutResult);
    bool HasActiveCameraComponent(bool bForceFindCamera = false) const;
    virtual void EnableInput(class APlayerController* PlayerController);
    virtual void DisableInput(class APlayerController* PlayerController);
    void MakeNoise(float Loudness = 1.f, APawn* NoiseInstigator = nullptr, FVector NoiseLocation = FVector::ZeroVector, float MaxRange = 0.f, FName Tag = NAME_None);
    // lifecycle virtuals
    virtual void PostInitializeComponents();
    virtual void PreInitializeComponents();
    virtual void PostRegisterAllComponents();
    virtual void PostUnregisterAllComponents();
    virtual void PostActorCreated();
    virtual void OnConstruction(const FTransform& Transform);
    virtual void Destroyed();
    virtual void PostNetInit();
    virtual void OnReplicationPausedChanged(bool bIsReplicationPaused);
    virtual void PostLoad() override;
    virtual void BeginDestroy() override;
    virtual void ProcessEvent(UFunction* Function, void* Parameters) override;
    virtual int32 GetFunctionCallspace(UFunction* Function, FFrame* Stack) override;
    virtual bool CallRemoteFunction(UFunction* Function, void* Parameters, struct FOutParmRec* OutParms, FFrame* Stack) override;
    virtual bool IsEditorOnly() const override;
    FString GetActorNameOrLabel() const;
    FString GetHumanReadableName() const;
#if WITH_EDITOR
    FString GetActorLabel(bool bCreateIfNone = true) const;
    void SetActorLabel(const FString& NewActorLabel, bool bMarkDirty = true);
#endif
protected:
    TObjectPtr<USceneComponent> RootComponent;
    uint8 bReplicates : 1;
    virtual void BeginPlay();
public:
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason);
};

// Component array that keeps up to NumElements components on the stack (GameFramework/Actor.h).
enum { NumInlinedActorComponents = 24 };
template <class T, uint32 NumElements = NumInlinedActorComponents>
class TInlineComponentArray : public TArray<T, TInlineAllocator<NumElements>>
{
    typedef TArray<T, TInlineAllocator<NumElements>> Super;
public:
    TInlineComponentArray() : Super() {}
    explicit TInlineComponentArray(const AActor* Actor, bool bIncludeFromChildActors = false) : Super()
    {
        if (Actor) { Actor->GetComponents(*this, bIncludeFromChildActors); }
    }
};
