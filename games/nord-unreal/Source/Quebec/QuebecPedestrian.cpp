#include "QuebecPedestrian.h"

#include "Animation/AnimSequence.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"
#include "Net/UnrealNetwork.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
#endif

AQuebecPedestrian::AQuebecPedestrian()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetReplicateMovement(true);
    SetNetUpdateFrequency(30.f);
    ResidentMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("ResidentMesh"));
    SetRootComponent(ResidentMesh);
    ResidentMesh->SetMobility(EComponentMobility::Movable);
    ResidentMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    ResidentMesh->SetCanEverAffectNavigation(false);
    ResidentMesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::OnlyTickPoseWhenRendered;
}

void AQuebecPedestrian::PostRegisterAllComponents()
{
    Super::PostRegisterAllComponents();
#if WITH_EDITOR
    if (GetWorld() && !GetWorld()->IsGameWorld())
    {
        ResidentMesh->SetUpdateAnimationInEditor(true);
    }
#endif
}

void AQuebecPedestrian::BeginPlay()
{
    Super::BeginPlay();
    PauseRemaining = FMath::Max(0.f, StartDelay);
    OnRep_Walking();
    if (!HasAuthority())
    {
        SetActorTickEnabled(false);
    }
}

FVector AQuebecPedestrian::StepTowards(const FVector& Position, const FVector& Target, float Speed, float DeltaSeconds)
{
    const FVector Delta = Target - Position;
    const float Distance = Delta.Size();
    return Position + Delta.GetSafeNormal() * FMath::Min(Distance, FMath::Max(0.f, Speed * DeltaSeconds));
}

void AQuebecPedestrian::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    // People: a knockdown or a flight replaces the patrol until it ends (QuebecPeople.cpp).
    if (TickStreetLife(DeltaSeconds)) return;
    if (!HasAuthority() || PatrolPoints.Num() < 2 || !IdleAnimation || !WalkAnimation)
    {
        return;
    }
    if (PauseRemaining > 0.f)
    {
        PauseRemaining = FMath::Max(0.f, PauseRemaining - DeltaSeconds);
        SetWalking(false);
        return;
    }
    const FVector Position = GetActorLocation();
    const FVector Target = PatrolPoints[TargetIndex];
    const FVector Next = StepTowards(Position, Target, WalkSpeed, DeltaSeconds);
    // Residents yield to players, vehicles and newly placed obstacles. Their own mesh
    // never blocks the playable character or the car.
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(PlateauResident), false, this);
    const FVector Height(0., 0., 88.);
    if (GetWorld()->SweepSingleByChannel(Hit, Position + Height, Next + Height,
        FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(27.f, 80.f), Query))
    {
        PauseRemaining = 1.5f;
        SetWalking(false);
        return;
    }
    SetWalking(true);
    const FVector Heading = Target - Position;
    if (!Heading.IsNearlyZero())
    {
        SetActorRotation(FRotator(0.f, Heading.Rotation().Yaw, 0.f));
    }
    SetActorLocation(Next);
    if (Next.Equals(Target, .5f))
    {
        if (TargetIndex == PatrolPoints.Num() - 1) Direction = -1;
        else if (TargetIndex == 0) Direction = 1;
        TargetIndex += Direction;
        PauseRemaining = FMath::Max(0.f, PauseDuration);
        SetWalking(false);
    }
}

void AQuebecPedestrian::SetWalking(bool bNewWalking)
{
    if (bWalking != bNewWalking)
    {
        bWalking = bNewWalking;
        OnRep_Walking();
        ForceNetUpdate();
    }
}

void AQuebecPedestrian::OnRep_Walking()
{
    UAnimSequence* Animation = bWalking ? WalkAnimation : IdleAnimation;
    if (Animation)
    {
        ResidentMesh->PlayAnimation(Animation, true);
        // People: a fleeing pedestrian runs on a fast walk cycle.
        ResidentMesh->SetPlayRate(bWalking && bFleeing ? 2.4f : 1.f);
    }
}

void AQuebecPedestrian::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecPedestrian, bWalking);
    DOREPLIFETIME(AQuebecPedestrian, KnockStartedAt);
    DOREPLIFETIME(AQuebecPedestrian, KnockOrigin);
    DOREPLIFETIME(AQuebecPedestrian, KnockPush);
    DOREPLIFETIME(AQuebecPedestrian, KnockLieSeconds);
    DOREPLIFETIME(AQuebecPedestrian, KnockGround);
    DOREPLIFETIME(AQuebecPedestrian, bFleeing);
}

#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecPedestrianMovementTest, "Quebec.Residents.Movement", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecPedestrianMovementTest::RunTest(const FString& Parameters)
{
    const FVector Start(36500., -4400., 18.);
    const FVector End(36500., -4900., 18.);
    TestEqual(TEXT("A resident advances at the authored walking speed"), AQuebecPedestrian::StepTowards(Start, End, 90.f, .5f), Start + FVector(0., -45., 0.));
    TestEqual(TEXT("A long frame cannot overshoot a path endpoint"), AQuebecPedestrian::StepTowards(Start, End, 90.f, 20.f), End);
    TestEqual(TEXT("An endpoint is stable"), AQuebecPedestrian::StepTowards(End, End, 90.f, 1.f), End);
    TestEqual(TEXT("Negative delta time cannot move backwards"), AQuebecPedestrian::StepTowards(Start, End, 90.f, -1.f), Start);
    return true;
}
#endif
