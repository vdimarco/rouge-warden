// Offline UE 5.x API stub: AIController.h (AIModule)
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Controller.h"
#include "AITypes.h"
#include "Navigation/PathFollowingComponent.h"
class UBehaviorTree;
class UBlackboardComponent;
class UBlackboardData;
class UBrainComponent;
class UAIPerceptionComponent;
class UNavigationQueryFilter;
class UPathFollowingComponent;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAIMoveCompletedSignature, FAIRequestID, RequestID, EPathFollowingResult::Type, Result);
class AAIController : public AController
{
    UESTUB_UCLASS_BODY(AAIController, AController)
    AAIController(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    uint32 bStartAILogicOnPossess : 1;
    uint32 bStopAILogicOnUnposses : 1;
    uint32 bSkipExtraLOSChecks : 1;
    uint32 bAllowStrafe : 1;
    uint32 bWantsPlayerState : 1;
    uint32 bSetControlRotationFromPawnOrientation : 1;
    FAIMoveCompletedSignature ReceiveMoveCompleted;
    TObjectPtr<UBlackboardComponent> Blackboard;
    EPathFollowingRequestResult::Type MoveToActor(AActor* Goal, float AcceptanceRadius = -1, bool bStopOnOverlap = true, bool bUsePathfinding = true, bool bCanStrafe = true, TSubclassOf<UNavigationQueryFilter> FilterClass = {}, bool bAllowPartialPath = true);
    EPathFollowingRequestResult::Type MoveToLocation(const FVector& Dest, float AcceptanceRadius = -1, bool bStopOnOverlap = true, bool bUsePathfinding = true, bool bProjectDestinationToNavigation = false, bool bCanStrafe = true, TSubclassOf<UNavigationQueryFilter> FilterClass = {}, bool bAllowPartialPath = true);
    virtual FPathFollowingRequestResult MoveTo(const FAIMoveRequest& MoveRequest, struct FNavPathSharedPtr* OutPath = nullptr);
    virtual void StopMovement() override;
    EPathFollowingStatus::Type GetMoveStatus() const;
    bool HasPartialPath() const;
    FVector GetImmediateMoveDestination() const;
    UPathFollowingComponent* GetPathFollowingComponent() const;
    virtual void OnMoveCompleted(FAIRequestID RequestID, const FPathFollowingResult& Result);
    virtual void SetFocus(AActor* NewFocus, EAIFocusPriority::Type InPriority = EAIFocusPriority::Gameplay);
    virtual void SetFocalPoint(FVector NewFocus, EAIFocusPriority::Type InPriority = EAIFocusPriority::Gameplay);
    virtual void ClearFocus(EAIFocusPriority::Type InPriority);
    FVector GetFocalPoint() const;
    FVector GetFocalPointForPriority(EAIFocusPriority::Type InPriority) const;
    AActor* GetFocusActor() const;
    virtual void UpdateControlRotation(float DeltaTime, bool bUpdatePawn = true);
    virtual bool LineOfSightTo(const AActor* Other, FVector ViewPoint = FVector(ForceInit), bool bAlternateChecks = false) const override;
    virtual bool RunBehaviorTree(UBehaviorTree* BTAsset);
    bool UseBlackboard(UBlackboardData* BlackboardAsset, UBlackboardComponent*& BlackboardComponent);
    UBlackboardComponent* GetBlackboardComponent();
    const UBlackboardComponent* GetBlackboardComponent() const;
    UBrainComponent* GetBrainComponent() const;
    UAIPerceptionComponent* GetAIPerceptionComponent();
    virtual void OnPossess(APawn* InPawn) override;
    virtual void OnUnPossess() override;
    virtual void Tick(float DeltaTime) override;
};
