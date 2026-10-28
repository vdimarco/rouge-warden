// Offline UE 5.x API stub: Animation/AnimMontage.h
#pragma once
#include "Animation/AnimSequenceBase.h"
class UAnimCompositeBase : public UAnimSequenceBase { UESTUB_UCLASS_BODY(UAnimCompositeBase, UAnimSequenceBase) UAnimCompositeBase(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); };
class UAnimMontage : public UAnimCompositeBase
{
    UESTUB_UCLASS_BODY(UAnimMontage, UAnimCompositeBase)
    UAnimMontage(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float BlendInTime_DEPRECATED;
    bool bEnableAutoBlendOut;
    int32 GetSectionIndex(FName InSectionName) const;
    FName GetSectionName(int32 SectionIndex) const;
    int32 GetNumSections() const;
    float GetSectionLength(int32 SectionIndex) const;
    float GetDefaultBlendInTime() const;
    float GetDefaultBlendOutTime() const;
    bool IsValidSectionName(FName InSectionName) const;
};
