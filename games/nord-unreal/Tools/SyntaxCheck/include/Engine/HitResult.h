// Offline UE 5.x API stub: Engine/HitResult.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/NetSerialization.h"

class AActor;
class UPrimitiveComponent;
class UPhysicalMaterial;

struct FActorInstanceHandle
{
    FActorInstanceHandle();
    explicit FActorInstanceHandle(AActor* InActor);
    bool IsValid() const;
    AActor* GetCachedActor() const;
    AActor* FetchActor() const;
    template <class T> T* FetchActor() const;
    int32 GetInstanceIndex() const;
};

struct FHitResult
{
    int32 FaceIndex;
    float Time;
    float Distance;
    FVector_NetQuantize Location;
    FVector_NetQuantize ImpactPoint;
    FVector_NetQuantizeNormal Normal;
    FVector_NetQuantizeNormal ImpactNormal;
    FVector_NetQuantize TraceStart;
    FVector_NetQuantize TraceEnd;
    float PenetrationDepth;
    int32 MyItem;
    int32 Item;
    uint8 ElementIndex;
    uint8 bBlockingHit : 1;
    uint8 bStartPenetrating : 1;
    TWeakObjectPtr<UPhysicalMaterial> PhysMaterial;
    FActorInstanceHandle HitObjectHandle;
    TWeakObjectPtr<UPrimitiveComponent> Component;
    FName BoneName;
    FName MyBoneName;

    FHitResult();
    explicit FHitResult(float InTime);
    explicit FHitResult(EForceInit InInit);
    explicit FHitResult(ENoInit NoInit);
    FHitResult(FVector Start, FVector End);
    FHitResult(AActor* InActor, UPrimitiveComponent* InComponent, FVector const& HitLoc, FVector const& HitNorm);
    void Reset(float InTime = 1.f, bool bPreserveTraceData = true);
    void Init();
    void Init(FVector Start, FVector End);
    AActor* GetActor() const;
    UPrimitiveComponent* GetComponent() const;
    const FActorInstanceHandle& GetHitObjectHandle() const;
    bool HasValidHitObjectHandle() const;
    bool IsValidBlockingHit() const;
    FHitResult GetReversedHit() const;
    FString ToString() const;
    static FHitResult* GetFirstBlockingHit(TArray<FHitResult>& InHits);
    static int32 GetNumBlockingHits(const TArray<FHitResult>& InHits);
    static int32 GetNumOverlapHits(const TArray<FHitResult>& InHits);
};
