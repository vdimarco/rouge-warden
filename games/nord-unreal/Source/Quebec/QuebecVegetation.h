#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecVegetation.generated.h"

class UHierarchicalInstancedStaticMeshComponent;
class UStaticMeshComponent;

UCLASS()
class QUEBEC_API AQuebecVegetation : public AActor
{
    GENERATED_BODY()
public:
    AQuebecVegetation();
    virtual void Tick(float DeltaSeconds) override;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UHierarchicalInstancedStaticMeshComponent> Trees;

private:
    void UpdateLeaves(float DeltaSeconds);
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Leaves;
    TArray<float> LeafBorn;
    float NextLeafAt = 0.f;
    int32 NextLeaf = 0;
};
