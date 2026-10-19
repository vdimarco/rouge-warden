// Offline UE 5.x API stub: CustomBoneIndexArray.h
#pragma once
#include "CoreMinimal.h"
#include "Misc/MemStack.h"
#include "BoneIndices.h"
typedef TMemStackAllocator<> FAnimStackAllocator;
template <typename InElementType, typename InBoneIndexType, typename InAllocator = FDefaultAllocator>
struct TCustomBoneIndexArray : public TArray<InElementType, InAllocator>
{
    InElementType& operator[](InBoneIndexType Index);
    const InElementType& operator[](InBoneIndexType Index) const;
};
