// Offline UE 5.x API stub: Animation/AnimNodeBase.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Animation/AnimTypes.h"
#include "Engine/EngineTypes.h"
struct FAnimInstanceProxy;
struct FAnimationInitializeContext;
struct FAnimationCacheBonesContext;
struct FAnimationUpdateContext;
struct FPoseContext;
struct FComponentSpacePoseContext;
struct FNodeDebugData;
struct FAnimNode_Base
{
    FAnimNode_Base();
    virtual ~FAnimNode_Base();
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context);
    virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context);
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context);
    virtual void Evaluate_AnyThread(FPoseContext& Output);
    virtual void EvaluateComponentSpace_AnyThread(FComponentSpacePoseContext& Output);
    virtual void GatherDebugData(FNodeDebugData& DebugData);
    virtual bool HasPreUpdate() const;
    virtual void PreUpdate(const class UAnimInstance* InAnimInstance);
    virtual bool NeedsDynamicReset() const;
    virtual void ResetDynamics(ETeleportType InTeleportType);
};
struct FPoseLinkBase
{
    int32 LinkID;
    FPoseLinkBase();
    void SetLinkNode(struct FAnimNode_Base* NewLinkNode);
    void SetDynamicLinkNode(struct FPoseLinkBase* InPoseLink);
    FAnimNode_Base* GetLinkNode();
    void Initialize(const FAnimationInitializeContext& Context);
    void CacheBones(const FAnimationCacheBonesContext& Context);
    void Update(const FAnimationUpdateContext& Context);
};
struct FPoseLink : public FPoseLinkBase { void Evaluate(FPoseContext& Output); };
struct FComponentSpacePoseLink : public FPoseLinkBase { void EvaluateComponentSpace(FComponentSpacePoseContext& Output); };
struct FInputScaleBias { float Scale; float Bias; float ApplyTo(float Value) const; };
struct FInputScaleBiasClamp { bool bMapRange; bool bClampResult; bool bInterpResult; float ApplyTo(float Value, float InDeltaTime) const; };
struct FInputAlphaBoolBlend
{
    float BlendInTime;
    float BlendOutTime;
    EAlphaBlendOption BlendOption;
    bool bInitialized;
    TObjectPtr<class UCurveFloat> CustomCurve;
    FInputAlphaBoolBlend();
};
struct FBoneReference
{
    FName BoneName;
    int32 BoneIndex;
    FBoneReference();
    FBoneReference(const FName& InBoneName);
    bool IsValidToEvaluate() const;
};
struct FAnimNode_AssetPlayerBase : public FAnimNode_Base
{
    virtual float GetCurrentAssetTime() const;
    virtual float GetCurrentAssetLength() const;
    virtual float GetAccumulatedTime() const;
    virtual void SetAccumulatedTime(float NewTime);
    virtual class UAnimationAsset* GetAnimAsset() const;
    float GetCachedBlendWeight() const;
};
