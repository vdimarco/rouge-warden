#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecSkyModel.h"
#include "QuebecSky.generated.h"

class AQuebecCar;
class UAudioComponent;
class UDirectionalLightComponent;
class UExponentialHeightFogComponent;
class UInstancedStaticMeshComponent;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class UMaterialParameterCollection;
class UPointLightComponent;
class USkyAtmosphereComponent;
class USkyLightComponent;
class USoundWaveProcedural;
class USpotLightComponent;
class UStaticMesh;
class UVolumetricCloudComponent;

/** The host's clock, weather segment and wetness. Every peer samples the clock and weather against the server time. */
USTRUCT()
struct FQuebecSkyState
{
    GENERATED_BODY()
    UPROPERTY() double CycleOffset = 0.;
    UPROPERTY() float CycleSeconds = 2400.f;
    UPROPERTY() bool bFreezeClock = false;
    UPROPERTY() float FrozenHour = 15.f;
    UPROPERTY() uint8 From = 0;
    UPROPERTY() uint8 To = 0;
    /** Empty, or one share per weather of the look a command turned mid-blend; see QuebecSky::FSegment::FromWeights. */
    UPROPERTY() TArray<float> FromWeights;
    UPROPERTY() double Start = 0.;
    UPROPERTY() float Blend = 0.f;
    UPROPERTY() float Hold = 0.f;
    UPROPERTY() bool bFreezeWeather = false;
    UPROPERTY() float Wetness = 0.f;
    UPROPERTY() float Puddles = 0.f;
    UPROPERTY() int32 DayOfYear = 288;
    UPROPERTY() float LatitudeDeg = 45.525f;
    UPROPERTY() float SolarNoonHour = 12.67f;
};

/** The saved scene the sky drives, and its authored values, captured once on each peer. */
struct FQuebecSkyScene
{
    TWeakObjectPtr<UDirectionalLightComponent> Sun;
    TWeakObjectPtr<USkyLightComponent> SkyLight;
    TWeakObjectPtr<USkyAtmosphereComponent> Atmosphere;
    TWeakObjectPtr<UExponentialHeightFogComponent> Fog;
    TWeakObjectPtr<UVolumetricCloudComponent> Clouds;
    TWeakObjectPtr<UMaterialInterface> CloudMaterial;
    float SunIntensity = 0.f;
    FRotator SunRotation = FRotator::ZeroRotator;
    float SunTemperature = 6500.f;
    bool bSunVisible = true;
    float SkyLightIntensity = 0.f;
    float FogDensity = 0.f;
    float FogStart = 0.f;
    float FogFalloff = 0.f;
    FLinearColor FogColor = FLinearColor::Black;
    float Mie = 1.f;
    float Rayleigh = 1.f;
    FLinearColor SkyLuminance = FLinearColor::White;
    float CloudAltitude = 0.f;
    float CloudHeight = 0.f;
};

/** Host-owned Montréal day and weather. Drives the saved sun, sky, fog and clouds, plus runtime moon, lamps, headlights, rain and rain sound on each peer. */
UCLASS()
class QUEBEC_API AQuebecSky : public AActor
{
    GENERATED_BODY()
public:
    AQuebecSky();
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    /** False under the QA flags and in editor Python runs unless -NordHour= or -NordWeather= asks for a fixed state; -NordDynamicSky always spawns. */
    static bool ShouldSpawn();
    /** The sky of this world once its state is known, or null. */
    static const AQuebecSky* Find(const UWorld* World);
    /** Scale for bright authored lights such as the worklight: 1 by day and when no sky exists. */
    static float LightScale(const UWorld* World);

    // Host only. The controller's console commands reach these through server RPCs.
    bool HostSetWeather(const FString& WeatherName);
    void HostSetHour(float NewHour);
    void HostSetFrozen(bool bFrozen);

    float GetHour() const { return Hour; }
    FString GetWeatherName() const { return FString(QuebecSky::WeatherName(ShownWeather)); }
    float GetExposureOffset() const { return Lighting.ExposureOffset; }
    float GetSaturation() const { return Lighting.Saturation; }
    float GetContrast() const { return Lighting.Contrast; }
    float GetWhiteTemp() const { return Lighting.WhiteTemp; }

private:
    UPROPERTY(ReplicatedUsing=OnRep_State) FQuebecSkyState State;
    UPROPERTY() TObjectPtr<UDirectionalLightComponent> Moon;
    UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> Lamps;
    UPROPERTY() TArray<TObjectPtr<USpotLightComponent>> Headlights;
    UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> Rain;
    UPROPERTY() TObjectPtr<UAudioComponent> RainAudio;
    UPROPERTY() TObjectPtr<USoundWaveProcedural> RainWave;
    UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> CloudInstance;
    UPROPERTY() TObjectPtr<UMaterialParameterCollection> AtmosphereParameters;
    UPROPERTY() TObjectPtr<UStaticMesh> RainPlane;

    FQuebecSkyScene SceneRefs;
    QuebecSky::FRandom Random;
    QuebecSky::FWeatherLook Look;
    QuebecSky::FSun SunSky;
    QuebecSky::FLighting Lighting;
    QuebecSky::FWetness Wet;
    QuebecSky::EWeather ShownWeather = QuebecSky::EWeather::Clear;
    float Hour = 15.f;
    bool bHasState = false;
    double LastWetSync = -10.;
    float SceneClock = 1.f;
    float PoolClock = 1.f;
    float LastCloudCover = -1.f;
    FVector LastSunTravel = FVector::ZeroVector;
    FVector LastMoonTravel = FVector::ZeroVector;
    TArray<FName> CoverageParameters;
    const FVector* LampPoints = nullptr;
    int32 LampPointCount = 0;
    TArray<int32> LampOrder;
    TArray<TWeakObjectPtr<AQuebecCar>> HeadlightCars;
    float RainLevel = 0.f;
    float RainLow = 0.f;
    float RainMid = 0.f;
    uint32 RainNoise = 0x2f6b9d31;

    UFUNCTION() void OnRep_State();
    void StartHost();
    void StartPresentation();
    void TickPresentation(double Now, float DeltaSeconds);
    void SetClock(float NewHour, double Now);
    QuebecSky::FSegment CurrentSegment() const;
    void SetSegment(const QuebecSky::FSegment& Segment);
    double ServerSeconds() const;
    bool LocalView(FVector& OutLocation) const;
    void AimLights();
    void WriteScene(double Now);
    void AssignPools(const FVector& View);
    void MoveHeadlights();
    void UpdateRain(const FVector& View);
    void UpdateRainSound(float DeltaSeconds);
    void RestoreScene();
};
