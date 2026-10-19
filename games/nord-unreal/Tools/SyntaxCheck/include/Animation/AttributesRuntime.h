// Offline UE 5.x API stub: Animation/AttributesRuntime.h (custom bone attributes carried with a pose)
#pragma once
#include "CoreMinimal.h"
#include "Misc/MemStack.h"
#include "CustomBoneIndexArray.h"

namespace UE { namespace Anim {
struct FAttributeId
{
    FAttributeId(const FName& InName, const FCompactPoseBoneIndex& InCompactBoneIndex, const FName& InNamespace = NAME_None);
    FName GetName() const;
    FName GetNamespace() const;
    int32 GetIndex() const;
};
template <typename InAllocator>
struct TAttributeContainer
{
    TAttributeContainer();
    void Empty();
    bool IsEmpty() const;
    int32 Num() const;
    template <typename OtherAllocator> void CopyFrom(const TAttributeContainer<OtherAllocator>& Other);
    template <typename OtherAllocator> void MoveFrom(TAttributeContainer<OtherAllocator>& Other);
    bool operator==(const TAttributeContainer& Other) const;
};
typedef TAttributeContainer<FAnimStackAllocator> FStackAttributeContainer;
typedef TAttributeContainer<FDefaultAllocator> FHeapAttributeContainer;
}} // namespace UE::Anim
