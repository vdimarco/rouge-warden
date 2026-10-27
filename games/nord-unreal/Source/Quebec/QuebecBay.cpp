#include "QuebecBay.h"
#include "QuebecBanner.h"
#include "QuebecBayRules.h"
#include "QuebecJobRules.h"
#include "QuebecGameplay.h"
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

AQuebecBay::AQuebecBay()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("BayRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cube = CubeAsset.Object;
    Cylinder = CylinderAsset.Object;
    BayPoint = FVector(QuebecBay::Spot.X, QuebecBay::Spot.Y, QuebecBay::Spot.Z);
}

AQuebecBay* AQuebecBay::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecBay> Cached;
    if (!World) return nullptr;
    if (AQuebecBay* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecBay> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecBay::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    BuildBay();
    UE_LOG(LogTemp, Display, TEXT("NORD_BAY ready x=%.0f y=%.0f authority=%d"), BayPoint.X, BayPoint.Y, HasAuthority() ? 1 : 0);
}

bool AQuebecBay::Near(const APawn* Pawn) const
{
    if (!Cast<AQuebecCharacter>(Pawn)) return false;
    const FVector Here = Pawn->GetActorLocation();
    return FVector::DistSquared2D(Here, BayPoint) <= FMath::Square(QuebecBay::Reach) && FMath::Abs(Here.Z - BayPoint.Z) < 300.;
}

AQuebecCar* AQuebecBay::NearestHurtCar() const
{
    if (!GetWorld()) return nullptr;
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld());
    const bool bThiefRunning = Jobs && Jobs->IsActive() && Jobs->JobIndex == static_cast<int32>(QuebecJobRules::EJob::Thief);
    static const FName SideJobTarget(TEXT("SideJobTarget"));
    AQuebecCar* Best = nullptr;
    double BestDistance = QuebecBay::CarReach;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        if (!IsValid(*It) || It->bPolice || !(It->BodyDamage > 0.f)) continue;
        if (bThiefRunning && It->Tags.Contains(SideJobTarget)) continue;
        const FVector Here = It->GetActorLocation();
        if (FMath::Abs(Here.Z - BayPoint.Z) > 400.f) continue;
        const double Distance = FVector::Dist2D(Here, BayPoint);
        if (Distance > QuebecBay::CarReach || Distance >= BestDistance) continue;
        BestDistance = Distance;
        Best = *It;
    }
    return Best;
}

UStaticMeshComponent* AQuebecBay::AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size, UMaterialInterface* Paint)
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

UTextRenderComponent* AQuebecBay::AddCaption(FName Name, const FVector& Point, const FString& Words, float WorldSize)
{
    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this, Name);
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(Point);
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(WorldSize);
    Caption->SetText(FText::FromString(Words));
    Caption->SetTextRenderColor(FColor(220, 236, 255));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Text.M_Text"))) Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
    return Caption;
}

void AQuebecBay::BuildBay()
{
    if (bBuilt) return;
    bBuilt = true;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(BayGround), false, this);
    FHitResult Floor;
    if (GetWorld() && GetWorld()->LineTraceSingleByObjectType(Floor, BayPoint + FVector(0., 0., 300.), BayPoint - FVector(0., 0., 600.),
        FCollisionObjectQueryParams(ECC_WorldStatic), Query))
        BayPoint = Floor.ImpactPoint;
    if (!Cube || !Cylinder) return;
    UMaterialInterface* Ink = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Ink.M_Ink"));
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    UMaterialInterface* Lime = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Lime.M_Lime"));
    const FVector At = BayPoint;
    AddPart(TEXT("BayDisc"), Cylinder, At + FVector(0., 0., 4.), FVector(200., 200., 6.), Cream);
    AddPart(TEXT("BayBench"), Cube, At + FVector(0., 0., 42.), FVector(150., 70., 78.), Ink);
    AddPart(TEXT("BaySign"), Cube, At + FVector(0., 0., 160.), FVector(120., 8., 36.), Lime);
    AddCaption(TEXT("BayName"), At + FVector(0., 0., 240.), FString(UTF8_TO_TCHAR(QuebecBanner::Shop)), 90.f);
}

FString AQuebecBay::GetPrompt(const APawn* Pawn) const
{
    if (!Near(Pawn)) return FString();
    const AQuebecPlayerState* Stats = Pawn->GetPlayerState<AQuebecPlayerState>();
    if (!Stats || Stats->IsDown()) return FString();
    const AQuebecCar* Car = NearestHurtCar();
    if (!Car) return FString::Printf(TEXT("[ E ]  %s  /  %s"), UTF8_TO_TCHAR(QuebecBanner::Shop), UTF8_TO_TCHAR(QuebecBanner::NoCar));
    const int32 Price = QuebecBay::PriceFor(static_cast<double>(Car->BodyDamage));
    if (Stats->Cash < Price) return FString::Printf(TEXT("[ E ]  %d $  /  %s"), Price, UTF8_TO_TCHAR(QuebecBanner::NotEnough));
    return FString::Printf(TEXT("[ E ]  %d $  %s"), Price, UTF8_TO_TCHAR(QuebecBanner::Repair));
}

bool AQuebecBay::HandleInteract(AQuebecController* Player)
{
    if (!HasAuthority() || !Player || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return false;
    const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Player->GetPawn());
    if (!Walker || !Near(Walker)) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(BayInteract), false, Walker);
    Query.AddIgnoredActor(this);
    FHitResult Hit;
    if (GetWorld()->LineTraceSingleByChannel(Hit, Walker->GetActorLocation() + FVector(0., 0., 35.), BayPoint + FVector(0., 0., 100.), ECC_Visibility, Query))
        return false;
    AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Player->PlayerState);
    if (!Stats || Stats->IsDown()) return true;
    AQuebecCar* Car = NearestHurtCar();
    const double Damage = Car ? static_cast<double>(Car->BodyDamage) : 0.;
    const bool bPolice = Car && Car->bPolice;
    const QuebecBay::FQuote Bill = QuebecBay::Quote(Stats->Cash, Damage, false, false, Car != nullptr, bPolice);
    if (Bill.Result == QuebecBay::EBill::None)
    {
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::NothingToFix)), FString(UTF8_TO_TCHAR(QuebecBanner::BringACar)), 3.f);
        return true;
    }
    if (Bill.Result == QuebecBay::EBill::Short)
    {
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::NotEnough)), FString::Printf(TEXT("You need %d $."), Bill.Price), 3.f);
        return true;
    }
    Stats->Cash = Bill.Cash;
    Stats->Changed();
    Car->BodyDamage = 0.f;
    Car->ForceNetUpdate();
    Player->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
    QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::Fixed)), FString::Printf(TEXT("%d $"), Bill.Price), 3.f);
    UE_LOG(LogTemp, Display, TEXT("NORD_BAY mend price=%d cash=%d"), Bill.Price, Stats->Cash);
    return true;
}
