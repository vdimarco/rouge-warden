#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Animation/AnimSingleNodeInstance.h"
#include "Camera/PlayerCameraManager.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecResidentHiddenPoseTest, "Quebec.Residents.HiddenVisuals",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecResidentHiddenPoseTest::RunTest(const FString& Parameters)
{
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true,
        ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated resident world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    APlayerController* Viewer = World->SpawnActor<APlayerController>();
    AQuebecCharacter* Player = World->SpawnActor<AQuebecCharacter>();
    AQuebecParkResident* Resident = World->SpawnActor<AQuebecParkResident>();
    AQuebecParkResident* Reference = World->SpawnActor<AQuebecParkResident>();
    if (!Viewer || !Player || !Resident || !Reference) return false;
    Viewer->SetAsLocalPlayerController();
    Player->CrewStyle = 3;
    Player->SetActorEnableCollision(false);
    for (AQuebecParkResident* Walker : {Resident, Reference})
    {
        Walker->Style = 9;
        Walker->Route = {FVector(0., 0., 7.), FVector(4000., 0., 7.)};
        Walker->Pace = 120.f;
        Walker->Phase = .25f;
    }
    World->InitializeActorsForPlay(FURL());
    if (!TestTrue(TEXT("Fixture has a local camera"), Viewer->IsLocalController() && Viewer->PlayerCameraManager)) return false;
    Resident->DispatchBeginPlay();
    Reference->DispatchBeginPlay();
    USkeletalMeshComponent* Body = Resident->FindComponentByClass<USkeletalMeshComponent>();
    USkeletalMeshComponent* ReferenceBody = Reference->FindComponentByClass<USkeletalMeshComponent>();
    if (!TestTrue(TEXT("Production resident bodies are loaded"), Body && ReferenceBody && Body->GetSkeletalMeshAsset())) return false;
    TestTrue(TEXT("Resident movement is authoritative"), Resident->HasAuthority());
    const auto CheckManualPoseDriving = [this, Body]()
    {
        TestFalse(TEXT("Resident body cannot schedule an autonomous component tick"), Body->PrimaryComponentTick.bCanEverTick);
        TestFalse(TEXT("Resident body has no registered autonomous component tick"), Body->PrimaryComponentTick.IsTickFunctionRegistered());
    };
    CheckManualPoseDriving();
    const auto TickAt = [World, Resident](double Seconds)
    {
        // Sample the production absolute clock deterministically without ticking unrelated actors.
        World->TimeSeconds = Seconds;
        Resident->Tick(1.f / 60.f);
    };
    TickAt(1.);
    if (!TestNotNull(TEXT("Visible resident has a live single-node animation"), Body->GetSingleNodeInstance())) return false;
    const float FirstPoseTime = Body->GetPosition();
    TickAt(1.037);
    CheckManualPoseDriving();
    TestFalse(TEXT("Resident starts visible"), Resident->IsHidden());
    TestTrue(TEXT("Visible pose time advances"), !FMath::IsNearlyEqual(Body->GetPosition(), FirstPoseTime, .001f));
    const float VisiblePoseTime = Body->GetPosition();
    const FTransform VisibleFoot = Body->GetSocketTransform(TEXT("RightFoot"), RTS_Component);
    FVector PreviousLocation = Resident->GetActorLocation();
    Player->CrewStyle = Resident->Style;
    for (double Seconds : {1.137, 1.411})
    {
        TickAt(Seconds);
        TestTrue(TEXT("Worn crew hides the duplicate resident"), Resident->IsHidden());
        TestFalse(TEXT("Hidden duplicate keeps collision disabled"), Resident->GetActorEnableCollision());
        TestTrue(TEXT("Hidden authority continues along its route"), Resident->GetActorLocation().X > PreviousLocation.X + 1.);
        TestEqual(TEXT("Hidden pose time remains unevaluated"), Body->GetPosition(), VisiblePoseTime);
        TestTrue(TEXT("Hidden foot pose remains unevaluated"), Body->GetSocketTransform(TEXT("RightFoot"), RTS_Component).Equals(VisibleFoot, .0001));
        PreviousLocation = Resident->GetActorLocation();
    }
    Player->CrewStyle = 3;
    TickAt(1.733);
    CheckManualPoseDriving();
    Reference->Tick(1.f / 60.f);
    TestFalse(TEXT("Changing crew reveals the resident immediately"), Resident->IsHidden());
    TestTrue(TEXT("Visible resident regains collision"), Resident->GetActorEnableCollision());
    TestTrue(TEXT("Unhide does not rewind or stop authority travel"), Resident->GetActorLocation().X > PreviousLocation.X + 1.);
    TestTrue(TEXT("First visible pose catches up to a fresh resident at the current shared time"),
        FMath::IsNearlyEqual(Body->GetPosition(), ReferenceBody->GetPosition(), .0001f));
    TestTrue(TEXT("First visible foot matches the current-time reference pose"),
        Body->GetSocketTransform(TEXT("RightFoot"), RTS_Component).Equals(
            ReferenceBody->GetSocketTransform(TEXT("RightFoot"), RTS_Component), .001));
    TestTrue(TEXT("Unhide evaluates a new pose instead of retaining the hidden frame"),
        !FMath::IsNearlyEqual(Body->GetPosition(), VisiblePoseTime, .001f));
    return true;
}
#endif
