#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "GameFramework/InputSettings.h"
#include "GameFramework/PlayerController.h"
#include "Misc/AutomationTest.h"
#include "UObject/UnrealType.h"
#include <limits>

namespace
{
    // A possessed authority car on a 2 km floor, like the handling fixture, that can also be placed on a street.
    struct FAssistDrivingWorld
    {
        UWorld* World = nullptr;
        AQuebecCar* Car = nullptr;
        APlayerController* Driver = nullptr;
        AQuebecCharacter* Avatar = nullptr;

        FAssistDrivingWorld()
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
                Driver->SetAsLocalPlayerController();
                World->InitializeActorsForPlay(FURL());
                Driver->Possess(Car);
            }
        }
        ~FAssistDrivingWorld() { if (World) World->DestroyWorld(false); }
        bool Ready() const { return Car && Avatar && Driver && Car->IsLocallyControlled() && Car->HasAuthority(); }
        void Input(const TCHAR* Function, float Value) const
        {
            struct FAxis { float Value; } Axis{Value};
            Car->ProcessEvent(Car->FindFunctionChecked(FName(Function)),&Axis);
        }
        void Advance(float Seconds, float Step = 1.f/60.f) const
        {
            for (float Elapsed = 0.f; Elapsed < Seconds-UE_SMALL_NUMBER; Elapsed += Step)
                Car->Tick(FMath::Min(Step,Seconds-Elapsed));
        }
        void Place(const FVector& Location, float Yaw, float NewSpeed) const
        {
            Car->ResetMotion();
            Input(TEXT("MoveForward"),0.f);
            Input(TEXT("MoveRight"),0.f);
            Car->SetActorLocationAndRotation(FVector(Location.X,Location.Y,100.5),FRotator(0.,Yaw,0.),false,nullptr,ETeleportType::TeleportPhysics);
            Car->Speed = NewSpeed;
        }
        float Yaw() const { return static_cast<float>(Car->GetActorRotation().Yaw); }
    };

    // The longest surveyed street segment on the test floor, far from junctions along its middle: a straight road.
    bool FindStraightRoad(const UWorld* World, FVector& Start, float& Direction)
    {
        const QuebecDistrict::FSettings& District = QuebecDistrict::ForWorld(World);
        double Best = 0.;
        for (int32 I = 0; I < District.RoadCount; ++I)
        {
            const FVector A = District.RoadSegments[I][0], B = District.RoadSegments[I][1];
            const double Length = FVector::Dist2D(A,B);
            if (Length <= Best || FMath::Max(FMath::Abs(A.X),FMath::Abs(B.X)) > 90000. || FMath::Max(FMath::Abs(A.Y),FMath::Abs(B.Y)) > 90000.) continue;
            Best = Length;
            Start = FMath::Lerp(A,B,.3);
            Direction = static_cast<float>((B-A).Rotation().Yaw);
        }
        return Best > 5000.;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecGradedSteeringTest,"Quebec.Driving.GradedSteering",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecGradedSteeringTest::RunTest(const FString& Parameters)
{
    // The phone wheel's graded levels are axis keys; none may collide with another mapping.
    const UInputSettings* Settings = GetDefault<UInputSettings>();
    const FKey GradedKeys[] = {EKeys::NumPadOne, EKeys::NumPadTwo, EKeys::NumPadFour, EKeys::NumPadFive};
    const float GradedScales[] = {-.33f, -.66f, .33f, .66f};
    TArray<FInputAxisKeyMapping> Steering;
    Settings->GetAxisMappingByName(TEXT("MoveRight"),Steering);
    for (int32 Level = 0; Level < 4; ++Level)
    {
        int32 Uses = 0;
        bool bSteers = false;
        for (const FInputAxisKeyMapping& Mapping : Steering)
            if (Mapping.Key == GradedKeys[Level]) { ++Uses; bSteers |= FMath::IsNearlyEqual(Mapping.Scale,GradedScales[Level],.001f); }
        const TCHAR* Axes[] = {TEXT("MoveForward"), TEXT("Turn"), TEXT("LookUp")};
        for (const TCHAR* Axis : Axes)
        {
            TArray<FInputAxisKeyMapping> Others;
            Settings->GetAxisMappingByName(Axis,Others);
            for (const FInputAxisKeyMapping& Mapping : Others) Uses += Mapping.Key == GradedKeys[Level] ? 1 : 0;
        }
        const TCHAR* Actions[] = {TEXT("Jump"), TEXT("Sprint"), TEXT("Interact"), TEXT("Handbrake"), TEXT("ComicStyle"), TEXT("NextCharacter"),
            TEXT("RetryCampaign"), TEXT("ReplayCampaign"), TEXT("Fire"), TEXT("Aim"), TEXT("NextWeapon")};
        for (const TCHAR* Action : Actions)
        {
            TArray<FInputActionKeyMapping> Others;
            Settings->GetActionMappingByName(Action,Others);
            for (const FInputActionKeyMapping& Mapping : Others) Uses += Mapping.Key == GradedKeys[Level] ? 1 : 0;
        }
        TestTrue(FString::Printf(TEXT("%s steers by %.2f and has no other mapping"),*GradedKeys[Level].ToString(),GradedScales[Level]),bSteers && Uses == 1);
    }

    FAssistDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    const FFloatProperty* VisualSteering = FindFProperty<FFloatProperty>(AQuebecCar::StaticClass(),TEXT("VisualSteering"));
    if (!TestNotNull(TEXT("Replicated steering readback is available"),VisualSteering)) return false;
    float Turns[3];
    const float Levels[] = {.33f, .66f, 1.f};
    for (int32 Level = 0; Level < 3; ++Level)
    {
        Fixture.Place(FVector::ZeroVector,0.f,900.f);
        Fixture.Input(TEXT("MoveRight"),Levels[Level]);
        Fixture.Advance(.35f);
        Turns[Level] = FMath::Abs(Fixture.Yaw());
        TestTrue(TEXT("A graded level is held as sent, not forced to full lock"),FMath::IsNearlyEqual(VisualSteering->GetPropertyValue_InContainer(Car),Levels[Level],.001f));
    }
    AddInfo(FString::Printf(TEXT("Graded yaw after 0.35s at 900 cm/s: third=%.3f two-thirds=%.3f full=%.3f"),Turns[0],Turns[1],Turns[2]));
    TestTrue(TEXT("A third of the wheel turns proportionally less than full lock"),Turns[0] > 1.f && Turns[0] < Turns[2]*.6f);
    TestTrue(TEXT("Two thirds of the wheel turns between a third and full lock"),Turns[1] > Turns[0]*1.3f && Turns[1] < Turns[2]*.9f);

    // On a street, easing to a smaller level is as quick as a release; off road it keeps today's 3.5/s.
    FVector Road;
    float Street = 0.f;
    if (!TestTrue(TEXT("A long straight surveyed street lies on the test floor"),FindStraightRoad(Fixture.World,Road,Street))) return false;
    Fixture.Place(Road,Street,900.f);
    Fixture.Input(TEXT("MoveRight"),.66f); Fixture.Advance(.3f);
    Fixture.Input(TEXT("MoveRight"),.33f); Fixture.Advance(.05f);
    const float RoadEased = VisualSteering->GetPropertyValue_InContainer(Car);
    Fixture.Place(FVector::ZeroVector,0.f,900.f);
    Fixture.Input(TEXT("MoveRight"),.66f); Fixture.Advance(.3f);
    Fixture.Input(TEXT("MoveRight"),.33f); Fixture.Advance(.05f);
    const float OffRoadEased = VisualSteering->GetPropertyValue_InContainer(Car);
    AddInfo(FString::Printf(TEXT("Easing from two thirds to a third: steering after 50 ms on road=%.3f off road=%.3f"),RoadEased,OffRoadEased));
    TestTrue(TEXT("On a street, easing to a smaller level is as quick as a release"),RoadEased < .341f);
    TestTrue(TEXT("Off road, easing keeps today's turn-in rate"),OffRoadEased > .45f && OffRoadEased < .52f);

    Fixture.Place(FVector::ZeroVector,0.f,0.f);
    struct FDrive { float Throttle; float Steering; bool Handbrake; } RemoteDrive{0.f,-.66f,false};
    Car->ProcessEvent(Car->FindFunctionChecked(TEXT("ServerSetDrive")),&RemoteDrive);
    Fixture.Advance(.3f);
    TestTrue(TEXT("A remote graded level arrives unchanged"),FMath::IsNearlyEqual(VisualSteering->GetPropertyValue_InContainer(Car),-.66f,.001f));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecAutopilotTest,"Quebec.Driving.AutopilotWithoutController",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecAutopilotTest::RunTest(const FString& Parameters)
{
    FAssistDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    AddInfo(FString::Printf(TEXT("Possessed net update frequency=%.1f"),Car->GetNetUpdateFrequency()));
    TestTrue(TEXT("A driven car replicates at 60 Hz"),FMath::IsNearlyEqual(Car->GetNetUpdateFrequency(),60.f));
    Fixture.Driver->UnPossess();
    TestTrue(TEXT("A parked car returns to 30 Hz"),FMath::IsNearlyEqual(Car->GetNetUpdateFrequency(),30.f));
    Car->Occupant = nullptr;
    Fixture.Place(FVector::ZeroVector,0.f,0.f);
    TestNull(TEXT("The AI car has no controller"),Car->GetController());

    Car->bTraffic = true;
    Car->SetActorTickInterval(.05f);
    Car->SetAutopilot(1.f,0.f,false);
    TestTrue(TEXT("Autopilot is engaged"),Car->HasAutopilot());
    TestEqual(TEXT("An AI car ticks every frame"),Car->GetActorTickInterval(),0.f);
    TestFalse(TEXT("An AI car leaves the traffic model"),Car->bTraffic);
    TestNull(TEXT("An AI car has no player driver"),Car->GetDriverController());
    for (float Elapsed = 0.f; Elapsed < 1.5f-UE_SMALL_NUMBER; Elapsed += 1.f/60.f)
    {
        Car->SetAutopilot(1.f,0.f,false);
        Car->Tick(1.f/60.f);
    }
    AddInfo(FString::Printf(TEXT("Autopilot speed after 1.5s=%.3f travel=%s"),Car->Speed,*Car->GetActorLocation().ToString()));
    TestTrue(TEXT("Without a controller the AI keeps driving on the player handling model"),Car->Speed > 1100.f && Car->Speed < 1400.f);
    Car->SetAutopilot(1.f,1.f,false);
    Fixture.Advance(.5f);
    TestTrue(TEXT("The AI steers with the player steering model"),FMath::Abs(Fixture.Yaw()) > 5.f);
    Car->SetAutopilot(std::numeric_limits<float>::quiet_NaN(),0.f,true);
    TestTrue(TEXT("Nonfinite AI input is ignored"),Car->HasAutopilot() && FMath::IsFinite(Car->Speed));
    Car->ClearAutopilot();
    TestEqual(TEXT("A released AI car returns to the tick interval it rested at"),Car->GetActorTickInterval(),.05f);
    Fixture.Advance(2.f);
    TestFalse(TEXT("Autopilot is released"),Car->HasAutopilot());
    TestTrue(TEXT("A released AI car brakes to a stop like any unoccupied car"),Car->Speed == 0.f && Car->LateralSpeed == 0.f);

    Car->SetAutopilot(1.f,0.f,false);
    Car->Occupant = Fixture.Avatar;
    Fixture.Driver->Possess(Car);
    TestFalse(TEXT("A player taking the wheel ends the autopilot"),Car->HasAutopilot());
    TestTrue(TEXT("The player is the driver"),Car->GetDriverController() == Fixture.Driver);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecWreckedCarTest,"Quebec.Driving.WreckedCarCoasts",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecWreckedCarTest::RunTest(const FString& Parameters)
{
    FAssistDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    AQuebecCar* Car = Fixture.Car;
    Car->AddBodyDamage(std::numeric_limits<float>::quiet_NaN(),nullptr);
    Car->AddBodyDamage(-50.f,nullptr);
    TestEqual(TEXT("Invalid damage is ignored"),Car->BodyDamage,0.f);
    Car->AddBodyDamage(40.f,nullptr);
    TestFalse(TEXT("A dented car still drives"),Car->IsWrecked());
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(1.f);
    const float DentedSpeed = Car->Speed;
    TestTrue(TEXT("A dented car accelerates"),DentedSpeed > 500.f);
    Car->AddBodyDamage(80.f,nullptr);
    TestTrue(TEXT("Damage caps at a wreck"),Car->IsWrecked() && Car->BodyDamage == 100.f);

    Fixture.Place(FVector::ZeroVector,0.f,0.f);
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(1.f);
    AddInfo(FString::Printf(TEXT("Wreck with Gas held from rest: speed=%.3f; dented car reached %.3f"),Car->Speed,DentedSpeed));
    TestTrue(TEXT("A wrecked car does not accelerate"),FMath::Abs(Car->Speed) < 1.f);
    Fixture.Place(FVector::ZeroVector,0.f,1500.f);
    Fixture.Input(TEXT("MoveForward"),1.f); Fixture.Advance(1.f);
    AddInfo(FString::Printf(TEXT("Wreck with Gas held from 1500 cm/s for 1s: speed=%.3f"),Car->Speed));
    TestTrue(TEXT("A moving wreck coasts down even with Gas held"),Car->Speed < 1200.f && Car->Speed > 0.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecRoadHeadingAssistTest,"Quebec.Driving.RoadHeadingAssist",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecRoadHeadingAssistTest::RunTest(const FString& Parameters)
{
    FAssistDrivingWorld Fixture;
    if (!TestTrue(TEXT("Possessed authority fixture"),Fixture.Ready())) return false;
    FVector Road;
    float Street = 0.f;
    if (!TestTrue(TEXT("A long straight surveyed street lies on the test floor"),FindStraightRoad(Fixture.World,Road,Street))) return false;

    // Released wheel, 12 degrees off the street: the road lines the car up; off-road nothing changes.
    Fixture.Place(Road,Street+12.f,1200.f);
    Fixture.Advance(1.2f);
    const float RoadError = FMath::FindDeltaAngleDegrees(Street,Fixture.Yaw());
    Fixture.Place(FVector::ZeroVector,12.f,1200.f);
    Fixture.Advance(1.2f);
    const float OffRoadYaw = Fixture.Yaw();
    AddInfo(FString::Printf(TEXT("Released at 12 degrees for 1.2s: on road error=%.3f, off road yaw=%.3f, street at %s heading %.1f"),
        RoadError,OffRoadYaw,*Road.ToString(),Street));
    TestTrue(TEXT("On a street a released wheel straightens the heading"),FMath::Abs(RoadError) < 2.f);
    TestTrue(TEXT("Off road the pinned handling is untouched"),FMath::IsNearlyEqual(OffRoadYaw,12.f,.01f));

    // A deliberate graded turn on the street is obeyed exactly as off road.
    Fixture.Place(Road,Street,900.f);
    Fixture.Input(TEXT("MoveRight"),.33f); Fixture.Advance(.35f);
    const float RoadTurn = FMath::FindDeltaAngleDegrees(Street,Fixture.Yaw());
    Fixture.Place(FVector::ZeroVector,0.f,900.f);
    Fixture.Input(TEXT("MoveRight"),.33f); Fixture.Advance(.35f);
    const float OffRoadTurn = Fixture.Yaw();
    AddInfo(FString::Printf(TEXT("Graded third for 0.35s: on road %.3f, off road %.3f"),RoadTurn,OffRoadTurn));
    TestTrue(TEXT("The assist never fights a turned wheel"),FMath::IsNearlyEqual(RoadTurn,OffRoadTurn,.5f) && RoadTurn > 1.f);

    // After a full-lock correction, the car on the street carries less leftover turn once the key is released.
    Fixture.Place(Road,Street,900.f);
    Fixture.Input(TEXT("MoveRight"),1.f); Fixture.Advance(.3f);
    float Held = Fixture.Yaw();
    Fixture.Input(TEXT("MoveRight"),0.f); Fixture.Advance(.2f);
    const float RoadCarry = FMath::FindDeltaAngleDegrees(Held,Fixture.Yaw());
    Fixture.Place(FVector::ZeroVector,0.f,900.f);
    Fixture.Input(TEXT("MoveRight"),1.f); Fixture.Advance(.3f);
    Held = Fixture.Yaw();
    Fixture.Input(TEXT("MoveRight"),0.f); Fixture.Advance(.2f);
    const float OffRoadCarry = FMath::FindDeltaAngleDegrees(Held,Fixture.Yaw());
    AddInfo(FString::Printf(TEXT("Turn carried 0.2s after releasing full lock: on road %.3f, off road %.3f"),RoadCarry,OffRoadCarry));
    TestTrue(TEXT("Released yaw is damped on a street"),RoadCarry < OffRoadCarry && OffRoadCarry > 0.f);
    return true;
}
#endif
