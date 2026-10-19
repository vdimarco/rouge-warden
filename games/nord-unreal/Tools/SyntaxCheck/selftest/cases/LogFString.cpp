// EXPECT: Error_PercentS
// %s needs a TCHAR*, so an FString has to be dereferenced (*Name).
#include "CoreMinimal.h"

void Report(const FString& Name)
{
    UE_LOG(LogTemp, Warning, TEXT("Player %s joined"), Name);
}
