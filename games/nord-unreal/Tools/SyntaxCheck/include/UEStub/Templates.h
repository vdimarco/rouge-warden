// Offline UE 5.x API stub: function objects, smart pointers, tuples, optional, numeric limits.
#pragma once
#include "UEStub/CoreTypes.h"
#include <functional>
#include <atomic>
#include <limits>
#include <tuple>

// ---------------------------------------------------------------- Invoke
template <typename FuncType, typename... ArgTypes>
auto Invoke(FuncType&& Func, ArgTypes&&... Args) -> decltype(std::invoke(Forward<FuncType>(Func), Forward<ArgTypes>(Args)...))
{ return std::invoke(Forward<FuncType>(Func), Forward<ArgTypes>(Args)...); }

// ---------------------------------------------------------------- TFunction family
template <typename FuncType> class TFunction;
template <typename Ret, typename... Params>
class TFunction<Ret(Params...)>
{
public:
    TFunction(TYPE_OF_NULLPTR = nullptr) {}
    template <typename FunctorType, std::enable_if_t<!std::is_same_v<std::decay_t<FunctorType>, TFunction> && std::is_invocable_r_v<Ret, std::decay_t<FunctorType>&, Params...>, int> = 0>
    // Copyability of the functor is deliberately not checked: Quebec.cpp passes a move-only lambda to
    // FTSTicker::AddTicker(TFunction) and a UE 5.8 LinuxEditor automation run shows that file compiled.
    TFunction(FunctorType&& InFunc) {}
    TFunction(const TFunction&) {}
    TFunction(TFunction&&) {}
    TFunction& operator=(const TFunction&) { return ::UEStub::Fake<TFunction&>(); }
    TFunction& operator=(TFunction&&) { return ::UEStub::Fake<TFunction&>(); }
    ~TFunction() {}
    void Reset() {}
    Ret operator()(Params... Args) const { return ::UEStub::Fake<Ret>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    bool IsSet() const { return ::UEStub::Fake<bool>(); }
    friend bool operator==(TYPE_OF_NULLPTR, const TFunction& Func) { return !Func; }
    friend bool operator==(const TFunction& Func, TYPE_OF_NULLPTR) { return !Func; }
};
template <typename FuncType> class TUniqueFunction;
template <typename Ret, typename... Params>
class TUniqueFunction<Ret(Params...)>
{
public:
    TUniqueFunction(TYPE_OF_NULLPTR = nullptr) {}
    template <typename FunctorType, std::enable_if_t<!std::is_same_v<std::decay_t<FunctorType>, TUniqueFunction> && std::is_invocable_r_v<Ret, std::decay_t<FunctorType>&, Params...>, int> = 0>
    TUniqueFunction(FunctorType&& InFunc) {}
    TUniqueFunction(TFunction<Ret(Params...)>&& Other) {}
    TUniqueFunction(const TUniqueFunction&) = delete;
    TUniqueFunction(TUniqueFunction&&) {}
    TUniqueFunction& operator=(TUniqueFunction&&) { return ::UEStub::Fake<TUniqueFunction&>(); }
    ~TUniqueFunction() {}
    void Reset() {}
    Ret operator()(Params... Args) const { return ::UEStub::Fake<Ret>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    bool IsSet() const { return ::UEStub::Fake<bool>(); }
};
template <typename FuncType> class TFunctionRef;
template <typename Ret, typename... Params>
class TFunctionRef<Ret(Params...)>
{
public:
    template <typename FunctorType, std::enable_if_t<!std::is_same_v<std::decay_t<FunctorType>, TFunctionRef> && std::is_invocable_r_v<Ret, std::decay_t<FunctorType>&, Params...>, int> = 0>
    TFunctionRef(FunctorType&& InFunc) {}
    TFunctionRef(const TFunctionRef&) {}
    TFunctionRef& operator=(const TFunctionRef&) = delete;
    Ret operator()(Params... Args) const { return ::UEStub::Fake<Ret>(); }
};

// ---------------------------------------------------------------- shared pointers
enum class ESPMode : uint8 { NotThreadSafe = 0, ThreadSafe = 1 };
template <class ObjectType, ESPMode Mode = ESPMode::ThreadSafe> class TSharedRef;
template <class ObjectType, ESPMode Mode = ESPMode::ThreadSafe> class TSharedPtr;
template <class ObjectType, ESPMode Mode = ESPMode::ThreadSafe> class TWeakPtr;
template <class ObjectType, ESPMode Mode = ESPMode::ThreadSafe> class TSharedFromThis;

template <class ObjectType, ESPMode Mode>
class TSharedRef
{
public:
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    explicit TSharedRef(OtherType* InObject) {}
    TSharedRef(const TSharedRef&) {}
    TSharedRef(TSharedRef&&) {}
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    TSharedRef(const TSharedRef<OtherType, Mode>& Other) {}
    TSharedRef& operator=(const TSharedRef&) { return ::UEStub::Fake<TSharedRef&>(); }
    TSharedRef& operator=(TSharedRef&&) { return ::UEStub::Fake<TSharedRef&>(); }
    ObjectType& Get() const { return ::UEStub::Fake<ObjectType&>(); }
    ObjectType& operator*() const { return ::UEStub::Fake<ObjectType&>(); }
    ObjectType* operator->() const { return ::UEStub::Fake<ObjectType*>(); }
    TSharedPtr<ObjectType, Mode> ToSharedPtr() const { return ::UEStub::Fake<TSharedPtr<ObjectType, Mode>>(); }
    TWeakPtr<ObjectType, Mode> ToWeakPtr() const { return ::UEStub::Fake<TWeakPtr<ObjectType, Mode>>(); }
    int32 GetSharedReferenceCount() const { return ::UEStub::Fake<int32>(); }
    bool IsUnique() const { return ::UEStub::Fake<bool>(); }
    bool IsValid() const { return true; }
    template <class OtherType> bool operator==(const TSharedRef<OtherType, Mode>& Other) const { return &Get() == &Other.Get(); }
};

template <class ObjectType, ESPMode Mode>
class TSharedPtr
{
public:
    TSharedPtr(TYPE_OF_NULLPTR = nullptr) {}
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    explicit TSharedPtr(OtherType* InObject) {}
    TSharedPtr(const TSharedPtr&) {}
    TSharedPtr(TSharedPtr&&) {}
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    TSharedPtr(const TSharedPtr<OtherType, Mode>& Other) {}
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    TSharedPtr(const TSharedRef<OtherType, Mode>& Other) {}
    TSharedPtr& operator=(const TSharedPtr&) { return ::UEStub::Fake<TSharedPtr&>(); }
    TSharedPtr& operator=(TSharedPtr&&) { return ::UEStub::Fake<TSharedPtr&>(); }
    TSharedPtr& operator=(TYPE_OF_NULLPTR) { return ::UEStub::Fake<TSharedPtr&>(); }
    ObjectType* Get() const { return ::UEStub::Fake<ObjectType*>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    ObjectType& operator*() const { return ::UEStub::Fake<ObjectType&>(); }
    ObjectType* operator->() const { return ::UEStub::Fake<ObjectType*>(); }
    void Reset() {}
    TSharedRef<ObjectType, Mode> ToSharedRef() const { return ::UEStub::Fake<TSharedRef<ObjectType, Mode>>(); }
    TWeakPtr<ObjectType, Mode> ToWeakPtr() const { return ::UEStub::Fake<TWeakPtr<ObjectType, Mode>>(); }
    int32 GetSharedReferenceCount() const { return ::UEStub::Fake<int32>(); }
    bool IsUnique() const { return ::UEStub::Fake<bool>(); }
    template <class OtherType> bool operator==(const TSharedPtr<OtherType, Mode>& Other) const { return Get() == Other.Get(); }
    bool operator==(TYPE_OF_NULLPTR) const { return !IsValid(); }
};

template <class ObjectType, ESPMode Mode>
class TWeakPtr
{
public:
    TWeakPtr(TYPE_OF_NULLPTR = nullptr) {}
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    TWeakPtr(const TSharedPtr<OtherType, Mode>& Other) {}
    template <class OtherType, std::enable_if_t<std::is_convertible_v<OtherType*, ObjectType*>, int> = 0>
    TWeakPtr(const TSharedRef<OtherType, Mode>& Other) {}
    TWeakPtr(const TWeakPtr&) {}
    TWeakPtr& operator=(const TWeakPtr&) { return ::UEStub::Fake<TWeakPtr&>(); }
    TSharedPtr<ObjectType, Mode> Pin() const { return ::UEStub::Fake<TSharedPtr<ObjectType, Mode>>(); }
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    void Reset() {}
    bool HasSameObject(const void* InOtherPtr) const { return ::UEStub::Fake<bool>(); }
};

template <class ObjectType, ESPMode Mode>
class TSharedFromThis
{
public:
    TSharedRef<ObjectType, Mode> AsShared() { return ::UEStub::Fake<TSharedRef<ObjectType, Mode>>(); }
    TSharedRef<ObjectType const, Mode> AsShared() const { return ::UEStub::Fake<TSharedRef<ObjectType const, Mode>>(); }
    TWeakPtr<ObjectType, Mode> AsWeak() { return ::UEStub::Fake<TWeakPtr<ObjectType, Mode>>(); }
    bool DoesSharedInstanceExist() const { return ::UEStub::Fake<bool>(); }
protected:
    TSharedFromThis() = default;
    TSharedFromThis(const TSharedFromThis&) {}
    TSharedFromThis& operator=(const TSharedFromThis&) { return *this; }
    ~TSharedFromThis() = default;
};

template <typename T> struct TRawPtrProxy { T* Object; };
template <class ObjectType> TRawPtrProxy<ObjectType> MakeShareable(ObjectType* InObject) { return ::UEStub::Fake<TRawPtrProxy<ObjectType>>(); }
template <typename InObjectType, ESPMode InMode = ESPMode::ThreadSafe, typename... InArgTypes>
TSharedRef<InObjectType, InMode> MakeShared(InArgTypes&&... Args)
{
    static_assert(std::is_constructible_v<InObjectType, InArgTypes&&...>, "MakeShared: object is not constructible from these arguments");
    return UEStub::DeclRef<TSharedRef<InObjectType, InMode>>();
}
template <class CastToType, class CastFromType, ESPMode Mode>
TSharedPtr<CastToType, Mode> StaticCastSharedPtr(TSharedPtr<CastFromType, Mode> const& InSharedPtr);
template <class CastToType, class CastFromType, ESPMode Mode>
TSharedRef<CastToType, Mode> StaticCastSharedRef(TSharedRef<CastFromType, Mode> const& InSharedRef);
template <class CastToType, class CastFromType, ESPMode Mode>
TSharedPtr<CastToType, Mode> ConstCastSharedPtr(TSharedPtr<CastFromType, Mode> const& InSharedPtr);

// ---------------------------------------------------------------- unique pointers
template <typename T> struct TDefaultDelete { void operator()(T* Ptr) const; };
template <typename T, typename Deleter = TDefaultDelete<T>>
class TUniquePtr
{
public:
    TUniquePtr(TYPE_OF_NULLPTR = nullptr) {}
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0> explicit TUniquePtr(U* InPtr) {}
    TUniquePtr(const TUniquePtr&) = delete;
    TUniquePtr& operator=(const TUniquePtr&) = delete;
    TUniquePtr(TUniquePtr&& Other) {}
    template <typename U, typename D, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0> TUniquePtr(TUniquePtr<U, D>&& Other) {}
    TUniquePtr& operator=(TUniquePtr&& Other) { return ::UEStub::Fake<TUniquePtr&>(); }
    TUniquePtr& operator=(TYPE_OF_NULLPTR) { return ::UEStub::Fake<TUniquePtr&>(); }
    ~TUniquePtr() {}
    T* Get() const { return ::UEStub::Fake<T*>(); }
    T* Release() { return ::UEStub::Fake<T*>(); }
    void Reset(T* InPtr = nullptr) {}
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    T* operator->() const { return ::UEStub::Fake<T*>(); }
    T& operator*() const { return ::UEStub::Fake<T&>(); }
};
template <typename T, typename... TArgs>
TUniquePtr<T> MakeUnique(TArgs&&... Args)
{
    static_assert(std::is_constructible_v<T, TArgs&&...>, "MakeUnique: object is not constructible from these arguments");
    return TUniquePtr<T>();
}

// ---------------------------------------------------------------- optional
struct FNullOpt { explicit constexpr FNullOpt(int) {} };
constexpr FNullOpt NullOpt{0};
template <typename OptionalType>
class TOptional
{
public:
    TOptional() {}
    TOptional(FNullOpt) {}
    TOptional(const OptionalType& InValue) {}
    TOptional(OptionalType&& InValue) {}
    template <typename... ArgTypes> explicit TOptional(EInPlace, ArgTypes&&... Args) {}
    TOptional(const TOptional&) {}
    TOptional(TOptional&&) {}
    TOptional& operator=(const TOptional&) { return ::UEStub::Fake<TOptional&>(); }
    TOptional& operator=(TOptional&&) { return ::UEStub::Fake<TOptional&>(); }
    TOptional& operator=(const OptionalType& InValue) { return ::UEStub::Fake<TOptional&>(); }
    TOptional& operator=(OptionalType&& InValue) { return ::UEStub::Fake<TOptional&>(); }
    ~TOptional() {}
    template <typename... ArgsType> OptionalType& Emplace(ArgsType&&... Args) { return ::UEStub::Fake<OptionalType&>(); }
    void Reset() {}
    bool IsSet() const { return ::UEStub::Fake<bool>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    OptionalType& GetValue() { return ::UEStub::Fake<OptionalType&>(); }
    const OptionalType& GetValue() const { return ::UEStub::Fake<const OptionalType&>(); }
    const OptionalType& Get(const OptionalType& DefaultValue) const { return ::UEStub::Fake<const OptionalType&>(); }
    OptionalType* GetPtrOrNull() { return ::UEStub::Fake<OptionalType*>(); }
    const OptionalType* GetPtrOrNull() const { return ::UEStub::Fake<const OptionalType*>(); }
    OptionalType* operator->() { return ::UEStub::Fake<OptionalType*>(); }
    const OptionalType* operator->() const { return ::UEStub::Fake<const OptionalType*>(); }
    OptionalType& operator*() { return ::UEStub::Fake<OptionalType&>(); }
    const OptionalType& operator*() const { return ::UEStub::Fake<const OptionalType&>(); }
    friend bool operator==(const TOptional& L, const TOptional& R) { return L.IsSet() == R.IsSet(); }
};
template <typename T> TOptional<std::decay_t<T>> MakeOptional(T&& Value) { return ::UEStub::Fake<TOptional<std::decay_t<T>>>(); }

// ---------------------------------------------------------------- tuples and pairs
template <typename... Types>
class TTuple : public std::tuple<Types...>
{
public:
    using std::tuple<Types...>::tuple;
    TTuple() = default;
    template <int32 Index> decltype(auto) Get() & { return std::get<Index>(static_cast<std::tuple<Types...>&>(*this)); }
    template <int32 Index> decltype(auto) Get() const & { return std::get<Index>(static_cast<const std::tuple<Types...>&>(*this)); }
    template <typename FuncType> decltype(auto) ApplyAfter(FuncType&& Func) const { return std::apply(Func, static_cast<const std::tuple<Types...>&>(*this)); }
};
template <typename KeyType, typename ValueType>
class TTuple<KeyType, ValueType>
{
public:
    KeyType Key;
    ValueType Value;
    TTuple() = default;
    template <typename K, typename V, std::enable_if_t<std::is_constructible_v<KeyType, K&&> && std::is_constructible_v<ValueType, V&&>, int> = 0>
    TTuple(K&& InKey, V&& InValue) : Key(Forward<K>(InKey)), Value(Forward<V>(InValue)) {}
    template <int32 Index> auto& Get() & { if constexpr (Index == 0) return Key; else return Value; }
    template <int32 Index> const auto& Get() const & { if constexpr (Index == 0) return Key; else return Value; }
    friend bool operator==(const TTuple& A, const TTuple& B) { return A.Key == B.Key && A.Value == B.Value; }
};
template <typename KeyType, typename ValueType> using TPair = TTuple<KeyType, ValueType>;
template <typename... Types> TTuple<std::decay_t<Types>...> MakeTuple(Types&&... Args) { return ::UEStub::Fake<TTuple<std::decay_t<Types>...>>(); }
template <typename... Types> TTuple<Types&...> Tie(Types&... Args) { return ::UEStub::Fake<TTuple<Types&...>>(); }
template <typename K, typename V> TPair<std::decay_t<K>, std::decay_t<V>> MakePair(K&& Key, V&& Value) { return ::UEStub::Fake<TPair<std::decay_t<K>, std::decay_t<V>>>(); }
template <typename KeyType, typename ValueType> struct TKeyValuePair { KeyType Key; ValueType Value; TKeyValuePair() = default; TKeyValuePair(const KeyType& InKey, const ValueType& InValue) : Key(InKey), Value(InValue) {} };

// ---------------------------------------------------------------- numeric limits
template <typename NumericType> struct TNumericLimits
{
    static constexpr NumericType Min() { return std::numeric_limits<NumericType>::is_integer ? std::numeric_limits<NumericType>::min() : std::numeric_limits<NumericType>::min(); }
    static constexpr NumericType Max() { return std::numeric_limits<NumericType>::max(); }
    static constexpr NumericType Lowest() { return std::numeric_limits<NumericType>::lowest(); }
};

// ---------------------------------------------------------------- TEnumAsByte
template <class TEnum>
class TEnumAsByte
{
    static_assert(std::is_enum_v<TEnum> && std::is_convertible_v<TEnum, int>, "TEnumAsByte is not intended for use with enum classes - please derive your enum class from uint8 instead.");
public:
    typedef TEnum EnumType;
    TEnumAsByte() = default;
    TEnumAsByte(const TEnumAsByte&) = default;
    TEnumAsByte& operator=(const TEnumAsByte&) = default;
    constexpr TEnumAsByte(TEnum InValue) : Value(static_cast<uint8>(InValue)) {}
    explicit constexpr TEnumAsByte(int32 InValue) : Value(static_cast<uint8>(InValue)) {}
    explicit constexpr TEnumAsByte(uint8 InValue) : Value(InValue) {}
    bool operator==(TEnum InValue) const { return static_cast<TEnum>(Value) == InValue; }
    bool operator==(TEnumAsByte InValue) const { return Value == InValue.Value; }
    operator TEnum() const { return (TEnum)Value; }
    TEnum GetValue() const { return (TEnum)Value; }
    uint8 GetIntValue() const { return Value; }
private:
    uint8 Value;
};
template <typename T> struct TIsEnumAsByte { enum { Value = false }; };
template <typename T> struct TIsEnumAsByte<TEnumAsByte<T>> { enum { Value = true }; };

// ---------------------------------------------------------------- misc helpers
template <typename RefType, typename AssignedType = RefType>
struct TGuardValue
{
    TGuardValue(RefType& ReferenceValue, const AssignedType& NewValue) {}
    ~TGuardValue() {}
    TGuardValue(const TGuardValue&) = delete;
    TGuardValue& operator=(const TGuardValue&) = delete;
};
template <typename T> using TAtomic = std::atomic<T>;
class FCriticalSection { public: void Lock(); void Unlock(); bool TryLock(); };
class FScopeLock { public: explicit FScopeLock(FCriticalSection* InSynchObject); ~FScopeLock(); FScopeLock(const FScopeLock&) = delete; };
class FRWLock { public: void ReadLock(); void WriteLock(); void ReadUnlock(); void WriteUnlock(); };
template <typename T> struct TLess { template <typename A, typename B> bool operator()(const A& L, const B& R) const { return L < R; } };
template <typename T = void> struct TGreater { template <typename A, typename B> bool operator()(const A& L, const B& R) const { return R < L; } };
template <typename T = void> struct TEqualTo { template <typename A, typename B> bool operator()(const A& L, const B& R) const { return L == R; } };
template <typename T> constexpr T&& DeclVal() { return ::UEStub::Fake<T&&>(); }

namespace UEStub
{
    // Helper used by sort/predicate templates: UE dereferences pointer elements before calling predicates.
    template <typename T> struct TDerefWrap { static T& Get(T& V) { return V; } };
    template <typename T> struct TDerefWrap<T*> { static T& Get(T*& V) { return *V; } };
    template <typename T> struct TDerefWrap<T* const> { static T& Get(T* const& V) { return *V; } };
}

// Hashing helpers
inline constexpr uint32 GetTypeHash(const uint8 A) { return A; }
inline constexpr uint32 GetTypeHash(const int8 A) { return (uint32)A; }
inline constexpr uint32 GetTypeHash(const uint16 A) { return A; }
inline constexpr uint32 GetTypeHash(const int16 A) { return (uint32)A; }
inline constexpr uint32 GetTypeHash(const int32 A) { return (uint32)A; }
inline constexpr uint32 GetTypeHash(const uint32 A) { return A; }
inline constexpr uint32 GetTypeHash(const uint64 A) { return (uint32)A + ((uint32)(A >> 32) * 23); }
inline constexpr uint32 GetTypeHash(const int64 A) { return GetTypeHash((uint64)A); }
inline constexpr uint32 GetTypeHash(const long A) { return GetTypeHash((uint64)A); }
inline constexpr uint32 GetTypeHash(const unsigned long A) { return GetTypeHash((uint64)A); }
uint32 GetTypeHash(float Value);
uint32 GetTypeHash(double Value);
uint32 GetTypeHash(const void* A);
uint32 GetTypeHash(void* A);
inline constexpr uint32 GetTypeHash(const char16_t A) { return A; }
inline constexpr uint32 GetTypeHash(const char A) { return (uint32)A; }
inline constexpr uint32 GetTypeHash(const bool A) { return A; }
template <typename EnumType, std::enable_if_t<std::is_enum_v<EnumType>, int> = 0>
inline constexpr uint32 GetTypeHash(EnumType E) { return (uint32)E; }
template <typename T> inline uint32 GetTypeHash(T* const& P) { return GetTypeHash((const void*)P); }
inline constexpr uint32 HashCombine(uint32 A, uint32 C) { return A ^ (C + 0x9e3779b9 + (A << 6) + (A >> 2)); }
inline constexpr uint32 HashCombineFast(uint32 A, uint32 B) { return A ^ (B + 0x9e3779b9 + (A << 6) + (A >> 2)); }
uint32 PointerHash(const void* Key);
