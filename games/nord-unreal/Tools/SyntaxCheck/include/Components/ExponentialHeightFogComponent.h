// Offline UE 5.x API stub: Components/ExponentialHeightFogComponent.h
#pragma once
#include "Components/SceneComponent.h"
class UTextureCube;
struct FExponentialHeightFogData { float FogDensity; float FogHeightFalloff; float FogHeightOffset; };
class UExponentialHeightFogComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(UExponentialHeightFogComponent, USceneComponent)
    UExponentialHeightFogComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float FogDensity;
    float FogHeightFalloff;
    FExponentialHeightFogData SecondFogData;
    FLinearColor FogInscatteringLuminance;
    FLinearColor SkyAtmosphereAmbientContributionColorScale;
    TObjectPtr<UTextureCube> InscatteringColorCubemap;
    float InscatteringColorCubemapAngle;
    FLinearColor InscatteringTextureTint;
    float FullyDirectionalInscatteringColorDistance;
    float NonDirectionalInscatteringColorDistance;
    float DirectionalInscatteringExponent;
    float DirectionalInscatteringStartDistance;
    FLinearColor DirectionalInscatteringLuminance;
    float FogMaxOpacity;
    float StartDistance;
    float FogCutoffDistance;
    uint32 bEnableVolumetricFog : 1;
    float VolumetricFogScatteringDistribution;
    FColor VolumetricFogAlbedo;
    FLinearColor VolumetricFogEmissive;
    float VolumetricFogExtinctionScale;
    float VolumetricFogDistance;
    float VolumetricFogStartDistance;
    float VolumetricFogNearFadeInDistance;
    float VolumetricFogStaticLightingScatteringIntensity;
    void SetFogDensity(float Value);
    void SetSecondFogDensity(float Value);
    void SetFogInscatteringColor(FLinearColor Value);
    void SetInscatteringColorCubemap(UTextureCube* Value);
    void SetInscatteringColorCubemapAngle(float Value);
    void SetFullyDirectionalInscatteringColorDistance(float Value);
    void SetNonDirectionalInscatteringColorDistance(float Value);
    void SetInscatteringTextureTint(FLinearColor Value);
    void SetDirectionalInscatteringExponent(float Value);
    void SetDirectionalInscatteringStartDistance(float Value);
    void SetDirectionalInscatteringColor(FLinearColor Value);
    void SetFogHeightFalloff(float Value);
    void SetSecondFogHeightFalloff(float Value);
    void SetSecondFogHeightOffset(float Value);
    void SetFogMaxOpacity(float Value);
    void SetStartDistance(float Value);
    void SetEndDistance(float Value);
    void SetFogCutoffDistance(float Value);
    void SetVolumetricFog(bool bNewValue);
    void SetVolumetricFogScatteringDistribution(float NewValue);
    void SetVolumetricFogExtinctionScale(float NewValue);
    void SetVolumetricFogAlbedo(FColor NewValue);
    void SetVolumetricFogEmissive(FLinearColor NewValue);
    void SetVolumetricFogDistance(float NewValue);
    void SetVolumetricFogStartDistance(float NewValue);
    void SetVolumetricFogNearFadeInDistance(float NewValue);
    void SetSkyAtmosphereAmbientContributionColorScale(FLinearColor NewValue);
};
