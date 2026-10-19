// Offline UE 5.x API stub: ReferenceSkeleton.h
#pragma once
#include "UEStub/UObjectCore.h"
struct FMeshBoneInfo { FName Name; int32 ParentIndex; FMeshBoneInfo(); };
struct FReferenceSkeleton
{
    int32 GetNum() const;
    int32 GetRawBoneNum() const;
    const TArray<FMeshBoneInfo>& GetRefBoneInfo() const;
    const TArray<FMeshBoneInfo>& GetRawRefBoneInfo() const;
    const TArray<FTransform>& GetRefBonePose() const;
    const TArray<FTransform>& GetRawRefBonePose() const;
    int32 FindBoneIndex(const FName& BoneName) const;
    int32 FindRawBoneIndex(const FName& BoneName) const;
    FName GetBoneName(const int32 BoneIndex) const;
    int32 GetParentIndex(const int32 BoneIndex) const;
    int32 GetRawParentIndex(const int32 BoneIndex) const;
    bool IsValidIndex(int32 Index) const;
    int32 GetDepthBetweenBones(const int32 BoneIndex, const int32 ParentBoneIndex) const;
    bool BoneIsChildOf(const int32 ChildBoneIndex, const int32 ParentBoneIndex) const;
    int32 GetDirectChildBones(int32 ParentBoneIndex, TArray<int32>& Children) const;
};
