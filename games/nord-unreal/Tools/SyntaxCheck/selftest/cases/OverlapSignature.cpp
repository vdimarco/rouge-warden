// EXPECT: AddDynamic|__Internal_AddDynamic
#include "OverlapSignature.h"
#include "Components/SphereComponent.h"

AOverlapSignature::AOverlapSignature()
{
    Sphere = CreateDefaultSubobject<USphereComponent>(TEXT("Sphere"));
    Sphere->OnComponentBeginOverlap.AddDynamic(this, &AOverlapSignature::OnOverlap);
}

void AOverlapSignature::OnOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex) {}
