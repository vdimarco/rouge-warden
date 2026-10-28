// Offline UE 5.x API stub: GameFramework/PlayerState.h
#pragma once
#include "GameFramework/Info.h"
class APawn;
class APlayerState;
class APlayerController;
class AController;
struct FUniqueNetIdRepl { bool IsValid() const; FString ToString() const; };
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnPlayerStatePawnSet, APlayerState*, Player, APawn*, NewPawn, APawn*, OldPawn);
class APlayerState : public AInfo
{
    UESTUB_UCLASS_BODY(APlayerState, AInfo)
    APlayerState(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FOnPlayerStatePawnSet OnPawnSet;
    float GetScore() const;
    void SetScore(const float NewScore);
    int32 GetPlayerId() const;
    void SetPlayerId(const int32 NewId);
    uint8 GetCompressedPing() const;
    float GetPingInMilliseconds() const;
    bool IsSpectator() const;
    void SetIsSpectator(const bool bNewSpectator);
    bool IsOnlyASpectator() const;
    bool IsABot() const;
    void SetIsABot(const bool bNewIsABot);
    bool IsInactive() const;
    bool IsFromPreviousLevel() const;
    float GetStartTime() const;
    virtual FString GetPlayerName() const;
    virtual void SetPlayerName(const FString& S);
    virtual FString GetPlayerNameCustom() const;
    virtual FString GetOldPlayerName() const;
    virtual void SetOldPlayerName(const FString& S);
    const FUniqueNetIdRepl& GetUniqueId() const;
    APawn* GetPawn() const;
    template <class T> T* GetPawn() const { return Cast<T>(GetPawn()); }
    AController* GetOwningController() const;
    APlayerController* GetPlayerController() const;
    virtual void CopyProperties(APlayerState* PlayerState);
    virtual void OverrideWith(APlayerState* PlayerState);
    virtual void OnRep_Score();
    virtual void OnRep_PlayerName();
    virtual void ClientInitialize(class AController* C);
    virtual void Reset() override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
