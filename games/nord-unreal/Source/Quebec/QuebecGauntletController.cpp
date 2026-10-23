#include "QuebecGauntletController.h"

#if QUEBEC_WITH_GAUNTLET
#include "QuebecGauntlet.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

namespace
{
    // Without -NordGauntlet there is no run; end the test instead of waiting for the node's MaxDuration.
    constexpr double NoRunAfter = 30.;

    UQuebecGauntletSubsystem* GauntletRun(const UWorld* World)
    {
        const UGameInstance* Instance = World ? World->GetGameInstance() : nullptr;
        return Instance ? Instance->GetSubsystem<UQuebecGauntletSubsystem>() : nullptr;
    }
}

void UQuebecGauntletController::OnPostMapChange(UWorld* World)
{
    Super::OnPostMapChange(World);
    // Not OnInit: GetWorld() can still be null there. HORU's Gauntlet template starts its capture here too.
    if (UQuebecGauntletSubsystem* Run = GauntletRun(World)) Run->StartRun(World, true);
}

void UQuebecGauntletController::OnTick(float TimeDelta)
{
    Super::OnTick(TimeDelta);
    if (bEnded) return;
    UWorld* World = GetWorld();
    UQuebecGauntletSubsystem* Run = GauntletRun(World);
    if (!Run)
    {
        SecondsWithoutRun += TimeDelta;
        if (SecondsWithoutRun < NoRunAfter) return;
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=no_run (the client command line needs -NordGauntlet)"));
        bEnded = true;
        EndTest(static_cast<int32>(QuebecGauntlet::EExit::Timeout));
        return;
    }
    // Also when the map loaded before the controller saw it: the test, not the subsystem, ends the process.
    Run->StartRun(World, true);
    if (!Run->IsFinished()) return;
    bEnded = true;
    EndTest(Run->GetExitCode());
}
#endif
