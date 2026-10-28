#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecCrateMark.generated.h"

class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * A caisse on Sherbrooke and a post in Parc Persillier-Lachapelle.
 * Walk to the caisse, then pedal it there on the park bike.
 * The purse is session cash, paid once to the person who took it.
 * The rules live in QuebecCrate.h. Nothing is saved. This is not a story mission.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecCrate : public AActor
{
    GENERATED_BODY()
public:
    AQuebecCrate();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static AQuebecCrate* Find(const UWorld* World);
    // The sidewalk hint, while the caisse is still sitting there. Empty after it is taken.
    FString WalkLine() const;
    // The bike card, while that person still has the parcel. Portrait is the short caption.
    FString BikeLine(bool bPortrait) const;

private:
    // QuebecCrate::Curb, Park, then Done. Replicated so a remote card matches.
    UPROPERTY(Replicated) int32 Step = 0;
    int32 Runner = -1;
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    bool bBuilt = false;

    void BuildPosts();
    UStaticMeshComponent* AddPost(FName Name, const FVector& Point, const FVector& Scale, UMaterialInterface* Paint);
    void AddCaption(FName Name, const FVector& Point, const FString& Words);
};
