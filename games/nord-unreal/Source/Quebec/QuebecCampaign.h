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
    // Story tail. A version-1 slot leaves these at 0. Version 3 writes them. Version 2 is never written.
    UPROPERTY(VisibleAnywhere) int32 PondStep = 0;
    UPROPERTY(VisibleAnywhere) int32 CourtStep = 0;
    UPROPERTY(VisibleAnywhere) int32 ShowStep = 0;
    UPROPERTY(VisibleAnywhere) int32 RescueMask = 0;
    UPROPERTY(VisibleAnywhere) int32 ConvoyStep = 0;
    UPROPERTY(VisibleAnywhere) int32 BlankStep = 0;
    UPROPERTY(VisibleAnywhere) int32 TourStep = 0;
    UPROPERTY(VisibleAnywhere) int32 HomeStep = 0;
    // Escort tail. Version 3 leaves this at 0. Version 4 writes it.
    UPROPERTY(VisibleAnywhere) int32 EscortStep = 0;
    // Crossing tail. Version 4 leaves this at 0. Version 5 writes it. The lamp burn stays in the session.
    UPROPERTY(VisibleAnywhere) int32 ShadeStep = 0;
    bool IsSupported() const;
};

/** Story encounters. All objective decisions run on authority. Missions 3 through 10 persist on the version-3 tail. Mission 11 persists on version 4. Mission 12 persists on version 5. Completed missions stay 0–2. */
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
    bool GetBeatPace(int32& OutIndex, int32& OutCount, int32& OutWalkSeconds, int32& OutSprintSeconds) const;
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
    // Banked indexes from the rules headers. Kept here so this header stays free of those headers.
    // A version-1 boundary offers mission 3 again. A version-3 slot resumes these steps. The chain is not in the slot.
    static constexpr int32 PondBankedStep = 6;
    static constexpr int32 CourtBankedStep = 4;
    static constexpr int32 ShowBankedStep = 5;
    static constexpr int32 RescueDone = 7;
    static constexpr int32 ConvoyBankedStep = 4;
    static constexpr int32 BlankBankedStep = 4;
    static constexpr int32 TourBankedStep = 3;
    static constexpr int32 HomeBankedStep = 3;
    static constexpr int32 EscortBankedStep = 2;
    static constexpr int32 ShadeBankedStep = 2;
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
    bool IsTourOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= 0 && TourStep < TourBankedStep;
    }
    bool IsHomeOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= 0 && HomeStep < HomeBankedStep;
    }
    bool IsEscortOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= 0 && EscortStep < EscortBankedStep;
    }
    bool IsShadeOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= 0 && ShadeStep < ShadeBankedStep;
    }
    bool IsStoryBeatOpen() const { return IsPondOpen() || IsCourtOpen() || IsShowOpen() || IsRescueOpen() || IsConvoyOpen() || IsBlankOpen() || IsTourOpen() || IsHomeOpen() || IsEscortOpen() || IsShadeOpen(); }

    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) EQuebecCampaignPhase Phase = EQuebecCampaignPhase::AimWorklight;
    UPROPERTY(VisibleAnywhere, Replicated) int32 CompletedMissions = 0;
    // Written on the version-3 tail. The hold clocks below stay in the session.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 PondStep = 0;
    // Session-only clock for the steady beam. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, Replicated) bool bPondTagHolding = false;
    UPROPERTY(VisibleAnywhere, Replicated) float PondTagInside = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float PondTagOutside = 0.f;
    // Written on the version-3 tail. The miss count below stays in the session.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 CourtStep = 0;
    // Session-only. A spoiled bank increments it so the local rasp can hear the miss. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, Replicated) int32 CourtMisses = 0;
    // Session-only combo across the seven story banks. A miss zeroes it and spoils the open beat. Not written to the v1 slot.
    UPROPERTY(VisibleAnywhere, Replicated) int32 Chain = 0;
    UPROPERTY(VisibleAnywhere, Replicated) int32 ChainMask = 0;
    UPROPERTY(VisibleAnywhere, Replicated) bool bChainSpoiled = false;
    // Written on the version-3 tail.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ShowStep = 0;
    // Bitfield. Bits 0–2 are the terrace, the pond and the court. 7 means every group is out. Written on the version-3 tail.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 RescueMask = 0;
    // 0 walk-up, 1 beam gap, 2 invert the plate, 3 escape gate, 4 banked. Written on the version-3 tail.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ConvoyStep = 0;
    // 0–2 are the projection gates, 3 is the blank-page pull, 4 is banked. Written on the version-3 tail.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 BlankStep = 0;
    // 0 bike, 1 pedalo, 2 swim, 3 banked. Written on the version-3 tail. Not a chain link.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 TourStep = 0;
    // 0 bike stand, 1 pedalo berth, 2 south bank, 3 banked. Written on the story tail. Not a chain link.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 HomeStep = 0;
    // 0 meet Grey Coat, 1 walk them to the door, 2 banked. Written on the version-4 tail. Not a chain link.
    // The coat's place on the lawn is not saved. A reload during the walk puts them back at the meet.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 EscortStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float EscortFriendX = 29600.f;
    UPROPERTY(VisibleAnywhere, Replicated) float EscortFriendY = 16800.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bEscortPlanted = false;
    // 0 dark pocket, 1 crossing, 2 banked. Written on the version-5 tail. Not a chain link.
    // The lamp burn is not saved. A reload clears it and leaves the step where it was.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ShadeStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) bool bShadeBurned = false;
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
    UPROPERTY() TObjectPtr<UTextRenderComponent> EscortCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> EscortDoor;
    UPROPERTY() TObjectPtr<UTextRenderComponent> EscortDoorCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ShadePocket;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ShadeFar;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ShadeLampA;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ShadeLampB;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ShadePocketCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ShadeFarCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ShadeLampACaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ShadeLampBCaption;
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
    void TickPond(float DeltaSeconds);
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
    void TickTour();
    void AdvanceTour(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearTour(const AQuebecController* Controller, double X, double Y) const;
    void TickHome();
    void AdvanceHome(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearHome(const AQuebecController* Controller, double X, double Y) const;
    void TickEscort(float DeltaSeconds);
    void AdvanceEscort(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    bool NearEscort(const AQuebecController* Controller, double X, double Y) const;
    void TickShade();
    void AdvanceShade(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
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
