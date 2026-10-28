// Offline UE 5.x API stub: Navigation/PathFollowingComponent.h (AIModule)
#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AITypes.h"
namespace EPathFollowingStatus { enum Type : int { Idle, Waiting, Paused, Moving }; }
namespace EPathFollowingResult { enum Type : int { Success, Blocked, OffPath, Aborted, Skipped_DEPRECATED, Invalid }; }
namespace EPathFollowingRequestResult { enum Type : int { Failed, AlreadyAtGoal, RequestSuccessful }; }
namespace FPathFollowingResultFlags
{
    typedef uint16 Type;
    inline const Type None = 0;
    inline const Type Success = 1 << 0;
    inline const Type Blocked = 1 << 1;
    inline const Type OffPath = 1 << 2;
    inline const Type UserAbort = 1 << 3;
}
struct FPathFollowingResult
{
    TEnumAsByte<EPathFollowingResult::Type> Code;
    FPathFollowingResultFlags::Type Flags;
    FPathFollowingResult();
    FPathFollowingResult(EPathFollowingResult::Type ResultCode, FPathFollowingResultFlags::Type ExtraFlags);
    bool HasFlag(FPathFollowingResultFlags::Type Flag) const;
    bool IsSuccess() const;
    bool IsFailure() const;
    bool IsInterrupted() const;
    FString ToString() const;
};
struct FPathFollowingRequestResult
{
    FAIRequestID MoveId;
    TEnumAsByte<EPathFollowingRequestResult::Type> Code;
    FPathFollowingRequestResult();
    operator EPathFollowingRequestResult::Type() const { return Code; }
};
enum class EPathFollowingReachMode : uint8 { Exact, OverlapAgent, OverlapGoal, OverlapAgentAndGoal };
enum class EPathFollowingVelocityMode : uint8 { Reset, Keep };
class UPathFollowingComponent : public UActorComponent
{
    UESTUB_UCLASS_BODY(UPathFollowingComponent, UActorComponent)
    UPathFollowingComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    EPathFollowingStatus::Type GetStatus() const;
    FAIRequestID GetCurrentRequestId() const;
    bool HasReached(const FVector& TestPoint, EPathFollowingReachMode ReachMode, float AcceptanceRadius = -1.f) const;
    bool DidMoveReachGoal() const;
    FVector GetCurrentTargetLocation() const;
    float GetRemainingPathCost() const;
    void AbortMove(const UObject& Instigator, FPathFollowingResultFlags::Type AbortFlags, FAIRequestID RequestID = FAIRequestID::CurrentRequest, EPathFollowingVelocityMode VelocityMode = EPathFollowingVelocityMode::Reset);
};
