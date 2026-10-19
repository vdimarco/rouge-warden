// Offline UE 5.x API stub: Kismet/GameplayStatics.h
#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Engine/EngineTypes.h"
#include "CollisionQueryParams.h"
class AActor;
class APawn;
class ACharacter;
class AController;
class APlayerController;
class APlayerCameraManager;
class AGameModeBase;
class AGameStateBase;
class UGameInstance;
class USoundBase;
class USoundAttenuation;
class USoundConcurrency;
class UAudioComponent;
class USceneComponent;
class UDamageType;
class USaveGame;
class UParticleSystem;
class UParticleSystemComponent;
class UDecalComponent;
class UMaterialInterface;
class UInitialActiveSoundParams;
class UCameraShakeBase;
class UPrimitiveComponent;
enum class ESuggestProjVelocityTraceOption : uint8 { DoNotTrace, TraceFullPath, OnlyTraceWhileAscending };
enum class EPSCPoolMethod : uint8 { None, AutoRelease, ManualRelease, ManualRelease_OnComplete, FreeInPool };
class UGameplayStatics : public UBlueprintFunctionLibrary
{
    UESTUB_UCLASS_BODY(UGameplayStatics, UBlueprintFunctionLibrary)
    UGameplayStatics(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    // game framework accessors
    static UGameInstance* GetGameInstance(const UObject* WorldContextObject);
    static APlayerController* GetPlayerController(const UObject* WorldContextObject, int32 PlayerIndex);
    static APlayerController* GetPlayerControllerFromID(const UObject* WorldContextObject, int32 ControllerID);
    static APawn* GetPlayerPawn(const UObject* WorldContextObject, int32 PlayerIndex);
    static ACharacter* GetPlayerCharacter(const UObject* WorldContextObject, int32 PlayerIndex);
    static APlayerCameraManager* GetPlayerCameraManager(const UObject* WorldContextObject, int32 PlayerIndex);
    static class APlayerState* GetPlayerState(const UObject* WorldContextObject, int32 PlayerStateIndex);
    static int32 GetNumPlayerStates(const UObject* WorldContextObject);
    static int32 GetNumPlayerControllers(const UObject* WorldContextObject);
    static int32 GetNumLocalPlayerControllers(const UObject* WorldContextObject);
    static int32 GetPlayerControllerID(APlayerController* Player);
    static AGameModeBase* GetGameMode(const UObject* WorldContextObject);
    static AGameStateBase* GetGameState(const UObject* WorldContextObject);
    static class UClass* GetObjectClass(const UObject* Object);
    static APlayerController* CreatePlayer(const UObject* WorldContextObject, int32 ControllerId = -1, bool bSpawnPlayerController = true);
    static void RemovePlayer(APlayerController* Player, bool bDestroyPawn);
    // actors
    static void GetAllActorsOfClass(const UObject* WorldContextObject, TSubclassOf<AActor> ActorClass, TArray<AActor*>& OutActors);
    static void GetAllActorsWithTag(const UObject* WorldContextObject, FName Tag, TArray<AActor*>& OutActors);
    static void GetAllActorsOfClassWithTag(const UObject* WorldContextObject, TSubclassOf<AActor> ActorClass, FName Tag, TArray<AActor*>& OutActors);
    static void GetAllActorsWithInterface(const UObject* WorldContextObject, TSubclassOf<class UInterface> Interface, TArray<AActor*>& OutActors);
    static AActor* GetActorOfClass(const UObject* WorldContextObject, TSubclassOf<AActor> ActorClass);
    static AActor* FindNearestActor(FVector Origin, const TArray<AActor*>& ActorsToCheck, float& Distance);
    static AActor* BeginDeferredActorSpawnFromClass(const UObject* WorldContextObject, TSubclassOf<AActor> ActorClass, const FTransform& SpawnTransform, ESpawnActorCollisionHandlingMethod CollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::Undefined, AActor* Owner = nullptr, ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::MultiplyWithRoot);
    static AActor* FinishSpawningActor(AActor* Actor, const FTransform& SpawnTransform, ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::MultiplyWithRoot);
    static UObject* SpawnObject(TSubclassOf<UObject> ObjectClass, UObject* Outer);
    // damage
    static float ApplyDamage(AActor* DamagedActor, float BaseDamage, AController* EventInstigator, AActor* DamageCauser, TSubclassOf<UDamageType> DamageTypeClass);
    static float ApplyPointDamage(AActor* DamagedActor, float BaseDamage, FVector const& HitFromDirection, FHitResult const& HitInfo, AController* EventInstigator, AActor* DamageCauser, TSubclassOf<UDamageType> DamageTypeClass);
    static bool ApplyRadialDamage(const UObject* WorldContextObject, float BaseDamage, const FVector& Origin, float DamageRadius, TSubclassOf<UDamageType> DamageTypeClass, const TArray<AActor*>& IgnoreActors, AActor* DamageCauser = nullptr, AController* InstigatedByController = nullptr, bool bDoFullDamage = false, ECollisionChannel DamagePreventionChannel = ECC_Visibility);
    static bool ApplyRadialDamageWithFalloff(const UObject* WorldContextObject, float BaseDamage, float MinimumDamage, const FVector& Origin, float DamageInnerRadius, float DamageOuterRadius, float DamageFalloff, TSubclassOf<UDamageType> DamageTypeClass, const TArray<AActor*>& IgnoreActors, AActor* DamageCauser = nullptr, AController* InstigatedByController = nullptr, ECollisionChannel DamagePreventionChannel = ECC_Visibility);
    // sound
    static void PlaySound2D(const UObject* WorldContextObject, USoundBase* Sound, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundConcurrency* ConcurrencySettings = nullptr, const AActor* OwningActor = nullptr, bool bIsUISound = true);
    static UAudioComponent* SpawnSound2D(const UObject* WorldContextObject, USoundBase* Sound, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundConcurrency* ConcurrencySettings = nullptr, bool bPersistAcrossLevelTransition = false, bool bAutoDestroy = true);
    static UAudioComponent* CreateSound2D(const UObject* WorldContextObject, USoundBase* Sound, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundConcurrency* ConcurrencySettings = nullptr, bool bPersistAcrossLevelTransition = false, bool bAutoDestroy = true);
    static void PlaySoundAtLocation(const UObject* WorldContextObject, USoundBase* Sound, FVector Location, FRotator Rotation, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundAttenuation* AttenuationSettings = nullptr, USoundConcurrency* ConcurrencySettings = nullptr, const AActor* OwningActor = nullptr, const UInitialActiveSoundParams* InitialParams = nullptr);
    static void PlaySoundAtLocation(const UObject* WorldContextObject, USoundBase* Sound, FVector Location, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundAttenuation* AttenuationSettings = nullptr, USoundConcurrency* ConcurrencySettings = nullptr, const UInitialActiveSoundParams* InitialParams = nullptr);
    static UAudioComponent* SpawnSoundAtLocation(const UObject* WorldContextObject, USoundBase* Sound, FVector Location, FRotator Rotation = FRotator::ZeroRotator, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundAttenuation* AttenuationSettings = nullptr, USoundConcurrency* ConcurrencySettings = nullptr, bool bAutoDestroy = true);
    static UAudioComponent* SpawnSoundAttached(USoundBase* Sound, USceneComponent* AttachToComponent, FName AttachPointName = NAME_None, FVector Location = FVector(ForceInit), EAttachLocation::Type LocationType = EAttachLocation::KeepRelativeOffset, bool bStopWhenAttachedToDestroyed = false, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundAttenuation* AttenuationSettings = nullptr, USoundConcurrency* ConcurrencySettings = nullptr, bool bAutoDestroy = true);
    static UAudioComponent* SpawnSoundAttached(USoundBase* Sound, USceneComponent* AttachToComponent, FName AttachPointName, FVector Location, FRotator Rotation, EAttachLocation::Type LocationType = EAttachLocation::KeepRelativeOffset, bool bStopWhenAttachedToDestroyed = false, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f, USoundAttenuation* AttenuationSettings = nullptr, USoundConcurrency* ConcurrencySettings = nullptr, bool bAutoDestroy = true);
    static void PlayDialogue2D(const UObject* WorldContextObject, class UDialogueWave* Dialogue, const struct FDialogueContext& Context, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f, float StartTime = 0.f);
    static void PrimeSound(USoundBase* InSound);
    static void SetGlobalPitchModulation(const UObject* WorldContextObject, float PitchModulation, float TimeSec);
    // effects
    static UParticleSystemComponent* SpawnEmitterAtLocation(const UObject* WorldContextObject, UParticleSystem* EmitterTemplate, FVector Location, FRotator Rotation = FRotator::ZeroRotator, FVector Scale = FVector(1.f), bool bAutoDestroy = true, EPSCPoolMethod PoolingMethod = EPSCPoolMethod::None, bool bAutoActivateSystem = true);
    static UParticleSystemComponent* SpawnEmitterAttached(UParticleSystem* EmitterTemplate, USceneComponent* AttachToComponent, FName AttachPointName = NAME_None, FVector Location = FVector(ForceInit), FRotator Rotation = FRotator::ZeroRotator, FVector Scale = FVector(1.f), EAttachLocation::Type LocationType = EAttachLocation::KeepRelativeOffset, bool bAutoDestroy = true, EPSCPoolMethod PoolingMethod = EPSCPoolMethod::None, bool bAutoActivate = true);
    static UDecalComponent* SpawnDecalAtLocation(const UObject* WorldContextObject, UMaterialInterface* DecalMaterial, FVector DecalSize, FVector Location, FRotator Rotation = FRotator(-90, 0, 0), float LifeSpan = 0);
    static UDecalComponent* SpawnDecalAttached(UMaterialInterface* DecalMaterial, FVector DecalSize, USceneComponent* AttachToComponent, FName AttachPointName = NAME_None, FVector Location = FVector(ForceInit), FRotator Rotation = FRotator::ZeroRotator, EAttachLocation::Type LocationType = EAttachLocation::KeepRelativeOffset, float LifeSpan = 0);
    static void PlayWorldCameraShake(const UObject* WorldContextObject, TSubclassOf<UCameraShakeBase> Shake, FVector Epicenter, float InnerRadius, float OuterRadius, float Falloff = 1.f, bool bOrientShakeTowardsEpicenter = false);
    // time / game state
    static bool IsGamePaused(const UObject* WorldContextObject);
    static bool SetGamePaused(const UObject* WorldContextObject, bool bPaused);
    static void SetGlobalTimeDilation(const UObject* WorldContextObject, float TimeDilation);
    static float GetGlobalTimeDilation(const UObject* WorldContextObject);
    static double GetTimeSeconds(const UObject* WorldContextObject);
    static double GetUnpausedTimeSeconds(const UObject* WorldContextObject);
    static double GetRealTimeSeconds(const UObject* WorldContextObject);
    static double GetAudioTimeSeconds(const UObject* WorldContextObject);
    static float GetWorldDeltaSeconds(const UObject* WorldContextObject);
    static void GetAccurateRealTime(int32& Seconds, double& PartialSeconds);
    // levels
    static void OpenLevel(const UObject* WorldContextObject, FName LevelName, bool bAbsolute = true, FString Options = FString(TEXT("")));
    static FString GetCurrentLevelName(const UObject* WorldContextObject, bool bRemovePrefixString = true);
    static FString GetPlatformName();
    static bool HasOption(FString Options, const FString& InKey);
    static FString ParseOption(FString Options, const FString& Key);
    static int32 GetIntOption(const FString& Options, const FString& Key, int32 DefaultValue);
    // projection
    static bool ProjectWorldToScreen(APlayerController const* Player, const FVector& WorldPosition, FVector2D& ScreenPosition, bool bPlayerViewportRelative = false);
    static bool DeprojectScreenToWorld(APlayerController const* Player, const FVector2D& ScreenPosition, FVector& WorldPosition, FVector& WorldDirection);
    static bool SuggestProjectileVelocity(const UObject* WorldContextObject, FVector& TossVelocity, FVector StartLocation, FVector EndLocation, float TossSpeed, bool bHighArc = false, float CollisionRadius = 0.f, float OverrideGravityZ = 0.f, ESuggestProjVelocityTraceOption TraceOption = ESuggestProjVelocityTraceOption::TraceFullPath, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam, const TArray<AActor*>& ActorsToIgnore = TArray<AActor*>(), bool bDrawDebug = false, bool bAcceptClosestOnNoSolutions = false);
    // save games
    static USaveGame* CreateSaveGameObject(TSubclassOf<USaveGame> SaveGameClass);
    static bool SaveGameToSlot(USaveGame* SaveGameObject, const FString& SlotName, const int32 UserIndex);
    static bool DoesSaveGameExist(const FString& SlotName, const int32 UserIndex);
    static USaveGame* LoadGameFromSlot(const FString& SlotName, const int32 UserIndex);
    static bool DeleteGameInSlot(const FString& SlotName, const int32 UserIndex);
    static bool SaveGameToMemory(USaveGame* SaveGameObject, TArray<uint8>& OutSaveData);
    static USaveGame* LoadGameFromMemory(const TArray<uint8>& InSaveData);
    // hit results
    static void BreakHitResult(const struct FHitResult& Hit, bool& bBlockingHit, bool& bInitialOverlap, float& Time, float& Distance, FVector& Location, FVector& ImpactPoint, FVector& Normal, FVector& ImpactNormal, class UPhysicalMaterial*& PhysMat, class AActor*& HitActor, class UPrimitiveComponent*& HitComponent, FName& HitBoneName, FName& BoneName, int32& HitItem, int32& ElementIndex, int32& FaceIndex, FVector& TraceStart, FVector& TraceEnd);
    static EPhysicalSurface GetSurfaceType(const struct FHitResult& Hit);
    static bool GrassOverlappingSphereCount(const UObject* WorldContextObject, const class UStaticMesh* StaticMesh, FVector CenterPosition, float Radius);
};
