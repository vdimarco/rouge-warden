#include "QuebecPlayerState.h"

#include "Net/UnrealNetwork.h"

AQuebecPlayerState::AQuebecPlayerState()
{
    SetNetUpdateFrequency(10.f);
    Ammo.Init(0, WeaponCount);
}

void AQuebecPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecPlayerState, Health);
    DOREPLIFETIME(AQuebecPlayerState, Armor);
    DOREPLIFETIME(AQuebecPlayerState, DownState);
    DOREPLIFETIME(AQuebecPlayerState, DownUntil);
    DOREPLIFETIME(AQuebecPlayerState, Weapon);
    DOREPLIFETIME(AQuebecPlayerState, OwnedWeapons);
    DOREPLIFETIME(AQuebecPlayerState, Ammo);
    DOREPLIFETIME(AQuebecPlayerState, LockedTarget);
    DOREPLIFETIME(AQuebecPlayerState, Heat);
    DOREPLIFETIME(AQuebecPlayerState, Stars);
    DOREPLIFETIME(AQuebecPlayerState, bSearching);
    DOREPLIFETIME(AQuebecPlayerState, SearchEndsAt);
    DOREPLIFETIME(AQuebecPlayerState, Cash);
}

int32 AQuebecPlayerState::AmmoFor(EQuebecWeapon Which) const
{
    const int32 Index = static_cast<int32>(Which);
    return Ammo.IsValidIndex(Index) ? Ammo[Index] : 0;
}

void AQuebecPlayerState::ResetForRespawn()
{
    Health = MaxHealth;
    Armor = 0.f;
    DownState = 0;
    DownUntil = 0.f;
    Weapon = 0;
    OwnedWeapons = 1;
    Ammo.Init(0, WeaponCount);
    LockedTarget = nullptr;
    Heat = 0.f;
    Stars = 0;
    bSearching = false;
    SearchEndsAt = 0.f;
    Changed();
}

void AQuebecPlayerState::Changed()
{
    if (HasAuthority()) ForceNetUpdate();
}
