// Offline stub (PixelStreaming2): PixelStreaming2Delegates.h
#pragma once
#include "CoreMinimal.h"
#include "UObject/Object.h"
DECLARE_MULTICAST_DELEGATE_OneParam(FOnConnectedToSignallingServerNative, FString);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnDisconnectedFromSignallingServerNative, FString);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnNewConnectionNative, FString, FString);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnClosedConnectionNative, FString, FString);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnAllConnectionsClosedNative, FString);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnDataTrackOpenNative, FString, FString);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnDataTrackClosedNative, FString, FString);
DECLARE_MULTICAST_DELEGATE_ThreeParams(FOnStatChangedNative, FString, FName, float);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnConnectedToSignallingServer, FString, StreamerId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDisconnectedFromSignallingServer, FString, StreamerId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnNewConnection, FString, StreamerId, FString, PlayerId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnClosedConnection, FString, StreamerId, FString, PlayerId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAllConnectionsClosed, FString, StreamerId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnDataTrackOpen, FString, StreamerId, FString, PlayerId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnDataTrackClosed, FString, StreamerId, FString, PlayerId);
class UPixelStreaming2Delegates : public UObject
{
    UESTUB_UCLASS_BODY(UPixelStreaming2Delegates, UObject)
    UPixelStreaming2Delegates(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static UPixelStreaming2Delegates* Get();
    FOnConnectedToSignallingServer OnConnectedToSignallingServer;
    FOnConnectedToSignallingServerNative OnConnectedToSignallingServerNative;
    FOnDisconnectedFromSignallingServer OnDisconnectedFromSignallingServer;
    FOnDisconnectedFromSignallingServerNative OnDisconnectedFromSignallingServerNative;
    FOnNewConnection OnNewConnection;
    FOnNewConnectionNative OnNewConnectionNative;
    FOnClosedConnection OnClosedConnection;
    FOnClosedConnectionNative OnClosedConnectionNative;
    FOnAllConnectionsClosed OnAllConnectionsClosed;
    FOnAllConnectionsClosedNative OnAllConnectionsClosedNative;
    FOnDataTrackOpen OnDataTrackOpen;
    FOnDataTrackOpenNative OnDataTrackOpenNative;
    FOnDataTrackClosed OnDataTrackClosed;
    FOnDataTrackClosedNative OnDataTrackClosedNative;
    FOnStatChangedNative OnStatChangedNative;
};
