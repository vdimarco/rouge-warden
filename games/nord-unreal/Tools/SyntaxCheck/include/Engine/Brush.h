#pragma once
#include "GameFramework/Actor.h"
class UBrushComponent;
class ABrush : public AActor
{
    UESTUB_UCLASS_BODY(ABrush, AActor)
    ABrush(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UBrushComponent* GetBrushComponent() const;
    TObjectPtr<class UModel> Brush;
};
