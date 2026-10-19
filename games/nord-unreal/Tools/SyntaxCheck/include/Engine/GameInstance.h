// Offline UE 5.x API stub: Engine/GameInstance.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineBaseTypes.h"
class UGameViewportClient;
class ULocalPlayer;
class APlayerController;
class UWorld;
class UEngine;
class FTimerManager;
class UGameInstanceSubsystem;
class UGameInstance : public UObject
{
    UESTUB_UCLASS_BODY(UGameInstance, UObject)
    UGameInstance(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual void Init();
    virtual void Shutdown();
    virtual void OnStart();
    virtual void StartGameInstance();
    UGameViewportClient* GetGameViewportClient() const;
    UEngine* GetEngine() const;
    virtual UWorld* GetWorld() const override final;
    struct FWorldContext* GetWorldContext() const;
    FTimerManager& GetTimerManager() const;
    APlayerController* GetFirstLocalPlayerController(const UWorld* World = nullptr) const;
    APlayerController* GetPrimaryPlayerController(bool bRequiresValidUniqueId = true) const;
    ULocalPlayer* GetFirstGamePlayer() const;
    ULocalPlayer* GetLocalPlayerByIndex(const int32 Index) const;
    const TArray<ULocalPlayer*>& GetLocalPlayers() const;
    int32 GetNumLocalPlayers() const;
    template <class TSubsystemClass> TSubsystemClass* GetSubsystem() const { (void)&TSubsystemClass::StaticClass; return nullptr; }
    template <class TSubsystemClass> static TSubsystemClass* GetSubsystem(const UGameInstance* GameInstance) { (void)&TSubsystemClass::StaticClass; return nullptr; }
    bool IsDedicatedServerInstance() const;
    virtual void ReturnToMainMenu();
};
