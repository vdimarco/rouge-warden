// Offline UE 5.x API stub: GameFramework/GameState.h
#pragma once
#include "GameFramework/GameStateBase.h"
#include "GameFramework/GameMode.h"
class AGameState : public AGameStateBase
{
    UESTUB_UCLASS_BODY(AGameState, AGameStateBase)
    AGameState(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    int32 ElapsedTime;
    FName GetMatchState() const;
    virtual bool IsMatchInProgress() const;
    virtual bool HasMatchStarted() const override;
    virtual bool HasMatchEnded() const override;
    virtual void SetMatchState(FName NewState);
    virtual void DefaultTimer();
    virtual bool ShouldShowGore() const;
protected:
    FName MatchState;
    FName PreviousMatchState;
    virtual void OnRep_MatchState();
    virtual void OnRep_ElapsedTime();
    virtual void HandleMatchIsWaitingToStart();
    virtual void HandleMatchHasStarted();
    virtual void HandleMatchHasEnded();
    virtual void HandleLeavingMap();
};
