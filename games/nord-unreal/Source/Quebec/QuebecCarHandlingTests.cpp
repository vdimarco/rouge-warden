#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Misc/AutomationTest.h"
#include "UObject/UnrealType.h"
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
        UBoxComponent* Obstacle(FVector Center, FVector Extent) const
        {
            AActor* Actor = World->SpawnActor<AActor>();
            UBoxComponent* Box = NewObject<UBoxComponent>(Actor);
            Actor->SetRootComponent(Box);
            Box->SetBoxExtent(Extent);
            Box->SetCollisionProfileName(TEXT("BlockAll"));
            Box->SetCollisionObjectType(ECC_WorldStatic);
            Box->RegisterComponent();
            Actor->SetActorLocation(Center);
            return Box;
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
    TestTrue(TEXT("Throttle builds useful city speed without the former launch surge"),Car->Speed > 1100.f && Car->Speed < 1400.f);
    TestTrue(TEXT("Gentler acceleration still produces actual travel"),Car->GetActorLocation().X > 750.f && Car->GetActorLocation().X < 1100.f);
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
    Car->bHandbrake = false; Fixture.Advance(1.5f);
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

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCarAssistanceTest,"Quebec.Driving.EasyCorneringAndLiftOff",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCarAssistanceTest::RunTest(const FString& Parameters)
{
    FDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    const FFloatProperty* VisualSteering = FindFProperty<FFloatProperty>(AQuebecCar::StaticClass(),TEXT("VisualSteering"));
    if (!TestNotNull(TEXT("Actual replicated steering readback is available"),VisualSteering)) return false;

    Car->Speed = 900.f; Fixture.Input(TEXT("MoveRight"),1.f); Fixture.Advance(.1f);
    const float TapTurn = FMath::Abs(Car->GetActorRotation().Yaw);
    AddInfo(FString::Printf(TEXT("Brief correction yaw=%.3f steering=%.3f"),TapTurn,VisualSteering->GetPropertyValue_InContainer(Car)));
    TestTrue(TEXT("A brief full-key correction turns gently instead of snapping to lock"),TapTurn > .5f && TapTurn < 2.f);
    Fixture.Advance(.25f);
    const float FullTurn = FMath::Abs(Car->GetActorRotation().Yaw);
    TestTrue(TEXT("A sustained steering hold still reaches full lock"),VisualSteering->GetPropertyValue_InContainer(Car) > .99f && FullTurn > 10.f);
    Fixture.Input(TEXT("MoveRight"),0.f); Fixture.Advance(.15f);
    TestTrue(TEXT("Releasing steering fully recenters within 150 ms"),FMath::Abs(VisualSteering->GetPropertyValue_InContainer(Car)) < .001f);
    Fixture.Input(TEXT("MoveRight"),1.f); Fixture.Advance(.3f);
    Fixture.Input(TEXT("MoveRight"),-1.f); Fixture.Advance(.15f);
    TestTrue(TEXT("Opposite input crosses neutral promptly without waiting for slow turn-in"),VisualSteering->GetPropertyValue_InContainer(Car) < -.1f);

    Fixture.Reset(); Car->Speed = 900.f; Fixture.Input(TEXT("MoveRight"),.25f); Fixture.Advance(.35f);
    const float PartialTurn = FMath::Abs(Car->GetActorRotation().Yaw);
    TestTrue(TEXT("Partial steering produces a substantially smaller correction than full lock"),PartialTurn > 1.f && PartialTurn < FullTurn*.4f);

    Fixture.Reset(); Car->Speed = 2000.f; Fixture.Advance(2.f);
    AddInfo(FString::Printf(TEXT("Lift-off after 2s speed=%.3f travel=%.3f"),Car->Speed,Car->GetActorLocation().X));
    TestTrue(TEXT("Lifting Gas visibly sheds speed instead of retaining the former long coast"),Car->Speed > 1000.f && Car->Speed < 1200.f);
    TestTrue(TEXT("Lift-off slows progressively without an instant stop"),Car->GetActorLocation().X > 2800.f && Car->GetActorLocation().X < 3250.f);

    Fixture.Reset(); Car->Speed = 2000.f; Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Input(TEXT("MoveRight"),1.f);
    Fixture.Advance(2.f);
    const float TightCornerSpeed = Car->Speed;
    AddInfo(FString::Printf(TEXT("Assisted full corner speed=%.3f yaw=%.3f"),TightCornerSpeed,Car->GetActorRotation().Yaw));
    TestTrue(TEXT("Holding Gas through a full forward turn settles near city corner speed"),TightCornerSpeed > 800.f && TightCornerSpeed < 1000.f);
    Fixture.Reset(); Car->Speed = 2000.f; Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Input(TEXT("MoveRight"),.25f);
    Fixture.Advance(2.f);
    TestTrue(TEXT("Shallow steering retains substantially more forward speed"),Car->Speed > 2000.f && Car->Speed < 2400.f);
    Fixture.Reset(); Car->Speed = 2000.f; Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Input(TEXT("MoveRight"),.1f);
    Fixture.Advance(2.f);
    TestTrue(TEXT("A small straight-road correction does not engage corner braking"),Car->Speed > 2600.f);
    Fixture.Reset(); Car->Speed = -800.f; Fixture.Input(TEXT("MoveForward"),-1.f); Fixture.Input(TEXT("MoveRight"),1.f);
    Fixture.Advance(1.f);
    TestTrue(TEXT("Forward corner assistance never brakes deliberate reverse"),Car->Speed < -700.f && Car->Speed >= -950.01f);

    Fixture.Reset(); Car->bTraffic = true; Car->Speed = 1000.f;
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Input(TEXT("MoveRight"),.8f); Fixture.Advance(.25f);
    TestTrue(TEXT("Traffic retains its existing acceleration and receives no player corner assistance"),FMath::IsNearlyEqual(Car->Speed,1312.5f,1.f));
    TestTrue(TEXT("Traffic retains its existing direct steering"),FMath::IsNearlyEqual(Car->GetActorRotation().Yaw,28.f,.1f));
    Car->bTraffic = false;
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

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCarContactTest,"Quebec.Driving.FittedHullCurbsAndWalls",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCarContactTest::RunTest(const FString& Parameters)
{
    FDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    Fixture.Advance(.2f);
    TestTrue(TEXT("Wheels settle on ground, not chassis"),FMath::IsNearlyEqual(Car->GetActorLocation().Z,100.5,1.));
    UBoxComponent* Probe = Fixture.Obstacle(FVector(200.,0.,150.),FVector(5.,50.,5.));
    for (int32 Profile=0; Profile<3; ++Profile)
    {
        Car->BodyProfile = Profile;
        Car->ProcessEvent(Car->FindFunctionChecked(TEXT("ApplyPaint")),nullptr);
        Probe->GetOwner()->SetActorLocation(FVector(200.,0.,150.));
        TestTrue(TEXT("Each profile leaves empty hood space passable"),Car->CanFitAt(Car->GetActorLocation(),FQuat::Identity));
        Probe->GetOwner()->SetActorLocation(FVector(0.,0.,150.));
        TestFalse(TEXT("Each profile blocks its cabin"),Car->CanFitAt(Car->GetActorLocation(),FQuat::Identity));
    }
    Car->BodyProfile = 0;
    Car->ProcessEvent(Car->FindFunctionChecked(TEXT("ApplyPaint")),nullptr);
    Probe->GetOwner()->SetActorLocation(FVector(200.,0.,150.));
    TestTrue(TEXT("Empty space above hood is passable"),Car->CanFitAt(Car->GetActorLocation(),FQuat::Identity));
    Probe->GetOwner()->SetActorLocation(FVector(0.,0.,150.));
    TestFalse(TEXT("Cabin blocks at its visible height"),Car->CanFitAt(Car->GetActorLocation(),FQuat::Identity));
    TestTrue(TEXT("Checkpoint clearance retains its explicit ignored actor"),Car->CanFitAt(Car->GetActorLocation(),FQuat::Identity,Probe->GetOwner()));
    Probe->GetOwner()->SetActorLocation(FVector(231.,0.,51.));
    TestFalse(TEXT("Front bumper is included in fitted hull"),Car->CanFitAt(Car->GetActorLocation(),FQuat::Identity));
    Probe->GetOwner()->Destroy();

    UBoxComponent* Curb = Fixture.Obstacle(FVector(2400.,0.,9.),FVector(2000.,1000.,9.));
    Fixture.Input(TEXT("MoveForward"),.3f);
    for (int32 Frame=0; Frame<360 && Car->GetActorLocation().X<300.; ++Frame) Car->Tick(1.f/120.f);
    AddInfo(FString::Printf(TEXT("Curb front wheels position=%s rotation=%s"),*Car->GetActorLocation().ToString(),*Car->GetActorRotation().ToString()));
    TestTrue(TEXT("Front wheels climb while rear wheels remain on road"),Car->GetActorRotation().Pitch>2.f && Car->GetActorRotation().Pitch<6.f);
    Fixture.Advance(1.5f);
    TestTrue(TEXT("Ordinary curb is traversable and all wheels reach sidewalk"),Car->GetActorLocation().X>900. && FMath::IsNearlyEqual(Car->GetActorLocation().Z,118.5,1.));
    Curb->GetOwner()->Destroy();
    Fixture.Reset();
    Curb = Fixture.Obstacle(FVector(2400.,0.,15.),FVector(2000.,1000.,15.));
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(2.f);
    TestTrue(TEXT("A 30 cm step stops wheels instead of teleporting the car"),Car->GetActorLocation().X<245. && Car->GetActorLocation().Z<102.);
    Curb->GetOwner()->Destroy();

    Fixture.Reset();
    UBoxComponent* Wall = Fixture.Obstacle(FVector(450.,0.,250.),FVector(50.,5000.,250.));
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(2.f);
    TestTrue(TEXT("Wall stops fitted bumper without tunnelling"),Car->GetActorLocation().X<175. && Car->GetActorLocation().X>140.);
    TestTrue(TEXT("Tall wall cannot be climbed"),Car->GetActorLocation().Z<102.);
    Fixture.Reset(); Car->SetActorRotation(FRotator(0.,40.,0.));
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(2.f);
    AddInfo(FString::Printf(TEXT("Glancing wall position=%s speed=%.2f lateral=%.2f"),*Car->GetActorLocation().ToString(),Car->Speed,Car->LateralSpeed));
    TestTrue(TEXT("Glancing contact moves along wall"),Car->GetActorLocation().Y>300.);
    TestTrue(TEXT("Glancing contact stays outside wall"),Car->GetActorLocation().X<180.);
    Wall->GetOwner()->Destroy();

    Fixture.Reset();
    FActorSpawnParameters Spawn; Spawn.SpawnCollisionHandlingOverride=ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecCar* Parked = Fixture.World->SpawnActor<AQuebecCar>(FVector(700.,0.,100.5),FRotator::ZeroRotator,Spawn);
    // Both cars tick as the live authority does, so the struck car can react.
    const auto AdvanceBoth = [&](float Seconds)
    {
        for (float Elapsed = 0.f; Elapsed < Seconds-UE_SMALL_NUMBER; Elapsed += 1.f/60.f) { Car->Tick(1.f/60.f); Parked->Tick(1.f/60.f); }
    };
    Fixture.Input(TEXT("MoveForward"),1.f); AdvanceBoth(2.f);
    AddInfo(FString::Printf(TEXT("Push driver=%s parked=%s"),*Car->GetActorLocation().ToString(),*Parked->GetActorLocation().ToString()));
    TestTrue(TEXT("Driving into a parked car shoves it forward"),Parked->GetActorLocation().X>760.);
    TestTrue(TEXT("The pushing car follows instead of passing through"),Car->GetActorLocation().X<Parked->GetActorLocation().X-300.);
    TestTrue(TEXT("Pushed-car contact leaves no overlap"),Car->CanFitAt(Car->GetActorLocation(),Car->GetActorQuat()) &&
        Parked->CanFitAt(Parked->GetActorLocation(),Parked->GetActorQuat()));
    TestTrue(TEXT("A pushed car stays on its wheels"),FMath::Abs(Parked->GetActorRotation().Pitch)<3.f && FMath::Abs(Parked->GetActorRotation().Roll)<3.f);
    // Brake so the driver stops pushing, then let the struck car settle.
    Fixture.Input(TEXT("MoveForward"),-1.f); AdvanceBoth(.8f);
    Fixture.Input(TEXT("MoveForward"),0.f); AdvanceBoth(2.5f);
    TestTrue(TEXT("A struck car slides to a stop once nothing pushes it"),FMath::Abs(Parked->Speed)<1.f && FMath::Abs(Parked->LateralSpeed)<1.f);
    Parked->Destroy();
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCarImpactTest,"Quebec.Driving.CarImpactMomentum",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCarImpactTest::RunTest(const FString& Parameters)
{
    using QuebecCarImpact::Resolve;
    // Head-on into a parked car: equal masses share the momentum, with a little bounce.
    QuebecCarImpact::FResult Hit = Resolve(FVector(1000.,0.,0.),FVector::ZeroVector,FVector(-1.,0.,0.),FVector(230.,0.,0.),FVector(-230.,0.,0.));
    TestTrue(TEXT("Closing cars impact"),Hit.bImpact);
    TestEqual(TEXT("Striking car keeps 37.5% of its speed"),1000.+Hit.DeltaA.X,375.,1.);
    TestEqual(TEXT("Struck car takes 62.5% of the speed"),-Hit.DeltaA.X,625.,1.);
    TestEqual(TEXT("Momentum is conserved"),(1000.+Hit.DeltaA.X)+(-Hit.DeltaA.X),1000.,1.);
    TestTrue(TEXT("A centred hit does not spin"),FMath::Abs(Hit.SpinA)<1.f && FMath::Abs(Hit.SpinB)<1.f);
    // Corner hit on the struck car's rear quarter spins it.
    Hit = Resolve(FVector(1000.,0.,0.),FVector::ZeroVector,FVector(-1.,0.,0.),FVector(230.,90.,0.),FVector(-230.,90.,0.));
    TestTrue(TEXT("An off-centre hit spins the struck car"),FMath::Abs(Hit.SpinB)>20.f && FMath::Abs(Hit.SpinB)<=180.f);
    TestTrue(TEXT("Both cars spin in opposite senses"),Hit.SpinA*Hit.SpinB<0.f);
    // A glancing scrape loses some speed along the side but never reverses it.
    Hit = Resolve(FVector(1000.,-200.,0.),FVector::ZeroVector,FVector(0.,1.,0.),FVector(0.,-95.,0.),FVector(0.,95.,0.));
    TestTrue(TEXT("Scraping friction slows the slide"),Hit.DeltaA.X<0. && 1000.+Hit.DeltaA.X>800.);
    TestTrue(TEXT("The side hit pushes the cars apart"),Hit.DeltaA.Y>0.);
    // Separating or resting contact exchanges nothing.
    TestFalse(TEXT("A car pulling away is not struck"),Resolve(FVector::ZeroVector,FVector(500.,0.,0.),FVector(-1.,0.,0.),FVector::ZeroVector,FVector::ZeroVector).bImpact);
    TestFalse(TEXT("Touching at walking pace is not a crash"),Resolve(FVector(40.,0.,0.),FVector::ZeroVector,FVector(-1.,0.,0.),FVector::ZeroVector,FVector::ZeroVector).bImpact);
    return true;
}
#endif
