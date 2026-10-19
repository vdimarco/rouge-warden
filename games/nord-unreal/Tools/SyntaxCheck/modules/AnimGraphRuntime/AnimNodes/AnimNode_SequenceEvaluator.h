// Offline UE 5.x API stub (AnimGraphRuntime): AnimNodes/AnimNode_SequenceEvaluator.h
#pragma once
#include "Animation/AnimNodeBase.h"
#include "Animation/AnimSequenceBase.h"
namespace ESequenceEvalReinit { enum Type : int { NoReset, StartPosition, ExplicitTime }; }
struct FAnimNode_SequenceEvaluatorBase : public FAnimNode_AssetPlayerBase
{
    virtual bool SetSequence(UAnimSequenceBase* InSequence);
    virtual bool SetExplicitTime(float InTime);
    virtual bool SetExplicitFrame(int32 InFrame);
    virtual bool SetShouldLoop(bool bInShouldLoop);
    virtual bool SetTeleportToExplicitTime(bool bInTeleport);
    virtual bool SetReinitializationBehavior(TEnumAsByte<ESequenceEvalReinit::Type> InBehavior);
    virtual bool SetStartPosition(float InStartPosition);
    virtual bool SetPlayRate(float InPlayRate);
    virtual UAnimSequenceBase* GetSequence() const;
    virtual float GetExplicitTime() const;
    virtual int32 GetExplicitFrame() const;
    virtual bool GetShouldLoop() const;
    virtual bool GetTeleportToExplicitTime() const;
    virtual float GetStartPosition() const;
    virtual float GetPlayRate() const;
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
    virtual void Evaluate_AnyThread(FPoseContext& Output) override;
    virtual float GetCurrentAssetTime() const override;
    virtual float GetCurrentAssetLength() const override;
    virtual UAnimationAsset* GetAnimAsset() const override;
};
struct FAnimNode_SequenceEvaluator : public FAnimNode_SequenceEvaluatorBase {};
struct FAnimNode_SequenceEvaluator_Standalone : public FAnimNode_SequenceEvaluatorBase
{
    virtual bool SetSequence(UAnimSequenceBase* InSequence) override;
    virtual bool SetExplicitTime(float InTime) override;
    virtual bool SetShouldLoop(bool bInShouldLoop) override;
    virtual bool SetTeleportToExplicitTime(bool bInTeleport) override;
    virtual UAnimSequenceBase* GetSequence() const override;
    virtual float GetExplicitTime() const override;
    virtual bool GetShouldLoop() const override;
    virtual bool GetTeleportToExplicitTime() const override;
};
