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
    // Grab tail. Version 5 leaves this at 0. Version 6 writes it. The clock stays in the session.
    UPROPERTY(VisibleAnywhere) int32 GrabStep = 0;
    // Short-way tail. Version 6 leaves this at 0. Version 7 writes it. The rival's clock stays in the session.
    UPROPERTY(VisibleAnywhere) int32 CutStep = 0;
    // Chase tail. Version 7 leaves this at 0. Version 8 writes it. The tail's place on the road stays in the session.
    UPROPERTY(VisibleAnywhere) int32 ChaseStep = 0;
    // Finale tail. Version 8 leaves this at 0. Version 9 writes it. The burn, the clocks, and the tail's place stay in the session.
    UPROPERTY(VisibleAnywhere) int32 FinaleStep = 0;
    // Follow tail. Version 9 leaves this at 0. Version 10 writes it. Their place on the path stays in the session.
    UPROPERTY(VisibleAnywhere) int32 FollowStep = 0;
    // Cart tail. Version 10 leaves this at 0. Version 11 writes it. How far it has rolled stays in the session.
    UPROPERTY(VisibleAnywhere) int32 RollStep = 0;
    // Bell tail. Version 11 leaves this at 0. Version 12 writes which bell is next.
    UPROPERTY(VisibleAnywhere) int32 BellStep = 0;
    // Block tail. Version 12 leaves this at 0. Version 13 writes it. How far the courier has driven stays in the session.
    UPROPERTY(VisibleAnywhere) int32 BlockStep = 0;
    // Send-off tail. Version 13 leaves this at 0. Version 14 writes it. How far the drive got stays in the session.
    UPROPERTY(VisibleAnywhere) int32 SendStep = 0;
    // Pursuit tail. Version 14 leaves this at 0. Version 15 writes it. How far the traffic car has driven stays in the session.
    UPROPERTY(VisibleAnywhere) int32 PursueStep = 0;
    // Stall tail. Version 15 leaves this at 0. Version 16 writes it. The reverse itself stays in the session.
    UPROPERTY(VisibleAnywhere) int32 NoseStep = 0;
    // Slip tail. Version 16 leaves this at 0. Version 17 writes it. Their place stays in the session.
    UPROPERTY(VisibleAnywhere) int32 SlipStep = 0;
    // March tail. Version 17 leaves this at 0. Version 18 writes it. Where they have walked stays in the session.
    UPROPERTY(VisibleAnywhere) int32 MarchStep = 0;
    // Ditch tail. Version 18 leaves this at 0. Version 19 writes it. How far the chase car has driven stays in the session.
    UPROPERTY(VisibleAnywhere) int32 DitchStep = 0;
    // Parcel tail. Version 19 leaves this at 0. Version 20 writes it. The clock and the street cars stay in the session.
    UPROPERTY(VisibleAnywhere) int32 ParcelStep = 0;
    // Bolt tail. Version 20 leaves this at 0. Version 21 writes it. The seeker and the escape clock stay in the session.
    UPROPERTY(VisibleAnywhere) int32 BoltStep = 0;
    // Yard tail. Version 21 leaves this at 0. Version 22 writes it. Where they are looking, and whether the crossing is armed, stay in the session.
    UPROPERTY(VisibleAnywhere) int32 YardStep = 0;
    // Lift tail. Version 22 leaves this at 0. Version 23 writes it. Where they are on the walk stays in the session.
    UPROPERTY(VisibleAnywhere) int32 LiftStep = 0;
    bool IsSupported() const;
};

/** Story encounters. All objective decisions run on authority. Missions 3 through 10 persist on the version-3 tail. Mission 11 persists on version 4. Mission 12 persists on version 5. Mission 13 persists on version 6. Mission 14 persists on version 7. Mission 15 persists on version 8. Mission 16 persists on version 9. Mission 17 persists on version 10. Mission 18 persists on version 11. Mission 19 persists on version 12. Mission 20 persists on version 13. Mission 21 persists on version 14. Mission 22 persists on version 15. Mission 23 persists on version 16. Mission 24 persists on version 17. Mission 25 persists on version 18. Mission 26 persists on version 19. Mission 27 persists on version 20. Mission 28 persists on version 21. Mission 29 persists on version 22. Mission 30 persists on version 23. Completed missions stay 0–2. */
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
    static constexpr int32 GrabBankedStep = 2;
    static constexpr int32 CutBankedStep = 2;
    static constexpr int32 ChaseBankedStep = 2;
    static constexpr int32 FinaleBankedStep = 5;
    static constexpr int32 FollowBankedStep = 2;
    static constexpr int32 RollBankedStep = 2;
    static constexpr int32 BellBankedStep = 3;
    static constexpr int32 BlockBankedStep = 2;
    static constexpr int32 SendBankedStep = 4;
    static constexpr int32 PursueBankedStep = 1;
    static constexpr int32 NoseBankedStep = 1;
    static constexpr int32 SlipBankedStep = 2;
    static constexpr int32 MarchBankedStep = 3;
    static constexpr int32 DitchBankedStep = 3;
    static constexpr int32 ParcelBankedStep = 2;
    static constexpr int32 BoltBankedStep = 3;
    static constexpr int32 YardBankedStep = 1;
    static constexpr int32 LiftBankedStep = 1;
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
    bool IsGrabOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep
            && GrabStep >= 0 && GrabStep < GrabBankedStep;
    }
    bool IsCutOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= 0 && CutStep < CutBankedStep;
    }
    bool IsChaseOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= 0 && ChaseStep < ChaseBankedStep;
    }
    bool IsFinaleOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep
            && FinaleStep >= 0 && FinaleStep < FinaleBankedStep;
    }
    bool IsFollowOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= 0 && FollowStep < FollowBankedStep;
    }
    bool IsRollOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep
            && RollStep >= 0 && RollStep < RollBankedStep;
    }
    bool IsBellOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep
            && BellStep >= 0 && BellStep < BellBankedStep;
    }
    bool IsBlockOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= 0 && BlockStep < BlockBankedStep;
    }
    bool IsSendOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep
            && SendStep >= 0 && SendStep < SendBankedStep;
    }
    bool IsPursueOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep
            && PursueStep >= 0 && PursueStep < PursueBankedStep;
    }
    bool IsNoseOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= 0 && NoseStep < NoseBankedStep;
    }
    bool IsSlipOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep
            && SlipStep >= 0 && SlipStep < SlipBankedStep;
    }
    bool IsMarchOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep && SlipStep >= SlipBankedStep
            && MarchStep >= 0 && MarchStep < MarchBankedStep;
    }
    bool IsDitchOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep && SlipStep >= SlipBankedStep && MarchStep >= MarchBankedStep
            && DitchStep >= 0 && DitchStep < DitchBankedStep;
    }
    bool IsParcelOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep && SlipStep >= SlipBankedStep && MarchStep >= MarchBankedStep
            && DitchStep >= DitchBankedStep
            && ParcelStep >= 0 && ParcelStep < ParcelBankedStep;
    }
    bool IsBoltOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep && SlipStep >= SlipBankedStep && MarchStep >= MarchBankedStep
            && DitchStep >= DitchBankedStep && ParcelStep >= ParcelBankedStep
            && BoltStep >= 0 && BoltStep < BoltBankedStep;
    }
    bool IsYardOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep && SlipStep >= SlipBankedStep && MarchStep >= MarchBankedStep
            && DitchStep >= DitchBankedStep && ParcelStep >= ParcelBankedStep && BoltStep >= BoltBankedStep
            && YardStep >= 0 && YardStep < YardBankedStep;
    }
    bool IsLiftOpen() const
    {
        return Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep
            && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep
            && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep
            && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep
            && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep
            && FollowStep >= FollowBankedStep && RollStep >= RollBankedStep && BellStep >= BellBankedStep
            && BlockStep >= BlockBankedStep && SendStep >= SendBankedStep && PursueStep >= PursueBankedStep
            && NoseStep >= NoseBankedStep && SlipStep >= SlipBankedStep && MarchStep >= MarchBankedStep
            && DitchStep >= DitchBankedStep && ParcelStep >= ParcelBankedStep && BoltStep >= BoltBankedStep
            && YardStep >= YardBankedStep
            && LiftStep >= 0 && LiftStep < LiftBankedStep;
    }
    bool IsStoryBeatOpen() const { return IsPondOpen() || IsCourtOpen() || IsShowOpen() || IsRescueOpen() || IsConvoyOpen() || IsBlankOpen() || IsTourOpen() || IsHomeOpen() || IsEscortOpen() || IsShadeOpen() || IsGrabOpen() || IsCutOpen() || IsChaseOpen() || IsFinaleOpen() || IsFollowOpen() || IsRollOpen() || IsBellOpen() || IsBlockOpen() || IsSendOpen() || IsPursueOpen() || IsNoseOpen() || IsSlipOpen() || IsMarchOpen() || IsDitchOpen() || IsParcelOpen() || IsBoltOpen() || IsYardOpen() || IsLiftOpen(); }

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
    // 0 the case, 1 the window, 2 banked. Written on the version-6 tail. Not a chain link.
    // The clock is not saved. A reload during the run gives the full window again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 GrabStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float GrabElapsed = 0.f;
    // 0 the line, 1 the race, 2 banked. Written on the version-7 tail. Not a chain link.
    // The rival's clock is not saved. A reload during the race puts them back on the line.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 CutStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float CutElapsed = 0.f;
    // 0 the seat, 1 the tail, 2 banked. Written on the version-8 tail. Not a chain link.
    // The tail's place on the road is not saved. A reload during the chase puts them back behind the seat.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ChaseStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float ChaseTailX = 55790.8f;
    UPROPERTY(VisibleAnywhere, Replicated) float ChaseTailY = 14839.1f;
    // 0 meet, 1 dark, 2 page, 3 cut, 4 chase, 5 banked. Written on the version-9 tail. Not a chain link.
    // The burn, the page clock, the rival's clock, and this tail's place are not saved.
    // A reload keeps the stage and clears those.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 FinaleStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) bool bFinaleBurned = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bFinaleHolding = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bFinaleRacing = false;
    UPROPERTY(VisibleAnywhere, Replicated) bool bFinaleTailing = false;
    UPROPERTY(VisibleAnywhere, Replicated) float FinaleElapsed = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float FinaleTailX = 36946.3f;
    UPROPERTY(VisibleAnywhere, Replicated) float FinaleTailY = -10553.7f;
    // 0 meet, 1 keep the gap, 2 banked. Written on the version-10 tail. Not a chain link.
    // Their place on the path is not saved. A reload during the walk puts them back at the corner.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 FollowStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float FollowAlong = 0.f;
    // 0 the handles, 1 the roll, 2 banked. Written on the version-11 tail. Not a chain link.
    // How far the cart has rolled is not saved. A reload during the roll puts it back at the start.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 RollStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float RollAlong = 0.f;
    // 0 north, 1 middle, 2 south, 3 banked. Written on the version-12 tail. Not a chain link.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 BellStep = 0;
    // 0 the side street, 1 the courier is out, 2 banked. Written on the version-13 tail. Not a chain link.
    // How far the courier has driven is not saved. A reload during the run puts them back at the north end.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 BlockStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float BlockAlong = 0.f;
    // 0 the door, 1 the gentle drive, 2 the stop, 3 the walk, 4 banked. Written on the version-14 tail. Not a chain link.
    // How far the drive got is not saved. A reload during the drive starts that distance again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 SendStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float SendDriven = 0.f;
    // 0 the hunt, 1 banked. Written on the version-15 tail. Not a chain link.
    // How far the traffic car has driven is not saved. A reload puts it ahead of the near end again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 PursueStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float PursueAlong = 0.f;
    // 0 the stall, 1 banked. Written on the version-16 tail. Not a chain link.
    // The reverse itself is not saved. A reload keeps the step.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 NoseStep = 0;
    // 0 the door, 1 the sprint, 2 banked. Written on the version-17 tail. Not a chain link.
    // Their place is not saved. A reload during the sprint puts them behind the door again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 SlipStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float SlipX = 12800.f;
    UPROPERTY(VisibleAnywhere, Replicated) float SlipY = 15600.f;
    // 0 join, 1 inside the march, 2 step out, 3 banked. Written on the version-18 tail. Not a chain link.
    // Where they have walked is not saved. A reload during the march puts them back at the join.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 MarchStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float MarchY = 16800.f;
    // 0 the rolling line, 1 the chase, 2 the clear mark, 3 banked. Written on the version-19 tail. Not a chain link.
    // How far the chase car has driven is not saved. A reload during the chase puts them at the near end again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 DitchStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float DitchAlong = 0.f;
    // 0 the parcel, 1 the crossing, 2 banked. Written on the version-20 tail. Not a chain link.
    // The clock and where the street cars are are not saved. A reload during the crossing starts the clock again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 ParcelStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float ParcelClock = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float ParcelAlongA = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float ParcelAlongB = 0.f;
    // 0 the drive, 1 the chase, 2 the gate, 3 banked. Written on the version-21 tail. Not a chain link.
    // Where the seeker is, and the escape clock, are not saved. A reload puts the seeker behind the end again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 BoltStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float BoltClock = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float BoltSeekX = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float BoltSeekY = 0.f;
    // 0 the crossing, 1 banked. Written on the version-22 tail. Not a chain link.
    // Where they are looking, and whether the crossing is armed, are not saved. A reload starts the look again.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 YardStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float YardAngle = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bYardArmed = false;
    // 0 the wait, 1 banked. Written on the version-23 tail. Not a chain link.
    // Where they are on the walk is not saved. A reload puts them back at the door.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=UpdatePresentation) int32 LiftStep = 0;
    UPROPERTY(VisibleAnywhere, Replicated) float LiftAlong = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) bool bLiftComing = false;
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
    UPROPERTY() TObjectPtr<UStaticMeshComponent> GrabCase;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> GrabDrop;
    UPROPERTY() TObjectPtr<UTextRenderComponent> GrabCaseCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> GrabDropCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> CutLine;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> CutFinish;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> CutRival;
    UPROPERTY() TObjectPtr<UTextRenderComponent> CutLineCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> CutFinishCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> CutRivalCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ChaseSeat;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ChaseHide;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ChaseTail;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ChaseSeatCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ChaseHideCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ChaseTailCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleMeet;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinalePocket;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleFar;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleLampA;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleLampB;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleCase;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleDrop;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleLine;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleFinish;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleRival;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleSeat;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleHide;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FinaleTail;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleMeetCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinalePocketCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleFarCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleLampACaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleLampBCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleCaseCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleDropCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleLineCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleFinishCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleRivalCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleSeatCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleHideCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FinaleTailCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FollowMeet;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FollowPerson;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> FollowStop;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FollowMeetCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FollowPersonCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> FollowStopCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> RollHandles;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> RollCart;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> RollStop;
    UPROPERTY() TObjectPtr<UTextRenderComponent> RollHandlesCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> RollCartCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> RollStopCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BellNorth;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BellMid;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BellSouth;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BellNorthCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BellMidCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BellSouthCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BlockSide;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BlockMark;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BlockCourier;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BlockSideCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BlockMarkCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BlockCourierCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SendDoor;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SendGate;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SendBay;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SendWalk;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SendDoorCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SendGateCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SendBayCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SendWalkCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> PursueLine;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> PursueCar;
    UPROPERTY() TObjectPtr<UTextRenderComponent> PursueLineCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> PursueCarCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> NoseStall;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> NoseLine;
    UPROPERTY() TObjectPtr<UTextRenderComponent> NoseStallCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> NoseLineCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SlipDoor;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SlipGate;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> SlipThem;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SlipDoorCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SlipGateCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> SlipThemCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> MarchJoinMark;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> MarchLeaveMark;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> MarchGroup;
    UPROPERTY() TObjectPtr<UTextRenderComponent> MarchJoinCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> MarchLeaveCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> MarchGroupCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> DitchLine;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> DitchClear;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> DitchThem;
    UPROPERTY() TObjectPtr<UTextRenderComponent> DitchLineCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> DitchClearCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> DitchThemCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ParcelMark;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ParcelStoop;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ParcelCarA;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> ParcelCarB;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ParcelMarkCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ParcelStoopCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ParcelCarACaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> ParcelCarBCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BoltEnd;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BoltBay;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BoltGate;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> BoltThem;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BoltEndCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BoltBayCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BoltGateCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> BoltThemCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> YardNear;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> YardFar;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> YardWatch;
    UPROPERTY() TObjectPtr<UTextRenderComponent> YardNearCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> YardFarCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> YardWatchCaption;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> LiftStop;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> LiftThem;
    UPROPERTY() TObjectPtr<UTextRenderComponent> LiftStopCaption;
    UPROPERTY() TObjectPtr<UTextRenderComponent> LiftThemCaption;
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
    // Session only. An early bell warns once until the player leaves it. Not saved.
    bool bBellWarned = false;
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
    void TickGrab(float DeltaSeconds);
    void AdvanceGrab(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickCut(float DeltaSeconds);
    void AdvanceCut(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickChase(float DeltaSeconds);
    void AdvanceChase(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickFinale(float DeltaSeconds);
    void AdvanceFinale(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickFollow(float DeltaSeconds);
    void AdvanceFollow(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickRoll(float DeltaSeconds);
    void AdvanceRoll(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickBell();
    void AdvanceBell(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickBlock(float DeltaSeconds);
    void AdvanceBlock(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickSend(float DeltaSeconds);
    void AdvanceSend(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickPursue(float DeltaSeconds);
    void AdvancePursue(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickNose();
    void AdvanceNose(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickSlip(float DeltaSeconds);
    void AdvanceSlip(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickMarch(float DeltaSeconds);
    void AdvanceMarch(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickDitch(float DeltaSeconds);
    void AdvanceDitch(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickParcel(float DeltaSeconds);
    void AdvanceParcel(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickBolt(float DeltaSeconds);
    void AdvanceBolt(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickYard(float DeltaSeconds);
    void AdvanceYard(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
    void TickLift(float DeltaSeconds);
    void AdvanceLift(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished);
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
