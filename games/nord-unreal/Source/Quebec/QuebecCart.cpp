#include "QuebecCart.h"
#include "QuebecBanner.h"
#include "QuebecStandRules.h"
#include "QuebecJobRules.h"
#include "QuebecGameplay.h"
#include "QuebecCombat.h"
#include "QuebecPlayerState.h"
#include "QuebecSideJobs.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

static_assert(QuebecStand::Grant == static_cast<int>(QuebecCombatModel::PickupGrant), "The stall grant drifted from the street kit");
static_assert(QuebecStand::HealthCap == static_cast<int>(AQuebecPlayerState::MaxHealth), "The stall health cap drifted");
static_assert(QuebecStand::ArmorCap == static_cast<int>(AQuebecPlayerState::MaxArmor), "The stall armour cap drifted");

AQuebecCart::AQuebecCart()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("CartRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cube = CubeAsset.Object;
    Cylinder = CylinderAsset.Object;
    CartPoint = FVector(QuebecStand::Spot.X, QuebecStand::Spot.Y, QuebecStand::Spot.Z);
}

AQuebecCart* AQuebecCart::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecCart> Cached;
    if (!World) return nullptr;
    if (AQuebecCart* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecCart> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecCart::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    BuildStall();
    UE_LOG(LogTemp, Display, TEXT("NORD_STAND ready x=%.0f y=%.0f authority=%d"), CartPoint.X, CartPoint.Y, HasAuthority() ? 1 : 0);
}

bool AQuebecCart::Near(const APawn* Pawn) const
{
    if (!Cast<AQuebecCharacter>(Pawn)) return false;
    const FVector Here = Pawn->GetActorLocation();
    return FVector::DistSquared2D(Here, CartPoint) <= FMath::Square(QuebecStand::Reach) && FMath::Abs(Here.Z - CartPoint.Z) < 300.;
}

bool AQuebecCart::EscapeRunning() const
{
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld());
    return Jobs && Jobs->IsActive() && Jobs->JobIndex == static_cast<int32>(QuebecJobRules::EJob::Escape);
}

UStaticMeshComponent* AQuebecCart::AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size, UMaterialInterface* Paint)
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
    return Part;
}

UTextRenderComponent* AQuebecCart::AddCaption(FName Name, const FVector& Point, const FString& Words, float WorldSize)
{
    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this, Name);
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(Point);
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(WorldSize);
    Caption->SetText(FText::FromString(Words));
    Caption->SetTextRenderColor(FColor(255, 236, 210));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Text.M_Text"))) Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
    return Caption;
}

void AQuebecCart::BuildStall()
{
    if (bBuilt) return;
    bBuilt = true;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CartGround), false, this);
    FHitResult Floor;
    if (GetWorld() && GetWorld()->LineTraceSingleByObjectType(Floor, CartPoint + FVector(0., 0., 300.), CartPoint - FVector(0., 0., 600.),
        FCollisionObjectQueryParams(ECC_WorldStatic), Query))
        CartPoint = Floor.ImpactPoint;
    if (!Cube || !Cylinder) return;
    UMaterialInterface* Berry = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Berry.M_Berry"));
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    UMaterialInterface* Ink = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Ink.M_Ink"));
    UMaterialInterface* Canopy = Cream;
    if (UMaterialInstanceDynamic* Warm = Cream ? UMaterialInstanceDynamic::Create(Cream, this) : nullptr)
    {
        Warm->SetVectorParameterValue(TEXT("Tint"), FLinearColor(1.f, .92f, .78f));
        Canopy = Warm;
    }
    const FVector At = CartPoint;
    AddPart(TEXT("CartDisc"), Cylinder, At + FVector(0., 0., 4.), FVector(220., 220., 6.), Canopy);
    AddPart(TEXT("CartCounter"), Cube, At + FVector(0., 0., 48.), FVector(170., 78., 90.), Berry);
    AddPart(TEXT("CartCanopy"), Cube, At + FVector(0., 0., 210.), FVector(190., 96., 10.), Canopy);
    AddPart(TEXT("CartPoleL"), Cube, At + FVector(-70., -30., 130.), FVector(8., 8., 160.), Ink);
    AddPart(TEXT("CartPoleR"), Cube, At + FVector(70., -30., 130.), FVector(8., 8., 160.), Ink);
    AddCaption(TEXT("CartName"), At + FVector(0., 0., 260.), TEXT("LISE"), 120.f);
    AddCaption(TEXT("CartSign"), At + FVector(0., 0., 180.), FString(UTF8_TO_TCHAR(QuebecBanner::Snack)), 28.f);
}

FString AQuebecCart::GetPrompt(const APawn* Pawn) const
{
    if (!Near(Pawn)) return FString();
    const AQuebecPlayerState* Stats = Pawn->GetPlayerState<AQuebecPlayerState>();
    if (!Stats || Stats->IsDown()) return FString();
    const bool bEscape = EscapeRunning();
    const QuebecStand::EGood Wanted = QuebecStand::GoodFor(static_cast<double>(Stats->Health), static_cast<double>(Stats->Armor),
        Stats->Stars, bEscape, false, false);
    if (Wanted == QuebecStand::EGood::None)
    {
        if (bEscape && Stats->Stars > 0) return FString::Printf(TEXT("[ E ]  %s  /  %s"), UTF8_TO_TCHAR(QuebecBanner::Snack), UTF8_TO_TCHAR(QuebecBanner::SnackBusy));
        return FString::Printf(TEXT("[ E ]  %s  /  %s"), UTF8_TO_TCHAR(QuebecBanner::Snack), UTF8_TO_TCHAR(QuebecBanner::SnackFine));
    }
    const int32 Price = QuebecStand::PriceOf(Wanted);
    const FString Name = Wanted == QuebecStand::EGood::Health ? FString(UTF8_TO_TCHAR(QuebecBanner::Kit))
        : Wanted == QuebecStand::EGood::Armor ? FString(UTF8_TO_TCHAR(QuebecBanner::VestShort)) : FString(UTF8_TO_TCHAR(QuebecBanner::OneStar));
    if (Stats->Cash < Price) return FString::Printf(TEXT("[ E ]  %d $  %s  /  %s"), Price, *Name, UTF8_TO_TCHAR(QuebecBanner::NotEnough));
    return FString::Printf(TEXT("[ E ]  %d $  %s"), Price, *Name);
}

bool AQuebecCart::HandleInteract(AQuebecController* Player)
{
    if (!HasAuthority() || !Player || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return false;
    const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Player->GetPawn());
    if (!Walker || !Near(Walker)) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CartInteract), false, Walker);
    Query.AddIgnoredActor(this);
    FHitResult Hit;
    if (GetWorld()->LineTraceSingleByChannel(Hit, Walker->GetActorLocation() + FVector(0., 0., 35.), CartPoint + FVector(0., 0., 100.), ECC_Visibility, Query))
        return false;
    AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Player->PlayerState);
    if (!Stats || Stats->IsDown()) return true;
    const bool bEscape = EscapeRunning();
    const double Health = static_cast<double>(Stats->Health);
    const double Armor = static_cast<double>(Stats->Armor);
    const QuebecStand::EGood Wanted = QuebecStand::GoodFor(Health, Armor, Stats->Stars, bEscape, false, false);
    const QuebecStand::FSale Sale = QuebecStand::Sell(Stats->Cash, Health, Armor, Stats->Stars, bEscape, false, false);
    if (Sale.Bought == QuebecStand::EGood::None)
    {
        if (Wanted == QuebecStand::EGood::None)
        {
            if (bEscape && Stats->Stars > 0) QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::NotNow)), FString(UTF8_TO_TCHAR(QuebecBanner::StarsFirst)), 3.f);
            else QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::YouAreFine)), FString(UTF8_TO_TCHAR(QuebecBanner::NothingToSell)), 3.f);
        }
        else QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::NotEnough)), FString::Printf(TEXT("You need %d $."), QuebecStand::PriceOf(Wanted)), 3.f);
        return true;
    }
    const int32 BeforeCash = Stats->Cash;
    Stats->Cash = Sale.Cash;
    bool bPaid = false;
    if (Sale.Bought == QuebecStand::EGood::Health) bPaid = QuebecCombat::GrantPickup(Stats, QuebecCombatModel::EPickupKind::Health);
    else if (Sale.Bought == QuebecStand::EGood::Armor) bPaid = QuebecCombat::GrantPickup(Stats, QuebecCombatModel::EPickupKind::Armor);
    else
    {
        const int32 BeforeStars = Stats->Stars;
        QuebecCrime::SetStars(Player, BeforeStars - 1);
        bPaid = QuebecCrime::Stars(Player) == BeforeStars - 1;
        if (bPaid) Stats->Changed();
    }
    if (!bPaid)
    {
        Stats->Cash = BeforeCash;
        Stats->Changed();
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::YouAreFine)), FString(UTF8_TO_TCHAR(QuebecBanner::NothingToSell)), 3.f);
        return true;
    }
    const FString Title = Sale.Bought == QuebecStand::EGood::Health ? FString(UTF8_TO_TCHAR(QuebecBanner::KitTitle))
        : Sale.Bought == QuebecStand::EGood::Armor ? FString(UTF8_TO_TCHAR(QuebecBanner::Vest)) : FString(UTF8_TO_TCHAR(QuebecBanner::Calmer));
    Player->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
    QuebecNotice::Show(Player, Title, FString::Printf(TEXT("%d $"), QuebecStand::PriceOf(Sale.Bought)), 3.f);
    UE_LOG(LogTemp, Display, TEXT("NORD_STAND buy good=%d price=%d cash=%d"), static_cast<int32>(Sale.Bought), QuebecStand::PriceOf(Sale.Bought), Stats->Cash);
    return true;
}
