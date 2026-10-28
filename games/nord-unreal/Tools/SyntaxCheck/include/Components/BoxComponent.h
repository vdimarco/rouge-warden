// Offline UE 5.x API stub: Components/BoxComponent.h
#pragma once
#include "Components/ShapeComponent.h"
class UBoxComponent : public UShapeComponent
{
    UESTUB_UCLASS_BODY(UBoxComponent, UShapeComponent)
    UBoxComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    void SetBoxExtent(FVector InBoxExtent, bool bUpdateOverlaps = true);
    FVector GetScaledBoxExtent() const;
    FVector GetUnscaledBoxExtent() const;
    void InitBoxExtent(const FVector& InBoxExtent);
    void SetLineThickness(float Thickness);
    virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
};
