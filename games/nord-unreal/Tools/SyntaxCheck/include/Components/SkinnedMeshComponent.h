// Offline UE 5.x API stub: Components/SkinnedMeshComponent.h
#pragma once
#include "Components/MeshComponent.h"
class USkinnedAsset;
class USkeletalMesh;
class UPhysicsAsset;
namespace EBoneSpaces { enum Type : int { WorldSpace, ComponentSpace }; }
enum class EBoneVisibilityStatus : uint8;
namespace EPhysBodyOp { enum Type : int { PBO_None, PBO_Term }; }
using EPhysBodyOpType = EPhysBodyOp::Type;

class USkinnedMeshComponent : public UMeshComponent
{
    UESTUB_UCLASS_BODY(USkinnedMeshComponent, UMeshComponent)
    USkinnedMeshComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    EVisibilityBasedAnimTickOption VisibilityBasedAnimTickOption;
    uint8 bEnableUpdateRateOptimizations : 1;
    uint8 bDisplayDebugUpdateRateOptimizations : 1;
    uint8 bRenderStatic : 1;
    uint8 bIgnoreLeaderPoseComponentLOD : 1;
    uint8 bCastCapsuleDirectShadow : 1;
    uint8 bCastCapsuleIndirectShadow : 1;
    uint8 bCPUSkinning : 1;
    uint8 bPerBoneMotionBlur : 1;
    uint8 bComponentUseFixedSkelBounds : 1;
    uint8 bConsiderAllBodiesForBounds : 1;
    TWeakObjectPtr<USkinnedMeshComponent> LeaderPoseComponent;
    USkinnedAsset* GetSkinnedAsset() const;
    virtual void SetSkinnedAssetAndUpdate(USkinnedAsset* NewMesh, bool bReinitPose = true);
    void SetLeaderPoseComponent(USkinnedMeshComponent* NewLeaderBoneComponent, bool bForceUpdate = false, bool bInFollowerShouldTickPose = false);
    int32 GetBoneIndex(FName BoneName) const;
    FName GetBoneName(int32 BoneIndex) const;
    int32 GetNumBones() const;
    FName GetParentBone(FName BoneName) const;
    FTransform GetBoneTransform(int32 BoneIndex) const;
    FTransform GetBoneTransform(FName InBoneName, ERelativeTransformSpace TransformSpace = RTS_World) const;
    FTransform GetBoneTransform(int32 BoneIndex, const FTransform& LocalToWorld) const;
    FVector GetBoneLocation(FName BoneName, EBoneSpaces::Type Space = EBoneSpaces::WorldSpace) const;
    FQuat GetBoneQuaternion(FName BoneName, EBoneSpaces::Type Space = EBoneSpaces::WorldSpace) const;
    FMatrix GetBoneMatrix(int32 BoneIndex) const;
    bool BoneIsChildOf(FName BoneName, FName ParentBoneName) const;
    FName GetSocketBoneName(FName InSocketName) const;
    class USkeletalMeshSocket const* GetSocketByName(FName InSocketName) const;
    void HideBoneByName(FName BoneName, EPhysBodyOp::Type PhysBodyOption);
    void UnHideBoneByName(FName BoneName);
    bool IsBoneHiddenByName(FName BoneName);
    void SetForcedLOD(int32 InNewForcedLOD);
    int32 GetForcedLOD() const;
    int32 GetPredictedLODLevel() const;
    virtual void RefreshBoneTransforms(FActorComponentTickFunction* TickFunction = nullptr);
    virtual FTransform GetSocketTransform(FName InSocketName, ERelativeTransformSpace TransformSpace = RTS_World) const override;
    virtual bool DoesSocketExist(FName InSocketName) const override;
    virtual bool HasAnySockets() const override;
    virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
    void SetRenderStatic(bool bNewValue);
};
