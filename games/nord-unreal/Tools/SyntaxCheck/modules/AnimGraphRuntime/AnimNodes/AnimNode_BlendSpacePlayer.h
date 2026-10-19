// Offline UE 5.x API stub (AnimGraphRuntime): AnimNodes/AnimNode_BlendSpacePlayer.h
#pragma once
#include "Animation/AnimNodeBase.h"
#include "Animation/BlendSpace.h"
struct FBlendFilter { FVector GetFilterLastOutput() const; };
struct FAnimNode_BlendSpacePlayerBase : public FAnimNode_AssetPlayerBase
{
    virtual UBlendSpace* GetBlendSpace() const;
    virtual FVector GetPosition() const;
    virtual float GetPlayRate() const;
    virtual bool IsLooping() const;
    virtual bool ShouldResetPlayTimeWhenBlendSpaceChanges() const;
    virtual bool SetResetPlayTimeWhenBlendSpaceChanges(bool bReset);
    virtual bool SetBlendSpace(UBlendSpace* InBlendSpace);
    virtual bool SetPosition(FVector InPosition);
    virtual bool SetPlayRate(float InPlayRate);
    virtual bool SetLoop(bool bInLoop);
    FVector GetFilteredPosition() const;
    float GetTimeFromEnd(float CurrentTime) const;
    void SnapToPosition(const FVector& NewPosition);
    virtual void Initialize_AnyThread(const FAnimationInitializeContext& Context) override;
    virtual void CacheBones_AnyThread(const FAnimationCacheBonesContext& Context) override;
    virtual void Update_AnyThread(const FAnimationUpdateContext& Context) override;
    virtual void Evaluate_AnyThread(FPoseContext& Output) override;
    virtual float GetCurrentAssetTime() const override;
    virtual float GetCurrentAssetLength() const override;
    virtual UAnimationAsset* GetAnimAsset() const override;
protected:
    FBlendFilter BlendFilter;
    TArray<FBlendSampleData> BlendSampleDataCache;
    int32 CachedTriangulationIndex;
    TObjectPtr<UBlendSpace> PreviousBlendSpace;
};
struct FAnimNode_BlendSpacePlayer : public FAnimNode_BlendSpacePlayerBase
{
    virtual UBlendSpace* GetBlendSpace() const override;
    virtual FVector GetPosition() const override;
    virtual bool SetBlendSpace(UBlendSpace* InBlendSpace) override;
    virtual bool SetPosition(FVector InPosition) override;
};
struct FAnimNode_BlendSpacePlayer_Standalone : public FAnimNode_BlendSpacePlayerBase
{
    virtual UBlendSpace* GetBlendSpace() const override;
    virtual FVector GetPosition() const override;
    virtual float GetPlayRate() const override;
    virtual bool IsLooping() const override;
    virtual bool SetBlendSpace(UBlendSpace* InBlendSpace) override;
    virtual bool SetPosition(FVector InPosition) override;
    virtual bool SetPlayRate(float InPlayRate) override;
    virtual bool SetLoop(bool bInLoop) override;
};
