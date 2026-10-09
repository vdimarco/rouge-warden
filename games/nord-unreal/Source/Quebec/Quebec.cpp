#include "Modules/ModuleManager.h"

#if WITH_EDITOR && PLATFORM_LINUX
#include "Containers/Ticker.h"
#include "Misc/CoreDelegates.h"

class FQuebecModule : public FDefaultGameModuleImpl
{
public:
    void StartupModule() override
    {
        FCoreDelegates::OnExit.AddRaw(this, &FQuebecModule::ReleaseShutdownTickers);
    }

    void ShutdownModule() override
    {
        FCoreDelegates::OnExit.RemoveAll(this);
    }

private:
    void ReleaseShutdownTickers()
    {
        // shortcut: UE 5.8.3 queues notification cleanup after its initial ticker reset; remove when engine teardown is fixed.
        FTSTicker::GetCoreTicker().Reset();
    }
};

IMPLEMENT_PRIMARY_GAME_MODULE(FQuebecModule, Quebec, "Quebec");

#if WITH_DEV_AUTOMATION_TESTS
#include "Internationalization/Text.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecShutdownTest, "Quebec.Editor.ShutdownCleanup", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecShutdownTest::RunTest(const FString& Parameters)
{
    FCoreDelegates::OnPreExit.AddLambda([]
    {
        auto TextBiDi = TextBiDi::CreateTextBiDi();
        TextBiDi->ComputeTextDirection(TEXT("Shutdown regression"), 0, 19);
        FTSTicker::GetCoreTicker().AddTicker(TEXT("QuebecShutdownRegression"), 3600.f,
            [TextBiDi = MoveTemp(TextBiDi)](float) { return false; });
        UE_LOG(LogTemp, Display, TEXT("Quebec shutdown regression queued ICU cleanup"));
    });
    return true;
}
#endif
#else
IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, Quebec, "Quebec");
#endif
