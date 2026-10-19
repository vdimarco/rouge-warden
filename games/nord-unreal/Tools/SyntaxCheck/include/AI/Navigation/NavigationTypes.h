// Offline UE 5.x API stub: AI/Navigation/NavigationTypes.h (Engine module)
#pragma once
#include "CoreMinimal.h"
typedef uint64 NavNodeRef;
#define INVALID_NAVNODEREF (0)
#define INVALID_NAVQUERYID uint32(0)
#define INVALID_NAVEXTENT (FVector(FLT_MAX))
class ANavigationData;
class UNavigationQueryFilter;
class INavAgentInterface;
struct FNavigationQueryFilter;
typedef TSharedPtr<const FNavigationQueryFilter, ESPMode::ThreadSafe> FSharedConstNavQueryFilter;
struct FNavLocation
{
    FVector Location;
    NavNodeRef NodeRef;
    FNavLocation() : Location(FVector::ZeroVector), NodeRef(INVALID_NAVNODEREF) {}
    explicit FNavLocation(const FVector& InLocation, NavNodeRef InNodeRef = INVALID_NAVNODEREF) : Location(InLocation), NodeRef(InNodeRef) {}
    bool HasNodeRef() const { return NodeRef != INVALID_NAVNODEREF; }
    operator FVector() const { return Location; }
};
struct FMovementProperties
{
    uint8 bCanCrouch : 1;
    uint8 bCanJump : 1;
    uint8 bCanWalk : 1;
    uint8 bCanSwim : 1;
    uint8 bCanFly : 1;
    FMovementProperties();
};
struct FNavAgentProperties : public FMovementProperties
{
    float AgentRadius;
    float AgentHeight;
    float AgentStepHeight;
    float NavWalkingSearchHeightScale;
    FNavAgentProperties(float Radius = -1.f, float Height = -1.f);
    bool IsValid() const;
    bool HasStepHeightOverride() const;
};
struct FNavPathPoint : public FNavLocation
{
    uint32 Flags;
    FNavPathPoint();
};
namespace ENavigationQueryResult { enum Type : int { Invalid, Error, Fail, Success }; }
