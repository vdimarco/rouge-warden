#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecPedestrian.generated.h"

class UAnimSequence;
class USkeletalMeshComponent;
class UStaticMeshComponent;

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

    // People: knockdown and flight (QuebecPeople.cpp). Server: tumble along Push (cm/s) from Cause, then run from it.
    // False when already down. The server moves the root through the tumble; it replicates at 30 Hz like the patrol.
    bool Knock(const FVector& Push, const FVector& Cause, float LieSeconds = 1.6f);
    // Server: runs away from Source for Seconds, then resumes the patrol from wherever it stopped.
    bool Flee(const FVector& Source, float Seconds);
    bool IsKnockedDown() const;
    FVector GetAimPoint() const;

private:
    friend class FQuebecPeoplePedestrianKnockTest;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Knock) float KnockStartedAt = -1000.f;
    UPROPERTY(VisibleAnywhere, Replicated) FVector KnockOrigin = FVector::ZeroVector;
    UPROPERTY(VisibleAnywhere, Replicated) FVector KnockPush = FVector::ZeroVector;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockLieSeconds = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float KnockGround = 0.f;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Fleeing) bool bFleeing = false;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> DazedStars;
    FQuat KnockFacing = FQuat::Identity;
    FVector FleeSource = FVector::ZeroVector;
    float FleeUntil = 0.f;
    bool bTumbling = false;
    // Every peer: dazed stars; server: the tumble and the flight. True while they replace the patrol.
    bool TickStreetLife(float DeltaSeconds);
    UFUNCTION() void OnRep_Knock();
    UFUNCTION() void OnRep_Fleeing();

    int32 TargetIndex = 1;
    int32 Direction = 1;
    float PauseRemaining = 0.f;
    void SetWalking(bool bNewWalking);
    UFUNCTION() void OnRep_Walking();
};
