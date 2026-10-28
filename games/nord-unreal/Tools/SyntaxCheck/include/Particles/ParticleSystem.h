// Offline UE 5.x API stub: Particles/ParticleSystem.h (Cascade; Niagara lives in a plugin module)
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
class UFXSystemAsset : public UObject
{
    UESTUB_UCLASS_BODY(UFXSystemAsset, UObject)
    UFXSystemAsset(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
};
class UParticleSystem : public UFXSystemAsset
{
    UESTUB_UCLASS_BODY(UParticleSystem, UFXSystemAsset)
    UParticleSystem(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float WarmupTime;
    bool IsLooping() const;
    bool IsImmortal() const;
};
