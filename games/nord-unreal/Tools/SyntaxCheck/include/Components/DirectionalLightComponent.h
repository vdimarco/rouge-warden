// Offline UE 5.x API stub: Components/DirectionalLightComponent.h
#pragma once
#include "Components/LightComponent.h"
class UDirectionalLightComponent : public ULightComponent
{
    UESTUB_UCLASS_BODY(UDirectionalLightComponent, ULightComponent)
    UDirectionalLightComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float LightSourceAngle;
    float LightSourceSoftAngle;
    float DynamicShadowDistanceMovableLight;
    float DynamicShadowDistanceStationaryLight;
    int32 DynamicShadowCascades;
    float CascadeDistributionExponent;
    uint32 bUsedAsAtmosphereSunLight : 1;
    int32 AtmosphereSunLightIndex;
    FLinearColor AtmosphereSunDiskColorScale;
    void SetDynamicShadowDistanceMovableLight(float NewValue);
    void SetDynamicShadowDistanceStationaryLight(float NewValue);
    void SetDynamicShadowCascades(int32 NewValue);
    void SetCascadeDistributionExponent(float NewValue);
    void SetCascadeTransitionFraction(float NewValue);
    void SetShadowDistanceFadeoutFraction(float NewValue);
    void SetEnableLightShaftOcclusion(bool bNewValue);
    void SetOcclusionMaskDarkness(float NewValue);
    void SetLightShaftOverrideDirection(FVector NewValue);
    void SetShadowAmount(float NewValue);
    void SetAtmosphereSunLight(bool bNewValue);
    void SetAtmosphereSunLightIndex(int32 NewValue);
    void SetAtmosphereSunDiskColorScale(FLinearColor NewValue);
    void SetLightSourceAngle(float NewValue);
    void SetLightSourceSoftAngle(float NewValue);
    void SetForwardShadingPriority(int32 NewValue);
    bool IsUsedAsAtmosphereSunLight() const;
    uint8 GetAtmosphereSunLightIndex() const;
    FLinearColor GetAtmosphereSunDiskColorScale() const;
};
