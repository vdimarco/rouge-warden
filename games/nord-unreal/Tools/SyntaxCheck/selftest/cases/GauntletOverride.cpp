// EXPECT: marked 'override' but does not override
#include "GauntletOverride.h"

void UGauntletOverrideController::OnPostMapChange(const FString& MapName)
{
    EndTest(1);
}
