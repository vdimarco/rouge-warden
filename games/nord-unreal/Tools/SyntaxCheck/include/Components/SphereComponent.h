// Offline UE 5.x API stub: Components/SphereComponent.h
#pragma once
#include "Components/ShapeComponent.h"
class USphereComponent : public UShapeComponent
{
    UESTUB_UCLASS_BODY(USphereComponent, UShapeComponent)
    USphereComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    void SetSphereRadius(float InSphereRadius, bool bUpdateOverlaps = true);
    float GetScaledSphereRadius() const;
    float GetUnscaledSphereRadius() const;
    float GetShapeScale() const;
    void InitSphereRadius(float InSphereRadius);
    virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
};
