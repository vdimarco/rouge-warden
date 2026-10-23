#pragma once

#include "CoreMinimal.h"
#include "GauntletTestController.h"
#include "QuebecGauntletController.generated.h"

/**
 * Gauntlet controller for Build/Scripts/NordMobileLoop.cs (RunUnreal). Thin: UQuebecGauntletSubsystem (-NordGauntlet,
 * Source/Quebec/QuebecGauntlet.cpp) drives the run. This controller tells the subsystem that the test ends the process,
 * waits for the run's exit code and ends the test with it. The two meet only through console variables.
 * The UGauntletTestController hooks, EndTest and the run-time console variable calls are written from memory of UE 5.x
 * (unverified).
 */
UCLASS()
class QUEBECGAUNTLETTEST_API UQuebecGauntletController : public UGauntletTestController
{
    GENERATED_BODY()
protected:
    virtual void OnInit() override;
    virtual void OnTick(float TimeDelta) override;

private:
    double SecondsWithoutRun = 0.;
    bool bEnded = false;
};
