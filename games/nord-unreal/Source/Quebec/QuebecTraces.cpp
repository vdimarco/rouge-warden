#include "QuebecTraces.h"
#include "QuebecGameplay.h"
#include "QuebecGTA.h"
#include "LaFontaineMap.h"

#include "CollisionQueryParams.h"
#include "CollisionShape.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/Pawn.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    // One tyre-mark layer per game world on this peer.
    TMap<TWeakObjectPtr<UWorld>, TWeakObjectPtr<AQuebecTraceMarks>> TraceMarkLayers;
    // Every street prop of each game world, filled as props are spawned, so strikes read a short list.
    TMap<TWeakObjectPtr<UWorld>, TArray<TWeakObjectPtr<AQuebecStreetProp>>> StreetPropLists;

    // Prop sizes (cm): footprint radius for strikes, hop height, lift when lying on a side, and mass for knock distance.
    struct FTracePropShape { float Radius; float Apex; float Lift; float Mass; };
    FTracePropShape TracePropShape(uint8 PropKind)
    {
        switch (PropKind)
        {
        case AQuebecStreetProp::KindRecycling: return {40.f, 30.f, 36.f, 2.2f};
        case AQuebecStreetProp::KindCompost: return {32.f, 30.f, 29.f, 1.8f};
        case AQuebecStreetProp::KindBarricade: return {60.f, 45.f, 20.f, 1.6f};
        default: return {20.f, 70.f, 18.f, 1.f};
        }
    }

    UMaterialInterface* TraceMaterial(const TCHAR* Name)
    {
        const FString Path = FString::Printf(TEXT("/Game/Materials/%s.%s"),Name,Name);
        return LoadObject<UMaterialInterface>(nullptr,*Path);
    }

    bool TraceTyreGround(const AQuebecCar* Car, const FVector& Wheel, FVector& Ground, FVector& Normal)
    {
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(QuebecTyreMark),false,Car);
        // Object-type traces find the query-only road surfaces, like the car's own wheel support.
        if (!Car->GetWorld()->LineTraceSingleByObjectType(Hit,Wheel+FVector(0.,0.,60.),Wheel-FVector(0.,0.,120.),
            FCollisionObjectQueryParams(ECC_WorldStatic),Query) || Hit.ImpactNormal.Z < .7f) return false;
        Ground = Hit.ImpactPoint;
        Normal = Hit.ImpactNormal;
        return true;
    }
}

bool QuebecStreet::GroundAt(const UWorld* World, const FVector& Point, float& OutZ)
{
    if (!World) return false;
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(QuebecStreetGround),false);
    if (!World->LineTraceSingleByObjectType(Hit,Point+FVector(0.,0.,150.),Point-FVector(0.,0.,400.),
        FCollisionObjectQueryParams(ECC_WorldStatic),Query) || Hit.ImpactNormal.Z < .7f) return false;
    OutZ = float(Hit.ImpactPoint.Z);
    return true;
}

bool QuebecStreet::FindCurb(const UWorld* World, const FVector& RoadPoint, const FVector& Along, const FVector& Outward, float& OutEdge)
{
    float RoadZ = 0.f;
    if (!GroundAt(World,RoadPoint,RoadZ)) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(QuebecCurbProbe),true);
    float Edges[3];
    for (int32 Sample = 0; Sample < 3; ++Sample)
    {
        const FVector Base = RoadPoint+Along.GetSafeNormal2D()*((Sample-1)*235.);
        float Edge = -1.f;
        for (float Lateral = 300.f; Lateral <= 760.f && Edge < 0.f; Lateral += 20.f)
        {
            FVector Probe = Base+Outward.GetSafeNormal2D()*Lateral;
            Probe.Z = RoadZ;
            FHitResult Hit;
            if (!World->LineTraceSingleByChannel(Hit,Probe+FVector(0.,0.,45.),Probe-FVector(0.,0.,30.),ECC_Visibility,Query)) continue;
            const float Rise = float(Hit.ImpactPoint.Z)-RoadZ;
            // Something taller than a curb before any curb: a wall, a planter or a step.
            if (Hit.bStartPenetrating || Rise > 32.f) return false;
            if (Rise >= 12.f && Hit.ImpactNormal.Z >= .7f) Edge = Lateral;
        }
        if (Edge < 0.f) return false;
        Edges[Sample] = Edge;
    }
    const float Nearest = FMath::Min3(Edges[0],Edges[1],Edges[2]), Farthest = FMath::Max3(Edges[0],Edges[1],Edges[2]);
    if (Farthest-Nearest > 60.f || FMath::Abs(Edges[1]-(Edges[0]+Edges[2])*.5f) > 20.f) return false;
    OutEdge = Edges[1];
    return true;
}

AQuebecStreetProp::AQuebecStreetProp()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bStartWithTickEnabled = false;
    bReplicates = true;
    // Every peer poses the prop from the replicated hit, so movement itself is never sent.
    SetReplicateMovement(false);
    SetNetUpdateFrequency(2.f);
    SetNetCullDistanceSquared(FMath::Square(15000.f));
    PropRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PropRoot"));
    RootComponent = PropRoot;
    // Hard references, so the cooker keeps the engine shapes the pieces are built from.
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cone(TEXT("/Engine/BasicShapes/Cone.Cone"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    CubeMesh = Cube.Object;
    ConeMesh = Cone.Object;
    CylinderMesh = Cylinder.Object;
}

void AQuebecStreetProp::PostInitializeComponents()
{
    Super::PostInitializeComponents();
    RegisterStreetProp();
}

void AQuebecStreetProp::Destroyed()
{
    if (TArray<TWeakObjectPtr<AQuebecStreetProp>>* Props = StreetPropLists.Find(GetWorld()))
        Props->RemoveAll([this](const TWeakObjectPtr<AQuebecStreetProp>& Entry) { return !Entry.IsValid() || Entry.Get() == this; });
    Super::Destroyed();
}

void AQuebecStreetProp::RegisterStreetProp()
{
    UWorld* PropWorld = GetWorld();
    if (!PropWorld || !PropWorld->IsGameWorld()) return;
    for (auto It = StreetPropLists.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
    TArray<TWeakObjectPtr<AQuebecStreetProp>>& Props = StreetPropLists.FindOrAdd(PropWorld);
    Props.RemoveAll([](const TWeakObjectPtr<AQuebecStreetProp>& Entry) { return !Entry.IsValid(); });
    Props.AddUnique(this);
}

void AQuebecStreetProp::BeginPlay()
{
    Super::BeginPlay();
    BuildPieces();
    ApplyPose(ServerNow());
    if (IsKnocked()) SetActorTickEnabled(true);
}

void AQuebecStreetProp::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecStreetProp, Kind);
    DOREPLIFETIME(AQuebecStreetProp, Variant);
    DOREPLIFETIME(AQuebecStreetProp, KnockedAt);
    DOREPLIFETIME(AQuebecStreetProp, Home);
    DOREPLIFETIME(AQuebecStreetProp, HomeYaw);
    DOREPLIFETIME(AQuebecStreetProp, RestPoint);
    DOREPLIFETIME(AQuebecStreetProp, TumbleYaw);
    DOREPLIFETIME(AQuebecStreetProp, TumbleSpin);
}

float AQuebecStreetProp::StrikeRadius() const { return TracePropShape(Kind).Radius; }

float AQuebecStreetProp::ServerNow() const
{
    const UWorld* PropWorld = GetWorld();
    if (!PropWorld) return 0.f;
    const AGameStateBase* State = PropWorld->GetGameState();
    return State ? float(State->GetServerWorldTimeSeconds()) : PropWorld->GetTimeSeconds();
}

void AQuebecStreetProp::BuildPieces()
{
    if (BuiltKind == Kind && BuiltVariant == Variant) return;
    for (UStaticMeshComponent* Piece : PropPieces) if (Piece) Piece->DestroyComponent();
    PropPieces.Reset();
    BuiltKind = Kind;
    BuiltVariant = Variant;
    const auto AddPiece = [this](UStaticMesh* Mesh, const FVector& Offset, const FVector& Size, const TCHAR* MaterialName, bool bShadow)
    {
        if (!Mesh) return;
        UStaticMeshComponent* Piece = NewObject<UStaticMeshComponent>(this);
        Piece->SetupAttachment(PropRoot);
        Piece->SetStaticMesh(Mesh);
        // Engine basic shapes are 100 cm and centred on their pivot.
        Piece->SetRelativeLocation(Offset);
        Piece->SetRelativeScale3D(Size/100.);
        Piece->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Piece->SetGenerateOverlapEvents(false);
        Piece->SetCanEverAffectNavigation(false);
        Piece->SetCastShadow(bShadow);
        Piece->SetCullDistance(7000.f);
        if (UMaterialInterface* Material = TraceMaterial(MaterialName)) Piece->SetMaterial(0,Material);
        Piece->RegisterComponent();
        PropPieces.Add(Piece);
    };
    switch (Kind)
    {
    case KindRecycling:
    {
        // A 360 L wheeled recycling bin: the older green model, or the newer blue one.
        const TCHAR* Paint = Variant ? TEXT("M_Roof") : TEXT("M_Sage");
        AddPiece(CubeMesh,FVector(0.,0.,57.),FVector(70.,62.,98.),Paint,true);
        AddPiece(CubeMesh,FVector(-2.,0.,108.5),FVector(76.,66.,5.),Paint,false);
        AddPiece(CubeMesh,FVector(-28.,0.,7.),FVector(14.,66.,14.),TEXT("M_Dark"),false);
        break;
    }
    case KindCompost:
        // The borough's brown organics bin.
        AddPiece(CubeMesh,FVector(0.,0.,51.),FVector(56.,50.,86.),TEXT("M_Wood"),true);
        AddPiece(CubeMesh,FVector(-2.,0.,96.5),FVector(60.,54.,5.),TEXT("M_Wood"),false);
        AddPiece(CubeMesh,FVector(-22.,0.,6.),FVector(12.,54.,12.),TEXT("M_Dark"),false);
        break;
    case KindBarricade:
        // A work-zone barricade: an orange board with a white stripe on two legs, across the prop's facing.
        AddPiece(CubeMesh,FVector(0.,0.,82.),FVector(6.,120.,22.),TEXT("M_Ochre"),true);
        AddPiece(CubeMesh,FVector(0.,0.,82.),FVector(6.5,121.,7.),TEXT("M_White"),false);
        AddPiece(CubeMesh,FVector(0.,-50.,40.),FVector(4.,4.,80.),TEXT("M_White"),false);
        AddPiece(CubeMesh,FVector(0.,50.,40.),FVector(4.,4.,80.),TEXT("M_White"),false);
        AddPiece(CubeMesh,FVector(0.,0.,3.),FVector(40.,110.,6.),TEXT("M_Dark"),false);
        break;
    default:
        // A 70 cm Quebec road cone on a square black base, with a reflective band.
        AddPiece(CubeMesh,FVector(0.,0.,2.),FVector(40.,40.,4.),TEXT("M_Dark"),false);
        AddPiece(ConeMesh,FVector(0.,0.,39.),FVector(34.,34.,70.),TEXT("M_Ochre"),true);
        AddPiece(CylinderMesh,FVector(0.,0.,32.),FVector(23.,23.,7.),TEXT("M_White"),false);
        break;
    }
}

void AQuebecStreetProp::ApplyPose(float ServerTime)
{
    if (!IsKnocked())
    {
        SetActorLocationAndRotation(FVector(Home),FRotator(0.,HomeYaw,0.));
        return;
    }
    const FTracePropShape Shape = TracePropShape(Kind);
    const QuebecTrafficModel::FTumble Pose = QuebecTrafficModel::Tumble(ServerTime-KnockedAt,Shape.Apex);
    const FVector Push = FRotator(0.,TumbleYaw,0.).Vector();
    FVector Point = FMath::Lerp(FVector(Home),FVector(RestPoint),double(Pose.Travel));
    // Lying on a side lifts the base pivot so the body rests on the ground instead of sinking into it.
    Point.Z += Pose.Height+Shape.Lift*Pose.Tip/90.f;
    // Tipping about the horizontal axis across the push moves the top toward the push.
    const FQuat Tip(FVector::CrossProduct(FVector::UpVector,Push),FMath::DegreesToRadians(Pose.Tip));
    const FQuat Turn(FVector::UpVector,FMath::DegreesToRadians(HomeYaw+TumbleSpin*Pose.Spin));
    SetActorLocationAndRotation(Point,Tip*Turn);
}

bool AQuebecStreetProp::Knock(const FVector& CarVelocity, const FVector& CarCenter, const AActor* Striker)
{
    UWorld* PropWorld = GetWorld();
    if (!PropWorld || !HasAuthority() || IsKnocked()) return false;
    const FVector Start = FVector(Home);
    const FVector Away = (Start-CarCenter).GetSafeNormal2D();
    FVector Push = CarVelocity.GetSafeNormal2D();
    // Mostly along the car's travel, thrown a little to the side the prop was on.
    Push = Push.IsNearlyZero() ? Away : (Push+(Away-Push*FVector::DotProduct(Away,Push))*.6).GetSafeNormal2D();
    if (Push.IsNearlyZero()) Push = FRotator(0.,HomeYaw,0.).Vector();
    FVector Rest = Start+Push*QuebecTrafficModel::KnockTravel(float(CarVelocity.Size2D()),TracePropShape(Kind).Mass);
    // Walls, parked cars and people stop the flight; the low curb does not.
    FCollisionQueryParams Query(SCENE_QUERY_STAT(QuebecPropFlight),false,this);
    if (Striker) Query.AddIgnoredActor(Striker);
    FCollisionObjectQueryParams Solid;
    Solid.AddObjectTypesToQuery(ECC_WorldStatic);
    Solid.AddObjectTypesToQuery(ECC_Pawn);
    FHitResult Hit;
    if (PropWorld->SweepSingleByObjectType(Hit,Start+FVector(0.,0.,60.),Rest+FVector(0.,0.,60.),FQuat::Identity,Solid,FCollisionShape::MakeSphere(25.f),Query))
        Rest = Hit.bStartPenetrating ? Start : Hit.Location-FVector(0.,0.,60.)-Push*10.;
    float GroundZ = float(Start.Z);
    QuebecStreet::GroundAt(PropWorld,Rest,GroundZ);
    Rest.Z = GroundZ;
    RestPoint = Rest;
    TumbleYaw = float(Push.Rotation().Yaw);
    TumbleSpin = (GetUniqueID()%2 ? 1.f : -1.f)*(120.f+30.f*float(GetUniqueID()%7));
    KnockedAt = FMath::Max(ServerNow(),0.f);
    ResetDeferrals = 0;
    SetActorTickEnabled(true);
    ApplyPose(KnockedAt);
    ForceNetUpdate();
    GetWorldTimerManager().SetTimer(PropResetTimer,this,&AQuebecStreetProp::ResetProp,QuebecTrafficModel::PropReset,false);
    return true;
}

void AQuebecStreetProp::ResetProp()
{
    if (!HasAuthority()) return;
    // Never stand up under a player: wait a little while someone is close, then reset anyway.
    if (ResetDeferrals < 6)
        for (TActorIterator<APawn> It(GetWorld()); It; ++It)
            if (It->IsPlayerControlled() && FVector::DistSquared2D(It->GetActorLocation(),FVector(Home)) < FMath::Square(1500.))
            {
                ++ResetDeferrals;
                GetWorldTimerManager().SetTimer(PropResetTimer,this,&AQuebecStreetProp::ResetProp,10.f,false);
                return;
            }
    ResetDeferrals = 0;
    KnockedAt = -1.f;
    SetActorTickEnabled(false);
    ApplyPose(ServerNow());
    ForceNetUpdate();
}

void AQuebecStreetProp::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const float Now = ServerNow();
    ApplyPose(Now);
    if (!IsKnocked() || QuebecTrafficModel::TumbleDone(Now-KnockedAt)) SetActorTickEnabled(false);
}

void AQuebecStreetProp::OnRep_Kind() { if (HasActorBegunPlay()) BuildPieces(); }

void AQuebecStreetProp::OnRep_Knock()
{
    ApplyPose(ServerNow());
    SetActorTickEnabled(IsKnocked());
}

AQuebecStreetProp* AQuebecStreetProp::SpawnProp(UWorld* World, uint8 NewKind, const FVector& Ground, float Yaw, uint8 NewVariant)
{
    if (!World) return nullptr;
    const FTransform Placement(FRotator(0.,Yaw,0.),Ground);
    AQuebecStreetProp* Prop = World->SpawnActorDeferred<AQuebecStreetProp>(AQuebecStreetProp::StaticClass(),Placement,nullptr,nullptr,
        ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
    if (!Prop) return nullptr;
    Prop->Kind = NewKind;
    Prop->Variant = NewVariant;
    Prop->Home = Ground;
    Prop->HomeYaw = Yaw;
    Prop->Tags.Add(TEXT("StreetProp"));
    Prop->FinishSpawning(Placement);
    // A world that has not begun play skips PostInitializeComponents; joining twice is harmless.
    Prop->RegisterStreetProp();
    return Prop;
}

int32 AQuebecStreetProp::SpawnStreetProps(UWorld* World)
{
    if (!World || World->GetNetMode() == NM_Client || QuebecDistrict::IsToronto(World)) return 0;
    constexpr int32 ZoneGoal = 2, BinPairGoal = 18, ZoneProps = 12;
    // Long surveyed streets, nearest the spawn first, so players meet the props on their first walk.
    TArray<int32> Roads;
    for (int32 I = 0; I < UE_ARRAY_COUNT(LaFontaine::RoadSegments); ++I)
        if (FVector::Dist2D(LaFontaine::RoadSegments[I][0],LaFontaine::RoadSegments[I][1]) >= 2600.) Roads.Add(I);
    const FVector Anchor = LaFontaine::Spawn;
    Roads.Sort([&Anchor](int32 Left, int32 Right)
    {
        return FVector::DistSquared2D(FMath::ClosestPointOnSegment(Anchor,LaFontaine::RoadSegments[Left][0],LaFontaine::RoadSegments[Left][1]),Anchor) <
            FVector::DistSquared2D(FMath::ClosestPointOnSegment(Anchor,LaFontaine::RoadSegments[Right][0],LaFontaine::RoadSegments[Right][1]),Anchor);
    });
    TArray<FVector> Placed;
    TArray<FVector> ZoneCentres;
    const auto Clear = [World,&Placed](const FVector& Ground, float Radius)
    {
        for (const FVector& Other : Placed) if (FVector::DistSquared2D(Other,Ground) < FMath::Square(Radius+60.)) return false;
        // Parked cars, walls, posts, trees and people block a spot; road surfaces and the curb under it do not.
        FCollisionQueryParams Query(SCENE_QUERY_STAT(QuebecPropSpace),false);
        return !World->OverlapBlockingTestByChannel(Ground+FVector(0.,0.,75.),FQuat::Identity,ECC_Pawn,
            FCollisionShape::MakeBox(FVector(Radius,Radius,55.)),Query);
    };
    int32 Zones = 0, BinPairs = 0, Count = 0;
    for (int32 Road : Roads)
    {
        if (Count >= MaxProps || (Zones >= ZoneGoal && BinPairs >= BinPairGoal)) break;
        const FVector Start = LaFontaine::RoadSegments[Road][0], End = LaFontaine::RoadSegments[Road][1];
        const FVector Direction = (End-Start).GetSafeNormal2D();
        const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
        const float Length = float(FVector::Dist2D(Start,End));
        const FVector Middle = Start+Direction*(Length*.5);
        if (FVector::Dist2D(Middle,Anchor) < 1500.) continue;
        float RoadZ = 0.f;
        if (!QuebecStreet::GroundAt(World,Middle,RoadZ)) continue;
        for (const float Side : {1.f,-1.f})
        {
            // Both kinds of prop stand where the curb lane allows parking, so a curb is there.
            if (!(LaFontaine::RoadParkingSides[Road] & (Side < 0.f ? 1 : 2))) continue;
            const FVector Outward = Right*Side;
            float Edge = 0.f;
            bool bNearZone = false;
            for (const FVector& Centre : ZoneCentres) bNearZone |= FVector::DistSquared2D(Centre,Middle) < FMath::Square(10000.);
            // A 'chantier': ten cones fence 10 m of parking lane, with a barricade at each end. The lane edge stays
            // clear of passing traffic's sweep box (lane centre 145 cm plus 110 cm plus 30 cm).
            if (Zones < ZoneGoal && !bNearZone && Length >= 3200.f && Count+ZoneProps <= MaxProps &&
                QuebecStreet::FindCurb(World,Middle,Direction,Outward,Edge) && Edge-250.f >= 285.f)
            {
                struct FZoneProp { uint8 PropKind; float Along; float Lateral; float Yaw; };
                TArray<FZoneProp> Plan;
                for (int32 I = 0; I < 7; ++I) Plan.Add({KindCone,-450.f+150.f*I,Edge-230.f,37.f*I});
                Plan.Add({KindCone,-620.f,Edge-140.f,11.f});
                Plan.Add({KindCone,620.f,Edge-140.f,73.f});
                Plan.Add({KindCone,-760.f,Edge-60.f,29.f});
                Plan.Add({KindBarricade,-520.f,Edge-120.f,0.f});
                Plan.Add({KindBarricade,520.f,Edge-120.f,0.f});
                TArray<FVector> Spots;
                for (const FZoneProp& Item : Plan)
                {
                    FVector Spot = Middle+Direction*Item.Along+Outward*Item.Lateral;
                    float SpotZ = 0.f;
                    if (!QuebecStreet::GroundAt(World,Spot,SpotZ) || FMath::Abs(SpotZ-RoadZ) > 8.f) break;
                    Spot.Z = SpotZ;
                    if (!Clear(Spot,TracePropShape(Item.PropKind).Radius)) break;
                    Spots.Add(Spot);
                }
                if (Spots.Num() == Plan.Num())
                {
                    const float RoadYaw = float(Direction.Rotation().Yaw);
                    for (int32 I = 0; I < Plan.Num(); ++I)
                        if (SpawnProp(World,Plan[I].PropKind,Spots[I],RoadYaw+Plan[I].Yaw)) { Placed.Add(Spots[I]); ++Count; }
                    ZoneCentres.Add(Middle);
                    ++Zones;
                    continue;
                }
            }
            // Collection day: a green or blue recycling bin and a brown organics bin side by side at the curb,
            // their fronts to the street.
            if (BinPairs >= BinPairGoal || Count+2 > MaxProps) continue;
            const FVector Kerb = Start+Direction*(Length*(Road%2 ? .3f : .7f));
            if (!QuebecStreet::FindCurb(World,Kerb,Direction,Outward,Edge)) continue;
            const FVector Pair = Kerb+Outward*(Edge+50.f);
            FVector Spots[2] = {Pair-Direction*45.,Pair+Direction*45.};
            bool bFits = true;
            for (FVector& Spot : Spots)
            {
                float SpotZ = 0.f;
                bFits = bFits && QuebecStreet::GroundAt(World,Spot,SpotZ) && SpotZ-RoadZ >= 12.f && SpotZ-RoadZ <= 32.f;
                if (!bFits) break;
                Spot.Z = SpotZ;
                bFits = Clear(Spot,40.f);
            }
            if (!bFits) continue;
            const float Facing = float((-Outward).Rotation().Yaw);
            if (SpawnProp(World,KindRecycling,Spots[0],Facing,uint8((Road+BinPairs)%3 == 0 ? 1 : 0))) { Placed.Add(Spots[0]); ++Count; }
            if (SpawnProp(World,KindCompost,Spots[1],Facing+4.f)) { Placed.Add(Spots[1]); ++Count; }
            ++BinPairs;
        }
    }
    UE_LOG(LogTemp,Display,TEXT("NORD_TRACES street_props=%d chantiers=%d bin_pairs=%d"),Count,Zones,BinPairs);
    return Count;
}

AQuebecTraceMarks::AQuebecTraceMarks()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 1.f;
    bReplicates = false;
    MarkInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("TyreMarks"));
    RootComponent = MarkInstances;
    MarkInstances->SetMobility(EComponentMobility::Movable);
    MarkInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    MarkInstances->SetGenerateOverlapEvents(false);
    MarkInstances->SetCanEverAffectNavigation(false);
    MarkInstances->SetCastShadow(false);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Plane(TEXT("/Engine/BasicShapes/Plane.Plane"));
    if (Plane.Succeeded()) MarkInstances->SetStaticMesh(Plane.Object);
}

AQuebecTraceMarks* AQuebecTraceMarks::Get(UWorld* World, bool bCreate)
{
    if (!World || !World->IsGameWorld() || World->GetNetMode() == NM_DedicatedServer) return nullptr;
    if (const TWeakObjectPtr<AQuebecTraceMarks>* Known = TraceMarkLayers.Find(World))
    {
        if (Known->IsValid()) return Known->Get();
        TraceMarkLayers.Remove(World);
    }
    if (!bCreate) return nullptr;
    for (auto It = TraceMarkLayers.CreateIterator(); It; ++It) if (!It.Key().IsValid() || !It.Value().IsValid()) It.RemoveCurrent();
    FActorSpawnParameters Parameters;
    Parameters.ObjectFlags |= RF_Transient;
    Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecTraceMarks* Layer = World->SpawnActor<AQuebecTraceMarks>(FVector::ZeroVector,FRotator::ZeroRotator,Parameters);
    if (!Layer) return nullptr;
    // Near-black rubber on the asphalt; the planes cast no shadow and the layer culls with distance.
    if (UMaterialInterface* Rubber = TraceMaterial(TEXT("M_Dark"))) Layer->MarkInstances->SetMaterial(0,Rubber);
    Layer->MarkInstances->SetCullDistances(0,9000);
    TraceMarkLayers.Add(World,Layer);
    return Layer;
}

float AQuebecTraceMarks::WorldNow() const { return GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f; }

int32 AQuebecTraceMarks::GetMarkCount() const { return MarkInstances->GetInstanceCount(); }

int32 AQuebecTraceMarks::GetVisibleMarkCount() const { return Ring.Live(WorldNow()); }

void AQuebecTraceMarks::ShowMark(int32 Slot, float Width)
{
    if (!MarkShapes.IsValidIndex(Slot) || Slot >= MarkInstances->GetInstanceCount()) return;
    MarkShownScale[Slot] = Width;
    FTransform Shape = MarkShapes[Slot];
    if (Width <= 0.f) Shape = FTransform(FQuat::Identity,Shape.GetLocation()-FVector(0.,0.,500.),FVector(.001));
    else Shape.SetScale3D(Shape.GetScale3D()*FVector(1.,Width,1.));
    MarkInstances->UpdateInstanceTransform(Slot,Shape,true,false,true);
}

void AQuebecTraceMarks::LayMark(const FVector& From, const FVector& To, const FVector& Normal)
{
    const FVector Up = Normal.GetSafeNormal(UE_SMALL_NUMBER,FVector::UpVector);
    const FVector Span = FVector::VectorPlaneProject(To-From,Up);
    const double Length = Span.Size();
    if (Length < 1.) return;
    // The engine plane is 100 cm square, centred, facing +Z; lift it 1.5 cm off the road against z-fighting.
    const FTransform Shape(FRotationMatrix::MakeFromXZ(Span,Up).Rotator(),(From+To)*.5+Up*1.5,
        FVector(Length/100.+.08,QuebecTrafficModel::MarkWidth/100.,1.));
    const int32 Slot = Ring.Claim(WorldNow());
    if (MarkShapes.Num() <= Slot) { MarkShapes.SetNum(Slot+1); MarkShownScale.SetNum(Slot+1); }
    MarkShapes[Slot] = Shape;
    MarkShownScale[Slot] = 1.f;
    if (Slot >= MarkInstances->GetInstanceCount()) MarkInstances->AddInstance(Shape,true);
    else MarkInstances->UpdateInstanceTransform(Slot,Shape,true,true,true);
}

void AQuebecTraceMarks::TrackCar(AQuebecCar* Car, float DeltaSeconds)
{
    FQuebecTyreTrail& Trail = Trails.FindOrAdd(Car);
    const float Forward = FMath::Abs(Car->Speed);
    const float Raw = DeltaSeconds > UE_SMALL_NUMBER ? (Trail.LastSpeed-Forward)/DeltaSeconds : 0.f;
    Trail.Deceleration = QuebecTrafficModel::FilterDeceleration(Trail.Deceleration,Raw,DeltaSeconds);
    Trail.LastSpeed = Forward;
    if (!QuebecTrafficModel::IsSkidding(Car->Speed,Car->LateralSpeed,Car->bHandbrake,Trail.Deceleration,Car->bTraffic))
    {
        Trail.bWheel[0] = Trail.bWheel[1] = false;
        return;
    }
    const FTransform Body = Car->GetActorTransform();
    for (int32 Side = 0; Side < 2; ++Side)
    {
        // Rear tyres, which lock under the handbrake and lead a slide.
        const FVector Wheel = Body.TransformPosition(FVector(-155.,Side ? 95. : -95.,-60.));
        const double Moved = Trail.bWheel[Side] ? FVector::Dist2D(Trail.Wheel[Side],Wheel) : 0.;
        if (Trail.bWheel[Side] && Moved < QuebecTrafficModel::MarkMinLength) continue;
        FVector Ground, Normal;
        if (!TraceTyreGround(Car,Wheel,Ground,Normal)) { Trail.bWheel[Side] = false; continue; }
        if (Trail.bWheel[Side] && Moved <= QuebecTrafficModel::MarkMaxLength) LayMark(Trail.Wheel[Side],Ground,Normal);
        Trail.Wheel[Side] = Ground;
        Trail.bWheel[Side] = true;
    }
}

void AQuebecTraceMarks::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const float Now = WorldNow();
    bool bChanged = false;
    for (int32 Slot = 0; Slot < Ring.Count && Slot < MarkShapes.Num(); ++Slot)
    {
        // Narrow in fifths and hide each mark once, so an idle pool costs almost nothing.
        const float Width = Ring.Scale(Slot,Now);
        const float Shown = Width <= 0.f ? 0.f : FMath::CeilToFloat(Width*5.f)/5.f;
        if (Shown == MarkShownScale[Slot]) continue;
        ShowMark(Slot,Shown);
        bChanged = true;
    }
    if (bChanged) MarkInstances->MarkRenderStateDirty();
    for (auto It = Trails.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
}

void QuebecTraces::TickCar(AQuebecCar* Car, float DeltaSeconds)
{
    if (!Car || !FMath::IsFinite(DeltaSeconds) || DeltaSeconds <= 0.f) return;
    // Slow cars only end their streaks; the layer is created by the first car fast enough to mark the road.
    const bool bFast = FMath::Abs(Car->Speed) > 150.f || FMath::Abs(Car->LateralSpeed) > 150.f;
    if (AQuebecTraceMarks* Layer = AQuebecTraceMarks::Get(Car->GetWorld(),bFast)) Layer->TrackCar(Car,DeltaSeconds);
}

void QuebecTraces::StrikeProps(AQuebecCar* Car, const FVector& From, const FVector& To, float Speed)
{
    if (!Car || !Car->HasAuthority() || FMath::Abs(Speed) < 120.f) return;
    const FVector Forward = Car->GetActorForwardVector().GetSafeNormal2D();
    const FVector Velocity = Car->PlanarVelocity().IsNearlyZero() ? (To-From).GetSafeNormal2D()*Speed : Car->PlanarVelocity();
    const TArray<TWeakObjectPtr<AQuebecStreetProp>>* Listed = StreetPropLists.Find(Car->GetWorld());
    if (!Listed) return;
    // A copy: knocking a prop never spawns, but the list must not change under the loop.
    const TArray<TWeakObjectPtr<AQuebecStreetProp>> Props = *Listed;
    for (const TWeakObjectPtr<AQuebecStreetProp>& Entry : Props)
    {
        AQuebecStreetProp* Prop = Entry.Get();
        if (!Prop || Prop->IsKnocked()) continue;
        const FVector Base = Prop->GetActorLocation();
        if (FVector::DistSquared2D(Base,To) > FMath::Square(800.) || FMath::Abs(To.Z-Base.Z) > 260.) continue;
        // The body box (4.6 x 2.0 m) swept over the step; positions relative to the prop's base.
        const FVector Begin = From-Base, Finish = To-Base;
        if (QuebecTrafficModel::SweptBoxTouches(float(Begin.X),float(Begin.Y),float(Finish.X),float(Finish.Y),float(Forward.X),float(Forward.Y),
            230.f,100.f,Prop->StrikeRadius()))
            Prop->Knock(Velocity,To,Car);
    }
}
