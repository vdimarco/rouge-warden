// Offline stub (PixelStreaming2Core): IPixelStreaming2Streamer.h
#pragma once
#include "CoreMinimal.h"
class IPixelStreaming2Streamer
{
public:
    virtual ~IPixelStreaming2Streamer() = default;
    virtual void StartStreaming() = 0;
    virtual void StopStreaming() = 0;
    virtual bool IsStreaming() const = 0;
    virtual bool IsConnected() const = 0;
    virtual FString GetId() = 0;
    virtual void SetConnectionURL(const FString& InConnectionURL) = 0;
    virtual FString GetConnectionURL() = 0;
    virtual TArray<FString> GetConnectedPlayers() = 0;
    virtual void SendAllPlayersMessage(FString MessageType, const FString& Descriptor) = 0;
    virtual void SendPlayerMessage(FString PlayerId, FString MessageType, const FString& Descriptor) = 0;
    virtual void ForceKeyFrame() = 0;
    virtual void FreezeStream(class UTexture2D* Texture) = 0;
    virtual void UnfreezeStream() = 0;
};
