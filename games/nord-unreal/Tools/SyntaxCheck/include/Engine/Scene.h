// Offline UE 5.x API stub: Engine/Scene.h (post process settings)
#pragma once
#include "UEStub/UObjectCore.h"
struct FWeightedBlendable
{
    float Weight;
    TObjectPtr<UObject> Object;
    FWeightedBlendable();
    FWeightedBlendable(float InWeight, UObject* InObject);
};
struct FWeightedBlendables { TArray<FWeightedBlendable> Array; };
enum EAutoExposureMethod : int { AEM_Histogram, AEM_Basic, AEM_Manual, AEM_MAX };
enum class EBloomMethod : uint8 { BM_SOG, BM_FFT };
struct FPostProcessSettings
{
    uint8 bOverride_TemperatureType : 1;
    uint8 bOverride_WhiteTemp : 1;
    uint8 bOverride_WhiteTint : 1;
    uint8 bOverride_ColorSaturation : 1;
    uint8 bOverride_ColorContrast : 1;
    uint8 bOverride_ColorGamma : 1;
    uint8 bOverride_ColorGain : 1;
    uint8 bOverride_ColorOffset : 1;
    uint8 bOverride_ColorSaturationShadows : 1;
    uint8 bOverride_ColorSaturationHighlights : 1;
    uint8 bOverride_SceneColorTint : 1;
    uint8 bOverride_SceneFringeIntensity : 1;
    uint8 bOverride_BloomIntensity : 1;
    uint8 bOverride_BloomThreshold : 1;
    uint8 bOverride_AutoExposureMethod : 1;
    uint8 bOverride_AutoExposureBias : 1;
    uint8 bOverride_AutoExposureMinBrightness : 1;
    uint8 bOverride_AutoExposureMaxBrightness : 1;
    uint8 bOverride_AutoExposureSpeedUp : 1;
    uint8 bOverride_AutoExposureSpeedDown : 1;
    uint8 bOverride_LensFlareIntensity : 1;
    uint8 bOverride_VignetteIntensity : 1;
    uint8 bOverride_GrainIntensity : 1;
    uint8 bOverride_FilmGrainIntensity : 1;
    uint8 bOverride_AmbientOcclusionIntensity : 1;
    uint8 bOverride_MotionBlurAmount : 1;
    uint8 bOverride_MotionBlurMax : 1;
    uint8 bOverride_DepthOfFieldFocalDistance : 1;
    uint8 bOverride_DepthOfFieldFstop : 1;
    uint8 bOverride_ScreenPercentage : 1;
    uint8 bOverride_IndirectLightingIntensity : 1;
    uint8 bOverride_ToneCurveAmount : 1;
    float WhiteTemp;
    float WhiteTint;
    FVector4 ColorSaturation;
    FVector4 ColorContrast;
    FVector4 ColorGamma;
    FVector4 ColorGain;
    FVector4 ColorOffset;
    FVector4 ColorSaturationShadows;
    FVector4 ColorSaturationHighlights;
    FLinearColor SceneColorTint;
    float SceneFringeIntensity;
    float BloomIntensity;
    float BloomThreshold;
    TEnumAsByte<enum EAutoExposureMethod> AutoExposureMethod;
    float AutoExposureBias;
    float AutoExposureMinBrightness;
    float AutoExposureMaxBrightness;
    float AutoExposureSpeedUp;
    float AutoExposureSpeedDown;
    float LensFlareIntensity;
    float VignetteIntensity;
    float GrainIntensity_DEPRECATED;
    float FilmGrainIntensity;
    float AmbientOcclusionIntensity;
    float MotionBlurAmount;
    float MotionBlurMax;
    float DepthOfFieldFocalDistance;
    float DepthOfFieldFstop;
    float ScreenPercentage_DEPRECATED;
    float IndirectLightingIntensity;
    float ToneCurveAmount;
    FWeightedBlendables WeightedBlendables;
    FPostProcessSettings();
    void AddBlendable(TScriptInterface<class IBlendableInterface> InBlendableObject, float InWeight);
    void RemoveBlendable(TScriptInterface<class IBlendableInterface> InBlendableObject);
};
struct FMinimalViewInfo
{
    FVector Location;
    FRotator Rotation;
    float FOV;
    float DesiredFOV;
    float OrthoWidth;
    float AspectRatio;
    uint32 bConstrainAspectRatio : 1;
    float PostProcessBlendWeight;
    FPostProcessSettings PostProcessSettings;
    FMinimalViewInfo();
};
