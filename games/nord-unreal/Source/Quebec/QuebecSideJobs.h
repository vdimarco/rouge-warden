#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecGTA.h"
#include "QuebecSideJobs.generated.h"

class AQuebecCar;
class AQuebecController;
class APawn;
class APlayerState;
class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

UENUM()
enum class EQuebecJobState : uint8 { Idle, Running, Succeeded, Failed };

/**
 * Street side jobs, separate from the story campaign and its save. One job runs at a time and both players share it.
 * A walking player starts it with E at a yellow 'M' marker; R inside a job restarts it. Every decision runs on the
 * server; clients read the replicated state below and build the markers locally. Nothing is saved: cash stays on
 * AQuebecPlayerState for the session. The rules and places are in QuebecJobRules.h.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecSideJobs : public AActor
{
    GENERATED_BODY()
    friend class FQuebecJobsLifecycleTest;
    friend class FQuebecJobsCleanupTest;
public:
    AQuebecSideJobs();
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static AQuebecSideJobs* Find(const UWorld* World);
    static const TCHAR* JobTitle(int32 Index);

    // Server: E from a walking player next to a marker. True when E was used here (a job started or a refusal shown).
    bool HandleInteract(AQuebecController* Player);
    // Server: R while a job runs, or within RetrySeconds after one failed, restarts that job from its marker and returns
    // true. R from a player who is down or in an officer's arrest hold is taken and ignored. False otherwise.
    bool RequestRetry(AQuebecController* Player);
    static constexpr float RetrySeconds = 30.f;
    // Down, or standing next to a police officer while wanted (the arrest hold). R must not move such a player.
    static bool IsHeldByPolice(const AQuebecController* Player);
    // Server: starts job Index for Player. Ends any running job first.
    bool StartJob(int32 Index, AQuebecController* Player);
    // Server: ends the running job, removes what it spawned and pays the reward on success.
    void FinishJob(bool bSucceeded, const FString& Reason);

    bool IsActive() const { return JobState == EQuebecJobState::Running && JobIndex != INDEX_NONE; }
    float GetRemainingSeconds() const;
    float GetServerNow() const;
    int32 NumMarkers() const { return MarkerPoints.Num(); }
    FVector GetMarker(int32 Index) const { return MarkerPoints.IsValidIndex(Index) ? MarkerPoints[Index] : FVector::ZeroVector; }
    // Free-roam guide index: the running job, else the nearest unfinished marker, else the nearest replay.
    // INDEX_NONE while the story campaign still owns the mission card, or when no marker exists.
    int32 GuideMarker(const FVector& From, bool bCampaignComplete) const;
    bool IsCompleted(int32 Index) const { return Index >= 0 && Index < 31 && (CompletedMask & (1 << Index)) != 0; }
    // The marker a walking pawn stands at, or INDEX_NONE. Every peer.
    int32 MarkerAt(const APawn* Pawn) const;
    // HUD prompt for the local player, empty when nothing to start here.
    FString GetPrompt(const APawn* Pawn) const;
    // Live target for the HUD: the thief's car while it drives, else TargetLocation.
    bool GetTarget(FVector& OutLocation) const;

    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Job) int32 JobIndex = INDEX_NONE;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Job) EQuebecJobState JobState = EQuebecJobState::Idle;
    // Delivery: 0 café, 1-3 doors. Goons: wave 0-2. Fare: 0 waiting, 1 aboard. Others stay 0.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Job) int32 JobStep = 0;
    // Server times. DeadlineTime 0 means untimed; clients subtract their server-time reading, so the timer stays smooth.
    UPROPERTY(VisibleAnywhere, Replicated) float StartedAt = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float DeadlineTime = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) FString ObjectiveText;
    UPROPERTY(VisibleAnywhere, Replicated) FVector TargetLocation = FVector::ZeroVector;
    UPROPERTY(VisibleAnywhere, Replicated) bool bHasTarget = false;
    // 0..1: the thief's damage, the share of goons down, the doors delivered.
    UPROPERTY(VisibleAnywhere, Replicated) float JobProgress = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<APlayerState> StarterState;
    // The thief's car while it drives, for the radar and the floating caption.
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<AActor> TargetActor;
    // A finished job bumps ResultSerial; the HUD shows MISSION DONE or MISSION FAILED when it changes.
    UPROPERTY(VisibleAnywhere, Replicated) int32 ResultSerial = 0;
    UPROPERTY(VisibleAnywhere, Replicated) int32 LastJob = INDEX_NONE;
    UPROPERTY(VisibleAnywhere, Replicated) bool bLastSucceeded = false;
    UPROPERTY(VisibleAnywhere, Replicated) int32 LastReward = 0;
    UPROPERTY(VisibleAnywhere, Replicated) FString LastResult;
    // One bit per job completed this session.
    UPROPERTY(VisibleAnywhere, Replicated) int32 CompletedMask = 0;
    // Server time until which R restarts LastJob after MISSION FAILED; 0 when no retry is offered.
    UPROPERTY(VisibleAnywhere, Replicated) float RetryUntil = 0.f;
    // Ground-traced marker points, readable by QA.
    UPROPERTY(VisibleAnywhere) TArray<FVector> MarkerPoints;

private:
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Sphere;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    UPROPERTY() TObjectPtr<UMaterialInterface> MarkerPaint;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> MarkerParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> MarkerLetters;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> MarkerTitles;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> GoalDisc;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> GoalColumn;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> GoalBag;
    UPROPERTY() TObjectPtr<UTextRenderComponent> GoalCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ThiefCaption;
    // Server: what the running job spawned. Removed at the end of the job.
    UPROPERTY() TObjectPtr<AQuebecCar> ThiefCar;
    UPROPERTY() TObjectPtr<AQuebecCar> LoanCar;
    UPROPERTY() TArray<TObjectPtr<AActor>> Goons;
    UPROPERTY() TObjectPtr<APlayerState> CarrierState;
    // Job cars that outlived their job. Each goes once no player can see it (TickLeftovers).
    UPROPERTY() TArray<TObjectPtr<AActor>> Leftovers;
    // Players already down when the job began; only a new K.-O. or arrest fails the job.
    TArray<TWeakObjectPtr<APlayerState>> DownAtStart;
    FString GoalLabel;
    float NextTargetWrite = 0.f;
    bool bBuilt = false;
    float LastPresentationTime = -1.f;
    // Server job bookkeeping.
    float OutsideSince = -1.f;
    float LostSince = -1.f;
    // Seconds the fare's passenger has been without a driver. Reset when someone is in a car.
    float FareOnFoot = 0.f;
    float NextTargetRefresh = 0.f;
    float NextWaveAt = -1.f;
    bool bSawStars = false;
    // Thief driving.
    int32 ThiefSegment = INDEX_NONE;
    bool bThiefForward = true;
    float ThiefSlowSince = -1.f;
    float ThiefReverseUntil = -1.f;
    float LastRamAt = -10.f;
    FVector LastThiefVelocity = FVector::ZeroVector;

    void BuildMarkers();
    UStaticMeshComponent* AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size);
    UTextRenderComponent* AddCaption(FName Name, const FVector& Point, const FString& Words, float WorldSize, const FColor& Color);
    FVector GroundPoint(const FVector& Point, float Lift) const;
    AQuebecController* FindStarter() const;
    APawn* NearestPlayerPawn(const FVector& Point, float* OutDistance = nullptr) const;
    void Say(const FString& Title, const FString& Detail, float Seconds = 3.f) const;
    void SetObjective(const FString& Words, const FVector& Location, bool bTarget);
    // A player at Point (Radius 0 uses the walker/car arrival rule). Only, when set, limits the test to that player.
    bool ReachedBy(const FVector& Point, double Radius, APlayerState** OutWho, const APlayerState* Only = nullptr) const;
    void GrantPistols();
    void RetireActor(AActor* Actor);
    void TickLeftovers();
    void BeginJobContent(AQuebecController* Player);
    void ClearJobContent();
    void TickJob(float DeltaSeconds);
    void TickDelivery();
    void TickThief(float Now, float DeltaSeconds);
    void TickGoons(float Now);
    void TickEscape(float Now);
    void TickPosters();
    void TickFare(float DeltaSeconds);
    AQuebecCar* SpawnJobCar(const FVector& Point, const FVector& Heading, int32 Paint, FName Tag) const;
    void SpawnWave(int32 Wave);
    void DriveThief(float Now);
    void ChooseThiefRoad(const FVector& Junction);
    bool MovePlayerToMarker(AQuebecController* Player, int32 Index);
    UFUNCTION() void OnRep_Job();
    void UpdatePresentation();
};
