#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "QuebecKnockModel.h"
#include "QuebecPeople.generated.h"

class AActor;
class UStaticMeshComponent;
class UWorld;

// Helpers shared by the residents, the Plateau pedestrians and the players for the comic knockdown.
namespace QuebecPeopleVisuals
{
    // Shared server time on every peer.
    QUEBEC_API float ServerTime(const UWorld* World);
    // The model launch from a replicated push (cm/s), lie and ground step.
    QUEBEC_API QuebecKnock::FLaunch Launch(const FVector& Push, float LieSeconds, float GroundDelta = 0.f);
    // Tumble rotation in world space: Pitch tips the body's up axis toward the planar push, Roll turns it about the push.
    QUEBEC_API FQuat Tumble(const FVector& Push, float Pitch, float Roll);
    // Three small stars that circle Head while bShow; built on first use, hidden afterwards.
    QUEBEC_API void PoseStars(AActor* Holder, TArray<TObjectPtr<UStaticMeshComponent>>& Stars, bool bShow, const FVector& Head, float Time);
}

/**
 * Poses a knocked player's mesh after character movement, and on remote peers its network smoothing, have written
 * the mesh transform for the frame. Created on the first knockdown; it stops ticking once the player stands.
 */
UCLASS()
class QUEBEC_API UQuebecKnockPoser : public UActorComponent
{
    GENERATED_BODY()
public:
    UQuebecKnockPoser();
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
};
