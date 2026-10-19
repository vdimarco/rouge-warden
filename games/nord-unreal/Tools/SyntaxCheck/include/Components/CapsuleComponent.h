// Offline UE 5.x API stub: Components/CapsuleComponent.h
#pragma once
#include "Components/ShapeComponent.h"
class UCapsuleComponent : public UShapeComponent
{
    UESTUB_UCLASS_BODY(UCapsuleComponent, UShapeComponent)
    UCapsuleComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    void SetCapsuleSize(float InRadius, float InHalfHeight, bool bUpdateOverlaps = true);
    void SetCapsuleRadius(float Radius, bool bUpdateOverlaps = true);
    void SetCapsuleHalfHeight(float HalfHeight, bool bUpdateOverlaps = true);
    void InitCapsuleSize(float InRadius, float InHalfHeight);
    float GetScaledCapsuleRadius() const;
    float GetScaledCapsuleHalfHeight() const;
    float GetScaledCapsuleHalfHeight_WithoutHemisphere() const;
    void GetScaledCapsuleSize(float& OutRadius, float& OutHalfHeight) const;
    void GetScaledCapsuleSize_WithoutHemisphere(float& OutRadius, float& OutHalfHeightWithoutHemisphere) const;
    float GetUnscaledCapsuleRadius() const;
    float GetUnscaledCapsuleHalfHeight() const;
    float GetUnscaledCapsuleHalfHeight_WithoutHemisphere() const;
    void GetUnscaledCapsuleSize(float& OutRadius, float& OutHalfHeight) const;
    float GetShapeScale() const;
    virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
};
