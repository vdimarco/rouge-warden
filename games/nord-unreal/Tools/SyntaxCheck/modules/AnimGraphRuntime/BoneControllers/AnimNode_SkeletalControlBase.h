// Offline UE 5.x API stub (AnimGraphRuntime): BoneControllers/AnimNode_SkeletalControlBase.h
#pragma once
#include "Animation/AnimNodeBase.h"
struct FBoneTransform { int32 BoneIndex; FTransform Transform; };
struct FAnimNode_SkeletalControlBase : public FAnimNode_Base
{
    FComponentSpacePoseLink ComponentPose;
    int32 LODThreshold;
    float ActualAlpha;
    EAnimAlphaInputType AlphaInputType;
    bool bAlphaBoolEnabled;
    float Alpha;
    FInputScaleBias AlphaScaleBias;
    FInputAlphaBoolBlend AlphaBoolBlend;
    FName AlphaCurveName;
    FInputScaleBiasClamp AlphaScaleBiasClamp;
    FAnimNode_SkeletalControlBase();
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
    virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
    virtual void EvaluateComponentSpace_AnyThread(FComponentSpacePoseContext& Output) override;
    virtual void EvaluateSkeletalControl_AnyThread(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms);
};
