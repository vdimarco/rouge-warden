// EXPECT: PASS
// MODULES: Gauntlet
// Positive control for the Gauntlet controller and CSV profiler stubs (NORD mobile gauntlet, unverified APIs).
#pragma once
#include "CoreMinimal.h"
#include "Async/Future.h"
#include "GauntletTestController.h"
#include "GauntletOk.generated.h"

UCLASS()
class UGauntletOkController : public UGauntletTestController
{
    GENERATED_BODY()
protected:
    virtual void OnInit() override;
    virtual void OnPostMapChange(UWorld* World) override;
    virtual void OnTick(float TimeDelta) override;
    virtual void OnStateChange(FName OldState, FName NewState) override;

private:
    TSharedFuture<FString> CsvFile;
    bool bCapturing = false;
};
