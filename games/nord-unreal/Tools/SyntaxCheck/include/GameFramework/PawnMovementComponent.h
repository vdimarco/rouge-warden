// Offline UE 5.x API stub: GameFramework/PawnMovementComponent.h
#pragma once
#include "GameFramework/NavMovementComponent.h"
class APawn;
class UPawnMovementComponent : public UNavMovementComponent
{
    UESTUB_UCLASS_BODY(UPawnMovementComponent, UNavMovementComponent)
    UPawnMovementComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual void AddInputVector(FVector WorldVector, bool bForce = false);
    FVector GetPendingInputVector() const;
    FVector GetLastInputVector() const;
    virtual FVector ConsumeInputVector();
    virtual bool IsMoveInputIgnored() const override;
    APawn* GetPawnOwner() const;
    virtual void NotifyBumpedPawn(APawn* BumpedPawn);
    virtual void SetUpdatedComponent(USceneComponent* NewUpdatedComponent) override;
protected:
    TObjectPtr<APawn> PawnOwner;
};
