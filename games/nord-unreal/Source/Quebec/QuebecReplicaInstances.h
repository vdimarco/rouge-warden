#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecReplicaInstances.generated.h"

class UHierarchicalInstancedStaticMeshComponent;

/**
 * Static instanced street props for the Plateau replica layer. Scripts/apply_plateau_replica.py spawns
 * one actor per prop mesh, colour variant and collision class, sets the mesh and material and adds the
 * Furniture/Soul placements as instances. The root is a static HISM so the editor never has to attach a
 * static component under a movable scene root. A separate class from AQuebecParkInstances, which the
 * upgrade_plateau.py inventory guard rejects on the live map.
 */
UCLASS()
class QUEBEC_API AQuebecReplicaInstances : public AActor
{
    GENERATED_BODY()
public:
    AQuebecReplicaInstances();
    UPROPERTY(VisibleAnywhere) TObjectPtr<UHierarchicalInstancedStaticMeshComponent> Instances;
};
