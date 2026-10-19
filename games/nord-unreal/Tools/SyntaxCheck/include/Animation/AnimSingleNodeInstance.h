// Offline UE 5.x API stub: Animation/AnimSingleNodeInstance.h
#pragma once
#include "Animation/AnimInstance.h"
class UAnimSingleNodeInstance : public UAnimInstance
{
    UESTUB_UCLASS_BODY(UAnimSingleNodeInstance, UAnimInstance)
    UAnimSingleNodeInstance(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    void SetLooping(bool bIsLooping);
    void SetPlayRate(float InPlayRate);
    void SetReverse(bool bInReverse);
    void SetPosition(float InPosition, bool bFireNotifies = true);
    void SetPositionWithPreviousTime(float InPosition, float InPreviousTime, bool bFireNotifies = true);
    void SetBlendSpacePosition(const FVector& InPosition);
    void SetPlaying(bool bIsPlaying);
    float GetLength();
    void PlayAnim(bool bIsLooping = false, float InPlayRate = 1.f, float InStartPosition = 0.f);
    void StopAnim();
    virtual void SetAnimationAsset(UAnimationAsset* NewAsset, bool bIsLooping = true, float InPlayRate = 1.f);
    UAnimationAsset* GetAnimationAsset() const;
    void SetPreviewCurveOverride(const FName& PoseName, float Value, bool bRemoveIfZero);
    bool IsPlaying() const;
    bool IsReverse() const;
    bool IsLooping() const;
    float GetPlayRate() const;
    float GetCurrentTime() const;
};
