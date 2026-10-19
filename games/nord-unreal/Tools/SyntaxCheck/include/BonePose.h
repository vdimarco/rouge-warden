// Offline UE 5.x API stub: BonePose.h (local- and component-space poses)
#pragma once
#include "CoreMinimal.h"
#include "BoneContainer.h"
#include "CustomBoneIndexArray.h"

template <class BoneIndexType>
struct TBoneIndexRange
{
    struct FIterator
    {
        BoneIndexType operator*() const;
        FIterator& operator++();
        bool operator!=(const FIterator& Other) const;
    };
    FIterator begin() const;
    FIterator end() const;
};

template <typename InAllocator>
struct FBaseCompactPose
{
    typedef FCompactPoseBoneIndex BoneIndexType;
    typedef InAllocator AllocatorType;
    typedef TBoneIndexRange<FCompactPoseBoneIndex> RangeType;

    void SetBoneContainer(const FBoneContainer* InBoneContainer);
    const FBoneContainer& GetBoneContainer() const;
    FBoneContainer& GetBoneContainer();
    void InitBones(int32 NumBones);
    void ResetToRefPose();
    void ResetToRefPose(const FBoneContainer& RequiredBones);
    void ResetToAdditiveIdentity();
    void NormalizeRotations();
    bool IsNormalized() const;
    bool ContainsNaN() const;
    void Empty();
    int32 GetNumBones() const;
    bool IsValidIndex(const FCompactPoseBoneIndex& BoneIndex) const;
    bool IsValid() const;
    FCompactPoseBoneIndex GetParentBoneIndex(const FCompactPoseBoneIndex& BoneIndex) const;
    const FTransform& GetRefPose(const FCompactPoseBoneIndex& BoneIndex) const;
    FTransform& operator[](FCompactPoseBoneIndex BoneIndex);
    const FTransform& operator[](FCompactPoseBoneIndex BoneIndex) const;
    TArrayView<FTransform> GetMutableBones();
    const TArray<FTransform, InAllocator>& GetBones() const;
    RangeType ForEachBoneIndex() const;
    template <typename OtherAllocator> void CopyBonesFrom(const FBaseCompactPose<OtherAllocator>& SrcPose);
    template <typename OtherAllocator> void MoveBonesFrom(FBaseCompactPose<OtherAllocator>& SrcPose);
    template <typename OtherAllocator> void MoveBonesTo(TArray<FTransform, OtherAllocator>& OutTransforms);
    void CopyAndAssignBoneContainer(FBoneContainer& NewBoneContainer);
};
struct FCompactPose : public FBaseCompactPose<FAnimStackAllocator> {};
struct FCompactHeapPose : public FBaseCompactPose<FDefaultAllocator> {};

template <class PoseType>
struct FCSPose
{
    typedef typename PoseType::BoneIndexType BoneIndexType;
    template <typename OtherPoseType> void InitPose(const OtherPoseType& SrcPose);
    void InitPose(const FBoneContainer* InBoneContainer);
    void InitPose(PoseType&& SrcPose);
    const PoseType& GetPose() const;
    const FBoneContainer& GetBoneContainer() const;
    const FTransform& GetComponentSpaceTransform(BoneIndexType BoneIndex);
    FTransform GetLocalSpaceTransform(BoneIndexType BoneIndex);
    void SetComponentSpaceTransform(BoneIndexType BoneIndex, const FTransform& NewTransform);
    void CalculateComponentSpaceTransform(BoneIndexType BoneIndex);
    void SafeSetCSBoneTransforms(const TArray<struct FBoneTransform>& BoneTransforms);
    void LocalBlendCSBoneTransforms(const TArray<struct FBoneTransform>& BoneTransforms, float Alpha);
    void ConvertToLocalPoses(PoseType& OutPose) const;
    void Empty();
    static void ConvertComponentPosesToLocalPoses(FCSPose<PoseType>&& InPose, PoseType& OutPose);
    static void ConvertComponentPosesToLocalPoses(const FCSPose<PoseType>& InPose, PoseType& OutPose);
};
