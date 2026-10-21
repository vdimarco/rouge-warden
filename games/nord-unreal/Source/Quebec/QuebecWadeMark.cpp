#include "QuebecWadeMark.h"
#include "QuebecWade.h"
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

AQuebecWade::AQuebecWade()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("WadeRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = CylinderAsset.Object;
}

void AQuebecWade::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecWade, Leg);
}

void AQuebecWade::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    const FVector Point(QuebecWade::BuoyX, QuebecWade::BuoyY, 0.);
    SetActorLocation(Point);
    BuildMarks();
    UE_LOG(LogTemp, Display, TEXT("NORD_WADE ready x=%.0f y=%.0f authority=%d"), Point.X, Point.Y, HasAuthority() ? 1 : 0);
}

UStaticMeshComponent* AQuebecWade::AddPost(FName Name, const FVector& Point, const FVector& Size, UMaterialInterface* Paint)
{
    UStaticMeshComponent* Post = NewObject<UStaticMeshComponent>(this, Name);
    AddInstanceComponent(Post);
    Post->SetupAttachment(Scene);
    Post->SetStaticMesh(Cylinder);
    Post->SetRelativeLocation(Point);
    Post->SetRelativeScale3D(Size / 100.f);
    Post->SetMobility(EComponentMobility::Movable);
    Post->SetCollisionProfileName(TEXT("NoCollision"));
    Post->SetCastShadow(false);
    if (Paint) Post->SetMaterial(0, Paint);
    Post->RegisterComponent();
    return Post;
}

UTextRenderComponent* AQuebecWade::AddCaption(FName Name, const FVector& Point, const FString& Words)
{
    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this, Name);
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(Point);
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(90.f);
    Caption->SetText(FText::FromString(Words));
    Caption->SetTextRenderColor(FColor(220, 236, 255));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Text.M_Text")))
        Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
    return Caption;
}

void AQuebecWade::BuildMarks()
{
    if (bBuilt || !Cylinder) return;
    bBuilt = true;
    UMaterialInterface* Ink = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Ink.M_Ink"));
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    UMaterialInterface* Lime = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Lime.M_Lime"));
    const FVector Bank(QuebecWade::BankX - QuebecWade::BuoyX, QuebecWade::BankY - QuebecWade::BuoyY, 0.);
    AddPost(TEXT("WadeFloat"), FVector(0., 0., 120.), FVector(35., 35., 240.), Cream);
    AddPost(TEXT("WadeRing"), FVector(0., 0., 28.), FVector(160., 160., 18.), Ink);
    AddCaption(TEXT("WadeName"), FVector(0., 0., 280.), TEXT("BAIN"));
    AddPost(TEXT("WadeBank"), Bank + FVector(0., 0., 80.), FVector(28., 28., 160.), Lime);
    AddCaption(TEXT("WadeShore"), Bank + FVector(0., 0., 200.), TEXT("RIVE"));
}

void AQuebecWade::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    (void)DeltaSeconds;
    if (!HasAuthority() || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return;
    if (Leg == static_cast<int32>(QuebecWade::ELeg::Done)) return;

    AQuebecCharacter* Walker = nullptr;
    QuebecWade::FProgress Before;
    Before.Leg = static_cast<QuebecWade::ELeg>(Leg);
    Before.Swimmer = static_cast<int>(Swimmer);
    QuebecWade::FProgress Next = Before;
    for (TActorIterator<AQuebecCharacter> It(GetWorld()); It; ++It)
    {
        if (!IsValid(*It) || It->IsInputLocked()) continue;
        AQuebecController* Candidate = Cast<AQuebecController>(It->GetController());
        if (!Candidate || !Candidate->PlayerState) continue;
        const FVector Here = It->GetActorLocation();
        const bool bBuoy = QuebecWade::Inside(Here.X, Here.Y, QuebecWade::BuoyX, QuebecWade::BuoyY, QuebecWade::Reach);
        const bool bBank = QuebecWade::Inside(Here.X, Here.Y, QuebecWade::BankX, QuebecWade::BankY, QuebecWade::Reach);
        const QuebecWade::FProgress Moved = QuebecWade::Advance(Before, static_cast<int>(Candidate->PlayerState->GetPlayerId()), true, bBuoy, bBank);
        if (Moved.Leg == Before.Leg && Moved.Swimmer == Before.Swimmer) continue;
        Walker = *It;
        Next = Moved;
        break;
    }
    if (!Walker || (Next.Leg == Before.Leg && Next.Swimmer == Before.Swimmer)) return;

    const int Prize = QuebecWade::Purse(Before, Next);
    AQuebecController* Player = Cast<AQuebecController>(Walker->GetController());
    AQuebecPlayerState* Stats = Player ? Cast<AQuebecPlayerState>(Player->PlayerState) : nullptr;
    if (Prize > 0 && !Stats) return;

    Leg = static_cast<int32>(Next.Leg);
    Swimmer = static_cast<int32>(Next.Swimmer);
    ForceNetUpdate();
    if (Next.Leg == QuebecWade::ELeg::Buoy && Player)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_WADE buoy"));
        QuebecNotice::Show(Player, TEXT("BAIN"), TEXT("Reviens sur la rive."), 4.f);
    }
    if (Prize > 0 && Stats)
    {
        Stats->Cash += Prize;
        Stats->Changed();
        UE_LOG(LogTemp, Display, TEXT("NORD_WADE paid %d cash=%d"), Prize, Stats->Cash);
        QuebecNotice::Show(Player, TEXT("BAIN"), FString::Printf(TEXT("%d $"), Prize), 4.f);
    }
}
