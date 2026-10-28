// EXPECT: not declared with UFUNCTION
// AddDynamic needs a UFUNCTION target; UE compiles this and fails the bind at runtime.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NotUFunction.generated.h"

class UBoxComponent;

UCLASS()
class ANotUFunction : public AActor
{
    GENERATED_BODY()
public:
    ANotUFunction();
private:
    void OnBoxHit(UPrimitiveComponent* HitComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit);
    UPROPERTY() TObjectPtr<UBoxComponent> Box;
};
