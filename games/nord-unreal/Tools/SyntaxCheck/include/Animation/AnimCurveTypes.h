// Offline UE 5.x API stub: Animation/AnimCurveTypes.h
#pragma once
#include "CoreMinimal.h"
#include "Misc/MemStack.h"
#include "BoneContainer.h"
namespace UE { namespace Anim {
enum class ECurveElementFlags : uint8 { None = 0, Material = 1 << 0, MorphTarget = 1 << 1 };
ENUM_CLASS_FLAGS(ECurveElementFlags);
struct FCurveElement
{
    FName Name;
    float Value;
    ECurveElementFlags Flags;
    FCurveElement() = default;
    FCurveElement(FName InName, float InValue, ECurveElementFlags InFlags = ECurveElementFlags::None) : Name(InName), Value(InValue), Flags(InFlags) {}
};
}} // namespace UE::Anim
template <typename InAllocatorType, typename InElementType = UE::Anim::FCurveElement>
struct TBaseBlendedCurve
{
    typedef InElementType ElementType;
    TBaseBlendedCurve();
    void InitFrom(const FBoneContainer& RequiredBones);
    template <typename OtherAllocator, typename OtherElement> void InitFrom(const TBaseBlendedCurve<OtherAllocator, OtherElement>& InCurveToInitFrom);
    template <typename OtherAllocator, typename OtherElement> void CopyFrom(const TBaseBlendedCurve<OtherAllocator, OtherElement>& InCurveToCopyFrom);
    template <typename OtherAllocator, typename OtherElement> void MoveFrom(TBaseBlendedCurve<OtherAllocator, OtherElement>& InCurveToMoveFrom);
    template <typename OtherAllocator, typename OtherElement> void Combine(const TBaseBlendedCurve<OtherAllocator, OtherElement>& AdditiveCurve);
    template <typename OtherAllocator, typename OtherElement> void Override(const TBaseBlendedCurve<OtherAllocator, OtherElement>& CurveToOverrideFrom, float Weight = 1.f);
    void Empty();
    void Reserve(int32 Num);
    int32 Num() const;
    bool IsEmpty() const;
    bool IsValid() const;
    float Get(FName InName) const;
    float Get(FName InName, bool& OutIsValid, float InDefaultValue = 0.f) const;
    TOptional<float> GetValue(FName InName) const;
    void Set(FName InName, float InValue);
    void Add(FName InName, float InValue);
    void Invalidate();
    template <typename PredicateType> void ForEachElement(PredicateType InPredicate) const
    { (void)sizeof(decltype(InPredicate(UEStub::DeclRef<const ElementType>()))*); }
};
struct FBlendedCurve : public TBaseBlendedCurve<FAnimStackAllocator>
{
};
struct FBlendedHeapCurve : public TBaseBlendedCurve<FDefaultAllocator>
{
};
struct FAnimCurveBase
{
    FName CurveName;
    int32 Flags;
};
struct FFloatCurve : public FAnimCurveBase
{
    float Evaluate(float CurrentTime) const;
    void UpdateOrAddKey(float InValue, float InTime);
};
struct FTransformCurve : public FAnimCurveBase {};
struct FRawCurveTracks
{
    TArray<FFloatCurve> FloatCurves;
    TArray<FTransformCurve> TransformCurves;
};
