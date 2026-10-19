// Offline UE 5.x API stub: Async/ParallelFor.h
#pragma once
#include "CoreMinimal.h"
enum class EParallelForFlags { None = 0, ForceSingleThread = 1, Unbalanced = 2, PumpRenderingThread = 4, BackgroundPriority = 8 };
ENUM_CLASS_FLAGS(EParallelForFlags);
void ParallelFor(int32 Num, TFunctionRef<void(int32)> Body, bool bForceSingleThread, bool bPumpRenderingThread = false);
void ParallelFor(int32 Num, TFunctionRef<void(int32)> Body, EParallelForFlags Flags = EParallelForFlags::None);
void ParallelFor(const TCHAR* DebugName, int32 Num, int32 MinBatchSize, TFunctionRef<void(int32)> Body, EParallelForFlags Flags = EParallelForFlags::None);
template <typename ContextType, typename ContextConstructorType, typename BodyType>
void ParallelForWithTaskContext(TArray<ContextType>& OutContexts, int32 Num, const ContextConstructorType& ContextConstructor, const BodyType& Body, EParallelForFlags Flags = EParallelForFlags::None)
{ (void)sizeof(decltype(Body(UEStub::DeclRef<ContextType>(), int32()))*); }
