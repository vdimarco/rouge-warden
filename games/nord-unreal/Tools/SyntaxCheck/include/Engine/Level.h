// Offline UE 5.x API stub: Engine/Level.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
class AActor;
class UWorld;
class AWorldSettings;
class ALevelScriptActor;
class UModel;
class ULevel : public UObject
{
    UESTUB_UCLASS_BODY(ULevel, UObject)
    ULevel(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<TObjectPtr<AActor>> Actors;
    TObjectPtr<UWorld> OwningWorld;
    TObjectPtr<UModel> Model;
    bool bIsVisible;
    AWorldSettings* GetWorldSettings(bool bChecked = true) const;
    void SetWorldSettings(AWorldSettings* NewWorldSettings);
    ALevelScriptActor* GetLevelScriptActor() const;
    bool IsPersistentLevel() const;
    bool IsCurrentLevel() const;
    UWorld* GetWorld() const override final;
    UWorld* GetTypedOuter_World() const;
    bool HasVisibilityChangeRequestPending() const;
    void UpdateLevelComponents(bool bRerunConstructionScripts, class FRegisterComponentContext* Context = nullptr);
};
