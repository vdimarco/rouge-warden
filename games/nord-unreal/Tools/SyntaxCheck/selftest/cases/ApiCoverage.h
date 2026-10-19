// EXPECT: PASS
// Positive control for APIs that new gameplay code commonly reaches for.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/HUD.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/DamageType.h"
#include "ApiCoverage.generated.h"

class USoundBase;
class UAudioComponent;
class UPointLightComponent;
class UTextRenderComponent;
class UMaterialInstanceDynamic;

UENUM(BlueprintType)
enum class ECoverageMode : uint8 { Idle, Chase, Flee };

USTRUCT(BlueprintType)
struct FCoverageStats
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Kills = 0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Accuracy = 0.f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnCoverageScored, AActor*, Scorer, int32, Points);

UCLASS()
class UCoverageDamageType : public UDamageType
{
    GENERATED_BODY()
};

UCLASS()
class ACoverageCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    ACoverageCharacter();
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;
    virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;
    virtual void NotifyHit(UPrimitiveComponent* MyComp, AActor* Other, UPrimitiveComponent* OtherComp, bool bSelfMoved, FVector HitLocation, FVector HitNormal, FVector NormalImpulse, const FHitResult& Hit) override;
    virtual void PossessedBy(AController* NewController) override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(Server, Reliable, WithValidation) void ServerShoot(const FVector_NetQuantize& TargetLocation);
    UFUNCTION(NetMulticast, Unreliable) void MulticastImpact(FVector_NetQuantize Location);
    UFUNCTION(Client, Reliable) void ClientNotify(const FString& Message);
    UFUNCTION(BlueprintNativeEvent) void OnScored(int32 Points);
    UFUNCTION(BlueprintCallable) void Ragdoll();

    UPROPERTY(BlueprintAssignable) FOnCoverageScored OnCoverageScored;
    UPROPERTY(EditAnywhere) TSubclassOf<AActor> ProjectileClass;
    UPROPERTY(EditAnywhere) TObjectPtr<USoundBase> ShotSound;
    UPROPERTY(EditAnywhere) TSoftObjectPtr<UStaticMesh> SoftMesh;
    UPROPERTY(ReplicatedUsing = OnRep_Mode) ECoverageMode Mode = ECoverageMode::Idle;
    UPROPERTY(Replicated) FCoverageStats Stats;
    UPROPERTY(Replicated) TArray<int32> Ammo;
    UPROPERTY() TMap<FName, int32> Inventory;
    UPROPERTY() TSet<TObjectPtr<AActor>> Seen;

protected:
    virtual void BeginPlay() override;
    UFUNCTION() void OnRep_Mode(ECoverageMode OldMode);
    UFUNCTION() void OnCapsuleHit(UPrimitiveComponent* HitComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit);
    UFUNCTION() void OnCapsuleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex);
    void MoveForward(float Value);
    void Fire();
    void FireKey(FKey Key);
    void Respawn();

private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UAudioComponent> Engine;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UPointLightComponent> Lamp;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UTextRenderComponent> Label;
    UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> Paint;
    TWeakObjectPtr<AActor> Target;
    FTimerHandle RespawnTimer;
    FRandomStream Random;
};

UCLASS()
class ACoverageController : public APlayerController
{
    GENERATED_BODY()
public:
    virtual void SetupInputComponent() override;
    virtual void OnPossess(APawn* InPawn) override;
    virtual void PlayerTick(float DeltaTime) override;
};

UCLASS()
class ACoverageHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void DrawHUD() override;
};

UCLASS()
class ACoverageGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    ACoverageGameMode();
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual AActor* ChoosePlayerStart_Implementation(AController* Player) override;
};
