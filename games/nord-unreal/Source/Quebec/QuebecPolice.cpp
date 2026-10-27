#include "QuebecPolice.h"
#include "QuebecBanner.h"
#include "QuebecCombat.h"
#include "QuebecGameplay.h"
#include "QuebecHeatModel.h"
#include "QuebecKnockModel.h"
#include "QuebecParkedCars.h" // An officer thrown into a parked car promotes it.
#include "QuebecPlayerState.h"
#include "QuebecPursuitModel.h"

#include "Animation/AnimSequence.h"
#include "Camera/PlayerCameraManager.h"
#include "Components/AudioComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "Sound/SoundWaveProcedural.h"
#include "UObject/ConstructorHelpers.h"

static_assert(QuebecHeat::CrimeCount == static_cast<int32>(EQuebecCrime::DownPolice) + 1, "QuebecHeat::ECrime mirrors EQuebecCrime");
static_assert(static_cast<int32>(QuebecHeat::ECrime::Gunfire) == static_cast<int32>(EQuebecCrime::Gunfire), "QuebecHeat::ECrime mirrors EQuebecCrime");
static_assert(static_cast<int32>(QuebecHeat::ECrime::RamPolice) == static_cast<int32>(EQuebecCrime::RamPolice), "QuebecHeat::ECrime mirrors EQuebecCrime");

namespace
{
    // The garage bay is in the right lane of LaFontaine road segment 255, a 6.2 m residential street on the Plateau
    // grid 154 m south-east of the start and at least 60 m from every campaign, race, job, pickup and respawn anchor.
    const FVector PoliceGarageStart(53227.782, -18966.702, 0.);
    const FVector PoliceGarageEnd(48120.18, -15583.687, 0.);
    const TCHAR* PoliceNavyPath = TEXT("/Game/ParkComic/M_Navy.M_Navy");
    const TCHAR* PoliceInkPath = TEXT("/Game/ParkComic/M_Ink.M_Ink");
    const TCHAR* PoliceTextPath = TEXT("/Game/ParkComic/M_Text.M_Text");

    FVector PoliceGarageDirection() { return (PoliceGarageEnd - PoliceGarageStart).GetSafeNormal2D(); }
    FVector PoliceGarageRight() { return FVector::CrossProduct(FVector::UpVector, PoliceGarageDirection()); }

    QuebecHeat::ECrime PoliceHeatCrime(EQuebecCrime Crime) { return static_cast<QuebecHeat::ECrime>(static_cast<uint8>(Crime)); }
    QuebecHeat::FVec PoliceHeatVec(const FVector& Value) { return {Value.X, Value.Y, Value.Z}; }
    QuebecPursuit::FVec2 PolicePlanar(const FVector& Value) { return {Value.X, Value.Y}; }
    FVector PoliceFromPlanar(const QuebecPursuit::FVec2& Value, double Height = 0.) { return FVector(Value.X, Value.Y, Height); }

    float PoliceServerTime(const UWorld* World)
    {
        if (!World) return 0.f;
        const AGameStateBase* Game = World->GetGameState();
        return static_cast<float>(Game ? Game->GetServerWorldTimeSeconds() : World->GetTimeSeconds());
    }

    FVector PolicePawnVelocity(const APawn* Pawn)
    {
        if (const AQuebecCar* Car = Cast<AQuebecCar>(Pawn)) return Car->PlanarVelocity();
        return Pawn ? Pawn->GetVelocity() : FVector::ZeroVector;
    }

    // Chest height of a player on foot, roof height of a car.
    FVector PoliceWatchPoint(const APawn* Pawn)
    {
        return Pawn->GetActorLocation() + FVector(0., 0., Cast<AQuebecCar>(Pawn) ? 40. : 50.);
    }

    QuebecHeat::FWanted PoliceReadWanted(const AQuebecPlayerState* State)
    {
        QuebecHeat::FWanted Wanted;
        Wanted.Heat = State->Heat;
        Wanted.Stars = State->Stars;
        Wanted.bSearching = State->bSearching;
        Wanted.SearchEndsAt = State->SearchEndsAt;
        return Wanted;
    }

    // Stars and the search go out at once; heat alone rides the 10 Hz update.
    void PoliceWriteWanted(AQuebecPlayerState* State, const QuebecHeat::FWanted& Wanted)
    {
        const uint8 NewStars = static_cast<uint8>(FMath::Clamp(Wanted.Stars, 0, QuebecHeat::MaxStars));
        const float NewEnds = static_cast<float>(Wanted.SearchEndsAt);
        const bool bChanged = State->Stars != NewStars || State->bSearching != Wanted.bSearching || State->SearchEndsAt != NewEnds;
        State->Heat = Wanted.Heat;
        State->Stars = NewStars;
        State->bSearching = Wanted.bSearching;
        State->SearchEndsAt = NewEnds;
        if (bChanged) State->Changed();
    }

    // The surveyed roads as a graph, built once per road array. Each dispatcher applies its own closed roads.
    struct FQuebecPoliceRoads
    {
        const FVector (*Source)[2] = nullptr;
        int32 Count = 0;
        QuebecPursuit::FRoadGraph Graph;
        const void* MaskOwner = nullptr;
    };

    FQuebecPoliceRoads& PoliceRoadsFor(const UWorld* World)
    {
        static FQuebecPoliceRoads Roads;
        // ForWorld builds map-name strings; the dispatcher asks every frame, so remember the answer per world.
        static TWeakObjectPtr<UWorld> RoadsWorld;
        if (Roads.Source && World && RoadsWorld.Get() == World) return Roads;
        RoadsWorld = const_cast<UWorld*>(World);
        const QuebecDistrict::FSettings& Settings = QuebecDistrict::ForWorld(World);
        if (Roads.Source != Settings.RoadSegments)
        {
            Roads.Source = Settings.RoadSegments;
            Roads.Count = Settings.RoadCount;
            Roads.MaskOwner = nullptr;
            std::vector<QuebecPursuit::FSegment> Segments;
            Segments.reserve(static_cast<size_t>(Settings.RoadCount));
            for (int32 Index = 0; Index < Settings.RoadCount; ++Index)
                Segments.push_back({PolicePlanar(Settings.RoadSegments[Index][0]), PolicePlanar(Settings.RoadSegments[Index][1])});
            Roads.Graph.Build(Segments);
        }
        return Roads;
    }

    QuebecPursuit::FRoadGraph& PoliceGraph(const void* Owner, const UWorld* World, const TArray<bool>& Open)
    {
        FQuebecPoliceRoads& Roads = PoliceRoadsFor(World);
        if (Roads.MaskOwner != Owner)
        {
            for (int32 Index = 0; Index < Roads.Count; ++Index) Roads.Graph.SetOpen(Index, !Open.IsValidIndex(Index) || Open[Index]);
            Roads.MaskOwner = Owner;
        }
        return Roads.Graph;
    }

    UMaterialInterface* PoliceMaterial(const TCHAR* Path)
    {
        return LoadObject<UMaterialInterface>(nullptr, Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
    }

    UMaterialInterface* PoliceTint(UObject* Outer, const TCHAR* ParentPath, const FLinearColor& Tint, const TCHAR* FallbackPath)
    {
        if (UMaterialInterface* Parent = PoliceMaterial(ParentPath))
            if (UMaterialInstanceDynamic* Instance = UMaterialInstanceDynamic::Create(Parent, Outer))
            {
                Instance->SetVectorParameterValue(TEXT("Tint"), Tint);
                return Instance;
            }
        return FallbackPath ? PoliceMaterial(FallbackPath) : nullptr;
    }

    // One 1.2 s cycle of the two-tone hi-lo siren at 24 kHz, built once: 960 Hz for 0.6 s (576 whole cycles), then
    // 770 Hz for 0.6 s (462 whole cycles), so the phase returns to zero and the loop repeats without a click.
    // A soft square (fundamental plus a third harmonic) gives it a little bite.
    const TArray<int16>& PoliceSirenLoop()
    {
        static const TArray<int16> Loop = []
        {
            constexpr int32 Rate = 24000;
            constexpr int32 Half = Rate * 6 / 10;
            TArray<int16> Samples;
            Samples.SetNumUninitialized(Half * 2);
            double Turn = 0.;
            for (int32 Index = 0; Index < Samples.Num(); ++Index)
            {
                const double Wave = FMath::Sin(Turn * 2. * UE_DOUBLE_PI) + .3 * FMath::Sin(Turn * 6. * UE_DOUBLE_PI);
                Samples[Index] = static_cast<int16>(FMath::Clamp(Wave * .09, -1., 1.) * 32767.);
                Turn += (Index < Half ? 960. : 770.) / Rate;
                Turn -= FMath::FloorToDouble(Turn);
            }
            return Samples;
        }();
        return Loop;
    }
}

FVector QuebecPolice::GarageLocation()
{
    return (PoliceGarageStart + PoliceGarageEnd) * .5 + PoliceGarageRight() * 150.;
}

void QuebecCrime::Report(AController* Offender, EQuebecCrime Crime, const FVector& Where)
{
    if (!Offender || !Offender->HasAuthority() || Where.ContainsNaN()) return;
    if (AQuebecPoliceDispatch* Dispatch = AQuebecPoliceDispatch::Find(Offender->GetWorld())) Dispatch->ReportCrime(Offender, Crime, Where);
}

void QuebecCrime::SetStars(AController* Player, int32 NewStars)
{
    if (!Player || !Player->HasAuthority()) return;
    if (AQuebecPoliceDispatch* Dispatch = AQuebecPoliceDispatch::Find(Player->GetWorld()))
    {
        Dispatch->ApplyStars(Player, NewStars);
        return;
    }
    // Without a dispatcher nothing would count a search down, so stars can only clear.
    if (NewStars <= 0)
        if (AQuebecPlayerState* State = Player->GetPlayerState<AQuebecPlayerState>()) PoliceWriteWanted(State, QuebecHeat::FWanted());
}

int32 QuebecCrime::Stars(const AController* Player)
{
    const AQuebecPlayerState* State = Player ? Player->GetPlayerState<AQuebecPlayerState>() : nullptr;
    return State ? State->Stars : 0;
}

bool QuebecCrime::IsPolice(const AActor* Actor)
{
    if (const AQuebecOfficer* Officer = Cast<AQuebecOfficer>(Actor)) return Officer->Faction == AQuebecOfficer::FactionPolice;
    const AQuebecCar* Car = Cast<AQuebecCar>(Actor);
    return Car && Car->bPolice;
}

bool QuebecCrime::IsHostile(const AActor* Actor, const AActor* Player)
{
    const AQuebecPlayerState* Stats = QuebecCombat::State(Player);
    const bool bWanted = Stats && Stats->Stars > 0;
    if (const AQuebecOfficer* Officer = Cast<AQuebecOfficer>(Actor))
    {
        if (Officer->IsDown()) return false;
        if (Officer->Faction == AQuebecOfficer::FactionGoon) return true;
        // Police threaten only the wanted player they chase; an officer with no target yet chases any wanted player.
        const AController* Chased = Officer->GetTargetController();
        return bWanted && (!Chased || Chased == Cast<AController>(Stats->GetOwner()));
    }
    const AQuebecCar* Car = Cast<AQuebecCar>(Actor);
    return Car && Car->bPolice && !Car->IsWrecked() && !Car->GetController() && bWanted;
}

void QuebecCrime::DecoratePoliceCar(AQuebecCar* Car)
{
    if (!Car || !Car->GetWorld() || !Car->GetRootComponent()) return;
    // BeginPlay, ApplyPaint and OnRep_Police all decorate: the pieces are built once per car, then refreshed.
    UQuebecPoliceLivery* Livery = Car->FindComponentByClass<UQuebecPoliceLivery>();
    if (!Livery)
    {
        if (!Car->bPolice) return;
        Livery = NewObject<UQuebecPoliceLivery>(Car, TEXT("PoliceLivery"));
        Livery->SetupAttachment(Car->GetRootComponent());
        Car->AddInstanceComponent(Livery);
        Livery->RegisterComponent();
    }
    Livery->Refresh();
}

// ---------------------------------------------------------------------------------------------------------------
// Officers and goons

AQuebecOfficer::AQuebecOfficer()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    SetReplicateMovement(true);
    SetNetUpdateFrequency(20.f);
    AutoPossessAI = EAutoPossessAI::Disabled;
    AIControllerClass = nullptr;
    bUseControllerRotationYaw = false;
    GetCapsuleComponent()->InitCapsuleSize(38.f, 92.f);
    // Like residents, officers never stop cars or players: cars knock them over through QuebecPeople::StrikeWithCar.
    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
    GetCapsuleComponent()->SetGenerateOverlapEvents(false);
    UCharacterMovementComponent* Walking = GetCharacterMovement();
    Walking->bRunPhysicsWithNoController = true;
    Walking->bOrientRotationToMovement = true;
    Walking->RotationRate = FRotator(0., 540., 0.);
    Walking->MaxWalkSpeed = 500.f;
    Walking->BrakingDecelerationWalking = 1400.f;
    GetMesh()->SetRelativeLocation(FVector(0., 0., -92.));
    GetMesh()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Pose = CreateDefaultSubobject<USceneComponent>(TEXT("Pose"));
    Pose->SetupAttachment(GetMesh());
    Pose->SetRelativeLocation(FVector(0., 0., QuebecKnock::HipHeight));
    Body = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Body"));
    Body->SetupAttachment(Pose);
    Body->SetRelativeLocation(FVector(0., 0., -QuebecKnock::HipHeight));
    Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Body->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::OnlyTickPoseWhenRendered;
    Body->SetRenderCustomDepth(true);
    Body->SetCustomDepthStencilValue(255);
    Blob = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("InkBlob"));
    Blob->SetupAttachment(GetCapsuleComponent());
    Blob->SetUsingAbsoluteLocation(true);
    Blob->SetUsingAbsoluteScale(true);
    Blob->SetRelativeScale3D(FVector(.24));
    Blob->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Blob->SetCastShadow(false);
    Blob->SetVisibility(false);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    CubeMesh = Cube.Object;
    SphereMesh = Sphere.Object;
    CylinderMesh = Cylinder.Object;
    Blob->SetStaticMesh(SphereMesh);
    // The Plateau civilians (Quaternius CC0) give the bodies; hard references keep them in the package.
    static ConstructorHelpers::FObjectFinderOptional<USkeletalMesh> PoliceSkin(TEXT("/Game/Plateau/Life/Civilians/MenSuit/SK_MenSuit.SK_MenSuit"));
    static ConstructorHelpers::FObjectFinderOptional<USkeletalMesh> GoonSkin(TEXT("/Game/Plateau/Life/Civilians/MenHoodie/SK_MenHoodie.SK_MenHoodie"));
    static ConstructorHelpers::FObjectFinderOptional<UAnimSequence> PoliceWalkClip(TEXT("/Game/Plateau/Life/Civilians/MenSuit/A_MenSuit_Walk.A_MenSuit_Walk"));
    static ConstructorHelpers::FObjectFinderOptional<UAnimSequence> PoliceIdleClip(TEXT("/Game/Plateau/Life/Civilians/MenSuit/A_MenSuit_Idle.A_MenSuit_Idle"));
    static ConstructorHelpers::FObjectFinderOptional<UAnimSequence> GoonWalkClip(TEXT("/Game/Plateau/Life/Civilians/MenHoodie/A_MenHoodie_Walk.A_MenHoodie_Walk"));
    static ConstructorHelpers::FObjectFinderOptional<UAnimSequence> GoonIdleClip(TEXT("/Game/Plateau/Life/Civilians/MenHoodie/A_MenHoodie_Idle.A_MenHoodie_Idle"));
    PoliceBodyMesh = PoliceSkin.Get();
    GoonBodyMesh = GoonSkin.Get();
    PoliceWalk = PoliceWalkClip.Get();
    PoliceIdle = PoliceIdleClip.Get();
    GoonWalk = GoonWalkClip.Get();
    GoonIdle = GoonIdleClip.Get();
}

void AQuebecOfficer::BeginPlay()
{
    Super::BeginPlay();
    // The radar draws police and goons out to 250 m.
    SetNetCullDistanceSquared(FMath::Square(26000.f));
    ApplyLook();
    if (HasAuthority())
    {
        GetCharacterMovement()->MaxWalkSpeed = Faction == FactionGoon ? 430.f : 500.f;
        const float Now = static_cast<float>(GetWorld()->GetTimeSeconds());
        NextAttackAt = Now + 1.f + FMath::FRand();
        NextThrowAt = Now + 1.5f + FMath::FRand();
    }
}

UStaticMeshComponent* AQuebecOfficer::AddShape(FName Name, UStaticMesh* ShapeMesh, USceneComponent* Parent, const FVector& Location,
    const FVector& Size, UMaterialInterface* Material)
{
    if (!ShapeMesh || !Parent) return nullptr;
    UStaticMeshComponent* Shape = NewObject<UStaticMeshComponent>(this, Name);
    AddInstanceComponent(Shape);
    Shape->SetupAttachment(Parent);
    Shape->SetStaticMesh(ShapeMesh);
    // Sizes are centimetres whatever the body's import scale.
    Shape->SetUsingAbsoluteScale(true);
    Shape->SetRelativeLocation(Location);
    Shape->SetRelativeScale3D(Size / 100.);
    Shape->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Shape->SetCastShadow(false);
    if (Material) Shape->SetMaterial(0, Material);
    Shape->RegisterComponent();
    Shapes.Add(Shape);
    return Shape;
}

void AQuebecOfficer::ApplyLook()
{
    const bool bGoon = Faction == FactionGoon;
    UMaterialInterface* Navy = PoliceMaterial(PoliceNavyPath);
    UMaterialInterface* Ink = PoliceMaterial(PoliceInkPath);
    UMaterialInterface* White = PoliceMaterial(TEXT("/Game/ParkComic/M_White.M_White"));
    UMaterialInterface* Gold = PoliceMaterial(TEXT("/Game/ParkComic/M_Gold.M_Gold"));
    USkeletalMesh* Skin = bGoon ? GoonBodyMesh : PoliceBodyMesh;
    if (!Skin)
    {
        // The clothed idle bake replaces the cylinder when it has been imported.
        // Feet sit on the mesh origin; the pose pivot is the hip.
        const TCHAR* StandPath = bGoon
            ? TEXT("/Game/Plateau/Life/Civilians/MenHoodie/SM_MenHoodieStand.SM_MenHoodieStand")
            : TEXT("/Game/Plateau/Life/Civilians/MenSuit/SM_MenSuitStand.SM_MenSuitStand");
        if (UStaticMesh* Stand = LoadObject<UStaticMesh>(nullptr, StandPath, nullptr, LOAD_NoWarn | LOAD_Quiet))
        {
            AddShape(TEXT("FallbackStand"), Stand, Pose, FVector(0., 0., -QuebecKnock::HipHeight), FVector(100., 100., 100.), nullptr);
            BodyHeight = bGoon ? 176.f : 182.f;
            return;
        }
        // Basic shapes when the civilian rigs and the baked stand are both missing.
        const FVector Torso(0., 0., 0.), Head(0., 0., 72.);
        FallbackBody.Add(AddShape(TEXT("FallbackTorso"), CylinderMesh, Pose, Torso, FVector(46., 40., 120.), bGoon ? Ink : Navy));
        FallbackBody.Add(AddShape(TEXT("FallbackHead"), SphereMesh, Pose, Head, FVector(28., 28., 30.), bGoon ? White : PoliceMaterial(TEXT("/Game/ParkComic/M_Skin.M_Skin"))));
        if (!bGoon) AddShape(TEXT("FallbackCap"), CylinderMesh, Pose, Head + FVector(1., 0., 15.), FVector(30., 30., 9.), Navy);
        BodyHeight = 182.f;
        return;
    }
    Body->SetSkeletalMesh(Skin);
    const FBox Box = Skin->GetImportedBounds().GetBox();
    const double Height = FMath::Max(Box.Max.Z - Box.Min.Z, 100.);
    const double Scale = (bGoon ? 176. : 182.) / Height;
    BodyHeight = static_cast<float>(Height * Scale);
    Body->SetRelativeScale3D(FVector(Scale));
    // Feet on the floor under the hip pivot; the rigs face +X.
    Body->SetRelativeLocation(FVector(0., 0., -QuebecKnock::HipHeight - Box.Min.Z * Scale));
    for (int32 Slot = 0; Slot < Body->GetNumMaterials(); ++Slot)
    {
        const UMaterialInterface* Current = Body->GetMaterial(Slot);
        const FString Name = Current ? Current->GetName() : FString();
        if (bGoon) { if (Ink) Body->SetMaterial(Slot, Ink); }
        else if (Navy && (Name.Contains(TEXT("Suit")) || Name.Contains(TEXT("Tie")))) Body->SetMaterial(Slot, Navy);
    }
    if (UAnimSequence* Idle = bGoon ? GoonIdle : PoliceIdle)
    {
        Body->PlayAnimation(Idle, true);
        CurrentClip = Idle;
    }
    // Body-local coordinates: Box units, so a centimetre offset is divided by the scale.
    const auto Local = [&Box, Scale](double Forward, double Side, double AboveFeet)
    {
        return FVector(Forward / Scale, Side / Scale, Box.Min.Z + AboveFeet / Scale);
    };
    const double Tall = BodyHeight;
    if (!bGoon)
    {
        AddShape(TEXT("PoliceCap"), CylinderMesh, Body, Local(1., 0., Tall - 6.), FVector(25., 25., 9.), Navy);
        AddShape(TEXT("PoliceCapBand"), CylinderMesh, Body, Local(1., 0., Tall - 9.), FVector(25.6, 25.6, 2.5), Ink);
        AddShape(TEXT("PoliceVisor"), CubeMesh, Body, Local(13., 0., Tall - 11.), FVector(10., 20., 1.6), Ink);
        AddShape(TEXT("PoliceBadge"), CubeMesh, Body, Local(13., -7., Tall * .73), FVector(1.5, 5., 6.), Gold);
        AddShape(TEXT("PoliceHolster"), CubeMesh, Body, Local(2., 21., Tall * .52), FVector(7., 5., 15.), Ink);
        AddShape(TEXT("PolicePistol"), CubeMesh, Body, Local(9., 22., Tall * .55), FVector(14., 3.5, 4.), Ink);
    }
    else
    {
        // The Curator's ink goons: an ink-black body behind a plain white mask.
        AddShape(TEXT("GoonMask"), SphereMesh, Body, Local(9., 0., Tall - 16.), FVector(17., 19., 23.), White);
        AddShape(TEXT("GoonEyeLeft"), SphereMesh, Body, Local(17., -4.5, Tall - 13.), FVector(2., 4., 5.), Ink);
        AddShape(TEXT("GoonEyeRight"), SphereMesh, Body, Local(17., 4.5, Tall - 13.), FVector(2., 4., 5.), Ink);
    }
}

AQuebecOfficer* AQuebecOfficer::SpawnOfficer(UWorld* World, const FVector& Location, float Yaw, uint8 NewFaction)
{
    if (!World || World->GetNetMode() == NM_Client || Location.ContainsNaN() || !FMath::IsFinite(Yaw)) return nullptr;
    FVector Point = Location;
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(OfficerFloor), false);
    if (World->LineTraceSingleByChannel(Hit, Location + FVector(0., 0., 150.), Location - FVector(0., 0., 600.), ECC_Visibility, Query) &&
        Hit.ImpactNormal.Z > .6f) Point.Z = Hit.ImpactPoint.Z;
    Point.Z += 94.;
    const FTransform Transform(FRotator(0., Yaw, 0.), Point);
    AQuebecOfficer* Officer = World->SpawnActorDeferred<AQuebecOfficer>(AQuebecOfficer::StaticClass(), Transform, nullptr, nullptr,
        ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
    if (!Officer) return nullptr;
    Officer->Faction = NewFaction == FactionGoon ? FactionGoon : FactionPolice;
    Officer->Health = Officer->Faction == FactionGoon ? 60.f : 100.f;
    Officer->FinishSpawning(Transform);
    UE_LOG(LogTemp, Display, TEXT("NORD_POLICE spawn_officer faction=%d x=%.0f y=%.0f"), static_cast<int32>(Officer->Faction), Point.X, Point.Y);
    return Officer;
}

float AQuebecOfficer::ServerTime() const
{
    return PoliceServerTime(GetWorld());
}

float AQuebecOfficer::KnockEndsAt() const
{
    if (bKnockedOut) return TNumericLimits<float>::Max();
    QuebecKnock::FLaunch Launch;
    Launch.Forward = KnockForward;
    Launch.Up = KnockUp;
    Launch.Spin = KnockSpin;
    Launch.LieSeconds = KnockLieSeconds;
    return KnockStartedAt + QuebecKnock::Timeline(Launch).Total;
}

void AQuebecOfficer::MoveBlockedBy(const FHitResult& Impact)
{
    Super::MoveBlockedBy(Impact);
    if (HasAuthority() && GetCharacterMovement()) AQuebecParkedCars::PromoteOnBody(Impact, GetCharacterMovement()->Velocity, this);
}

bool AQuebecOfficer::IsDown() const
{
    return Health <= 0.f || bKnockedOut || ServerTime() < KnockEndsAt();
}

FVector AQuebecOfficer::GetAimPoint() const
{
    return GetActorLocation() + FVector(0., 0., IsDown() ? -60. : 35.);
}

void AQuebecOfficer::SetTargetPlayer(AActor* Player)
{
    TargetActor = Player;
    TargetController = nullptr;
    if (AController* AsController = Cast<AController>(Player)) TargetController = AsController;
    else if (const APawn* AsPawn = Cast<APawn>(Player)) TargetController = AsPawn->GetController();
    else if (const APlayerState* AsState = Cast<APlayerState>(Player)) TargetController = Cast<AController>(AsState->GetOwner());
}

APawn* AQuebecOfficer::GetTargetPawn() const
{
    if (const AController* Target = TargetController.Get()) return Target->GetPawn();
    return Cast<APawn>(TargetActor.Get());
}

void AQuebecOfficer::SetGoal(const FVector& Point)
{
    if (Point.ContainsNaN()) return;
    Goal = Point;
    GoalAt = static_cast<float>(GetWorld()->GetTimeSeconds());
}

void AQuebecOfficer::SetHomeCar(AQuebecCar* Car)
{
    HomeCar = Car;
}

bool AQuebecOfficer::ReceiveHit(EQuebecHitKind Kind, float Damage, const FVector& Push, AController* HitBy)
{
    if (!HasAuthority() || IsDown() || !FMath::IsFinite(Damage) || Push.ContainsNaN()) return false;
    // Officers step out of the way of their own cars.
    if (Kind == EQuebecHitKind::Car && Faction == FactionPolice && !HitBy)
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
            if (It->bPolice && !It->GetController() && FVector::DistSquared2D(It->GetActorLocation(), GetActorLocation()) < FMath::Square(700.))
                return false;
    Health = FMath::Max(0.f, Health - FMath::Max(Damage, 0.f));
    if (HitBy && HitBy->IsPlayerController()) SetTargetPlayer(HitBy);
    const bool bOut = Health <= 0.f;
    // A car or a heavy blow tumbles; a jab or a single SMG round only staggers.
    if (!bOut && Kind != EQuebecHitKind::Car && Damage < 25.f)
    {
        StaggerUntil = static_cast<float>(GetWorld()->GetTimeSeconds()) + .35f;
        ForceNetUpdate();
        return true;
    }
    const QuebecKnock::FLaunch Launch = Kind == EQuebecHitKind::Car
        ? QuebecKnock::CarLaunch(static_cast<float>(Push.Size2D())) : QuebecKnock::HitLaunch(Damage);
    FVector Direction = Push.GetSafeNormal2D();
    if (Direction.IsNearlyZero()) Direction = -GetActorForwardVector().GetSafeNormal2D();
    KnockStartedAt = ServerTime();
    KnockForward = Launch.Forward;
    KnockUp = Launch.Up;
    KnockSpin = Launch.Spin;
    KnockLieSeconds = bOut ? 30.f : Launch.LieSeconds;
    bKnockedOut = bOut;
    // Face along the push so the tumble, posed in actor space, falls the way the body flies.
    SetActorRotation(FRotator(0., Direction.Rotation().Yaw, 0.));
    GetCharacterMovement()->bOrientRotationToMovement = false;
    LaunchCharacter(Direction * Launch.Forward + FVector(0., 0., Launch.Up), true, true);
    bKnockMoving = true;
    ForceNetUpdate();
    UE_LOG(LogTemp, Display, TEXT("NORD_POLICE officer_down faction=%d out=%d health=%.0f"), static_cast<int32>(Faction), bOut ? 1 : 0, Health);
    return true;
}

void AQuebecOfficer::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!FMath::IsFinite(DeltaSeconds) || DeltaSeconds <= 0.f) return;
    const float Now = ServerTime();
    if (HasAuthority()) Think(DeltaSeconds, Now);
    if (IsPendingKillPending()) return;
    UpdatePose(Now);
    UpdateAnimation();
    UpdateBlob(static_cast<float>(GetWorld()->GetTimeSeconds()));
}

void AQuebecOfficer::Think(float DeltaSeconds, float Now)
{
    UWorld* World = GetWorld();
    const float LocalNow = static_cast<float>(World->GetTimeSeconds());
    if (GetActorLocation().Z < -1500.) { Destroy(); return; }
    if (bKnockedOut)
    {
        // Lie dazed a while, then leave the scene.
        if (Now - KnockStartedAt > 9.f) Destroy();
        return;
    }
    if (Now < KnockEndsAt()) return;
    if (bKnockMoving)
    {
        bKnockMoving = false;
        GetCharacterMovement()->bOrientRotationToMovement = true;
    }
    if (LocalNow < StaggerUntil) return;
    // A player who is knocked out or arrested is left alone.
    const auto Usable = [](const APawn* Candidate)
    {
        if (!Candidate) return false;
        const AQuebecPlayerState* Stats = QuebecCombat::State(Candidate);
        return !(Stats && Stats->IsDown());
    };
    APawn* Target = GetTargetPawn();
    if (Faction == FactionGoon && !Usable(Target))
    {
        // Goons go for the nearest player who is up.
        Target = nullptr;
        double Best = TNumericLimits<double>::Max();
        for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
        {
            APlayerController* Player = It->Get();
            APawn* Candidate = Player ? Player->GetPawn() : nullptr;
            if (!Usable(Candidate)) continue;
            const double Gap = FVector::DistSquared(Candidate->GetActorLocation(), GetActorLocation());
            if (Gap < Best) { Best = Gap; Target = Candidate; }
        }
        if (Target) SetTargetPlayer(Target->GetController() ? static_cast<AActor*>(Target->GetController()) : Target);
    }
    if (!Target) return;
    const int32 TargetStars = QuebecCrime::Stars(TargetController.Get());
    AQuebecCar* Home = HomeCar.Get();
    const bool bDriving = Cast<AQuebecCar>(Target) != nullptr;
    // Police stand down when the stars clear, and walk back to their car when the player drives off.
    bLeaving = Faction == FactionPolice && (TargetStars <= 0 || !Usable(Target) ||
        (Home && bDriving && FVector::DistSquared2D(Target->GetActorLocation(), GetActorLocation()) > FMath::Square(2500.)));
    if (bLeaving)
    {
        if (Home && !Home->IsWrecked())
        {
            if (FVector::DistSquared2D(Home->GetActorLocation(), GetActorLocation()) < FMath::Square(330.)) { Destroy(); return; }
            AddMovementInput(Steer(Home->GetActorLocation(), Home, LocalNow), 1.f);
        }
        return;
    }
    // Police head for what the dispatcher knows; goons always know where their target is.
    const bool bGoalFresh = Faction == FactionPolice && LocalNow - GoalAt < 1.f;
    const FVector Destination = bGoalFresh ? Goal : Target->GetActorLocation();
    const double Range = FVector::Dist2D(Destination, GetActorLocation());
    const float TargetRange = static_cast<float>(FVector::Dist(Target->GetActorLocation(), GetActorLocation()));
    bool bHold = false;
    if (Faction == FactionPolice)
    {
        if (QuebecHeat::OfficersShoot(TargetStars) && TargetRange > 500.f && TargetRange < 2500.f && CanSee(Target, LocalNow))
        {
            bHold = true;
            if (LocalNow >= NextAttackAt) Attack(Target, TargetRange, LocalNow);
        }
        if (Range <= (bDriving ? 350. : 95.)) bHold = true;
    }
    else if (TargetRange < 170.f)
    {
        bHold = true;
        if (LocalNow >= NextAttackAt) Attack(Target, TargetRange, LocalNow);
    }
    else if (TargetRange > 450.f && TargetRange < 1400.f && LocalNow >= NextThrowAt && CanSee(Target, LocalNow))
        Attack(Target, TargetRange, LocalNow);
    if (!bHold) AddMovementInput(Steer(Destination, Target, LocalNow), 1.f);
    else
    {
        const FRotator Facing(0., (Target->GetActorLocation() - GetActorLocation()).Rotation().Yaw, 0.);
        SetActorRotation(FMath::RInterpTo(GetActorRotation(), Facing, DeltaSeconds, 8.f));
    }
}

FVector AQuebecOfficer::Steer(const FVector& Point, const AActor* Ignore, float Now)
{
    const FVector Here = GetActorLocation();
    FVector Desired = (Point - Here).GetSafeNormal2D();
    if (Desired.IsNearlyZero()) return FVector::ZeroVector;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(OfficerSteer), false, this);
    if (Ignore) Query.AddIgnoredActor(Ignore);
    // Keep a little room from other officers; they never count as walls.
    for (TActorIterator<AQuebecOfficer> It(GetWorld()); It; ++It)
    {
        if (*It == this) continue;
        Query.AddIgnoredActor(*It);
        const FVector Away = Here - It->GetActorLocation();
        const double Gap = Away.Size2D();
        if (Gap > 1. && Gap < 140. && !It->IsDown()) Desired += Away.GetSafeNormal2D() * (1. - Gap / 140.);
    }
    Desired = Desired.GetSafeNormal2D();
    if (Now < NextProbeAt) return SteerDirection.IsNearlyZero() ? Desired : SteerDirection;
    NextProbeAt = Now + .2f;
    // No navmesh: probe ahead for walls and cars and take the first free heading, widening to either side.
    FCollisionObjectQueryParams Obstacles;
    Obstacles.AddObjectTypesToQuery(ECC_WorldStatic);
    Obstacles.AddObjectTypesToQuery(ECC_WorldDynamic);
    Obstacles.AddObjectTypesToQuery(ECC_Pawn);
    for (const float Angle : {0.f, 35.f, -35.f, 70.f, -70.f, 110.f, -110.f})
    {
        const FVector Heading = Desired.RotateAngleAxis(Angle, FVector::UpVector);
        FHitResult Hit;
        if (!GetWorld()->SweepSingleByObjectType(Hit, Here, Here + Heading * 140., FQuat::Identity, Obstacles, FCollisionShape::MakeSphere(34.f), Query))
        {
            SteerDirection = Angle == 0.f ? FVector::ZeroVector : Heading;
            return Heading;
        }
    }
    SteerDirection = FVector::ZeroVector;
    return Desired;
}

bool AQuebecOfficer::CanSee(const AActor* Target, float Now)
{
    if (Now < NextSightAt) return bSight;
    NextSightAt = Now + .25f;
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(OfficerSight), false, this);
    Query.AddIgnoredActor(Target);
    bSight = !GetWorld()->LineTraceSingleByChannel(Hit, GetActorLocation() + FVector(0., 0., 60.), Target->GetActorLocation() + FVector(0., 0., 30.),
        ECC_Visibility, Query);
    return bSight;
}

void AQuebecOfficer::Attack(APawn* Target, float Range, float Now)
{
    AQuebecCar* Car = Cast<AQuebecCar>(Target);
    AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Target);
    const FVector Aim = Target->GetActorLocation() + FVector(0., 0., Car ? 30. : 40.);
    const FVector Hand = GetActorLocation() + GetActorForwardVector() * 40. + GetActorRightVector() * 22. + FVector(0., 0., 35.);
    // A driver is hurt through the car: aim at the car, and DamagePlayer shares a hit on an occupant between the
    // driver and the body. An empty car only takes body damage.
    AQuebecCharacter* Victim = Walker ? Walker : (Car ? Car->Occupant.Get() : nullptr);
    const auto Land = [Car, Victim](float PlayerDamage, float CarDamage)
    {
        if (Victim) QuebecCombat::DamagePlayer(Victim, PlayerDamage, nullptr);
        else if (Car) Car->AddBodyDamage(CarDamage, nullptr);
    };
    if (Faction == FactionPolice)
    {
        // From three stars: a shot with a generous miss chance, so a player can run instead of being shredded.
        NextAttackAt = Now + 1.15f + FMath::FRand() * .5f;
        const float Chance = QuebecHeat::ShotHitChance(Range, static_cast<float>(PolicePawnVelocity(Target).Size2D()), Car != nullptr);
        const bool bHit = FMath::FRand() < Chance;
        FVector Impact = Aim;
        if (!bHit) Impact += FMath::VRand() * 140. + (Aim - Hand).GetSafeNormal() * 400.;
        if (bHit) Land(8.f, 5.f);
        MulticastAttack(Hand, Impact, 0, bHit);
        QuebecPeople::Alarm(GetWorld(), Hand, 2500.f);
        return;
    }
    if (Range < 170.f)
    {
        NextAttackAt = Now + 1.1f;
        Land(10.f, 3.f);
        MulticastAttack(Hand, Aim, 2, true);
        return;
    }
    // A thrown ink blob: the damage lands now, the blob flies on every peer.
    NextThrowAt = Now + 2.6f;
    const bool bHit = FMath::FRand() < .45f;
    FVector Impact = Aim;
    if (!bHit) Impact += FMath::VRand() * 160. + (Aim - Hand).GetSafeNormal() * 250.;
    if (bHit) Land(7.f, 4.f);
    MulticastAttack(Hand, Impact, 1, bHit);
}

void AQuebecOfficer::MulticastAttack_Implementation(FVector_NetQuantize From, FVector_NetQuantize To, uint8 Kind, bool bHit)
{
    if (GetNetMode() == NM_DedicatedServer) return;
    if (Kind == 0) AQuebecCombatFX::PlayShot(GetWorld(), From, To, static_cast<int32>(EQuebecWeapon::Pistol), bHit, bHit);
    else if (Kind == 2) AQuebecCombatFX::PlayImpact(GetWorld(), To, static_cast<int32>(EQuebecWeapon::Fists));
    else
    {
        BlobFrom = From;
        BlobTo = To;
        bBlobHit = bHit;
        BlobStartedAt = static_cast<float>(GetWorld()->GetTimeSeconds());
        if (UMaterialInterface* Ink = PoliceMaterial(PoliceInkPath)) Blob->SetMaterial(0, Ink);
    }
}

void AQuebecOfficer::UpdateBlob(float LocalNow)
{
    const float Flight = (LocalNow - BlobStartedAt) / .35f;
    if (Flight < 0.f || Flight > 1.f)
    {
        if (Blob->IsVisible())
        {
            Blob->SetVisibility(false);
            if (bBlobHit && GetNetMode() != NM_DedicatedServer) AQuebecCombatFX::PlayImpact(GetWorld(), BlobTo, static_cast<int32>(EQuebecWeapon::Fists));
            bBlobHit = false;
        }
        return;
    }
    Blob->SetWorldLocation(FMath::Lerp(BlobFrom, BlobTo, Flight) + FVector(0., 0., 360. * Flight * (1. - Flight)));
    Blob->SetVisibility(true);
}

void AQuebecOfficer::UpdatePose(float Now)
{
    const float Elapsed = Now - KnockStartedAt;
    const bool bActive = bKnockedOut || (Elapsed >= 0.f && Now < KnockEndsAt());
    if (!bActive)
    {
        if (bPoseApplied)
        {
            Pose->SetRelativeLocationAndRotation(FVector(0., 0., QuebecKnock::HipHeight), FRotator::ZeroRotator);
            for (UStaticMeshComponent* Star : DazedStars) if (Star) Star->SetVisibility(false);
            bPoseApplied = false;
        }
        return;
    }
    QuebecKnock::FLaunch Launch;
    Launch.Forward = KnockForward;
    Launch.Up = KnockUp;
    Launch.Spin = KnockSpin;
    Launch.LieSeconds = KnockLieSeconds;
    const QuebecKnock::FPose Tumble = QuebecKnock::Sample(Launch, Elapsed);
    // The capsule carries the flight; the pose adds the tumble about the hips. The actor faces the push, so the
    // model's pitch (head toward the push) is a nose-down pitch in actor space.
    Pose->SetRelativeLocationAndRotation(FVector(0., 0., Tumble.Hip), FRotator(-Tumble.Pitch, 0.f, Tumble.Roll));
    bPoseApplied = true;
    const bool bStars = Tumble.bDazed || bKnockedOut;
    if (bStars && DazedStars.IsEmpty())
        for (int32 Index = 0; Index < 3; ++Index)
            if (UStaticMeshComponent* Star = AddShape(*FString::Printf(TEXT("DazedStar%d"), Index), CubeMesh, GetCapsuleComponent(), FVector::ZeroVector,
                FVector(9., 9., 9.), PoliceMaterial(TEXT("/Game/ParkComic/M_Gold.M_Gold"))))
            {
                Star->SetUsingAbsoluteLocation(true);
                DazedStars.Add(Star);
            }
    const FVector Head = Pose->GetComponentTransform().TransformPosition(FVector(0., 0., BodyHeight - QuebecKnock::HipHeight - 10.));
    for (int32 Index = 0; Index < DazedStars.Num(); ++Index)
    {
        UStaticMeshComponent* Star = DazedStars[Index];
        if (!Star) continue;
        Star->SetVisibility(bStars);
        if (!bStars) continue;
        const float Angle = Now * 4.f + Index * 2.0944f;
        Star->SetWorldLocationAndRotation(Head + FVector(FMath::Cos(Angle) * 28., FMath::Sin(Angle) * 28., 22.), FRotator(45.f, Now * 180.f, 45.f));
    }
}

void AQuebecOfficer::UpdateAnimation()
{
    if (!Body->GetSkeletalMeshAsset()) return;
    const bool bGoon = Faction == FactionGoon;
    UAnimSequence* WalkClip = bGoon ? GoonWalk.Get() : PoliceWalk.Get();
    UAnimSequence* IdleClip = bGoon ? GoonIdle.Get() : PoliceIdle.Get();
    const bool bDown = IsDown();
    const float Pace = static_cast<float>(GetVelocity().Size2D());
    UAnimSequence* Clip = Pace > 40.f && !bDown ? WalkClip : IdleClip;
    if (!Clip) return;
    if (Clip != CurrentClip)
    {
        Body->PlayAnimation(Clip, true);
        CurrentClip = Clip;
    }
    // The civilians only have a walk: police run it faster. A knocked body holds still.
    Body->SetPlayRate(bDown ? 0.f : (Clip == WalkClip ? FMath::Clamp(Pace / 150.f, .7f, 3.2f) : 1.f));
}

void AQuebecOfficer::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecOfficer, Faction);
    DOREPLIFETIME(AQuebecOfficer, Health);
    DOREPLIFETIME(AQuebecOfficer, KnockStartedAt);
    DOREPLIFETIME(AQuebecOfficer, KnockForward);
    DOREPLIFETIME(AQuebecOfficer, KnockUp);
    DOREPLIFETIME(AQuebecOfficer, KnockSpin);
    DOREPLIFETIME(AQuebecOfficer, KnockLieSeconds);
    DOREPLIFETIME(AQuebecOfficer, bKnockedOut);
}

// ---------------------------------------------------------------------------------------------------------------
// Police car livery

UQuebecPoliceLivery::UQuebecPoliceLivery()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.bStartWithTickEnabled = true;
    bAutoActivate = true;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    CubeMesh = Cube.Object;
}

AQuebecCar* UQuebecPoliceLivery::GetCar() const
{
    return Cast<AQuebecCar>(GetOwner());
}

void UQuebecPoliceLivery::Refresh()
{
    AQuebecCar* Car = GetCar();
    if (!Car) return;
    if (!bBuilt) Build();
    Fit();
    Repaint();
    // On a client OnRep_Police can build the livery before the car's BeginPlay and ApplyPaint run; whatever they did,
    // the livery's own materials come back here, and the lenses on the next tick.
    if (BandLeft) BandLeft->SetMaterial(0, BandPaint.Get());
    if (BandRight) BandRight->SetMaterial(0, BandPaint.Get());
    if (BarBase) BarBase->SetMaterial(0, LampOff.Get());
    if (RedLamp) RedLamp->SetMaterial(0, LampOff.Get());
    if (BlueLamp) BlueLamp->SetMaterial(0, LampOff.Get());
    LampPhase = -1;
    Show(Car->bPolice);
    SetComponentTickEnabled(true);
}

bool UQuebecPoliceLivery::IsSirenSounding() const
{
    return SirenAudio && SirenAudio->IsPlaying();
}

void UQuebecPoliceLivery::Build()
{
    bBuilt = true;
    AActor* Car = GetOwner();
    const auto Piece = [this, Car](const TCHAR* PieceName, UMaterialInterface* PieceMaterial)
    {
        UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(Car, PieceName);
        Part->SetupAttachment(this);
        Part->SetStaticMesh(CubeMesh);
        Part->SetMobility(EComponentMobility::Movable);
        Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Part->SetCastShadow(false);
        // AQuebecCar::BeginPlay and ApplyPaint leave tagged pieces alone.
        Part->ComponentTags.Add(TEXT("NordOwnPaint"));
        if (PieceMaterial) Part->SetMaterial(0, PieceMaterial);
        Car->AddInstanceComponent(Part);
        Part->RegisterComponent();
        Pieces.Add(Part);
        return Part;
    };
    // White on the car's own paint shader, a blue band, and a light bar. Generic: no real force's markings.
    const TCHAR* PaintPath = TEXT("/Game/ParkComic/M_Car70_Paint.M_Car70_Paint");
    if (UMaterialInterface* Paint = PoliceMaterial(PaintPath))
        if (UMaterialInstanceDynamic* Instance = UMaterialInstanceDynamic::Create(Paint, this))
        {
            Instance->SetVectorParameterValue(TEXT("Tint"), FLinearColor(.9f, .92f, .95f));
            WhitePaint = Instance;
        }
    WhiteFallback = PoliceMaterial(TEXT("/Game/ParkComic/M_White.M_White"));
    BandPaint = PoliceTint(this, PaintPath, FLinearColor(.02f, .12f, .58f), PoliceNavyPath);
    RedOn = PoliceMaterial(TEXT("/Game/ParkComic/M_Car70_Red.M_Car70_Red"));
    if (!RedOn) RedOn = PoliceMaterial(TEXT("/Game/ParkComic/M_Red.M_Red"));
    BlueOn = PoliceTint(this, TEXT("/Game/ParkComic/M_Car70_Lens.M_Car70_Lens"), FLinearColor(.05f, .25f, 1.f), PoliceNavyPath);
    LampOff = PoliceMaterial(TEXT("/Game/ParkComic/M_Car70_Ink.M_Car70_Ink"));
    if (!LampOff) LampOff = PoliceMaterial(PoliceInkPath);
    BandLeft = Piece(TEXT("PoliceBandLeft"), BandPaint.Get());
    BandRight = Piece(TEXT("PoliceBandRight"), BandPaint.Get());
    BarBase = Piece(TEXT("PoliceLightBar"), LampOff);
    RedLamp = Piece(TEXT("PoliceRedLamp"), LampOff);
    BlueLamp = Piece(TEXT("PoliceBlueLamp"), LampOff);
    UMaterialInterface* TextMaterial = PoliceMaterial(PoliceTextPath);
    const TCHAR* WordNames[] = {TEXT("PoliceWordLeft"), TEXT("PoliceWordRight"), TEXT("PoliceWordRear")};
    for (const TCHAR* WordName : WordNames)
    {
        UTextRenderComponent* Word = NewObject<UTextRenderComponent>(Car, WordName);
        Word->SetupAttachment(this);
        Word->SetText(FText::FromString(TEXT("POLICE")));
        Word->SetWorldSize(16.f);
        Word->SetHorizontalAlignment(EHTA_Center);
        Word->SetVerticalAlignment(EVRTA_TextCenter);
        Word->SetTextRenderColor(FColor(10, 30, 125));
        Word->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Word->ComponentTags.Add(TEXT("NordOwnPaint"));
        if (TextMaterial) Word->SetTextMaterial(TextMaterial);
        Car->AddInstanceComponent(Word);
        Word->RegisterComponent();
        Words.Add(Word);
    }
    const auto Lamp = [this, Car](const TCHAR* LampName, const FLinearColor& Color)
    {
        UPointLightComponent* Light = NewObject<UPointLightComponent>(Car, LampName);
        Light->SetupAttachment(this);
        Light->SetMobility(EComponentMobility::Movable);
        Light->SetIntensityUnits(ELightUnits::Candelas);
        Light->SetIntensity(0.f);
        Light->SetAttenuationRadius(1200.f);
        Light->SetLightColor(Color);
        Light->SetCastShadows(false);
        Car->AddInstanceComponent(Light);
        Light->RegisterComponent();
        return Light;
    };
    RedLight = Lamp(TEXT("PoliceRedLight"), FLinearColor(1.f, .05f, .03f));
    BlueLight = Lamp(TEXT("PoliceBlueLight"), FLinearColor(.08f, .2f, 1.f));
    SirenAudio = NewObject<UAudioComponent>(Car, TEXT("PoliceSiren"));
    SirenAudio->SetupAttachment(this);
    SirenAudio->bAutoActivate = false;
    SirenAudio->bAllowSpatialization = false;
    Car->AddInstanceComponent(SirenAudio);
    SirenAudio->RegisterComponent();
}

void UQuebecPoliceLivery::Fit()
{
    AQuebecCar* Car = GetCar();
    if (!Car || !bBuilt || !BandLeft || !BandRight || Words.Num() != 3) return;
    FBox BodyBox(ForceInit), CabinBox(ForceInit);
    UStaticMesh* BodyMesh = nullptr;
    TArray<UStaticMeshComponent*> CarParts;
    Car->GetComponents(CarParts);
    for (UStaticMeshComponent* Part : CarParts)
    {
        // Only the car's own visible body pieces, not this livery's or the smoke.
        if (!Part || !Part->GetStaticMesh() || !Part->IsVisible() || Part->GetAttachParent() != Car->GetRootComponent()) continue;
        const FString PartName = Part->GetName();
        const FBox Box = Part->CalcBounds(Part->GetRelativeTransform()).GetBox();
        if (PartName == TEXT("Body")) { BodyBox += Box; BodyMesh = Part->GetStaticMesh(); }
        else if (PartName == TEXT("Glass") || PartName == TEXT("Roof")) CabinBox += Box;
    }
    FittedBody = BodyMesh;
    if (!BodyBox.IsValid) BodyBox = FBox(FVector(-220., -90., -62.), FVector(220., 90., 13.));
    if (!CabinBox.IsValid) CabinBox = FBox(FVector(-130., -80., 13.), FVector(90., 80., 90.));
    // The 1970s bodies are 91-96 cm half-width at the doors, with mirrors beyond (Scripts/prepare_seventies_cars.py),
    // so the bounds overstate the flank. A band from 88 to 97.5 cm shows along the whole side; the box body is 90 cm.
    const bool bSeventies = BodyMesh && BodyMesh->GetName().StartsWith(TEXT("SM_Car70Body"));
    const double Outer = bSeventies ? 97.5 : 91.;
    const double Inner = Outer - 9.5;
    const double BandZ = bSeventies ? -16. : BodyBox.Min.Z + BodyBox.GetSize().Z * .55;
    const double CenterX = BodyBox.GetCenter().X;
    const double Length = BodyBox.GetSize().X * .8;
    BandLeft->SetRelativeLocation(FVector(CenterX, -(Inner + Outer) * .5, BandZ));
    BandRight->SetRelativeLocation(FVector(CenterX, (Inner + Outer) * .5, BandZ));
    for (UStaticMeshComponent* Band : {BandLeft.Get(), BandRight.Get()}) Band->SetRelativeScale3D(FVector(Length / 100., (Outer - Inner) / 100., .12));
    const double WordZ = BandZ + 15.;
    Words[0]->SetRelativeLocationAndRotation(FVector(CenterX, -(Outer + .5), WordZ), FRotator(0., -90., 0.));
    Words[1]->SetRelativeLocationAndRotation(FVector(CenterX, Outer + .5, WordZ), FRotator(0., 90., 0.));
    Words[2]->SetRelativeLocationAndRotation(FVector(BodyBox.Min.X - 1., 0., WordZ - 4.), FRotator(0., 180., 0.));
    const double Top = FMath::Max(BodyBox.Max.Z, CabinBox.Max.Z);
    const double RoofX = CabinBox.GetCenter().X;
    BarBase->SetRelativeLocation(FVector(RoofX, 0., Top + 3.5));
    BarBase->SetRelativeScale3D(FVector(.32, 1.18, .07));
    RedLamp->SetRelativeLocation(FVector(RoofX, -30., Top + 11.));
    BlueLamp->SetRelativeLocation(FVector(RoofX, 30., Top + 11.));
    for (UStaticMeshComponent* Lens : {RedLamp.Get(), BlueLamp.Get()}) Lens->SetRelativeScale3D(FVector(.24, .5, .1));
    RedLight->SetRelativeLocation(FVector(RoofX, -30., Top + 40.));
    BlueLight->SetRelativeLocation(FVector(RoofX, 30., Top + 40.));
}

void UQuebecPoliceLivery::Repaint()
{
    AQuebecCar* Car = GetCar();
    if (!Car) return;
    TArray<UStaticMeshComponent*> CarParts;
    Car->GetComponents(CarParts);
    for (UStaticMeshComponent* Part : CarParts)
    {
        if (!Part || Part->GetAttachParent() != Car->GetRootComponent()) continue;
        const FString PartName = Part->GetName();
        const UStaticMesh* PartMesh = Part->GetStaticMesh();
        if (!PartMesh || (PartName != TEXT("Body") && PartName != TEXT("Roof"))) continue;
        const TArray<FStaticMaterial>& Slots = PartMesh->GetStaticMaterials();
        bool bPainted = false;
        for (int32 Slot = 0; Slot < Slots.Num(); ++Slot)
            if (Slots[Slot].MaterialSlotName == TEXT("Paint"))
            {
                bPainted = true;
                if (WhitePaint && Part->GetMaterial(Slot) != WhitePaint.Get()) Part->SetMaterial(Slot, WhitePaint.Get());
            }
        // The older box body has no paint slot: paint all of it white.
        if (!bPainted && PartName == TEXT("Body") && WhiteFallback && Part->GetMaterial(0) != WhiteFallback.Get())
            Part->SetMaterial(0, WhiteFallback.Get());
    }
}

void UQuebecPoliceLivery::Show(bool bShow)
{
    bLiveryShown = bShow;
    for (UStaticMeshComponent* Part : Pieces) if (Part) Part->SetVisibility(bShow);
    for (UTextRenderComponent* Word : Words) if (Word) Word->SetVisibility(bShow);
    if (!bShow)
    {
        if (RedLight) RedLight->SetIntensity(0.f);
        if (BlueLight) BlueLight->SetIntensity(0.f);
        LampPhase = -1;
    }
}

void UQuebecPoliceLivery::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    AQuebecCar* Car = GetCar();
    if (!Car || !bBuilt || !FMath::IsFinite(DeltaTime)) return;
    if (Car->bPolice != bLiveryShown) Show(Car->bPolice);
    const bool bFlashing = bLiveryShown && Car->bSiren && !Car->IsWrecked();
    if (bLiveryShown)
    {
        RepaintClock += DeltaTime;
        if (RepaintClock > .5f)
        {
            RepaintClock = 0.f;
            // A late ApplyPaint swaps the body mesh or its materials; follow it.
            UStaticMesh* BodyNow = nullptr;
            TArray<UStaticMeshComponent*> CarParts;
            Car->GetComponents(CarParts);
            for (UStaticMeshComponent* Part : CarParts) if (Part && Part->GetName() == TEXT("Body")) BodyNow = Part->GetStaticMesh();
            if (BodyNow != FittedBody) Fit();
            Repaint();
        }
    }
    // Red and blue alternate four times a second.
    SirenClock = FMath::Fmod(SirenClock + DeltaTime, 60.f);
    const int32 Phase = !bFlashing ? 0 : (FMath::Fmod(SirenClock, .5f) < .25f ? 1 : 2);
    if (Phase != LampPhase)
    {
        LampPhase = Phase;
        if (RedLamp) RedLamp->SetMaterial(0, Phase == 1 ? RedOn.Get() : LampOff.Get());
        if (BlueLamp) BlueLamp->SetMaterial(0, Phase == 2 ? BlueOn.Get() : LampOff.Get());
        if (RedLight) RedLight->SetIntensity(Phase == 1 ? 900.f : 0.f);
        if (BlueLight) BlueLight->SetIntensity(Phase == 2 ? 900.f : 0.f);
    }
    UpdateSiren(DeltaTime, bFlashing);
}

void UQuebecPoliceLivery::UpdateSiren(float DeltaTime, bool bSounding)
{
    if (!SirenAudio) return;
    const UWorld* World = GetWorld();
    float Volume = 0.f;
    if (bSounding && World && World->AllowAudioPlayback() && GetNetMode() != NM_DedicatedServer)
    {
        // Not spatialised, like the car engine: loud near the local camera and silent past 90 m.
        const APlayerController* Local = World->GetFirstPlayerController();
        if (Local && Local->IsLocalController() && Local->PlayerCameraManager)
            Volume = FMath::Clamp(1.f - static_cast<float>(FVector::Dist(Local->PlayerCameraManager->GetCameraLocation(), GetComponentLocation())) / 9000.f, 0.f, 1.f);
    }
    if (Volume <= 0.f)
    {
        if (SirenAudio->IsPlaying()) { SirenAudio->Stop(); if (SirenWave) SirenWave->ResetAudio(); }
        return;
    }
    if (!SirenWave)
    {
        SirenWave = NewObject<USoundWaveProcedural>(this);
        SirenWave->SetSampleRate(24000);
        SirenWave->NumChannels = 1;
        SirenWave->Duration = INDEFINITELY_LOOPING_DURATION;
        SirenAudio->SetSound(SirenWave);
    }
    SirenAudio->SetVolumeMultiplier(Volume * Volume);
    // Top the buffer up from the precomputed loop: a copy, no synthesis per frame.
    const TArray<int16>& Loop = PoliceSirenLoop();
    int32 Frames = FMath::Clamp(3600 - SirenWave->GetAvailableAudioByteCount() / 2, 0, 3600);
    while (Frames > 0 && Loop.Num() > 0)
    {
        SirenCursor = SirenCursor % Loop.Num();
        const int32 Chunk = FMath::Min(Frames, Loop.Num() - SirenCursor);
        SirenWave->QueueAudio(reinterpret_cast<const uint8*>(Loop.GetData() + SirenCursor), Chunk * static_cast<int32>(sizeof(int16)));
        SirenCursor += Chunk;
        Frames -= Chunk;
    }
    if (!SirenAudio->IsPlaying()) SirenAudio->Play();
}

// ---------------------------------------------------------------------------------------------------------------
// Dispatcher

AQuebecPoliceDispatch::AQuebecPoliceDispatch()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetNetUpdateFrequency(1.f);
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("Scene"));
    RootComponent = Scene;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    CubeMesh = Cube.Object;
    CylinderMesh = Cylinder.Object;
}

AQuebecPoliceDispatch* AQuebecPoliceDispatch::Find(const UWorld* World)
{
    if (!World) return nullptr;
    TActorIterator<AQuebecPoliceDispatch> It(World);
    return It ? *It : nullptr;
}

void AQuebecPoliceDispatch::BeginPlay()
{
    Super::BeginPlay();
    BuildGarage();
    if (!HasAuthority()) { SetActorTickEnabled(false); return; }
    RoadOpen.Init(true, PoliceRoadsFor(GetWorld()).Count);
    RoadScanNext = 0;
    const FVector Garage = QuebecPolice::GarageLocation();
    UE_LOG(LogTemp, Display, TEXT("NORD_POLICE dispatcher garage_x=%.0f garage_y=%.0f"), Garage.X, Garage.Y);
}

void AQuebecPoliceDispatch::BuildGarage()
{
    // A body shop sign on the sidewalk and a painted bay in the lane. Local, unreplicated components on every peer.
    const FVector Direction = PoliceGarageDirection(), Right = PoliceGarageRight();
    FVector Bay = QuebecPolice::GarageLocation();
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(PoliceGarageFloor), true);
    if (GetWorld()->LineTraceSingleByChannel(Hit, Bay + FVector(0., 0., 400.), Bay - FVector(0., 0., 400.), ECC_Visibility, Query) &&
        Hit.ImpactPoint.Z > -200. && Hit.ImpactPoint.Z < 80.) Bay.Z = Hit.ImpactPoint.Z;
    const double Floor = Bay.Z;
    const FRotator Along = Direction.Rotation();
    UMaterialInterface* Gold = PoliceMaterial(TEXT("/Game/ParkComic/M_Gold.M_Gold"));
    UMaterialInterface* Ink = PoliceMaterial(PoliceInkPath);
    UMaterialInterface* Panel = PoliceTint(this, PoliceNavyPath, FLinearColor(.02f, .16f, .5f), PoliceNavyPath);
    UMaterialInterface* TextMaterial = PoliceMaterial(PoliceTextPath);
    const auto Part = [this](const TCHAR* PartName, UStaticMesh* PartMesh, const FVector& Point, const FVector& Size, const FRotator& Rotation, UMaterialInterface* PartMaterial)
    {
        if (!PartMesh) return;
        UStaticMeshComponent* Shape = NewObject<UStaticMeshComponent>(this, PartName);
        AddInstanceComponent(Shape);
        Shape->SetupAttachment(Scene);
        Shape->SetStaticMesh(PartMesh);
        Shape->SetMobility(EComponentMobility::Movable);
        Shape->SetWorldLocationAndRotation(Point, Rotation);
        Shape->SetWorldScale3D(Size / 100.);
        Shape->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Shape->SetCastShadow(false);
        if (PartMaterial) Shape->SetMaterial(0, PartMaterial);
        Shape->RegisterComponent();
    };
    const auto Caption = [this, TextMaterial](const TCHAR* CaptionName, const FString& Text, const FVector& Point, const FRotator& Rotation, float Size, const FColor& Color)
    {
        UTextRenderComponent* Word = NewObject<UTextRenderComponent>(this, CaptionName);
        AddInstanceComponent(Word);
        Word->SetupAttachment(Scene);
        Word->SetWorldLocationAndRotation(Point, Rotation);
        Word->SetHorizontalAlignment(EHTA_Center);
        Word->SetVerticalAlignment(EVRTA_TextCenter);
        Word->SetWorldSize(Size);
        Word->SetText(FText::FromString(Text));
        Word->SetTextRenderColor(Color);
        Word->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        if (TextMaterial) Word->SetTextMaterial(TextMaterial);
        Word->RegisterComponent();
    };
    // The bay: a yellow outline 7.6 m by 3.3 m and a painted word, readable from a car coming along the street.
    const FVector Lift(0., 0., Floor + 2.);
    Part(TEXT("GarageBayLeft"), CubeMesh, FVector(Bay.X, Bay.Y, 0.) - Right * 165. + Lift, FVector(760., 14., 2.), Along, Gold);
    Part(TEXT("GarageBayRight"), CubeMesh, FVector(Bay.X, Bay.Y, 0.) + Right * 165. + Lift, FVector(760., 14., 2.), Along, Gold);
    Part(TEXT("GarageBayNear"), CubeMesh, FVector(Bay.X, Bay.Y, 0.) - Direction * 380. + Lift, FVector(14., 330., 2.), Along, Gold);
    Part(TEXT("GarageBayFar"), CubeMesh, FVector(Bay.X, Bay.Y, 0.) + Direction * 380. + Lift, FVector(14., 330., 2.), Along, Gold);
    Caption(TEXT("GarageBayWord"), TEXT("GARAGE"), FVector(Bay.X, Bay.Y, Floor + 3.), FRotator(90., Along.Yaw + 180., 0.), 110.f, FColor(250, 250, 245));
    // The sign stands on the sidewalk beside the bay, facing the street, in the Montréal shop-sign manner:
    // French first, white letters on a blue panel.
    const FVector Sign = FVector(Bay.X, Bay.Y, Floor) + Right * 320.;
    Part(TEXT("GaragePostNear"), CylinderMesh, Sign - Direction * 140. + FVector(0., 0., 160.), FVector(10., 10., 320.), FRotator::ZeroRotator, Ink);
    Part(TEXT("GaragePostFar"), CylinderMesh, Sign + Direction * 140. + FVector(0., 0., 160.), FVector(10., 10., 320.), FRotator::ZeroRotator, Ink);
    Part(TEXT("GaragePanel"), CubeMesh, Sign + FVector(0., 0., 290.), FVector(310., 12., 120.), Along, Panel);
    for (const double Face : {-1., 1.})
    {
        const FRotator Facing(0., (Right * Face).Rotation().Yaw, 0.);
        const FVector Front = Sign + Right * (Face * 7.5);
        const bool bStreet = Face < 0.;
        Caption(bStreet ? TEXT("GarageWordStreet") : TEXT("GarageWordBack"), TEXT("GARAGE"), Front + FVector(0., 0., 305.), Facing, 58.f, FColor(250, 250, 245));
        Caption(bStreet ? TEXT("GarageLineStreet") : TEXT("GarageLineBack"), TEXT("MÉCANIQUE · CARROSSERIE"), Front + FVector(0., 0., 258.), Facing, 20.f,
            FColor(255, 214, 90));
    }
}

void AQuebecPoliceDispatch::ScanRoads(int32 Budget)
{
    if (bRoadsChecked) return;
    FQuebecPoliceRoads& Roads = PoliceRoadsFor(GetWorld());
    if (RoadOpen.Num() != Roads.Count)
    {
        RoadOpen.Init(true, Roads.Count);
        RoadScanNext = 0;
    }
    // Some surveyed segments run through an estimated building or a tree. Close them to routing, a few long sweeps per
    // tick so the first star never stalls the host; the inset keeps corner buildings at junctions from closing streets.
    const FCollisionObjectQueryParams Statics(ECC_WorldStatic);
    FCollisionQueryParams Query(SCENE_QUERY_STAT(PoliceRoads), false);
    for (int32 Swept = 0; RoadScanNext < Roads.Count && Swept < Budget; ++RoadScanNext)
    {
        const FVector Start = Roads.Source[RoadScanNext][0], End = Roads.Source[RoadScanNext][1];
        if (FVector::Dist2D(Start, End) < 700.) continue;
        ++Swept;
        const FVector Direction = (End - Start).GetSafeNormal2D();
        const FVector Lift(0., 0., 100.);
        FHitResult Hit;
        if (GetWorld()->SweepSingleByObjectType(Hit, Start + Direction * 300. + Lift, End - Direction * 300. + Lift, Direction.Rotation().Quaternion(),
            Statics, FCollisionShape::MakeBox(FVector(100., 70., 50.)), Query))
            RoadOpen[RoadScanNext] = false;
    }
    if (RoadScanNext < Roads.Count) return;
    bRoadsChecked = true;
    // The next route applies the finished list.
    Roads.MaskOwner = nullptr;
    int32 Closed = 0;
    for (const bool bOpen : RoadOpen) if (!bOpen) ++Closed;
    UE_LOG(LogTemp, Display, TEXT("NORD_POLICE roads=%d closed=%d"), Roads.Count, Closed);
}

FQuebecPoliceRecord& AQuebecPoliceDispatch::RecordFor(APlayerState* State)
{
    return Records.FindOrAdd(TWeakObjectPtr<APlayerState>(State));
}

int32 AQuebecPoliceDispatch::CountCars() const
{
    return Units.Num();
}

int32 AQuebecPoliceDispatch::CountOfficers(const APlayerState* Target) const
{
    int32 Count = 0;
    for (const TWeakObjectPtr<AQuebecOfficer>& Weak : Officers)
    {
        const AQuebecOfficer* Officer = Weak.Get();
        if (!Officer || Officer->IsKnockedOut()) continue;
        const AController* Chased = Officer->GetTargetController();
        if (!Target || (Chased && Chased->PlayerState == Target)) ++Count;
    }
    return Count;
}

float AQuebecPoliceDispatch::NearestPlayerDistance(const FVector& Point) const
{
    double Best = TNumericLimits<float>::Max();
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
        if (const APlayerController* Player = It->Get())
            if (const APawn* Pawn = Player->GetPawn()) Best = FMath::Min(Best, FVector::Dist2D(Point, Pawn->GetActorLocation()));
    return static_cast<float>(Best);
}

bool AQuebecPoliceDispatch::InAnyView(const FVector& Point, const AActor* Ignore) const
{
    const UWorld* World = GetWorld();
    for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
    {
        const APlayerController* Player = It->Get();
        if (!Player) continue;
        FVector Eye;
        FRotator View;
        Player->GetPlayerViewPoint(Eye, View);
        double ConeCosine = .5;
        // A remote driver sends the server no camera updates (the car has no movement component to send them), so
        // assume the chase camera behind the car and widen the cone to cover free look.
        if (!Player->IsLocalController())
            if (const AQuebecCar* Driven = Cast<AQuebecCar>(Player->GetPawn()))
            {
                View = Driven->GetActorRotation();
                Eye = Driven->GetActorLocation() - Driven->GetActorForwardVector() * 700. + FVector(0., 0., 250.);
                ConeCosine = .17;
            }
        const FVector Toward = Point - Eye;
        const double Range = Toward.Size();
        if (Range > 30000.) continue;
        // Inside the cone around the view (60 degrees, 80 for a remote driver) and not hidden behind the city.
        if (Range > 300. && FVector::DotProduct(View.Vector(), Toward / Range) < ConeCosine) continue;
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PoliceInView), false, Player->GetPawn());
        if (Ignore) Query.AddIgnoredActor(Ignore);
        if (!World->LineTraceSingleByChannel(Hit, Eye, Point, ECC_Visibility, Query)) return true;
    }
    return false;
}

bool AQuebecPoliceDispatch::PoliceSee(const FVector& Point, const AActor* Ignore) const
{
    const UWorld* World = GetWorld();
    const auto Clear = [World, &Point, Ignore](const AActor* Watcher, const FVector& Eye)
    {
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PoliceSight), false, Watcher);
        if (Ignore) Query.AddIgnoredActor(Ignore);
        return !World->LineTraceSingleByChannel(Hit, Eye, Point, ECC_Visibility, Query);
    };
    for (const FQuebecPoliceUnit& Unit : Units)
    {
        const AQuebecCar* Car = Unit.Car.Get();
        if (!Car || Car->IsWrecked() || Unit.GiveUpAt >= 0.f) continue;
        const FVector Eye = Car->GetActorLocation() + FVector(0., 0., 70.);
        if (QuebecHeat::InView(QuebecHeat::EWatcher::PoliceCar, PoliceHeatVec(Eye), PoliceHeatVec(Car->GetActorForwardVector()), PoliceHeatVec(Point)) &&
            Clear(Car, Eye)) return true;
    }
    for (TActorIterator<AQuebecOfficer> It(World); It; ++It)
    {
        if (It->Faction != AQuebecOfficer::FactionPolice || It->IsDown()) continue;
        const FVector Eye = It->GetActorLocation() + FVector(0., 0., 70.);
        if (QuebecHeat::InView(QuebecHeat::EWatcher::OfficerOnFoot, PoliceHeatVec(Eye), PoliceHeatVec(It->GetActorForwardVector()), PoliceHeatVec(Point)) &&
            Clear(*It, Eye)) return true;
    }
    return false;
}

void AQuebecPoliceDispatch::ReportCrime(AController* Offender, EQuebecCrime Crime, const FVector& Where)
{
    if (!HasAuthority() || !Offender || !Offender->IsPlayerController()) return;
    AQuebecPlayerState* State = Offender->GetPlayerState<AQuebecPlayerState>();
    if (!State || State->IsDown()) return;
    const int32 Index = static_cast<int32>(Crime);
    if (Index < 0 || Index >= QuebecHeat::CrimeCount) return;
    const float Now = PoliceServerTime(GetWorld());
    FQuebecPoliceRecord& Record = RecordFor(State);
    const QuebecHeat::ECrime Kind = PoliceHeatCrime(Crime);
    if (!QuebecHeat::CrimeReady(Kind, Record.LastCrimeAt[Index], Now)) return;
    // A witness: the police themselves, a police unit that sees the spot, or two civilians close by.
    APawn* Offending = Offender->GetPawn();
    const bool bPoliceSaw = QuebecHeat::AlwaysWitnessed(Kind) || PoliceSee(Where + FVector(0., 0., 60.), Offending);
    bool bWitnessed = bPoliceSaw;
    if (!bWitnessed)
    {
        TArray<AActor*> Near;
        QuebecPeople::Gather(GetWorld(), Where, static_cast<float>(QuebecHeat::CivilianRange), Near);
        int32 Civilians = 0;
        for (const AActor* Person : Near)
            if (Person && !Cast<AQuebecCharacter>(Person) && !Cast<AQuebecOfficer>(Person) && !QuebecPeople::IsDown(Person)) ++Civilians;
        bWitnessed = QuebecHeat::CiviliansWitness(Civilians);
    }
    if (!bWitnessed) return;
    Record.LastCrimeAt[Index] = Now;
    QuebecHeat::FWanted Wanted = PoliceReadWanted(State);
    const int32 Added = QuebecHeat::AddCrime(Wanted, Kind, Now);
    PoliceWriteWanted(State, Wanted);
    // The report tells the police where the player is.
    Record.LastSeen = Offending ? Offending->GetActorLocation() : Where;
    Record.LastSeenVelocity = Offending ? PolicePawnVelocity(Offending) : FVector::ZeroVector;
    Record.LastSeenAt = Now;
    if (bPoliceSaw) Record.bSeen = true;
    UE_LOG(LogTemp, Display, TEXT("NORD_WANTED crime=%d heat=%.0f stars=%d police=%d"), Index, Wanted.Heat, Wanted.Stars, bPoliceSaw ? 1 : 0);
    if (Added > 0)
        QuebecNotice::Show(Offender, FString(UTF8_TO_TCHAR(QuebecBanner::Wanted)), FString(UTF8_TO_TCHAR(QuebecBanner::StarLine(Wanted.Stars).c_str())), 2.5f);
}

void AQuebecPoliceDispatch::ApplyStars(AController* Player, int32 NewStars)
{
    AQuebecPlayerState* State = Player ? Player->GetPlayerState<AQuebecPlayerState>() : nullptr;
    if (!HasAuthority() || !State) return;
    QuebecHeat::FWanted Wanted = PoliceReadWanted(State);
    const int32 Before = Wanted.Stars;
    QuebecHeat::SetStars(Wanted, NewStars);
    PoliceWriteWanted(State, Wanted);
    FQuebecPoliceRecord& Record = RecordFor(State);
    Record.ArrestHeld = 0.f;
    if (Wanted.Stars > 0)
    {
        // Dispatch knows where the player is now; unseen, the search starts from here.
        if (const APawn* Pawn = Player->GetPawn()) Record.LastSeen = Pawn->GetActorLocation();
        Record.LastSeenVelocity = FVector::ZeroVector;
        Record.LastSeenAt = PoliceServerTime(GetWorld());
    }
    UE_LOG(LogTemp, Display, TEXT("NORD_WANTED set_stars=%d before=%d"), Wanted.Stars, Before);
}

void AQuebecPoliceDispatch::Arrest(APlayerController* Player, AQuebecPlayerState* State, float Now)
{
    PoliceWriteWanted(State, QuebecHeat::FWanted());
    State->DownState = static_cast<uint8>(EQuebecDownState::Arrested);
    State->DownUntil = Now + QuebecHeat::ArrestBannerSeconds;
    State->Changed();
    if (AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Player->GetPawn())) Walker->GetCharacterMovement()->StopMovementImmediately();
    FQuebecPoliceRecord& Record = RecordFor(State);
    Record.bArrestPending = true;
    Record.bSeen = false;
    Record.ArrestHeld = 0.f;
    QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::ArrestedWord)), FString(UTF8_TO_TCHAR(QuebecBanner::StationLine)), QuebecHeat::ArrestBannerSeconds);
    UE_LOG(LogTemp, Display, TEXT("NORD_WANTED arrest player=%s"), *GetNameSafe(Player));
}

void AQuebecPoliceDispatch::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!HasAuthority() || !FMath::IsFinite(DeltaSeconds) || DeltaSeconds <= 0.f) return;
    const float Now = PoliceServerTime(GetWorld());
    VisionClock += DeltaSeconds;
    ManageClock += DeltaSeconds;
    // Sight lines at 5 Hz, unit bookkeeping at 2 Hz, driving every frame.
    const bool bVision = VisionClock >= .2f;
    if (bVision) VisionClock = 0.f;
    ScanRoads(4);
    TickPlayers(Now, DeltaSeconds, bVision);
    if (ManageClock >= .5f)
    {
        ManageUnits(Now, ManageClock);
        ManageClock = 0.f;
    }
    DriveUnits(Now, DeltaSeconds);
    SteerOfficers(Now);
}

void AQuebecPoliceDispatch::TickPlayers(float Now, float DeltaSeconds, bool bVision)
{
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
    {
        APlayerController* Player = It->Get();
        AQuebecPlayerState* State = Player ? Player->GetPlayerState<AQuebecPlayerState>() : nullptr;
        if (!State) continue;
        FQuebecPoliceRecord& Record = RecordFor(State);
        if (State->IsDown())
        {
            Record.ArrestHeld = 0.f;
            Record.bSeen = false;
            // After the ARRÊTÉ banner the player stands up at Poste de quartier 38. COMBAT owns the K.-O. return.
            if (Record.bArrestPending && State->GetDownState() == EQuebecDownState::Arrested && Now >= State->DownUntil)
            {
                Record.bArrestPending = false;
                if (AQuebecController* Quebec = Cast<AQuebecController>(Player)) QuebecCombat::Respawn(Quebec, EQuebecDownState::Arrested);
                else State->ResetForRespawn();
            }
            continue;
        }
        Record.bArrestPending = false;
        APawn* Pawn = Player->GetPawn();
        if (!Pawn) continue;
        QuebecHeat::FWanted Wanted = PoliceReadWanted(State);
        if (bVision)
        {
            Record.bSeen = Wanted.Stars > 0 && PoliceSee(PoliceWatchPoint(Pawn), Pawn);
            if (Record.bSeen)
            {
                Record.LastSeen = Pawn->GetActorLocation();
                Record.LastSeenVelocity = PolicePawnVelocity(Pawn);
                Record.LastSeenAt = Now;
            }
        }
        const int32 Change = QuebecHeat::Tick(Wanted, Now, DeltaSeconds, Record.bSeen);
        PoliceWriteWanted(State, Wanted);
        if (Change < 0)
        {
            UE_LOG(LogTemp, Display, TEXT("NORD_WANTED stars=%d reason=search_ended"), Wanted.Stars);
            if (Wanted.Stars == 0) QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::LostPolice)), FString(UTF8_TO_TCHAR(QuebecBanner::LostDetail)), 3.f);
        }
        if (Wanted.Stars <= 0) { Record.ArrestHeld = 0.f; continue; }
        // Arrest: a police officer within reach of a slow player on foot for two seconds.
        if (const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn))
        {
            bool bReach = false;
            for (TActorIterator<AQuebecOfficer> Officer(GetWorld()); Officer && !bReach; ++Officer)
                bReach = Officer->Faction == AQuebecOfficer::FactionPolice && !Officer->IsDown() &&
                    FVector::DistSquared2D(Officer->GetActorLocation(), Walker->GetActorLocation()) <= FMath::Square(QuebecHeat::ArrestReach) &&
                    FMath::Abs(Officer->GetActorLocation().Z - Walker->GetActorLocation().Z) < 150.;
            QuebecHeat::FArrest Hold{Record.ArrestHeld};
            const bool bArrested = QuebecHeat::TickArrest(Hold, bReach, static_cast<float>(Walker->GetVelocity().Size2D()), DeltaSeconds);
            Record.ArrestHeld = Hold.Held;
            if (bArrested) { Arrest(Player, State, Now); continue; }
        }
        else Record.ArrestHeld = 0.f;
        // The garage changes the plates when nobody in uniform watches the car roll in.
        if (Cast<AQuebecCar>(Pawn) && !Record.bSeen && Now >= Record.GarageReadyAt &&
            FVector::DistSquared2D(Pawn->GetActorLocation(), QuebecPolice::GarageLocation()) < FMath::Square(QuebecPolice::GarageRadius))
        {
            Record.GarageReadyAt = Now + QuebecPolice::GarageCooldown;
            ApplyStars(Player, 0);
            QuebecNotice::Show(Player, FString(UTF8_TO_TCHAR(QuebecBanner::GarageWord)), FString(UTF8_TO_TCHAR(QuebecBanner::GarageDetail)), 3.f);
            UE_LOG(LogTemp, Display, TEXT("NORD_WANTED garage player=%s"), *GetNameSafe(Player));
        }
    }
}

void AQuebecPoliceDispatch::StartGiveUp(FQuebecPoliceUnit& Unit, float Now)
{
    Unit.GiveUpAt = Now;
    Unit.bWandering = false;
    Unit.PathAt = -100.f;
    AQuebecCar* Car = Unit.Car.Get();
    if (!Car) return;
    Car->bSiren = false;
    // Drive off toward the nearby road point farthest from every player, then vanish out of sight.
    QuebecPursuit::FRoadGraph& Graph = PoliceGraph(this, GetWorld(), RoadOpen);
    float Farthest = -1.f;
    for (uint32 Try = 0; Try < 6; ++Try)
    {
        QuebecPursuit::FVec2 Pick;
        if (!Graph.PointNear(PolicePlanar(Car->GetActorLocation()), 20000., Unit.Seed + Try * 977u, Pick)) continue;
        const FVector Candidate = PoliceFromPlanar(Pick, Car->GetActorLocation().Z);
        const float Gap = NearestPlayerDistance(Candidate);
        if (Gap > Farthest) { Farthest = Gap; Unit.Wander = Candidate; }
    }
    if (Farthest < 0.f) Unit.Wander = Car->GetActorLocation() + Car->GetActorForwardVector() * 20000.;
}

bool AQuebecPoliceDispatch::TrySpawnCar(APlayerController* Player, float Now)
{
    UWorld* World = GetWorld();
    APawn* Pawn = Player ? Player->GetPawn() : nullptr;
    AQuebecPlayerState* State = Player ? Player->GetPlayerState<AQuebecPlayerState>() : nullptr;
    if (!Pawn || !State) return false;
    const FQuebecPoliceRecord& Record = RecordFor(State);
    // Units come toward what the police know: the last sighting or report.
    const FVector Focus = Now - Record.LastSeenAt < 120.f ? Record.LastSeen : Pawn->GetActorLocation();
    const FQuebecPoliceRoads& Roads = PoliceRoadsFor(World);
    TArray<int32> Candidates;
    for (int32 Index = 0; Index < Roads.Count; ++Index)
    {
        if (RoadOpen.IsValidIndex(Index) && !RoadOpen[Index]) continue;
        const double Range = FVector::Dist2D((Roads.Source[Index][0] + Roads.Source[Index][1]) * .5, Focus);
        if (Range >= 12000. && Range <= 20000.) Candidates.Add(Index);
    }
    FRandomStream Random(static_cast<int32>(SpawnSeed * 7919u + 17u));
    ++SpawnSeed;
    for (int32 Index = Candidates.Num() - 1; Index > 0; --Index) Candidates.Swap(Index, Random.RandRange(0, Index));
    const int32 Attempts = FMath::Min(12, Candidates.Num());
    for (int32 Attempt = 0; Attempt < Attempts; ++Attempt)
    {
        const int32 Road = Candidates[Attempt];
        const FVector Start = Roads.Source[Road][0], End = Roads.Source[Road][1];
        FVector Point = FMath::Lerp(Start, End, static_cast<double>(Random.FRandRange(.25f, .75f)));
        FVector Direction = (End - Start).GetSafeNormal2D();
        if (FVector::DotProduct(Direction, Focus - Point) < 0.) Direction = -Direction;
        // On the road surface, out of every player's view, with room for the hull and no car close by.
        FHitResult Hit;
        FCollisionQueryParams Floor(SCENE_QUERY_STAT(PoliceSpawnFloor), true);
        if (!World->LineTraceSingleByObjectType(Hit, Point + FVector(0., 0., 400.), Point - FVector(0., 0., 600.), FCollisionObjectQueryParams(ECC_WorldStatic), Floor) ||
            Hit.ImpactNormal.Z < .7f || Hit.ImpactPoint.Z > 60. || Hit.ImpactPoint.Z < -300.) continue;
        Point.Z = Hit.ImpactPoint.Z + 102.;
        const FRotator Facing(0., Direction.Rotation().Yaw, 0.);
        if (InAnyView(Point, nullptr)) continue;
        FCollisionQueryParams Fit(SCENE_QUERY_STAT(PoliceSpawnFit), false);
        if (World->OverlapBlockingTestByChannel(Point, Facing.Quaternion(), ECC_Pawn, FCollisionShape::MakeBox(FVector(235., 113., 98.)), Fit)) continue;
        bool bCrowded = false;
        for (TActorIterator<AQuebecCar> It(World); It && !bCrowded; ++It) bCrowded = FVector::DistSquared2D(Point, It->GetActorLocation()) < FMath::Square(700.);
        if (bCrowded) continue;
        const FTransform Transform(Facing, Point);
        AQuebecCar* Car = World->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(), Transform, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (!Car) return false;
        Car->PaintStyle = 0;
        Car->BodyProfile = 1;
        // Never CityParked or CityTraffic: the population checks count those.
        Car->Tags.Add(TEXT("Police"));
        Car->FinishSpawning(Transform);
        Car->SetPolice(true);
        Car->bSiren = true;
        Car->SetNetCullDistanceSquared(FMath::Square(30000.f));
        Car->SetAutopilot(0.f, 0.f, false);
        FQuebecPoliceUnit Unit;
        Unit.Car = Car;
        Unit.Target = State;
        Unit.Seed = SpawnSeed * 2654435761u + 1u;
        Units.Add(Unit);
        UE_LOG(LogTemp, Display, TEXT("NORD_POLICE spawn_car x=%.0f y=%.0f target=%s cars=%d"), Point.X, Point.Y, *GetNameSafe(Player), Units.Num());
        return true;
    }
    return false;
}

void AQuebecPoliceDispatch::DeployOfficer(FQuebecPoliceUnit& Unit, APlayerController* Player)
{
    AQuebecCar* Car = Unit.Car.Get();
    const AQuebecPlayerState* Target = Cast<AQuebecPlayerState>(Unit.Target.Get());
    if (!Car || !Target || !Player || Unit.bOfficerOut) return;
    if (CountOfficers() >= QuebecHeat::WorldOfficerCap || CountOfficers(Target) >= QuebecHeat::MaxOfficers(Target->Stars)) return;
    // The driver steps out on the left; the right door is the fallback against a wall.
    for (const double Side : {-1., 1.})
    {
        const FVector Point = Car->GetActorLocation() + Car->GetActorRightVector() * (Side * 200.) - FVector(0., 0., 60.);
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PoliceDoor), false, Car);
        if (GetWorld()->OverlapBlockingTestByChannel(Point + FVector(0., 0., 60.), FQuat::Identity, ECC_WorldStatic, FCollisionShape::MakeCapsule(38.f, 80.f), Query))
            continue;
        AQuebecOfficer* Officer = AQuebecOfficer::SpawnOfficer(GetWorld(), Point, static_cast<float>(Car->GetActorRotation().Yaw), AQuebecOfficer::FactionPolice);
        if (!Officer) return;
        Officer->SetTargetPlayer(Player);
        Officer->SetHomeCar(Car);
        Unit.Officer = Officer;
        Unit.bOfficerOut = true;
        Officers.Add(Officer);
        return;
    }
}

void AQuebecPoliceDispatch::ManageUnits(float Now, float Interval)
{
    UWorld* World = GetWorld();
    for (auto It = Records.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
    Officers.RemoveAll([](const TWeakObjectPtr<AQuebecOfficer>& Weak) { return !Weak.IsValid(); });
    const auto ActiveFor = [this](const APlayerState* Target)
    {
        int32 Count = 0;
        for (const FQuebecPoliceUnit& Each : Units) if (Each.GiveUpAt < 0.f && Each.Target.Get() == Target) ++Count;
        return Count;
    };
    // Wrecks and stolen-and-dumped police cars go once nobody watches.
    for (int32 Index = Wrecks.Num() - 1; Index >= 0; --Index)
    {
        AQuebecCar* Wreck = Wrecks[Index].Get();
        if (!Wreck) { Wrecks.RemoveAt(Index); continue; }
        if (!Wreck->GetController() && NearestPlayerDistance(Wreck->GetActorLocation()) > 4000.f && !InAnyView(Wreck->GetActorLocation() + FVector(0., 0., 60.), Wreck))
        {
            Wreck->Destroy();
            Wrecks.RemoveAt(Index);
        }
    }
    for (int32 Index = Units.Num() - 1; Index >= 0; --Index)
    {
        FQuebecPoliceUnit& Unit = Units[Index];
        AQuebecCar* Car = Unit.Car.Get();
        if (!Car) { Units.RemoveAt(Index); continue; }
        if (AController* Thief = Car->GetController())
        {
            // A player took the police car: that is a stolen car, and it is theirs now.
            QuebecCrime::Report(Thief, EQuebecCrime::StealCar, Car->GetActorLocation());
            Car->bSiren = false;
            Units.RemoveAt(Index);
            continue;
        }
        if (Car->IsWrecked())
        {
            // The crew carries on on foot.
            Car->ClearAutopilot();
            Car->bSiren = false;
            const AQuebecPlayerState* Target = Cast<AQuebecPlayerState>(Unit.Target.Get());
            if (Target && Target->Stars > 0 && Unit.GiveUpAt < 0.f) DeployOfficer(Unit, Cast<APlayerController>(Target->GetOwner()));
            Wrecks.Add(Car);
            Units.RemoveAt(Index);
            continue;
        }
        if (Unit.bOfficerOut && !Unit.Officer.IsValid()) Unit.bOfficerOut = false;
        const FVector Here = Car->GetActorLocation();
        Unit.UnseenFor = InAnyView(Here + FVector(0., 0., 60.), Car) ? 0.f : Unit.UnseenFor + Interval;
        const AQuebecPlayerState* Target = Cast<AQuebecPlayerState>(Unit.Target.Get());
        if (Unit.GiveUpAt < 0.f && (!Target || Target->Stars == 0 || Target->IsDown()))
        {
            // Hand the car to another wanted player who is short of cars, or call it off.
            AQuebecPlayerState* Next = nullptr;
            for (FConstPlayerControllerIterator Player = World->GetPlayerControllerIterator(); Player && !Next; ++Player)
                if (AQuebecPlayerState* Other = Player->Get() ? Player->Get()->GetPlayerState<AQuebecPlayerState>() : nullptr)
                    if (Other->Stars > 0 && !Other->IsDown() && ActiveFor(Other) < QuebecHeat::MaxPoliceCars(Other->Stars)) Next = Other;
            if (Next)
            {
                Unit.Target = Next;
                Unit.PathAt = -100.f;
                Unit.bWandering = false;
            }
            else StartGiveUp(Unit, Now);
        }
        // Gone: called off and out of sight, fallen far behind, or stuck where nobody can see.
        const float Far = NearestPlayerDistance(Here);
        const bool bCalledOff = Unit.GiveUpAt >= 0.f;
        if ((bCalledOff && Unit.UnseenFor > 1.f && Far > 3000.f) || (bCalledOff && Now - Unit.GiveUpAt > 60.f && Far > 8000.f) ||
            (Far > 35000.f && Unit.UnseenFor >= 5.f) || (Unit.StuckCount >= 3 && Unit.UnseenFor >= 2.f))
        {
            UE_LOG(LogTemp, Display, TEXT("NORD_POLICE despawn_car called_off=%d far=%.0f stuck=%d"), bCalledOff ? 1 : 0, Far, Unit.StuckCount);
            Car->Destroy();
            Units.RemoveAt(Index);
        }
    }
    // Officers with nothing left to do leave once nobody sees them.
    for (const TWeakObjectPtr<AQuebecOfficer>& Weak : Officers)
        if (AQuebecOfficer* Officer = Weak.Get())
        {
            const float Far = NearestPlayerDistance(Officer->GetActorLocation());
            if (!Officer->IsKnockedOut() && ((Officer->IsLeaving() && Far > 2500.f) || Far > 12000.f) && !InAnyView(Officer->GetActorLocation(), Officer))
                Officer->Destroy();
        }
    Officers.RemoveAll([](const TWeakObjectPtr<AQuebecOfficer>& Weak) { return !Weak.IsValid() || Weak->IsPendingKillPending(); });
    // One new car per pass for the most wanted player who is short of cars, within the world cap.
    if (CountCars() >= QuebecHeat::WorldCarCap) return;
    APlayerController* Neediest = nullptr;
    int32 MostStars = 0;
    for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
    {
        APlayerController* Player = It->Get();
        AQuebecPlayerState* State = Player ? Player->GetPlayerState<AQuebecPlayerState>() : nullptr;
        if (!State || State->IsDown() || State->Stars <= MostStars || !Player->GetPawn()) continue;
        if (ActiveFor(State) >= QuebecHeat::MaxPoliceCars(State->Stars) || Now < RecordFor(State).NextSpawnAt) continue;
        Neediest = Player;
        MostStars = State->Stars;
    }
    if (!Neediest) return;
    FQuebecPoliceRecord& Record = RecordFor(Neediest->GetPlayerState<AQuebecPlayerState>());
    Record.NextSpawnAt = Now + (TrySpawnCar(Neediest, Now) ? 4.f : 1.5f);
}

void AQuebecPoliceDispatch::DriveUnits(float Now, float DeltaSeconds)
{
    if (Units.IsEmpty()) return;
    QuebecPursuit::FRoadGraph& Graph = PoliceGraph(this, GetWorld(), RoadOpen);
    for (FQuebecPoliceUnit& Unit : Units)
    {
        AQuebecCar* Car = Unit.Car.Get();
        if (!Car || Car->GetController() || Car->IsWrecked()) continue;
        const FVector Here = Car->GetActorLocation();
        const FVector Forward = Car->GetActorForwardVector().GetSafeNormal2D();
        const float CarSpeed = Car->Speed;
        FVector Aim = Here + Forward * 1000.;
        double Desired = 0.;
        bool bBrake = false;
        // Road-graph pursuit: replan now and then, follow the route with the traffic lookahead, slow for corners.
        const auto Follow = [&Graph, &Unit, &Aim, &Desired, Here, Forward, CarSpeed, Now](const FVector& Destination, double Cruise)
        {
            if (Now - Unit.PathAt > 1.5f || FVector::DistSquared2D(Unit.PathGoal, Destination) > FMath::Square(2500.))
            {
                std::vector<QuebecPursuit::FVec2> Planned;
                Unit.Path.Reset();
                Unit.PathIndex = 0;
                Unit.PathAt = Now;
                Unit.PathGoal = Destination;
                if (Graph.Route(PolicePlanar(Here), PolicePlanar(Forward), PolicePlanar(Destination), Planned))
                    for (const QuebecPursuit::FVec2& Waypoint : Planned) Unit.Path.Add(PoliceFromPlanar(Waypoint, Here.Z));
            }
            if (Unit.Path.IsEmpty())
            {
                Aim = Destination;
                Desired = FMath::Min(Cruise, 1200.);
                return;
            }
            std::vector<QuebecPursuit::FVec2> Line;
            Line.reserve(static_cast<size_t>(Unit.Path.Num()));
            for (const FVector& Waypoint : Unit.Path) Line.push_back(PolicePlanar(Waypoint));
            std::size_t Reached = static_cast<std::size_t>(FMath::Max(Unit.PathIndex, 0));
            const QuebecPursuit::FVec2 Lookahead = QuebecPursuit::Lookahead(Line, Reached, PolicePlanar(Here), 450. + FMath::Abs(CarSpeed) * .3);
            Unit.PathIndex = static_cast<int32>(Reached);
            Aim = PoliceFromPlanar(Lookahead, Here.Z);
            const double Bend = QuebecPursuit::TurnAhead(Line, Reached, PolicePlanar(Here), PolicePlanar(Forward), 600. + FMath::Abs(CarSpeed) * .9);
            Desired = FMath::Min(Cruise, QuebecPursuit::CornerSpeed(Bend));
        };
        AQuebecPlayerState* State = Cast<AQuebecPlayerState>(Unit.Target.Get());
        APlayerController* Player = State ? Cast<APlayerController>(State->GetOwner()) : nullptr;
        APawn* Quarry = Player ? Player->GetPawn() : nullptr;
        if (Unit.GiveUpAt >= 0.f) Follow(Unit.Wander, 1100.);
        else if (State && Quarry)
        {
            FQuebecPoliceRecord& Record = RecordFor(State);
            const bool bKnown = Record.bSeen || Now - Record.LastSeenAt < 1.f;
            const bool bDriving = Cast<AQuebecCar>(Quarry) != nullptr;
            const FVector Known = bKnown ? Quarry->GetActorLocation() : Record.LastSeen;
            const FVector KnownVelocity = bKnown ? PolicePawnVelocity(Quarry) : FVector::ZeroVector;
            const double Range = FVector::Dist2D(Here, Known);
            const AQuebecOfficer* Crew = Unit.Officer.Get();
            if (Unit.bOfficerOut && Crew && bDriving && FVector::DistSquared2D(Crew->GetActorLocation(), Here) > FMath::Square(400.))
            {
                // The player drove off: wait a moment for the officer to get back in.
                if (Unit.WaitSince < 0.f) Unit.WaitSince = Now;
                bBrake = Now - Unit.WaitSince < 8.f;
            }
            else Unit.WaitSince = -1.f;
            if (bBrake) {}
            else if (bKnown && Range < QuebecPursuit::DirectRange)
            {
                // Close and in sight: straight at where the player will be in up to 1.2 s; a car gets rammed.
                const QuebecPursuit::FVec2 Lead = QuebecPursuit::PredictTarget(PolicePlanar(Here), PolicePlanar(Car->PlanarVelocity()), PolicePlanar(Known),
                    PolicePlanar(KnownVelocity));
                Aim = PoliceFromPlanar(Lead, Here.Z);
                Desired = QuebecPursuit::ChaseSpeed(Range, KnownVelocity.Size2D(), bDriving);
                Unit.bWandering = false;
                if (!bDriving && Range < 1600.)
                {
                    bBrake = FMath::Abs(CarSpeed) < 250.f;
                    if (FMath::Abs(CarSpeed) < 150.f) DeployOfficer(Unit, Player);
                }
            }
            else
            {
                // Lost: drive to the last sighting, then wander the streets around it.
                if (bKnown) Unit.bWandering = false;
                else if (Unit.bWandering && FVector::DistSquared2D(Here, Unit.Wander) < FMath::Square(2000.)) Unit.bWandering = false;
                else if (!Unit.bWandering && FVector::DistSquared2D(Here, Record.LastSeen) < FMath::Square(2500.))
                {
                    QuebecPursuit::FVec2 Pick;
                    Unit.bWandering = Graph.PointNear(PolicePlanar(Record.LastSeen), QuebecHeat::SearchRadius(State->Stars), Unit.Seed++, Pick);
                    if (Unit.bWandering) Unit.Wander = PoliceFromPlanar(Pick, Here.Z);
                }
                Follow(Unit.bWandering ? Unit.Wander : Known, bKnown ? QuebecPursuit::ChaseSpeed(Range, 0., true) : 1600.);
                // A player on foot away from the roads: stop at the nearest road point and send an officer on foot.
                if (bKnown && !bDriving && !Unit.Path.IsEmpty() && FVector::DistSquared2D(Here, Unit.Path.Last()) < FMath::Square(1500.))
                {
                    Desired = 0.;
                    bBrake = FMath::Abs(CarSpeed) < 300.f;
                    if (FMath::Abs(CarSpeed) < 150.f) DeployOfficer(Unit, Player);
                }
            }
        }
        else bBrake = true;
        // Never run down the force: slow for an own officer just ahead.
        for (const TWeakObjectPtr<AQuebecOfficer>& Weak : Officers)
            if (const AQuebecOfficer* Cop = Weak.Get())
            {
                const FVector Offset = Cop->GetActorLocation() - Here;
                if (Offset.Size2D() < 700. && FVector::DotProduct(Offset.GetSafeNormal2D(), Forward) > .7) Desired = FMath::Min(Desired, 300.);
            }
        const float Error = static_cast<float>(FMath::FindDeltaAngleDegrees(Car->GetActorRotation().Yaw, (Aim - Here).Rotation().Yaw));
        float Wheel = FMath::Clamp(Error / 32.f, -1.f, 1.f);
        float Pedal = FMath::Clamp(static_cast<float>(Desired - CarSpeed) / 500.f, -1.f, 1.f);
        if (Desired < 60. && FMath::Abs(CarSpeed) < 300.f) bBrake = true;
        if (bBrake) Pedal = 0.f;
        // Stuck against something: back out with the wheel the other way, then replan.
        if (Now < Unit.ReverseUntil)
        {
            Pedal = -1.f;
            Wheel = -Wheel;
            bBrake = false;
        }
        else if (!bBrake && Pedal > .3f && FMath::Abs(CarSpeed) < 60.f)
        {
            Unit.StuckFor += DeltaSeconds;
            if (Unit.StuckFor > 1.2f)
            {
                Unit.StuckFor = 0.f;
                Unit.ReverseUntil = Now + 1.1f;
                ++Unit.StuckCount;
                Unit.PathAt = -100.f;
            }
        }
        else
        {
            Unit.StuckFor = 0.f;
            if (FMath::Abs(CarSpeed) > 600.f) Unit.StuckCount = 0;
        }
        Car->bSiren = Unit.GiveUpAt < 0.f;
        Car->SetAutopilot(Pedal, Wheel, bBrake);
    }
}

void AQuebecPoliceDispatch::SteerOfficers(float Now)
{
    // Officers on foot go where the police know the player is, not where the player really is.
    for (const TWeakObjectPtr<AQuebecOfficer>& Weak : Officers)
    {
        AQuebecOfficer* Officer = Weak.Get();
        if (!Officer || Officer->IsDown()) continue;
        AController* Target = Officer->GetTargetController();
        AQuebecPlayerState* State = Target ? Target->GetPlayerState<AQuebecPlayerState>() : nullptr;
        const FQuebecPoliceRecord* Record = State ? Records.Find(TWeakObjectPtr<APlayerState>(State)) : nullptr;
        if (!Record) continue;
        const bool bKnown = Record->bSeen || Now - Record->LastSeenAt < 1.f;
        const APawn* Quarry = Target->GetPawn();
        Officer->SetGoal(bKnown && Quarry ? Quarry->GetActorLocation() : Record->LastSeen);
    }
}
