// Offline UE 5.x API stub: logging, stats macros, platform time, globals, misc core types.
#pragma once
#include "UEStub/Math.h"
#include "UEStub/Delegates.h"

// ---------------------------------------------------------------- verbosity
namespace ELogVerbosity
{
    enum Type : uint8 { NoLogging = 0, Fatal, Error, Warning, Display, Log, Verbose, VeryVerbose, All = VeryVerbose, NumVerbosity, VerbosityMask = 0xf, SetColor = 0x40, BreakOnLog = 0x80 };
}
struct FLogCategoryBase
{
    FLogCategoryBase(const TCHAR* CategoryName, ELogVerbosity::Type InDefaultVerbosity, ELogVerbosity::Type InCompileTimeVerbosity);
    bool IsSuppressed(ELogVerbosity::Type VerbosityLevel) const;
    FName GetCategoryName() const;
    ELogVerbosity::Type GetVerbosity() const;
    void SetVerbosity(ELogVerbosity::Type Verbosity);
};
template <ELogVerbosity::Type InDefaultVerbosity, ELogVerbosity::Type InCompileTimeVerbosity>
struct FLogCategory : public FLogCategoryBase
{
    static constexpr ELogVerbosity::Type CompileTimeVerbosity = InCompileTimeVerbosity;
    explicit FLogCategory(const TCHAR* InCategoryName) : FLogCategoryBase(InCategoryName, InDefaultVerbosity, InCompileTimeVerbosity) {}
};
class FNoLoggingCategory {};

#define DECLARE_LOG_CATEGORY_EXTERN(CategoryName, DefaultVerbosity, CompileTimeVerbosity) \
    extern struct FLogCategory##CategoryName : public FLogCategory<ELogVerbosity::DefaultVerbosity, ELogVerbosity::CompileTimeVerbosity> \
    { FORCEINLINE FLogCategory##CategoryName() : FLogCategory(TEXT(#CategoryName)) {} } CategoryName;
#define DEFINE_LOG_CATEGORY(CategoryName) FLogCategory##CategoryName CategoryName;
#define DEFINE_LOG_CATEGORY_STATIC(CategoryName, DefaultVerbosity, CompileTimeVerbosity) \
    static struct FLogCategory##CategoryName : public FLogCategory<ELogVerbosity::DefaultVerbosity, ELogVerbosity::CompileTimeVerbosity> \
    { FORCEINLINE FLogCategory##CategoryName() : FLogCategory(TEXT(#CategoryName)) {} } CategoryName;
#define DECLARE_LOG_CATEGORY_CLASS(CategoryName, DefaultVerbosity, CompileTimeVerbosity) \
    DEFINE_LOG_CATEGORY_STATIC(CategoryName, DefaultVerbosity, CompileTimeVerbosity)
#define DEFINE_LOG_CATEGORY_CLASS(Class, CategoryName)

CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogTemp, Log, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogHAL, Log, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogCore, Log, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogInit, Log, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogExit, Log, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogStreaming, Display, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogOutputDevice, Log, All);
CORE_API DECLARE_LOG_CATEGORY_EXTERN(LogLoad, Log, All);

namespace UEStub
{
    template <typename CategoryType> void LogCategoryCheck(const CategoryType& Category)
    { static_assert(std::is_base_of_v<FLogCategoryBase, CategoryType>, "UE_LOG: first argument must be a log category"); }
}

#define UE_LOG(CategoryName, Verbosity, Format, ...) \
    do { ::UEStub::LogCategoryCheck(CategoryName); (void)ELogVerbosity::Verbosity; ::UEStub::Fmt::CheckFormatArgs(Format __VA_OPT__(,) __VA_ARGS__); } while (0)
#define UE_CLOG(Condition, CategoryName, Verbosity, Format, ...) \
    do { if (Condition) { UE_LOG(CategoryName, Verbosity, Format __VA_OPT__(,) __VA_ARGS__); } } while (0)
#define UE_SUPPRESS(CategoryName, Verbosity, ExecuteIfUnsuppressed) do { ::UEStub::LogCategoryCheck(CategoryName); (void)ELogVerbosity::Verbosity; ExecuteIfUnsuppressed; } while (0)
#define UE_LOG_ACTIVE(CategoryName, Verbosity) ((void)ELogVerbosity::Verbosity, true)
#define UE_GET_LOG_VERBOSITY(CategoryName) CategoryName.GetVerbosity()
#define UE_SET_LOG_VERBOSITY(CategoryName, Verbosity) CategoryName.SetVerbosity(ELogVerbosity::Verbosity)
#define UE_LOGFMT(CategoryName, Verbosity, Format, ...) do { ::UEStub::LogCategoryCheck(CategoryName); (void)ELogVerbosity::Verbosity; (void)TEXT(Format); } while (0)

// ---------------------------------------------------------------- stats / profiling macros (compiled out)
struct TStatId { TStatId(); bool IsValidStat() const; };
#define STATGROUP_Game
#define DECLARE_STATS_GROUP(GroupDesc, GroupId, GroupCat)
#define DECLARE_CYCLE_STAT(CounterName, StatId, GroupId)
#define DECLARE_CYCLE_STAT_EXTERN(CounterName, StatId, GroupId, API)
#define DEFINE_STAT(Stat)
#define DECLARE_DWORD_COUNTER_STAT(CounterName, StatId, GroupId)
#define DECLARE_FLOAT_COUNTER_STAT(CounterName, StatId, GroupId)
#define DECLARE_MEMORY_STAT(CounterName, StatId, GroupId)
#define SCOPE_CYCLE_COUNTER(Stat)
#define QUICK_SCOPE_CYCLE_COUNTER(Stat)
#define DECLARE_SCOPE_CYCLE_COUNTER(CounterName, Stat, GroupId)
#define CONDITIONAL_SCOPE_CYCLE_COUNTER(Stat, bCondition)
#define SET_DWORD_STAT(Stat, Amount)
#define INC_DWORD_STAT(Stat)
#define INC_DWORD_STAT_BY(Stat, Amount)
#define DEC_DWORD_STAT(Stat)
#define SET_FLOAT_STAT(Stat, Amount)
#define GET_STATID(Stat) TStatId()
#define RETURN_QUICK_DECLARE_CYCLE_STAT(StatId, GroupId) return TStatId();
#define TRACE_CPUPROFILER_EVENT_SCOPE(Name)
#define TRACE_CPUPROFILER_EVENT_SCOPE_STR(Name)
#define TRACE_BOOKMARK(Format, ...)
#define CSV_SCOPED_TIMING_STAT(Category, StatName)
#define CSV_SCOPED_TIMING_STAT_EXCLUSIVE(StatName)
#define CSV_CUSTOM_STAT(Category, StatName, Value, Op)
#define CSV_DECLARE_CATEGORY_EXTERN(CategoryName)
#define CSV_DEFINE_CATEGORY(CategoryName, bDefaultValue)
#define SCOPED_NAMED_EVENT(Name, Color)
#define SCOPED_NAMED_EVENT_TEXT(Text, Color)
#define LLM_SCOPE(Tag)
#define LLM_SCOPE_BYNAME(Tag)

// ---------------------------------------------------------------- platform layer
struct FPlatformTime
{
    static double Seconds();
    static uint32 Cycles();
    static uint64 Cycles64();
    static double GetSecondsPerCycle();
    static double GetSecondsPerCycle64();
    static double ToMilliseconds(const uint32 Cycles);
    static double ToSeconds(const uint32 Cycles);
    static double ToSeconds64(const uint64 Cycles);
    static double ToMilliseconds64(const uint64 Cycles);
    static void SystemTime(int32& Year, int32& Month, int32& DayOfWeek, int32& Day, int32& Hour, int32& Min, int32& Sec, int32& MSec);
    static void UtcTime(int32& Year, int32& Month, int32& DayOfWeek, int32& Day, int32& Hour, int32& Min, int32& Sec, int32& MSec);
    static FString PrettyTime(double Seconds);
};
struct FPlatformMisc
{
    static FString GetEnvironmentVariable(const TCHAR* VariableName);
    static void SetEnvironmentVar(const TCHAR* VariableName, const TCHAR* Value);
    static bool IsDebuggerPresent();
    static void RequestExit(bool Force, const TCHAR* CallSite = nullptr);
    static void LocalPrint(const TCHAR* Str);
    static int32 NumberOfCores();
    static int32 NumberOfCoresIncludingHyperthreads();
    static FString GetCPUBrand();
    static FString GetPrimaryGPUBrand();
    static const TCHAR* GetPlatformFeaturesModuleName();
    static FString GetDeviceId();
    static FString GetOSVersion();
    static void MemoryBarrier();
    static FString GetEpicAccountId();
    static void CreateGuid(struct FGuid& Result);
};
struct FPlatformProcess
{
    static void Sleep(float Seconds);
    static void SleepNoStats(float Seconds);
    static const TCHAR* BaseDir();
    static const TCHAR* UserDir();
    static const TCHAR* ExecutableName(bool bRemoveExtension = true);
    static uint32 GetCurrentProcessId();
    static uint32 GetCurrentThreadId();
};
struct FPlatformAtomics
{
    static int32 InterlockedIncrement(volatile int32* Value);
    static int32 InterlockedDecrement(volatile int32* Value);
    static int32 InterlockedAdd(volatile int32* Value, int32 Amount);
};
struct FMemory
{
    static void* Memmove(void* Dest, const void* Src, SIZE_T Count);
    static int32 Memcmp(const void* Buf1, const void* Buf2, SIZE_T Count);
    static void* Memset(void* Dest, uint8 Char, SIZE_T Count);
    static void* Memzero(void* Dest, SIZE_T Count);
    static void* Memcpy(void* Dest, const void* Src, SIZE_T Count);
    static void* BigBlockMemcpy(void* Dest, const void* Src, SIZE_T Count);
    static void* Malloc(SIZE_T Count, uint32 Alignment = 0);
    static void* Realloc(void* Original, SIZE_T Count, uint32 Alignment = 0);
    static void Free(void* Original);
    static SIZE_T GetAllocSize(void* Original);
    template <class T> static void Memzero(T& Src) { (void)sizeof(T); }
    template <class T> static void Memset(T& Src, uint8 ValueToSet) { (void)sizeof(T); }
    template <class T> static void Memcpy(T& Dest, const T& Src) { (void)sizeof(T); }
};

bool IsInGameThread();
bool IsInRenderingThread();
bool IsInAudioThread();
bool IsInParallelGameThread();
bool IsInSlateThread();
bool IsEngineExitRequested();
void RequestEngineExit(const TCHAR* ReasonString);
void RequestEngineExit(const FString& ReasonString);
bool IsRunningCommandlet();
bool IsRunningDedicatedServer();
bool IsRunningGame();
bool IsRunningClientOnly();
extern CORE_API bool GIsEditor;
extern CORE_API bool GIsServer;
extern CORE_API bool GIsClient;
extern CORE_API bool GIsPlayInEditorWorld;
extern CORE_API bool GIsAutomationTesting;
extern CORE_API bool GIsBuildMachine;
extern CORE_API bool GIsRunning;
extern CORE_API bool GIsCriticalError;
extern CORE_API uint64 GFrameCounter;
extern CORE_API uint32 GFrameNumber;
extern CORE_API double GStartTime;
extern CORE_API float GNearClippingPlane;
extern CORE_API FString GEngineIni;
extern CORE_API FString GGameIni;
extern CORE_API FString GInputIni;
extern CORE_API FString GGameUserSettingsIni;
extern CORE_API FString GScalabilityIni;
extern CORE_API bool GIsRequestingExit;

class FOutputDevice
{
public:
    virtual ~FOutputDevice() = default;
    virtual void Serialize(const TCHAR* V, ELogVerbosity::Type Verbosity, const FName& Category) = 0;
    void Log(const TCHAR* S);
    void Log(const FString& S);
    void Log(const FText& S);
    template <typename... Types> void Logf(UEStub::Fmt::TFormatString<std::type_identity_t<Types>...> Fmt, Types... Args);
};
class FOutputDeviceRedirector : public FOutputDevice { public: void Serialize(const TCHAR* V, ELogVerbosity::Type Verbosity, const FName& Category) override; void Flush(); };
class FFeedbackContext : public FOutputDevice {};
class FOutputDeviceError : public FOutputDevice {};
extern CORE_API FOutputDeviceRedirector* GLog;
extern CORE_API FOutputDeviceError* GError;
extern CORE_API FFeedbackContext* GWarn;

// ---------------------------------------------------------------- time
struct FTimespan
{
    FTimespan();
    explicit FTimespan(int64 Ticks);
    FTimespan(int32 Hours, int32 Minutes, int32 Seconds);
    FTimespan(int32 Days, int32 Hours, int32 Minutes, int32 Seconds);
    FTimespan operator+(const FTimespan& Other) const;
    FTimespan operator-(const FTimespan& Other) const;
    bool operator==(const FTimespan& Other) const;
    bool operator<(const FTimespan& Other) const;
    int32 GetDays() const;
    int32 GetHours() const;
    int32 GetMinutes() const;
    int32 GetSeconds() const;
    int64 GetTicks() const;
    double GetTotalDays() const;
    double GetTotalHours() const;
    double GetTotalMinutes() const;
    double GetTotalSeconds() const;
    double GetTotalMilliseconds() const;
    FString ToString() const;
    static FTimespan FromSeconds(double Seconds);
    static FTimespan FromMilliseconds(double Milliseconds);
    static FTimespan FromMinutes(double Minutes);
    static FTimespan FromHours(double Hours);
    static FTimespan FromDays(double Days);
    static FTimespan Zero();
};
struct FDateTime
{
    FDateTime();
    explicit FDateTime(int64 InTicks);
    FDateTime(int32 Year, int32 Month, int32 Day, int32 Hour = 0, int32 Minute = 0, int32 Second = 0, int32 Millisecond = 0);
    FDateTime operator+(const FTimespan& Other) const;
    FTimespan operator-(const FDateTime& Other) const;
    FDateTime operator-(const FTimespan& Other) const;
    bool operator==(const FDateTime& Other) const;
    bool operator<(const FDateTime& Other) const;
    bool operator>(const FDateTime& Other) const;
    int32 GetDay() const;
    int32 GetDayOfYear() const;
    int32 GetHour() const;
    int32 GetHour12() const;
    int32 GetMillisecond() const;
    int32 GetMinute() const;
    int32 GetMonth() const;
    int32 GetSecond() const;
    int64 GetTicks() const;
    int32 GetYear() const;
    FTimespan GetTimeOfDay() const;
    FDateTime GetDate() const;
    int64 ToUnixTimestamp() const;
    FString ToString() const;
    FString ToString(const TCHAR* Format) const;
    FString ToIso8601() const;
    static FDateTime Now();
    static FDateTime UtcNow();
    static FDateTime Today();
    static FDateTime FromUnixTimestamp(int64 UnixTime);
    static bool Parse(const FString& DateTimeString, FDateTime& OutDateTime);
    static bool ParseIso8601(const TCHAR* DateTimeString, FDateTime& OutDateTime);
};

// ---------------------------------------------------------------- FGuid
enum class EGuidFormats { Digits, DigitsLower, DigitsWithHyphens, DigitsWithHyphensLower, DigitsWithHyphensInBraces, DigitsWithHyphensInParentheses, HexValuesInBraces, UniqueObjectGuid, Short, Base36Encoded };
struct FGuid
{
    uint32 A;
    uint32 B;
    uint32 C;
    uint32 D;
    FGuid();
    FGuid(uint32 InA, uint32 InB, uint32 InC, uint32 InD);
    explicit FGuid(const FString& InGuidStr);
    bool operator==(const FGuid& Y) const;
    bool operator!=(const FGuid& Y) const;
    bool operator<(const FGuid& Y) const;
    void Invalidate();
    bool IsValid() const;
    FString ToString() const;
    FString ToString(EGuidFormats Format) const;
    static FGuid NewGuid();
    static bool Parse(const FString& GuidString, FGuid& OutGuid);
    static FGuid NewDeterministicGuid(FStringView ObjectPath, uint64 Seed = 0);
};
uint32 GetTypeHash(const FGuid& Guid);

// ---------------------------------------------------------------- archives (minimal)
class FArchive
{
public:
    virtual ~FArchive() = default;
    bool IsLoading() const;
    bool IsSaving() const;
    bool IsError() const;
    virtual int64 Tell();
    virtual int64 TotalSize();
    virtual void Seek(int64 InPos);
    virtual void Serialize(void* V, int64 Length);
    FArchive& operator<<(int32& Value);
    FArchive& operator<<(uint32& Value);
    FArchive& operator<<(int64& Value);
    FArchive& operator<<(uint64& Value);
    FArchive& operator<<(float& Value);
    FArchive& operator<<(double& Value);
    FArchive& operator<<(bool& Value);
    FArchive& operator<<(uint8& Value);
    FArchive& operator<<(FString& Value);
    FArchive& operator<<(FName& Value);
    FArchive& operator<<(FText& Value);
    FArchive& operator<<(FVector& Value);
    FArchive& operator<<(FRotator& Value);
};
class FMemoryWriter : public FArchive { public: FMemoryWriter(TArray<uint8>& InBytes, bool bIsPersistent = false, bool bSetOffset = false, const FName InArchiveName = NAME_None); };
class FMemoryReader : public FArchive { public: explicit FMemoryReader(const TArray<uint8>& InBytes, bool bIsPersistent = false); };

// ---------------------------------------------------------------- config (minimal)
class FConfigCacheIni
{
public:
    bool GetString(const TCHAR* Section, const TCHAR* Key, FString& Value, const FString& Filename);
    bool GetInt(const TCHAR* Section, const TCHAR* Key, int32& Value, const FString& Filename);
    bool GetFloat(const TCHAR* Section, const TCHAR* Key, float& Value, const FString& Filename);
    bool GetDouble(const TCHAR* Section, const TCHAR* Key, double& Value, const FString& Filename);
    bool GetBool(const TCHAR* Section, const TCHAR* Key, bool& Value, const FString& Filename);
    void SetString(const TCHAR* Section, const TCHAR* Key, const TCHAR* Value, const FString& Filename);
    void SetInt(const TCHAR* Section, const TCHAR* Key, int32 Value, const FString& Filename);
    void SetFloat(const TCHAR* Section, const TCHAR* Key, float Value, const FString& Filename);
    void SetBool(const TCHAR* Section, const TCHAR* Key, bool Value, const FString& Filename);
    void Flush(bool bRemoveFromCache, const FString& Filename = FString());
};
extern CORE_API FConfigCacheIni* GConfig;

struct FApp
{
    static const TCHAR* GetProjectName();
    static FString GetBuildVersion();
    static bool IsGame();
    static bool IsUnattended();
    static bool CanEverRender();
    static bool CanEverRenderAudio();
    static double GetDeltaTime();
    static void SetDeltaTime(double Seconds);
    static double GetCurrentTime();
    static bool IsBenchmarking();
    static bool UseFixedTimeStep();
    static double GetFixedDeltaTime();
    static bool HasProjectName();
    static bool IsEngineInstalled();
};
struct FPaths
{
    static FString ProjectDir();
    static FString ProjectContentDir();
    static FString ProjectSavedDir();
    static FString ProjectConfigDir();
    static FString ProjectLogDir();
    static FString ProjectPluginsDir();
    static FString EngineDir();
    static FString EngineContentDir();
    static FString ScreenShotDir();
    static FString AutomationDir();
    static FString GetBaseFilename(const FString& InPath, bool bRemovePath = true);
    static FString GetPath(const FString& InPath);
    static FString GetCleanFilename(const FString& InPath);
    static FString GetExtension(const FString& InPath, bool bIncludeDot = false);
    static FString ConvertRelativePathToFull(const FString& InPath);
    static bool FileExists(const FString& InPath);
    static bool DirectoryExists(const FString& InPath);
    static void NormalizeFilename(FString& InPath);
    static void NormalizeDirectoryName(FString& InPath);
    static bool IsRelative(const FString& InPath);
    template <typename... PathTypes> static FString Combine(PathTypes&&... InPaths)
    { static_assert((std::is_constructible_v<FString, PathTypes&&> && ...), "FPaths::Combine takes strings"); return FString(); }
};
struct FFileHelper
{
    static bool LoadFileToString(FString& Result, const TCHAR* Filename, uint32 VerifyFlags = 0, uint32 ReadFlags = 0);
    static bool LoadFileToArray(TArray<uint8>& Result, const TCHAR* Filename, uint32 Flags = 0);
    static bool SaveStringToFile(FStringView String, const TCHAR* Filename, int32 EncodingOptions = 0, class IFileManager* FileManager = nullptr, uint32 WriteFlags = 0);
    static bool SaveArrayToFile(TArrayView<const uint8> Array, const TCHAR* Filename, class IFileManager* FileManager = nullptr, uint32 WriteFlags = 0);
    static bool LoadFileToStringArray(TArray<FString>& Result, const TCHAR* Filename);
};

// Platform properties
struct FPlatformProperties
{
    static constexpr bool IsServerOnly() { return false; }
    static constexpr bool IsClientOnly() { return false; }
    static constexpr bool HasEditorOnlyData() { return WITH_EDITORONLY_DATA; }
    static constexpr bool RequiresCookedData() { return !WITH_EDITOR; }
    static const char* PlatformName() { return "Linux"; }
    static const char* IniPlatformName() { return "Linux"; }
};
