#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecCombatModel.h"
#include "QuebecGTA.h"
#include "QuebecCombat.generated.h"

class UAudioComponent;
class UInstancedStaticMeshComponent;
class UPointLightComponent;
class USceneComponent;
class USoundWaveProcedural;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

// Combat helpers beyond the shared QuebecGTA.h contract. The rules and numbers live in QuebecCombatModel.h and
// QuebecAimModel.h; AQuebecCharacter's weapon members are in QuebecCombat.cpp.
namespace QuebecCombat
{
    // Display names for banners and the HUD, in the residents' Québec French.
    QUEBEC_API const TCHAR* WeaponName(EQuebecWeapon Weapon);
    QUEBEC_API const TCHAR* PickupName(QuebecCombatModel::EPickupKind Kind);
    // Where a downed player stands up again: the Hôpital Notre-Dame stop after a K.-O., Poste de quartier 38 after
    // an arrest. Toronto uses its spawn. The point is at street level before the ground trace.
    QUEBEC_API FVector RespawnPoint(const UWorld* World, EQuebecDownState Kind);
    // Server: give what a pickup holds. Weapons add their pickup ammo and are equipped the first time; vests and kits
    // add 50 and are refused at full armour or health. True when the pickup was used.
    QUEBEC_API bool GrantPickup(AQuebecPlayerState* Stats, QuebecCombatModel::EPickupKind Kind);
    // The owned weapon after the current one, skipping guns without ammo. Fists are always owned.
    QUEBEC_API EQuebecWeapon NextOwnedWeapon(const AQuebecPlayerState* Stats);
    // Server: the map's weapon, vest and health pickups. LaFontaine only; returns how many were spawned.
    QUEBEC_API int32 SpawnPickups(UWorld* World);
    // Every peer: builds a weapon or pickup model from engine basic shapes under Parent. Returns the new parts.
    QUEBEC_API void BuildWeaponModel(AActor* Owner, USceneComponent* Parent, int32 Slot, float Scale,
        TArray<TObjectPtr<UStaticMeshComponent>>& Parts);
}

/**
 * A weapon, vest or health kit on the street. A walking player who comes within 1.5 m takes it on the server;
 * it comes back after 60 s. The model spins over a glowing ring on every peer. No collision, so it never blocks
 * cars, people or the population's placement checks.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecWeaponPickup : public AActor
{
    GENERATED_BODY()
public:
    AQuebecWeaponPickup();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    // Server: a pickup of NewKind standing on the ground at Location.
    static AQuebecWeaponPickup* SpawnPickup(UWorld* World, QuebecCombatModel::EPickupKind NewKind, const FVector& Location);
    // Server: Taker takes this pickup if it is available and useful. True when taken.
    bool TryGive(AQuebecCharacter* Taker);
    QuebecCombatModel::EPickupKind GetKind() const { return static_cast<QuebecCombatModel::EPickupKind>(Kind); }
    bool IsAvailable() const { return bAvailable; }

    // QuebecCombatModel::EPickupKind.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Kind) uint8 Kind = 0;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Available) bool bAvailable = true;
    // Server time when a taken pickup returns.
    UPROPERTY(VisibleAnywhere, Replicated) float RespawnAt = 0.f;

private:
    UPROPERTY() TObjectPtr<USceneComponent> Base;
    UPROPERTY() TObjectPtr<USceneComponent> Spinner;
    UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> Ring;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> ModelParts;
    uint8 BuiltKind = 255;
    float TouchElapsed = 0.f;
    void BuildModel();
    UFUNCTION() void OnRep_Kind();
    UFUNCTION() void OnRep_Available();
};

/**
 * Local, unreplicated comic effects for one shot, swing or hit: tracers, a muzzle flash, an impact word and a
 * procedural bang. The multicasts on AQuebecCharacter spawn one on each peer; it removes itself after a moment.
 */
UCLASS(NotPlaceable, Transient)
class QUEBEC_API AQuebecCombatFX : public AActor
{
    GENERATED_BODY()
public:
    AQuebecCombatFX();
    virtual void Tick(float DeltaSeconds) override;

    // A gunshot from Muzzle toward Impact. bHit lands the word at Impact; otherwise it pops by the muzzle.
    static void PlayShot(UWorld* World, const FVector& Muzzle, const FVector& Impact, int32 Slot, bool bHit, bool bWord);
    // A punch or a stick landing at Point.
    static void PlayImpact(UWorld* World, const FVector& Point, int32 Slot);

private:
    static constexpr int32 TracerCount = 6;
    UPROPERTY() TObjectPtr<USceneComponent> Base;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Tracers;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> Flash;
    UPROPERTY() TObjectPtr<UPointLightComponent> FlashLight;
    UPROPERTY() TObjectPtr<UTextRenderComponent> Word;
    UPROPERTY() TObjectPtr<UAudioComponent> Audio;
    UPROPERTY() TObjectPtr<USoundWaveProcedural> Wave;
    TArray<float> TracerLengths;
    float Age = 0.f;
    float FlashSeconds = 0.f;
    float WordSize = 0.f;
    FVector WordAnchor = FVector::ZeroVector;
    bool bWordShown = false;
    static AQuebecCombatFX* Begin(UWorld* World, const FVector& Location);
    void ShowWord(const FVector& Point, const TCHAR* Text, const FColor& Color, float Size);
    void PlayBang(int32 Slot, bool bImpact);
    void FaceLocalCamera();
};
