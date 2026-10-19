// Offline UE 5.x API stub: Engine/GameViewportClient.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineBaseTypes.h"
class FViewport;
class UWorld;
class UGameInstance;
class SWidget;
class UGameViewportClient : public UObject
{
    UESTUB_UCLASS_BODY(UGameViewportClient, UObject)
    UGameViewportClient(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FViewport* Viewport;
    bool bDisableWorldRendering;
    int32 ViewModeIndex;
    virtual UWorld* GetWorld() const override;
    UGameInstance* GetGameInstance() const;
    void GetViewportSize(FVector2D& out_ViewportSize) const;
    bool IsFullScreenViewport() const;
    bool IsFocused(FViewport* InViewport);
    void SetForceDisableSplitscreen(const bool bDisabled);
    bool IsSplitscreenForceDisabled() const;
    void SetSuppressTransitionMessage(bool bSuppress);
    void SetMouseCaptureMode(EMouseCaptureMode Mode);
    void SetMouseLockMode(EMouseLockMode InMouseLockMode);
    void SetHideCursorDuringCapture(bool InHideCursorDuringCapture);
    void AddViewportWidgetContent(TSharedRef<SWidget> ViewportContent, const int32 ZOrder = 0);
    void RemoveViewportWidgetContent(TSharedRef<SWidget> ViewportContent);
    void RemoveAllViewportWidgets();
};
