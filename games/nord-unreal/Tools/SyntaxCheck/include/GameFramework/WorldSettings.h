// Offline UE 5.x API stub: GameFramework/WorldSettings.h
#pragma once
#include "GameFramework/Info.h"
#include "GameFramework/DamageType.h"
#include "Sound/SoundBase.h"
class AGameModeBase;
class APlayerState;
class AGameNetworkManager;
class UNavigationSystemConfig;
class AWorldSettings : public AInfo
{
    UESTUB_UCLASS_BODY(AWorldSettings, AInfo)
    AWorldSettings(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TSubclassOf<AGameModeBase> DefaultGameMode;
    float KillZ;
    TSubclassOf<UDamageType> KillZDamageType;
    uint8 bEnableWorldBoundsChecks : 1;
    uint8 bEnableWorldComposition : 1;
    uint8 bGlobalGravitySet : 1;
    uint8 bWorldGravitySet : 1;
    float GlobalGravityZ;
    float WorldGravityZ;
    float WorldToMeters;
    float TimeDilation;
    float MatineeTimeDilation;
    float DemoPlayTimeDilation;
    float MinGlobalTimeDilation;
    float MaxGlobalTimeDilation;
    float MinUndilatedFrameTime;
    float MaxUndilatedFrameTime;
    TObjectPtr<APlayerState> Pauser;
    TObjectPtr<USoundBase> DefaultAmbientSound;
    virtual float GetGravityZ() const;
    virtual float FixupDeltaSeconds(float DeltaSeconds, float RealDeltaSeconds);
    virtual float SetTimeDilation(float NewTimeDilation);
    float GetEffectiveTimeDilation() const;
    virtual void NotifyBeginPlay();
    virtual void NotifyMatchStarted();
    virtual void OnRep_WorldGravityZ();
};
