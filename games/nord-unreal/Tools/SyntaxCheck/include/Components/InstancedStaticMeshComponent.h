// Offline UE 5.x API stub: Components/InstancedStaticMeshComponent.h
#pragma once
#include "Components/StaticMeshComponent.h"
struct FInstancedStaticMeshInstanceData { FMatrix Transform; };
class UInstancedStaticMeshComponent : public UStaticMeshComponent
{
    UESTUB_UCLASS_BODY(UInstancedStaticMeshComponent, UStaticMeshComponent)
    UInstancedStaticMeshComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FInstancedStaticMeshInstanceData> PerInstanceSMData;
    int32 InstanceStartCullDistance;
    int32 InstanceEndCullDistance;
    int32 NumCustomDataFloats;
    virtual int32 AddInstance(const FTransform& InstanceTransform, bool bWorldSpace = false);
    virtual TArray<int32> AddInstances(const TArray<FTransform>& InstanceTransforms, bool bShouldReturnIndices, bool bWorldSpace = false, bool bUpdateNavigation = true);
    virtual bool UpdateInstanceTransform(int32 InstanceIndex, const FTransform& NewInstanceTransform, bool bWorldSpace = false, bool bMarkRenderStateDirty = false, bool bTeleport = false);
    virtual bool BatchUpdateInstancesTransforms(int32 StartInstanceIndex, const TArray<FTransform>& NewInstancesTransforms, bool bWorldSpace = false, bool bMarkRenderStateDirty = false, bool bTeleport = false);
    virtual bool RemoveInstance(int32 InstanceIndex);
    virtual bool RemoveInstances(const TArray<int32>& InstancesToRemove);
    virtual void ClearInstances();
    virtual bool GetInstanceTransform(int32 InstanceIndex, FTransform& OutInstanceTransform, bool bWorldSpace = false) const;
    int32 GetInstanceCount() const;
    bool IsValidInstance(int32 InstanceIndex) const;
    virtual void SetCullDistances(int32 StartCullDistance, int32 EndCullDistance);
    virtual void SetNumCustomDataFloats(int32 InNumCustomDataFloats);
    virtual bool SetCustomDataValue(int32 InstanceIndex, int32 CustomDataIndex, float CustomDataValue, bool bMarkRenderStateDirty = false);
    virtual bool SetCustomData(int32 InstanceIndex, TArrayView<const float> CustomDataFloats, bool bMarkRenderStateDirty = false);
    TArray<int32> GetInstancesOverlappingSphere(const FVector& Center, float Radius, bool bSphereInWorldSpace = true) const;
    TArray<int32> GetInstancesOverlappingBox(const FBox& Box, bool bBoxInWorldSpace = true) const;
};
