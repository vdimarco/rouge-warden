#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecRingMark.generated.h"

class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * Two lawn marks for the park bike. Pedal them in order, then back to the stand.
 * The purse is session cash, paid once to the rider who tagged the lawn.
 * The rules live in QuebecRing.h. Nothing is saved. This is not a story mission.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecRing : public AActor
{
    GENERATED_BODY()
public:
    AQuebecRing();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static AQuebecRing* Find(const UWorld* World);
    // True while the lawn, the allée, or the stand is still the next mark. 3 is QuebecRing::Done.
    bool IsOpen() const { return Leg < 3; }
    // The drive-HUD line for this leg. Portrait is the short speed caption.
    FString DriveLine(bool bPortrait) const;

private:
    // QuebecRing::Stand, Lawn, Allee, then Done. Replicated so a remote rider's card matches.
    UPROPERTY(Replicated) int32 Leg = 0;
    int32 Rider = -1;
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    bool bBuilt = false;

    void BuildMarks();
    UStaticMeshComponent* AddPost(FName Name, const FVector& Point, const FVector& Scale, UMaterialInterface* Paint);
    void AddCaption(FName Name, const FVector& Point, const FString& Words);
};
