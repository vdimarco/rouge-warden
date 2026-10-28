// Offline UE 5.x API stub: Sound/SoundBase.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
#define INDEFINITELY_LOOPING_DURATION 10000.0f
class USoundClass;
class USoundAttenuation;
class USoundConcurrency;
class USoundBase : public UObject
{
    UESTUB_UCLASS_BODY(USoundBase, UObject)
    USoundBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<USoundClass> SoundClassObject;
    TObjectPtr<USoundAttenuation> AttenuationSettings;
    float Duration;
    float MaxDistance;
    float TotalSamples;
    float Priority;
    uint8 bDebug : 1;
    uint8 bOverrideConcurrency : 1;
    uint8 bHasDelayNode : 1;
    uint8 bHasConcatenatorNode : 1;
    virtual bool IsPlayable() const;
    virtual float GetDuration() const;
    virtual bool IsLooping() const;
    virtual float GetMaxDistance() const;
    virtual float GetVolumeMultiplier();
    virtual float GetPitchMultiplier();
    virtual bool IsOneShot() const;
    USoundClass* GetSoundClass() const;
    bool HasAttenuationNode() const;
};
