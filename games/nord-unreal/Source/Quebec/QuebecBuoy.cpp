#include "QuebecBuoy.h"
#include "QuebecBanner.h"
#include "QuebecLap.h"
#include "QuebecRide.h"
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

AQuebecBuoy::AQuebecBuoy()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("BuoyRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = CylinderAsset.Object;
}

AQuebecBuoy* AQuebecBuoy::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecBuoy> Cached;
    if (!World) return nullptr;
    if (AQuebecBuoy* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecBuoy> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecBuoy::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecBuoy, Leg);
}

void AQuebecBuoy::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    const FVector Point(QuebecLap::BuoyX, QuebecLap::BuoyY, 0.);
    SetActorLocation(Point);
    BuildBuoy();
    UE_LOG(LogTemp, Display, TEXT("NORD_LAP ready x=%.0f y=%.0f authority=%d"), Point.X, Point.Y, HasAuthority() ? 1 : 0);
}

void AQuebecBuoy::BuildBuoy()
{
    if (bBuilt || !Cylinder) return;
    bBuilt = true;
    UStaticMeshComponent* Post = NewObject<UStaticMeshComponent>(this, TEXT("BuoyPost"));
    AddInstanceComponent(Post);
    Post->SetupAttachment(Scene);
    Post->SetStaticMesh(Cylinder);
    Post->SetRelativeLocation(FVector(0., 0., 120.));
    Post->SetRelativeScale3D(FVector(0.35, 0.35, 2.4));
    Post->SetMobility(EComponentMobility::Movable);
    Post->SetCollisionProfileName(TEXT("NoCollision"));
    Post->SetCastShadow(false);
    if (UMaterialInterface* Lime = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Lime.M_Lime")))
        Post->SetMaterial(0, Lime);
    Post->RegisterComponent();

    UStaticMeshComponent* Ring = NewObject<UStaticMeshComponent>(this, TEXT("BuoyRing"));
    AddInstanceComponent(Ring);
    Ring->SetupAttachment(Scene);
    Ring->SetStaticMesh(Cylinder);
    Ring->SetRelativeLocation(FVector(0., 0., 28.));
    Ring->SetRelativeScale3D(FVector(1.6, 1.6, 0.18));
    Ring->SetMobility(EComponentMobility::Movable);
    Ring->SetCollisionProfileName(TEXT("NoCollision"));
    Ring->SetCastShadow(false);
    if (UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream")))
        Ring->SetMaterial(0, Cream);
    Ring->RegisterComponent();

    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this, TEXT("BuoyName"));
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(FVector(0., 0., 280.));
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(90.f);
    Caption->SetText(FText::FromString(FString(UTF8_TO_TCHAR(QuebecBanner::Buoy))));
    Caption->SetTextRenderColor(FColor(220, 236, 255));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Text.M_Text")))
        Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
}

FString AQuebecBuoy::DriveLine(bool bPortrait) const
{
    if (Leg == static_cast<int32>(QuebecLap::ELeg::Buoy))
        return bPortrait ? FString(TEXT("km/h  /  PONT")) : FString(TEXT("Paddle back to the bridge"));
    if (Leg == static_cast<int32>(QuebecLap::ELeg::Dock))
        return bPortrait ? FString(TEXT("km/h  /  BUOY")) : FString(TEXT("Hold gas to paddle to the buoy"));
    return bPortrait ? FString(TEXT("km/h  /  PEDALO")) : FString(TEXT("Hold gas to paddle"));
}

void AQuebecBuoy::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    (void)DeltaSeconds;
    if (!HasAuthority() || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return;
    if (Leg == static_cast<int32>(QuebecLap::ELeg::Done)) return;

    AQuebecCar* Boat = nullptr;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        if (IsValid(*It) && It->IsPedalo()) { Boat = *It; break; }
    }
    if (!Boat) return;

    const FVector Here = Boat->GetActorLocation();
    const bool bAtBuoy = QuebecLap::Inside(Here.X, Here.Y, QuebecLap::BuoyX, QuebecLap::BuoyY, QuebecLap::Reach);
    const bool bAtBerth = QuebecLap::Inside(Here.X, Here.Y, QuebecRide::BerthX, QuebecRide::BerthY, QuebecLap::Reach);
    const QuebecLap::ELeg Before = static_cast<QuebecLap::ELeg>(Leg);
    const QuebecLap::ELeg Next = QuebecLap::Step(Before, true, bAtBuoy, bAtBerth);
    if (Next == Before) return;

    const int Prize = QuebecLap::Purse(Before, Next);
    AQuebecController* Player = Cast<AQuebecController>(Boat->GetController());
    AQuebecPlayerState* Stats = Player ? Cast<AQuebecPlayerState>(Player->PlayerState) : nullptr;
    if (Prize > 0 && !Stats) return;

    Leg = static_cast<int32>(Next);
    ForceNetUpdate();
    if (Next == QuebecLap::ELeg::Buoy)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_LAP buoy"));
        if (Player) QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::Buoy)), FString(UTF8_TO_TCHAR(QuebecBanner::BackToBridge)), 4.f);
    }
    if (Prize > 0 && Stats)
    {
        Stats->Cash += Prize;
        Stats->Changed();
        UE_LOG(LogTemp, Display, TEXT("NORD_LAP paid %d cash=%d"), Prize, Stats->Cash);
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::Lap)), FString::Printf(TEXT("%d $"), Prize), 4.f);
    }
}
