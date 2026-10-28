// EXPECT: is not a UPROPERTY\(Replicated\)
#include "RepNotReplicated.h"
#include "Net/UnrealNetwork.h"

void ARepNotReplicated::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ARepNotReplicated, Score);
}
