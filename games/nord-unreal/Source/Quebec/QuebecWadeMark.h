#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecWadeMark.generated.h"

class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * A float in the south pond and a post on the bank. Swim out and walk back.
 * The purse is session cash, paid once to the swimmer. The rules live in QuebecWade.h.
 * Nothing is saved.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecWade : public AActor
{
    GENERATED_BODY()
public:
    AQuebecWade();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

private:
    // QuebecWade::ELeg. The swimmer is the player id who tagged the float, or -1.
    UPROPERTY(Replicated) int32 Leg = 0;
    int32 Swimmer = -1;
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    bool bBuilt = false;

    void BuildMarks();
    UStaticMeshComponent* AddPost(FName Name, const FVector& Point, const FVector& Size, UMaterialInterface* Paint);
    UTextRenderComponent* AddCaption(FName Name, const FVector& Point, const FString& Words);
};
