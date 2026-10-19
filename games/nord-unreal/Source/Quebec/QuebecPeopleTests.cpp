#include "QuebecGameplay.h"
#include "QuebecKnockModel.h"
#include "QuebecLife.h"
#include "QuebecPedestrian.h"
#include "QuebecPeople.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"

namespace
{
    UWorld* MakePeopleWorld()
    {
        UWorld::InitializationValues Initialization;
        Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
        return UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPeopleKnockPoseTest, "Quebec.People.KnockPose",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPeopleKnockPoseTest::RunTest(const FString& Parameters)
{
    const QuebecKnock::FLaunch Car = QuebecKnock::CarLaunch(1500.f);
    const QuebecKnock::FTimeline Line = QuebecKnock::Timeline(Car);
    TestTrue(TEXT("A car strike flies a ballistic arc under 980 cm/s2"), FMath::IsNearlyEqual(Line.Flight, 2.f * Car.Up / 980.f, .001f));
    TestEqual(TEXT("Standing up takes 0.8 s"), Line.Total - Line.StandStarts, .8f, .0001f);
    TestTrue(TEXT("Airborne first"), QuebecKnock::Sample(Car, Line.Flight * .5f).Phase == QuebecKnock::EPhase::Airborne);
    TestTrue(TEXT("Then one small bounce"), QuebecKnock::Sample(Car, Line.Flight + Line.Bounce * .5f).Phase == QuebecKnock::EPhase::Landing);
    const QuebecKnock::FPose Lying = QuebecKnock::Sample(Car, (Line.Landed + Line.StandStarts) * .5f);
    TestTrue(TEXT("Then lying dazed"), Lying.Phase == QuebecKnock::EPhase::Lying && Lying.bDazed);
    TestEqual(TEXT("Lying flat"), FMath::Fmod(FMath::Abs(Lying.Pitch), 360.f), 90.f, .01f);
    TestTrue(TEXT("Then standing up"), QuebecKnock::Sample(Car, Line.StandStarts + .4f).Phase == QuebecKnock::EPhase::StandingUp);
    const QuebecKnock::FPose Done = QuebecKnock::Sample(Car, Line.Total + .01f);
    TestTrue(TEXT("Then done and upright"), Done.Phase == QuebecKnock::EPhase::Done && FMath::IsNearlyZero(FMath::Fmod(Done.Pitch, 360.f), .01f));
    // No jumps at the phase seams.
    QuebecKnock::FPose Previous = QuebecKnock::Sample(Car, 0.f);
    bool bContinuous = true;
    for (float Time = .002f; Time < Line.Total + .2f; Time += .002f)
    {
        const QuebecKnock::FPose Pose = QuebecKnock::Sample(Car, Time);
        bContinuous &= FMath::Abs(Pose.Forward - Previous.Forward) < 3.f && FMath::Abs(Pose.Lift - Previous.Lift) < 3.f &&
            FMath::Abs(Pose.Pitch - Previous.Pitch) < 6.f && FMath::Abs(Pose.Hip - Previous.Hip) < 1.f;
        Previous = Pose;
    }
    TestTrue(TEXT("The pose is continuous through every phase"), bContinuous);
    TestTrue(TEXT("A 6 m step cannot tunnel past a person"), QuebecKnock::SweptBoxHit(300.f, 0.f, -300.f, 0.f, 255.f, 125.f));
    TestFalse(TEXT("A person beside the path is missed"), QuebecKnock::SweptBoxHit(300.f, 126.f, -300.f, 126.f, 255.f, 125.f));
    TestFalse(TEXT("A car at 450 cm/s does not knock a civilian down"), QuebecKnock::CivilianGoesDown(QuebecKnock::EHit::Car, 450.f, 0));
    TestTrue(TEXT("The second punch knocks a civilian down"), QuebecKnock::CivilianGoesDown(QuebecKnock::EHit::Melee, 12.f, 1));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPeopleResidentKnockTest, "Quebec.People.ResidentRouteHold",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPeopleResidentKnockTest::RunTest(const FString& Parameters)
{
    UWorld* World = MakePeopleWorld();
    if (!TestNotNull(TEXT("Isolated people world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecParkResident* Resident = World->SpawnActor<AQuebecParkResident>();
    AActor* Player = World->SpawnActor<AActor>();
    if (!Resident || !Player) return false;
    USceneComponent* PlayerRoot = NewObject<USceneComponent>(Player);
    Player->SetRootComponent(PlayerRoot);
    PlayerRoot->RegisterComponent();
    Resident->Route = {FVector(0., 0., 7.), FVector(4000., 0., 7.)};
    Resident->Pace = 100.f;
    Resident->Phase = 3.f;
    Resident->UpdateRouteLength();
    const auto TickAt = [World, Resident](double Seconds)
    {
        World->TimeSeconds = Seconds;
        Resident->Tick(1.f / 60.f);
    };
    TickAt(1.);
    const FVector Hit = Resident->GetActorLocation();
    TestTrue(TEXT("A walking resident is knocked down"), Resident->Knock(FVector(800., 0., 400.), Hit - FVector(300., 0., 0.)));
    TestTrue(TEXT("The knocked resident is down"), Resident->IsKnockedDown() && Resident->IsAway());
    TestFalse(TEXT("A resident already down cannot be knocked again"), Resident->Knock(FVector(800., 0., 400.), Hit));
    Player->SetActorLocation(Resident->GetActorLocation() + FVector(0., 200., 0.));
    TestFalse(TEXT("A knocked resident does not stop to greet"), Resident->Acknowledge(Player, true));
    const float Held = Resident->RouteTime(1.f);
    TestEqual(TEXT("The route clock holds while the resident is down"), Resident->RouteTime(3.f), Held, .001f);
    const QuebecKnock::FTimeline Line = QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(Resident->KnockPush, Resident->KnockLieSeconds, Resident->KnockGround));
    TickAt(1. + Line.Flight * .5f);
    TestTrue(TEXT("The root follows the throw along the push"), Resident->GetActorLocation().X > Hit.X + 50.);
    TickAt(1. + Line.StandStarts - .1f);
    TestTrue(TEXT("Still down before standing up"), Resident->IsKnockedDown());
    TestEqual(TEXT("The clock still holds while lying"), Resident->RouteTime(static_cast<float>(World->TimeSeconds)), Held, .001f);
    // Up again: it runs (no ground in this fixture, so it walks back at once), then returns to where it left the route.
    double Clock = 1. + Line.Total + .05;
    for (int32 Step = 0; Step < 60 * 40 && Resident->IsAway(); ++Step, Clock += 1. / 60.) TickAt(Clock);
    TestFalse(TEXT("The resident returns to its route"), Resident->IsAway());
    TestTrue(TEXT("It stands where the route was left"), Resident->GetActorLocation().Equals(Hit, 1.));
    const float Back = static_cast<float>(World->TimeSeconds);
    TestEqual(TEXT("The route resumes exactly where it paused"), Resident->RouteTime(Back), Held, .001f);
    TestTrue(TEXT("A resumed frame advances only that frame's time"),
        FMath::IsNearlyEqual(Resident->RouteTime(Back + .02f) - Resident->RouteTime(Back), .02f, .0001f));
    // Fleeing from an alarm also holds and releases the clock.
    TickAt(Back + 1.);
    const float BeforeFlee = Resident->RouteTime(static_cast<float>(World->TimeSeconds));
    TestTrue(TEXT("A resident flees from an alarm"), Resident->Flee(Resident->GetActorLocation() - FVector(200., 0., 0.), 2.f));
    TestEqual(TEXT("Fleeing holds the route clock"), Resident->RouteTime(static_cast<float>(World->TimeSeconds) + 1.f), BeforeFlee, .001f);
    Resident->SetActorHiddenInGame(true);
    TestFalse(TEXT("A hidden resident cannot be knocked down"), Resident->Knock(FVector(800., 0., 400.), Hit));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPeopleCompanionTest, "Quebec.People.CompanionCounts",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPeopleCompanionTest::RunTest(const FString& Parameters)
{
    // The game mode's 96 runtime residents: 8 social, then 88 mobile, of which 2 in every 11 jog.
    constexpr int32 Social = 8, Mobile = 88;
    int32 Walkers = 0, Joggers = 0, Dogs = 0, Strollers = 0, Groceries = 0;
    for (int32 MobileIndex = 0; MobileIndex < Mobile; ++MobileIndex)
    {
        const int32 Activity = MobileIndex % 11 < 2 ? 1 : 0;
        (Activity ? Joggers : Walkers) += 1;
        const uint8 Kind = QuebecLife::CompanionFor(MobileIndex, Activity);
        Dogs += Kind == static_cast<uint8>(QuebecLife::ECompanion::Dog);
        Strollers += Kind == static_cast<uint8>(QuebecLife::ECompanion::Stroller);
        Groceries += Kind == static_cast<uint8>(QuebecLife::ECompanion::Groceries);
        if (Activity) TestTrue(TEXT("Joggers carry nothing"), Kind == static_cast<uint8>(QuebecLife::ECompanion::None));
        TestTrue(TEXT("The assignment is deterministic"), QuebecLife::CompanionFor(MobileIndex, Activity) == Kind);
    }
    TestEqual(TEXT("Runtime residents stay 96"), Social + Walkers + Joggers, 96);
    TestEqual(TEXT("72 walkers"), Walkers, 72);
    TestEqual(TEXT("12 dog walkers"), Dogs, 12);
    TestEqual(TEXT("8 stroller pushers"), Strollers, 8);
    TestEqual(TEXT("8 grocery carriers"), Groceries, 8);
    TestTrue(TEXT("Social residents have no companion"), QuebecLife::CompanionFor(0, 2) == static_cast<uint8>(QuebecLife::ECompanion::None));
    TestTrue(TEXT("A stroller slows its pusher"), QuebecLife::CompanionPace(static_cast<uint8>(QuebecLife::ECompanion::Stroller), 100.f) < 100.f);
    TestEqual(TEXT("A dog keeps its walker's pace"), QuebecLife::CompanionPace(static_cast<uint8>(QuebecLife::ECompanion::Dog), 100.f), 100.f);

    // The companion is part of the resident, not a new actor.
    UWorld* World = MakePeopleWorld();
    if (!TestNotNull(TEXT("Isolated companion world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecParkResident* Walker = World->SpawnActorDeferred<AQuebecParkResident>(AQuebecParkResident::StaticClass(), FTransform::Identity,
        nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
    if (!Walker) return false;
    Walker->Style = 5;
    Walker->Route = {FVector(0., 0., 7.), FVector(2000., 0., 7.)};
    Walker->Companion = static_cast<uint8>(QuebecLife::ECompanion::Dog);
    Walker->FinishSpawning(FTransform::Identity);
    int32 Actors = 0;
    for (TActorIterator<AQuebecParkResident> It(World); It; ++It) ++Actors;
    TestEqual(TEXT("A dog walker is still one resident actor"), Actors, 1);
    Walker->DispatchBeginPlay();
    TestTrue(TEXT("The dog is built from parts on the resident"), Walker->CompanionRig && Walker->CompanionRig->GetPartCount() >= 10);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPeoplePlayerKnockTest, "Quebec.People.PlayerKnock",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPeoplePlayerKnockTest::RunTest(const FString& Parameters)
{
    UWorld* World = MakePeopleWorld();
    if (!TestNotNull(TEXT("Isolated player world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecCharacter* Player = World->SpawnActor<AQuebecCharacter>(FVector(0., 0., 200.), FRotator::ZeroRotator, Spawn);
    if (!Player) return false;
    World->TimeSeconds = 10.;
    TestFalse(TEXT("A standing player can move"), Player->IsInputLocked());
    Player->StartKnock(FVector(600., 0., 400.), 1.6f, false);
    TestTrue(TEXT("A struck player is knocked down"), Player->IsKnocked());
    TestTrue(TEXT("A knocked player cannot move, jump, sprint or use E"), Player->IsInputLocked());
    const QuebecKnock::FTimeline Line = QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(FVector(600., 0., 400.), 1.6f));
    World->TimeSeconds = 10. + Line.Total + .05;
    TestFalse(TEXT("The player stands up after the tumble"), Player->IsKnocked() || Player->IsInputLocked());
    Player->StartKnock(FVector::ZeroVector, 4.f, true);
    World->TimeSeconds += 60.;
    TestTrue(TEXT("A K.-O. keeps the player down"), Player->IsKnocked());
    Player->EndKnock();
    TestTrue(TEXT("EndKnock starts the stand-up"), Player->IsKnocked());
    World->TimeSeconds += .81;
    TestFalse(TEXT("The player is up 0.8 s after EndKnock"), Player->IsKnocked());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPeoplePedestrianKnockTest, "Quebec.People.PedestrianKnock",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPeoplePedestrianKnockTest::RunTest(const FString& Parameters)
{
    UWorld* World = MakePeopleWorld();
    if (!TestNotNull(TEXT("Isolated pedestrian world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecPedestrian* Pedestrian = World->SpawnActor<AQuebecPedestrian>();
    if (!Pedestrian) return false;
    World->TimeSeconds = 5.;
    const FVector Start = Pedestrian->GetActorLocation();
    TestTrue(TEXT("A pedestrian is knocked down"), Pedestrian->Knock(FVector(700., 0., 400.), Start - FVector(300., 0., 0.)));
    TestTrue(TEXT("The pedestrian is down"), Pedestrian->IsKnockedDown());
    const QuebecKnock::FTimeline Line = QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(Pedestrian->KnockPush, Pedestrian->KnockLieSeconds, Pedestrian->KnockGround));
    World->TimeSeconds = 5. + Line.Flight * .5;
    Pedestrian->Tick(1.f / 60.f);
    TestTrue(TEXT("The server moves the pedestrian through the throw"), Pedestrian->GetActorLocation().X > Start.X + 50.);
    World->TimeSeconds = 5. + Line.Total + .05;
    Pedestrian->Tick(1.f / 60.f);
    TestFalse(TEXT("The pedestrian stands up"), Pedestrian->IsKnockedDown());
    TestTrue(TEXT("Then runs from the cause"), Pedestrian->bFleeing);
    TestTrue(TEXT("Upright again"), FMath::IsNearlyZero(Pedestrian->GetActorRotation().Pitch, .1f) && FMath::IsNearlyZero(Pedestrian->GetActorRotation().Roll, .1f));
    return true;
}
#endif
