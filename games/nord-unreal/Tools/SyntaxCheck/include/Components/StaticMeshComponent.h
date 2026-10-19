// Offline UE 5.x API stub: Components/StaticMeshComponent.h
#pragma once
#include "Components/MeshComponent.h"
class UStaticMesh;
class UStaticMeshComponent : public UMeshComponent
{
    UESTUB_UCLASS_BODY(UStaticMeshComponent, UMeshComponent)
    UStaticMeshComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    int32 ForcedLodModel;
    int32 MinLOD;
    uint8 bOverrideWireframeColor : 1;
    uint8 bOverrideMinLOD : 1;
    uint8 bEvaluateWorldPositionOffset : 1;
    FColor WireframeColorOverride;
    virtual bool SetStaticMesh(class UStaticMesh* NewMesh);
    TObjectPtr<UStaticMesh> GetStaticMesh() const;
    void SetForcedLodModel(int32 NewForcedLodModel);
    void SetEvaluateWorldPositionOffset(bool NewValue);
    void SetDistanceFieldSelfShadowBias(float NewValue);
    void GetLocalBounds(FVector& Min, FVector& Max) const;
    virtual void SetMaterial(int32 ElementIndex, UMaterialInterface* Material) override;
    virtual UMaterialInterface* GetMaterial(int32 MaterialIndex) const override;
    virtual int32 GetNumMaterials() const override;
    virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
};
