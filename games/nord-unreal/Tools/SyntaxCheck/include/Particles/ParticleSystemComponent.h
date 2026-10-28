// Offline UE 5.x API stub: Particles/ParticleSystemComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
#include "Particles/ParticleSystem.h"
class UParticleSystemComponent;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FParticleSystemFinishedSignature, UParticleSystemComponent*, PSystem);
class UFXSystemComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UFXSystemComponent, UPrimitiveComponent)
    UFXSystemComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual void SetFloatParameter(FName ParameterName, float Param);
    virtual void SetVectorParameter(FName ParameterName, FVector Param);
    virtual void SetColorParameter(FName ParameterName, FLinearColor Param);
    virtual void SetActorParameter(FName ParameterName, class AActor* Param);
    virtual UFXSystemAsset* GetFXSystemAsset() const;
};
class UParticleSystemComponent : public UFXSystemComponent
{
    UESTUB_UCLASS_BODY(UParticleSystemComponent, UFXSystemComponent)
    UParticleSystemComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UParticleSystem> Template;
    uint8 bAutoDestroy : 1;
    FParticleSystemFinishedSignature OnSystemFinished;
    void SetTemplate(UParticleSystem* NewTemplate);
    void ActivateSystem(bool bFlagAsJustAttached = false);
    void DeactivateSystem();
    void KillParticlesForced();
    void SetEmitterEnable(FName EmitterName, bool bNewEnableState);
};
