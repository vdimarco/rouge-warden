// EXPECT: PASS
// Positive control: a typical gameplay actor that must compile cleanly.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "OkActor.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

UCLASS()
class AOkActor : public AActor
{
    GENERATED_BODY()
public:
    AOkActor();
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

    UFUNCTION(Server, Reliable)
    void ServerFire(FVector_NetQuantize Target);

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void OnBoxOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);
    UFUNCTION()
    void OnRep_Health();
    void Expire();

    UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Box;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Mesh;
    UPROPERTY(ReplicatedUsing = OnRep_Health) float Health = 100.f;
    UPROPERTY(Replicated) int32 Ammo = 10;
    FTimerHandle ExpireTimer;
    float Speed = 300.f;
};
