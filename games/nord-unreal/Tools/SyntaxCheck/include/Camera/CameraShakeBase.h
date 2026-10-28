// Offline UE 5.x API stub: Camera/CameraShakeBase.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Camera/CameraTypes.h"
class APlayerCameraManager;
class UCameraShakePattern;
struct FCameraShakeDuration
{
    FCameraShakeDuration();
    static FCameraShakeDuration Infinite();
    bool IsFixed() const;
    bool IsInfinite() const;
    float Get() const;
};
struct FCameraShakeInfo
{
    FCameraShakeDuration Duration;
    float BlendIn;
    float BlendOut;
};
class UCameraShakeBase : public UObject
{
    UESTUB_UCLASS_BODY(UCameraShakeBase, UObject)
    UCameraShakeBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    bool bSingleInstance;
    float ShakeScale;
    APlayerCameraManager* GetCameraManager() const;
    void GetShakeInfo(FCameraShakeInfo& OutInfo) const;
    UCameraShakePattern* GetRootShakePattern() const;
    void SetRootShakePattern(UCameraShakePattern* InPattern);
    template <typename ShakePatternType> ShakePatternType* ChangeRootShakePattern();
    bool IsFinished() const;
    bool IsActive() const;
    void StopShake(bool bImmediately = true);
};
class UCameraShakePattern : public UObject
{
    UESTUB_UCLASS_BODY(UCameraShakePattern, UObject)
    UCameraShakePattern(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UCameraShakeBase* GetShakeInstance() const;
};
