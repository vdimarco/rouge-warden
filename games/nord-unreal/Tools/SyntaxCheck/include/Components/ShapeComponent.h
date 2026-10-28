// Offline UE 5.x API stub: Components/ShapeComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
class UShapeComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UShapeComponent, UPrimitiveComponent)
    UShapeComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FColor ShapeColor;
    float LineThickness;
    uint8 bDrawOnlyIfSelected : 1;
    uint8 bShouldCollideWhenPlacing : 1;
    uint8 bDynamicObstacle : 1;
    void SetLineThickness(float Thickness);
};
