// Offline UE 5.x API stub: Animation/AnimNodeSpaceConversions.h
#pragma once
#include "Animation/AnimNodeBase.h"
struct FAnimNode_ConvertComponentToLocalSpace : public FAnimNode_Base
{
    FComponentSpacePoseLink ComponentPose;
    FAnimNode_ConvertComponentToLocalSpace();
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
    virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
    virtual void Evaluate_AnyThread(FPoseContext& Output) override;
    virtual void GatherDebugData(FNodeDebugData& DebugData) override;
};
struct FAnimNode_ConvertLocalToComponentSpace : public FAnimNode_Base
{
    FPoseLink LocalPose;
    FAnimNode_ConvertLocalToComponentSpace();
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
    virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
    virtual void EvaluateComponentSpace_AnyThread(FComponentSpacePoseContext& OutputPose) override;
    virtual void GatherDebugData(FNodeDebugData& DebugData) override;
};
