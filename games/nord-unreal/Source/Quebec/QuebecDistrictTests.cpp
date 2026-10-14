#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "QuebecCampaign.h"
#include "LaFontaineMap.h"
#include "LaFontaineExtensionMap.h"
#include "CollegeBathurstMap.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PhysicsVolume.h"
#include "GameFramework/PlayerStart.h"
#include "Misc/AutomationTest.h"
#include "Misc/Guid.h"
#include "UObject/Package.h"

namespace
{
    struct FDistrictWorld
    {
        UWorld* World = nullptr;
        explicit FDistrictWorld(const TCHAR* MapName)
        {
            // Exercise GetMapName and PIE normalization without loading or saving either real map.
            UPackage* Package = CreatePackage(*FString::Printf(TEXT("/Temp/NordDistrict_%s/%s"),
                *FGuid::NewGuid().ToString(EGuidFormats::Digits), MapName));
            UWorld::InitializationValues Initialization;
            Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, FName(MapName), Package, true,
                ERHIFeatureLevel::Num, &Initialization);
            if (World) GEngine->CreateNewWorldContext(EWorldType::Game).SetCurrentWorld(World);
        }
        ~FDistrictWorld()
        {
            if (World)
            {
                World->DestroyWorld(false);
                GEngine->DestroyWorldContext(World);
            }
        }
    };

    template<class T> int32 CountActors(UWorld* World)
    {
        int32 Count = 0;
        for (TActorIterator<T> It(World); It; ++It) ++Count;
        return Count;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecDistrictIdentityTest, "Quebec.District.Identity",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecDistrictIdentityTest::RunTest(const FString& Parameters)
{
    TestTrue(TEXT("Actual Toronto package selects Toronto"), QuebecDistrict::IsTorontoMapName(TEXT("/Game/Maps/CollegeBathurst")));
    TestTrue(TEXT("Standalone short map selects Toronto"), QuebecDistrict::IsTorontoMapName(TEXT("CollegeBathurst")));
    TestTrue(TEXT("PIE instance selects the same district"), QuebecDistrict::IsTorontoMapName(TEXT("/Game/Maps/UEDPIE_12_CollegeBathurst")));
    TestFalse(TEXT("A similarly named map is not Toronto"), QuebecDistrict::IsTorontoMapName(TEXT("CollegeBathurstPreview")));
    TestFalse(TEXT("Montréal retains its district"), QuebecDistrict::IsTorontoMapName(TEXT("/Game/Maps/LaFontaine")));
    TestFalse(TEXT("Synthetic worlds retain their default"), QuebecDistrict::IsTorontoMapName(TEXT("Untitled")));
    TestFalse(TEXT("Missing world retains its default"), QuebecDistrict::IsToronto(nullptr));
    for (const TCHAR* MapName : {TEXT("CollegeBathurst"), TEXT("UEDPIE_2_CollegeBathurst"), TEXT("LaFontaine"),
        TEXT("UEDPIE_5_LaFontaine"), TEXT("DistrictSynthetic"), TEXT("LaFontainePreview")})
    {
        FDistrictWorld Fixture(MapName);
        if (!TestNotNull(TEXT("Isolated named world"), Fixture.World)) return false;
        const bool bToronto = FString(MapName).Contains(TEXT("CollegeBathurst"));
        const bool bExpanded = FString(MapName) == TEXT("LaFontaine") || FString(MapName) == TEXT("UEDPIE_5_LaFontaine");
        TestEqual(TEXT("Loaded world identity agrees with its real map name"), QuebecDistrict::IsToronto(Fixture.World), bToronto);
        const QuebecDistrict::FSettings& District = QuebecDistrict::ForWorld(Fixture.World);
        TestTrue(TEXT("Player origin uses the selected survey"), District.PlayerSpawn.Equals(bToronto ? CollegeBathurst::Spawn : LaFontaine::Spawn));
        TestTrue(TEXT("Car origin uses the selected survey"), District.CarSpawn.Equals(bToronto ? CollegeBathurst::CarSpawn : LaFontaine::CarSpawn));
        TestEqual(TEXT("Radar uses the selected survey's road count"), District.RoadCount,
            int32(bToronto ? UE_ARRAY_COUNT(CollegeBathurst::RoadSegments) : bExpanded
                ? UE_ARRAY_COUNT(LaFontaineExtension::RadarRoadSegments) : UE_ARRAY_COUNT(LaFontaine::RoadSegments)));
        if (bExpanded)
        {
            for (int32 Index = 0; Index < UE_ARRAY_COUNT(LaFontaine::RoadSegments); ++Index)
                for (int32 End = 0; End < 2; ++End)
                    TestTrue(TEXT("Expanded radar retains every original endpoint"), District.RoadSegments[Index][End].Equals(LaFontaine::RoadSegments[Index][End]));
            for (int32 Index = 0; Index < UE_ARRAY_COUNT(LaFontaineExtension::RoadSegments); ++Index)
                for (int32 End = 0; End < 2; ++End)
                    TestTrue(TEXT("Expanded radar appends every surveyed extension endpoint"), District.RoadSegments[UE_ARRAY_COUNT(LaFontaine::RoadSegments) + Index][End].Equals(LaFontaineExtension::RoadSegments[Index][End]));
        }
        TestTrue(TEXT("Radar uses the selected survey's actual endpoints"), District.RoadSegments[0][0].Equals(
            bToronto ? CollegeBathurst::RoadSegments[0][0] : LaFontaine::RoadSegments[0][0]));
        TestEqual(TEXT("HUD city follows the loaded district"), FString(District.City), FString(bToronto ? TEXT("TORONTO") : TEXT("MONTRÉAL")));
        TestEqual(TEXT("HUD credits follow the selected licence"), FString(District.SurveyCredit), FString(bToronto
            ? TEXT("City of Toronto / Open Government Licence") : TEXT("© Ville de Montréal / CC BY 4.0")));
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecDistrictRuntimeTest, "Quebec.District.SpawnRecoveryAndWater",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecDistrictRuntimeTest::RunTest(const FString& Parameters)
{
    for (const TCHAR* MapName : {TEXT("CollegeBathurst"), TEXT("UEDPIE_3_CollegeBathurst"), TEXT("DistrictSynthetic")})
    {
        FDistrictWorld Fixture(MapName);
        UWorld* World = Fixture.World;
        if (!TestNotNull(TEXT("Recovery world"), World)) return false;
        const bool bToronto = QuebecDistrict::IsToronto(World);
        AQuebecGameMode* Mode = World->SpawnActor<AQuebecGameMode>();
        AQuebecController* Controller = World->SpawnActor<AQuebecController>();
        AQuebecCharacter* Walker = World->SpawnActor<AQuebecCharacter>();
        AQuebecCar* Car = World->SpawnActor<AQuebecCar>(FVector(5000., 5000., 100.), FRotator::ZeroRotator);
        if (!TestNotNull(TEXT("Game mode"), Mode) || !TestNotNull(TEXT("Controller"), Controller) ||
            !TestNotNull(TEXT("Walker"), Walker) || !TestNotNull(TEXT("Car"), Car)) return false;
        Walker->SetActorEnableCollision(false);
        Car->SetActorEnableCollision(false);
        World->InitializeActorsForPlay(FURL());
        AActor* Fallback = Mode->ChoosePlayerStart_Implementation(Controller);
        if (bToronto)
        {
            if (!TestNotNull(TEXT("Missing Toronto start has a district fallback"), Fallback)) return false;
            TestTrue(TEXT("Fallback is at the Toronto sidewalk origin"), Fallback->GetActorLocation().Equals(CollegeBathurst::Spawn));
            Fallback->Destroy();
        }
        else TestNull(TEXT("Synthetic worlds retain the engine's no-start result"), Fallback);
        APlayerStart* Authored = World->SpawnActor<APlayerStart>(FVector(8000., 8000., 120.), FRotator(0., 35., 0.));
        if (!TestNotNull(TEXT("Authored multiplayer start"), Authored)) return false;
        TestTrue(TEXT("Authored start is preferred to the district fallback"), Mode->ChoosePlayerStart_Implementation(Controller) == Authored);

        Walker->SetActorLocation(FVector(0., 0., -1600.));
        Walker->GetCharacterMovement()->Velocity = FVector(20., 30., -400.);
        Walker->Tick(1.f / 60.f);
        TestTrue(TEXT("Fallen walker recovers to its district"), Walker->GetActorLocation().Equals(bToronto ? CollegeBathurst::Spawn : LaFontaine::Spawn, .01));
        TestTrue(TEXT("Walker recovery clears velocity"), Walker->GetVelocity().IsNearlyZero());
        Car->SetActorLocation(FVector(0., 0., -1600.));
        Car->Speed = 400.f;
        Car->LateralSpeed = 50.f;
        Car->Tick(1.f / 60.f);
        TestTrue(TEXT("Fallen car recovers to its district"), Car->GetActorLocation().Equals(bToronto ? CollegeBathurst::CarSpawn : LaFontaine::CarSpawn, .01));
        TestEqual(TEXT("Car recovery clears forward motion"), Car->Speed, 0.f);
        TestEqual(TEXT("Car recovery clears lateral motion"), Car->LateralSpeed, 0.f);

        // The two survey origins overlap numerically. A Montréal pond must never make Toronto ground wet.
        Walker->SetActorLocation(FVector(-10651.111588, 7939.899, 80.));
        Walker->GetCharacterMovement()->SetMovementMode(MOVE_Walking);
        Walker->UpdateSwimming(1.f / 60.f);
        TestEqual(TEXT("Mapped pond applies only to Montréal/default worlds"), Walker->GetCharacterMovement()->IsSwimming(), !bToronto);
        int32 PondVolumes = 0;
        for (TActorIterator<APhysicsVolume> It(World); It; ++It)
            if (It->ActorHasTag(TEXT("NordSurfaceWater"))) ++PondVolumes;
        TestEqual(TEXT("Toronto creates no borrowed pond volume"), PondVolumes, bToronto ? 0 : 1);
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecDistrictIsolationTest, "Quebec.District.TorontoFreeRoamIsolation",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecDistrictIsolationTest::RunTest(const FString& Parameters)
{
    FDistrictWorld Fixture(TEXT("CollegeBathurst"));
    UWorld* World = Fixture.World;
    if (!TestNotNull(TEXT("Toronto isolation world"), World)) return false;
    AQuebecGameMode* Mode = World->SpawnActor<AQuebecGameMode>();
    AQuebecGameState* State = World->SpawnActor<AQuebecGameState>();
    AQuebecCar* Starter = World->SpawnActor<AQuebecCar>(CollegeBathurst::CarSpawn, FRotator::ZeroRotator);
    AStaticMeshActor* Road = World->SpawnActor<AStaticMeshActor>();
    if (!TestNotNull(TEXT("Game mode"), Mode) || !TestNotNull(TEXT("Game state"), State) ||
        !TestNotNull(TEXT("Authored starter car"), Starter) || !TestNotNull(TEXT("Road actor"), Road)) return false;
    // Empty transient mesh tests collision routing by the same asset name, without modifying Content.
    Road->GetStaticMeshComponent()->SetStaticMesh(NewObject<UStaticMesh>(Road, TEXT("SM_Road")));
    Road->GetStaticMeshComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    World->SetGameState(State);
    World->InitializeActorsForPlay(FURL());
    Mode->DispatchBeginPlay();
    TestEqual(TEXT("Toronto creates no Montréal campaign"), CountActors<AQuebecCampaign>(World), 0);
    TestEqual(TEXT("Toronto creates no Montréal crowds"), CountActors<AQuebecParkResident>(World), 0);
    TestEqual(TEXT("Toronto retains only its authored starter car"), CountActors<AQuebecCar>(World), 1);
    TestFalse(TEXT("Starter remains manually drivable"), Starter->bTraffic);
    TestTrue(TEXT("Toronto visual roads are query surfaces"), Road->GetStaticMeshComponent()->GetCollisionEnabled() == ECollisionEnabled::QueryOnly);
    TestTrue(TEXT("Toronto roads provide visibility support"), Road->GetStaticMeshComponent()->GetCollisionResponseToChannel(ECC_Visibility) == ECR_Block);
    TestTrue(TEXT("Toronto visual roads do not block pawns"), Road->GetStaticMeshComponent()->GetCollisionResponseToChannel(ECC_Pawn) == ECR_Ignore);
    TestFalse(TEXT("Toronto rejects a Montréal objective even at its exact coordinates"), State->AdvanceMissionNear(AQuebecGameState::MissionLocations[0]));
    TestEqual(TEXT("Toronto legacy progress stays at zero"), State->MissionIndex, 0);

    AQuebecController* Controller = World->SpawnActor<AQuebecController>();
    AQuebecCharacter* Walker = World->SpawnActor<AQuebecCharacter>(FVector(0., 2000., 120.), FRotator::ZeroRotator);
    AQuebecCampaign* Unexpected = World->SpawnActor<AQuebecCampaign>();
    if (!TestNotNull(TEXT("Controller"), Controller) || !TestNotNull(TEXT("Walker"), Walker) || !TestNotNull(TEXT("Unexpected placed campaign"), Unexpected)) return false;
    Controller->SetAsLocalPlayerController();
    Controller->Possess(Walker);
    Unexpected->DispatchBeginPlay();
    TestFalse(TEXT("A placed Toronto campaign disables ticking"), Unexpected->IsActorTickEnabled());
    TestNull(TEXT("A placed Toronto campaign creates no worklight car"), Unexpected->LightCar.Get());
    TestNull(TEXT("A placed Toronto campaign creates no race loan car"), Unexpected->LoanCar.Get());
    TestEqual(TEXT("A placed Toronto campaign builds no encounter components"), Unexpected->GetComponents().Num(), 1);
    TestEqual(TEXT("A placed Toronto campaign does not restore Montréal progress"), Unexpected->CompletedMissions, 0);
    Unexpected->SaveStatus = TEXT("Toronto isolation sentinel");
    Unexpected->Phase = EQuebecCampaignPhase::Complete;
    Unexpected->CompletedMissions = 2;
    const FVector BeforeRetry = Walker->GetActorLocation();
    Unexpected->RequestRetry(Controller);
    Unexpected->RequestReplay(Controller);
    Unexpected->Tick(.1f);
    TestTrue(TEXT("Toronto retry/replay cannot move the walker into Montréal"), Walker->GetActorLocation().Equals(BeforeRetry));
    TestTrue(TEXT("Toronto replay cannot mutate campaign phase"), Unexpected->Phase == EQuebecCampaignPhase::Complete);
    TestEqual(TEXT("Toronto replay preserves save status"), Unexpected->SaveStatus, FString(TEXT("Toronto isolation sentinel")));
    TestFalse(TEXT("Toronto campaign interaction is inert"), Unexpected->HandleInteract(Controller));

    AActor* Floor = World->SpawnActor<AActor>();
    if (!TestNotNull(TEXT("Entry/exit ground fixture"), Floor)) return false;
    UBoxComponent* FloorBox = NewObject<UBoxComponent>(Floor);
    Floor->SetRootComponent(FloorBox);
    FloorBox->SetBoxExtent(FVector(10000., 10000., 20.));
    FloorBox->SetCollisionProfileName(TEXT("BlockAll"));
    FloorBox->RegisterComponent();
    Floor->SetActorLocation(FVector(CollegeBathurst::CarSpawn.X, CollegeBathurst::CarSpawn.Y, -20.));
    Walker->SetActorLocation(CollegeBathurst::CarSpawn + Starter->GetActorRightVector() * 210. + FVector(0., 0., 5.));
    Controller->ProcessEvent(Controller->FindFunctionChecked(TEXT("ServerInteract")), nullptr);
    TestTrue(TEXT("Toronto keeps authoritative starter-car entry"), Controller->GetPawn() == Starter && Starter->Occupant == Walker);
    TestTrue(TEXT("Entered walker is hidden while driving"), Walker->IsHidden());
    Controller->ProcessEvent(Controller->FindFunctionChecked(TEXT("ServerInteract")), nullptr);
    TestTrue(TEXT("Toronto keeps collision-checked starter-car exit"), Controller->GetPawn() == Walker && !Starter->Occupant);
    TestFalse(TEXT("Exited walker is visible again"), Walker->IsHidden());
    TestTrue(TEXT("Exited walker is grounded beside the Toronto car"), FVector::Dist2D(Walker->GetActorLocation(), CollegeBathurst::CarSpawn) <= 350.);

    FDistrictWorld Synthetic(TEXT("DistrictSynthetic"));
    if (!TestNotNull(TEXT("Synthetic compatibility world"), Synthetic.World)) return false;
    AQuebecGameState* DefaultState = Synthetic.World->SpawnActor<AQuebecGameState>();
    if (!TestNotNull(TEXT("Synthetic game state"), DefaultState)) return false;
    TestTrue(TEXT("Synthetic fixtures retain Montréal objective advancement"), DefaultState->AdvanceMissionNear(AQuebecGameState::MissionLocations[0]));
    TestEqual(TEXT("Synthetic objective advances once"), DefaultState->MissionIndex, 1);
    return true;
}
#endif
