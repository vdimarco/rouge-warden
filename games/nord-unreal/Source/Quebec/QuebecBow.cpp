#include "QuebecBow.h"
#include "QuebecBowRules.h"
#include "QuebecJobRules.h"
#include "QuebecGameplay.h"
#include "QuebecCampaign.h"
#include "QuebecPlayerState.h"
#include "QuebecSideJobs.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerState.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "UObject/ConstructorHelpers.h"

AQuebecBow::AQuebecBow()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetNetUpdateFrequency(10.f);
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("BowRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = CylinderAsset.Object;
    BowPoint = FVector(QuebecBow::Spot.X, QuebecBow::Spot.Y, QuebecBow::Spot.Z);
}

AQuebecBow* AQuebecBow::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecBow> Cached;
    if (!World) return nullptr;
    if (AQuebecBow* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecBow> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecBow::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld()))
    {
        SetActorTickEnabled(false);
        return;
    }
    BuildStage();
    UpdateSign();
    UE_LOG(LogTemp, Display, TEXT("NORD_BOW ready x=%.0f y=%.0f authority=%d"), BowPoint.X, BowPoint.Y, HasAuthority() ? 1 : 0);
}

void AQuebecBow::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecBow, bHolding);
    DOREPLIFETIME(AQuebecBow, bBowDone);
    DOREPLIFETIME(AQuebecBow, InsideSeconds);
    DOREPLIFETIME(AQuebecBow, OutsideSeconds);
}

bool AQuebecBow::GoonsWon() const
{
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld());
    return Jobs && Jobs->IsCompleted(static_cast<int32>(QuebecJobRules::EJob::Goons));
}

bool AQuebecBow::JobRunning() const
{
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld());
    return Jobs && Jobs->IsActive();
}

bool AQuebecBow::StoryOpen(const AQuebecController* Player) const
{
    if (!GetWorld()) return false;
    for (TActorIterator<AQuebecCampaign> It(GetWorld()); It; ++It)
        if (It->Phase == EQuebecCampaignPhase::RaceRunning || It->IsStoryBeatOpen() || (Player && It->IsAimingLight(Player)))
            return true;
    return false;
}

bool AQuebecBow::IsListed() const
{
    return QuebecBow::Listed(GoonsWon(), JobRunning(), bBowDone);
}

bool AQuebecBow::Near(const APawn* Pawn) const
{
    if (!Cast<AQuebecCharacter>(Pawn)) return false;
    const FVector Here = Pawn->GetActorLocation();
    return FVector::DistSquared2D(Here, BowPoint) <= FMath::Square(QuebecBow::Reach) && FMath::Abs(Here.Z - BowPoint.Z) < 300.;
}

bool AQuebecBow::SomeoneInside() const
{
    if (!GetWorld()) return false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(It->GetPawn());
        if (!Walker) continue;
        const AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(It->PlayerState);
        if (Stats && Stats->IsDown()) continue;
        const FVector Here = Walker->GetActorLocation();
        if (FMath::Abs(Here.Z - BowPoint.Z) < 400. && FVector::Dist2D(Here, BowPoint) <= QuebecBow::HoldRadius) return true;
    }
    return false;
}

void AQuebecBow::Say(const FString& Title, const FString& Detail) const
{
    if (!GetWorld()) return;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) QuebecNotice::Show(*It, Title, Detail, 3.f);
}

UStaticMeshComponent* AQuebecBow::AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size, UMaterialInterface* Paint)
{
    UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(this, Name);
    AddInstanceComponent(Part);
    Part->SetupAttachment(Scene);
    Part->SetStaticMesh(Mesh);
    Part->SetRelativeLocation(Point);
    Part->SetRelativeScale3D(Size / 100.f);
    Part->SetMobility(EComponentMobility::Movable);
    Part->SetCollisionProfileName(TEXT("NoCollision"));
    Part->SetCastShadow(false);
    if (Paint) Part->SetMaterial(0, Paint);
    Part->RegisterComponent();
    Parts.Add(Part);
    return Part;
}

void AQuebecBow::BuildStage()
{
    if (bBuilt) return;
    bBuilt = true;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(BowGround), false, this);
    FHitResult Floor;
    if (GetWorld() && GetWorld()->LineTraceSingleByObjectType(Floor, BowPoint + FVector(0., 0., 300.), BowPoint - FVector(0., 0., 600.),
        FCollisionObjectQueryParams(ECC_WorldStatic), Query))
        BowPoint = Floor.ImpactPoint;
    if (!Cylinder) return;
    UMaterialInterface* Gold = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Gold.M_Gold"));
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    UMaterialInterface* Beam = Cream;
    if (UMaterialInstanceDynamic* Warm = Cream ? UMaterialInstanceDynamic::Create(Cream, this) : nullptr)
    {
        Warm->SetVectorParameterValue(TEXT("Tint"), FLinearColor(1.f, .86f, .35f));
        Beam = Warm;
    }
    const FVector At = BowPoint;
    AddPart(TEXT("BowDisc"), Cylinder, At + FVector(0., 0., 4.), FVector(280., 280., 6.), Gold);
    AddPart(TEXT("BowBeam"), Cylinder, At + FVector(0., 0., 420.), FVector(36., 36., 820.), Beam);
    Caption = NewObject<UTextRenderComponent>(this, TEXT("BowCaption"));
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(At + FVector(0., 0., 280.));
    Caption->SetWorldRotation(FRotator(0.f, -90.f, 0.f));
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(90.f);
    Caption->SetTextRenderColor(FColor(255, 220, 80));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Text.M_Text"))) Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
}

void AQuebecBow::UpdateSign()
{
    const bool bShow = bBowDone || bHolding || IsListed();
    for (const TObjectPtr<UStaticMeshComponent>& Part : Parts)
        if (Part) Part->SetVisibility(bShow);
    if (!Caption) return;
    Caption->SetVisibility(bShow);
    const FString Words = bBowDone ? TEXT("MERCI") : bHolding ? TEXT("RESTE") : TEXT("SALUT");
    if (Words == Shown) return;
    Shown = Words;
    Caption->SetText(FText::FromString(Words));
}

void AQuebecBow::Succeed()
{
    if (bBowDone) return;
    bHolding = false;
    bBowDone = true;
    InsideSeconds = QuebecBow::HoldSeconds;
    OutsideSeconds = 0.f;
    if (const AGameStateBase* Game = GetWorld() ? GetWorld()->GetGameState() : nullptr)
        for (APlayerState* Each : Game->PlayerArray)
            if (AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Each))
            {
                Stats->Cash += QuebecBow::Pay;
                Stats->Changed();
            }
    if (GetWorld())
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) It->PlayFeedback(EQuebecFeedbackCue::Complete);
    Say(TEXT("SALUT"), FString::Printf(TEXT("%d $"), QuebecBow::Pay));
    UE_LOG(LogTemp, Display, TEXT("NORD_BOW done pay=%d"), QuebecBow::Pay);
    ForceNetUpdate();
}

void AQuebecBow::FailHold()
{
    if (!bHolding) return;
    bHolding = false;
    InsideSeconds = 0.f;
    OutsideSeconds = 0.f;
    Say(TEXT("COUPÉ"), TEXT("Tu as quitté la lumière."));
    UE_LOG(LogTemp, Display, TEXT("NORD_BOW dropped"));
    ForceNetUpdate();
}

void AQuebecBow::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    if (HasAuthority() && bHolding && !bBowDone)
    {
        if (JobRunning() || StoryOpen(nullptr)) FailHold();
        else
        {
            const QuebecBow::FHold Next = QuebecBow::Advance(InsideSeconds, OutsideSeconds, SomeoneInside(), DeltaSeconds);
            InsideSeconds = Next.Inside;
            OutsideSeconds = Next.Outside;
            if (Next.bDone) Succeed();
            else if (Next.bDropped) FailHold();
            else ForceNetUpdate();
        }
    }
    UpdateSign();
}

FString AQuebecBow::GetPrompt(const APawn* Pawn) const
{
    if (bHolding)
    {
        if (OutsideSeconds > 0.f) return TEXT("Reviens dans la lumière");
        const int32 Left = FMath::Max(1, FMath::CeilToInt(QuebecBow::HoldSeconds - InsideSeconds));
        return FString::Printf(TEXT("Reste  %d s"), Left);
    }
    if (bBowDone || !Near(Pawn) || !IsListed()) return FString();
    if (StoryOpen(Cast<AQuebecController>(Pawn ? Pawn->GetController() : nullptr)))
        return TEXT("[ E ]  SALUT  /  Pas maintenant");
    return TEXT("[ E ]  SALUT");
}

bool AQuebecBow::HandleInteract(AQuebecController* Player)
{
    if (!HasAuthority() || !Player || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return false;
    if (bHolding || bBowDone) return false;
    const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Player->GetPawn());
    if (!Walker || !Near(Walker)) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(BowInteract), false, Walker);
    Query.AddIgnoredActor(this);
    FHitResult Hit;
    if (GetWorld()->LineTraceSingleByChannel(Hit, Walker->GetActorLocation() + FVector(0., 0., 35.), BowPoint + FVector(0., 0., 100.), ECC_Visibility, Query))
        return false;
    const AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Player->PlayerState);
    if (Stats && Stats->IsDown()) return true;
    const bool bWon = GoonsWon();
    const bool bJob = JobRunning();
    const bool bStory = StoryOpen(Player);
    if (!QuebecBow::CanStart(bWon, bJob, bStory, bBowDone, Stats && Stats->IsDown(), false))
    {
        if (!bWon) return false;
        if (bJob) QuebecNotice::Show(Player, TEXT("MISSION EN COURS"), TEXT("R recommence"), 3.f);
        else if (bStory) QuebecNotice::Show(Player, TEXT("PAS MAINTENANT"), TEXT("Termine d'abord la scène du Curateur."), 3.f);
        return true;
    }
    bHolding = true;
    InsideSeconds = 0.f;
    OutsideSeconds = 0.f;
    Player->PlayFeedback(EQuebecFeedbackCue::Dialogue);
    Say(TEXT("LA SCÈNE"), TEXT("Douze secondes dans la lumière."));
    UE_LOG(LogTemp, Display, TEXT("NORD_BOW start"));
    ForceNetUpdate();
    return true;
}
