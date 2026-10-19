// Offline UE 5.x API stub: Engine/LocalPlayer.h
#pragma once
#include "Engine/Player.h"
class UGameViewportClient;
class UGameInstance;
class ULocalPlayer : public UPlayer
{
    UESTUB_UCLASS_BODY(ULocalPlayer, UPlayer)
    ULocalPlayer(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UGameViewportClient> ViewportClient;
    FVector2D Origin;
    FVector2D Size;
    int32 GetControllerId() const;
    void SetControllerId(int32 NewControllerId);
    UGameInstance* GetGameInstance() const;
    virtual UWorld* GetWorld() const override;
    template <class TSubsystemClass> TSubsystemClass* GetSubsystem() const { (void)&TSubsystemClass::StaticClass; return nullptr; }
    template <class TSubsystemClass> static TSubsystemClass* GetSubsystem(const ULocalPlayer* LocalPlayer) { (void)&TSubsystemClass::StaticClass; return nullptr; }
    virtual FString GetNickname() const;
};
