// Offline UE 5.x API stub: AITypes.h (AIModule)
#pragma once
#include "CoreMinimal.h"
#include "AI/Navigation/NavigationTypes.h"
struct FAIRequestID
{
    FAIRequestID(uint32 InRequestID = InvalidRequestID) : RequestID(InRequestID) {}
    bool IsEquivalent(uint32 OtherID) const;
    bool IsEquivalent(FAIRequestID Other) const;
    bool IsValid() const { return RequestID != InvalidRequestID; }
    uint32 GetID() const { return RequestID; }
    operator uint32() const { return RequestID; }
    FString ToString() const;
    static const uint32 AnyRequestID = 0;
    static const uint32 InvalidRequestID = uint32(-1);
    static const FAIRequestID AnyRequest;
    static const FAIRequestID CurrentRequest;
    static const FAIRequestID InvalidRequest;
private:
    uint32 RequestID;
};
namespace EAIFocusPriority
{
    typedef uint8 Type;
    inline const Type Default = 0;
    inline const Type Move = 1;
    inline const Type Gameplay = 2;
    inline const Type LastFocusPriority = Gameplay;
}
namespace EAIOptionFlag { enum Type : int { Default, Enable, Disable, MAX }; }
struct FAIMoveRequest
{
    FAIMoveRequest();
    explicit FAIMoveRequest(const AActor* InGoalActor);
    explicit FAIMoveRequest(const FVector& InGoalLocation);
    FAIMoveRequest& SetGoalActor(const AActor* InGoalActor);
    FAIMoveRequest& SetGoalLocation(const FVector& InGoalLocation);
    FAIMoveRequest& SetAcceptanceRadius(float Radius);
    FAIMoveRequest& SetUsePathfinding(bool bPathfinding);
    FAIMoveRequest& SetAllowPartialPath(bool bAllowPartial);
    FAIMoveRequest& SetCanStrafe(bool bStrafe);
    FAIMoveRequest& SetReachTestIncludesAgentRadius(bool bIncludeRadius);
    FAIMoveRequest& SetReachTestIncludesGoalRadius(bool bIncludeRadius);
    FAIMoveRequest& SetProjectGoalLocation(bool bProject);
    FAIMoveRequest& SetNavigationFilter(TSubclassOf<UNavigationQueryFilter> Filter);
    bool IsMoveToActorRequest() const;
    AActor* GetGoalActor() const;
    FVector GetGoalLocation() const;
    float GetAcceptanceRadius() const;
};
