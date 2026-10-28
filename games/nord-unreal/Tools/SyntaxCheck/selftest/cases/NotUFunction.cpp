// EXPECT: not declared with UFUNCTION
#include "NotUFunction.h"
#include "Components/BoxComponent.h"

ANotUFunction::ANotUFunction()
{
    Box = CreateDefaultSubobject<UBoxComponent>(TEXT("Box"));
    Box->OnComponentHit.AddDynamic(this, &ANotUFunction::OnBoxHit);
}

void ANotUFunction::OnBoxHit(UPrimitiveComponent* HitComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit) {}
