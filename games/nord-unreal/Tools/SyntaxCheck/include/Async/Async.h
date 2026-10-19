// Offline UE 5.x API stub: Async/Async.h
#pragma once
#include "CoreMinimal.h"
#include "Async/Future.h"
#include "Async/TaskGraphInterfaces.h"
enum class EAsyncExecution { TaskGraph, TaskGraphMainThread, TaskGraphMainTick, Thread, ThreadIfForkSafe, ThreadPool, LargeThreadPool };
template <typename CallableType>
auto Async(EAsyncExecution Execution, CallableType&& Callable, TUniqueFunction<void()> CompletionCallback = nullptr) -> TFuture<decltype(Forward<CallableType>(Callable)())>
{ return TFuture<decltype(Forward<CallableType>(Callable)())>(); }
template <typename CallableType>
auto AsyncThread(CallableType&& Callable, uint32 StackSize = 0, EThreadPriority ThreadPri = TPri_Normal, TUniqueFunction<void()> CompletionCallback = nullptr) -> TFuture<decltype(Forward<CallableType>(Callable)())>
{ return TFuture<decltype(Forward<CallableType>(Callable)())>(); }
void AsyncTask(ENamedThreads::Type Thread, TUniqueFunction<void()> Function);
