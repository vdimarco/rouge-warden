// Offline UE 5.x API stub: Engine/World.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
#include "CollisionQueryParams.h"
#include "CollisionShape.h"
#include "GameFramework/Actor.h"

class AActor;
class APawn;
class AController;
class APlayerController;
class AGameModeBase;
class AGameStateBase;
class AWorldSettings;
class APhysicsVolume;
class ULevel;
class UGameInstance;
class UNavigationSystemBase;
class FTimerManager;
class ULocalPlayer;
class FPhysScene_Chaos;
class AParticleEventManager;
class UWorldSubsystem;
struct FOverlapResult;
namespace ERHIFeatureLevel { enum Type : int { ES2_REMOVED, ES3_1, SM4_REMOVED, SM5, SM6, Num }; }

struct FActorSpawnParameters
{
    FActorSpawnParameters();
    FName Name;
    AActor* Template;
    AActor* Owner;
    APawn* Instigator;
    ULevel* OverrideLevel;
    class UPackage* OverridePackage;
    class UChildActorComponent* OverrideParentComponent;
    FGuid OverrideActorGuid;
    ESpawnActorCollisionHandlingMethod SpawnCollisionHandlingOverride;
    ESpawnActorScaleMethod TransformScaleMethod;
    uint8 bNoFail : 1;
    uint8 bDeferConstruction : 1;
    uint8 bAllowDuringConstructionScript : 1;
    uint8 bForceGloballyUniqueName : 1;
    ESpawnActorNameMode NameMode;
    EObjectFlags ObjectFlags;
    TFunction<void(AActor*)> CustomPreSpawnInitalization;
    bool IsRemoteOwned() const;
};

typedef TArray<TWeakObjectPtr<APlayerController>>::TConstIterator FConstPlayerControllerIterator;
typedef TArray<TWeakObjectPtr<AController>>::TConstIterator FConstControllerIterator;

DECLARE_MULTICAST_DELEGATE_OneParam(FOnActorSpawned, AActor*);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnActorDestroyed, AActor*);

class UWorld : public UObject
{
    UESTUB_UCLASS_BODY(UWorld, UObject)
    UWorld(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());

    struct InitializationValues
    {
        InitializationValues();
        uint32 bInitializeScenes : 1;
        uint32 bAllowAudioPlayback : 1;
        uint32 bRequiresHitProxies : 1;
        uint32 bCreatePhysicsScene : 1;
        uint32 bCreateNavigation : 1;
        uint32 bCreateAISystem : 1;
        uint32 bShouldSimulatePhysics : 1;
        uint32 bEnableTraceCollision : 1;
        uint32 bForceUseMovementComponentInNonGameWorld : 1;
        uint32 bTransactional : 1;
        uint32 bCreateFXSystem : 1;
        uint32 bCreateWorldPartition : 1;
        InitializationValues& InitializeScenes(const bool bInitialize);
        InitializationValues& AllowAudioPlayback(const bool bAllow);
        InitializationValues& RequiresHitProxies(const bool bRequires);
        InitializationValues& CreatePhysicsScene(const bool bCreate);
        InitializationValues& CreateNavigation(const bool bCreate);
        InitializationValues& CreateAISystem(const bool bCreate);
        InitializationValues& ShouldSimulatePhysics(const bool bInShouldSimulatePhysics);
        InitializationValues& EnableTraceCollision(const bool bInEnableTraceCollision);
        InitializationValues& ForceUseMovementComponentInNonGameWorld(const bool bInForceUseMovementComponentInNonGameWorld);
        InitializationValues& SetTransactional(const bool bInTransactional);
        InitializationValues& CreateFXSystem(const bool bCreate);
        InitializationValues& CreateWorldPartition(const bool bCreate);
    };

    TObjectPtr<ULevel> PersistentLevel;
    TEnumAsByte<EWorldType::Type> WorldType;
    FURL URL;
    uint8 bIsTearingDown : 1;
    uint8 bBegunPlay : 1;
    uint8 bShouldSimulatePhysics : 1;
    // time (public fields; the getters below read them)
    double TimeSeconds;
    double UnpausedTimeSeconds;
    double RealTimeSeconds;
    double AudioTimeSeconds;
    float DeltaTimeSeconds;
    float DeltaRealTimeSeconds;
    double PauseDelay;
    FOnActorSpawned OnActorSpawned;

    static UWorld* CreateWorld(const EWorldType::Type InWorldType, bool bInformEngineOfWorld, FName WorldName = NAME_None, UPackage* InWorldPackage = nullptr, bool bAddToRoot = true, ERHIFeatureLevel::Type InFeatureLevel = ERHIFeatureLevel::Num, const InitializationValues* InIVS = nullptr, bool bInSkipInitWorld = false);
    void DestroyWorld(bool bInformEngineOfWorld, UWorld* NewWorld = nullptr);
    void InitializeActorsForPlay(const FURL& InURL, bool bResetTime = true, class FRegisterComponentContext* Context = nullptr);
    void BeginPlay();
    void CleanupWorld(bool bSessionEnded = true, bool bCleanupResources = true, UWorld* NewWorld = nullptr);
    static FString RemovePIEPrefix(const FString& Source, int32* OutPIEInstanceID = nullptr);
    static FString ConvertToPIEPackageName(const FString& PackageName, int32 PIEInstanceID);
    static FString StripPIEPrefixFromPackageName(const FString& PackageName, const FString& Prefix);

    // time
    double GetTimeSeconds() const;
    double GetUnpausedTimeSeconds() const;
    double GetRealTimeSeconds() const;
    double GetAudioTimeSeconds() const;
    float GetDeltaSeconds() const;
    double TimeSince(double Time) const;
    bool IsPaused() const;
    uint32 GetFrameNumber() const;
    // state
    bool HasBegunPlay() const;
    bool AreActorsInitialized() const;
    bool IsGameWorld() const;
    bool IsEditorWorld() const;
    bool IsPreviewWorld() const;
    bool IsPlayInEditor() const;
    bool IsPlayInPreview() const;
    bool IsPlayingReplay() const;
    bool IsInSeamlessTravel() const;
    bool IsTearingDown() const;
    bool AllowAudioPlayback() const;
    ENetMode GetNetMode() const;
    bool IsNetMode(ENetMode Mode) const;
    class UNetDriver* GetNetDriver() const;
    FString GetMapName() const;
    FString GetAddressURL() const;
    float GetGravityZ() const;
    float GetDefaultGravityZ() const;
    // game framework
    AGameModeBase* GetAuthGameMode() const;
    template <class T> T* GetAuthGameMode() const { return Cast<T>(GetAuthGameMode()); }
    AGameStateBase* GetGameState() const;
    template <class T> T* GetGameState() const { return Cast<T>(GetGameState()); }
    void SetGameState(AGameStateBase* NewGameState);
    UGameInstance* GetGameInstance() const;
    template <class T> T* GetGameInstance() const { return Cast<T>(GetGameInstance()); }
    template <class T> T* GetGameInstanceChecked() const { return CastChecked<T>(GetGameInstance()); }
    AWorldSettings* GetWorldSettings(bool bCheckStreamingPersistent = false, bool bChecked = true) const;
    APhysicsVolume* GetDefaultPhysicsVolume() const;
    FTimerManager& GetTimerManager() const;
    struct FLatentActionManager& GetLatentActionManager();
    UNavigationSystemBase* GetNavigationSystem();
    const UNavigationSystemBase* GetNavigationSystem() const;
    FPhysScene_Chaos* GetPhysicsScene() const;
    ULevel* GetCurrentLevel() const;
    const TArray<ULevel*>& GetLevels() const;
    ULevel* GetLevel(int32 InLevelIndex) const;
    int32 GetNumLevels() const;
    template <class T> T* GetSubsystem() const { (void)&T::StaticClass; return nullptr; }
    class AParticleEventManager* MyParticleEventManager;
    class ALevelScriptActor* GetLevelScriptActor(class ULevel* OwnerLevel = nullptr) const;
    // players
    APlayerController* GetFirstPlayerController() const;
    template <class T> T* GetFirstPlayerController() const { return Cast<T>(GetFirstPlayerController()); }
    ULocalPlayer* GetFirstLocalPlayerFromController() const;
    FConstPlayerControllerIterator GetPlayerControllerIterator() const;
    FConstControllerIterator GetControllerIterator() const;
    int32 GetNumPlayerControllers() const;
    int32 GetNumControllers() const;
    // actors
    AActor* SpawnActor(UClass* InClass, FVector const* Location = nullptr, FRotator const* Rotation = nullptr, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters());
    AActor* SpawnActor(UClass* Class, FTransform const* Transform, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters());
    AActor* SpawnActor(UClass* InClass, FTransform const& Transform, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters());
    AActor* SpawnActorAbsolute(UClass* Class, FTransform const& AbsoluteTransform, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters());
    template <class T> T* SpawnActor(const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActor: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActor(FVector const& Location, FRotator const& Rotation, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActor: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActor(UClass* Class, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActor: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActor(UClass* Class, FVector const& Location, FRotator const& Rotation, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActor: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActor(UClass* Class, FTransform const& Transform, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActor: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActorAbsolute(FVector const& AbsoluteLocation, FRotator const& AbsoluteRotation, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActorAbsolute: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActorAbsolute(UClass* Class, FTransform const& Transform, const FActorSpawnParameters& SpawnParameters = FActorSpawnParameters())
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActorAbsolute: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    template <class T> T* SpawnActorDeferred(UClass* Class, FTransform const& Transform, AActor* Owner = nullptr, APawn* Instigator = nullptr, ESpawnActorCollisionHandlingMethod CollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::Undefined, ESpawnActorScaleMethod TransformScaleMethod = ESpawnActorScaleMethod::MultiplyWithRoot)
    { static_assert(std::is_base_of_v<AActor, T>, "SpawnActorDeferred: T must derive from AActor"); (void)&T::StaticClass; return nullptr; }
    bool DestroyActor(AActor* Actor, bool bNetForce = false, bool bShouldModifyLevel = true);
    bool EditorDestroyActor(AActor* Actor, bool bShouldModifyLevel);
    FDelegateHandle AddOnActorSpawnedHandler(const FOnActorSpawned::FDelegate& InHandler) const;
    void RemoveOnActorSpawnedHandler(FDelegateHandle InHandle) const;
    FDelegateHandle AddOnActorDestroyedHandler(const FOnActorDestroyed::FDelegate& InHandler) const;
    void RemoveOnActorDestroyedHandler(FDelegateHandle InHandle) const;
    // traces
    bool LineTraceTestByChannel(const FVector& Start, const FVector& End, ECollisionChannel TraceChannel, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool LineTraceTestByObjectType(const FVector& Start, const FVector& End, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool LineTraceTestByProfile(const FVector& Start, const FVector& End, FName ProfileName, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool LineTraceSingleByChannel(struct FHitResult& OutHit, const FVector& Start, const FVector& End, ECollisionChannel TraceChannel, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool LineTraceSingleByObjectType(struct FHitResult& OutHit, const FVector& Start, const FVector& End, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool LineTraceSingleByProfile(struct FHitResult& OutHit, const FVector& Start, const FVector& End, FName ProfileName, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool LineTraceMultiByChannel(TArray<struct FHitResult>& OutHits, const FVector& Start, const FVector& End, ECollisionChannel TraceChannel, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool LineTraceMultiByObjectType(TArray<struct FHitResult>& OutHits, const FVector& Start, const FVector& End, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool LineTraceMultiByProfile(TArray<struct FHitResult>& OutHits, const FVector& Start, const FVector& End, FName ProfileName, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool SweepTestByChannel(const FVector& Start, const FVector& End, const FQuat& Rot, ECollisionChannel TraceChannel, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool SweepTestByObjectType(const FVector& Start, const FVector& End, const FQuat& Rot, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool SweepTestByProfile(const FVector& Start, const FVector& End, const FQuat& Rot, FName ProfileName, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params) const;
    bool SweepSingleByChannel(struct FHitResult& OutHit, const FVector& Start, const FVector& End, const FQuat& Rot, ECollisionChannel TraceChannel, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool SweepSingleByObjectType(struct FHitResult& OutHit, const FVector& Start, const FVector& End, const FQuat& Rot, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool SweepSingleByProfile(struct FHitResult& OutHit, const FVector& Start, const FVector& End, const FQuat& Rot, FName ProfileName, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool SweepMultiByChannel(TArray<struct FHitResult>& OutHits, const FVector& Start, const FVector& End, const FQuat& Rot, ECollisionChannel TraceChannel, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool SweepMultiByObjectType(TArray<struct FHitResult>& OutHits, const FVector& Start, const FVector& End, const FQuat& Rot, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool SweepMultiByProfile(TArray<FHitResult>& OutHits, const FVector& Start, const FVector& End, const FQuat& Rot, FName ProfileName, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool OverlapBlockingTestByChannel(const FVector& Pos, const FQuat& Rot, ECollisionChannel TraceChannel, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool OverlapAnyTestByChannel(const FVector& Pos, const FQuat& Rot, ECollisionChannel TraceChannel, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool OverlapAnyTestByObjectType(const FVector& Pos, const FQuat& Rot, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool OverlapBlockingTestByProfile(const FVector& Pos, const FQuat& Rot, FName ProfileName, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool OverlapAnyTestByProfile(const FVector& Pos, const FQuat& Rot, FName ProfileName, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool OverlapMultiByChannel(TArray<struct FOverlapResult>& OutOverlaps, const FVector& Pos, const FQuat& Rot, ECollisionChannel TraceChannel, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam, const FCollisionResponseParams& ResponseParam = FCollisionResponseParams::DefaultResponseParam) const;
    bool OverlapMultiByObjectType(TArray<struct FOverlapResult>& OutOverlaps, const FVector& Pos, const FQuat& Rot, const FCollisionObjectQueryParams& ObjectQueryParams, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool OverlapMultiByProfile(TArray<struct FOverlapResult>& OutOverlaps, const FVector& Pos, const FQuat& Rot, FName ProfileName, const FCollisionShape& CollisionShape, const FCollisionQueryParams& Params = FCollisionQueryParams::DefaultQueryParam) const;
    bool ComponentOverlapMulti(TArray<struct FOverlapResult>& OutOverlaps, const class UPrimitiveComponent* PrimComp, const FVector& Pos, const FQuat& Rot, const FComponentQueryParams& Params = FComponentQueryParams::DefaultComponentQueryParam, const FCollisionObjectQueryParams& ObjectQueryParams = FCollisionObjectQueryParams::DefaultObjectQueryParam) const;
    bool ComponentSweepMulti(TArray<struct FHitResult>& OutHits, class UPrimitiveComponent* PrimComp, const FVector& Start, const FVector& End, const FQuat& Rot, const FComponentQueryParams& Params) const;
    bool FindTeleportSpot(const AActor* TestActor, FVector& PlaceLocation, FRotator PlaceRotation);
    bool EncroachingBlockingGeometry(const AActor* TestActor, FVector TestLocation, FRotator TestRotation, FVector* ProposedAdjustment = nullptr);
    // travel
    bool ServerTravel(const FString& InURL, bool bAbsolute = false, bool bShouldSkipGameNotify = false);
    void SeamlessTravel(const FString& InURL, bool bAbsolute = false);
    virtual UWorld* GetWorld() const override;
};

namespace UEStub { template <typename T> T* ResolveWorld(T* W) { return W; } }
