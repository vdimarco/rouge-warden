#include "QuebecRingMark.h"
#include "QuebecBanner.h"
#include "QuebecRing.h"
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

static_assert(QuebecRing::Done == 3, "IsOpen() follows Done");

AQuebecRing::AQuebecRing()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("RingRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = CylinderAsset.Object;
}

AQuebecRing* AQuebecRing::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecRing> Cached;
    if (!World) return nullptr;
    if (AQuebecRing* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecRing> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecRing::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecRing, Leg);
}

void AQuebecRing::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    const FVector Point(QuebecRing::GateAX, QuebecRing::GateAY, 0.);
    SetActorLocation(Point);
    BuildMarks();
    UE_LOG(LogTemp, Display, TEXT("NORD_RING ready x=%.0f y=%.0f authority=%d"), Point.X, Point.Y, HasAuthority() ? 1 : 0);
}

UStaticMeshComponent* AQuebecRing::AddPost(FName Name, const FVector& Point, const FVector& Scale, UMaterialInterface* Paint)
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

void AQuebecRing::AddCaption(FName Name, const FVector& Point, const FString& Words)
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

void AQuebecRing::BuildMarks()
{
    if (bBuilt || !Cylinder) return;
    bBuilt = true;
    UMaterialInterface* Ink = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Ink.M_Ink"));
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    UMaterialInterface* Lime = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Lime.M_Lime"));
    const FVector Origin(QuebecRing::GateAX, QuebecRing::GateAY, 0.);
    const FVector Lawn = FVector(QuebecRing::GateAX, QuebecRing::GateAY, 0.) - Origin + FVector(0., 0., 80.);
    const FVector Allee = FVector(QuebecRing::GateBX, QuebecRing::GateBY, 0.) - Origin + FVector(0., 0., 80.);
    const FVector Home = FVector(QuebecRing::StandX, QuebecRing::StandY, 0.) - Origin + FVector(0., 0., 8.);
    const FVector PostScale = FVector(28., 28., 160.) / 100.f;
    AddPost(TEXT("LawnPost"), Lawn, PostScale, Lime);
    AddCaption(TEXT("LawnName"), Lawn + FVector(0., 0., 120.), FString(UTF8_TO_TCHAR(QuebecBanner::Lawn)));
    AddPost(TEXT("AlleePost"), Allee, PostScale, Ink);
    AddCaption(TEXT("AlleeName"), Allee + FVector(0., 0., 120.), FString(UTF8_TO_TCHAR(QuebecBanner::Alley)));
    AddPost(TEXT("StandRing"), Home, FVector(160., 160., 12.) / 100.f, Cream);
    AddCaption(TEXT("StandName"), Home + FVector(0., 0., 70.), FString(UTF8_TO_TCHAR(QuebecBanner::Bike)));
}

FString AQuebecRing::DriveLine(bool bPortrait) const
{
    if (Leg == QuebecRing::Lawn)
        return bPortrait ? FString(TEXT("km/h  /  ALLEY")) : FString(TEXT("Pedal on to the alley"));
    if (Leg == QuebecRing::Allee)
        return bPortrait ? FString(TEXT("km/h  /  STAND")) : FString(TEXT("Pedal back to the stand"));
    if (Leg == QuebecRing::Stand)
        return bPortrait ? FString(TEXT("km/h  /  LAWN")) : FString(TEXT("Hold gas to pedal to the lawn"));
    return bPortrait ? FString(TEXT("km/h  /  BIKE")) : FString(TEXT("Hold gas to pedal"));
}

void AQuebecRing::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    (void)DeltaSeconds;
    if (!HasAuthority() || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return;
    if (Leg >= QuebecRing::Done) return;

    AQuebecCar* Bike = nullptr;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        if (IsValid(*It) && It->IsBike()) { Bike = *It; break; }
    if (!Bike) return;

    AQuebecController* Player = Cast<AQuebecController>(Bike->GetController());
    AQuebecPlayerState* Stats = Player ? Cast<AQuebecPlayerState>(Player->PlayerState) : nullptr;
    const int Who = Stats ? static_cast<int>(Stats->GetPlayerId()) : QuebecRing::Nobody;
    const FVector Here = Bike->GetActorLocation();
    const bool bAtStand = QuebecRing::Inside(Here.X, Here.Y, QuebecRing::StandX, QuebecRing::StandY, QuebecRing::Reach);
    const bool bAtLawn = QuebecRing::Inside(Here.X, Here.Y, QuebecRing::GateAX, QuebecRing::GateAY, QuebecRing::Reach);
    const bool bAtAllee = QuebecRing::Inside(Here.X, Here.Y, QuebecRing::GateBX, QuebecRing::GateBY, QuebecRing::Reach);
    QuebecRing::FProgress Before;
    Before.Leg = static_cast<int>(Leg);
    Before.Rider = static_cast<int>(Rider);
    const QuebecRing::FProgress Next = QuebecRing::Advance(Before, Who, true, bAtStand, bAtLawn, bAtAllee);
    if (Next.Leg == Before.Leg && Next.Rider == Before.Rider) return;

    const int Prize = QuebecRing::Purse(Before, Next);
    if (Prize > 0 && !Stats) return;

    Leg = static_cast<int32>(Next.Leg);
    Rider = static_cast<int32>(Next.Rider);
    ForceNetUpdate();
    if (!Player) return;
    if (Next.Leg == QuebecRing::Lawn)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_RING lawn"));
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::Lawn)), FString(UTF8_TO_TCHAR(QuebecBanner::ToTheAlley)), 4.f);
    }
    else if (Next.Leg == QuebecRing::Allee)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_RING allee"));
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::Alley)), FString(UTF8_TO_TCHAR(QuebecBanner::BackToStand)), 4.f);
    }
    else if (Prize > 0 && Stats)
    {
        Stats->Cash += Prize;
        Stats->Changed();
        UE_LOG(LogTemp, Display, TEXT("NORD_RING paid %d cash=%d"), Prize, Stats->Cash);
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::Lap)), FString::Printf(TEXT("%d $"), Prize), 4.f);
    }
}
