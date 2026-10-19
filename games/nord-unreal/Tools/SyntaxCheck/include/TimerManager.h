// Offline UE 5.x API stub: TimerManager.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/TimerHandle.h"
class FTimerManager
{
public:
    template <class UserClass>
    void SetTimer(FTimerHandle& InOutHandle, UserClass* InObj, typename FTimerDelegate::template TMethodPtr<UserClass> InTimerMethod, float InRate, bool InbLoop = false, float InFirstDelay = -1.f);
    template <class UserClass>
    void SetTimer(FTimerHandle& InOutHandle, UserClass* InObj, typename FTimerDelegate::template TConstMethodPtr<UserClass> InTimerMethod, float InRate, bool InbLoop = false, float InFirstDelay = -1.f);
    void SetTimer(FTimerHandle& InOutHandle, FTimerDelegate const& InDelegate, float InRate, bool InbLoop, float InFirstDelay = -1.f);
    void SetTimer(FTimerHandle& InOutHandle, FTimerDynamicDelegate const& InDynDelegate, float InRate, bool InbLoop, float InFirstDelay = -1.f);
    void SetTimer(FTimerHandle& InOutHandle, float InRate, bool InbLoop, float InFirstDelay = -1.f);
    void SetTimer(FTimerHandle& InOutHandle, TFunction<void(void)>&& Callback, float InRate, bool InbLoop, float InFirstDelay = -1.f);
    template <class UserClass>
    FTimerHandle SetTimerForNextTick(UserClass* inObj, typename FTimerDelegate::template TMethodPtr<UserClass> inTimerMethod);
    FTimerHandle SetTimerForNextTick(FTimerDelegate const& InDelegate);
    FTimerHandle SetTimerForNextTick(FTimerDynamicDelegate const& InDynDelegate);
    FTimerHandle SetTimerForNextTick(TFunction<void(void)>&& Callback);
    void ClearTimer(FTimerHandle& InHandle);
    void ClearAllTimersForObject(void const* Object);
    void PauseTimer(FTimerHandle InHandle);
    void UnPauseTimer(FTimerHandle InHandle);
    float GetTimerRate(FTimerHandle InHandle) const;
    bool IsTimerActive(FTimerHandle InHandle) const;
    bool IsTimerPaused(FTimerHandle InHandle) const;
    bool IsTimerPending(FTimerHandle InHandle) const;
    bool TimerExists(FTimerHandle InHandle) const;
    float GetTimerElapsed(FTimerHandle InHandle) const;
    float GetTimerRemaining(FTimerHandle InHandle) const;
    bool HasBeenTickedThisFrame() const;
    void ListTimers() const;
};
