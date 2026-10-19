// Offline UE 5.x API stub: Components/VolumetricCloudComponent.h
#pragma once
#include "Components/SceneComponent.h"
#include "GameFramework/Info.h"
class UMaterialInterface;
class UVolumetricCloudComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(UVolumetricCloudComponent, USceneComponent)
    UVolumetricCloudComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float LayerBottomAltitude;
    float LayerHeight;
    float TracingStartMaxDistance;
    float TracingStartDistanceFromCamera;
    float TracingMaxDistance;
    float PlanetRadius;
    FColor GroundAlbedo;
    TObjectPtr<UMaterialInterface> Material;
    bool bUsePerSampleAtmosphericLightTransmittance;
    float SkyLightCloudBottomOcclusion;
    float ViewSampleCountScale;
    float ReflectionViewSampleCountScale;
    float ShadowViewSampleCountScale;
    float ShadowReflectionViewSampleCountScale;
    float ShadowTracingDistance;
    float StopTracingTransmittanceThreshold;
    void SetLayerBottomAltitude(float NewValue);
    void SetLayerHeight(float NewValue);
    void SetTracingStartMaxDistance(float NewValue);
    void SetTracingStartDistanceFromCamera(float NewValue);
    void SetTracingMaxDistance(float NewValue);
    void SetPlanetRadius(float NewValue);
    void SetGroundAlbedo(FColor NewValue);
    void SetbUsePerSampleAtmosphericLightTransmittance(bool NewValue);
    void SetSkyLightCloudBottomOcclusion(float NewValue);
    void SetViewSampleCountScale(float NewValue);
    void SetReflectionViewSampleCountScale(float NewValue);
    void SetShadowViewSampleCountScale(float NewValue);
    void SetShadowReflectionViewSampleCountScale(float NewValue);
    void SetShadowTracingDistance(float NewValue);
    void SetStopTracingTransmittanceThreshold(float NewValue);
    void SetMaterial(UMaterialInterface* NewValue);
    UMaterialInterface* GetMaterial() const;
};
class AVolumetricCloud : public AInfo
{
    UESTUB_UCLASS_BODY(AVolumetricCloud, AInfo)
    AVolumetricCloud(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
};
