// Offline UE 5.x API stub: TWeakObjectPtr (declared in Core, usable once UObject types are complete).
#pragma once
#include "UEStub/Strings.h"

class UObject;
template <typename T> class TObjectPtr;

struct FWeakObjectPtr
{
    FWeakObjectPtr();
    FWeakObjectPtr(TYPE_OF_NULLPTR);
    FWeakObjectPtr(const UObject* Object);
    UObject* Get() const;
    UObject* Get(bool bEvenIfPendingKill) const;
    bool IsValid() const;
    bool IsValid(bool bEvenIfPendingKill, bool bThreadsafeTest = false) const;
    bool IsStale(bool bIncludingIfPendingKill = true, bool bThreadsafeTest = false) const;
    void Reset();
    bool operator==(const FWeakObjectPtr& Other) const;
};

template <class T, class TWeakObjectPtrBase = FWeakObjectPtr>
class TWeakObjectPtr
{
public:
    using ElementType = T;
    TWeakObjectPtr() = default;
    TWeakObjectPtr(const TWeakObjectPtr&) = default;
    TWeakObjectPtr& operator=(const TWeakObjectPtr&) = default;
    TWeakObjectPtr(TYPE_OF_NULLPTR) {}
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0>
    TWeakObjectPtr(U* Object)
    { static_assert(std::is_base_of_v<UObject, std::remove_cv_t<T>> || std::is_same_v<std::remove_cv_t<T>, UObject>, "TWeakObjectPtr can only be constructed with UObject types"); }
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0>
    TWeakObjectPtr(const TObjectPtr<U>& Object) {}
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*> && !std::is_same_v<U, T>, int> = 0>
    TWeakObjectPtr(const TWeakObjectPtr<U>& Other) {}
    TWeakObjectPtr& operator=(TYPE_OF_NULLPTR) { return *this; }
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0>
    TWeakObjectPtr& operator=(U* Object)
    { static_assert(std::is_base_of_v<UObject, std::remove_cv_t<T>> || std::is_same_v<std::remove_cv_t<T>, UObject>, "TWeakObjectPtr can only be constructed with UObject types"); return *this; }
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0>
    TWeakObjectPtr& operator=(const TObjectPtr<U>& Object) { return *this; }
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*> && !std::is_same_v<U, T>, int> = 0>
    TWeakObjectPtr& operator=(const TWeakObjectPtr<U>& Other) { return *this; }

    void Reset() {}
    T* Get(bool bEvenIfPendingKill) const { return ::UEStub::Fake<T*>(); }
    T* Get() const { return ::UEStub::Fake<T*>(); }
    TObjectPtr<T> Pin() const { return ::UEStub::Fake<TObjectPtr<T>>(); }
    T* GetEvenIfUnreachable() const { return ::UEStub::Fake<T*>(); }
    T& operator*() const { return ::UEStub::Fake<T&>(); }
    T* operator->() const { return ::UEStub::Fake<T*>(); }
    bool IsValid(bool bEvenIfPendingKill, bool bThreadsafeTest = false) const { return ::UEStub::Fake<bool>(); }
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    bool IsStale(bool bIncludingIfPendingKill = true, bool bThreadsafeTest = false) const { return ::UEStub::Fake<bool>(); }
    bool HasSameIndexAndSerialNumber(const TWeakObjectPtr& Other) const { return ::UEStub::Fake<bool>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }

    template <typename U> bool operator==(const TWeakObjectPtr<U>& Rhs) const { return Get() == Rhs.Get(); }
    template <typename U, std::enable_if_t<!std::is_same_v<std::remove_cv_t<U>, TWeakObjectPtr>, int> = 0>
    bool operator==(U* Rhs) const { return Get() == Rhs; }
    bool operator==(TYPE_OF_NULLPTR) const { return !IsValid(); }
};
template <class T> uint32 GetTypeHash(const TWeakObjectPtr<T>& WeakObjectPtr) { return ::UEStub::Fake<uint32>(); }
uint32 GetTypeHash(const FWeakObjectPtr& WeakObjectPtr);
template <class T> TWeakObjectPtr<T> MakeWeakObjectPtr(T* Object) { return ::UEStub::Fake<TWeakObjectPtr<T>>(); }
