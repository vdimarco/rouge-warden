#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Misc/AutomationTest.h"
#include <limits>

namespace
{
    // Real possessed authority cars and collision, without a saved map or audio device.
    struct FDrivingWorld
    {
        UWorld* World = nullptr;
        AQuebecCar* Car = nullptr;
        APlayerController* Driver = nullptr;
        AQuebecCharacter* Avatar = nullptr;

        FDrivingWorld()
        {
            UWorld::InitializationValues Initialization;
            Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
            World = UWorld::CreateWorld(EWorldType::Game,false,NAME_None,nullptr,true,ERHIFeatureLevel::Num,&Initialization);
            if (!World) return;
            AActor* Floor = World->SpawnActor<AActor>();
            UBoxComponent* FloorBox = NewObject<UBoxComponent>(Floor);
            Floor->SetRootComponent(FloorBox);
            FloorBox->SetBoxExtent(FVector(100000.,100000.,20.));
            FloorBox->SetCollisionProfileName(TEXT("BlockAll"));
            FloorBox->RegisterComponent();
            Floor->SetActorLocation(FVector(0.,0.,-20.));
            FActorSpawnParameters Spawn;
            Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            Car = World->SpawnActor<AQuebecCar>(FVector(0.,0.,102.),FRotator::ZeroRotator,Spawn);
            Avatar = World->SpawnActor<AQuebecCharacter>(FVector(0.,2000.,102.),FRotator::ZeroRotator,Spawn);
            Driver = World->SpawnActor<APlayerController>();
            if (Car && Driver && Avatar)
            {
                Avatar->SetActorEnableCollision(false);
                Car->Occupant = Avatar;
                // No NetDriver/viewport exists in this isolated world. Use the
                // same public local-controller designation as GameModeBase.
                Driver->SetAsLocalPlayerController();
                // AActor::ProcessEvent ignores native input callbacks until the
                // world's actors are initialized. BeginPlay/full city is unnecessary.
                World->InitializeActorsForPlay(FURL());
                Driver->Possess(Car);
            }
        }
        ~FDrivingWorld() { if (World) World->DestroyWorld(false); }
        bool Ready() const { return Car && Avatar && Driver && Car->IsLocallyControlled() && Car->HasAuthority(); }
        void Input(const TCHAR* Function, float Value) const
        {
            struct FAxis { float Value; } Axis{Value};
            Car->ProcessEvent(Car->FindFunctionChecked(FName(Function)),&Axis);
        }
        void Advance(float Seconds, float Step = 1.f/60.f) const
        {
            // Manual car ticks exercise the same swept substeps as the live authority.
            for (float Elapsed = 0.f; Elapsed < Seconds-UE_SMALL_NUMBER; Elapsed += Step)
                Car->Tick(FMath::Min(Step,Seconds-Elapsed));
        }
        void Reset() const
        {
            Car->ResetMotion();
            Car->SetActorLocationAndRotation(FVector(0.,0.,102.),FRotator::ZeroRotator,false,nullptr,ETeleportType::TeleportPhysics);
        }
    };
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCarThrottleTest,"Quebec.Driving.ThrottleBrakeValidation",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCarThrottleTest::RunTest(const FString& Parameters)
{
    FDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed standalone authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    Fixture.Input(TEXT("MoveForward"),1.f);
    Fixture.Advance(1.5f);
    AddInfo(FString::Printf(TEXT("Acceleration speed=%.3f travel=%s local=%d authority=%d initialized=%d"),Car->Speed,
        *Car->GetActorLocation().ToString(),Car->IsLocallyControlled(),Car->HasAuthority(),Fixture.World->AreActorsInitialized()));
    TestTrue(TEXT("Throttle accelerates to useful road speed"),Car->Speed > 1500.f);
    TestTrue(TEXT("Acceleration produces actual travel"),Car->GetActorLocation().X > 1000.f);
    Fixture.Advance(6.f);
    AddInfo(FString::Printf(TEXT("Top speed=%.3f"),Car->Speed));
    TestTrue(TEXT("Top speed remains bounded"),Car->Speed > 2700.f && Car->Speed <= 3000.01f);

    Fixture.Reset(); Car->Speed = 1800.f;
    Fixture.Input(TEXT("MoveForward"),-1.f);
    bool bStopped = false;
    for (int32 Frame = 0; Frame < 120; ++Frame)
    {
        Car->Tick(1.f/120.f);
        if (FMath::IsNearlyZero(Car->Speed,.01f)) { bStopped = true; break; }
        if (!TestTrue(TEXT("Service brake cannot cross through zero in a substep"),Car->Speed > 0.f)) return false;
    }
    TestTrue(TEXT("S reaches a full stop before reverse"),bStopped);
    Fixture.Advance(1.f);
    AddInfo(FString::Printf(TEXT("Braking stopped=%d subsequent reverse speed=%.3f"),bStopped,Car->Speed));
    TestTrue(TEXT("Held S engages bounded reverse after stopping"),Car->Speed < -600.f && Car->Speed >= -950.01f);
    Fixture.Reset(); Car->Speed = .5f;
    Fixture.Input(TEXT("MoveForward"),-1.f); Car->Tick(1.f/120.f);
    TestTrue(TEXT("Opposite input stops a tiny forward crawl before reversing"),Car->Speed == 0.f);
    Fixture.Reset(); Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(.3f);
    Car->Speed = .5f; Fixture.Input(TEXT("MoveForward"),-1.f); Car->Tick(1.f/120.f);
    TestTrue(TEXT("Forward throttle history still brakes a crawl to zero"),Car->Speed == 0.f);
    bool bNoForwardTwitch = true;
    for (int32 Frame = 0; Frame < 12; ++Frame)
    {
        Car->Tick(1.f/120.f);
        bNoForwardTwitch &= Car->Speed <= 0.f;
    }
    AddInfo(FString::Printf(TEXT("Reverse response after 0.1s speed=%.3f no_forward_twitch=%d"),Car->Speed,bNoForwardTwitch));
    TestTrue(TEXT("Held S never twitches forward and engages reverse within 0.1s"),bNoForwardTwitch && Car->Speed < 0.f);

    Fixture.Reset();
    Fixture.Input(TEXT("MoveForward"),std::numeric_limits<float>::quiet_NaN());
    Fixture.Input(TEXT("MoveRight"),std::numeric_limits<float>::infinity());
    Fixture.Advance(.5f);
    TestTrue(TEXT("Nonfinite local input leaves finite stationary state"),FMath::IsFinite(Car->Speed) && Car->Speed == 0.f && Car->GetActorRotation().IsNearlyZero());
    struct FDrive { float Throttle; float Steering; bool Handbrake; } InvalidDrive{1.f,std::numeric_limits<float>::quiet_NaN(),true};
    Car->ProcessEvent(Car->FindFunctionChecked(TEXT("ServerSetDrive")),&InvalidDrive);
    Fixture.Advance(.5f);
    TestTrue(TEXT("Nonfinite drive RPC is rejected as a whole"),Car->Speed == 0.f && !Car->bHandbrake);
    Car->Tick(std::numeric_limits<float>::quiet_NaN());
    TestTrue(TEXT("Nonfinite delta cannot corrupt transform"),!Car->GetActorLocation().ContainsNaN() && Car->Speed == 0.f);
    Fixture.Input(TEXT("MoveForward"),100.f); Fixture.Advance(1.f);
    const float ClampedSpeed = Car->Speed;
    Fixture.Reset(); Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(1.f);
    TestTrue(TEXT("Oversized local input is clamped"),FMath::IsNearlyEqual(Car->Speed,ClampedSpeed,.1f));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCarGripTest,"Quebec.Driving.SteeringHandbrakeRecovery",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCarGripTest::RunTest(const FString& Parameters)
{
    FDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    Car->Speed = 900.f; Fixture.Input(TEXT("MoveRight"),1.f); Fixture.Advance(.35f);
    const float CityTurn = FMath::Abs(Car->GetActorRotation().Yaw);
    Fixture.Reset(); Car->Speed = 2600.f; Fixture.Input(TEXT("MoveRight"),1.f); Fixture.Advance(.35f);
    const float FastTurn = FMath::Abs(Car->GetActorRotation().Yaw);
    AddInfo(FString::Printf(TEXT("City yaw=%.3f fast yaw=%.3f fast speed=%.3f"),CityTurn,FastTurn,Car->Speed));
    TestTrue(TEXT("Steering remains responsive at city speed"),CityTurn > 10.f);
    TestTrue(TEXT("High speed reduces abrupt steering rotation"),FastTurn > 1.f && FastTurn < CityTurn*.8f);

    Fixture.Reset(); Car->Speed = 1800.f; Fixture.Input(TEXT("MoveRight"),.65f); Fixture.Advance(.25f);
    const float DrySlip = FMath::Abs(Car->LateralSpeed);
    Fixture.Reset(); Car->Speed = 1800.f; Car->bHandbrake = true;
    Fixture.Input(TEXT("MoveRight"),.65f); Fixture.Advance(.25f);
    const float BrakeSlip = FMath::Abs(Car->LateralSpeed);
    AddInfo(FString::Printf(TEXT("Dry lateral=%.3f handbrake lateral=%.3f speed=%.3f"),DrySlip,BrakeSlip,Car->Speed));
    TestTrue(TEXT("Handbrake creates a controllable lateral slide"),BrakeSlip > DrySlip+40.f && BrakeSlip < 1000.f);
    Car->bHandbrake = false; Fixture.Input(TEXT("MoveRight"),0.f); Fixture.Advance(.75f);
    AddInfo(FString::Printf(TEXT("Recovered lateral=%.3f speed=%.3f"),Car->LateralSpeed,Car->Speed));
    TestTrue(TEXT("Releasing handbrake recovers tire grip"),FMath::Abs(Car->LateralSpeed) < BrakeSlip*.25f);
    Fixture.Input(TEXT("MoveForward"),1.f); Car->bHandbrake = true; Fixture.Advance(2.f);
    TestTrue(TEXT("Held handbrake stops and holds against throttle"),FMath::Abs(Car->Speed) < .01f && FMath::Abs(Car->LateralSpeed) < .01f);
    Car->bHandbrake = false; Fixture.Advance(1.f);
    AddInfo(FString::Printf(TEXT("Handbrake release speed=%.3f lateral=%.3f"),Car->Speed,Car->LateralSpeed));
    TestTrue(TEXT("Handbrake release resumes acceleration"),Car->Speed > 1000.f);
    Car->ResetMotion(); Fixture.Advance(.25f);
    TestTrue(TEXT("Checkpoint reset clears momentum and held inputs"),Car->Speed == 0.f && Car->LateralSpeed == 0.f && !Car->bHandbrake);
    TestTrue(TEXT("Checkpoint reset retains driver and occupant"),Car->GetController() == Fixture.Driver && Car->Occupant == Fixture.Avatar);
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(1.f);
    Fixture.Driver->UnPossess(); Fixture.Advance(2.f);
    TestTrue(TEXT("Unoccupied failsafe stops former throttle"),Car->Speed == 0.f && Car->LateralSpeed == 0.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCarFrameRateTest,"Quebec.Driving.FrameRateConsistency",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCarFrameRateTest::RunTest(const FString& Parameters)
{
    FDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Input(TEXT("MoveRight"),.25f); Fixture.Advance(2.f,1.f/30.f);
    const float Speed30 = Fixture.Car->Speed;
    const FVector Position30 = Fixture.Car->GetActorLocation();
    const float Yaw30 = Fixture.Car->GetActorRotation().Yaw;
    Fixture.Reset();
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Input(TEXT("MoveRight"),.25f); Fixture.Advance(2.f,1.f/120.f);
    AddInfo(FString::Printf(TEXT("30Hz speed=%.3f position=%s yaw=%.3f; 120Hz speed=%.3f position=%s yaw=%.3f"),
        Speed30,*Position30.ToString(),Yaw30,Fixture.Car->Speed,*Fixture.Car->GetActorLocation().ToString(),Fixture.Car->GetActorRotation().Yaw));
    TestTrue(TEXT("Both frame rates perform a substantial drive"),Speed30 > 1500.f && Fixture.Car->Speed > 1500.f && Position30.Size2D() > 1500.f);
    TestTrue(TEXT("30 and 120 Hz reach similar speed"),FMath::Abs(Fixture.Car->Speed-Speed30) < 50.f);
    TestTrue(TEXT("30 and 120 Hz follow similar physical path"),FVector::Dist2D(Fixture.Car->GetActorLocation(),Position30) < 80.f);
    TestTrue(TEXT("30 and 120 Hz maintain similar steering response"),FMath::Abs(FMath::FindDeltaAngleDegrees(Fixture.Car->GetActorRotation().Yaw,Yaw30)) < 2.f);
    return true;
}
#endif
