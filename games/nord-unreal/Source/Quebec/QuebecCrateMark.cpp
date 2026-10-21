#include "QuebecCrateMark.h"
#include "QuebecCrate.h"
#include "QuebecGameplay.h"
#include "QuebecPlayerState.h"
#include "QuebecGTA.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "UObject/ConstructorHelpers.h"

AQuebecCrate::AQuebecCrate()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("CrateRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = CylinderAsset.Object;
}

AQuebecCrate* AQuebecCrate::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecCrate> Cached;
    if (!World) return nullptr;
    if (AQuebecCrate* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecCrate> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecCrate::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecCrate, Step);
}

void AQuebecCrate::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    const FVector Point(QuebecCrate::CurbX, QuebecCrate::CurbY, 0.);
    SetActorLocation(Point);
    BuildPosts();
    UE_LOG(LogTemp, Display, TEXT("NORD_CRATE ready x=%.0f y=%.0f authority=%d"), Point.X, Point.Y, HasAuthority() ? 1 : 0);
}

UStaticMeshComponent* AQuebecCrate::AddPost(FName Name, const FVector& Point, const FVector& Scale, UMaterialInterface* Paint)
{
    UStaticMeshComponent* Post = NewObject<UStaticMeshComponent>(this, Name);
    AddInstanceComponent(Post);
    Post->SetupAttachment(Scene);
    Post->SetStaticMesh(Cylinder);
    Post->SetRelativeLocation(Point);
    Post->SetRelativeScale3D(Scale);
    Post->SetMobility(EComponentMobility::Movable);
    Post->SetCollisionProfileName(TEXT("NoCollision"));
    Post->SetCastShadow(false);
    if (Paint) Post->SetMaterial(0, Paint);
    Post->RegisterComponent();
    return Post;
}

void AQuebecCrate::AddCaption(FName Name, const FVector& Point, const FString& Words)
{
    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this, Name);
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(Point);
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(80.f);
    Caption->SetText(FText::FromString(Words));
    Caption->SetTextRenderColor(FColor(220, 236, 255));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Text.M_Text")))
        Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
}

void AQuebecCrate::BuildPosts()
{
    if (bBuilt || !Cylinder) return;
    bBuilt = true;
    UMaterialInterface* Ink = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Ink.M_Ink"));
    UMaterialInterface* Lime = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Lime.M_Lime"));
    const FVector Origin(QuebecCrate::CurbX, QuebecCrate::CurbY, 0.);
    const FVector Curb = FVector(0., 0., 40.);
    const FVector Park = FVector(QuebecCrate::ParkX, QuebecCrate::ParkY, 0.) - Origin + FVector(0., 0., 80.);
    AddPost(TEXT("Caisse"), Curb, FVector(46., 46., 40.) / 100.f, Lime);
    AddCaption(TEXT("CaisseName"), Curb + FVector(0., 0., 80.), TEXT("CAISSE"));
    AddPost(TEXT("Persillier"), Park, FVector(28., 28., 160.) / 100.f, Ink);
    AddCaption(TEXT("PersillierName"), Park + FVector(0., 0., 120.), TEXT("PERSILLIER"));
}

FString AQuebecCrate::WalkLine() const
{
    if (Step == QuebecCrate::Curb) return TEXT("Caisse on Sherbrooke");
    return FString();
}

FString AQuebecCrate::BikeLine(bool bPortrait) const
{
    if (Step != QuebecCrate::Park) return FString();
    return bPortrait ? FString(TEXT("km/h  /  PERSILLIER")) : FString(TEXT("Pedal the parcel to Persillier"));
}

void AQuebecCrate::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    (void)DeltaSeconds;
    if (!HasAuthority() || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return;
    if (Step >= QuebecCrate::Done) return;

    QuebecCrate::FProgress Before;
    Before.Step = static_cast<int>(Step);
    Before.Runner = static_cast<int>(Runner);
    AQuebecController* Player = nullptr;
    QuebecCrate::FProgress Next = Before;

    if (Step == QuebecCrate::Curb)
    {
        for (TActorIterator<AQuebecCharacter> It(GetWorld()); It; ++It)
        {
            if (!IsValid(*It) || It->IsInputLocked()) continue;
            AQuebecController* Candidate = Cast<AQuebecController>(It->GetController());
            if (!Candidate || !Candidate->PlayerState) continue;
            const FVector Here = It->GetActorLocation();
            const bool bAtCurb = QuebecCrate::Inside(Here.X, Here.Y, QuebecCrate::CurbX, QuebecCrate::CurbY, QuebecCrate::Reach);
            const QuebecCrate::FProgress Moved = QuebecCrate::Advance(Before, static_cast<int>(Candidate->PlayerState->GetPlayerId()), true, false, bAtCurb, false);
            if (Moved.Step == Before.Step) continue;
            Player = Candidate;
            Next = Moved;
            break;
        }
    }
    else
    {
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        {
            if (!IsValid(*It) || !It->IsBike()) continue;
            AQuebecController* Candidate = Cast<AQuebecController>(It->GetController());
            if (!Candidate || !Candidate->PlayerState) continue;
            const FVector Here = It->GetActorLocation();
            const bool bAtPark = QuebecCrate::Inside(Here.X, Here.Y, QuebecCrate::ParkX, QuebecCrate::ParkY, QuebecCrate::Reach);
            const QuebecCrate::FProgress Moved = QuebecCrate::Advance(Before, static_cast<int>(Candidate->PlayerState->GetPlayerId()), false, true, false, bAtPark);
            if (Moved.Step == Before.Step) continue;
            Player = Candidate;
            Next = Moved;
            break;
        }
    }
    if (!Player || Next.Step == Before.Step) return;

    const int Prize = QuebecCrate::Purse(Before, Next);
    AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Player->PlayerState);
    if (Prize > 0 && !Stats) return;

    Step = static_cast<int32>(Next.Step);
    Runner = static_cast<int32>(Next.Runner);
    ForceNetUpdate();
    if (Next.Step == QuebecCrate::Park)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_CRATE carried"));
        QuebecNotice::Show(Player, TEXT("CAISSE"), TEXT("Prends le vélo. Persillier t'attend."), 4.f);
    }
    else if (Prize > 0 && Stats)
    {
        Stats->Cash += Prize;
        Stats->Changed();
        UE_LOG(LogTemp, Display, TEXT("NORD_CRATE paid %d cash=%d"), Prize, Stats->Cash);
        QuebecNotice::Show(Player, TEXT("PERSILLIER"), FString::Printf(TEXT("%d $"), Prize), 4.f);
    }
}
