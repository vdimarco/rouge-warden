// Offline UE 5.x API stub: Engine/SkeletalMesh.h
#pragma once
#include "Engine/SkinnedAsset.h"
class UMorphTarget;
class USkeletalMeshSocket;
class UMaterialInterface;
class FSkeletalMeshRenderData;
struct FSkeletalMaterial
{
    TObjectPtr<UMaterialInterface> MaterialInterface;
    FName MaterialSlotName;
    FSkeletalMaterial();
};
class USkeletalMesh : public USkinnedAsset
{
    UESTUB_UCLASS_BODY(USkeletalMesh, USkinnedAsset)
    USkeletalMesh(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual USkeleton* GetSkeleton() override;
    virtual const USkeleton* GetSkeleton() const override;
    void SetSkeleton(USkeleton* InSkeleton);
    virtual FReferenceSkeleton& GetRefSkeleton() override;
    virtual const FReferenceSkeleton& GetRefSkeleton() const override;
    virtual UPhysicsAsset* GetPhysicsAsset() const override;
    void SetPhysicsAsset(UPhysicsAsset* InPhysicsAsset);
    UMorphTarget* FindMorphTarget(FName MorphTargetName) const;
    const TArray<TObjectPtr<UMorphTarget>>& GetMorphTargets() const;
    TArray<FSkeletalMaterial>& GetMaterials();
    const TArray<FSkeletalMaterial>& GetMaterials() const;
    USkeletalMeshSocket* FindSocket(FName InSocketName) const;
    USkeletalMeshSocket* FindSocketAndIndex(FName InSocketName, int32& OutIndex) const;
    int32 NumSockets() const;
    USkeletalMeshSocket* GetSocketByIndex(int32 Index) const;
    FBoxSphereBounds GetBounds() const;
    FBoxSphereBounds GetImportedBounds() const;
    FSkeletalMeshRenderData* GetResourceForRendering() const;
    int32 GetLODNum() const;
};
