#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecPedestrian.generated.h"

class UAnimSequence;
class USkeletalMeshComponent;

/** Background residents follow authored, collision-checked paths on the server. */
UCLASS()
class QUEBEC_API AQuebecPedestrian : public AActor
{
    GENERATED_BODY()
public:
    AQuebecPedestrian();
    virtual void PostRegisterAllComponents() override;
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<USkeletalMeshComponent> ResidentMesh;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Resident") TObjectPtr<UAnimSequence> IdleAnimation;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Resident") TObjectPtr<UAnimSequence> WalkAnimation;
    /** World coordinates, including the walking surface height. Traversed in both directions. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Resident") TArray<FVector> PatrolPoints;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Resident", meta=(ClampMin="20", ClampMax="160")) float WalkSpeed = 90.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Resident", meta=(ClampMin="0")) float PauseDuration = 3.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Resident", meta=(ClampMin="0")) float StartDelay = 0.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, ReplicatedUsing=OnRep_Walking) bool bWalking = false;

    /** Shared by movement and its overshoot regression test. */
    static FVector StepTowards(const FVector& Position, const FVector& Target, float Speed, float DeltaSeconds);

private:
    int32 TargetIndex = 1;
    int32 Direction = 1;
    float PauseRemaining = 0.f;
    void SetWalking(bool bNewWalking);
    UFUNCTION() void OnRep_Walking();
};
