// Offline UE 5.x API stub: Containers/Ticker.h
#pragma once
#include "CoreMinimal.h"
class FTSTicker
{
public:
    struct FElement;
    using FDelegateHandle = TWeakPtr<FElement>;
    static FTSTicker& GetCoreTicker();
    FDelegateHandle AddTicker(const FTickerDelegate& InDelegate, float InDelay = 0.0f);
    FDelegateHandle AddTicker(const TCHAR* InName, float InDelay, TFunction<bool(float)> Function);
    static void RemoveTicker(FDelegateHandle Handle);
    void Tick(float DeltaTime);
    void Reset();
};
class FTickerObjectBase
{
public:
    FTickerObjectBase(float InDelay = 0.0f, FTSTicker& InTicker = FTSTicker::GetCoreTicker());
    virtual ~FTickerObjectBase();
    virtual bool Tick(float DeltaTime) = 0;
};
class FTSTickerObjectBase : public FTickerObjectBase { public: using FTickerObjectBase::FTickerObjectBase; };
