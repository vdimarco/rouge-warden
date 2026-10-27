#include "QuebecTrioMark.h"
#include "QuebecBanner.h"
#include "QuebecTrio.h"
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

AQuebecTrio::AQuebecTrio()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("TrioRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = CylinderAsset.Object;
}

AQuebecTrio* AQuebecTrio::Find(const UWorld* World)
{
    static TWeakObjectPtr<AQuebecTrio> Cached;
    if (!World) return nullptr;
    if (AQuebecTrio* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecTrio> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

void AQuebecTrio::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecTrio, Step);
}

void AQuebecTrio::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    const FVector Point(QuebecTrio::Stops[0].X, QuebecTrio::Stops[0].Y, 0.);
    SetActorLocation(Point);
    BuildPosts();
    UE_LOG(LogTemp, Display, TEXT("NORD_TRIO ready x=%.0f y=%.0f authority=%d"), Point.X, Point.Y, HasAuthority() ? 1 : 0);
}

UStaticMeshComponent* AQuebecTrio::AddPost(FName Name, const FVector& Point, UMaterialInterface* Paint)
{
    UStaticMeshComponent* Post = NewObject<UStaticMeshComponent>(this, Name);
    AddInstanceComponent(Post);
    Post->SetupAttachment(Scene);
    Post->SetStaticMesh(Cylinder);
    Post->SetRelativeLocation(Point);
    Post->SetRelativeScale3D(FVector(28., 28., 160.) / 100.f);
    Post->SetMobility(EComponentMobility::Movable);
    Post->SetCollisionProfileName(TEXT("NoCollision"));
    Post->SetCastShadow(false);
    if (Paint) Post->SetMaterial(0, Paint);
    Post->RegisterComponent();
    return Post;
}

void AQuebecTrio::AddCaption(FName Name, const FVector& Point, const FString& Words)
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

void AQuebecTrio::BuildPosts()
{
    if (bBuilt || !Cylinder) return;
    bBuilt = true;
    UMaterialInterface* Ink = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Ink.M_Ink"));
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    UMaterialInterface* Lime = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Lime.M_Lime"));
    UMaterialInterface* Paints[QuebecTrio::StopCount] = {Lime, Cream, Ink};
    const TCHAR* Names[QuebecTrio::StopCount] = {TEXT("Porte1"), TEXT("Porte2"), TEXT("Porte3")};
    const TCHAR* Captions[QuebecTrio::StopCount] = {TEXT("PorteName1"), TEXT("PorteName2"), TEXT("PorteName3")};
    const TCHAR* Words[QuebecTrio::StopCount] = {TEXT("1"), TEXT("2"), TEXT("3")};
    const FVector Origin(QuebecTrio::Stops[0].X, QuebecTrio::Stops[0].Y, 0.);
    for (int Index = 0; Index < QuebecTrio::StopCount; ++Index)
    {
        const FVector At(QuebecTrio::Stops[Index].X, QuebecTrio::Stops[Index].Y, 0.);
        const FVector Relative = At - Origin + FVector(0., 0., 80.);
        AddPost(Names[Index], Relative, Paints[Index]);
        AddCaption(Captions[Index], Relative + FVector(0., 0., 120.), Words[Index]);
    }
}

FString AQuebecTrio::WalkLine() const
{
    if (Step <= 0) return FString(UTF8_TO_TCHAR(QuebecBanner::DoorWord1));
    if (Step == 1) return FString(UTF8_TO_TCHAR(QuebecBanner::DoorWord2));
    if (Step == 2) return FString(UTF8_TO_TCHAR(QuebecBanner::DoorWord3));
    return FString();
}

void AQuebecTrio::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    (void)DeltaSeconds;
    if (!HasAuthority() || !GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return;
    if (Step >= QuebecTrio::Done) return;

    QuebecTrio::FProgress Before;
    Before.Step = static_cast<int>(Step);
    Before.Runner = static_cast<int>(Runner);
    AQuebecCharacter* Walker = nullptr;
    QuebecTrio::FProgress Next = Before;
    for (TActorIterator<AQuebecCharacter> It(GetWorld()); It; ++It)
    {
        if (!IsValid(*It) || It->IsInputLocked()) continue;
        AQuebecController* Candidate = Cast<AQuebecController>(It->GetController());
        if (!Candidate || !Candidate->PlayerState) continue;
        const FVector Here = It->GetActorLocation();
        const bool bAt0 = QuebecTrio::Inside(Here.X, Here.Y, QuebecTrio::Stops[0].X, QuebecTrio::Stops[0].Y, QuebecTrio::Reach);
        const bool bAt1 = QuebecTrio::Inside(Here.X, Here.Y, QuebecTrio::Stops[1].X, QuebecTrio::Stops[1].Y, QuebecTrio::Reach);
        const bool bAt2 = QuebecTrio::Inside(Here.X, Here.Y, QuebecTrio::Stops[2].X, QuebecTrio::Stops[2].Y, QuebecTrio::Reach);
        const QuebecTrio::FProgress Moved = QuebecTrio::Advance(Before, static_cast<int>(Candidate->PlayerState->GetPlayerId()), true, bAt0, bAt1, bAt2);
        if (Moved.Step == Before.Step && Moved.Runner == Before.Runner) continue;
        Walker = *It;
        Next = Moved;
        break;
    }
    if (!Walker || (Next.Step == Before.Step && Next.Runner == Before.Runner)) return;

    const int Prize = QuebecTrio::Purse(Before, Next);
    AQuebecController* Player = Cast<AQuebecController>(Walker->GetController());
    AQuebecPlayerState* Stats = Player ? Cast<AQuebecPlayerState>(Player->PlayerState) : nullptr;
    if (Prize > 0 && !Stats) return;

    Step = static_cast<int32>(Next.Step);
    Runner = static_cast<int32>(Next.Runner);
    ForceNetUpdate();
    if (!Player) return;
    if (Next.Step == 1)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_TRIO step=1"));
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::DoorWord1)), FString(UTF8_TO_TCHAR(QuebecBanner::ToDoor2)), 4.f);
    }
    else if (Next.Step == 2)
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_TRIO step=2"));
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::DoorWord2)), FString(UTF8_TO_TCHAR(QuebecBanner::ToDoor3)), 4.f);
    }
    else if (Prize > 0 && Stats)
    {
        Stats->Cash += Prize;
        Stats->Changed();
        UE_LOG(LogTemp, Display, TEXT("NORD_TRIO paid %d cash=%d"), Prize, Stats->Cash);
        QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::DoorWord3)), FString::Printf(TEXT("%d $"), Prize), 4.f);
    }
}
