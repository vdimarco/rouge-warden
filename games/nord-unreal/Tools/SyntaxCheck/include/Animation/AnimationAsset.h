// Offline UE 5.x API stub: Animation/AnimationAsset.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Animation/AnimTypes.h"
class USkeleton;
struct FPoseCurve
{
    int32 PoseIndex;
    FName Name;
    FName PoseName;
    float Value;
    FPoseCurve();
    FPoseCurve(int32 InPoseIndex, FName InName, FName InPoseName, float InValue);
};
// delta time of an asset player tick, with the previous position (Animation/AnimationAsset.h)
struct FDeltaTimeRecord
{
    FDeltaTimeRecord() = default;
    explicit FDeltaTimeRecord(float InDeltaTime) : Delta(InDeltaTime) {}
    void Set(float InPrevious, float InDelta) { Previous = InPrevious; Delta = InDelta; bPreviousIsValid = true; }
    void SetPrevious(float InPrevious) { Previous = InPrevious; bPreviousIsValid = true; }
    float GetPrevious() const { return Previous; }
    bool IsPreviousValid() const { return bPreviousIsValid; }
    float Delta = 0.f;
private:
    float Previous = 0.f;
    bool bPreviousIsValid = false;
};
// what to sample from an animation asset (Animation/AnimationAsset.h)
struct FAnimExtractContext
{
    double CurrentTime;
    bool bExtractRootMotion;
    FDeltaTimeRecord DeltaTimeRecord;
    bool bLooping;
    TArray<bool> BonesRequired;
    TArray<FPoseCurve> PoseCurves;
    TOptional<EAnimInterpolationType> InterpolationOverride;
    bool bIgnoreRootLock;
    FAnimExtractContext(double InCurrentTime = 0.0, bool InbExtractRootMotion = false, FDeltaTimeRecord InDeltaTimeRecord = {}, bool InbLooping = false);
    bool IsBoneRequired(int32 BoneIndex) const;
};
class UAnimationAsset : public UObject
{
    UESTUB_UCLASS_BODY(UAnimationAsset, UObject)
    UAnimationAsset(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    USkeleton* GetSkeleton() const;
    void SetSkeleton(USkeleton* NewSkeleton);
    virtual float GetPlayLength() const;
    virtual bool IsValidAdditive() const;
    virtual bool HasRootMotion() const;
    virtual bool IsValidToPlay() const;
};
