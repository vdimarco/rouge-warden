#include "QuebecReplicaInstances.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"

AQuebecReplicaInstances::AQuebecReplicaInstances()
{
    PrimaryActorTick.bCanEverTick = false;
    Instances = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("Instances"));
    Instances->SetMobility(EComponentMobility::Static);
    Instances->SetCollisionProfileName(TEXT("NoCollision"));
    Instances->SetCastShadow(false);
    RootComponent = Instances;
}
