// Offline UE 5.x API stub: Engine/TriggerBase.h
#pragma once
#include "GameFramework/Actor.h"
class UShapeComponent;
class UBillboardComponent;
class ATriggerBase : public AActor
{
    UESTUB_UCLASS_BODY(ATriggerBase, AActor)
    ATriggerBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UShapeComponent* GetCollisionComponent() const;
};
