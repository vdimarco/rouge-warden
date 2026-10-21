#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecBow.generated.h"

class APawn;
class AQuebecController;
class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * The bow on the Théâtre de Verdure stage. After L'encre déborde is won, E in the light
 * starts a twelve-second hold. The rules live in QuebecBowRules.h. Nothing is saved.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecBow : public AActor
{
    GENERATED_BODY()
public:
    AQuebecBow();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static AQuebecBow* Find(const UWorld* World);
    bool HandleInteract(AQuebecController* Player);
    FString GetPrompt(const APawn* Pawn) const;
    bool IsListed() const;
    FVector GetSpot() const { return BowPoint; }

private:
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
    UPROPERTY() TObjectPtr<UTextRenderComponent> Caption;
    UPROPERTY(Replicated) bool bHolding = false;
    UPROPERTY(Replicated) bool bBowDone = false;
    UPROPERTY(Replicated) float InsideSeconds = 0.f;
    UPROPERTY(Replicated) float OutsideSeconds = 0.f;
    FVector BowPoint = FVector::ZeroVector;
    FString Shown;
    bool bBuilt = false;

    bool Near(const APawn* Pawn) const;
    bool GoonsWon() const;
    bool JobRunning() const;
    bool StoryOpen(const AQuebecController* Player) const;
    bool SomeoneInside() const;
    void BuildStage();
    void UpdateSign();
    void Succeed();
    void FailHold();
    void Say(const FString& Title, const FString& Detail) const;
    UStaticMeshComponent* AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size, UMaterialInterface* Paint);
};
