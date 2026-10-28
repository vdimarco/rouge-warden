// Offline UE 5.x API stub: Engine/OverlapResult.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/HitResult.h"
class AActor;
class UPrimitiveComponent;
struct FOverlapResult
{
    FActorInstanceHandle OverlapObjectHandle;
    TWeakObjectPtr<UPrimitiveComponent> Component;
    int32 ItemIndex;
    uint32 bBlockingHit : 1;
    FOverlapResult();
    AActor* GetActor() const;
    UPrimitiveComponent* GetComponent() const;
    const FActorInstanceHandle& GetHitObjectHandle() const;
};
