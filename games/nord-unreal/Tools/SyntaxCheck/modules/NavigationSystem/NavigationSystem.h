// Offline UE 5.x API stub: NavigationSystem.h (NavigationSystem module)
#pragma once
#include "CoreMinimal.h"
#include "AI/Navigation/NavigationTypes.h"
#include "Engine/World.h"
class ANavigationData;
class UNavigationPath;
class UNavigationQueryFilter;
class UNavigationSystemBase : public UObject
{
    UESTUB_UCLASS_BODY(UNavigationSystemBase, UObject)
    UNavigationSystemBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
};
class UNavigationSystemV1 : public UNavigationSystemBase
{
    UESTUB_UCLASS_BODY(UNavigationSystemV1, UNavigationSystemBase)
    UNavigationSystemV1(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    template <typename TNavSys = UNavigationSystemV1> static TNavSys* GetCurrent(UWorld* World) { static_assert(std::is_base_of_v<UNavigationSystemBase, TNavSys>, "GetCurrent: not a navigation system"); return nullptr; }
    template <typename TNavSys = UNavigationSystemV1> static TNavSys* GetCurrent(UObject* WorldContextObject) { static_assert(std::is_base_of_v<UNavigationSystemBase, TNavSys>, "GetCurrent: not a navigation system"); return nullptr; }
    static UNavigationSystemV1* GetNavigationSystem(UObject* WorldContextObject);
    bool GetRandomPoint(FNavLocation& ResultLocation, ANavigationData* NavData = nullptr, FSharedConstNavQueryFilter QueryFilter = nullptr);
    bool GetRandomReachablePointInRadius(const FVector& Origin, float Radius, FNavLocation& ResultLocation, ANavigationData* NavData = nullptr, FSharedConstNavQueryFilter QueryFilter = nullptr) const;
    bool GetRandomPointInNavigableRadius(const FVector& Origin, float Radius, FNavLocation& ResultLocation, ANavigationData* NavData = nullptr, FSharedConstNavQueryFilter QueryFilter = nullptr) const;
    bool ProjectPointToNavigation(const FVector& Point, FNavLocation& OutLocation, const FVector& Extent = INVALID_NAVEXTENT, const FNavAgentProperties* AgentProperties = nullptr, FSharedConstNavQueryFilter QueryFilter = nullptr);
    ANavigationData* GetDefaultNavDataInstance() const;
    ANavigationData* GetNavDataForProps(const FNavAgentProperties& AgentProperties);
    static bool K2_GetRandomReachablePointInRadius(UObject* WorldContextObject, const FVector& Origin, FVector& RandomLocation, float Radius, ANavigationData* NavData = nullptr, TSubclassOf<UNavigationQueryFilter> FilterClass = {});
    static bool K2_GetRandomLocationInNavigableRadius(UObject* WorldContextObject, const FVector& Origin, FVector& RandomLocation, float Radius, ANavigationData* NavData = nullptr, TSubclassOf<UNavigationQueryFilter> FilterClass = {});
    static bool K2_ProjectPointToNavigation(UObject* WorldContextObject, const FVector& Point, FVector& ProjectedLocation, ANavigationData* NavData, TSubclassOf<UNavigationQueryFilter> FilterClass, const FVector QueryExtent = FVector::ZeroVector);
    static UNavigationPath* FindPathToLocationSynchronously(UObject* WorldContextObject, const FVector& PathStart, const FVector& PathEnd, AActor* PathfindingContext = nullptr, TSubclassOf<UNavigationQueryFilter> FilterClass = {});
    static UNavigationPath* FindPathToActorSynchronously(UObject* WorldContextObject, const FVector& PathStart, AActor* GoalActor, float TetherDistance = 50.f, AActor* PathfindingContext = nullptr, TSubclassOf<UNavigationQueryFilter> FilterClass = {});
    static void SimpleMoveToActor(AController* Controller, const AActor* Goal);
    static void SimpleMoveToLocation(AController* Controller, const FVector& Goal);
};
class UNavigationPath : public UObject
{
    UESTUB_UCLASS_BODY(UNavigationPath, UObject)
    UNavigationPath(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FVector> PathPoints;
    bool IsValid() const;
    bool IsPartial() const;
    double GetPathLength() const;
    double GetPathCost() const;
};
