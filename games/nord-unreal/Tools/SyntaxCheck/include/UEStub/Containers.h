// Offline UE 5.x API stub: TArray, TArrayView, TMap, TSet and allocators.
// Member functions that take predicates or compare elements have small bodies so that
// the element/predicate types are checked the way the real templates check them.
#pragma once
#include "UEStub/Templates.h"

namespace UEStub
{
    template <class T, class... A> void CheckConstructible(A&&... Args) { (void)sizeof(::new ((void*)nullptr) T(static_cast<A&&>(Args)...)); }
    template <class P, class... A> void CheckPredicate(const P& Pred, A&&... Args) { (void)static_cast<bool>(Pred(static_cast<A&&>(Args)...)); }
}

// ---------------------------------------------------------------- allocators
template <int IndexSize> class TSizedDefaultAllocator { public: enum { NeedsElementType = false, RequireRangeCheck = true }; };
using FDefaultAllocator = TSizedDefaultAllocator<32>;
using FDefaultAllocator64 = TSizedDefaultAllocator<64>;
class FHeapAllocator {};
template <uint32 NumInlineElements, typename SecondaryAllocator = FDefaultAllocator> class TInlineAllocator {};
template <uint32 NumInlineElements> class TFixedAllocator {};
template <uint32 NumInlineElements> class TNonRelocatableInlineAllocator {};
class FDefaultBitArrayAllocator {};
class FDefaultSparseArrayAllocator {};
class FDefaultSetAllocator {};
template <uint32 NumInlineElements> class TInlineSetAllocator {};
template <uint32 NumInlineElements> class TInlineSparseArrayAllocator {};

template <typename InElementType, typename InAllocatorType = FDefaultAllocator> class TArray;
template <typename ElementType> class TArrayView;

// Containers/ContainerElementTypeCompatibility.h: element types an array may be reinterpreted as.
// ObjectPtr.h specializes it so TArray<TObjectPtr<T>> converts implicitly to TArray<T*>& / const TArray<T*>&.
namespace UEStub { template <typename T> struct TNoReinterpret; }
template <typename T> struct TContainerElementTypeCompatibility
{
    typedef UEStub::TNoReinterpret<T> ReinterpretType;
    typedef UEStub::TNoReinterpret<T> CopyFromOtherType;
};
template <typename T> class TObjectPtr;
template <typename T> struct TContainerElementTypeCompatibility<TObjectPtr<T>>
{
    typedef T* ReinterpretType;
    typedef T* CopyFromOtherType;
};
template <typename T> using TConstArrayView = TArrayView<const T>;
template <typename InElementType, typename InAllocatorType> struct TIsTArray<TArray<InElementType, InAllocatorType>> { enum { Value = true }; };

// ---------------------------------------------------------------- TArray
template <typename InElementType, typename InAllocatorType>
class TArray
{
public:
    typedef int32 SizeType;
    typedef InElementType ElementType;
    typedef InAllocatorType AllocatorType;
    typedef ElementType* RangedForIteratorType;
    typedef const ElementType* RangedForConstIteratorType;

    TArray() {}
    TArray(std::initializer_list<InElementType> InitList) {}
    TArray(const ElementType* Ptr, SizeType Count) {}
    template <typename OtherElementType, std::enable_if_t<std::is_constructible_v<ElementType, const OtherElementType&>, int> = 0>
    explicit TArray(const TArrayView<OtherElementType>& Other) {}
    TArray(const TArray& Other) { static_assert(std::is_copy_constructible_v<ElementType>, "TArray: copying an array requires a copyable element type"); }
    TArray(TArray&& Other) {}
    template <typename OtherElementType, typename OtherAllocator, std::enable_if_t<std::is_constructible_v<ElementType, const OtherElementType&>, int> = 0>
    explicit TArray(const TArray<OtherElementType, OtherAllocator>& Other) {}
    ~TArray() {}
    TArray& operator=(std::initializer_list<InElementType> InitList) { return ::UEStub::Fake<TArray&>(); }
    TArray& operator=(const TArray& Other) { static_assert(std::is_copy_constructible_v<ElementType>, "TArray: copying an array requires a copyable element type"); return ::UEStub::Fake<TArray&>(); }
    TArray& operator=(TArray&& Other) { return ::UEStub::Fake<TArray&>(); }
    template <typename OtherAllocator> TArray& operator=(const TArray<ElementType, OtherAllocator>& Other) { return ::UEStub::Fake<TArray&>(); }
    // TArray<TObjectPtr<T>> <-> TArray<T*> views (no-op for other element types)
    operator TArray<typename TContainerElementTypeCompatibility<InElementType>::ReinterpretType, InAllocatorType>&() { return ::UEStub::Fake<TArray<typename TContainerElementTypeCompatibility<InElementType>::ReinterpretType, InAllocatorType>&>(); }
    operator const TArray<typename TContainerElementTypeCompatibility<InElementType>::ReinterpretType, InAllocatorType>&() const { return ::UEStub::Fake<const TArray<typename TContainerElementTypeCompatibility<InElementType>::ReinterpretType, InAllocatorType>&>(); }

    ElementType* GetData() { return ::UEStub::Fake<ElementType*>(); }
    const ElementType* GetData() const { return ::UEStub::Fake<const ElementType*>(); }
    uint32 GetTypeSize() const { return ::UEStub::Fake<uint32>(); }
    SIZE_T GetAllocatedSize() const { return ::UEStub::Fake<SIZE_T>(); }
    SizeType GetSlack() const { return ::UEStub::Fake<SizeType>(); }
    bool IsValidIndex(SizeType Index) const { return ::UEStub::Fake<bool>(); }
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    SizeType Num() const { return ::UEStub::Fake<SizeType>(); }
    SizeType Max() const { return ::UEStub::Fake<SizeType>(); }
    void CheckInvariants() const {}
    void RangeCheck(SizeType Index) const {}
    ElementType& operator[](SizeType Index) { return ::UEStub::Fake<ElementType&>(); }
    const ElementType& operator[](SizeType Index) const { return ::UEStub::Fake<const ElementType&>(); }
    ElementType Pop(EAllowShrinking AllowShrinking = EAllowShrinking::Default) { return ::UEStub::Fake<ElementType>(); }
    void Push(ElementType&& Item) {}
    void Push(const ElementType& Item) {}
    ElementType& Top() { return ::UEStub::Fake<ElementType&>(); }
    const ElementType& Top() const { return ::UEStub::Fake<const ElementType&>(); }
    ElementType& Last(SizeType IndexFromTheEnd = 0) { return ::UEStub::Fake<ElementType&>(); }
    const ElementType& Last(SizeType IndexFromTheEnd = 0) const { return ::UEStub::Fake<const ElementType&>(); }
    void Shrink() {}

    bool Find(const ElementType& Item, SizeType& Index) const { Index = Find(Item); return Index != INDEX_NONE; }
    SizeType Find(const ElementType& Item) const { for (const ElementType& E : *this) if (E == Item) return 0; return INDEX_NONE; }
    bool FindLast(const ElementType& Item, SizeType& Index) const { Index = FindLast(Item); return Index != INDEX_NONE; }
    SizeType FindLast(const ElementType& Item) const { return Find(Item); }
    template <typename Predicate> SizeType FindLastByPredicate(Predicate Pred) const { for (const ElementType& E : *this) if (Pred(E)) return 0; return INDEX_NONE; }
    template <typename KeyType> SizeType IndexOfByKey(const KeyType& Key) const { for (const ElementType& E : *this) if (E == Key) return 0; return INDEX_NONE; }
    template <typename Predicate> SizeType IndexOfByPredicate(Predicate Pred) const { for (const ElementType& E : *this) if (Pred(E)) return 0; return INDEX_NONE; }
    template <typename KeyType> ElementType* FindByKey(const KeyType& Key) { for (ElementType& E : *this) if (E == Key) return &E; return nullptr; }
    template <typename KeyType> const ElementType* FindByKey(const KeyType& Key) const { for (const ElementType& E : *this) if (E == Key) return &E; return nullptr; }
    template <typename Predicate> ElementType* FindByPredicate(Predicate Pred) { for (ElementType& E : *this) if (Pred(E)) return &E; return nullptr; }
    template <typename Predicate> const ElementType* FindByPredicate(Predicate Pred) const { for (const ElementType& E : *this) if (Pred(E)) return &E; return nullptr; }
    template <typename Predicate> TArray FilterByPredicate(Predicate Pred) const { for (const ElementType& E : *this) if (Pred(E)) break; return TArray(); }
    template <typename ComparisonType> bool Contains(const ComparisonType& Item) const { for (const ElementType& E : *this) if (E == Item) return true; return false; }
    template <typename Predicate> bool ContainsByPredicate(Predicate Pred) const { for (const ElementType& E : *this) if (Pred(E)) return true; return false; }
    bool operator==(const TArray& OtherArray) const { for (const ElementType& E : *this) if (!(E == OtherArray[0])) return false; return true; }

    void InsertUninitialized(SizeType Index, SizeType Count = 1) {}
    void InsertZeroed(SizeType Index, SizeType Count = 1) {}
    ElementType& InsertZeroed_GetRef(SizeType Index) { return ::UEStub::Fake<ElementType&>(); }
    void InsertDefaulted(SizeType Index, SizeType Count = 1) {}
    ElementType& InsertDefaulted_GetRef(SizeType Index) { return ::UEStub::Fake<ElementType&>(); }
    SizeType Insert(std::initializer_list<ElementType> InitList, const SizeType InIndex) { return ::UEStub::Fake<SizeType>(); }
    template <typename OtherAllocator> SizeType Insert(const TArray<ElementType, OtherAllocator>& Items, const SizeType InIndex) { return ::UEStub::Fake<SizeType>(); }
    SizeType Insert(const ElementType* Ptr, SizeType Count, SizeType Index) { return ::UEStub::Fake<SizeType>(); }
    SizeType Insert(ElementType&& Item, SizeType Index) { return ::UEStub::Fake<SizeType>(); }
    SizeType Insert(const ElementType& Item, SizeType Index) { return ::UEStub::Fake<SizeType>(); }
    ElementType& Insert_GetRef(const ElementType& Item, SizeType Index) { return ::UEStub::Fake<ElementType&>(); }
    void RemoveAt(SizeType Index, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    template <typename CountType> void RemoveAt(SizeType Index, CountType Count, EAllowShrinking AllowShrinking = EAllowShrinking::Default)
    { static_assert(!std::is_same_v<CountType, bool>, "TArray::RemoveAt: unexpected bool passed as the Count argument"); }
    void RemoveAtSwap(SizeType Index, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    template <typename CountType> void RemoveAtSwap(SizeType Index, CountType Count, EAllowShrinking AllowShrinking = EAllowShrinking::Default)
    { static_assert(!std::is_same_v<CountType, bool>, "TArray::RemoveAtSwap: unexpected bool passed as the Count argument"); }
    void Reset(SizeType NewSize = 0) {}
    void Empty(SizeType Slack = 0) {}
    void SetNum(SizeType NewNum, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    void SetNumZeroed(SizeType NewNum, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    void SetNumUninitialized(SizeType NewNum, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    void SetNumUnsafeInternal(SizeType NewNum) {}
    template <typename OtherElementType, typename OtherAllocator> void Append(const TArray<OtherElementType, OtherAllocator>& Source) { if (Source.Num()) UEStub::CheckConstructible<ElementType>(Source[0]); }
    template <typename OtherElementType, typename OtherAllocator> void Append(TArray<OtherElementType, OtherAllocator>&& Source) { if (Source.Num()) UEStub::CheckConstructible<ElementType>(MoveTemp(Source[0])); }
    template <typename OtherElementType> void Append(const TArrayView<OtherElementType>& Source) {}
    void Append(const ElementType* Ptr, SizeType Count) {}
    void Append(std::initializer_list<ElementType> InitList) {}
    TArray& operator+=(TArray&& Other) { return ::UEStub::Fake<TArray&>(); }
    TArray& operator+=(const TArray& Other) { return ::UEStub::Fake<TArray&>(); }
    TArray& operator+=(std::initializer_list<ElementType> InitList) { return ::UEStub::Fake<TArray&>(); }
    template <typename... ArgsType> SizeType Emplace(ArgsType&&... Args) { UEStub::CheckConstructible<ElementType>(Forward<ArgsType>(Args)...); return 0; }
    template <typename... ArgsType> ElementType& Emplace_GetRef(ArgsType&&... Args) { UEStub::CheckConstructible<ElementType>(Forward<ArgsType>(Args)...); return (*this)[0]; }
    template <typename... ArgsType> void EmplaceAt(SizeType Index, ArgsType&&... Args) { UEStub::CheckConstructible<ElementType>(Forward<ArgsType>(Args)...); }
    template <typename... ArgsType> ElementType& EmplaceAt_GetRef(SizeType Index, ArgsType&&... Args) { UEStub::CheckConstructible<ElementType>(Forward<ArgsType>(Args)...); return (*this)[0]; }
    SizeType Add(ElementType&& Item) { return ::UEStub::Fake<SizeType>(); }
    SizeType Add(const ElementType& Item) { return ::UEStub::Fake<SizeType>(); }
    ElementType& Add_GetRef(ElementType&& Item) { return ::UEStub::Fake<ElementType&>(); }
    ElementType& Add_GetRef(const ElementType& Item) { return ::UEStub::Fake<ElementType&>(); }
    SizeType AddUninitialized() { return ::UEStub::Fake<SizeType>(); }
    SizeType AddUninitialized(SizeType Count) { return ::UEStub::Fake<SizeType>(); }
    SizeType AddZeroed() { return ::UEStub::Fake<SizeType>(); }
    SizeType AddZeroed(SizeType Count) { return ::UEStub::Fake<SizeType>(); }
    ElementType& AddZeroed_GetRef() { return ::UEStub::Fake<ElementType&>(); }
    SizeType AddDefaulted() { return ::UEStub::Fake<SizeType>(); }
    SizeType AddDefaulted(SizeType Count) { return ::UEStub::Fake<SizeType>(); }
    ElementType& AddDefaulted_GetRef() { return ::UEStub::Fake<ElementType&>(); }
    SizeType AddUnique(ElementType&& Item) { return Contains(Item) ? INDEX_NONE : 0; }
    SizeType AddUnique(const ElementType& Item) { return Contains(Item) ? INDEX_NONE : 0; }
    void Reserve(SizeType Number) {}
    void Init(const ElementType& Element, SizeType Number) {}
    SizeType RemoveSingle(const ElementType& Item) { return Find(Item) == INDEX_NONE ? 0 : 1; }
    SizeType Remove(const ElementType& Item) { return Find(Item) == INDEX_NONE ? 0 : 1; }
    template <class Predicate> SizeType RemoveAll(const Predicate& Pred) { for (ElementType& E : *this) UEStub::CheckPredicate(Pred, E); return 0; }
    template <class Predicate> void RemoveAllSwap(const Predicate& Pred, EAllowShrinking AllowShrinking = EAllowShrinking::Default) { for (ElementType& E : *this) UEStub::CheckPredicate(Pred, E); }
    SizeType RemoveSingleSwap(const ElementType& Item, EAllowShrinking AllowShrinking = EAllowShrinking::Default) { return Remove(Item); }
    SizeType RemoveSwap(const ElementType& Item, EAllowShrinking AllowShrinking = EAllowShrinking::Default) { return Remove(Item); }
    void SwapMemory(SizeType FirstIndexToSwap, SizeType SecondIndexToSwap) {}
    void Swap(SizeType FirstIndexToSwap, SizeType SecondIndexToSwap) {}
    template <typename SearchType> SizeType FindItemByClass(SearchType** Item = nullptr, SizeType* ItemIndex = nullptr, SizeType StartIndex = 0) const { return ::UEStub::Fake<SizeType>(); }

    void Sort() { if (Num() > 1) UEStub::CheckPredicate(TLess<ElementType>(), UEStub::TDerefWrap<ElementType>::Get((*this)[0]), UEStub::TDerefWrap<ElementType>::Get((*this)[1])); }
    template <class PredicateType> void Sort(const PredicateType& Predicate) { if (Num() > 1) UEStub::CheckPredicate(Predicate, UEStub::TDerefWrap<ElementType>::Get((*this)[0]), UEStub::TDerefWrap<ElementType>::Get((*this)[1])); }
    void StableSort() { Sort(); }
    template <class PredicateType> void StableSort(const PredicateType& Predicate) { Sort(Predicate); }
    template <class PredicateType> void Heapify(const PredicateType& Predicate) { Sort(Predicate); }
    void Heapify() { Sort(); }
    template <class PredicateType> SizeType HeapPush(ElementType&& InItem, const PredicateType& Predicate) { Sort(Predicate); return 0; }
    template <class PredicateType> SizeType HeapPush(const ElementType& InItem, const PredicateType& Predicate) { Sort(Predicate); return 0; }
    template <class PredicateType> void HeapPop(ElementType& OutItem, const PredicateType& Predicate, EAllowShrinking AllowShrinking = EAllowShrinking::Default) { Sort(Predicate); }
    template <class PredicateType> void HeapPopDiscard(const PredicateType& Predicate, EAllowShrinking AllowShrinking = EAllowShrinking::Default) { Sort(Predicate); }
    const ElementType& HeapTop() const { return ::UEStub::Fake<const ElementType&>(); }
    ElementType& HeapTop() { return ::UEStub::Fake<ElementType&>(); }

    class TIterator
    {
    public:
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        TIterator& operator++() { return ::UEStub::Fake<TIterator&>(); }
        TIterator& operator--() { return ::UEStub::Fake<TIterator&>(); }
        ElementType& operator*() const { return ::UEStub::Fake<ElementType&>(); }
        ElementType* operator->() const { return ::UEStub::Fake<ElementType*>(); }
        SizeType GetIndex() const { return ::UEStub::Fake<SizeType>(); }
        void Reset() {}
        void RemoveCurrent() {}
        void RemoveCurrentSwap() {}
    };
    class TConstIterator
    {
    public:
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        TConstIterator& operator++() { return ::UEStub::Fake<TConstIterator&>(); }
        TConstIterator& operator--() { return ::UEStub::Fake<TConstIterator&>(); }
        const ElementType& operator*() const { return ::UEStub::Fake<const ElementType&>(); }
        const ElementType* operator->() const { return ::UEStub::Fake<const ElementType*>(); }
        SizeType GetIndex() const { return ::UEStub::Fake<SizeType>(); }
        void Reset() {}
    };
    TIterator CreateIterator() { return ::UEStub::Fake<TIterator>(); }
    TConstIterator CreateConstIterator() const { return ::UEStub::Fake<TConstIterator>(); }

    ElementType* begin() { return ::UEStub::Fake<ElementType*>(); }
    const ElementType* begin() const { return ::UEStub::Fake<const ElementType*>(); }
    ElementType* end() { return ::UEStub::Fake<ElementType*>(); }
    const ElementType* end() const { return ::UEStub::Fake<const ElementType*>(); }
};
template <typename T, typename A> uint32 GetTypeHash(const TArray<T, A>& Array) { return ::UEStub::Fake<uint32>(); }

// ---------------------------------------------------------------- TArrayView
template <typename InElementType>
class TArrayView
{
public:
    typedef InElementType ElementType;
    typedef int32 SizeType;
    TArrayView() {}
    TArrayView(InElementType* InData, SizeType InCount) {}
    template <typename OtherElementType, size_t N, std::enable_if_t<std::is_convertible_v<OtherElementType (*)[], InElementType (*)[]>, int> = 0>
    TArrayView(OtherElementType (&InArray)[N]) {}
    template <typename OtherElementType, typename OtherAllocator, std::enable_if_t<std::is_convertible_v<OtherElementType (*)[], InElementType (*)[]>, int> = 0>
    TArrayView(TArray<OtherElementType, OtherAllocator>& Other) {}
    template <typename OtherElementType, typename OtherAllocator, std::enable_if_t<std::is_convertible_v<const OtherElementType (*)[], InElementType (*)[]>, int> = 0>
    TArrayView(const TArray<OtherElementType, OtherAllocator>& Other) {}
    template <typename OtherElementType, std::enable_if_t<std::is_convertible_v<OtherElementType (*)[], InElementType (*)[]>, int> = 0>
    TArrayView(const TArrayView<OtherElementType>& Other) {}
    TArrayView(std::initializer_list<std::remove_cv_t<InElementType>> List) {}
    InElementType* GetData() const { return ::UEStub::Fake<InElementType*>(); }
    SizeType Num() const { return ::UEStub::Fake<SizeType>(); }
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    bool IsValidIndex(SizeType Index) const { return ::UEStub::Fake<bool>(); }
    InElementType& operator[](SizeType Index) const { return ::UEStub::Fake<InElementType&>(); }
    InElementType& Last(SizeType IndexFromTheEnd = 0) const { return ::UEStub::Fake<InElementType&>(); }
    TArrayView Slice(SizeType Index, SizeType InNum) const { return ::UEStub::Fake<TArrayView>(); }
    TArrayView Left(SizeType Count) const { return ::UEStub::Fake<TArrayView>(); }
    TArrayView Right(SizeType Count) const { return ::UEStub::Fake<TArrayView>(); }
    TArrayView Mid(SizeType Index, SizeType Count = MAX_int32) const { return ::UEStub::Fake<TArrayView>(); }
    template <typename ComparisonType> bool Contains(const ComparisonType& Item) const { for (InElementType& E : *this) if (E == Item) return true; return false; }
    template <typename Predicate> InElementType* FindByPredicate(Predicate Pred) const { for (InElementType& E : *this) if (Pred(E)) return &E; return nullptr; }
    SizeType Find(const InElementType& Item) const { return ::UEStub::Fake<SizeType>(); }
    InElementType* begin() const { return ::UEStub::Fake<InElementType*>(); }
    InElementType* end() const { return ::UEStub::Fake<InElementType*>(); }
};
template <typename T, size_t N> TArrayView<T> MakeArrayView(T (&Array)[N]) { return ::UEStub::Fake<TArrayView<T>>(); }
template <typename T> TArrayView<T> MakeArrayView(T* Pointer, int32 Size) { return ::UEStub::Fake<TArrayView<T>>(); }
template <typename T, typename A> TArrayView<T> MakeArrayView(TArray<T, A>& Array) { return ::UEStub::Fake<TArrayView<T>>(); }
template <typename T, typename A> TArrayView<const T> MakeArrayView(const TArray<T, A>& Array) { return ::UEStub::Fake<TArrayView<const T>>(); }
template <typename T> TArrayView<const T> MakeArrayView(std::initializer_list<T> List) { return ::UEStub::Fake<TArrayView<const T>>(); }
template <typename T, typename A> TConstArrayView<T> MakeConstArrayView(const TArray<T, A>& Array) { return ::UEStub::Fake<TConstArrayView<T>>(); }
template <typename T, size_t N> TConstArrayView<T> MakeConstArrayView(const T (&Array)[N]) { return ::UEStub::Fake<TConstArrayView<T>>(); }
template <typename T> TConstArrayView<T> MakeConstArrayView(const T* Pointer, int32 Size) { return ::UEStub::Fake<TConstArrayView<T>>(); }

template <typename T, uint32 NumElements, uint32 Alignment = alignof(T)>
class TStaticArray
{
public:
    TStaticArray() {}
    explicit TStaticArray(const T& DefaultElement) {}
    T& operator[](uint32 Index) { return ::UEStub::Fake<T&>(); }
    const T& operator[](uint32 Index) const { return ::UEStub::Fake<const T&>(); }
    static constexpr int32 Num() { return NumElements; }
    bool IsEmpty() const { return NumElements == 0; }
    T* GetData() { return ::UEStub::Fake<T*>(); }
    const T* GetData() const { return ::UEStub::Fake<const T*>(); }
    T* begin() { return ::UEStub::Fake<T*>(); }
    T* end() { return ::UEStub::Fake<T*>(); }
    const T* begin() const { return ::UEStub::Fake<const T*>(); }
    const T* end() const { return ::UEStub::Fake<const T*>(); }
};

// ---------------------------------------------------------------- TSet
template <typename ElementType, bool bInAllowDuplicateKeys = false>
struct DefaultKeyFuncs
{
    typedef ElementType KeyType;
    typedef typename TCallTraits<ElementType>::ParamType KeyInitType;
    typedef typename TCallTraits<ElementType>::ParamType ElementInitType;
    enum { bAllowDuplicateKeys = bInAllowDuplicateKeys };
};
struct FSetElementId { bool IsValidId() const; int32 AsInteger() const; static FSetElementId FromInteger(int32 Integer); };

template <typename InElementType, typename KeyFuncs = DefaultKeyFuncs<InElementType>, typename Allocator = FDefaultSetAllocator>
class TSet
{
public:
    typedef InElementType ElementType;
    typedef typename TCallTraits<InElementType>::ParamType ElementInitType;
    typedef typename TCallTraits<InElementType>::ParamType KeyInitType;
    TSet() {}
    TSet(std::initializer_list<ElementType> InitList) {}
    explicit TSet(TArrayView<const ElementType> InArrayView) {}
    explicit TSet(TArray<ElementType>&& InArray) {}
    TSet(const TSet&) {}
    TSet(TSet&&) {}
    TSet& operator=(const TSet&) { return ::UEStub::Fake<TSet&>(); }
    TSet& operator=(TSet&&) { return ::UEStub::Fake<TSet&>(); }
    TSet& operator=(std::initializer_list<ElementType> InitList) { return ::UEStub::Fake<TSet&>(); }
    ~TSet() {}
    void Empty(int32 ExpectedNumElements = 0) {}
    void Reset() {}
    void Shrink() {}
    void Compact() {}
    void Reserve(int32 Number) {}
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    int32 Num() const { return ::UEStub::Fake<int32>(); }
    FSetElementId Add(const InElementType& InElement, bool* bIsAlreadyInSetPtr = nullptr) { (void)GetTypeHash(InElement); return FSetElementId(); }
    FSetElementId Add(InElementType&& InElement, bool* bIsAlreadyInSetPtr = nullptr) { (void)GetTypeHash(InElement); return FSetElementId(); }
    template <typename ArgsType> FSetElementId Emplace(ArgsType&& Args, bool* bIsAlreadyInSetPtr = nullptr) { UEStub::CheckConstructible<InElementType>(Forward<ArgsType>(Args)); return FSetElementId(); }
    template <typename ArrayAllocator> void Append(const TArray<ElementType, ArrayAllocator>& InElements) {}
    void Append(std::initializer_list<ElementType> InitList) {}
    void Append(const TSet& OtherSet) {}
    void Remove(FSetElementId ElementId) {}
    int32 Remove(KeyInitType Key) { (void)GetTypeHash(Key); return 0; }
    ElementType* Find(KeyInitType Key) { (void)GetTypeHash(Key); return nullptr; }
    const ElementType* Find(KeyInitType Key) const { (void)GetTypeHash(Key); return nullptr; }
    FSetElementId FindId(KeyInitType Key) const { return ::UEStub::Fake<FSetElementId>(); }
    ElementType& FindOrAdd(const InElementType& InElement, bool* bIsAlreadyInSetPtr = nullptr) { return ::UEStub::Fake<ElementType&>(); }
    bool Contains(KeyInitType Key) const { (void)GetTypeHash(Key); return false; }
    TSet Intersect(const TSet& OtherSet) const { return ::UEStub::Fake<TSet>(); }
    TSet Union(const TSet& OtherSet) const { return ::UEStub::Fake<TSet>(); }
    TSet Difference(const TSet& OtherSet) const { return ::UEStub::Fake<TSet>(); }
    bool Includes(const TSet& OtherSet) const { return ::UEStub::Fake<bool>(); }
    TArray<ElementType> Array() const { return ::UEStub::Fake<TArray<ElementType>>(); }
    template <typename PREDICATE_CLASS> void Sort(const PREDICATE_CLASS& Predicate) { UEStub::CheckPredicate(Predicate, UEStub::DeclRef<const ElementType>(), UEStub::DeclRef<const ElementType>()); }
    template <typename PREDICATE_CLASS> void StableSort(const PREDICATE_CLASS& Predicate) { UEStub::CheckPredicate(Predicate, UEStub::DeclRef<const ElementType>(), UEStub::DeclRef<const ElementType>()); }
    ElementType& operator[](FSetElementId Id) { return ::UEStub::Fake<ElementType&>(); }
    const ElementType& operator[](FSetElementId Id) const { return ::UEStub::Fake<const ElementType&>(); }
    class TIterator
    {
    public:
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        TIterator& operator++() { return ::UEStub::Fake<TIterator&>(); }
        ElementType& operator*() const { return ::UEStub::Fake<ElementType&>(); }
        ElementType* operator->() const { return ::UEStub::Fake<ElementType*>(); }
        void RemoveCurrent() {}
        FSetElementId GetId() const { return ::UEStub::Fake<FSetElementId>(); }
    };
    class TConstIterator
    {
    public:
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        TConstIterator& operator++() { return ::UEStub::Fake<TConstIterator&>(); }
        const ElementType& operator*() const { return ::UEStub::Fake<const ElementType&>(); }
        const ElementType* operator->() const { return ::UEStub::Fake<const ElementType*>(); }
        FSetElementId GetId() const { return ::UEStub::Fake<FSetElementId>(); }
    };
    TIterator CreateIterator() { return ::UEStub::Fake<TIterator>(); }
    TConstIterator CreateConstIterator() const { return ::UEStub::Fake<TConstIterator>(); }
    struct TRangedIter
    {
        ElementType& operator*() const { return ::UEStub::Fake<ElementType&>(); }
        TRangedIter& operator++() { return ::UEStub::Fake<TRangedIter&>(); }
        bool operator!=(const TRangedIter&) const { return ::UEStub::Fake<bool>(); }
    };
    struct TRangedConstIter
    {
        const ElementType& operator*() const { return ::UEStub::Fake<const ElementType&>(); }
        TRangedConstIter& operator++() { return ::UEStub::Fake<TRangedConstIter&>(); }
        bool operator!=(const TRangedConstIter&) const { return ::UEStub::Fake<bool>(); }
    };
    TRangedIter begin() { return ::UEStub::Fake<TRangedIter>(); }
    TRangedIter end() { return ::UEStub::Fake<TRangedIter>(); }
    TRangedConstIter begin() const { return ::UEStub::Fake<TRangedConstIter>(); }
    TRangedConstIter end() const { return ::UEStub::Fake<TRangedConstIter>(); }
};

// ---------------------------------------------------------------- TMap
template <typename KeyType, typename ValueType, typename SetAllocator = FDefaultSetAllocator, typename KeyFuncs = void>
class TMap
{
public:
    typedef TPair<KeyType, ValueType> ElementType;
    typedef typename TTypeTraits<KeyType>::ConstPointerType KeyConstPointerType;
    typedef typename TTypeTraits<KeyType>::ConstInitType KeyInitType;
    typedef typename TTypeTraits<ValueType>::ConstInitType ValueInitType;

    TMap() {}
    TMap(std::initializer_list<TPair<KeyType, ValueType>> InitList) {}
    TMap(const TMap&) {}
    TMap(TMap&&) {}
    TMap& operator=(const TMap&) { return ::UEStub::Fake<TMap&>(); }
    TMap& operator=(TMap&&) { return ::UEStub::Fake<TMap&>(); }
    TMap& operator=(std::initializer_list<TPair<KeyType, ValueType>> InitList) { return ::UEStub::Fake<TMap&>(); }
    ~TMap() {}
    bool operator==(const TMap& Other) const { return ::UEStub::Fake<bool>(); }
    void Empty(int32 ExpectedNumElements = 0) {}
    void Reset() {}
    void Shrink() {}
    void Compact() {}
    void Reserve(int32 Number) {}
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    int32 Num() const { return ::UEStub::Fake<int32>(); }
    template <typename Allocator> int32 GetKeys(TArray<KeyType, Allocator>& OutKeys) const { return ::UEStub::Fake<int32>(); }
    template <typename Allocator> int32 GetKeys(TSet<KeyType, DefaultKeyFuncs<KeyType>, Allocator>& OutKeys) const { return ::UEStub::Fake<int32>(); }
    template <typename Allocator> void GenerateKeyArray(TArray<KeyType, Allocator>& OutArray) const {}
    template <typename Allocator> void GenerateValueArray(TArray<ValueType, Allocator>& OutArray) const {}
    ValueType& Add(const KeyType& InKey, const ValueType& InValue) { (void)GetTypeHash(InKey); return UEStub::DeclRef<ValueType>(); }
    ValueType& Add(const KeyType& InKey, ValueType&& InValue) { (void)GetTypeHash(InKey); return UEStub::DeclRef<ValueType>(); }
    ValueType& Add(KeyType&& InKey, const ValueType& InValue) { (void)GetTypeHash(InKey); return UEStub::DeclRef<ValueType>(); }
    ValueType& Add(KeyType&& InKey, ValueType&& InValue) { (void)GetTypeHash(InKey); return UEStub::DeclRef<ValueType>(); }
    ValueType& Add(const KeyType& InKey) { (void)GetTypeHash(InKey); return UEStub::DeclRef<ValueType>(); }
    ValueType& Add(KeyType&& InKey) { (void)GetTypeHash(InKey); return UEStub::DeclRef<ValueType>(); }
    ValueType& Add(const TPair<KeyType, ValueType>& InKeyValue) { return ::UEStub::Fake<ValueType&>(); }
    template <typename InitKeyType = KeyType, typename InitValueType = ValueType>
    ValueType& Emplace(InitKeyType&& InKey, InitValueType&& InValue) { UEStub::CheckConstructible<KeyType>(Forward<InitKeyType>(InKey)); UEStub::CheckConstructible<ValueType>(Forward<InitValueType>(InValue)); return UEStub::DeclRef<ValueType>(); }
    template <typename InitKeyType = KeyType>
    ValueType& Emplace(InitKeyType&& InKey) { UEStub::CheckConstructible<KeyType>(Forward<InitKeyType>(InKey)); return UEStub::DeclRef<ValueType>(); }
    int32 Remove(KeyConstPointerType InKey) { (void)GetTypeHash(InKey); return 0; }
    bool RemoveAndCopyValue(KeyInitType Key, ValueType& OutRemovedValue) { return ::UEStub::Fake<bool>(); }
    ValueType FindAndRemoveChecked(KeyConstPointerType Key) { return ::UEStub::Fake<ValueType>(); }
    const KeyType* FindKey(ValueInitType Value) const { return ::UEStub::Fake<const KeyType*>(); }
    ValueType* Find(KeyConstPointerType Key) { (void)GetTypeHash(Key); return nullptr; }
    const ValueType* Find(KeyConstPointerType Key) const { (void)GetTypeHash(Key); return nullptr; }
    ValueType& FindOrAdd(const KeyType& Key) { (void)GetTypeHash(Key); return UEStub::DeclRef<ValueType>(); }
    ValueType& FindOrAdd(KeyType&& Key) { (void)GetTypeHash(Key); return UEStub::DeclRef<ValueType>(); }
    ValueType& FindOrAdd(const KeyType& Key, const ValueType& Value) { return ::UEStub::Fake<ValueType&>(); }
    ValueType& FindOrAdd(const KeyType& Key, ValueType&& Value) { return ::UEStub::Fake<ValueType&>(); }
    const ValueType& FindChecked(KeyConstPointerType Key) const { return ::UEStub::Fake<const ValueType&>(); }
    ValueType& FindChecked(KeyConstPointerType Key) { return ::UEStub::Fake<ValueType&>(); }
    ValueType FindRef(KeyConstPointerType Key) const { (void)GetTypeHash(Key); return UEStub::DeclRef<ValueType>(); }
    ValueType FindRef(KeyConstPointerType Key, ValueType DefaultValue) const { return ::UEStub::Fake<ValueType>(); }
    bool Contains(KeyConstPointerType Key) const { (void)GetTypeHash(Key); return false; }
    template <typename Predicate> TMap FilterByPredicate(Predicate Pred) const { UEStub::CheckPredicate(Pred, UEStub::DeclRef<const TPair<KeyType, ValueType>>()); return TMap(); }
    template <typename PREDICATE_CLASS> void KeySort(const PREDICATE_CLASS& Predicate) { UEStub::CheckPredicate(Predicate, UEStub::DeclRef<const KeyType>(), UEStub::DeclRef<const KeyType>()); }
    template <typename PREDICATE_CLASS> void ValueSort(const PREDICATE_CLASS& Predicate) { UEStub::CheckPredicate(Predicate, UEStub::DeclRef<const ValueType>(), UEStub::DeclRef<const ValueType>()); }
    template <typename PREDICATE_CLASS> void KeyStableSort(const PREDICATE_CLASS& Predicate) { KeySort(Predicate); }
    template <typename PREDICATE_CLASS> void ValueStableSort(const PREDICATE_CLASS& Predicate) { ValueSort(Predicate); }
    void Append(const TMap& OtherMap) {}
    void Append(TMap&& OtherMap) {}
    ValueType& operator[](KeyConstPointerType Key) { return ::UEStub::Fake<ValueType&>(); }
    const ValueType& operator[](KeyConstPointerType Key) const { return ::UEStub::Fake<const ValueType&>(); }
    template <typename Allocator> TArray<KeyType, Allocator> Array() const { return ::UEStub::Fake<TArray<KeyType, Allocator>>(); }

    class TIterator
    {
    public:
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        TIterator& operator++() { return ::UEStub::Fake<TIterator&>(); }
        ElementType& operator*() const { return ::UEStub::Fake<ElementType&>(); }
        ElementType* operator->() const { return ::UEStub::Fake<ElementType*>(); }
        const KeyType& Key() const { return ::UEStub::Fake<const KeyType&>(); }
        ValueType& Value() const { return ::UEStub::Fake<ValueType&>(); }
        void RemoveCurrent() {}
        FSetElementId GetId() const { return ::UEStub::Fake<FSetElementId>(); }
    };
    class TConstIterator
    {
    public:
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        TConstIterator& operator++() { return ::UEStub::Fake<TConstIterator&>(); }
        const ElementType& operator*() const { return ::UEStub::Fake<const ElementType&>(); }
        const ElementType* operator->() const { return ::UEStub::Fake<const ElementType*>(); }
        const KeyType& Key() const { return ::UEStub::Fake<const KeyType&>(); }
        const ValueType& Value() const { return ::UEStub::Fake<const ValueType&>(); }
        FSetElementId GetId() const { return ::UEStub::Fake<FSetElementId>(); }
    };
    class TKeyIterator : public TIterator { public: TKeyIterator(TMap& InMap, KeyInitType InKey); };
    TIterator CreateIterator() { return ::UEStub::Fake<TIterator>(); }
    TConstIterator CreateConstIterator() const { return ::UEStub::Fake<TConstIterator>(); }
    TKeyIterator CreateKeyIterator(KeyInitType InKey) { return ::UEStub::Fake<TKeyIterator>(); }
    struct TRangedIter
    {
        ElementType& operator*() const { return ::UEStub::Fake<ElementType&>(); }
        TRangedIter& operator++() { return ::UEStub::Fake<TRangedIter&>(); }
        bool operator!=(const TRangedIter&) const { return ::UEStub::Fake<bool>(); }
    };
    struct TRangedConstIter
    {
        const ElementType& operator*() const { return ::UEStub::Fake<const ElementType&>(); }
        TRangedConstIter& operator++() { return ::UEStub::Fake<TRangedConstIter&>(); }
        bool operator!=(const TRangedConstIter&) const { return ::UEStub::Fake<bool>(); }
    };
    TRangedIter begin() { return ::UEStub::Fake<TRangedIter>(); }
    TRangedIter end() { return ::UEStub::Fake<TRangedIter>(); }
    TRangedConstIter begin() const { return ::UEStub::Fake<TRangedConstIter>(); }
    TRangedConstIter end() const { return ::UEStub::Fake<TRangedConstIter>(); }
};

template <typename KeyType, typename ValueType, typename SetAllocator = FDefaultSetAllocator, typename KeyFuncs = void>
class TMultiMap : public TMap<KeyType, ValueType, SetAllocator, KeyFuncs>
{
public:
    template <typename Allocator> void MultiFind(typename TTypeTraits<KeyType>::ConstInitType Key, TArray<ValueType, Allocator>& OutValues, bool bMaintainOrder = false) const {}
    ValueType& AddUnique(const KeyType& InKey, const ValueType& InValue) { return ::UEStub::Fake<ValueType&>(); }
    int32 RemoveSingle(const KeyType& InKey, const ValueType& InValue) { return ::UEStub::Fake<int32>(); }
    int32 Num(const KeyType& Key) const { return ::UEStub::Fake<int32>(); }
    int32 Num() const { return ::UEStub::Fake<int32>(); }
};

template <typename KeyType, typename ValueType, typename ArrayAllocator = FDefaultAllocator, typename SortPredicate = TLess<KeyType>>
class TSortedMap : public TMap<KeyType, ValueType> {};

template <typename T, int Mode = 0>
class TQueue
{
public:
    bool Dequeue(T& OutItem) { return ::UEStub::Fake<bool>(); }
    void Empty() {}
    bool Enqueue(const T& Item) { return ::UEStub::Fake<bool>(); }
    bool Enqueue(T&& Item) { return ::UEStub::Fake<bool>(); }
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    bool Peek(T& OutItem) const { return ::UEStub::Fake<bool>(); }
    T* Peek() { return ::UEStub::Fake<T*>(); }
    bool Pop() { return ::UEStub::Fake<bool>(); }
};
enum class EQueueMode { Mpsc, Spsc, SingleThreaded };

// Owns heap-allocated elements; indexing and iteration yield ElementType& (Containers/IndirectArray.h).
template <typename T, typename Allocator = FDefaultAllocator>
class TIndirectArray
{
public:
    typedef T ElementType;
    struct TIterator
    {
        T& operator*() const { return ::UEStub::Fake<T&>(); }
        T* operator->() const { return ::UEStub::Fake<T*>(); }
        TIterator& operator++() { return ::UEStub::Fake<TIterator&>(); }
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        int32 GetIndex() const { return ::UEStub::Fake<int32>(); }
        void RemoveCurrent() {}
        bool operator!=(const TIterator& Rhs) const { return ::UEStub::Fake<bool>(); }
    };
    struct TConstIterator
    {
        const T& operator*() const { return ::UEStub::Fake<const T&>(); }
        const T* operator->() const { return ::UEStub::Fake<const T*>(); }
        TConstIterator& operator++() { return ::UEStub::Fake<TConstIterator&>(); }
        explicit operator bool() const { return ::UEStub::Fake<bool>(); }
        int32 GetIndex() const { return ::UEStub::Fake<int32>(); }
        bool operator!=(const TConstIterator& Rhs) const { return ::UEStub::Fake<bool>(); }
    };
    TIndirectArray() {}
    TIndirectArray(const TIndirectArray& Other) {}
    TIndirectArray(TIndirectArray&& Other) {}
    TIndirectArray& operator=(const TIndirectArray& Other) { return ::UEStub::Fake<TIndirectArray&>(); }
    TIndirectArray& operator=(TIndirectArray&& Other) { return ::UEStub::Fake<TIndirectArray&>(); }
    ~TIndirectArray() {}
    int32 Num() const { return ::UEStub::Fake<int32>(); }
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    bool IsValidIndex(int32 Index) const { return ::UEStub::Fake<bool>(); }
    T* const* GetData() const { return ::UEStub::Fake<T* const*>(); }
    T& operator[](int32 Index) { return ::UEStub::Fake<T&>(); }
    const T& operator[](int32 Index) const { return ::UEStub::Fake<const T&>(); }
    T& Last(int32 IndexFromTheEnd = 0) { return ::UEStub::Fake<T&>(); }
    const T& Last(int32 IndexFromTheEnd = 0) const { return ::UEStub::Fake<const T&>(); }
    int32 Add(T* Item) { return ::UEStub::Fake<int32>(); }
    void Insert(T* Item, int32 Index) {}
    void RemoveAt(int32 Index, int32 Count = 1, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    void RemoveAtSwap(int32 Index, int32 Count = 1, EAllowShrinking AllowShrinking = EAllowShrinking::Default) {}
    void Empty(int32 Slack = 0) {}
    void Reset(int32 NewSize = 0) {}
    void Reserve(int32 Number) {}
    TIterator CreateIterator() { return ::UEStub::Fake<TIterator>(); }
    TConstIterator CreateConstIterator() const { return ::UEStub::Fake<TConstIterator>(); }
    TIterator begin() { return ::UEStub::Fake<TIterator>(); }
    TIterator end() { return ::UEStub::Fake<TIterator>(); }
    TConstIterator begin() const { return ::UEStub::Fake<TConstIterator>(); }
    TConstIterator end() const { return ::UEStub::Fake<TConstIterator>(); }
};

class TBitArrayRef;
template <typename Allocator = FDefaultBitArrayAllocator>
class TBitArray
{
public:
    TBitArray() {}
    explicit TBitArray(bool bValue, int32 InNumBits) {}
    int32 Add(const bool Value) { return ::UEStub::Fake<int32>(); }
    void Init(bool bValue, int32 InNumBits) {}
    void SetNum(int32 InNumBits, bool bValue) {}
    int32 Num() const { return ::UEStub::Fake<int32>(); }
    bool IsValidIndex(int32 Index) const { return ::UEStub::Fake<bool>(); }
    void Empty(int32 ExpectedNumBits = 0) {}
    void Reset() {}
    int32 Find(bool bValue) const { return ::UEStub::Fake<int32>(); }
    bool Contains(bool bValue) const { return ::UEStub::Fake<bool>(); }
    int32 CountSetBits(int32 FromIndex = 0, int32 ToIndex = INDEX_NONE) const { return ::UEStub::Fake<int32>(); }
    struct FBitReference { operator bool() const; void operator=(const bool NewValue); };
    FBitReference operator[](int32 Index) { return ::UEStub::Fake<FBitReference>(); }
    bool operator[](int32 Index) const { return ::UEStub::Fake<bool>(); }
};
using FBitArray = TBitArray<>;
