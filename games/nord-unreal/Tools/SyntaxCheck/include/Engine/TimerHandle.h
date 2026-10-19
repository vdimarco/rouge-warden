// Offline UE 5.x API stub: Engine/TimerHandle.h
#pragma once
#include "UEStub/UObjectCore.h"
struct FTimerHandle
{
    FTimerHandle();
    bool IsValid() const;
    void Invalidate();
    bool operator==(const FTimerHandle& Other) const;
    bool operator!=(const FTimerHandle& Other) const;
    FString ToString() const;
};
uint32 GetTypeHash(const FTimerHandle& InHandle);
DECLARE_DELEGATE(FTimerDelegate);
DECLARE_DYNAMIC_DELEGATE(FTimerDynamicDelegate);
