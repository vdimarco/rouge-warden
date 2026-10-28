#pragma once

#include "CoreMinimal.h"

class AActor;
class AController;
class AQuebecCar;
class AQuebecCharacter;
class AQuebecController;
class AQuebecPlayerState;
class UWorld;

// Shared vocabulary of the street systems: people, combat, police and side jobs.
// Each namespace has its own source file; callers include only this header.

enum class EQuebecWeapon : uint8 { Fists, HockeyStick, Pistol, SMG, Shotgun, Count };

enum class EQuebecCrime : uint8
{
    HitPerson,    // A car knocked a person down.
    AttackPerson, // A punch, swing or shot hit a civilian.
    Gunfire,      // A shot near people.
    HitCar,       // Rammed a car that has a driver.
    StealCar,     // Took a traffic car from its driver.
    RamPolice,    // Rammed a police car.
    AttackPolice, // Hit an officer.
    DownPolice    // Knocked an officer out.
};

enum class EQuebecHitKind : uint8 { Car, Melee, Bullet };

// Replicated on AQuebecPlayerState as a uint8.
enum class EQuebecDownState : uint8 { None, KnockedOut, Arrested };

// QuebecPeople.cpp
namespace QuebecPeople
{
    // Server: knock down the people that a moving car's body passes through between From and To. Returns how many.
    QUEBEC_API int32 StrikeWithCar(AQuebecCar* Car, const FVector& From, const FVector& To, float Speed);
    // Server: a weapon or a car hit a person. Knocks down and damages them, reports the crime and alarms others.
    // False when Target is not a person or is already down.
    QUEBEC_API bool Hit(AActor* Target, EQuebecHitKind Kind, float Damage, const FVector& Push, AController* Instigator);
    // Server: every person that can be hit (residents, pedestrians, players, officers, goons) within Radius of Center.
    QUEBEC_API void Gather(UWorld* World, const FVector& Center, float Radius, TArray<AActor*>& Out);
    QUEBEC_API bool IsPerson(const AActor* Actor);
    QUEBEC_API bool IsDown(const AActor* Person);
    // Torso point for aim and line-of-sight checks.
    QUEBEC_API FVector AimPoint(const AActor* Person);
    // Server: civilians within Radius run away from Source for a few seconds.
    QUEBEC_API void Alarm(UWorld* World, const FVector& Source, float Radius);
}

// QuebecCombat.cpp
namespace QuebecCombat
{
    // Server: damage a player. Armour absorbs damage first; at zero health the player is knocked out.
    QUEBEC_API void DamagePlayer(AQuebecCharacter* Victim, float Damage, AController* Instigator);
    // Server: return a downed player to the hospital (KnockedOut) or the police station (Arrested) with full health.
    QUEBEC_API void Respawn(AQuebecController* Player, EQuebecDownState Kind);
    // The player state of a player's pawn, controller or player state; null for anything else.
    QUEBEC_API AQuebecPlayerState* State(const AActor* PawnOrController);
}

// QuebecPolice.cpp
namespace QuebecCrime
{
    // Server: Offender committed Crime at Where. Adds heat when police or civilians can see it.
    QUEBEC_API void Report(AController* Offender, EQuebecCrime Crime, const FVector& Where);
    // Server: side jobs and the garage set stars directly.
    QUEBEC_API void SetStars(AController* Player, int32 Stars);
    QUEBEC_API int32 Stars(const AController* Player);
    QUEBEC_API bool IsPolice(const AActor* Actor);
    // Police that chase Player, or goons, which attack every player.
    QUEBEC_API bool IsHostile(const AActor* Actor, const AActor* Player);
    // Every peer: paint a car with bPolice white with a blue band and give it a light bar and a siren.
    QUEBEC_API void DecoratePoliceCar(AQuebecCar* Car);
}

// QuebecTraces.cpp. Marks that play leaves on the street: tyre marks, and cones and bins that cars knock over.
namespace QuebecTraces
{
    // Every peer, each frame for a moving car: lays tyre marks while it skids or brakes hard.
    QUEBEC_API void TickCar(AQuebecCar* Car, float DeltaSeconds);
    // Server: knock over street props that a car body passes through between From and To.
    QUEBEC_API void StrikeProps(AQuebecCar* Car, const FVector& From, const FVector& To, float Speed);
}

// QuebecSideJobs.cpp
namespace QuebecJobs
{
    // Server: true when side jobs took the R key for this player: an active job or its retry window handled it,
    // or the player is down or held by police, so R must do nothing.
    QUEBEC_API bool HandleRecover(AQuebecController* Player);
    QUEBEC_API bool IsJobActive(const UWorld* World);
}

// QuebecGameHUD.cpp. A short banner for one player that never uses the resident caption channel.
namespace QuebecNotice
{
    QUEBEC_API void Show(AController* Player, const FString& Title, const FString& Detail, float Seconds = 3.f);
}
