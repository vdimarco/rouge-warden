// Offline UE 5.x API stub (AnimGraphRuntime): BoneControllers/AnimNode_ModifyBone.h
#pragma once
#include "BoneControllers/AnimNode_SkeletalControlBase.h"
enum EBoneModificationMode : int { BMM_Ignore, BMM_Replace, BMM_Additive };
enum EBoneControlSpace : int { BCS_WorldSpace, BCS_ComponentSpace, BCS_ParentBoneSpace, BCS_BoneSpace, BCS_MAX };
struct FAnimNode_ModifyBone : public FAnimNode_SkeletalControlBase
{
    FBoneReference BoneToModify;
    FVector Translation;
    FRotator Rotation;
    FVector Scale;
    TEnumAsByte<EBoneModificationMode> TranslationMode;
    TEnumAsByte<EBoneModificationMode> RotationMode;
    TEnumAsByte<EBoneModificationMode> ScaleMode;
    TEnumAsByte<enum EBoneControlSpace> TranslationSpace;
    TEnumAsByte<enum EBoneControlSpace> RotationSpace;
    TEnumAsByte<enum EBoneControlSpace> ScaleSpace;
    FAnimNode_ModifyBone();
    virtual void EvaluateSkeletalControl_AnyThread(FComponentSpacePoseContext& Output, TArray<FBoneTransform>& OutBoneTransforms) override;
};
