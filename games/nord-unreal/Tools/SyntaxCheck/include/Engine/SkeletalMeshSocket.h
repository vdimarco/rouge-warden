// Offline UE 5.x API stub: Engine/SkeletalMeshSocket.h
#pragma once
#include "UEStub/UObjectCore.h"
class USkeletalMeshComponent;
class USkeletalMeshSocket : public UObject
{
    UESTUB_UCLASS_BODY(USkeletalMeshSocket, UObject)
    USkeletalMeshSocket(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FName SocketName;
    FName BoneName;
    FVector RelativeLocation;
    FRotator RelativeRotation;
    FVector RelativeScale;
    bool bForceAlwaysAnimated;
    FVector GetSocketLocation(const class USkeletalMeshComponent* SkelComp) const;
    FTransform GetSocketTransform(const class USkeletalMeshComponent* SkelComp) const;
    FTransform GetSocketLocalTransform() const;
    bool AttachActor(class AActor* Actor, class USkeletalMeshComponent* SkelComp) const;
};
