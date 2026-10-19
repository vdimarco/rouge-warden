// Offline UE 5.x API stub: BoneIndices.h (typed bone indices used by poses and bone containers)
#pragma once
#include "CoreMinimal.h"
typedef uint16 FBoneIndexType;
struct FBoneIndexBase
{
    FBoneIndexBase() : BoneIndex(INDEX_NONE) {}
    int32 GetInt() const { return BoneIndex; }
    bool IsRootBone() const { return BoneIndex == 0; }
    bool IsValid() const { return BoneIndex != INDEX_NONE; }
    explicit operator int32() const { return BoneIndex; }
    friend uint32 GetTypeHash(const FBoneIndexBase& Index) { return GetTypeHash(Index.BoneIndex); }
protected:
    int32 BoneIndex;
};
template <class RealBoneIndexType>
struct FBoneIndexWithOperators : public FBoneIndexBase
{
    RealBoneIndexType& operator++() { ++BoneIndex; return static_cast<RealBoneIndexType&>(*this); }
    RealBoneIndexType& operator--() { --BoneIndex; return static_cast<RealBoneIndexType&>(*this); }
    const RealBoneIndexType& operator=(const RealBoneIndexType& Rhs) { BoneIndex = Rhs.BoneIndex; return static_cast<const RealBoneIndexType&>(*this); }
    friend bool operator==(const RealBoneIndexType& Lhs, const RealBoneIndexType& Rhs) { return Lhs.BoneIndex == Rhs.BoneIndex; }
    friend bool operator!=(const RealBoneIndexType& Lhs, const RealBoneIndexType& Rhs) { return Lhs.BoneIndex != Rhs.BoneIndex; }
    friend bool operator<(const RealBoneIndexType& Lhs, const RealBoneIndexType& Rhs) { return Lhs.BoneIndex < Rhs.BoneIndex; }
    friend bool operator>(const RealBoneIndexType& Lhs, const RealBoneIndexType& Rhs) { return Lhs.BoneIndex > Rhs.BoneIndex; }
    friend bool operator<=(const RealBoneIndexType& Lhs, const RealBoneIndexType& Rhs) { return Lhs.BoneIndex <= Rhs.BoneIndex; }
    friend bool operator>=(const RealBoneIndexType& Lhs, const RealBoneIndexType& Rhs) { return Lhs.BoneIndex >= Rhs.BoneIndex; }
    friend bool operator==(const RealBoneIndexType& Lhs, int32 Rhs) { return Lhs.BoneIndex == Rhs; }
    friend bool operator!=(const RealBoneIndexType& Lhs, int32 Rhs) { return Lhs.BoneIndex != Rhs; }
};
struct FCompactPoseBoneIndex : public FBoneIndexWithOperators<FCompactPoseBoneIndex>
{
    explicit FCompactPoseBoneIndex(int32 InBoneIndex) { BoneIndex = InBoneIndex; }
};
struct FMeshPoseBoneIndex : public FBoneIndexWithOperators<FMeshPoseBoneIndex>
{
    explicit FMeshPoseBoneIndex(int32 InBoneIndex) { BoneIndex = InBoneIndex; }
};
struct FSkeletonPoseBoneIndex : public FBoneIndexWithOperators<FSkeletonPoseBoneIndex>
{
    explicit FSkeletonPoseBoneIndex(int32 InBoneIndex) { BoneIndex = InBoneIndex; }
};
