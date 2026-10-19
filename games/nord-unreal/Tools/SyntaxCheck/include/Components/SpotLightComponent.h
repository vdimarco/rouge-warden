// Offline UE 5.x API stub: Components/SpotLightComponent.h
#pragma once
#include "Components/PointLightComponent.h"
class USpotLightComponent : public UPointLightComponent
{
    UESTUB_UCLASS_BODY(USpotLightComponent, UPointLightComponent)
    USpotLightComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float InnerConeAngle;
    float OuterConeAngle;
    void SetInnerConeAngle(float NewInnerConeAngle);
    void SetOuterConeAngle(float NewOuterConeAngle);
    float GetHalfConeAngle() const;
    float GetCosHalfConeAngle() const;
};
