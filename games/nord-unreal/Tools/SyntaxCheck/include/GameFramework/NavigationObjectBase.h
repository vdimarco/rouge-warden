#pragma once
#include "GameFramework/Actor.h"
class UCapsuleComponent;
class ANavigationObjectBase : public AActor
{
    UESTUB_UCLASS_BODY(ANavigationObjectBase, AActor)
    ANavigationObjectBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UCapsuleComponent* GetCapsuleComponent() const;
};
