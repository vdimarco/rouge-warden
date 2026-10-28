// EXPECT: PASS
#include "GauntletOk.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "ContentStreaming.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformTime.h"
#include "Misc/Paths.h"
#include "ProfilingDebugging/CsvProfiler.h"
#include "UnrealClient.h"

void UGauntletOkController::OnInit()
{
    Super::OnInit();
    UE_LOG(LogTemp, Display, TEXT("map %s state %s"), *GetCurrentMap(), *GetCurrentState().ToString());
}

void UGauntletOkController::OnPostMapChange(UWorld* World)
{
    Super::OnPostMapChange(World);
    if (!World) return;
    const FString Folder = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Gauntlet"), TEXT("native")) + TEXT("/");
    IFileManager::Get().MakeDirectory(*Folder, true);
#if CSV_PROFILER
    if (FCsvProfiler* Profiler = FCsvProfiler::Get())
    {
        Profiler->BeginCapture(-1, Folder, TEXT("Probe"));
        CSV_METADATA(TEXT("Probe"), TEXT("1"));
        bCapturing = true;
    }
#endif
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    if (ACameraActor* Eye = World->SpawnActor<ACameraActor>(FVector(0., 0., 170.), FRotator::ZeroRotator, Spawn))
    {
        Eye->GetCameraComponent()->SetConstraintAspectRatio(false);
        Eye->GetCameraComponent()->SetFieldOfView(85.f);
        if (APlayerController* Player = GetFirstPlayerController()) Player->SetViewTargetWithBlend(Eye, 0.f);
        IStreamingManager::Get().StreamAllResources(10.f);
    }
}

void UGauntletOkController::OnTick(float TimeDelta)
{
    Super::OnTick(TimeDelta);
#if CSV_PROFILER
    FCsvProfiler* Profiler = FCsvProfiler::Get();
    if (bCapturing && Profiler && Profiler->IsCapturing()) CSV_EVENT_GLOBAL(TEXT("leg=%s lap=%d"), TEXT("S1-S2"), 1);
    if (bCapturing && Profiler && GetTimeInCurrentState() > 60.)
    {
        bCapturing = false;
        CsvFile = Profiler->EndCapture();
    }
#endif
    if (!FScreenshotRequest::IsScreenshotRequested()) FScreenshotRequest::RequestScreenshot(TEXT("/tmp/probe.png"), false, false);
    if (CsvFile.IsValid() && CsvFile.IsReady())
    {
        UE_LOG(LogTemp, Display, TEXT("csv %s"), *CsvFile.Get());
        EndTest(0);
        FPlatformMisc::RequestExitWithStatus(false, 0);
    }
}

void UGauntletOkController::OnStateChange(FName OldState, FName NewState)
{
    Super::OnStateChange(OldState, NewState);
}
