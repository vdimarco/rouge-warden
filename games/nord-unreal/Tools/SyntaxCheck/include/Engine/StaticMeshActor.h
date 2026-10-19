// Offline UE 5.x API stub: Engine/StaticMeshActor.h
#pragma once
#include "GameFramework/Actor.h"
class UStaticMeshComponent;
class AStaticMeshActor : public AActor
{
    UESTUB_UCLASS_BODY(AStaticMeshActor, AActor)
    AStaticMeshActor(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UStaticMeshComponent* GetStaticMeshComponent() const;
    void SetMobility(EComponentMobility::Type InMobility);
    bool bStaticMeshReplicateMovement;

};
