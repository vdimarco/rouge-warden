#pragma once
#include "Engine/StaticMesh.h"
#include "ReferenceSkeleton.h"
class USkeleton;
class UPhysicsAsset;
class USkinnedAsset : public UStreamableRenderAsset
{
    UESTUB_UCLASS_BODY(USkinnedAsset, UStreamableRenderAsset)
    USkinnedAsset(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual USkeleton* GetSkeleton();
    virtual const USkeleton* GetSkeleton() const;
    virtual FReferenceSkeleton& GetRefSkeleton();
    virtual const FReferenceSkeleton& GetRefSkeleton() const;
    virtual UPhysicsAsset* GetPhysicsAsset() const;
};
