// Offline UE 5.x API stub: Components/SkyAtmosphereComponent.h
#pragma once
#include "Components/SceneComponent.h"
#include "GameFramework/Info.h"
enum class ESkyAtmosphereTransformMode : uint8 { PlanetTopAtAbsoluteWorldOrigin, PlanetTopAtComponentTransform, PlanetCenterAtComponentTransform };
class USkyAtmosphereComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(USkyAtmosphereComponent, USceneComponent)
    USkyAtmosphereComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    ESkyAtmosphereTransformMode TransformMode;
    float BottomRadius;
    FColor GroundAlbedo;
    float AtmosphereHeight;
    float MultiScatteringFactor;
    float TraceSampleCountScale;
    float RayleighScatteringScale;
    FLinearColor RayleighScattering;
    float RayleighExponentialDistribution;
    float MieScatteringScale;
    FLinearColor MieScattering;
    float MieAbsorptionScale;
    FLinearColor MieAbsorption;
    float MieAnisotropy;
    float MieExponentialDistribution;
    float OtherAbsorptionScale;
    FLinearColor OtherAbsorption;
    FLinearColor SkyLuminanceFactor;
    FLinearColor SkyAndAerialPerspectiveLuminanceFactor;
    float AerialPespectiveViewDistanceScale;
    float HeightFogContribution;
    float TransmittanceMinLightElevationAngle;
    float AerialPerspectiveStartDepth;
    void SetAtmosphereHeight(float NewValue);
    void SetMultiScatteringFactor(float NewValue);
    void SetRayleighScatteringScale(float NewValue);
    void SetRayleighScattering(FLinearColor NewValue);
    void SetRayleighExponentialDistribution(float NewValue);
    void SetMieScatteringScale(float NewValue);
    void SetMieScattering(FLinearColor NewValue);
    void SetMieAbsorptionScale(float NewValue);
    void SetMieAbsorption(FLinearColor NewValue);
    void SetMieAnisotropy(float NewValue);
    void SetMieExponentialDistribution(float NewValue);
    void SetOtherAbsorptionScale(float NewValue);
    void SetOtherAbsorption(FLinearColor NewValue);
    void SetSkyLuminanceFactor(FLinearColor NewValue);
    void SetSkyAndAerialPerspectiveLuminanceFactor(FLinearColor NewValue);
    void SetAerialPespectiveViewDistanceScale(float NewValue);
    void SetHeightFogContribution(float NewValue);
    void SetBottomRadius(float NewValue);
    void SetGroundAlbedo(const FColor& NewValue);
    FLinearColor GetAtmosphereTransmitanceOnGroundAtPlanetTop(class UDirectionalLightComponent* DirectionalLight);
    void OverrideAtmosphereLightDirection(int32 AtmosphereLightIndex, const FVector& LightDirection);
};
class ASkyAtmosphere : public AInfo
{
    UESTUB_UCLASS_BODY(ASkyAtmosphere, AInfo)
    ASkyAtmosphere(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    USkyAtmosphereComponent* GetComponent() const;
};
