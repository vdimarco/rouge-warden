#include "QuebecGameplay.h"
#include "QuebecCampaign.h"

#include "Components/SceneComponent.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
#endif

namespace
{
    bool CarApproachingResident(const FVector& Resident, const FVector& Car, const FVector& Velocity)
    {
        if (Velocity.SizeSquared2D() < FMath::Square(900.f) || FMath::Abs(Resident.Z-Car.Z) > 200.f)
            return false;
        const FVector Delta(Resident.X-Car.X, Resident.Y-Car.Y, 0.);
        if (Delta.SizeSquared() > FMath::Square(1200.f)) return false;
        const FVector Travel(Velocity.X,Velocity.Y,0.);
        const double Arrival = FVector::DotProduct(Delta,Travel)/Travel.SizeSquared();
        return Arrival > 0. && Arrival <= 1.2 && (Delta-Travel*Arrival).SizeSquared() <= FMath::Square(260.f);
    }

    bool ClearResidentView(UWorld* World, const AActor* Player, const AQuebecParkResident* Resident)
    {
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(ResidentReaction),false,Player);
        Query.AddIgnoredActor(Resident);
        return !World->LineTraceSingleByChannel(Hit,Player->GetActorLocation()+FVector(0.,0.,80.),
            Resident->GetActorLocation()+FVector(0.,0.,130.),ECC_Visibility,Query);
    }
}

float AQuebecParkResident::RouteTime(float ServerTime) const
{
    // Keep the held seconds after the reaction ends; resuming must not skip ahead on the route.
    return ServerTime+Phase-RouteDelay-FMath::Clamp(ServerTime-ReactionStartedAt,0.f,ReactionUntil-ReactionStartedAt);
}

bool AQuebecParkResident::Acknowledge(AActor* Player, bool bManual)
{
    if (!HasAuthority() || !IsValid(Player) || IsHidden() ||
        AQuebecCharacter::IsCrewTaken(GetWorld(),Style) ||
        FVector::DistSquared(Player->GetActorLocation(),GetActorLocation()) > FMath::Square(1200.f)) return false;
    const float Now = GetWorld()->GetTimeSeconds();
    if (!bManual && Now < NextReactionAt) return false;
    RouteDelay += FMath::Clamp(Now-ReactionStartedAt,0.f,ReactionUntil-ReactionStartedAt);
    ReactionStartedAt = Now;
    ReactionUntil = Now+2.4f;
    ReactionYaw = (Player->GetActorLocation()-GetActorLocation()).Rotation().Yaw;
    NextReactionAt = Now+12.f;
    ForceNetUpdate();
    return true;
}

void AQuebecController::TickResidentGreetings(float DeltaTime)
{
    if (!HasAuthority()) return;
    ResidentGreetingElapsed += DeltaTime;
    if (ResidentGreetingElapsed < .3f) return;
    ResidentGreetingElapsed = 0.f;
    const float Now = GetWorld()->GetTimeSeconds();
    if (Now < NextResidentGreetingAt) return;

    if (AQuebecCar* Car = Cast<AQuebecCar>(GetPawn()))
    {
        if (!Car->Occupant || Car->GetController() != this) return;
        const FVector Velocity = Car->GetActorForwardVector()*Car->Speed+Car->GetActorRightVector()*Car->LateralSpeed;
        AQuebecParkResident* Nearest = nullptr;
        double Best = FMath::Square(1200.f);
        for (TActorIterator<AQuebecParkResident> It(GetWorld()); It; ++It)
        {
            if (It->IsHidden() || AQuebecCharacter::IsCrewTaken(GetWorld(),It->Style)) continue;
            const double Distance = FVector::DistSquared(Car->GetActorLocation(),It->GetActorLocation());
            if (Distance > Best || !CarApproachingResident(It->GetActorLocation(),Car->GetActorLocation(),Velocity) ||
                !ClearResidentView(GetWorld(),Car,*It)) continue;
            Best = Distance;
            Nearest = *It;
        }
        if (Nearest && Nearest->Acknowledge(Car))
        {
            const TCHAR* Warnings[] = {TEXT("Hé! Doucement, y'a du monde ici!"),
                TEXT("Attention! Le parc, c'est pas une piste de course!"),TEXT("Oups! Lève le pied, mon ami!")};
            ClientResidentGreeting(FString(AQuebecParkResident::NameForStyle(Nearest->Style))+TEXT("  /  ")+Warnings[FMath::Clamp(Nearest->Style,0,10)%3]);
            NextResidentGreetingAt = Now+10.f;
        }
        return;
    }

    AQuebecCharacter* Walker = Cast<AQuebecCharacter>(GetPawn());
    if (!Walker || !Walker->GetCharacterMovement()->IsMovingOnGround() || Walker->GetVelocity().SizeSquared2D() > FMath::Square(460.f) ||
        FindInteractableCar()) return;
    for (TActorIterator<AQuebecCampaign> It(GetWorld()); It; ++It)
        if (!It->GetInteractionPrompt(this).IsEmpty()) return;
    if (AQuebecParkResident* Resident = FindInteractableResident(); Resident && Resident->Acknowledge(Walker))
    {
        const TCHAR* Greetings[] = {TEXT("Salut! Ça fait du bien, un tour au parc."),
            TEXT("Allô! Belle journée pour prendre ça relax."),TEXT("Ça va bien? On se croise au chalet tantôt!")};
        ClientResidentGreeting(FString(AQuebecParkResident::NameForStyle(Resident->Style))+TEXT("  /  ")+Greetings[FMath::Clamp(Resident->Style,0,10)%3]);
        NextResidentGreetingAt = Now+30.f;
    }
}

void AQuebecController::ClientResidentGreeting_Implementation(const FString& Message)
{
    const AQuebecHUD* HUD = Cast<AQuebecHUD>(GetHUD());
    if (ResidentCaptionUntil > GetWorld()->GetTimeSeconds() || !HUD || !HUD->CanShowResidentGreeting()) return;
    ClientInteractionMessage_Implementation(Message);
    ResidentCaptionUntil = GetWorld()->GetTimeSeconds()+3.5f;
    PlayFeedback(EQuebecFeedbackCue::Dialogue);
}

#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecResidentApproachTest,"Quebec.Residents.ApproachingCar",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecResidentApproachTest::RunTest(const FString& Parameters)
{
    const FVector Resident(600.,0.,0.), Origin = FVector::ZeroVector;
    TestTrue(TEXT("A fast car travelling toward a nearby resident warns"),CarApproachingResident(Resident,Origin,FVector(900.,0.,0.)));
    TestFalse(TEXT("A parked car cannot warn"),CarApproachingResident(Resident,Origin,Origin));
    TestFalse(TEXT("A slow car cannot warn"),CarApproachingResident(Resident,Origin,FVector(899.,0.,0.)));
    TestFalse(TEXT("A departing car cannot warn"),CarApproachingResident(Resident,Origin,FVector(-900.,0.,0.)));
    TestFalse(TEXT("A car passing safely to the side cannot warn"),CarApproachingResident(FVector(600.,261.,0.),Origin,FVector(900.,0.,0.)));
    TestTrue(TEXT("The near-path boundary warns"),CarApproachingResident(FVector(600.,260.,0.),Origin,FVector(900.,0.,0.)));
    TestFalse(TEXT("A car on another height cannot warn"),CarApproachingResident(FVector(600.,0.,201.),Origin,FVector(900.,0.,0.)));
    TestFalse(TEXT("A distant car cannot warn"),CarApproachingResident(FVector(1201.,0.,0.),Origin,FVector(1800.,0.,0.)));
    TestFalse(TEXT("A car more than 1.2 seconds away cannot warn"),CarApproachingResident(FVector(1100.,0.,0.),Origin,FVector(900.,0.,0.)));
    TestTrue(TEXT("Reverse travel still warns in the actual direction of travel"),CarApproachingResident(-Resident,Origin,FVector(-900.,0.,0.)));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecResidentReactionTest,"Quebec.Residents.ReactionContinuity",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecResidentReactionTest::RunTest(const FString& Parameters)
{
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game,false,NAME_None,nullptr,true,ERHIFeatureLevel::Num,&Initialization);
    if (!TestNotNull(TEXT("Isolated resident world"),World)) return false;
    AQuebecParkResident* Resident = World->SpawnActor<AQuebecParkResident>();
    AActor* Player = World->SpawnActor<AActor>();
    if (!Resident || !Player) { World->DestroyWorld(false); return false; }
    USceneComponent* PlayerRoot = NewObject<USceneComponent>(Player);
    Player->SetRootComponent(PlayerRoot);
    PlayerRoot->RegisterComponent();
    Resident->Phase = 10.f;
    Player->SetActorLocation(FVector(0.,200.,0.));
    TestTrue(TEXT("A nearby player gets an authoritative reaction"),Resident->Acknowledge(Player));
    TestTrue(TEXT("The resident turns toward the player"),FMath::IsNearlyEqual(Resident->ReactionYaw,90.f));
    TestFalse(TEXT("Repeated approaches respect the resident cooldown"),Resident->Acknowledge(Player));
    const float Start = Resident->ReactionStartedAt, End = Resident->ReactionUntil;
    TestEqual(TEXT("The authored route clock holds throughout the reaction"),Resident->RouteTime(Start+1.f),Resident->RouteTime(Start));
    TestEqual(TEXT("The route resumes exactly where it paused"),Resident->RouteTime(End),Resident->RouteTime(Start));
    TestTrue(TEXT("A resumed frame advances only that frame's time"),FMath::IsNearlyEqual(Resident->RouteTime(End+.02f)-Resident->RouteTime(End),.02f,.0001f));
    Resident->ReactionStartedAt = -1.f;
    Resident->ReactionUntil = 1.4f;
    const float DuringHold = Resident->RouteTime(World->GetTimeSeconds());
    TestTrue(TEXT("Explicit E acknowledgement bypasses the ambient cooldown"),Resident->Acknowledge(Player,true));
    TestEqual(TEXT("An overlapping manual hold accumulates only the elapsed held time"),Resident->RouteTime(World->GetTimeSeconds()),DuringHold);
    TestFalse(TEXT("A manual acknowledgement still cools down automatic reactions"),Resident->Acknowledge(Player));
    Resident->NextReactionAt = 0.f;
    Resident->ReactionStartedAt = -5.f;
    Resident->ReactionUntil = -2.6f;
    const float Before = Resident->RouteTime(World->GetTimeSeconds());
    TestTrue(TEXT("A later greeting can react again"),Resident->Acknowledge(Player));
    TestTrue(TEXT("A second reaction preserves the previous held seconds"),FMath::IsNearlyEqual(Resident->RouteTime(World->GetTimeSeconds()),Before));
    Resident->NextReactionAt = 0.f;
    Resident->SetActorHiddenInGame(true);
    TestFalse(TEXT("Hidden residents cannot react"),Resident->Acknowledge(Player));
    Resident->SetActorHiddenInGame(false);
    Player->SetActorLocation(FVector(1201.,0.,0.));
    TestFalse(TEXT("Distant players cannot trigger reactions"),Resident->Acknowledge(Player));
    TestFalse(TEXT("A missing player cannot trigger reactions"),Resident->Acknowledge(nullptr));
    World->DestroyWorld(false);
    return true;
}
#endif
