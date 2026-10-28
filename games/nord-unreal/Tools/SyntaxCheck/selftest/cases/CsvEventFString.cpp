// EXPECT: Error_PercentS
// CSV_EVENT_GLOBAL is printf-style like UE_LOG: %s needs a TCHAR*, so an FString has to be dereferenced (*Name).
#include "CoreMinimal.h"
#include "ProfilingDebugging/CsvProfiler.h"

void MarkLeg(const FString& Name)
{
    CSV_EVENT_GLOBAL(TEXT("leg=%s"), Name);
}
