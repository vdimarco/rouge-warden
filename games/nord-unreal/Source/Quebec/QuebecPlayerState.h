#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "QuebecGTA.h"
#include "QuebecPlayerState.generated.h"

/**
 * Street state that every peer can read: health, weapons, wanted stars, side-job cash and the down state.
 * It lives here because a driver's character stops replicating while the car carries it.
 * The server writes every field and calls Changed() so the 10 Hz update goes out at once.
 */
UCLASS()
class QUEBEC_API AQuebecPlayerState : public APlayerState
{
    GENERATED_BODY()
public:
    AQuebecPlayerState();
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static constexpr float MaxHealth = 100.f;
    static constexpr float MaxArmor = 100.f;
    static constexpr int32 WeaponCount = static_cast<int32>(EQuebecWeapon::Count);

    // Vitals.
    UPROPERTY(VisibleAnywhere, Replicated) float Health = MaxHealth;
    UPROPERTY(VisibleAnywhere, Replicated) float Armor = 0.f;
    // EQuebecDownState. DownUntil is server time when the K.-O. or ARRÊTÉ banner ends and the respawn happens.
    UPROPERTY(VisibleAnywhere, Replicated) uint8 DownState = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float DownUntil = 0.f;

    // Weapons. One bit per EQuebecWeapon; fists are always owned. Ammo has WeaponCount entries.
    UPROPERTY(VisibleAnywhere, Replicated) uint8 Weapon = 0;
    UPROPERTY(VisibleAnywhere, Replicated) int32 OwnedWeapons = 1;
    UPROPERTY(VisibleAnywhere, Replicated) TArray<int32> Ammo;
    // Aim assist lock, for the HUD reticle. Null when nothing is locked.
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<AActor> LockedTarget;

    // Police. Heat is the hidden score behind the 0-5 stars. While bSearching the stars blink: no officer sees the
    // player and the stars drop when SearchEndsAt passes.
    UPROPERTY(VisibleAnywhere, Replicated) float Heat = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) uint8 Stars = 0;
    UPROPERTY(VisibleAnywhere, Replicated) bool bSearching = false;
    UPROPERTY(VisibleAnywhere, Replicated) float SearchEndsAt = 0.f;

    // Side-job rewards.
    UPROPERTY(VisibleAnywhere, Replicated) int32 Cash = 0;

    EQuebecWeapon CurrentWeapon() const { return static_cast<EQuebecWeapon>(Weapon); }
    EQuebecDownState GetDownState() const { return static_cast<EQuebecDownState>(DownState); }
    bool IsDown() const { return DownState != 0; }
    bool HasWeapon(EQuebecWeapon Which) const { return (OwnedWeapons & (1 << static_cast<int32>(Which))) != 0; }
    int32 AmmoFor(EQuebecWeapon Which) const;
    // Server: a full reset for a respawn. Keeps cash; clears stars, weapons except fists, and ammo.
    void ResetForRespawn();
    // Server: send the changed fields now instead of at the next 10 Hz update.
    void Changed();
};
