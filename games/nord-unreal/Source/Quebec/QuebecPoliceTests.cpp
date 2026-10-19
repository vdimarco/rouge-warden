#include "QuebecPolice.h"
#include "QuebecGameplay.h"
#include "QuebecHeatModel.h"
#include "QuebecPlayerState.h"
#include "QuebecPursuitModel.h"
#include "LaFontaineMap.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"

namespace
{
    // An isolated authority world with a floor at z=0, no saved map, audio, navigation or AI.
    UWorld* PoliceTestWorld()
    {
        UWorld::InitializationValues Initialization;
        Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
        UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
        if (!World) return nullptr;
        AActor* Floor = World->SpawnActor<AActor>();
        UBoxComponent* FloorBox = NewObject<UBoxComponent>(Floor);
        Floor->SetRootComponent(FloorBox);
        FloorBox->SetBoxExtent(FVector(100000., 100000., 20.));
        FloorBox->SetCollisionProfileName(TEXT("BlockAll"));
        FloorBox->RegisterComponent();
        Floor->SetActorLocation(FVector(0., 0., -20.));
        return World;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceHeatTest, "Quebec.Police.HeatThresholds",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceHeatTest::RunTest(const FString& Parameters)
{
    const float Heat[] = {30.f, 25.f, 12.f, 6.f, 15.f, 40.f, 60.f, 120.f};
    for (int32 Index = 0; Index < QuebecHeat::CrimeCount; ++Index)
        TestEqual(*FString::Printf(TEXT("Crime %d adds its heat"), Index), QuebecHeat::CrimeHeat(static_cast<QuebecHeat::ECrime>(Index)), Heat[Index]);
    TestEqual(TEXT("Below 10 heat is no star"), QuebecHeat::StarsForHeat(9.9f), 0);
    const float Thresholds[] = {10.f, 45.f, 100.f, 180.f, 300.f};
    for (int32 Stars = 1; Stars <= QuebecHeat::MaxStars; ++Stars)
    {
        TestEqual(*FString::Printf(TEXT("%d stars start at their threshold"), Stars), QuebecHeat::StarsForHeat(Thresholds[Stars - 1]), Stars);
        TestEqual(*FString::Printf(TEXT("Just under the threshold is %d stars"), Stars - 1), QuebecHeat::StarsForHeat(Thresholds[Stars - 1] - .01f), Stars - 1);
    }
    QuebecHeat::FWanted Wanted;
    QuebecHeat::AddCrime(Wanted, QuebecHeat::ECrime::HitPerson, 0.);
    TestEqual(TEXT("Knocking one person down gives one star"), Wanted.Stars, 1);
    QuebecHeat::FWanted Officer;
    QuebecHeat::AddCrime(Officer, QuebecHeat::ECrime::DownPolice, 0.);
    TestEqual(TEXT("Knocking an officer out gives three stars"), Officer.Stars, 3);
    TestFalse(TEXT("Gunfire counts once per 3 s"), QuebecHeat::CrimeReady(QuebecHeat::ECrime::Gunfire, 10., 12.));
    TestTrue(TEXT("Crimes against police are always witnessed"), QuebecHeat::AlwaysWitnessed(QuebecHeat::ECrime::RamPolice));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceWitnessTest, "Quebec.Police.WitnessRule",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceWitnessTest::RunTest(const FString& Parameters)
{
    const QuebecHeat::FVec Eye{0., 0., 160.}, Forward{1., 0., 0.};
    const auto At = [](double Degrees, double Range)
    {
        return QuebecHeat::FVec{FMath::Cos(FMath::DegreesToRadians(Degrees)) * Range, FMath::Sin(FMath::DegreesToRadians(Degrees)) * Range, 160.};
    };
    TestTrue(TEXT("An officer on foot sees 54 degrees off at 39 m"), QuebecHeat::InView(QuebecHeat::EWatcher::OfficerOnFoot, Eye, Forward, At(54., 3900.)));
    TestFalse(TEXT("An officer on foot misses 56 degrees off"), QuebecHeat::InView(QuebecHeat::EWatcher::OfficerOnFoot, Eye, Forward, At(56., 3900.)));
    TestFalse(TEXT("An officer on foot misses 41 m ahead"), QuebecHeat::InView(QuebecHeat::EWatcher::OfficerOnFoot, Eye, Forward, At(0., 4100.)));
    TestTrue(TEXT("A police car sees 34 degrees off at 69 m"), QuebecHeat::InView(QuebecHeat::EWatcher::PoliceCar, Eye, Forward, At(34., 6900.)));
    TestFalse(TEXT("A police car misses 36 degrees off"), QuebecHeat::InView(QuebecHeat::EWatcher::PoliceCar, Eye, Forward, At(36., 3000.)));
    TestFalse(TEXT("A police car misses 71 m ahead"), QuebecHeat::InView(QuebecHeat::EWatcher::PoliceCar, Eye, Forward, At(0., 7100.)));
    TestTrue(TEXT("Anything within 8 m is noticed"), QuebecHeat::InView(QuebecHeat::EWatcher::PoliceCar, Eye, Forward, At(180., 700.)));
    TestFalse(TEXT("One civilian is not a witness"), QuebecHeat::CiviliansWitness(1));
    TestTrue(TEXT("Two civilians are witnesses"), QuebecHeat::CiviliansWitness(2));
    TestEqual(TEXT("Civilians witness within 25 m"), QuebecHeat::CivilianRange, 2500.);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceSearchTest, "Quebec.Police.SearchDrop",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceSearchTest::RunTest(const FString& Parameters)
{
    QuebecHeat::FWanted Wanted;
    QuebecHeat::SetStars(Wanted, 3);
    double Now = 0.;
    for (int32 Step = 0; Step < 50; ++Step, Now += .1) QuebecHeat::Tick(Wanted, Now, .1f, true);
    TestEqual(TEXT("Seen: the stars hold"), Wanted.Stars, 3);
    TestEqual(TEXT("Seen: heat keeps the three-star floor"), Wanted.Heat, 100.f);
    QuebecHeat::Tick(Wanted, Now, .1f, false);
    TestTrue(TEXT("Unseen: the stars blink"), Wanted.bSearching);
    TestEqual(TEXT("The search lasts 15 s + 10 s per star"), Wanted.SearchEndsAt - Now, 45., 1e-6);
    TestEqual(TEXT("No drop before the search ends"), QuebecHeat::Tick(Wanted, Wanted.SearchEndsAt - .05, .1f, false), 0);
    TestEqual(TEXT("One star drops when the search ends"), QuebecHeat::Tick(Wanted, Wanted.SearchEndsAt, .1f, false), -1);
    TestEqual(TEXT("Two stars remain"), Wanted.Stars, 2);
    TestTrue(TEXT("A fresh two-star search starts"), Wanted.bSearching);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceCapsTest, "Quebec.Police.DispatcherCaps",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceCapsTest::RunTest(const FString& Parameters)
{
    const int32 Cars[] = {0, 1, 2, 3, 4, 4};
    const int32 Officers[] = {0, 1, 2, 3, 4, 4};
    for (int32 Stars = 0; Stars <= QuebecHeat::MaxStars; ++Stars)
    {
        TestEqual(*FString::Printf(TEXT("%d stars: police cars"), Stars), QuebecHeat::MaxPoliceCars(Stars), Cars[Stars]);
        TestEqual(*FString::Printf(TEXT("%d stars: officers"), Stars), QuebecHeat::MaxOfficers(Stars), Officers[Stars]);
    }
    TestEqual(TEXT("At most four police cars in the world"), QuebecHeat::WorldCarCap, 4);
    TestEqual(TEXT("At most four officers in the world"), QuebecHeat::WorldOfficerCap, 4);
    TestFalse(TEXT("Two-star officers only arrest"), QuebecHeat::OfficersShoot(2));
    TestTrue(TEXT("Three-star officers shoot"), QuebecHeat::OfficersShoot(3));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceArrestTimerTest, "Quebec.Police.ArrestTimer",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceArrestTimerTest::RunTest(const FString& Parameters)
{
    QuebecHeat::FArrest Arrest;
    int32 Steps = 0;
    bool bArrested = false;
    while (!bArrested && Steps < 100) { bArrested = QuebecHeat::TickArrest(Arrest, true, 100.f, .1f); ++Steps; }
    TestEqual(TEXT("A slow player beside an officer is arrested after 2 s"), Steps, 20);
    QuebecHeat::FArrest Running;
    for (int32 Step = 0; Step < 19; ++Step) QuebecHeat::TickArrest(Running, true, 100.f, .1f);
    TestFalse(TEXT("Moving at 150 cm/s breaks the hold"), QuebecHeat::TickArrest(Running, true, 150.f, .1f));
    TestEqual(TEXT("The hold starts again"), Running.Held, 0.f);
    TestEqual(TEXT("Arrest reach is 1.5 m"), QuebecHeat::ArrestReach, 150.);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceRoadsTest, "Quebec.Police.RoadsAndGarage",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceRoadsTest::RunTest(const FString& Parameters)
{
    std::vector<QuebecPursuit::FSegment> Segments;
    for (const auto& Road : LaFontaine::RoadSegments) Segments.push_back({{Road[0].X, Road[0].Y}, {Road[1].X, Road[1].Y}});
    QuebecPursuit::FRoadGraph Graph;
    Graph.Build(Segments);
    TestEqual(TEXT("Every surveyed segment is in the graph"), Graph.SegmentCount(), static_cast<int32>(UE_ARRAY_COUNT(LaFontaine::RoadSegments)));
    std::vector<QuebecPursuit::FVec2> Route;
    const QuebecPursuit::FVec2 From{LaFontaine::CarSpawn.X, LaFontaine::CarSpawn.Y};
    const QuebecPursuit::FVec2 To{QuebecPolice::GarageLocation().X, QuebecPolice::GarageLocation().Y};
    TestTrue(TEXT("A police car can route from the starter car to the garage"), Graph.Route(From, {1., 0.}, To, Route));
    QuebecPursuit::FVec2 Closest;
    Graph.Nearest(To, Closest);
    TestTrue(TEXT("The garage bay is in a street lane"), QuebecPursuit::Distance(Closest, To) < 200.);
    // Away from the start, the starter car and the legacy objectives, so no fixture drives through it.
    for (const FVector& Anchor : {LaFontaine::Spawn, LaFontaine::CarSpawn, LaFontaine::Missions[0], LaFontaine::Missions[1], LaFontaine::Missions[2]})
        TestTrue(TEXT("The garage is at least 60 m from QA anchors"), FVector::Dist2D(Anchor, QuebecPolice::GarageLocation()) > 6000.);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceOfficerTest, "Quebec.Police.OfficerKnockdown",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceOfficerTest::RunTest(const FString& Parameters)
{
    UWorld* World = PoliceTestWorld();
    if (!TestNotNull(TEXT("Isolated police world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    World->TimeSeconds = 10.;
    AQuebecOfficer* Officer = AQuebecOfficer::SpawnOfficer(World, FVector(0., 0., 0.), 0.f, AQuebecOfficer::FactionPolice);
    AQuebecOfficer* Goon = AQuebecOfficer::SpawnOfficer(World, FVector(1000., 0., 0.), 0.f, AQuebecOfficer::FactionGoon);
    if (!TestNotNull(TEXT("Officer spawns"), Officer) || !TestNotNull(TEXT("Goon spawns"), Goon)) return false;
    TestEqual(TEXT("Officer stands on the floor"), Officer->GetActorLocation().Z, 94., 2.);
    TestEqual(TEXT("Officers start at full health"), Officer->Health, 100.f);
    TestEqual(TEXT("Goons are weaker"), Goon->Health, 60.f);
    TestTrue(TEXT("An officer is police"), QuebecCrime::IsPolice(Officer));
    TestFalse(TEXT("A goon is not police"), QuebecCrime::IsPolice(Goon));
    TestTrue(TEXT("Goons are hostile to everyone"), QuebecCrime::IsHostile(Goon, nullptr));
    TestFalse(TEXT("Police leave a player without stars alone"), QuebecCrime::IsHostile(Officer, nullptr));
    const float StandingAim = static_cast<float>(Officer->GetAimPoint().Z);
    TestTrue(TEXT("A jab only staggers"), Officer->ReceiveHit(EQuebecHitKind::Melee, 10.f, FVector(300., 0., 0.), nullptr));
    TestFalse(TEXT("A staggered officer is not down"), Officer->IsDown());
    TestEqual(TEXT("The jab costs health"), Officer->Health, 90.f);
    TestTrue(TEXT("A pistol round knocks the officer over"), Officer->ReceiveHit(EQuebecHitKind::Bullet, 30.f, FVector(300., 0., 0.), nullptr));
    TestTrue(TEXT("The officer is down"), Officer->IsDown());
    TestFalse(TEXT("A downed officer cannot be hit again"), Officer->ReceiveHit(EQuebecHitKind::Bullet, 30.f, FVector(300., 0., 0.), nullptr));
    TestTrue(TEXT("The aim point drops to the body on the ground"), Officer->GetAimPoint().Z < StandingAim);
    TestFalse(TEXT("A knocked officer is not out"), Officer->IsKnockedOut());
    World->TimeSeconds = 30.;
    TestFalse(TEXT("The officer gets back up"), Officer->IsDown());
    TestTrue(TEXT("A car at speed knocks the goon out"), Goon->ReceiveHit(EQuebecHitKind::Car, 80.f, FVector(1500., 0., 0.), nullptr));
    TestTrue(TEXT("The goon stays down"), Goon->IsKnockedOut() && Goon->IsDown());
    World->TimeSeconds = 60.;
    TestTrue(TEXT("A knocked-out goon does not get up"), Goon->IsDown());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPoliceDispatchTest, "Quebec.Police.DispatchArrest",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPoliceDispatchTest::RunTest(const FString& Parameters)
{
    UWorld* World = PoliceTestWorld();
    if (!TestNotNull(TEXT("Isolated police world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    APlayerController* Player = World->SpawnActor<APlayerController>();
    AQuebecPlayerState* State = World->SpawnActor<AQuebecPlayerState>();
    AQuebecCharacter* Walker = World->SpawnActor<AQuebecCharacter>(FVector(0., 0., 102.), FRotator::ZeroRotator, Spawn);
    AQuebecPoliceDispatch* Dispatch = World->SpawnActor<AQuebecPoliceDispatch>();
    if (!Player || !State || !Walker || !Dispatch) return false;
    Player->PlayerState = State;
    Player->SetAsLocalPlayerController();
    World->InitializeActorsForPlay(FURL());
    Player->Possess(Walker);
    TestSamePtr(TEXT("The dispatcher is found"), AQuebecPoliceDispatch::Find(World), Dispatch);
    double Clock = 100.;
    const auto TickTo = [World, Dispatch, &Clock](double Until)
    {
        while (Clock < Until - 1e-6)
        {
            Clock += .1;
            World->TimeSeconds = Clock;
            Dispatch->Tick(.1f);
        }
    };
    World->TimeSeconds = Clock;
    QuebecCrime::SetStars(Player, 2);
    TestEqual(TEXT("Set stars gives two stars"), QuebecCrime::Stars(Player), 2);
    TestEqual(TEXT("Heat sits on the two-star floor"), State->Heat, 45.f);
    QuebecCrime::Report(Player, EQuebecCrime::HitCar, Walker->GetActorLocation());
    TestEqual(TEXT("A crime nobody sees adds no heat"), State->Heat, 45.f);
    QuebecCrime::Report(Player, EQuebecCrime::AttackPolice, Walker->GetActorLocation());
    TestEqual(TEXT("Attacking the police is always known: three stars"), QuebecCrime::Stars(Player), 3);
    TickTo(101.);
    TestTrue(TEXT("Unseen, the stars blink"), State->bSearching);
    TestEqual(TEXT("The three-star search lasts 45 s"), static_cast<double>(State->SearchEndsAt) - Clock, 45., 1.);
    TestTrue(TEXT("The dispatcher keeps within the three-star car cap"), Dispatch->CountCars() <= QuebecHeat::MaxPoliceCars(3));
    // Arrest: one star, an officer beside the player standing still.
    QuebecCrime::SetStars(Player, 1);
    AQuebecOfficer* Officer = AQuebecOfficer::SpawnOfficer(World, Walker->GetActorLocation() + FVector(90., 0., -100.), 180.f, AQuebecOfficer::FactionPolice);
    if (!TestNotNull(TEXT("Officer beside the player"), Officer)) return false;
    TickTo(Clock + 1.5);
    TestEqual(TEXT("Not arrested before 2 s"), static_cast<int32>(State->DownState), static_cast<int32>(EQuebecDownState::None));
    TickTo(Clock + .7);
    TestEqual(TEXT("Arrested after 2 s beside an officer"), static_cast<int32>(State->DownState), static_cast<int32>(EQuebecDownState::Arrested));
    TestEqual(TEXT("An arrest clears the stars"), QuebecCrime::Stars(Player), 0);
    TickTo(static_cast<double>(State->DownUntil) + .2);
    TestEqual(TEXT("The player stands up after the banner"), static_cast<int32>(State->DownState), static_cast<int32>(EQuebecDownState::None));
    QuebecCrime::SetStars(Player, 0);
    TestEqual(TEXT("The garage path clears stars"), QuebecCrime::Stars(Player), 0);
    return true;
}

#endif
