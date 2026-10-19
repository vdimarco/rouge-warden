// Offline UE 5.x API stub: UnrealClient.h
#pragma once
#include "UEStub/UObjectCore.h"
class FViewport
{
public:
    virtual ~FViewport();
    virtual FIntPoint GetSizeXY() const;
    virtual bool HasFocus() const;
    virtual void SetMouse(int32 x, int32 y);
    virtual int32 GetMouseX() const;
    virtual int32 GetMouseY() const;
    void Draw(bool bShouldPresent = true);
};
struct FScreenshotRequest
{
    static void RequestScreenshot(bool bInShowUI);
    static void RequestScreenshot(const FString& InFilename, bool bInShowUI, bool bAddFilenameSuffix, bool bHdrScreenshot = false);
    static void Reset();
    static bool IsScreenshotRequested();
    static const FString& GetFilename();
    static bool ShouldShowUI();
};
