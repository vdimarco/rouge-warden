// EXPECT: PASS
// MODULES: AIModule NavigationSystem
// Positive control for the helper libraries, optional components and the AI/navigation modules.
#include "AIController.h"
#include "Algo/Sort.h"
#include "Algo/Find.h"
#include "Algo/Count.h"
#include "Algo/AnyOf.h"
#include "Algo/MaxElement.h"
#include "Algo/Transform.h"
#include "Async/Async.h"
#include "Async/ParallelFor.h"
#include "Camera/CameraShakeBase.h"
#include "Components/ArrowComponent.h"
#include "Components/DecalComponent.h"
#include "Components/SplineComponent.h"
#include "Engine/CollisionProfile.h"
#include "Engine/TriggerBox.h"
#include "Engine/World.h"
#include "GameFramework/Character.h"
#include "GameFramework/GameMode.h"
#include "GameFramework/GameState.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "HAL/IConsoleManager.h"
#include "Kismet/KismetMathLibrary.h"
#include "Kismet/KismetSystemLibrary.h"
#include "NavigationSystem.h"
#include "Particles/ParticleSystemComponent.h"
#include "PhysicalMaterials/PhysicalMaterial.h"

static TAutoConsoleVariable<int32> CVarWantedLevel(TEXT("quebec.WantedLevel"), 0, TEXT("Forces a wanted level"), ECVF_Cheat);
static int32 GTrafficDensity = 10;
static FAutoConsoleVariableRef CVarTraffic(TEXT("quebec.Traffic"), GTrafficDensity, TEXT("Cars per block"));
static FAutoConsoleCommandWithWorldAndArgs CmdSpawn(TEXT("quebec.Spawn"), TEXT("Spawns a car"),
    FConsoleCommandWithWorldAndArgsDelegate::CreateLambda([](const TArray<FString>& Args, UWorld* World) { (void)Args.Num(); (void)World; }));

void ExerciseLibraries(UWorld* World, ACharacter* Hero, AActor* Bullet, USplineComponent* Route, float DeltaSeconds)
{
    const FRotator Look = UKismetMathLibrary::FindLookAtRotation(Hero->GetActorLocation(), Bullet->GetActorLocation());
    const FVector Spread = UKismetMathLibrary::RandomUnitVectorInConeInDegrees(Look.Vector(), 3.f);
    const double Mapped = UKismetMathLibrary::MapRangeClamped(Hero->GetVelocity().Size(), 0.0, 1200.0, 0.0, 1.0);
    TArray<AActor*> Ignore;
    Ignore.Add(Hero);
    FHitResult Hit;
    const bool bHit = UKismetSystemLibrary::SphereTraceSingle(Hero, Hero->GetActorLocation(), Hero->GetActorLocation() + Spread * 1000.f, 10.f,
        UEngineTypes::ConvertToTraceType(ECC_Visibility), false, Ignore, EDrawDebugTrace::None, Hit, true);
    TArray<TEnumAsByte<EObjectTypeQuery>> Types;
    Types.Add(UEngineTypes::ConvertToObjectType(ECC_Pawn));
    TArray<AActor*> Nearby;
    UKismetSystemLibrary::SphereOverlapActors(Hero, Hero->GetActorLocation(), 800.f, Types, ACharacter::StaticClass(), Ignore, Nearby);
    if (bHit && Hit.PhysMaterial.IsValid() && UPhysicalMaterial::DetermineSurfaceType(Hit.PhysMaterial.Get()) == SurfaceType1) {}
    UKismetSystemLibrary::PrintString(Hero, FString::Printf(TEXT("%.2f"), Mapped));

    Algo::Sort(Nearby, [Hero](const AActor* A, const AActor* B) { return A->GetDistanceTo(Hero) < B->GetDistanceTo(Hero); });
    Algo::SortBy(Nearby, [](const AActor* A) { return A->GetActorLocation().Z; });
    AActor** Closest = Algo::FindByPredicate(Nearby, [](const AActor* A) { return A->ActorHasTag(TEXT("Cop")); });
    const SIZE_T Cops = Algo::CountIf(Nearby, [](const AActor* A) { return A->ActorHasTag(TEXT("Cop")); });
    const bool bAny = Algo::AnyOf(Nearby, [](const AActor* A) { return A->IsHidden(); });
    AActor** Highest = Algo::MaxElementBy(Nearby, [](const AActor* A) { return A->GetActorLocation().Z; });
    TArray<FVector> Points;
    Algo::Transform(Nearby, Points, [](const AActor* A) { return A->GetActorLocation(); });
    (void)Closest; (void)Cops; (void)bAny; (void)Highest;

    const float Length = Route->GetSplineLength();
    const FVector OnRoute = Route->GetLocationAtDistanceAlongSpline(FMath::Fmod(Length * .5f, Length), ESplineCoordinateSpace::World);
    const FRotator Facing = Route->GetRotationAtDistanceAlongSpline(10.f, ESplineCoordinateSpace::World);
    const float Key = Route->FindInputKeyClosestToWorldLocation(Hero->GetActorLocation());
    (void)OnRoute; (void)Facing; (void)Key;

    if (UNavigationSystemV1* Nav = UNavigationSystemV1::GetCurrent<UNavigationSystemV1>(World))
    {
        FNavLocation Wander;
        if (Nav->GetRandomReachablePointInRadius(Hero->GetActorLocation(), 1500.f, Wander))
        {
            if (AAIController* AI = Cast<AAIController>(Hero->GetController()))
            {
                const EPathFollowingRequestResult::Type Result = AI->MoveToLocation(Wander.Location, 50.f);
                if (Result == EPathFollowingRequestResult::Failed) AI->MoveToActor(Bullet, 100.f);
                AI->SetFocus(Bullet);
                AI->ClearFocus(EAIFocusPriority::Gameplay);
            }
        }
    }

    if (CVarWantedLevel.GetValueOnGameThread() > 0 || GTrafficDensity > 0)
    {
        AsyncTask(ENamedThreads::GameThread, [Hero]() { Hero->Jump(); });
        TFuture<int32> Count = Async(EAsyncExecution::ThreadPool, []() { return 42; });
        (void)Count.Get();
        ParallelFor(Points.Num(), [&Points](int32 Index) { Points[Index].Z += 1.0; });
    }
    if (APlayerController* PC = Cast<APlayerController>(Hero->GetController())) PC->ClientStartCameraShake(UCameraShakeBase::StaticClass(), 1.f);
    if (AGameMode* Mode = World->GetAuthGameMode<AGameMode>()) { if (Mode->GetMatchState() == MatchState::InProgress) Mode->EndMatch(); }
    if (UCollisionProfile::Get()) Hero->GetRootComponent()->ComponentHasTag(UCollisionProfile::Pawn_ProfileName);
}

class AQuebecBullet : public AActor
{
public:
    AQuebecBullet()
    {
        Movement = CreateDefaultSubobject<UProjectileMovementComponent>(TEXT("Movement"));
        Movement->InitialSpeed = 8000.f;
        Movement->MaxSpeed = 8000.f;
        Movement->bRotationFollowsVelocity = true;
        Movement->ProjectileGravityScale = 0.f;
        Arrow = CreateDefaultSubobject<UArrowComponent>(TEXT("Arrow"));
        Trail = CreateDefaultSubobject<UParticleSystemComponent>(TEXT("Trail"));
        Scorch = CreateDefaultSubobject<UDecalComponent>(TEXT("Scorch"));
        Scorch->SetFadeOut(5.f, 2.f, false);
    }
    void Stop(const FHitResult& Hit) { Movement->StopSimulating(Hit); }
private:
    UProjectileMovementComponent* Movement;
    UArrowComponent* Arrow;
    UParticleSystemComponent* Trail;
    UDecalComponent* Scorch;
};
