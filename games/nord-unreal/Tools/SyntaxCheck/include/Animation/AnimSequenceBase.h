// Offline UE 5.x API stub: Animation/AnimSequenceBase.h
#pragma once
#include "Animation/AnimationAsset.h"
struct FAnimationPoseData;
struct FAnimNotifyEvent { float TriggerTimeOffset; FName NotifyName; };
class UAnimSequenceBase : public UAnimationAsset
{
    UESTUB_UCLASS_BODY(UAnimSequenceBase, UAnimationAsset)
    UAnimSequenceBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FAnimNotifyEvent> Notifies;
    float RateScale;
    bool bLoop;
    virtual float GetPlayLength() const override;
    virtual bool HasRootMotion() const override;
    virtual int32 GetNumberOfSampledKeys() const;
    virtual bool IsLoopingAllowed() const;
    float GetFrameRate() const;
    virtual void GetAnimationPose(FAnimationPoseData& OutAnimationPoseData, const FAnimExtractContext& ExtractionContext) const;
    virtual void EvaluateCurveData(struct FBlendedCurve& OutCurve, const FAnimExtractContext& ExtractionContext, bool bForceUseRawData = false) const;
    virtual bool IsCurveCompressedDataValid() const;
    float GetPlayLengthFromNumFrames() const;
};
