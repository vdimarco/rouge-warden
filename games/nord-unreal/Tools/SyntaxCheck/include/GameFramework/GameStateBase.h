// Offline UE 5.x API stub: GameFramework/GameStateBase.h
#pragma once
#include "GameFramework/Info.h"
class AGameModeBase;
class APlayerState;
class ASpectatorPawn;
class AGameStateBase : public AInfo
{
    UESTUB_UCLASS_BODY(AGameStateBase, AInfo)
    AGameStateBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TSubclassOf<AGameModeBase> GameModeClass;
    TObjectPtr<AGameModeBase> AuthorityGameMode;
    TSubclassOf<ASpectatorPawn> SpectatorClass;
    TArray<TObjectPtr<APlayerState>> PlayerArray;
    const AGameModeBase* GetDefaultGameMode() const;
    template <class T> const T* GetDefaultGameMode() const { return Cast<T>(GetDefaultGameMode()); }
    virtual double GetServerWorldTimeSeconds() const;
    virtual bool HasBegunPlay() const;
    virtual bool HasMatchStarted() const;
    virtual bool HasMatchEnded() const;
    virtual float GetPlayerStartTime(class AController* Controller) const;
    virtual float GetPlayerRespawnDelay(class AController* Controller) const;
    virtual void AddPlayerState(APlayerState* PlayerState);
    virtual void RemovePlayerState(APlayerState* PlayerState);
    APlayerState* GetPlayerStateFromUniqueNetId(const struct FUniqueNetIdWrapper& InPlayerId) const;
    virtual void HandleBeginPlay();
    virtual void OnRep_SpectatorClass();
    virtual void OnRep_GameModeClass();
    virtual void OnRep_ReplicatedHasBegunPlay();
    virtual void OnRep_ReplicatedWorldTimeSecondsDouble();
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PostInitializeComponents() override;
};
