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

/** Story encounters. All objective decisions run on authority. Missions 3, 4 and 5 are session state on top of a finished race. */
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
    bool GetNextObjectiveLocation(FVector& Out) const;
    bool GetBeatPace(int32& OutIndex, int32& OutCount, int32& OutWalkSeconds) const;
    // Session chain. Not written to the v1 slot. A miss spoils the open beat.
    bool GetChainStake(int32& OutChain, int32& OutPay, bool& bOutBroken) const;
    // Tenths of a second still clear on the court return or the convoy gap. False on every other step.
    bool GetClearWindow(int32& OutTenths) const;
    // What a close call pays on the court return or the convoy gap. False on every other step.
    bool GetCloseOffer(int32& OutPay) const;
    int32 JobStake(int32 BasePay) const;
    // A side job pays on the same chain. Failure breaks it. The story mask stays.
    int32 ApplyJobChain(int32 BasePay, bool bSucceeded);
    int32 GetCompletedMissionCount() const { return CompletedMissions; }
    bool IsCampaignComplete() const { return Phase == EQuebecCampaignPhase::Complete; }
    // Banked indexes from the rules headers. Kept here so the save header stays free of those headers.
    // A boundary-2 save offers mission 3 again each session. PondStep, CourtStep, ShowStep, RescueMask, ConvoyStep and BlankStep are not written to the slot.
    static constexpr int32 PondBankedStep = 6;
    static constexpr int32 CourtBankedStep = 4;
    static constexpr int32 ShowBankedStep = 5;
    static constexpr int32 RescueDone = 7;
    static constexpr int32 ConvoyBankedStep = 4;
    static constexpr int32 BlankBankedStep = 4;
    bool IsPondOpen() const { return Phase == EQuebecCampaignPhase::Complete && PondStep < PondBankedStep; }
    bool IsCourtOpen() const { return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep < CourtBankedStep; }
    bool IsShowOpen() const { return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep && ShowStep < ShowBankedStep; }
    bool IsRescueOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= 0 && RescueMask < RescueDone;
    }
    bool IsConvoyOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= 0 && ConvoyStep < ConvoyBankedStep;
    }
    bool IsBlankOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= 0 && BlankStep < BlankBankedStep;
    }
    bool IsStoryBeatOpen() const { return IsPondOpen() || IsCourtOpen() || IsShowOpen() || IsRescueOpen() || IsConvoyOpen() || IsBlankOpen(); }

    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) EQuebecCampaignPhase Phase = EQuebecCampaignPhase::AimWorklight;
    UPROPERTY(VisibleAnywhere, Replicated) int32 CompletedMissions = 0;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 PondStep = 0;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 CourtStep = 0;
    // Session-only. A spoiled bank increments it so the local rasp can hear the miss. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, Replicated) int32 CourtMisses = 0;
    // Session-only combo across the seven story banks. A miss zeroes it and spoils the open beat. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, Replicated) int32 Chain = 0;
    UPROPERTY(VisibleAnywhere, Replicated) int32 ChainMask = 0;
    UPROPERTY(VisibleAnywhere, Replicated) bool bChainSpoiled = false;
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ShowStep = 0;
    // Session-only bitfield. Bits 0–2 are the terrace, the pond and the court. 7 means every group is out. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 RescueMask = 0;
    // Session-only. 0 walk-up, 1 beam gap, 2 invert the plate, 3 escape gate, 4 banked. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ConvoyStep = 0;
    // Session-only. 0–2 are the projection gates, 3 is the blank-page pull, 4 is banked. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 BlankStep = 0;
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
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> PondParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> PondCaptions;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> CourtParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> CourtCaptions;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> ShowParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> ShowCaptions;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> RescueParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> RescueCaptions;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> ConvoyParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> ConvoyCaptions;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> BlankParts;
    UPROPERTY() TArray<TObjectPtr<UTextRenderComponent>> BlankCaptions;
    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Sphere;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    TArray<float> GateDistances;
    TMap<TWeakObjectPtr<AQuebecCar>,FVector> LastCarPositions;
    TMap<TWeakObjectPtr<AQuebecCar>,float> TrappedUntil;
    TMap<TWeakObjectPtr<AQuebecController>,FVector> LastWalkerPositions;
    struct FPondSample
    {
        FVector Where = FVector::ZeroVector;
        bool bWasFar = false;
        bool bSeen = false;
    };
    TMap<TWeakObjectPtr<AQuebecController>,FPondSample> PondSamples;
    TWeakObjectPtr<AQuebecController> ActiveLightController;
    float LightHold = 0.f;
    float LastAimTime = 0.f;
    float RivalDistance = 0.f;
    float LastPresentationTime = -1.f;
    bool bBuilt = false;
    bool bSaveBlocked = false;
    void RecordRaceResult();
    void BankChain(int32 Link);
    void GrantCash(int32 Amount);
    void BreakChain();
    void ShowStepMessage(AQuebecController* Who, const TCHAR* Message, bool bFinished, int32 Link);
    int32 LastChainPay = 0;

    void BuildEncounter();
    void SetupRaceRoute();
    void TickTerrace(float DeltaSeconds);
    void TickRace(float DeltaSeconds);
    void TickPond();
    void AdvancePond(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearPond(const AQuebecController* Controller, double X, double Y) const;
    void TickCourt();
    void AdvanceCourt(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearCourt(const AQuebecController* Controller, double X, double Y) const;
    void TickShow();
    void AdvanceShow(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearShow(const AQuebecController* Controller, double X, double Y) const;
    void AdvanceRescue(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearRescue(const AQuebecController* Controller, double X, double Y) const;
    void TickConvoy();
    void AdvanceConvoy(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearConvoy(const AQuebecController* Controller, double X, double Y) const;
    void TickBlank();
    void AdvanceBlank(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearBlank(const AQuebecController* Controller, double X, double Y) const;
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
