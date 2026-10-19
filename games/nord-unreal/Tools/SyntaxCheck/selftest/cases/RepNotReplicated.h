// EXPECT: is not a UPROPERTY\(Replicated\)
// DOREPLIFETIME on a property that is not marked Replicated.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RepNotReplicated.generated.h"

UCLASS()
class ARepNotReplicated : public AActor
{
    GENERATED_BODY()
public:
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    UPROPERTY(VisibleAnywhere) int32 Score = 0;
};
