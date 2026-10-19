// Offline stub (PixelStreaming2): IPixelStreaming2Module.h
#pragma once
#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "IPixelStreaming2Streamer.h"
class IPixelStreaming2Module : public IModuleInterface
{
public:
    static IPixelStreaming2Module& Get();
    static bool IsAvailable();
    DECLARE_EVENT_OneParam(IPixelStreaming2Module, FReadyEvent, IPixelStreaming2Module&);
    virtual FReadyEvent& OnReady() = 0;
    virtual bool IsReady() = 0;
    virtual bool StartStreaming() = 0;
    virtual void StopStreaming() = 0;
    virtual TSharedPtr<IPixelStreaming2Streamer> CreateStreamer(const FString& StreamerId, const FString& Type = TEXT("DefaultRtc")) = 0;
    virtual TArray<FString> GetStreamerIds() = 0;
    virtual TSharedPtr<IPixelStreaming2Streamer> FindStreamer(const FString& StreamerId) = 0;
    virtual TSharedPtr<IPixelStreaming2Streamer> DeleteStreamer(const FString& StreamerId) = 0;
    virtual void DeleteStreamer(TSharedPtr<IPixelStreaming2Streamer> ToBeDeleted) = 0;
    virtual FString GetDefaultStreamerID() = 0;
    virtual FString GetDefaultConnectionURL() = 0;
    virtual void ForEachStreamer(const TFunction<void(TSharedPtr<IPixelStreaming2Streamer>)>& Func) = 0;
};
