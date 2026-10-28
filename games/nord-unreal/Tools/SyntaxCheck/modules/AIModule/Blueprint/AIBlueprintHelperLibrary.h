// Offline UE 5.x API stub: Blueprint/AIBlueprintHelperLibrary.h (AIModule)
#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "AIController.h"
class UAIBlueprintHelperLibrary : public UBlueprintFunctionLibrary
{
    UESTUB_UCLASS_BODY(UAIBlueprintHelperLibrary, UBlueprintFunctionLibrary)
    static void SimpleMoveToActor(AController* Controller, const AActor* Goal);
    static void SimpleMoveToLocation(AController* Controller, const FVector& Goal);
    static AAIController* GetAIController(AActor* ControlledActor);
    static APawn* SpawnAIFromClass(UObject* WorldContextObject, TSubclassOf<APawn> PawnClass, class UBehaviorTree* BehaviorTree, FVector Location, FRotator Rotation = FRotator::ZeroRotator, bool bNoCollisionFail = false, AActor* Owner = nullptr);
};
