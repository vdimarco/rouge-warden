#include "QuebecVegetation.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"

AQuebecVegetation::AQuebecVegetation()
{
    PrimaryActorTick.bCanEverTick = false;
    Trees = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("Trees"));
    SetRootComponent(Trees);
    Trees->SetMobility(EComponentMobility::Static);
    Trees->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Trees->SetCanEverAffectNavigation(false);
    Trees->SetCullDistances(40000, 65000);
}
