#include "QuebecSideJobs.h"
#include "QuebecCampaign.h"
#include "QuebecGameplay.h"
#include "QuebecJobRules.h"
#include "QuebecPlayerState.h"
#include "QuebecPolice.h"
#include "LaFontaineMap.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Misc/AutomationTest.h"

namespace
{
    // An isolated standalone world: every actor has authority, BeginPlay is not dispatched and time is set by hand.
    struct FQuebecJobsWorld
    {
        UWorld* World = nullptr;
        AQuebecController* Player = nullptr;
        AQuebecPlayerState* Stats = nullptr;
        AQuebecSideJobs* Jobs = nullptr;

        FQuebecJobsWorld()
        {
            UWorld::InitializationValues Initialization;
            Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
            if (!World) return;
            FActorSpawnParameters Spawn;
            Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            Player = World->SpawnActor<AQuebecController>(Spawn);
            Stats = World->SpawnActor<AQuebecPlayerState>(Spawn);
            if (Player && Stats) Player->PlayerState = Stats;
            if (Player) Player->SetAsLocalPlayerController();
            World->InitializeActorsForPlay(FURL());
            Jobs = World->SpawnActor<AQuebecSideJobs>(Spawn);
            World->TimeSeconds = 10.;
        }
        ~FQuebecJobsWorld()
        {
            if (World) World->DestroyWorld(false);
        }
        bool IsReady() const { return World && Player && Stats && Jobs; }
    };

    FVector JobsTestVector(const QuebecJobRules::FJobSpot& Spot)
    {
        return FVector(Spot.X, Spot.Y, Spot.Z);
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecJobsClearanceTest, "Quebec.Jobs.MarkerClearance",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecJobsClearanceTest::RunTest(const FString& Parameters)
{
    // The live QA anchors: campaign fixtures and race gates from the campaign's own constructor, the legacy
    // objectives, the spawn, the starter car and the smoke walk start (car + 10 m along its yaw).
    const AQuebecCampaign* Campaign = GetDefault<AQuebecCampaign>();
    TArray<FVector> Anchors = {Campaign->WorklightLocation, Campaign->JumpGateLocation, Campaign->FirstClampLocation,
        Campaign->CarLightLocation, Campaign->FinalClampLocation, FVector(5550., 1700., 102.), Campaign->TrapLocation,
        LaFontaine::Spawn, LaFontaine::CarSpawn, FVector(37887.3, -6298.4, 115.)};
    Anchors.Append(Campaign->RaceGates);
    if (Campaign->RaceGates.Num() > 0 && Campaign->RaceDirections.Num() > 0)
    {
        const FVector Direction = Campaign->RaceDirections[0];
        Anchors.Add(Campaign->RaceGates[0] - Direction * 650.f + FVector(-Direction.Y, Direction.X, 0.).GetSafeNormal() * 145.f);
    }
    for (const FVector& Mission : AQuebecGameState::MissionLocations) Anchors.Add(Mission);
    // The engine-free table must keep up with the campaign, or the CPU test would check stale points.
    for (const FVector& Gate : Campaign->RaceGates)
    {
        double Best = TNumericLimits<double>::Max();
        for (const QuebecJobRules::FJobSpot& Kept : QuebecJobRules::KeepClear) Best = FMath::Min(Best, FVector::Dist2D(Gate, JobsTestVector(Kept)));
        TestTrue(FString::Printf(TEXT("Race gate (%.0f, %.0f) is in the side-job keep-clear table"), Gate.X, Gate.Y), Best < 5.);
    }
    TArray<FVector> Points;
    for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::Markers) Points.Add(JobsTestVector(Spot));
    for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::DeliveryDoors) Points.Add(JobsTestVector(Spot));
    for (const QuebecJobRules::FJobSpot& Spot : QuebecJobRules::GoonSpawns) Points.Add(JobsTestVector(Spot));
    Points.Append({JobsTestVector(QuebecJobRules::DeliveryCafe), JobsTestVector(QuebecJobRules::ThiefStart),
        JobsTestVector(QuebecJobRules::GoonArena), JobsTestVector(QuebecJobRules::EscapeGarage)});
    double Closest = TNumericLimits<double>::Max();
    for (const FVector& Point : Points)
        for (const FVector& Anchor : Anchors)
        {
            const double Distance = FVector::Dist2D(Point, Anchor);
            Closest = FMath::Min(Closest, Distance);
            if (Distance < QuebecJobRules::MinClearance)
                AddError(FString::Printf(TEXT("Side-job point (%.0f, %.0f) is %.0f cm from QA anchor (%.0f, %.0f)"), Point.X, Point.Y, Distance, Anchor.X, Anchor.Y));
        }
    AddInfo(FString::Printf(TEXT("NORD_SIDEJOB closest side-job point to a QA anchor: %.0f cm over %d points and %d anchors"), Closest, Points.Num(), Anchors.Num()));
    TestTrue(TEXT("Every marker, objective and spawn point is at least 15 m from every QA anchor"), Closest >= QuebecJobRules::MinClearance);
    // The escape ends at the police garage; the engine-free table keeps the same point for the CPU test.
    const double GarageGap = FVector::Dist2D(QuebecPolice::GarageLocation(), JobsTestVector(QuebecJobRules::EscapeGarage));
    TestTrue(FString::Printf(TEXT("The escape garage matches the police garage (%.0f cm apart)"), GarageGap), GarageGap < 100.);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecJobsLifecycleTest, "Quebec.Jobs.TimersAndRetry",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecJobsLifecycleTest::RunTest(const FString& Parameters)
{
    TestEqual(TEXT("A delivery starts with 75 s"), QuebecJobRules::TimeLimits[0], 75.f);
    TestEqual(TEXT("The escape lasts three minutes"), QuebecJobRules::TimeLimits[3], 180.f);
    TestEqual(TEXT("Remaining time is the replicated deadline minus server time"), QuebecJobRules::Remaining(100., 40.), 60.f);
    TestEqual(TEXT("An expired timer reads zero"), QuebecJobRules::Remaining(100., 140.), 0.f);
    TestEqual(TEXT("Three waves hold twelve goons"), QuebecJobRules::GoonTotal(), 12);

    FQuebecJobsWorld Fixture;
    if (!TestTrue(TEXT("Isolated side-job world"), Fixture.IsReady())) return false;
    AQuebecSideJobs* Jobs = Fixture.Jobs;
    TestSamePtr(TEXT("Find returns the world's side-job actor"), AQuebecSideJobs::Find(Fixture.World), Jobs);
    TestFalse(TEXT("No job runs at first"), QuebecJobs::IsJobActive(Fixture.World));
    TestFalse(TEXT("R stays with the campaign while no job runs"), QuebecJobs::HandleRecover(Fixture.Player));

    TestTrue(TEXT("A delivery starts"), Jobs->StartJob(0, Fixture.Player));
    TestTrue(TEXT("The job is active for the race gate guard"), QuebecJobs::IsJobActive(Fixture.World));
    TestSamePtr(TEXT("The starter is recorded"), Jobs->StarterState.Get(), static_cast<APlayerState*>(Fixture.Stats));
    TestEqual(TEXT("The delivery deadline is 75 s after the start"), Jobs->GetRemainingSeconds(), 75.f, .01f);
    TestTrue(TEXT("The first objective is the café"), Jobs->bHasTarget && Jobs->JobStep == 0 && !Jobs->ObjectiveText.IsEmpty());

    Fixture.World->TimeSeconds = 70.;
    Jobs->Tick(.1f);
    TestTrue(TEXT("The job runs before its deadline"), Jobs->IsActive());
    TestEqual(TEXT("The timer counts down with server time"), Jobs->GetRemainingSeconds(), 15.f, .01f);
    const float OldDeadline = Jobs->DeadlineTime;
    TestTrue(TEXT("R inside a job is taken by the job"), QuebecJobs::HandleRecover(Fixture.Player));
    TestTrue(TEXT("Retry restarts the same job"), Jobs->IsActive() && Jobs->JobIndex == 0 && Jobs->JobStep == 0);
    TestTrue(TEXT("Retry restarts the clock"), Jobs->DeadlineTime > OldDeadline);
    TestEqual(TEXT("Retry gives the full time again"), Jobs->GetRemainingSeconds(), 75.f, .01f);

    const int32 SerialBefore = Jobs->ResultSerial;
    Fixture.World->TimeSeconds = 70. + 75. + .5;
    Jobs->Tick(.1f);
    TestFalse(TEXT("The deadline ends the job"), Jobs->IsActive());
    TestTrue(TEXT("A timeout is a failure"), Jobs->JobState == EQuebecJobState::Failed);
    TestEqual(TEXT("The result banner is triggered once"), Jobs->ResultSerial, SerialBefore + 1);
    TestTrue(TEXT("The failure names the timeout"), Jobs->LastResult.Contains(TEXT("Temps")));
    TestEqual(TEXT("A failure pays nothing"), Jobs->LastReward, 0);
    TestFalse(TEXT("The race gate guard releases once the job ended"), QuebecJobs::IsJobActive(Fixture.World));
    // Spec: after MISSION RATÉE, R restarts the job rather than the campaign encounter, for a short window.
    TestTrue(TEXT("A failure offers a retry for 30 s"), Jobs->RetryUntil > Jobs->GetServerNow() + AQuebecSideJobs::RetrySeconds - 1.f);
    Fixture.World->TimeSeconds += 10.;
    TestTrue(TEXT("R within 30 s of MISSION RATÉE is taken by the job"), QuebecJobs::HandleRecover(Fixture.Player));
    TestTrue(TEXT("R after a failure restarts the failed job"), Jobs->IsActive() && Jobs->JobIndex == 0 && Jobs->JobStep == 0);
    TestEqual(TEXT("The restarted job has its full time"), Jobs->GetRemainingSeconds(), 75.f, .01f);
    TestEqual(TEXT("Starting a job closes the retry window"), Jobs->RetryUntil, 0.f);
    Jobs->FinishJob(false, TEXT("test"));
    Fixture.World->TimeSeconds += AQuebecSideJobs::RetrySeconds + 1.;
    TestFalse(TEXT("R goes back to the campaign once the retry window closed"), QuebecJobs::HandleRecover(Fixture.Player));
    TestFalse(TEXT("No job runs after the window closed"), QuebecJobs::IsJobActive(Fixture.World));

    // A knock-out ends the job at once, and R does nothing while the player is down.
    TestTrue(TEXT("A second delivery starts"), Jobs->StartJob(0, Fixture.Player));
    Fixture.Stats->DownState = static_cast<uint8>(EQuebecDownState::KnockedOut);
    Jobs->Tick(.1f);
    TestTrue(TEXT("K.-O. fails the job"), Jobs->JobState == EQuebecJobState::Failed);
    TestTrue(TEXT("The failure names the K.-O."), Jobs->LastResult.Contains(TEXT("K.-O.")));
    TestTrue(TEXT("R from a downed player is taken"), QuebecJobs::HandleRecover(Fixture.Player));
    TestFalse(TEXT("R from a downed player neither restarts the job nor moves the player"), Jobs->IsActive());
    Fixture.Stats->DownState = 0;
    TestTrue(TEXT("Once standing, R restarts the failed job"), QuebecJobs::HandleRecover(Fixture.Player) && Jobs->IsActive());
    Jobs->FinishJob(false, TEXT("test"));

    // The job is shared: a partner's new K.-O. fails it too, but a partner already down when it began does not.
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecController* Partner = Fixture.World->SpawnActor<AQuebecController>(Spawn);
    AQuebecPlayerState* PartnerStats = Fixture.World->SpawnActor<AQuebecPlayerState>(Spawn);
    if (!TestTrue(TEXT("A second player joins"), Partner && PartnerStats)) return false;
    Partner->PlayerState = PartnerStats;
    PartnerStats->DownState = static_cast<uint8>(EQuebecDownState::Arrested);
    TestTrue(TEXT("A delivery starts while the partner is still down"), Jobs->StartJob(0, Fixture.Player));
    Jobs->Tick(.1f);
    TestTrue(TEXT("A partner who was already down does not fail the job"), Jobs->IsActive());
    PartnerStats->DownState = 0;
    Jobs->Tick(.1f);
    PartnerStats->DownState = static_cast<uint8>(EQuebecDownState::Arrested);
    Jobs->Tick(.1f);
    TestFalse(TEXT("The partner's new arrest fails the shared job"), Jobs->IsActive());
    TestTrue(TEXT("The failure names the arrest"), Jobs->LastResult.Contains(TEXT("Arrêté")));
    PartnerStats->DownState = 0;

    // The goon job hands every unarmed player a pistol.
    Fixture.Stats->OwnedWeapons = 1;
    PartnerStats->OwnedWeapons = 1;
    TestTrue(TEXT("The goon job starts"), Jobs->StartJob(2, Fixture.Player));
    TestTrue(TEXT("An unarmed player gets a pistol"), Fixture.Stats->HasWeapon(EQuebecWeapon::Pistol));
    TestTrue(TEXT("The unarmed partner gets a pistol too"), PartnerStats->HasWeapon(EQuebecWeapon::Pistol));
    TestTrue(TEXT("The pistol comes loaded"), Fixture.Stats->AmmoFor(EQuebecWeapon::Pistol) >= QuebecJobRules::PistolRounds);
    TestTrue(TEXT("The pistol is in hand"), Fixture.Stats->CurrentWeapon() == EQuebecWeapon::Pistol);
    Jobs->FinishJob(true, TEXT("test"));
    TestTrue(TEXT("Success marks the job completed for the session"), Jobs->IsCompleted(2));
    TestEqual(TEXT("Success records the job's reward"), Jobs->LastReward, QuebecJobRules::Rewards[2]);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecJobsCleanupTest, "Quebec.Jobs.Cleanup",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecJobsCleanupTest::RunTest(const FString& Parameters)
{
    FQuebecJobsWorld Fixture;
    if (!TestTrue(TEXT("Isolated side-job world"), Fixture.IsReady())) return false;
    AQuebecSideJobs* Jobs = Fixture.Jobs;
    int32 CarsBefore = 0;
    for (TActorIterator<AQuebecCar> It(Fixture.World); It; ++It) ++CarsBefore;
    TestEqual(TEXT("The side-job actor spawns no cars by itself"), CarsBefore, 0);

    TestTrue(TEXT("The thief job starts"), Jobs->StartJob(1, Fixture.Player));
    const TWeakObjectPtr<AQuebecCar> Thief = Jobs->ThiefCar.Get();
    if (TestTrue(TEXT("The thief's car spawns on the road graph"), Thief.IsValid()))
    {
        TestTrue(TEXT("The thief's car is tagged for QA, not as city traffic"), Thief->Tags.Contains(FName(TEXT("SideJobTarget"))) && !Thief->bTraffic);
        TestSamePtr(TEXT("The radar target is the thief's car"), Jobs->TargetActor.Get(), static_cast<AActor*>(Thief.Get()));
        TestTrue(TEXT("The thief drives on autopilot"), Thief->HasAutopilot());
    }
    Jobs->FinishJob(false, TEXT("test"));
    // The car stays until no player can see it; this fixture's only view is 600 m away.
    Jobs->Tick(.1f);
    TestFalse(TEXT("The thief's car leaves with the job once out of sight"), Thief.IsValid());
    TestNull(TEXT("No radar target after the job"), Jobs->TargetActor.Get());

    TestTrue(TEXT("The goon job starts"), Jobs->StartJob(2, Fixture.Player));
    TArray<TWeakObjectPtr<AActor>> Spawned;
    for (const TObjectPtr<AActor>& Goon : Jobs->Goons) Spawned.Add(Goon.Get());
    AddInfo(FString::Printf(TEXT("NORD_SIDEJOB first wave spawned %d goons (expected %d)"), Spawned.Num(), QuebecJobRules::WaveSizes[0]));
    TestTrue(TEXT("The first wave never exceeds its size"), Spawned.Num() <= QuebecJobRules::WaveSizes[0]);
    TestTrue(TEXT("The thief job's car is gone before the goons come"), !Jobs->ThiefCar);
    Jobs->FinishJob(false, TEXT("test"));
    bool bAllGone = true;
    for (const TWeakObjectPtr<AActor>& Goon : Spawned) bAllGone &= !Goon.IsValid();
    TestTrue(TEXT("Every goon leaves with the job"), bAllGone);
    TestEqual(TEXT("The goon list is empty after the job"), Jobs->Goons.Num(), 0);

    // A retry cleans up before it starts again.
    TestTrue(TEXT("The thief job starts again"), Jobs->StartJob(1, Fixture.Player));
    const TWeakObjectPtr<AQuebecCar> FirstThief = Jobs->ThiefCar.Get();
    TestTrue(TEXT("R restarts the thief job"), Jobs->RequestRetry(Fixture.Player));
    Jobs->Tick(.1f);
    TestFalse(TEXT("The old thief car is removed on retry"), FirstThief.IsValid() && FirstThief.Get() != Jobs->ThiefCar.Get());
    int32 Thieves = 0;
    for (TActorIterator<AQuebecCar> It(Fixture.World); It; ++It)
        if (IsValid(*It) && It->Tags.Contains(FName(TEXT("SideJobTarget")))) ++Thieves;
    TestTrue(TEXT("At most one thief car exists after a retry"), Thieves <= 1);
    Jobs->FinishJob(false, TEXT("test"));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecJobsNoticeTest, "Quebec.Jobs.NoticeChannel",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecJobsNoticeTest::RunTest(const FString& Parameters)
{
    FQuebecJobsWorld Fixture;
    if (!TestTrue(TEXT("Isolated side-job world"), Fixture.IsReady())) return false;
    AQuebecController* Player = Fixture.Player;
    QuebecNotice::Show(Player, TEXT("K.-O."), TEXT("Direction Hôpital Notre-Dame"), 4.f);
    TestEqual(TEXT("The notice reaches its own channel"), Player->GameNoticeTitle, FString(TEXT("K.-O.")));
    TestTrue(TEXT("The notice never uses the resident caption, so story captions still clear"), Player->ResidentCaption.IsEmpty());
    TestEqual(TEXT("The notice lasts the requested time"), Player->GameNoticeUntil - Player->GameNoticeStart, 4.f, .001f);
    QuebecNotice::Show(Player, TEXT("ARRÊTÉ!"), FString(), 3.f);
    TestEqual(TEXT("A second notice waits while the first is fresh"), Player->GameNoticeTitle, FString(TEXT("K.-O.")));
    TestEqual(TEXT("The second notice is queued"), Player->PendingNoticeTitle, FString(TEXT("ARRÊTÉ!")));
    Fixture.World->TimeSeconds += 1.1;
    Player->TickGameNotice();
    TestEqual(TEXT("The queued notice shows after a second"), Player->GameNoticeTitle, FString(TEXT("ARRÊTÉ!")));
    TestTrue(TEXT("The queue is empty again"), Player->PendingNoticeTitle.IsEmpty());
    const float Start = Player->GameNoticeStart;
    Fixture.World->TimeSeconds += .2;
    QuebecNotice::Show(Player, TEXT("ARRÊTÉ!"), FString(), 3.f);
    TestEqual(TEXT("The same notice within 1.5 s is dropped by the sender"), Player->GameNoticeStart, Start);
    QuebecNotice::Show(nullptr, TEXT("ignored"), FString(), 3.f);
    QuebecNotice::Show(Player, FString(), FString(), 3.f);
    TestEqual(TEXT("Empty or ownerless notices change nothing"), Player->GameNoticeTitle, FString(TEXT("ARRÊTÉ!")));
    return true;
}

#endif
