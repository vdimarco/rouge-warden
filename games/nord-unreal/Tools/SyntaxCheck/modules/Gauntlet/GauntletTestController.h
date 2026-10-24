// Offline UE 5.x API stub: GauntletTestController.h (Gauntlet plugin, module Gauntlet)
//
// Written from memory of UE 5.x for the NORD mobile gauntlet; not checked against Epic's header (unverified).
// The plugin and module names, the access levels and GetFirstPlayerController are the parts most likely to differ.
#pragma once
#include "CoreMinimal.h"
#include "UObject/Object.h"

class APlayerController;
class UWorld;

/** Base of the in-game controllers that a Gauntlet test node attaches with -gauntlet=<Name>. */
class UGauntletTestController : public UObject
{
    UESTUB_UCLASS_BODY(UGauntletTestController, UObject)
    UGauntletTestController(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual ~UGauntletTestController();
    virtual UWorld* GetWorld() const override;

protected:
    virtual void OnInit() {}
    virtual void OnPreMapChange() {}
    // GetCurrentMap() returns the new map from here on.
    virtual void OnPostMapChange(UWorld* World) {}
    virtual void OnTick(float TimeDelta) {}
    virtual void OnStateChange(FName OldState, FName NewState) {}
    FName GetCurrentState() const;
    double GetTimeInCurrentState() const;
    FString GetCurrentMap() const;
    APlayerController* GetFirstPlayerController() const;
    // Logs the exit code and asks the process to quit with it.
    void EndTest(int32 ExitCode = 0);
};
