// EXPECT: PASS
#include "OkActor.h"
#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DamageEvents.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "TimerManager.h"

AOkActor::AOkActor()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    Box = CreateDefaultSubobject<UBoxComponent>(TEXT("Box"));
    SetRootComponent(Box);
    Box->SetBoxExtent(FVector(50.f));
    Box->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
    Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
    Mesh->SetupAttachment(Box);
}

void AOkActor::BeginPlay()
{
    Super::BeginPlay();
    Box->OnComponentBeginOverlap.AddDynamic(this, &AOkActor::OnBoxOverlap);
    GetWorldTimerManager().SetTimer(ExpireTimer, this, &AOkActor::Expire, 5.f, false);
}

void AOkActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const FVector Start = GetActorLocation();
    const FVector End = Start + GetActorForwardVector() * Speed * DeltaSeconds;
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(OkActorTrace), false, this);
    if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
    {
        UE_LOG(LogTemp, Verbose, TEXT("%s hit %s at %.1f"), *GetName(), *GetNameSafe(Hit.GetActor()), Hit.Distance);
    }
    SetActorLocation(End, true);
    for (TActorIterator<APawn> It(GetWorld()); It; ++It)
    {
        const float Distance = FVector::Dist(It->GetActorLocation(), End);
        if (Distance < 100.f) UGameplayStatics::ApplyDamage(*It, 1.f, nullptr, this, nullptr);
    }
}

void AOkActor::OnBoxOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult)
{
    if (APawn* Pawn = Cast<APawn>(OtherActor)) { Ammo += Pawn->IsLocallyControlled() ? 1 : 0; }
}

float AOkActor::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
    const float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
    Health = FMath::Max(0.f, Health - Applied);
    return Applied;
}

void AOkActor::ServerFire_Implementation(FVector_NetQuantize Target) { Ammo = FMath::Max(Ammo - 1, 0); }
void AOkActor::OnRep_Health() {}
void AOkActor::Expire() { Destroy(); }

void AOkActor::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AOkActor, Health);
    DOREPLIFETIME_CONDITION(AOkActor, Ammo, COND_OwnerOnly);
}
