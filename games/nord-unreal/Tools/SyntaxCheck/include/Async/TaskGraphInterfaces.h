// Offline UE 5.x API stub: Async/TaskGraphInterfaces.h (named threads)
#pragma once
#include "CoreMinimal.h"
namespace ENamedThreads
{
    enum Type : int32
    {
        UnusedAnchor = -1,
        RHIThread,
        GameThread,
        ActualRenderingThread,
        AnyThread = 0xff,
        MainQueue = 0x000,
        LocalQueue = 0x100,
        NumQueues = 2,
        HighThreadPriority = 0x000,
        NormalThreadPriority = 0x200,
        BackgroundThreadPriority = 0x400,
        NormalTaskPriority = 0x000,
        HighTaskPriority = 0x800,
        AnyHiPriThreadNormalTask = AnyThread | HighThreadPriority | NormalTaskPriority,
        AnyHiPriThreadHiPriTask = AnyThread | HighThreadPriority | HighTaskPriority,
        AnyNormalThreadNormalTask = AnyThread | NormalThreadPriority | NormalTaskPriority,
        AnyNormalThreadHiPriTask = AnyThread | NormalThreadPriority | HighTaskPriority,
        AnyBackgroundThreadNormalTask = AnyThread | BackgroundThreadPriority | NormalTaskPriority,
        AnyBackgroundHiPriTask = AnyThread | BackgroundThreadPriority | HighTaskPriority,
        GameThread_Local = GameThread | LocalQueue,
    };
}
