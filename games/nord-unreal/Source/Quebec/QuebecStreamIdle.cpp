#include "QuebecStreamIdle.h"

#include "Engine/GameInstance.h"
#include "Engine/GameViewportClient.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Camera/PlayerCameraManager.h"
#include "IPixelStreaming2Module.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "PixelStreaming2Delegates.h"

bool UQuebecStreamIdleSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
    return !GIsEditor && !FParse::Param(FCommandLine::Get(), TEXT("NordCapture")) &&
        (FParse::Param(FCommandLine::Get(), TEXT("NordIdleThrottle")) || FParse::Param(FCommandLine::Get(), TEXT("NordStreamFps")));
}

void UQuebecStreamIdleSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    bThrottle = FParse::Param(FCommandLine::Get(), TEXT("NordIdleThrottle"));
    bLogFps = FParse::Param(FCommandLine::Get(), TEXT("NordStreamFps"));
    LastFpsTime = FPlatformTime::Seconds();
    LastFrames = GFrameCounter;
    StreamerId = IPixelStreaming2Module::Get().GetDefaultStreamerID();
    UPixelStreaming2Delegates* Delegates = UPixelStreaming2Delegates::Get();
    Delegates->OnNewConnectionNative.AddUObject(this, &UQuebecStreamIdleSubsystem::ViewerJoined);
    Delegates->OnDataTrackOpenNative.AddUObject(this, &UQuebecStreamIdleSubsystem::ViewerJoined);
    Ticker = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateUObject(this, &UQuebecStreamIdleSubsystem::Tick), .25f);
}

void UQuebecStreamIdleSubsystem::Deinitialize()
{
    FTSTicker::GetCoreTicker().RemoveTicker(Ticker);
    if (UPixelStreaming2Delegates* Delegates = UPixelStreaming2Delegates::Get())
    {
        Delegates->OnNewConnectionNative.RemoveAll(this);
        Delegates->OnDataTrackOpenNative.RemoveAll(this);
    }
    if (Viewport.IsValid()) Viewport->bDisableWorldRendering = bOriginalDisabled;
    Super::Deinitialize();
}

void UQuebecStreamIdleSubsystem::ViewerJoined(FString Id, FString PlayerId)
{
    if (Id != StreamerId) return;
    // UE 5.8.3 dispatches both delegates through DoOnGameThread.
    check(IsInGameThread());
    State.Update(FPlatformTime::Seconds(), true);
    SetSleeping(false, 1);
}

bool UQuebecStreamIdleSubsystem::Tick(float DeltaSeconds)
{
    const double Now = FPlatformTime::Seconds();
    if (bLogFps && Now - LastFpsTime >= 5.)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_STREAM_FPS frames=%llu seconds=%.3f sleeping=%d streamer=%s"),
            GFrameCounter - LastFrames, Now - LastFpsTime, bSleeping, *StreamerId);
        LastFrames = GFrameCounter;
        LastFpsTime = Now;
    }
    UWorld* World = GetWorld();
    if (!bThrottle || !World || !World->HasBegunPlay()) return true;
    UGameViewportClient* Current = GetGameInstance()->GetGameViewportClient();
    if (!Current || !IPixelStreaming2Module::IsAvailable()) return true;
    if (Viewport.Get() != Current)
    {
        if (Viewport.IsValid()) Viewport->bDisableWorldRendering = bOriginalDisabled;
        Viewport = Current;
        bOriginalDisabled = Current->bDisableWorldRendering;
    }
    const TSharedPtr<IPixelStreaming2Streamer> Streamer = IPixelStreaming2Module::Get().FindStreamer(StreamerId);
    // Do not treat a missing/disconnected streamer as an empty slot during initialization.
    if (!Streamer || !Streamer->IsConnected()) { SetSleeping(false, 0); return true; }
    const int32 Viewers = Streamer->GetConnectedPlayers().Num();
    SetSleeping(State.Update(Now, Viewers > 0), Viewers);
    Current->bDisableWorldRendering = bSleeping || bOriginalDisabled;
    return true;
}

void UQuebecStreamIdleSubsystem::SetSleeping(bool bSleep, int32 Viewers)
{
    if (bSleeping == bSleep) return;
    bSleeping = bSleep;
    if (Viewport.IsValid()) Viewport->bDisableWorldRendering = bSleep || bOriginalDisabled;
    if (!bSleep && GetWorld())
        for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
            if (APlayerController* Controller = It->Get(); Controller && Controller->IsLocalController() && Controller->PlayerCameraManager)
                Controller->PlayerCameraManager->SetGameCameraCutThisFrame();
    UE_LOG(LogTemp, Display, TEXT("NORD_STREAM_IDLE state=%s streamer=%s viewers=%d"), bSleep ? TEXT("sleep") : TEXT("wake"), *StreamerId, Viewers);
}

#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecStreamIdleTest, "Quebec.Stream.Idle", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecStreamIdleTest::RunTest(const FString& Parameters)
{
    FQuebecStreamIdleState Idle;
    TestFalse(TEXT("Starts awake"), Idle.Update(100., false));
    TestFalse(TEXT("Keeps the full 60-second warmup"), Idle.Update(159.99, false));
    TestTrue(TEXT("An empty slot sleeps after warmup"), Idle.Update(160., false));
    TestFalse(TEXT("A viewer wakes immediately"), Idle.Update(160.01, true));
    TestFalse(TEXT("A departed viewer gets a 30-second grace period"), Idle.Update(190., false));
    TestTrue(TEXT("The empty slot sleeps after grace"), Idle.Update(190.02, false));
    TestFalse(TEXT("A new viewer wakes a previously sleeping slot"), Idle.Update(200., true));
    return true;
}
#endif
