// Offline UE 5.x API stub: Async/Future.h
#pragma once
#include "CoreMinimal.h"
template <typename ResultType> class TFuture;
template <typename ResultType> class TSharedFuture;
template <typename ResultType>
class TFuture
{
public:
    TFuture();
    TFuture(TFuture&&);
    TFuture& operator=(TFuture&&);
    TFuture(const TFuture&) = delete;
    ~TFuture();
    std::conditional_t<std::is_void_v<ResultType>, void, const ResultType&> Get() const;
    ResultType Consume();
    bool IsReady() const;
    bool IsValid() const;
    void Wait() const;
    bool WaitFor(const FTimespan& Duration) const;
    void Reset();
    TSharedFuture<ResultType> Share();
    template <typename FuncType> auto Then(FuncType&& Continuation)
    { (void)sizeof(Continuation); return TFuture<decltype(Continuation(UEStub::DeclRef<TFuture<ResultType>>()))>(); }
    template <typename FuncType> auto Next(FuncType&& Continuation);
};
template <typename ResultType>
class TSharedFuture
{
public:
    TSharedFuture();
    std::conditional_t<std::is_void_v<ResultType>, void, const ResultType&> Get() const;
    bool IsReady() const;
    bool IsValid() const;
    void Wait() const;
};
template <typename ResultType>
class TPromise
{
public:
    TPromise();
    template <typename CompletionCallbackType> explicit TPromise(CompletionCallbackType&& CompletionCallback) {}
    TPromise(TPromise&&);
    TPromise& operator=(TPromise&&);
    ~TPromise();
    TFuture<ResultType> GetFuture();
    void SetValue(const ResultType& Result);
    void SetValue(ResultType&& Result);
    void EmplaceValue(ResultType&& Result);
};
template <>
class TPromise<void>
{
public:
    TPromise();
    TPromise(TPromise&&);
    ~TPromise();
    TFuture<void> GetFuture();
    void SetValue();
    void EmplaceValue();
};
template <typename ResultType> TFuture<ResultType> MakeFulfilledPromise(ResultType Result);
