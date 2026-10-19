// Offline UE 5.x API stub: BoneContainer.h
#pragma once
#include "CoreMinimal.h"
#include "CustomBoneIndexArray.h"
#include "ReferenceSkeleton.h"
class USkeleton;
class USkeletalMesh;
class UObject;
struct FBoneReference;
namespace UE::Anim { struct FCurveFilterSettings; }
enum class ECurveFilterMode : uint8 { None, DisallowAll, DisallowFiltered, AllowOnlyFiltered };
struct FCurveEvaluationOption
{
    bool bAllowCurveEvaluation;
    const TArray<FName>* DisallowedList;
    int32 LODIndex;
    FCurveEvaluationOption(bool bInAllowCurveEvaluation = true, const TArray<FName>* InDisallowedList = nullptr, int32 InLODIndex = 0);
};
struct FBoneContainer
{
    FBoneContainer();
    FBoneContainer(const TArrayView<const FBoneIndexType>& InRequiredBoneIndexArray, const FCurveEvaluationOption& CurveEvalOption, UObject& InAsset);
    void InitializeTo(const TArray<FBoneIndexType>& InRequiredBoneIndexArray, const FCurveEvaluationOption& CurveEvalOption, UObject& InAsset);
    void Reset();
    bool IsValid() const;
    UObject* GetAsset() const;
    USkeletalMesh* GetSkeletalMeshAsset() const;
    USkeleton* GetSkeletonAsset(bool bEvenIfUnreachable = false) const;
    bool GetDisableRetargeting() const;
    void SetDisableRetargeting(bool InbDisableRetargeting);
    bool ShouldUseRawData() const;
    void SetUseRAWData(bool InbUseRAWData);
    bool ShouldUseSourceData() const;
    void SetUseSourceData(bool InbUseSourceData);
    const TArray<FBoneIndexType>& GetBoneIndicesArray() const;
    const TArray<FCompactPoseBoneIndex>& GetCompactPoseParentBoneArray() const;
    const FReferenceSkeleton& GetReferenceSkeleton() const;
    const int32 GetNumBones() const;
    int32 GetCompactPoseNumBones() const;
    int32 GetPoseBoneIndexForBoneName(const FName& BoneName) const;
    int32 GetParentBoneIndex(const int32 BoneIndex) const;
    FCompactPoseBoneIndex GetParentBoneIndex(const FCompactPoseBoneIndex& BoneIndex) const;
    int32 GetDepthBetweenBones(const int32 BoneIndex, const int32 ParentBoneIndex) const;
    bool BoneIsChildOf(const int32 BoneIndex, const int32 ParentBoneIndex) const;
    bool BoneIsChildOf(const FCompactPoseBoneIndex& BoneIndex, const FCompactPoseBoneIndex& ParentBoneIndex) const;
    bool Contains(FBoneIndexType NewIndex) const;
    const FTransform& GetRefPoseTransform(const FCompactPoseBoneIndex& BoneIndex) const;
    const TArray<FTransform>& GetRefPoseArray() const;
    FCompactPoseBoneIndex MakeCompactPoseIndex(const FMeshPoseBoneIndex& MeshIndex) const;
    FMeshPoseBoneIndex MakeMeshPoseIndex(const FCompactPoseBoneIndex& CompactIndex) const;
    FCompactPoseBoneIndex GetCompactPoseIndexFromSkeletonIndex(const int32 SkeletonIndex) const;
    FCompactPoseBoneIndex GetCompactPoseIndexFromSkeletonPoseIndex(const FSkeletonPoseBoneIndex SkeletonIndex) const;
    int32 GetSkeletonIndex(const FCompactPoseBoneIndex& BoneIndex) const;
    FSkeletonPoseBoneIndex GetSkeletonPoseIndexFromCompactPoseIndex(const FCompactPoseBoneIndex& BoneIndex) const;
    FSkeletonPoseBoneIndex GetSkeletonPoseIndexFromMeshPoseIndex(const FMeshPoseBoneIndex& MeshIndex) const;
    FMeshPoseBoneIndex GetMeshPoseIndexFromSkeletonPoseIndex(const FSkeletonPoseBoneIndex& SkeletonIndex) const;
    const FCurveEvaluationOption& GetCurveEvaluationOption() const;
    void SetCurveEvaluationOption(const FCurveEvaluationOption& InCurveEvaluationOption);
    int32 GetCalculatedForLOD() const;
    void SetCalculatedForLOD(int32 InLOD);
    uint16 GetSerialNumber() const;
};
