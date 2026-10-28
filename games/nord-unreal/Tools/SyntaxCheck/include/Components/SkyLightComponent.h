// Offline UE 5.x API stub: Components/SkyLightComponent.h
#pragma once
#include "Components/LightComponentBase.h"
class UTextureCube;
enum ESkyLightSourceType : int { SLS_CapturedScene, SLS_SpecifiedCubemap, SLS_MAX };
class USkyLightComponent : public ULightComponentBase
{
    UESTUB_UCLASS_BODY(USkyLightComponent, ULightComponentBase)
    USkyLightComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TEnumAsByte<enum ESkyLightSourceType> SourceType;
    TObjectPtr<UTextureCube> Cubemap;
    float SourceCubemapAngle;
    int32 CubemapResolution;
    float SkyDistanceThreshold;
    uint8 bCaptureEmissiveOnly : 1;
    uint8 bLowerHemisphereIsBlack : 1;
    uint8 bRealTimeCapture : 1;
    FLinearColor LowerHemisphereColor;
    float OcclusionMaxDistance;
    float Contrast;
    float OcclusionExponent;
    float MinOcclusion;
    FColor OcclusionTint;
    void SetIntensity(float NewIntensity);
    void SetIndirectLightingIntensity(float NewIntensity);
    void SetVolumetricScatteringIntensity(float NewIntensity);
    void SetLightColor(FLinearColor NewLightColor);
    void SetCubemap(UTextureCube* NewCubemap);
    void SetSourceCubemapAngle(float NewValue);
    void SetCubemapBlend(UTextureCube* SourceCubemap, UTextureCube* DestinationCubemap, float InBlendFraction);
    void SetLowerHemisphereColor(const FLinearColor& InLowerHemisphereColor);
    void SetOcclusionTint(const FColor& InTint);
    void SetOcclusionContrast(float InOcclusionContrast);
    void SetOcclusionExponent(float InOcclusionExponent);
    void SetMinOcclusion(float InMinOcclusion);
    void RecaptureSky();
    void SetRealTimeCapture(bool bInRealTimeCapture);
};
