// Offline UE 5.x API stub: ProfilingDebugging/CsvProfiler.h (Core)
//
// Written from memory of UE 5.x for the NORD mobile gauntlet; not checked against Epic's header (unverified).
// It declares the capture control the game calls from code (Get, BeginCapture, EndCapture, IsCapturing) and the
// event and metadata macros. CSV_PROFILER is 0 in Shipping, where FCsvProfiler does not exist and the macros are empty.
#pragma once
#include "CoreMinimal.h"
#include "Async/Future.h"
#include "Async/TaskGraphInterfaces.h"

#ifndef CSV_PROFILER
#define CSV_PROFILER (WITH_ENGINE && !UE_BUILD_SHIPPING)
#endif

#if CSV_PROFILER
enum class ECsvProfilerFlags : uint32
{
    None = 0,
    WriteCompletionFile = 1,
    CompressOutput = 2,
};
ENUM_CLASS_FLAGS(ECsvProfilerFlags)

#define CSV_CATEGORY_INDEX_GLOBAL (0)

class FCsvProfiler
{
public:
    static FCsvProfiler* Get();
    // InNumFramesToCapture -1 captures until EndCapture. An empty folder means Saved/Profiling/CSV.
    void BeginCapture(int InNumFramesToCapture = -1, const FString& InDestFolder = FString(), const FString& InFilename = FString(),
        ECsvProfilerFlags InFlags = ECsvProfilerFlags::None);
    // The future holds the written file's path once the writer thread has finished.
    TSharedFuture<FString> EndCapture(FGraphEventRef EventToSignal = nullptr);
    bool IsCapturing() const;
    bool IsWritingFile();
    int32 GetCaptureFrameNumber();
    static void RecordEvent(int32 CategoryIndex, const FString& EventText);
    template <typename... Types>
    static void RecordEventf(int32 CategoryIndex, UEStub::Fmt::TFormatString<std::type_identity_t<Types>...> Fmt, Types... Args) {}
    static void SetMetadata(const TCHAR* Key, const TCHAR* Value);
};

#define CSV_EVENT_GLOBAL(Format, ...) FCsvProfiler::RecordEventf(CSV_CATEGORY_INDEX_GLOBAL, Format __VA_OPT__(,) __VA_ARGS__)
#define CSV_METADATA(Key, Value) FCsvProfiler::SetMetadata(Key, Value)
#else
#define CSV_EVENT_GLOBAL(Format, ...)
#define CSV_METADATA(Key, Value)
#endif
