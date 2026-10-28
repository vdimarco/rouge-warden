// Offline UE 5.x API stub: Algo/*.h range algorithms. Bodies are real loops so element,
// predicate and projection types are checked the way the engine templates check them.
#pragma once
#include "CoreMinimal.h"
#include <iterator>
namespace Algo
{
    template <typename RangeType> void Sort(RangeType&& Range) { for (auto& A : Range) { (void)static_cast<bool>(A < A); } }
    template <typename RangeType, typename PredicateType> void Sort(RangeType&& Range, PredicateType Pred) { for (auto& A : Range) { (void)static_cast<bool>(Invoke(Pred, A, A)); } }
    template <typename RangeType, typename ProjectionType> void SortBy(RangeType&& Range, ProjectionType Proj) { for (auto& A : Range) { (void)static_cast<bool>(Invoke(Proj, A) < Invoke(Proj, A)); } }
    template <typename RangeType, typename ProjectionType, typename PredicateType> void SortBy(RangeType&& Range, ProjectionType Proj, PredicateType Pred) { for (auto& A : Range) { (void)static_cast<bool>(Invoke(Pred, Invoke(Proj, A), Invoke(Proj, A))); } }
    template <typename RangeType> void StableSort(RangeType&& Range) { Algo::Sort(Range); }
    template <typename RangeType, typename PredicateType> void StableSort(RangeType&& Range, PredicateType Pred) { Algo::Sort(Range, Pred); }
    template <typename RangeType> void Reverse(RangeType&& Range) { for (auto& A : Range) { (void)A; } }

    template <typename RangeType, typename ValueType> auto Find(RangeType&& Range, const ValueType& Value) -> decltype(&*std::begin(Range))
    { for (auto& A : Range) { if (A == Value) return &A; } return nullptr; }
    template <typename RangeType, typename ValueType, typename ProjectionType> auto FindBy(RangeType&& Range, const ValueType& Value, ProjectionType Proj) -> decltype(&*std::begin(Range))
    { for (auto& A : Range) { if (Invoke(Proj, A) == Value) return &A; } return nullptr; }
    template <typename RangeType, typename PredicateType> auto FindByPredicate(RangeType&& Range, PredicateType Pred) -> decltype(&*std::begin(Range))
    { for (auto& A : Range) { if (Invoke(Pred, A)) return &A; } return nullptr; }
    template <typename RangeType, typename ValueType> int32 IndexOf(RangeType&& Range, const ValueType& Value)
    { int32 I = 0; for (auto& A : Range) { if (A == Value) return I; ++I; } return INDEX_NONE; }
    template <typename RangeType, typename ValueType, typename ProjectionType> int32 IndexOfBy(RangeType&& Range, const ValueType& Value, ProjectionType Proj)
    { int32 I = 0; for (auto& A : Range) { if (Invoke(Proj, A) == Value) return I; ++I; } return INDEX_NONE; }
    template <typename RangeType, typename PredicateType> int32 IndexOfByPredicate(RangeType&& Range, PredicateType Pred)
    { int32 I = 0; for (auto& A : Range) { if (Invoke(Pred, A)) return I; ++I; } return INDEX_NONE; }
    template <typename RangeType, typename ValueType> SIZE_T Count(RangeType&& Range, const ValueType& Value)
    { SIZE_T N = 0; for (auto& A : Range) { if (A == Value) ++N; } return N; }
    template <typename RangeType, typename PredicateType> SIZE_T CountIf(RangeType&& Range, PredicateType Pred)
    { SIZE_T N = 0; for (auto& A : Range) { if (Invoke(Pred, A)) ++N; } return N; }
    template <typename RangeType> bool AnyOf(RangeType&& Range) { for (auto& A : Range) { if (A) return true; } return false; }
    template <typename RangeType, typename PredicateType> bool AnyOf(RangeType&& Range, PredicateType Pred) { for (auto& A : Range) { if (Invoke(Pred, A)) return true; } return false; }
    template <typename RangeType> bool AllOf(RangeType&& Range) { for (auto& A : Range) { if (!A) return false; } return true; }
    template <typename RangeType, typename PredicateType> bool AllOf(RangeType&& Range, PredicateType Pred) { for (auto& A : Range) { if (!Invoke(Pred, A)) return false; } return true; }
    template <typename RangeType> bool NoneOf(RangeType&& Range) { return !Algo::AnyOf(Range); }
    template <typename RangeType, typename PredicateType> bool NoneOf(RangeType&& Range, PredicateType Pred) { return !Algo::AnyOf(Range, Pred); }
    template <typename RangeType> auto MinElement(RangeType&& Range) -> decltype(&*std::begin(Range))
    { decltype(&*std::begin(Range)) R = nullptr; for (auto& A : Range) { if (!R || A < *R) R = &A; } return R; }
    template <typename RangeType> auto MaxElement(RangeType&& Range) -> decltype(&*std::begin(Range))
    { decltype(&*std::begin(Range)) R = nullptr; for (auto& A : Range) { if (!R || *R < A) R = &A; } return R; }
    template <typename RangeType, typename ProjectionType> auto MinElementBy(RangeType&& Range, ProjectionType Proj) -> decltype(&*std::begin(Range))
    { decltype(&*std::begin(Range)) R = nullptr; for (auto& A : Range) { if (!R || Invoke(Proj, A) < Invoke(Proj, *R)) R = &A; } return R; }
    template <typename RangeType, typename ProjectionType> auto MaxElementBy(RangeType&& Range, ProjectionType Proj) -> decltype(&*std::begin(Range))
    { decltype(&*std::begin(Range)) R = nullptr; for (auto& A : Range) { if (!R || Invoke(Proj, *R) < Invoke(Proj, A)) R = &A; } return R; }
    template <typename T, typename RangeType> T Accumulate(RangeType&& Range, T Init) { for (auto& A : Range) { Init = Init + A; } return Init; }
    template <typename T, typename RangeType, typename OpType> T Accumulate(RangeType&& Range, T Init, OpType Op) { for (auto& A : Range) { Init = Invoke(Op, Init, A); } return Init; }
    template <typename T, typename RangeType, typename MapType> T TransformAccumulate(RangeType&& Range, MapType MapOp, T Init) { for (auto& A : Range) { Init = Init + Invoke(MapOp, A); } return Init; }
    template <typename InT, typename OutT, typename TransformType> void Transform(const InT& Input, OutT&& Output, TransformType Trans) { for (auto& A : Input) { Output.Add(Invoke(Trans, A)); } }
    template <typename InT, typename OutT, typename PredicateType, typename TransformType> void TransformIf(const InT& Input, OutT&& Output, PredicateType Pred, TransformType Trans) { for (auto& A : Input) { if (Invoke(Pred, A)) Output.Add(Invoke(Trans, A)); } }
    template <typename InT, typename OutT> void Copy(const InT& Input, OutT& Output) { for (auto& A : Input) { Output.Add(A); } }
    template <typename InT, typename OutT, typename PredicateType> void CopyIf(const InT& Input, OutT& Output, PredicateType Pred) { for (auto& A : Input) { if (Invoke(Pred, A)) Output.Add(A); } }
    template <typename RangeType, typename CallableType> void ForEach(RangeType&& Range, CallableType Callable) { for (auto& A : Range) { Invoke(Callable, A); } }
    template <typename RangeType, typename PredicateType> int32 RemoveIf(RangeType& Range, PredicateType Pred) { for (auto& A : Range) { (void)static_cast<bool>(Invoke(Pred, A)); } return 0; }
    template <typename RangeType, typename ValueType> int32 LowerBound(RangeType& Range, const ValueType& Value) { for (auto& A : Range) { (void)static_cast<bool>(A < Value); } return 0; }
    template <typename RangeType, typename ValueType> int32 UpperBound(RangeType& Range, const ValueType& Value) { for (auto& A : Range) { (void)static_cast<bool>(Value < A); } return 0; }
    template <typename RangeType, typename ValueType> int32 BinarySearch(RangeType& Range, const ValueType& Value) { for (auto& A : Range) { (void)static_cast<bool>(A < Value); } return INDEX_NONE; }
}
