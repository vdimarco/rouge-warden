// Offline UE 5.x API stub: Components/LightComponent.h
#pragma once
#include "Components/LightComponentBase.h"
class UMaterialInterface;
class UTextureLightProfile;
class ULightComponent : public ULightComponentBase
{
    UESTUB_UCLASS_BODY(ULightComponent, ULightComponentBase)
    ULightComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float Temperature;
    float MaxDrawDistance;
    float MaxDistanceFadeRange;
    uint32 bUseTemperature : 1;
    float SpecularScale;
    float ShadowResolutionScale;
    float ShadowBias;
    float ShadowSlopeBias;
    float ShadowSharpen;
    float ContactShadowLength;
    uint32 ContactShadowLengthInWS : 1;
    uint32 InverseSquaredFalloff_DEPRECATED : 1;
    uint32 CastTranslucentShadows : 1;
    uint32 bCastShadowsFromCinematicObjectsOnly : 1;
    uint32 bAffectDynamicIndirectLighting : 1;
    uint32 bForceCachedShadowsForMovablePrimitives : 1;
    FLightingChannels LightingChannels;
    TObjectPtr<UMaterialInterface> LightFunctionMaterial;
    FVector LightFunctionScale;
    TObjectPtr<UTextureLightProfile> IESTexture;
    uint32 bUseIESBrightness : 1;
    float IESBrightnessScale;
    float BloomScale;
    float BloomThreshold;
    uint32 bEnableLightShaftBloom : 1;
    FColor BloomTint;
    virtual void SetIntensity(float NewIntensity);
    void SetIndirectLightingIntensity(float NewIntensity);
    void SetVolumetricScatteringIntensity(float NewIntensity);
    void SetLightColor(FLinearColor NewLightColor, bool bSRGB = true);
    void SetLightFColor(FColor NewLightColor);
    void SetTemperature(float NewTemperature);
    void SetUseTemperature(bool bNewValue);
    void SetLightFunctionMaterial(UMaterialInterface* NewLightFunctionMaterial);
    void SetLightFunctionScale(FVector NewLightFunctionScale);
    void SetLightFunctionFadeDistance(float NewLightFunctionFadeDistance);
    void SetLightFunctionDisabledBrightness(float NewValue);
    void SetAffectDynamicIndirectLighting(bool bNewValue);
    void SetAffectTranslucentLighting(bool bNewValue);
    void SetTransmission(bool bNewValue);
    void SetEnableLightShaftBloom(bool bNewValue);
    void SetBloomScale(float NewValue);
    void SetBloomThreshold(float NewValue);
    void SetBloomMaxBrightness(float NewValue);
    void SetBloomTint(FColor NewValue);
    void SetIESTexture(UTextureLightProfile* NewValue);
    void SetShadowBias(float NewValue);
    void SetShadowSlopeBias(float NewValue);
    void SetSpecularScale(float NewValue);
    void SetDiffuseScale(float NewValue);
    void SetForceCachedShadowsForMovablePrimitives(bool bNewValue);
    void SetLightingChannels(bool bChannel0, bool bChannel1, bool bChannel2);
    virtual float ComputeLightBrightness() const;
    virtual void SetLightBrightness(float InBrightness);
    virtual FLinearColor GetColoredLightBrightness() const;
};
