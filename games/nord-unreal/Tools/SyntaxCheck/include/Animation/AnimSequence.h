// Offline UE 5.x API stub: Animation/AnimSequence.h
#pragma once
#include "Animation/AnimSequenceBase.h"
#include "BoneIndices.h"
struct FBoneContainer;
class UAnimSequence : public UAnimSequenceBase
{
    UESTUB_UCLASS_BODY(UAnimSequence, UAnimSequenceBase)
    UAnimSequence(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    bool bEnableRootMotion;
    TEnumAsByte<ERootMotionRootLock::Type> RootMotionRootLock;
    bool bForceRootLock;
    bool bUseNormalizedRootMotionScale;
    EAnimInterpolationType Interpolation;
    FName RetargetSource;
    virtual bool HasRootMotion() const override;
    virtual int32 GetNumberOfSampledKeys() const override;
    FTransform ExtractRootMotion(float StartTime, float DeltaTime, bool bAllowLooping) const;
    FTransform ExtractRootTrackTransform(float Time, const FBoneContainer* RequiredBones) const;
    virtual bool IsValidAdditive() const override;
    virtual void GetAnimationPose(FAnimationPoseData& OutAnimationPoseData, const FAnimExtractContext& ExtractionContext) const override;
    void GetBonePose(FAnimationPoseData& OutAnimationPoseData, const FAnimExtractContext& ExtractionContext, bool bForceUseRawData = false) const;
    void GetBoneTransform(FTransform& OutAtom, FSkeletonPoseBoneIndex BoneIndex, double Time, bool bUseRawData, TOptional<EAnimInterpolationType> InterpolationOverride = TOptional<EAnimInterpolationType>()) const;
    void GetBoneTransform(FTransform& OutAtom, FSkeletonPoseBoneIndex BoneIndex, const FAnimExtractContext& ExtractionContext, bool bUseRawData) const;
    FTransform ExtractRootMotion(const FAnimExtractContext& ExtractionContext) const;
    FTransform ExtractRootMotionFromRange(double StartTrackPosition, double EndTrackPosition, const FAnimExtractContext& ExtractionContext) const;
};
