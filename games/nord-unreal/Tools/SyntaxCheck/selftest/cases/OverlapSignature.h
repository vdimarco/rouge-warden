// EXPECT: AddDynamic|__Internal_AddDynamic
// An overlap handler with the wrong parameter list cannot be bound with AddDynamic.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "OverlapSignature.generated.h"

class USphereComponent;

UCLASS()
class AOverlapSignature : public AActor
{
    GENERATED_BODY()
public:
    AOverlapSignature();
private:
    UFUNCTION()
    void OnOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex);
    UPROPERTY() TObjectPtr<USphereComponent> Sphere;
};
