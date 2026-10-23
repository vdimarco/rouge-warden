#pragma once

#include "CoreMinimal.h"

// Quebec.Build.cs defines QUEBEC_WITH_GAUNTLET: 1 with the Gauntlet module (every configuration but Shipping), else 0.
// A build that does not pass it, such as the offline stub check, follows the same rule.
#ifndef QUEBEC_WITH_GAUNTLET
#define QUEBEC_WITH_GAUNTLET (!UE_BUILD_SHIPPING)
#endif

#if QUEBEC_WITH_GAUNTLET
#include "GauntletTestController.h"
#include "QuebecGauntletController.generated.h"

/**
 * Gauntlet controller for Build/Scripts/NordMobileLoop.cs (RunUnreal). Thin: once the map has loaded it hands the run
 * of UQuebecGauntletSubsystem (-NordGauntlet) to the test, then ends the test with the run's exit code.
 * The UGauntletTestController hooks and EndTest are written from memory of UE 5.x (unverified).
 */
UCLASS()
class QUEBEC_API UQuebecGauntletController : public UGauntletTestController
{
    GENERATED_BODY()
protected:
    virtual void OnPostMapChange(UWorld* World) override;
    virtual void OnTick(float TimeDelta) override;

private:
    double SecondsWithoutRun = 0.;
    bool bEnded = false;
};
#endif
