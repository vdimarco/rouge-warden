// Offline UE 5.x API stub: CollisionQueryParams.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"

class AActor;
class UPrimitiveComponent;
#define SCENE_QUERY_STAT_ONLY(QueryName) TStatId()
#define SCENE_QUERY_STAT_NAME_ONLY(QueryName) FName(TEXT(#QueryName))
#define SCENE_QUERY_STAT(QueryName) SCENE_QUERY_STAT_NAME_ONLY(QueryName), SCENE_QUERY_STAT_ONLY(QueryName)

enum class EQueryMobilityType { Any, Static, Dynamic };
struct FCollisionQueryParams
{
    FName TraceTag;
    FName OwnerTag;
    bool bTraceComplex;
    bool bFindInitialOverlaps;
    bool bReturnFaceIndex;
    bool bReturnPhysicalMaterial;
    bool bIgnoreBlocks;
    bool bIgnoreTouches;
    bool bSkipNarrowPhase;
    bool bTraceIntoSubComponents;
    bool bReplaceHitWithSubComponents;
    EQueryMobilityType MobilityType;
    static FCollisionQueryParams DefaultQueryParam;
    FCollisionQueryParams();
    FCollisionQueryParams(FName InTraceTag, bool bInTraceComplex = false, const AActor* InIgnoreActor = nullptr);
    FCollisionQueryParams(FName InTraceTag, const TStatId& InStatId, bool bInTraceComplex = false, const AActor* InIgnoreActor = nullptr);
    void AddIgnoredActor(const AActor* InIgnoreActor);
    void AddIgnoredActor(const uint32 InIgnoreActorID);
    void AddIgnoredActors(const TArray<AActor*>& InIgnoreActors);
    void AddIgnoredActors(const TArray<const AActor*>& InIgnoreActors);
    void AddIgnoredActors(const TArray<TWeakObjectPtr<const AActor>>& InIgnoreActors);
    template <typename Allocator> void AddIgnoredActors(const TArray<AActor*, Allocator>& InIgnoreActors);
    void AddIgnoredComponent(const UPrimitiveComponent* InIgnoreComponent);
    void AddIgnoredComponents(const TArray<UPrimitiveComponent*>& InIgnoreComponents);
    void AddIgnoredComponents(const TArray<TWeakObjectPtr<UPrimitiveComponent>>& InIgnoreComponents);
    void ClearIgnoredActors();
    void ClearIgnoredComponents();
    void ClearIgnoredSourceObjects();
    const TArray<uint32>& GetIgnoredActors() const;
    const TArray<uint32>& GetIgnoredComponents() const;
    FString ToString() const;
};
struct FComponentQueryParams : public FCollisionQueryParams
{
    static FComponentQueryParams DefaultComponentQueryParam;
    FComponentQueryParams();
    FComponentQueryParams(FName InTraceTag, const AActor* InIgnoreActor = nullptr);
    FComponentQueryParams(FName InTraceTag, const TStatId& InStatId, const AActor* InIgnoreActor = nullptr);
};
struct FCollisionObjectQueryParams
{
    enum InitType { AllObjects, AllStaticObjects, AllDynamicObjects };
    int32 ObjectTypesToQuery;
    int32 IgnoreMask;
    static FCollisionObjectQueryParams DefaultObjectQueryParam;
    FCollisionObjectQueryParams();
    FCollisionObjectQueryParams(ECollisionChannel QueryChannel);
    FCollisionObjectQueryParams(const TArray<TEnumAsByte<EObjectTypeQuery>>& ObjectTypes);
    FCollisionObjectQueryParams(enum FCollisionObjectQueryParams::InitType QueryType);
    explicit FCollisionObjectQueryParams(int32 InObjectTypesToQuery);
    void AddObjectTypesToQuery(ECollisionChannel QueryChannel);
    void RemoveObjectTypesToQuery(ECollisionChannel QueryChannel);
    int32 GetQueryBitfield() const;
    bool IsValid() const;
    static bool IsValidObjectQuery(ECollisionChannel QueryChannel);
    FString ToString() const;
};
struct FCollisionResponseParams
{
    FCollisionResponseContainer CollisionResponse;
    static FCollisionResponseParams DefaultResponseParam;
    FCollisionResponseParams(ECollisionResponse DefaultResponse = ECR_Block);
    FCollisionResponseParams(const FCollisionResponseContainer& ResponseContainer);
};
