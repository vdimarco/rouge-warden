#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/SaveGame.h"
#include "QuebecCampaign.generated.h"

class AQuebecController;
class AQuebecCar;
class APlayerState;
class UStaticMesh;
class UStaticMeshComponent;
class USceneComponent;
class USpotLightComponent;
class UTextRenderComponent;

UENUM(BlueprintType)
enum class EQuebecCampaignPhase : uint8
{
    AimWorklight,
    CrossCable,
    PullClamp,
    ParkCarLight,
    ReleaseTable,
    RaceReady,
    RaceRunning,
    Complete
};

UCLASS()
class QUEBEC_API UQuebecCampaignSaveGame : public USaveGame
{
    GENERATED_BODY()
public:
    UPROPERTY(VisibleAnywhere) int32 Version = 0;
    UPROPERTY(VisibleAnywhere) int32 CompletedMissions = -1;
    bool IsSupported() const { return Version == 1 && CompletedMissions >= 0 && CompletedMissions <= 2; }
};

/** First two campaign encounters. All objective decisions run on authority. */
UCLASS()
class QUEBEC_API AQuebecCampaign : public AActor
{
    GENERATED_BODY()
    friend class FQuebecRaceResultTest;
public:
    AQuebecCampaign();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    bool HandleInteract(AQuebecController* Controller);
    bool IsAimingLight(const AQuebecController* Controller) const;
    void LightAim(AQuebecController* Controller, float Yaw, float Pitch);
    void ReleaseBrowserInput(AQuebecController* Controller);
    void RequestRetry(AQuebecController* Controller);
    void RequestReplay(AQuebecController* Controller);
    FString GetInteractionPrompt(const AQuebecController* Controller) const;
    FString GetMissionTitle() const;
    FString GetObjectiveText() const;
    FString GetBriefingText() const;
    FString GetStatusText() const;
    FVector GetObjectiveLocation() const;
    int32 GetCompletedMissionCount() const { return CompletedMissions; }
    bool IsCampaignComplete() const { return Phase == EQuebecCampaignPhase::Complete; }

    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) EQuebecCampaignPhase Phase = EQuebecCampaignPhase::AimWorklight;
    UPROPERTY(VisibleAnywhere, Replicated) int32 CompletedMissions = 0;
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<APlayerState> LightOperator;
    UPROPERTY(VisibleAnywhere, Replicated) float LightYaw = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float LightPitch = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float LightAlignment = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float LightHoldProgress = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) FString SaveStatus;
    UPROPERTY(VisibleAnywhere, Replicated) bool bSprintSeen = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bJumpSeen = false;
    UPROPERTY(VisibleAnywhere, Replicated) int32 RaceGateIndex = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float RaceStartTime = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float RaceElapsed = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float LastRaceTime = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float BestCleanRaceTime = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bLastRaceRetried = false;
    UPROPERTY(VisibleAnywhere, Replicated) float RaceTimeLimit = 180.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bRaceRetried = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bRaceTimedOut = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bClampOpen = false;
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<AQuebecCar> LightCar;
    UPROPERTY(VisibleAnywhere, Replicated) TObjectPtr<AQuebecCar> LoanCar;
    UPROPERTY(VisibleAnywhere, Replicated) FVector RivalLocation;
    UPROPERTY(VisibleAnywhere, Replicated) float RivalYaw = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float PlungerPullTime = -10.f;
    UPROPERTY(VisibleAnywhere, Replicated) FVector PlungerPoint;

    // Authored on clear surveyed ground. These are readable QA/camera anchors,
    // not state-mutating test hooks. All Z values are world-space centimetres.
    UPROPERTY(VisibleAnywhere) FVector WorklightLocation = FVector(5550.,2460.,90.);
    UPROPERTY(VisibleAnywhere) FVector JumpGateLocation = FVector(5550.,2820.,7.);
    UPROPERTY(VisibleAnywhere) FVector FirstClampLocation = FVector(5550.,3270.,130.);
    UPROPERTY(VisibleAnywhere) FVector CarLightLocation = FVector(5700.,2200.,102.);
    UPROPERTY(VisibleAnywhere) FVector FinalClampLocation = FVector(5550.,3520.,130.);
    UPROPERTY(VisibleAnywhere) TArray<FVector> RaceGates;
    UPROPERTY(VisibleAnywhere) TArray<FVector> RaceDirections;
    UPROPERTY(VisibleAnywhere) TArray<FVector> RaceRoute;
    UPROPERTY(VisibleAnywhere) FVector TrapLocation;

private:
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<USceneComponent> LampPivot;
    UPROPERTY() TObjectPtr<USpotLightComponent> Worklight;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> LightRay;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> CarRay;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FirstClamp;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinalClamp;
    UPROPERTY() TObjectPtr<USceneComponent> Rival;
    UPROPERTY() TObjectPtr<USceneComponent> Plunger;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> Souvenir;
    UPROPERTY() TObjectPtr<UTextRenderComponent> LampCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ClampCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BayCaption;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Cutouts;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> GateParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> GateCaptions;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> PressParts;
    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Sphere;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    TArray<float> GateDistances;
    TMap<TWeakObjectPtr<AQuebecCar>,FVector> LastCarPositions;
    TMap<TWeakObjectPtr<AQuebecCar>,float> TrappedUntil;
    TMap<TWeakObjectPtr<AQuebecController>,FVector> LastWalkerPositions;
    TWeakObjectPtr<AQuebecController> ActiveLightController;
    float LightHold = 0.f;
    float LastAimTime = 0.f;
    float RivalDistance = 0.f;
    float LastPresentationTime = -1.f;
    bool bBuilt = false;
    bool bSaveBlocked = false;
    void RecordRaceResult();

    void BuildEncounter();
    void SetupRaceRoute();
    void TickTerrace(float DeltaSeconds);
    void TickRace(float DeltaSeconds);
    void ChangePhase(EQuebecCampaignPhase Next, bool bFeedback = true);
    void StopAiming();
    void SaveBoundary();
    FString SaveSlot() const;
    bool CanReach(const AQuebecController* Controller, const FVector& Point, float Radius) const;
    bool CarLightAligned() const;
    bool MoveToSafeCheckpoint(AQuebecController* Controller, const FVector& Point, const FRotator& Rotation);
    UStaticMeshComponent* AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size,
        const TCHAR* Material, bool bBlocking = false, USceneComponent* Parent = nullptr);
    UTextRenderComponent* AddCaption(FName Name, const FVector& Point, const FString& Text, float Size = 30.f);
    UFUNCTION() void UpdatePresentation();
};
