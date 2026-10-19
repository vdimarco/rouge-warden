// EXPECT: no viable conversion from 'FRotator'
// SetActorLocation takes an FVector; passing a rotator must not compile.
#include "GameFramework/Actor.h"

void FaceEast(AActor* Actor)
{
    Actor->SetActorLocation(FRotator(0.f, 90.f, 0.f));
}
