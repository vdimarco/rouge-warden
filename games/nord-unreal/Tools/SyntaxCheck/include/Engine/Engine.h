// Offline UE 5.x API stub: Engine/Engine.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineBaseTypes.h"
class UFont;
class UWorld;
class UGameViewportClient;
class UGameUserSettings;
class APlayerController;
class ULocalPlayer;
class UGameInstance;
enum class EGetWorldErrorMode { ReturnNull, LogAndReturnNull, Assert };
struct FWorldContext
{
    TEnumAsByte<EWorldType::Type> WorldType;
    FName ContextHandle;
    UGameViewportClient* GameViewport;
    UGameInstance* OwningGameInstance;
    UWorld* World() const;
    void SetCurrentWorld(UWorld* World);
    int32 PIEInstance;
    FString PIEPrefix;
    bool bWaitingOnOnlineSubsystem;
    TObjectPtr<UWorld> ThisCurrentWorld;
    FURL LastURL;
    FURL LastRemoteURL;
    void AddRef(UWorld*& WorldPtr);
    void RemoveRef(UWorld*& WorldPtr);
};
class UEngine : public UObject
{
    UESTUB_UCLASS_BODY(UEngine, UObject)
    UEngine(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UGameViewportClient> GameViewport;
    UFont* GetTinyFont() const;
    UFont* GetSmallFont() const;
    UFont* GetMediumFont() const;
    UFont* GetLargeFont() const;
    UFont* GetSubtitleFont() const;
    UFont* GetAdditionalFont(int32 AdditionalFontIndex) const;
    void AddOnScreenDebugMessage(uint64 Key, float TimeToDisplay, FColor DisplayColor, const FString& DebugMessage, bool bNewerOnTop = true, const FVector2D& TextScale = FVector2D::UnitVector);
    void AddOnScreenDebugMessage(int32 Key, float TimeToDisplay, FColor DisplayColor, const FString& DebugMessage, bool bNewerOnTop = true, const FVector2D& TextScale = FVector2D::UnitVector);
    bool OnScreenDebugMessageExists(uint64 Key);
    void ClearOnScreenDebugMessages();
    void RemoveOnScreenDebugMessage(uint64 Key);
    UWorld* GetWorldFromContextObject(const UObject* Object, EGetWorldErrorMode ErrorMode) const;
    UWorld* GetWorldFromContextObjectChecked(const UObject* Object) const;
    const TIndirectArray<FWorldContext>& GetWorldContexts() const;
    FWorldContext* GetWorldContextFromWorld(const UWorld* InWorld);
    FWorldContext& GetWorldContextFromWorldChecked(const UWorld* InWorld);
    FWorldContext* GetWorldContextFromHandle(const FName WorldContextHandle);
    FWorldContext& CreateNewWorldContext(EWorldType::Type WorldType);
    virtual void DestroyWorldContext(UWorld* InWorld);
    APlayerController* GetFirstLocalPlayerController(const UWorld* InWorld);
    ULocalPlayer* GetFirstGamePlayer(UWorld* InWorld);
    UGameUserSettings* GetGameUserSettings();
    virtual bool Exec(UWorld* InWorld, const TCHAR* Cmd, FOutputDevice& Ar = *GLog);
    bool IsEditor();
    float GetMaxTickRate(float DeltaTime, bool bAllowFrameRateSmoothing = true) const;
    float GetMaxFPS() const;
    void SetMaxFPS(const float MaxFPS);
    bool UseSound() const;
    ENetMode GetNetMode(const UWorld* World) const;
};
extern ENGINE_API UEngine* GEngine;
