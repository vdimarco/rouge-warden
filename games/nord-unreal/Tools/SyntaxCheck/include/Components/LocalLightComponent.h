// Offline UE 5.x API stub: Components/LocalLightComponent.h
#pragma once
#include "Components/LightComponent.h"
class ULocalLightComponent : public ULightComponent
{
    UESTUB_UCLASS_BODY(ULocalLightComponent, ULightComponent)
    ULocalLightComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    ELightUnits IntensityUnits;
    float InverseExposureBlend;
    float AttenuationRadius;
    void SetAttenuationRadius(float NewRadius);
    void SetIntensityUnits(ELightUnits NewIntensityUnits);
    void SetInverseExposureBlend(float NewInverseExposureBlend);
    static float GetUnitsConversionFactor(ELightUnits SrcUnits, ELightUnits TargetUnits, float CosHalfConeAngle = -1);
};
