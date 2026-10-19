// Offline UE 5.x API stub: GameFramework/GameMode.h (match-state game mode)
#pragma once
#include "GameFramework/GameModeBase.h"
namespace MatchState
{
    extern const FName EnteringMap;
    extern const FName WaitingToStart;
    extern const FName InProgress;
    extern const FName WaitingPostMatch;
    extern const FName LeavingMap;
    extern const FName Aborted;
}
class AGameMode : public AGameModeBase
{
    UESTUB_UCLASS_BODY(AGameMode, AGameModeBase)
    AGameMode(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FName GetMatchState() const;
    virtual bool IsMatchInProgress() const;
    virtual bool HasMatchStarted() const override;
    virtual bool HasMatchEnded() const override;
    virtual void StartMatch();
    virtual void EndMatch();
    virtual void RestartGame();
    virtual void AbortMatch();
    bool ReadyToStartMatch();
    virtual bool ReadyToStartMatch_Implementation();
    bool ReadyToEndMatch();
    virtual bool ReadyToEndMatch_Implementation();
    virtual void Say(const FString& Msg);
    virtual void Broadcast(AActor* Sender, const FString& Msg, FName Type = NAME_None);
    virtual int32 GetNumPlayers() override;
    uint32 bDelayedStart : 1;
    int32 NumSpectators;
    int32 NumPlayers;
    int32 NumBots;
    float MinRespawnDelay;
    int32 NumTravellingPlayers;
    int32 MaxInactivePlayers;
    float InactivePlayerStateLifeSpan;
    bool bHandleDedicatedServerReplays;
protected:
    virtual void SetMatchState(FName NewState);
    virtual void OnMatchStateSet();
    virtual void HandleMatchIsWaitingToStart();
    virtual void HandleMatchHasStarted();
    virtual void HandleMatchHasEnded();
    virtual void HandleLeavingMap();
    virtual void HandleMatchAborted();
    FName MatchState;
};
