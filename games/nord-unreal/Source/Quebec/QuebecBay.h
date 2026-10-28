#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecBay.generated.h"

class APawn;
class AQuebecCar;
class AQuebecController;
class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * A sidewalk atelier east of the spawn. One walking player spends session cash with E
 * to clear the body damage on a nearby car. The bill grows with the damage.
 * The rules live in QuebecBayRules.h. Nothing is saved.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecBay : public AActor
{
    GENERATED_BODY()
public:
    AQuebecBay();
    virtual void BeginPlay() override;

    static AQuebecBay* Find(const UWorld* World);
    // Server: E from a walking player at the sign. True when the bay took the key.
    bool HandleInteract(AQuebecController* Player);
    // HUD prompt for a pawn at the sign. Empty when they are not standing there.
    FString GetPrompt(const APawn* Pawn) const;
    FVector GetSpot() const { return BayPoint; }

private:
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    FVector BayPoint = FVector::ZeroVector;
    bool bBuilt = false;

    bool Near(const APawn* Pawn) const;
    AQuebecCar* NearestHurtCar() const;
    void BuildBay();
    UStaticMeshComponent* AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size, UMaterialInterface* Paint);
    UTextRenderComponent* AddCaption(FName Name, const FVector& Point, const FString& Words, float WorldSize);
};
