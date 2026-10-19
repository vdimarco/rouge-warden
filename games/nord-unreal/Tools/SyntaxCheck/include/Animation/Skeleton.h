// Offline UE 5.x API stub: Animation/Skeleton.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "ReferenceSkeleton.h"
class USkeletalMeshSocket;
class USkeletalMesh;
class USkeleton : public UObject
{
    UESTUB_UCLASS_BODY(USkeleton, UObject)
    USkeleton(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<TObjectPtr<USkeletalMeshSocket>> Sockets;
    const FReferenceSkeleton& GetReferenceSkeleton() const;
    USkeletalMeshSocket* FindSocket(FName InSocketName) const;
    USkeletalMeshSocket* FindSocketAndIndex(FName InSocketName, int32& OutIndex) const;
    int32 GetAnimationTrackIndex(const int32 InSkeletonBoneIndex, const class UAnimSequence* InAnimSeq, const bool bUseRawData);
    bool IsCompatibleMesh(const USkeletalMesh* InSkelMesh, bool bDoParentChainCheck = true) const;
    void AddSlotGroupName(FName InSlotName);
    void SetSlotGroupName(FName InSlotName, FName InGroupName);
};
