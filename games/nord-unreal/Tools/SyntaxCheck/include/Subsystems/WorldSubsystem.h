// Offline UE 5.x API stub: Subsystems/WorldSubsystem.h
#pragma once
#include "Subsystems/Subsystem.h"
#include "Engine/EngineBaseTypes.h"
class UWorld;
class UWorldSubsystem : public USubsystem
{
    UESTUB_UCLASS_BODY(UWorldSubsystem, USubsystem)
    UWorldSubsystem();
    virtual UWorld* GetWorld() const override final;
    UWorld& GetWorldRef() const;
    virtual void PostInitialize();
    virtual void OnWorldBeginPlay(UWorld& InWorld);
    virtual void OnWorldComponentsUpdated(UWorld& World);
    virtual void UpdateStreamingState();
protected:
    virtual bool DoesSupportWorldType(const EWorldType::Type WorldType) const;
};
class UTickableWorldSubsystem : public UWorldSubsystem
{
    UESTUB_UCLASS_BODY(UTickableWorldSubsystem, UWorldSubsystem)
    UTickableWorldSubsystem();
    virtual void Tick(float DeltaTime);
    virtual TStatId GetStatId() const;
    bool IsInitialized() const;
};
