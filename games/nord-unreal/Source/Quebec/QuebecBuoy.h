#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecBuoy.generated.h"

class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * A buoy in the north pond. Paddle the pedalo out to it and back to the bridge.
 * The purse is session cash, paid once to the driver. The rules live in QuebecLap.h.
 * Nothing is saved.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecBuoy : public AActor
{
    GENERATED_BODY()
public:
    AQuebecBuoy();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static AQuebecBuoy* Find(const UWorld* World);
    // The drive-HUD line for this leg. Portrait is the short speed caption.
    FString DriveLine(bool bPortrait) const;

private:
    // QuebecLap::ELeg. Replicated so a remote paddler's card matches the server.
    UPROPERTY(Replicated) int32 Leg = 0;
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    bool bBuilt = false;

    void BuildBuoy();
};
