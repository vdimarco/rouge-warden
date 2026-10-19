// Offline UE 5.x API stub: GameFramework/PhysicsVolume.h
#pragma once
#include "GameFramework/Volume.h"
class APhysicsVolume : public AVolume
{
    UESTUB_UCLASS_BODY(APhysicsVolume, AVolume)
    APhysicsVolume(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float TerminalVelocity;
    int32 Priority;
    float FluidFriction;
    uint32 bWaterVolume : 1;
    uint32 bPhysicsOnContact : 1;
    virtual bool IsOverlapInVolume(const class USceneComponent& TestComponent) const;
    virtual float GetGravityZ() const;
    virtual void ActorEnteredVolume(class AActor* Other);
    virtual void ActorLeavingVolume(class AActor* Other);
};
