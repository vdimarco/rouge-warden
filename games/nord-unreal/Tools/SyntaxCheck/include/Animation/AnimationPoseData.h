// Offline UE 5.x API stub: Animation/AnimationPoseData.h
#pragma once
#include "CoreMinimal.h"
#include "BonePose.h"
#include "Animation/AnimCurveTypes.h"
#include "Animation/AttributesRuntime.h"
struct FPoseContext;
struct FSlotEvaluationPose;
struct FAnimationPoseData
{
    FAnimationPoseData(FPoseContext& InPoseContext);
    FAnimationPoseData(FSlotEvaluationPose& InSlotPoseContext);
    FAnimationPoseData(FCompactPose& InPose, FBlendedCurve& InCurve, UE::Anim::FStackAttributeContainer& InAttributes);
    FAnimationPoseData(const FAnimationPoseData&) = default;
    FAnimationPoseData& operator=(FAnimationPoseData&& Other);
    const FCompactPose& GetPose() const;
    FCompactPose& GetPose();
    const FBlendedCurve& GetCurve() const;
    FBlendedCurve& GetCurve();
    const UE::Anim::FStackAttributeContainer& GetAttributes() const;
    UE::Anim::FStackAttributeContainer& GetAttributes();
    void CopyFrom(const FAnimationPoseData& Other);
};
