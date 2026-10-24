// EXPECT: marked 'override' but does not override
// MODULES: Gauntlet
// OnPostMapChange takes the new UWorld*, not the map name; a wrong signature must not compile as an override.
#pragma once
#include "CoreMinimal.h"
#include "GauntletTestController.h"
#include "GauntletOverride.generated.h"

UCLASS()
class UGauntletOverrideController : public UGauntletTestController
{
    GENERATED_BODY()
protected:
    virtual void OnPostMapChange(const FString& MapName) override;
};
