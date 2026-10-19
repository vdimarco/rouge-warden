// Offline UE 5.x API stub: Misc/AutomationTest.h
#pragma once
#include "CoreMinimal.h"
enum class EAutomationTestFlags : uint64
{
    None = 0x00000000,
    EditorContext = 0x00000001,
    ClientContext = 0x00000002,
    ServerContext = 0x00000004,
    CommandletContext = 0x00000008,
    ProgramContext = 0x00000010,
    ApplicationContextMask = EditorContext | ClientContext | ServerContext | CommandletContext | ProgramContext,
    NonNullRHI = 0x00000100,
    RequiresUser = 0x00000200,
    FeatureMask = NonNullRHI | RequiresUser,
    Disabled = 0x00010000,
    CriticalPriority = 0x00100000,
    HighPriority = 0x00200000,
    HighPriorityAndAbove = CriticalPriority | HighPriority,
    MediumPriority = 0x00400000,
    MediumPriorityAndAbove = CriticalPriority | HighPriority | MediumPriority,
    LowPriority = 0x00800000,
    PriorityMask = CriticalPriority | HighPriority | MediumPriority | LowPriority,
    SmokeFilter = 0x01000000,
    EngineFilter = 0x02000000,
    ProductFilter = 0x04000000,
    PerfFilter = 0x08000000,
    StressFilter = 0x10000000,
    NegativeFilter = 0x20000000,
    FilterMask = SmokeFilter | EngineFilter | ProductFilter | PerfFilter | StressFilter | NegativeFilter,
};
ENUM_CLASS_FLAGS(EAutomationTestFlags)
constexpr EAutomationTestFlags EAutomationTestFlags_ApplicationContextMask = EAutomationTestFlags::ApplicationContextMask;
namespace EAutomationExpectedErrorFlags { enum MatchType { Exact, Contains }; }
namespace EAutomationExpectedMessageFlags { enum MatchType { Exact, Contains }; }
enum class EAutomationComparisonToleranceLevel : uint8 { Zero, Low, High };
class IAutomationLatentCommand
{
public:
    virtual ~IAutomationLatentCommand() = default;
    virtual bool Update() = 0;
};
class FAutomationTestFramework
{
public:
    static FAutomationTestFramework& Get();
    static FAutomationTestFramework& GetInstance();
    void EnqueueLatentCommand(TSharedPtr<IAutomationLatentCommand> NewCommand);
    class FAutomationTestBase* GetCurrentTest() const;
};

class FAutomationTestBase
{
public:
    FAutomationTestBase(const FString& InName, const bool bInComplexTask);
    virtual ~FAutomationTestBase();
    virtual EAutomationTestFlags GetTestFlags() const = 0;
    virtual FString GetTestSourceFileName() const;
    virtual int32 GetTestSourceFileLine() const;
    virtual uint32 GetRequiredDeviceNum() const = 0;
    virtual bool IsStressTest() const;
    virtual FString GetBeautifiedTestName() const = 0;
    virtual void AddError(const FString& InError, int32 StackOffset = 0);
    virtual void AddWarning(const FString& InWarning, int32 StackOffset = 0);
    virtual void AddInfo(const FString& InLogItem, int32 StackOffset = 0, bool bCaptureStack = false);
    void AddErrorIfFalse(bool bCondition, const FString& InError, int32 StackOffset = 0);
    void AddExpectedError(FString ExpectedPatternString, EAutomationExpectedErrorFlags::MatchType InCompareType = EAutomationExpectedErrorFlags::Contains, int32 Occurrences = 1, bool IsRegex = true);
    void AddExpectedErrorPlain(FString ExpectedString, EAutomationExpectedErrorFlags::MatchType InCompareType = EAutomationExpectedErrorFlags::Contains, int32 Occurrences = 1);
    void AddExpectedMessage(FString ExpectedPatternString, ELogVerbosity::Type ExpectedVerbosity, EAutomationExpectedMessageFlags::MatchType InCompareType = EAutomationExpectedMessageFlags::Contains, int32 Occurrences = 1, bool IsRegex = true);
    void AddExpectedMessage(FString ExpectedPatternString, EAutomationExpectedMessageFlags::MatchType InCompareType = EAutomationExpectedMessageFlags::Contains, int32 Occurrences = 1, bool IsRegex = true);
    void AddExpectedMessagePlain(FString ExpectedString, ELogVerbosity::Type ExpectedVerbosity, EAutomationExpectedMessageFlags::MatchType InCompareType = EAutomationExpectedMessageFlags::Contains, int32 Occurrences = 1);
    void AddExpectedMessagePlain(FString ExpectedString, EAutomationExpectedMessageFlags::MatchType InCompareType = EAutomationExpectedMessageFlags::Contains, int32 Occurrences = 1);
    bool HasAnyErrors() const;
    bool HasMetExpectedErrors();
    bool HasMetExpectedMessages(ELogVerbosity::Type VerbosityType = ELogVerbosity::All);
    void SetSuccessState(bool bSuccessful);
    bool GetLastExecutionSuccessState();
    bool IsComplexTask() const;
    const FString& GetTestName() const;
    FString GetTestContext() const;

    bool TestEqual(const TCHAR* What, const int32 Actual, const int32 Expected);
    bool TestEqual(const TCHAR* What, const int64 Actual, const int64 Expected);
    bool TestEqual(const TCHAR* What, const uint32 Actual, const uint32 Expected);
    bool TestEqual(const TCHAR* What, const uint64 Actual, const uint64 Expected);
    bool TestEqual(const TCHAR* What, const float Actual, const float Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const TCHAR* What, const double Actual, const double Expected, double Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const TCHAR* What, const FVector Actual, const FVector Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const TCHAR* What, const FTransform Actual, const FTransform Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const TCHAR* What, const FRotator Actual, const FRotator Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const TCHAR* What, const FColor Actual, const FColor Expected);
    bool TestEqual(const TCHAR* What, const FLinearColor Actual, const FLinearColor Expected);
    bool TestEqual(const TCHAR* What, const TCHAR* Actual, const TCHAR* Expected);
    bool TestEqual(const TCHAR* What, const FString& Actual, const TCHAR* Expected);
    bool TestEqual(const TCHAR* What, const FString& Actual, const FString& Expected);
    bool TestEqual(const TCHAR* What, const FText& Actual, const FText& Expected);
    bool TestEqual(const TCHAR* What, const FName& Actual, const FName& Expected);
    template <typename ValueType> bool TestEqual(const TCHAR* What, const ValueType& Actual, const ValueType& Expected) { return Actual == Expected; }
    template <typename ValueType> bool TestEqual(const FString& What, const ValueType& Actual, const ValueType& Expected) { return Actual == Expected; }
    bool TestEqual(const FString& What, const int32 Actual, const int32 Expected);
    bool TestEqual(const FString& What, const float Actual, const float Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const FString& What, const double Actual, const double Expected, double Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const FString& What, const FVector Actual, const FVector Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestEqual(const FString& What, const FString& Actual, const FString& Expected);
    bool TestEqualSensitive(const TCHAR* What, const TCHAR* Actual, const TCHAR* Expected);
    bool TestEqualInsensitive(const TCHAR* What, const TCHAR* Actual, const TCHAR* Expected);
    template <typename ValueType> bool TestNotEqual(const TCHAR* What, const ValueType& Actual, const ValueType& Expected) { return !(Actual == Expected); }
    template <typename ValueType> bool TestNotEqual(const FString& What, const ValueType& Actual, const ValueType& Expected) { return !(Actual == Expected); }
    bool TestNearlyEqual(const TCHAR* What, float Actual, float Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestNearlyEqual(const TCHAR* What, double Actual, double Expected, double Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestNearlyEqual(const TCHAR* What, FVector Actual, FVector Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestNearlyEqual(const TCHAR* What, FRotator Actual, FRotator Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    bool TestNearlyEqual(const TCHAR* What, FTransform Actual, FTransform Expected, float Tolerance = UE_KINDA_SMALL_NUMBER);
    template <typename ValueType> bool TestSame(const TCHAR* What, const ValueType& Actual, const ValueType& Expected) { return &Actual == &Expected; }
    template <typename ValueType> bool TestNotSame(const TCHAR* What, const ValueType& Actual, const ValueType& Expected) { return &Actual != &Expected; }
    bool TestSamePtr(const TCHAR* What, const void* Actual, const void* Expected);
    bool TestNotSamePtr(const TCHAR* What, const void* Actual, const void* Expected);
    bool TestFalse(const TCHAR* What, bool Value);
    bool TestFalse(const FString& What, bool Value);
    bool TestTrue(const TCHAR* What, bool Value);
    bool TestTrue(const FString& What, bool Value);
    bool TestNotNull(const TCHAR* What, const void* Pointer);
    bool TestNotNull(const FString& What, const void* Pointer);
    template <typename ValueType> bool TestNotNull(const TCHAR* What, const TObjectPtr<ValueType>& Pointer);
    bool TestNull(const TCHAR* What, const void* Pointer);
    bool TestNull(const FString& What, const void* Pointer);
    template <typename ValueType> bool TestNull(const TCHAR* What, const TObjectPtr<ValueType>& Pointer);
    template <typename ValueType> bool TestValid(const TCHAR* Description, const TSharedPtr<ValueType>& SharedPointer);
    template <typename ValueType> bool TestInvalid(const TCHAR* Description, const TSharedPtr<ValueType>& SharedPointer);
protected:
    virtual void GetTests(TArray<FString>& OutBeautifiedNames, TArray<FString>& OutTestCommands) const = 0;
    virtual bool RunTest(const FString& Parameters) = 0;
    virtual FString GetTestOpenCommand(const FString& Parameter) const;
    virtual FString GetTestAssetPath(const FString& Parameter) const;
    virtual bool SuppressLogErrors();
    virtual bool SuppressLogWarnings();
    virtual bool ElevateLogWarningsToErrors();
    FString TestName;
    FString TestParameterContext;
    bool bComplexTask;
};

#define UESTUB_AUTOMATION_TEST_BODY(TClass, PrettyName, TFlags, bComplex) \
public: \
    TClass(const FString& InName) : FAutomationTestBase(InName, bComplex) {} \
    virtual EAutomationTestFlags GetTestFlags() const override { return TFlags; } \
    virtual bool IsStressTest() const override { return false; } \
    virtual uint32 GetRequiredDeviceNum() const override { return 1; } \
    virtual FString GetTestSourceFileName() const override { return TEXT(__FILE__); } \
    virtual int32 GetTestSourceFileLine() const override { return __LINE__; } \
protected: \
    virtual FString GetBeautifiedTestName() const override { return TEXT(PrettyName); }

#define IMPLEMENT_SIMPLE_AUTOMATION_TEST(TClass, PrettyName, TFlags) \
    class TClass : public FAutomationTestBase \
    { \
        UESTUB_AUTOMATION_TEST_BODY(TClass, PrettyName, TFlags, false) \
        virtual void GetTests(TArray<FString>& OutBeautifiedNames, TArray<FString>& OutTestCommands) const override { OutBeautifiedNames.Add(TEXT(PrettyName)); OutTestCommands.Add(FString()); } \
        virtual bool RunTest(const FString& Parameters) override; \
    }; \
    namespace { TClass TClass##AutomationTestInstance(TEXT(#TClass)); }
#define IMPLEMENT_COMPLEX_AUTOMATION_TEST(TClass, PrettyName, TFlags) \
    class TClass : public FAutomationTestBase \
    { \
        UESTUB_AUTOMATION_TEST_BODY(TClass, PrettyName, TFlags, true) \
        virtual void GetTests(TArray<FString>& OutBeautifiedNames, TArray<FString>& OutTestCommands) const override; \
        virtual bool RunTest(const FString& Parameters) override; \
    }; \
    namespace { TClass TClass##AutomationTestInstance(TEXT(#TClass)); }
#define IMPLEMENT_CUSTOM_SIMPLE_AUTOMATION_TEST(TClass, TBaseClass, PrettyName, TFlags) \
    class TClass : public TBaseClass \
    { \
    public: \
        TClass(const FString& InName) : TBaseClass(InName, false) {} \
        virtual EAutomationTestFlags GetTestFlags() const override { return TFlags; } \
        virtual bool IsStressTest() const override { return false; } \
        virtual uint32 GetRequiredDeviceNum() const override { return 1; } \
    protected: \
        virtual void GetTests(TArray<FString>& OutBeautifiedNames, TArray<FString>& OutTestCommands) const override { OutBeautifiedNames.Add(TEXT(PrettyName)); OutTestCommands.Add(FString()); } \
        virtual bool RunTest(const FString& Parameters) override; \
        virtual FString GetBeautifiedTestName() const override { return TEXT(PrettyName); } \
    }; \
    namespace { TClass TClass##AutomationTestInstance(TEXT(#TClass)); }
#define IMPLEMENT_CUSTOM_COMPLEX_AUTOMATION_TEST(TClass, TBaseClass, PrettyName, TFlags) \
    class TClass : public TBaseClass \
    { \
    public: \
        TClass(const FString& InName) : TBaseClass(InName, true) {} \
        virtual EAutomationTestFlags GetTestFlags() const override { return TFlags; } \
        virtual bool IsStressTest() const override { return false; } \
        virtual uint32 GetRequiredDeviceNum() const override { return 1; } \
    protected: \
        virtual void GetTests(TArray<FString>& OutBeautifiedNames, TArray<FString>& OutTestCommands) const override; \
        virtual bool RunTest(const FString& Parameters) override; \
        virtual FString GetBeautifiedTestName() const override { return TEXT(PrettyName); } \
    }; \
    namespace { TClass TClass##AutomationTestInstance(TEXT(#TClass)); }

#define DEFINE_LATENT_AUTOMATION_COMMAND(CommandName) \
    class CommandName : public IAutomationLatentCommand { public: CommandName() {} virtual ~CommandName() {} virtual bool Update() override; }
#define DEFINE_LATENT_AUTOMATION_COMMAND_ONE_PARAMETER(CommandName, ParamType, ParamName) \
    class CommandName : public IAutomationLatentCommand { public: CommandName(ParamType InputParam) : ParamName(InputParam) {} virtual ~CommandName() {} virtual bool Update() override; private: ParamType ParamName; }
#define DEFINE_LATENT_AUTOMATION_COMMAND_TWO_PARAMETER(CommandName, ParamType0, ParamName0, ParamType1, ParamName1) \
    class CommandName : public IAutomationLatentCommand { public: CommandName(ParamType0 InputParam0, ParamType1 InputParam1) : ParamName0(InputParam0), ParamName1(InputParam1) {} virtual ~CommandName() {} virtual bool Update() override; private: ParamType0 ParamName0; ParamType1 ParamName1; }
#define ADD_LATENT_AUTOMATION_COMMAND(ClassDeclaration) FAutomationTestFramework::Get().EnqueueLatentCommand(MakeShareable(new ClassDeclaration));
class FWaitLatentCommand : public IAutomationLatentCommand { public: FWaitLatentCommand(float InDuration); virtual bool Update() override; };
class FEngineWaitLatentCommand : public IAutomationLatentCommand { public: FEngineWaitLatentCommand(float InDuration); virtual bool Update() override; };
