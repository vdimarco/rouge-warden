// Offline UE 5.x API stub: InputKeyEventArgs.h
#pragma once
#include "InputCoreTypes.h"
#include "Engine/EngineBaseTypes.h"
class FViewport;
struct FInputDeviceId { static FInputDeviceId CreateFromInternalId(int32 InInternalId); int32 GetId() const; bool IsValid() const; };
struct FPlatformUserId { static FPlatformUserId CreateFromInternalId(int32 InInternalId); int32 GetInternalId() const; bool IsValid() const; };
struct FInputKeyEventArgs
{
    FInputKeyEventArgs(FViewport* InViewport, int32 InControllerId, FKey InKey, EInputEvent InEvent);
    FInputKeyEventArgs(FViewport* InViewport, FInputDeviceId InInputDevice, FKey InKey, EInputEvent InEvent);
    FInputKeyEventArgs(FViewport* InViewport, FInputDeviceId InInputDevice, FKey InKey, float InAmountDepressed, float InDeltaTime, int32 InNumSamples, uint64 InTimestamp);
    static FInputKeyEventArgs CreateSimulated(const FKey& InKey, const EInputEvent InEvent, const float InAmountDepressed, const int32 InNumSamples = 1, const FInputDeviceId InInputDevice = FInputDeviceId(), const bool bIsTouchEvent = false, FViewport* InViewport = nullptr);
    bool IsGamepad() const;
    FViewport* Viewport;
    int32 ControllerId;
    FInputDeviceId InputDevice;
    FKey Key;
    EInputEvent Event;
    float AmountDepressed;
    int32 NumSamples;
    float DeltaTime;
    bool bIsTouchEvent;
};
