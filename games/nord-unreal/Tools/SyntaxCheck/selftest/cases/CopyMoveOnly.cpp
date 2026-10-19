// EXPECT: copying an array requires a copyable element type
// TArray<TUniquePtr<T>> is move-only; copying it does not compile in UE.
#include "CoreMinimal.h"

struct FPayload { int32 Value = 0; };

void Duplicate(const TArray<TUniquePtr<FPayload>>& Source)
{
    TArray<TUniquePtr<FPayload>> Copy = Source;
}
