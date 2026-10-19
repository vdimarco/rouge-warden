// Offline UE 5.x API stub: Animation/BlendSpace.h
#pragma once
#include "Animation/AnimationAsset.h"
class UAnimSequence;
struct FBlendSample
{
    TObjectPtr<UAnimSequence> Animation;
    FVector SampleValue;
    float RateScale;
    bool bUseSingleFrameForBlending;
    uint32 FrameIndexToSample;
    bool bMirror; // read by the game's tests; not confirmed against engine headers
#if WITH_EDITORONLY_DATA
    uint8 bSnapToGrid : 1;
    uint8 bIsValid : 1;
    bool bIncludeInAnalyseAll;
#endif
    FBlendSample();
    FBlendSample(class UAnimSequence* InAnim, FVector InValue, bool bInSnapToGrid, bool bInIsValid);
};
struct FBlendSampleData
{
    int32 SampleDataIndex;
    TObjectPtr<UAnimSequence> Animation;
    float TotalWeight;
    float Time;
    float PreviousTime;
    float SamplePlayRate;
    FBlendSampleData();
    explicit FBlendSampleData(int32 Index);
    float GetClampedWeight() const;
    float GetSampleWeight() const;
    void AddWeight(float Weight);
    bool operator==(const FBlendSampleData& Other) const;
};
struct FBlendParameter
{
    FString DisplayName;
    float Min;
    float Max;
    int32 GridNum;
    bool bSnapToGrid;
    bool bWrapInput;
    FBlendParameter();
    float GetRange() const;
    float GetGridSize() const;
};
struct FInterpolationParameter
{
    float InterpolationTime;
    float DampingRatio;
    float MaxSpeed;
    TEnumAsByte<EFilterInterpolationType> InterpolationType;
    FInterpolationParameter();
};
class UBlendSpace : public UAnimationAsset
{
    UESTUB_UCLASS_BODY(UBlendSpace, UAnimationAsset)
    UBlendSpace(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FInterpolationParameter InterpolationParam[3];
    float TargetWeightInterpolationSpeedPerSec;
    bool bTargetWeightInterpolationEaseInOut;
    bool bAllowMeshSpaceBlending;
    bool bLoop;
    bool bRotationBlendInMeshSpace;
    float AnimLength;
    const TArray<FBlendSample>& GetBlendSamples() const;
    const FBlendSample& GetBlendSample(const int32 SampleIndex) const;
    int32 GetNumberOfBlendSamples() const;
    const FBlendParameter& GetBlendParameter(const int32 Index) const;
    bool GetSamplesFromBlendInput(const FVector& BlendInput, TArray<FBlendSampleData>& OutSampleDataList, int32& InOutCachedTriangulationIndex, bool bCombineAnimations) const;
    FVector GetClampedAndWrappedBlendInput(const FVector& BlendInput) const;
    virtual float GetPlayLength() const override;
#if WITH_EDITOR
    int32 AddSample(UAnimSequence* AnimationSequence, const FVector& SampleValue);
    int32 AddSample(const FVector& SampleValue);
    bool EditSampleValue(const int32 BlendSampleIndex, const FVector& NewValue);
    bool ReplaceSampleAnimation(const int32 BlendSampleIndex, UAnimSequence* AnimationSequence);
    bool DeleteSample(const int32 BlendSampleIndex);
    bool IsValidBlendSampleIndex(const int32 SampleIndex) const;
    void ValidateSampleData();
    void ResampleData();
#endif
protected:
    FBlendParameter BlendParameters[3];
    TArray<FBlendSample> SampleData;
};
