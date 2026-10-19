// Offline UE 5.x API stub: Components/ActorComponent.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"

class AActor;
class UWorld;
class ULevel;
class UAssetUserData;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FActorComponentActivatedSignature, UActorComponent*, Component, bool, bReset);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FActorComponentDeactivateSignature, UActorComponent*, Component);

class UActorComponent : public UObject
{
    UESTUB_UCLASS_BODY(UActorComponent, UObject)
    UActorComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());

    FActorComponentTickFunction PrimaryComponentTick;
    TArray<FName> ComponentTags;
    uint8 bAutoActivate : 1;
    uint8 bEditableWhenInherited : 1;
    uint8 bWantsInitializeComponent : 1;
    uint8 bAllowAnyoneToDestroyMe : 1;
    uint8 bIsEditorOnly : 1;
    FActorComponentActivatedSignature OnComponentActivated;
    FActorComponentDeactivateSignature OnComponentDeactivated;

    AActor* GetOwner() const;
    template <class T> T* GetOwner() const { return Cast<T>(GetOwner()); }
    virtual UWorld* GetWorld() const override final;
    ENetMode GetNetMode() const;
    ENetRole GetOwnerRole() const;
    bool IsNetSimulating() const;
    bool IsNetMode(ENetMode Mode) const;
    bool ComponentHasTag(FName Tag) const;
    void RegisterComponent();
    void UnregisterComponent();
    void ReregisterComponent();
    bool IsRegistered() const;
    bool HasBeenInitialized() const;
    bool HasBegunPlay() const;
    bool IsBeingDestroyed() const;
    virtual void DestroyComponent(bool bPromoteChildren = false);
    void K2_DestroyComponent(UObject* Object);
    virtual void Activate(bool bReset = false);
    virtual void Deactivate();
    virtual void SetActive(bool bNewActive, bool bReset = false);
    virtual void ToggleActive();
    bool IsActive() const;
    virtual void SetAutoActivate(bool bNewAutoActivate);
    virtual void SetComponentTickEnabled(bool bEnabled);
    virtual bool IsComponentTickEnabled() const;
    void SetComponentTickInterval(float TickInterval);
    void SetComponentTickIntervalAndCooldown(float TickInterval);
    float GetComponentTickInterval() const;
    void SetTickGroup(ETickingGroup NewTickGroup);
    void SetTickableWhenPaused(bool bTickableWhenPaused);
    void AddTickPrerequisiteActor(AActor* PrerequisiteActor);
    void AddTickPrerequisiteComponent(UActorComponent* PrerequisiteComponent);
    virtual void SetIsReplicated(bool ShouldReplicate);
    bool GetIsReplicated() const;
    void SetIsReplicatedByDefault(const bool bNewReplicates);
    void SetCanEverAffectNavigation(bool bRelevant);
    bool CanEverAffectNavigation() const;
    virtual bool IsEditorOnly() const override;
    void MarkRenderStateDirty();
    void MarkRenderTransformDirty();
    void MarkRenderDynamicDataDirty();
    void RecreateRenderState_Concurrent();
    void RecreatePhysicsState();
    bool IsRenderStateCreated() const;
    bool IsPhysicsStateCreated() const;
    ULevel* GetComponentLevel() const;
    bool IsOwnerSelected() const;
    void UpdateComponentToWorld();
    virtual void InitializeComponent();
    virtual void UninitializeComponent();
    virtual void BeginPlay();
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason);
    virtual void TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction);
    virtual void OnComponentCreated();
    virtual void OnComponentDestroyed(bool bDestroyingHierarchy);
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
protected:
    virtual void OnRegister();
    virtual void OnUnregister();
    virtual void CreateRenderState_Concurrent(class FRegisterComponentContext* Context);
    virtual void SendRenderTransform_Concurrent();
    virtual void SendRenderDynamicData_Concurrent();
    virtual void DestroyRenderState_Concurrent();
    virtual void OnCreatePhysicsState();
    virtual void OnDestroyPhysicsState();
    uint8 bReplicates : 1;
};
