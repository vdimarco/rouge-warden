#include "QuebecGauntletController.h"

#include "HAL/IConsoleManager.h"

namespace
{
    // Source/Quebec/QuebecGauntlet.cpp registers nord.GauntletExit at -1 while the run goes on, then sets the exit code.
    const TCHAR* const ExitVariableName = TEXT("nord.GauntletExit");
    // Read by the subsystem when the run ends: at 1, the game leaves the quit to EndTest.
    const TCHAR* const ControllerVariableName = TEXT("nord.GauntletController");
    // QuebecGauntletModel.h EExit::Setup and Data/Gauntlet/loop.json exit_codes.setup; Scripts/test_gauntlet_model.py
    // checks that the three agree.
    constexpr int32 SetupExit = 6;
    // Without -NordGauntlet there is no run; end the test instead of waiting for the node's MaxDuration.
    constexpr double NoRunAfter = 30.;
}

void UQuebecGauntletController::OnInit()
{
    Super::OnInit();
    IConsoleManager::Get().RegisterConsoleVariable(ControllerVariableName, 1,
        TEXT("NORD mobile gauntlet: 1 while a Gauntlet controller ends the test, so the game does not quit by itself."), ECVF_Default);
}

void UQuebecGauntletController::OnTick(float TimeDelta)
{
    Super::OnTick(TimeDelta);
    if (bEnded) return;
    const IConsoleVariable* RunExit = IConsoleManager::Get().FindConsoleVariable(ExitVariableName);
    if (!RunExit)
    {
        SecondsWithoutRun += TimeDelta;
        if (SecondsWithoutRun < NoRunAfter) return;
        // The runner reads the exit from this line (gauntlet_loop.py RUN_END), as from the subsystem's result line.
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=no_run exit=%d reason=setup (the client command line needs -NordGauntlet)"), SetupExit);
        bEnded = true;
        EndTest(SetupExit);
        return;
    }
    const int32 Code = RunExit->GetInt();
    if (Code < 0) return;
    bEnded = true;
    EndTest(Code);
}
