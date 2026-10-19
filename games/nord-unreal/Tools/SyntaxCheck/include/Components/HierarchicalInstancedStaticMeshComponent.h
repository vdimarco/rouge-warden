// Offline UE 5.x API stub: Components/HierarchicalInstancedStaticMeshComponent.h
#pragma once
#include "Components/InstancedStaticMeshComponent.h"
class UHierarchicalInstancedStaticMeshComponent : public UInstancedStaticMeshComponent
{
    UESTUB_UCLASS_BODY(UHierarchicalInstancedStaticMeshComponent, UInstancedStaticMeshComponent)
    UHierarchicalInstancedStaticMeshComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    uint8 bEnableDensityScaling : 1;
    virtual bool RemoveInstance(int32 InstanceIndex) override;
    virtual void ClearInstances() override;
    virtual void SetCullDistances(int32 StartCullDistance, int32 EndCullDistance) override;
    void BuildTreeIfOutdated(bool Async, bool ForceUpdate);
};
