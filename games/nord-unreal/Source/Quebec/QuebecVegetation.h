#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecVegetation.generated.h"

class UHierarchicalInstancedStaticMeshComponent;

UCLASS()
class QUEBEC_API AQuebecVegetation : public AActor
{
    GENERATED_BODY()
public:
    AQuebecVegetation();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UHierarchicalInstancedStaticMeshComponent> Trees;
};
