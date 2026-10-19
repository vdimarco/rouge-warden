// Offline UE 5.x API stub (AnimGraphRuntime): AnimNodes/AnimNode_TwoWayBlend.h
#pragma once
#include "Animation/AnimNodeBase.h"
struct FAnimNode_TwoWayBlend : public FAnimNode_Base
{
    FPoseLink A;
    FPoseLink B;
    EAnimAlphaInputType AlphaInputType;
    bool bAlphaBoolEnabled;
    float Alpha;
    FInputScaleBias AlphaScaleBias;
    FInputAlphaBoolBlend AlphaBoolBlend;
    FName AlphaCurveName;
    FInputScaleBiasClamp AlphaScaleBiasClamp;
    uint8 bResetChildOnActivation : 1;
    uint8 bAlwaysUpdateChildren : 1;
protected:
    float InternalBlendAlpha;
    bool bAIsRelevant;
    bool bBIsRelevant;
public:
    FAnimNode_TwoWayBlend();
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
    virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
    virtual void Evaluate_AnyThread(FPoseContext& Output) override;
    virtual void GatherDebugData(FNodeDebugData& DebugData) override;
};
