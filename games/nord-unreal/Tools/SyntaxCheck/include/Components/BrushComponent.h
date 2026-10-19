// Offline UE 5.x API stub: Components/BrushComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
class UBrushComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UBrushComponent, UPrimitiveComponent)
    UBrushComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<class UModel> Brush;
    TObjectPtr<class UBodySetup> BrushBodySetup;
};
