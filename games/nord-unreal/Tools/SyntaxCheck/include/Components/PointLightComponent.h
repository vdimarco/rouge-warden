// Offline UE 5.x API stub: Components/PointLightComponent.h
#pragma once
#include "Components/LocalLightComponent.h"
class UPointLightComponent : public ULocalLightComponent
{
    UESTUB_UCLASS_BODY(UPointLightComponent, ULocalLightComponent)
    UPointLightComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    uint32 bUseInverseSquaredFalloff : 1;
    float LightFalloffExponent;
    float SourceRadius;
    float SoftSourceRadius;
    float SourceLength;
    void SetUseInverseSquaredFalloff(bool bNewValue);
    void SetLightFalloffExponent(float NewLightFalloffExponent);
    void SetSourceRadius(float bNewValue);
    void SetSoftSourceRadius(float bNewValue);
    void SetSourceLength(float NewValue);
};
