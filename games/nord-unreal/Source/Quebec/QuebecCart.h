#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecCart.generated.h"

class APawn;
class AQuebecController;
class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * Chez Lise, a casse-croûte on the Sherbrooke sidewalk. One walking player spends session cash with E.
 * The sale is a kit, a vest, or one wanted star, in that order. The rules live in QuebecStandRules.h.
 * Nothing is saved. Clients build the stall locally and read replicated vitals for the prompt.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecCart : public AActor
{
    GENERATED_BODY()
public:
    AQuebecCart();
    virtual void BeginPlay() override;

    static AQuebecCart* Find(const UWorld* World);
    // Server: E from a walking player at the stall. True when the stall took the key.
    bool HandleInteract(AQuebecController* Player);
    // HUD prompt for a pawn at the stall. Empty when they are not standing there.
    FString GetPrompt(const APawn* Pawn) const;
    FVector GetSpot() const { return CartPoint; }

private:
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    FVector CartPoint = FVector::ZeroVector;
    bool bBuilt = false;

    bool Near(const APawn* Pawn) const;
    bool EscapeRunning() const;
    void BuildStall();
    UStaticMeshComponent* AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size, UMaterialInterface* Paint);
    UTextRenderComponent* AddCaption(FName Name, const FVector& Point, const FString& Words, float WorldSize);
};
