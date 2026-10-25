#include "QuebecParkedCars.h"
#include "QuebecGameplay.h"
#include "QuebecParkedRules.h"
#include "QuebecTraces.h"
#include "LaFontaineParking.h"

#include "CollisionQueryParams.h"
#include "CollisionShape.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Net/UnrealNetwork.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

using namespace QuebecParkedRules;

namespace
{
    // The fill of the world that last began play; Find falls back to an actor search.
    TWeakObjectPtr<AQuebecParkedCars> KnownFill;
    // A promoted car keeps this tag, never CityParked or CityTraffic: the population checks count those.
    const FName ParkedSlotTag(TEXT("ParkedSlot"));
    // The replica's own asphalt under a space, at the road height the slots were measured on (plateau_parking.py).
    constexpr double RoadSlack = 3.;

    FTransform HiddenTransform(const FTransform& Shown)
    {
        // As AQuebecTraceMarks hides a mark: shrunk and sunk, so the instance keeps its index.
        return FTransform(FQuat::Identity, Shown.GetLocation() - FVector(0., 0., 500.), FVector(.001));
    }

    UStaticMesh* CarMesh(const TCHAR* Name)
    {
        return LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("/Game/ParkComic/SM_%s.SM_%s"), Name, Name));
    }
}

AQuebecParkedCars::AQuebecParkedCars()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetNetUpdateFrequency(2.f);
    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    Root->SetMobility(EComponentMobility::Static);
    RootComponent = Root;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    BoxMesh = Cube.Object;
}

void AQuebecParkedCars::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecParkedCars, VacantSlots);
    DOREPLIFETIME(AQuebecParkedCars, PromotedSlots);
}

AQuebecParkedCars* AQuebecParkedCars::Find(const UWorld* World)
{
    if (!World) return nullptr;
    if (AQuebecParkedCars* Known = KnownFill.Get(); Known && Known->GetWorld() == World) return Known;
    for (TActorIterator<AQuebecParkedCars> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { KnownFill = *It; return *It; }
    return nullptr;
}

AQuebecParkedCars* AQuebecParkedCars::SpawnFill(UWorld* World)
{
    if (!World || World->GetNetMode() == NM_Client || QuebecDistrict::IsToronto(World)) return nullptr;
    if (FParse::Param(FCommandLine::Get(), TEXT("NordNoParkedFill"))) return nullptr;
    if (AQuebecParkedCars* Existing = Find(World)) return Existing;
    FActorSpawnParameters Parameters;
    Parameters.ObjectFlags |= RF_Transient;
    Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    return World->SpawnActor<AQuebecParkedCars>(FVector::ZeroVector, FRotator::ZeroRotator, Parameters);
}

void AQuebecParkedCars::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    KnownFill = this;
    PrepareSlots();
    // The server leaves out the spaces that are taken before its own boxes exist; clients learn them by replication.
    if (HasAuthority()) FindVacancies();
    Build();
    ApplyHidden();
    if (HasAuthority())
        GetWorldTimerManager().SetTimer(RecycleTimer, this, &AQuebecParkedCars::Recycle, RecycleSeconds, true, RecycleSeconds);
    UE_LOG(LogTemp, Display, TEXT("NORD_PARKED slots=%d shown=%d vacant=%d components=%d cull_cm=%d/%d/%d"),
        SlotTransforms.Num(), GetShownCount(), VacantSlots.Num(), GetPartComponentCount(), BodyCullEnd, TireCullEnd, RimCullEnd);
}

void AQuebecParkedCars::PrepareSlots()
{
    const int32 Count = LaFontaineParking::SlotCount;
    SlotTransforms.SetNum(Count);
    for (int32 Slot = 0; Slot < Count; ++Slot)
    {
        const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[Slot];
        SlotTransforms[Slot] = FTransform(FRotator(0., Row.Yaw, 0.), FVector(Row.X, Row.Y, Row.Z + PivotHeight));
    }
}

void AQuebecParkedCars::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    GetWorldTimerManager().ClearTimer(RecycleTimer);
    GetWorldTimerManager().ClearTimer(PendingTimer);
    if (KnownFill.Get() == this) KnownFill.Reset();
    Super::EndPlay(EndPlayReason);
}

void AQuebecParkedCars::FindVacancies()
{
    // A space is taken when the replica's asphalt is not under it, or anything that blocks a pawn stands in it: the
    // starter, a saved or runtime car, a scooter, a post. The street props (the cones and barricades of a chantier,
    // the curb bins) have no collision, so their homes are read instead.
    VacantSlots.Reset();
    FCollisionQueryParams Floor(SCENE_QUERY_STAT(ParkedFloor), true, this);
    FCollisionQueryParams Space(SCENE_QUERY_STAT(ParkedSpace), false, this);
    const FCollisionShape Box = FCollisionShape::MakeBox(FVector(BoxHalfX - 5., BoxHalfY - 5., BoxHalfZ - 5.));
    const TArray<TPair<FVector, float>> Props = StreetPropHomes();
    for (int32 Slot = 0; Slot < SlotTransforms.Num(); ++Slot)
    {
        const FTransform& Pivot = SlotTransforms[Slot];
        const FVector Road = Pivot.GetLocation() - FVector(0., 0., PivotHeight);
        FHitResult Hit;
        bool bFree = GetWorld()->LineTraceSingleByChannel(Hit, Road + FVector(0., 0., 300.), Road - FVector(0., 0., 300.), ECC_Visibility, Floor);
        const UStaticMeshComponent* Surface = bFree ? Cast<UStaticMeshComponent>(Hit.GetComponent()) : nullptr;
        const UStaticMesh* Mesh = Surface ? Surface->GetStaticMesh() : nullptr;
        bFree = Mesh && Mesh->GetName().StartsWith(TEXT("SM_Asphalt_Replica")) && FMath::Abs(Hit.ImpactPoint.Z - Road.Z) <= RoadSlack &&
            !GetWorld()->OverlapBlockingTestByChannel(Pivot.TransformPosition(FVector(0., 0., BoxCentreZ)), Pivot.GetRotation(), ECC_Pawn, Box, Space);
        if (!bFree || PropTakes(Pivot, Props)) VacantSlots.Add(Slot);
    }
}

TArray<TPair<FVector, float>> AQuebecParkedCars::StreetPropHomes() const
{
    TArray<TPair<FVector, float>> Props;
    for (TActorIterator<AQuebecStreetProp> It(GetWorld()); It; ++It)
        if (IsValid(*It)) Props.Emplace(FVector(It->Home), It->StrikeRadius());
    return Props;
}

bool AQuebecParkedCars::PropTakes(const FTransform& Pivot, const TArray<TPair<FVector, float>>& Props)
{
    for (const TPair<FVector, float>& Prop : Props)
    {
        const FVector Local = Pivot.InverseTransformPosition(Prop.Key);
        if (PropInSpace(static_cast<float>(Local.X), static_cast<float>(Local.Y), Prop.Value)) return true;
    }
    return false;
}

void AQuebecParkedCars::Build()
{
    if (bBuilt) return;
    bBuilt = true;
    const int32 Count = SlotTransforms.Num();
    Shown.Init(true, Count);
    PromotedCars.SetNum(Count);
    PromotedAt.Init(0.f, Count);
    Parts.SetNum(Count);
    // The meshes and paints AQuebecCar::ApplyPaint gives a car of each body and paint.
    UStaticMesh* Meshes[VisibleGroups] = {};
    UMaterialInterface* Paint[Paints] = {};
    for (int32 Style = 0; Style < Paints; ++Style)
        Paint[Style] = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/ParkComic/M_Car70_Paint%d.M_Car70_Paint%d"), Style, Style));
    for (int32 Body = 0; Body < Bodies; ++Body)
    {
        UStaticMesh* Shell = CarMesh(*FString::Printf(TEXT("Car70Body%d"), Body));
        UStaticMesh* Roof = CarMesh(*FString::Printf(TEXT("Car70Roof%d"), Body));
        for (int32 Style = 0; Style < Paints; ++Style)
        {
            Meshes[BodyGroup(Body, Style)] = Shell;
            Meshes[RoofGroup(Body, Style)] = Roof;
        }
        Meshes[CabinGroup(Body)] = CarMesh(*FString::Printf(TEXT("Car70Cabin%d"), Body));
    }
    Meshes[TireGroup] = CarMesh(TEXT("Car70Tire"));
    Meshes[RimGroup] = CarMesh(TEXT("Car70Rim"));
    for (UStaticMesh* Mesh : Meshes)
        if (!Mesh || !BoxMesh)
        {
            UE_LOG(LogTemp, Warning, TEXT("NORD_PARKED the Car70 meshes are missing; the curbs stay empty"));
            Shown.Init(false, Count);
            return;
        }
    // The tiles, in the order their first space appears; each holds its own part groups and boxes.
    TMap<int32, int32> TileOfKey;
    for (int32 Slot = 0; Slot < Count; ++Slot)
    {
        const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[Slot];
        const int32 Key = TileKey(Row.X, Row.Y);
        if (!TileOfKey.Contains(Key)) TileOfKey.Add(Key, TileOfKey.Num());
    }
    const int32 TileCount = TileOfKey.Num();
    TArray<TArray<FTransform>> Transforms;
    Transforms.SetNum(TileCount * VisibleGroups);
    TArray<TArray<FTransform>> BoxTransforms;
    BoxTransforms.SetNum(TileCount);
    TileSlots.SetNum(TileCount);
    const TSet<int32> Hidden(VacantSlots);
    for (int32 Slot = 0; Slot < Count; ++Slot)
    {
        const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[Slot];
        const FTransform& Pivot = SlotTransforms[Slot];
        const bool bHide = Hidden.Contains(Slot);
        Shown[Slot] = !bHide;
        const auto Place = [bHide](const FTransform& Transform) { return bHide ? HiddenTransform(Transform) : Transform; };
        FQuebecParkedSlotParts& Where = Parts[Slot];
        Where.Tile = TileOfKey.FindChecked(TileKey(Row.X, Row.Y));
        TArray<FTransform>* Tile = &Transforms[Where.Tile * VisibleGroups];
        Where.BodyGroup = BodyGroup(Row.Body, Row.Paint);
        Where.RoofGroup = RoofGroup(Row.Body, Row.Paint);
        Where.CabinGroup = CabinGroup(Row.Body);
        Where.Body = Tile[Where.BodyGroup].Add(Place(Pivot));
        Where.Roof = Tile[Where.RoofGroup].Add(Place(Pivot));
        Where.Cabin = Tile[Where.CabinGroup].Add(Place(Pivot));
        Where.Tires = Tile[TireGroup].Num();
        Where.Rims = Tile[RimGroup].Num();
        for (int32 Wheel = 0; Wheel < WheelsPerCar; ++Wheel)
        {
            const double X = Wheel < 2 ? WheelX : -WheelX, Side = Wheel % 2 ? 1. : -1.;
            const FRotator Roll(0., 0., WheelRoll);
            Tile[TireGroup].Add(Place(FTransform(Roll, FVector(X, Side * TireY, WheelZ)) * Pivot));
            Tile[RimGroup].Add(Place(FTransform(Roll, FVector(X, Side * RimY, WheelZ)) * Pivot));
        }
        // The Engine cube is 100 cm on a side.
        Where.Box = BoxTransforms[Where.Tile].Add(Place(FTransform(FQuat::Identity, FVector(0., 0., BoxCentreZ),
            FVector(BoxHalfX / 50., BoxHalfY / 50., BoxHalfZ / 50.)) * Pivot));
        TileSlots[Where.Tile].Add(Slot);
    }
    const auto NewGroup = [this](const FString& Name, UStaticMesh* Mesh, EComponentMobility::Type Mobility, bool bDistanceFields)
    {
        UHierarchicalInstancedStaticMeshComponent* Group = NewObject<UHierarchicalInstancedStaticMeshComponent>(this, *Name);
        Group->SetMobility(Mobility);
        Group->SetupAttachment(Root);
        Group->SetStaticMesh(Mesh);
        Group->SetCanEverAffectNavigation(false);
        Group->SetGenerateOverlapEvents(false);
        // Set before the component registers, so its first render state has it.
        Group->bAffectDistanceFieldLighting = bDistanceFields;
        Group->RegisterComponent();
        return Group;
    };
    Groups.Init(nullptr, TileCount * VisibleGroups);
    TileBoxes.Init(nullptr, TileCount);
    for (int32 TileNumber = 0; TileNumber < TileCount; ++TileNumber)
    {
        for (int32 Index = 0; Index < VisibleGroups; ++Index)
        {
            const TArray<FTransform>& Instances = Transforms[TileNumber * VisibleGroups + Index];
            if (!Instances.Num()) continue;
            // Static, so the shadow maps cache the parked cars; a hidden instance moves only when a car is promoted.
            UHierarchicalInstancedStaticMeshComponent* Group = NewGroup(FString::Printf(TEXT("ParkedParts%02d_%02d"), TileNumber, Index),
                Meshes[Index], EComponentMobility::Static, AffectsDistanceFields(Index));
            Group->SetCollisionEnabled(ECollisionEnabled::NoCollision);
            Group->SetCullDistances(CullStart(Index), CullEnd(Index));
            Group->SetCastShadow(CastsShadow(Index));
            // The paint goes on the slots named Paint, as AQuebecCar::ApplyPaint does; the rest keep the mesh's own.
            const int32 Style = Index < FirstCabinGroup ? Index % Paints : INDEX_NONE;
            const TArray<FStaticMaterial>& Materials = Meshes[Index]->GetStaticMaterials();
            for (int32 Slot = 0; Slot < Materials.Num(); ++Slot)
                Group->SetMaterial(Slot, Style != INDEX_NONE && Paint[Style] && Materials[Slot].MaterialSlotName == TEXT("Paint") ?
                    Paint[Style] : Meshes[Index]->GetMaterial(Slot));
            Group->AddInstances(Instances, false, true, false);
            Groups[TileNumber * VisibleGroups + Index] = Group;
        }
        // One box per car. WorldDynamic, as a movable body is: it blocks cars, players and officers (their capsules
        // let Pawn bodies through, so a Pawn box would not stop them). It ignores the Visibility channel, and it is not
        // WorldStatic, so no floor probe and no ground query by object type (a job's goal, a car's wheels, a knocked
        // cone's rest, a person's floor) lands on its roof. It ignores the spring arms too, as the replica props do.
        // Movable, so a promoted car's box leaves as a kinematic body; it is never drawn.
        UHierarchicalInstancedStaticMeshComponent* Boxes = NewGroup(FString::Printf(TEXT("ParkedBoxes%02d"), TileNumber), BoxMesh,
            EComponentMobility::Movable, false);
        Boxes->SetHiddenInGame(true);
        Boxes->SetCastShadow(false);
        Boxes->SetCollisionProfileName(TEXT("BlockAllDynamic"));
        Boxes->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
        Boxes->SetCollisionResponseToChannel(ECC_Visibility, ECR_Ignore);
        Boxes->AddInstances(BoxTransforms[TileNumber], false, true, false);
        TileBoxes[TileNumber] = Boxes;
    }
}

void AQuebecParkedCars::OnRep_Hidden()
{
    ApplyHidden();
}

void AQuebecParkedCars::ApplyHidden()
{
    if (!bBuilt || !TileBoxes.Num()) return;
    TArray<bool> Hide;
    Hide.Init(false, Shown.Num());
    for (int32 Slot : VacantSlots) if (Hide.IsValidIndex(Slot)) Hide[Slot] = true;
    for (int32 Slot : PromotedSlots) if (Hide.IsValidIndex(Slot)) Hide[Slot] = true;
    const bool bServer = HasAuthority();
    const float Now = GetWorld()->GetTimeSeconds();
    for (int32 Slot = 0; Slot < Shown.Num(); ++Slot)
    {
        if (!Hide[Slot] && !Shown[Slot]) SetSlotShown(Slot, true);
        if (!Hide[Slot] || !Shown[Slot]) continue;
        // A client keeps a promoted car drawn until the real car has arrived, so the space never blinks empty. Each
        // space waits from its own promotion, not from the first one still pending.
        if (!bServer && PromotedSlots.Contains(Slot) && !VacantSlots.Contains(Slot))
        {
            if (!PendingHides.ContainsByPredicate([Slot](const FPendingHide& Pending) { return Pending.Slot == Slot; }))
                PendingHides.Add(StartPending(Slot, Now));
        }
        else SetSlotShown(Slot, false);
    }
    PendingHides.RemoveAll([this](const FPendingHide& Pending) { return !PromotedSlots.Contains(Pending.Slot); });
    if (PendingHides.Num() && !GetWorldTimerManager().IsTimerActive(PendingTimer))
        GetWorldTimerManager().SetTimer(PendingTimer, this, &AQuebecParkedCars::FlushPendingHides, .1f, true);
}

void AQuebecParkedCars::FlushPendingHides()
{
    const float Now = GetWorld()->GetTimeSeconds();
    for (int32 Index = PendingHides.Num() - 1; Index >= 0; --Index)
    {
        const FPendingHide Pending = PendingHides[Index];
        const FVector Where = SlotTransforms[Pending.Slot].GetLocation();
        float Nearest = -1.f;
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        {
            const float Distance = static_cast<float>(FVector::Dist(It->GetActorLocation(), Where));
            if (Nearest < 0.f || Distance < Nearest) Nearest = Distance;
        }
        if (!PendingHideNow(Pending, Nearest, Now)) continue;
        SetSlotShown(Pending.Slot, false);
        PendingHides.RemoveAt(Index);
    }
    if (!PendingHides.Num()) GetWorldTimerManager().ClearTimer(PendingTimer);
}

UHierarchicalInstancedStaticMeshComponent* AQuebecParkedCars::GroupOf(int32 Tile, int32 Group) const
{
    const int32 Index = Tile * VisibleGroups + Group;
    return Groups.IsValidIndex(Index) ? Groups[Index].Get() : nullptr;
}

void AQuebecParkedCars::SetSlotShown(int32 Slot, bool bShow)
{
    if (!Shown.IsValidIndex(Slot) || Shown[Slot] == bShow || !Parts.IsValidIndex(Slot)) return;
    const FQuebecParkedSlotParts& Where = Parts[Slot];
    if (!TileBoxes.IsValidIndex(Where.Tile) || !TileBoxes[Where.Tile]) return;
    Shown[Slot] = bShow;
    const FTransform& Pivot = SlotTransforms[Slot];
    // Only the components of the space's own tile change, so the rebuild stays local.
    const auto Put = [bShow](UHierarchicalInstancedStaticMeshComponent* Group, int32 Instance, const FTransform& Transform)
    {
        if (Group) Group->UpdateInstanceTransform(Instance, bShow ? Transform : HiddenTransform(Transform), true, true, true);
    };
    Put(GroupOf(Where.Tile, Where.BodyGroup), Where.Body, Pivot);
    Put(GroupOf(Where.Tile, Where.RoofGroup), Where.Roof, Pivot);
    Put(GroupOf(Where.Tile, Where.CabinGroup), Where.Cabin, Pivot);
    for (int32 Wheel = 0; Wheel < WheelsPerCar; ++Wheel)
    {
        const double X = Wheel < 2 ? WheelX : -WheelX, Side = Wheel % 2 ? 1. : -1.;
        const FRotator Roll(0., 0., WheelRoll);
        Put(GroupOf(Where.Tile, TireGroup), Where.Tires + Wheel, FTransform(Roll, FVector(X, Side * TireY, WheelZ)) * Pivot);
        Put(GroupOf(Where.Tile, RimGroup), Where.Rims + Wheel, FTransform(Roll, FVector(X, Side * RimY, WheelZ)) * Pivot);
    }
    Put(TileBoxes[Where.Tile], Where.Box,
        FTransform(FQuat::Identity, FVector(0., 0., BoxCentreZ), FVector(BoxHalfX / 50., BoxHalfY / 50., BoxHalfZ / 50.)) * Pivot);
}

int32 AQuebecParkedCars::SlotOfHit(const UPrimitiveComponent* Component, int32 Item) const
{
    if (!Component) return INDEX_NONE;
    for (int32 Tile = 0; Tile < TileBoxes.Num(); ++Tile)
        if (TileBoxes[Tile] == Component)
        {
            const int32 Slot = TileSlots.IsValidIndex(Tile) && TileSlots[Tile].IsValidIndex(Item) ? TileSlots[Tile][Item] : INDEX_NONE;
            return Shown.IsValidIndex(Slot) && Shown[Slot] ? Slot : INDEX_NONE;
        }
    return INDEX_NONE;
}

AQuebecCar* AQuebecParkedCars::Promote(int32 Slot)
{
    if (!HasAuthority() || !bBuilt || !Shown.IsValidIndex(Slot) || !Shown[Slot] || PromotedSlots.Contains(Slot)) return nullptr;
    // Past the cap, promoted cars nobody is near go back first. The cap is soft: a hit near a player always lands.
    if (PromotedSlots.Num() >= LivePromotedCap) Recycle();
    // The box leaves before the car arrives, so the car fits its own space.
    SetSlotShown(Slot, false);
    const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[Slot];
    const FTransform& Transform = SlotTransforms[Slot];
    AQuebecCar* Car = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(), Transform, nullptr, nullptr,
        ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
    if (!Car)
    {
        SetSlotShown(Slot, true);
        return nullptr;
    }
    Car->PaintStyle = Row.Paint;
    Car->BodyProfile = Row.Body;
    Car->Tags.Add(ParkedSlotTag);
    Car->FinishSpawning(Transform);
    PromotedSlots.Add(Slot);
    PromotedCars[Slot] = Car;
    PromotedAt[Slot] = GetWorld()->GetTimeSeconds();
    ForceNetUpdate();
    UE_LOG(LogTemp, Display, TEXT("NORD_PARKED promote slot=%d paint=%d body=%d live=%d"), Slot, Row.Paint, Row.Body, PromotedSlots.Num());
    return Car;
}

AQuebecCar* AQuebecParkedCars::PromoteOnImpact(const FHitResult& Hit, const FVector& StrikerVelocity)
{
    AQuebecParkedCars* Fill = Cast<AQuebecParkedCars>(Hit.GetActor());
    if (!Fill || !Fill->HasAuthority()) return nullptr;
    const int32 Slot = Fill->SlotOfHit(Hit.GetComponent(), Hit.Item);
    // Hit.Normal points from the parked car back at the striker, as AQuebecCar::MoveWithCollision reads it.
    const float Closing = static_cast<float>(-FVector::DotProduct(StrikerVelocity, Hit.Normal.GetSafeNormal2D()));
    return Slot != INDEX_NONE && StrongImpact(Closing, true) ? Fill->Promote(Slot) : nullptr;
}

AQuebecCar* AQuebecParkedCars::PromoteOnShot(const FHitResult& Hit)
{
    AQuebecParkedCars* Fill = Cast<AQuebecParkedCars>(Hit.GetActor());
    if (!Fill || !Fill->HasAuthority()) return nullptr;
    const int32 Slot = Fill->SlotOfHit(Hit.GetComponent(), Hit.Item);
    return Slot != INDEX_NONE ? Fill->Promote(Slot) : nullptr;
}

AQuebecCar* AQuebecParkedCars::PromoteOnBody(const FHitResult& Impact, const FVector& BodyVelocity, const AActor* Body)
{
    // A person thrown into a parked car. The character movement hands over its velocity before it turns it into a
    // slide along the box (UCharacterMovementComponent::HandleImpact calls MoveBlockedBy first); a hit event comes
    // only after the move, when the velocity no longer points at the car.
    AQuebecParkedCars* Fill = Cast<AQuebecParkedCars>(Impact.GetActor());
    if (!Fill || !Fill->HasAuthority() || !Body || Body->IsA<AQuebecCar>()) return nullptr;
    const int32 Slot = Fill->SlotOfHit(Impact.GetComponent(), Impact.Item);
    if (Slot == INDEX_NONE) return nullptr;
    const FVector Planar = BodyVelocity * FVector(1., 1., 0.);
    const FVector Toward = (Fill->SlotTransforms[Slot].GetLocation() - Body->GetActorLocation()).GetSafeNormal2D();
    if (!StrongImpact(static_cast<float>(FVector::DotProduct(Planar, Toward)), false)) return nullptr;
    AQuebecCar* Car = Fill->Promote(Slot);
    if (Car) Car->ReceiveImpact(Planar * PawnMassShare, 0.f, .5f);
    return Car;
}

int32 AQuebecParkedCars::FindSlotOnLine(const FVector& From, const FVector& To, FVector& OutImpact) const
{
    int32 Best = INDEX_NONE;
    float BestEntry = 2.f;
    const FBox Line(From.ComponentMin(To) - FVector(BoxHalfX + 10.), From.ComponentMax(To) + FVector(BoxHalfX + 10.));
    for (int32 Slot = 0; Slot < Shown.Num(); ++Slot)
    {
        if (!Shown[Slot] || !Line.IsInside(SlotTransforms[Slot].GetLocation())) continue;
        const FVector A = SlotTransforms[Slot].InverseTransformPosition(From), B = SlotTransforms[Slot].InverseTransformPosition(To);
        const float Entry = SegmentEntry(static_cast<float>(A.X), static_cast<float>(A.Y), static_cast<float>(A.Z),
            static_cast<float>(B.X), static_cast<float>(B.Y), static_cast<float>(B.Z));
        if (Entry >= 0.f && Entry < BestEntry) { Best = Slot; BestEntry = Entry; }
    }
    if (Best != INDEX_NONE) OutImpact = From + (To - From) * BestEntry;
    return Best;
}

AQuebecCar* AQuebecParkedCars::PromoteOnLine(const UWorld* World, const FVector& From, const FVector& To, FVector& OutImpact)
{
    AQuebecParkedCars* Fill = Find(World);
    if (!Fill || !Fill->HasAuthority()) return nullptr;
    const int32 Slot = Fill->FindSlotOnLine(From, To, OutImpact);
    return Slot != INDEX_NONE ? Fill->Promote(Slot) : nullptr;
}

float AQuebecParkedCars::ThrowAgainst(const UWorld* World, const FVector& From, const FVector& To, float Speed)
{
    AQuebecParkedCars* Fill = Find(World);
    if (!Fill || !Fill->HasAuthority()) return 1.f;
    FVector Impact = FVector::ZeroVector;
    const int32 Slot = Fill->FindSlotOnLine(From, To, Impact);
    const float Reach = static_cast<float>(FVector::Dist(From, To));
    if (Slot == INDEX_NONE || Reach <= 1.f) return 1.f;
    // A hard throw shoves the new car as a body hitting it would (PromoteOnBody); a soft one stops at the car.
    if (StrongImpact(Speed, false))
        if (AQuebecCar* Car = Fill->Promote(Slot))
            Car->ReceiveImpact((To - From).GetSafeNormal2D() * Speed * PawnMassShare, 0.f, .5f);
    return ThrowShare(static_cast<float>(FVector::Dist(From, Impact)) / Reach, Reach);
}

int32 AQuebecParkedCars::FindEnterableSlot(const AActor* Walker, float& OutDistanceSquared) const
{
    OutDistanceSquared = -1.f;
    if (!Walker || !bBuilt) return INDEX_NONE;
    const FVector Here = Walker->GetActorLocation();
    int32 Best = INDEX_NONE;
    double BestDistance = FMath::Square(EnterRadius);
    for (int32 Slot = 0; Slot < Shown.Num(); ++Slot)
    {
        if (!Shown[Slot]) continue;
        const double Distance = FVector::DistSquared(Here, SlotTransforms[Slot].GetLocation());
        if (Distance <= BestDistance) { Best = Slot; BestDistance = Distance; }
    }
    if (Best == INDEX_NONE) return INDEX_NONE;
    // As for a real car, nothing solid may stand between the walker and the car.
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(EnterParkedCar), false, Walker);
    Query.AddIgnoredActor(this);
    if (GetWorld()->LineTraceSingleByChannel(Hit, Here, SlotTransforms[Best].GetLocation(), ECC_Visibility, Query)) return INDEX_NONE;
    OutDistanceSquared = static_cast<float>(BestDistance);
    return Best;
}

float AQuebecParkedCars::NearestPlayerDistance(const FVector& Where) const
{
    float Nearest = TNumericLimits<float>::Max();
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
        if (const APlayerController* Player = It->Get())
            if (const APawn* Pawn = Player->GetPawn())
                Nearest = FMath::Min(Nearest, static_cast<float>(FVector::Dist(Pawn->GetActorLocation(), Where)));
    return Nearest;
}

void AQuebecParkedCars::Recycle()
{
    if (!HasAuthority()) return;
    bool bChanged = false;
    FCollisionQueryParams Space(SCENE_QUERY_STAT(ParkedRefill), false, this);
    const FCollisionShape Box = FCollisionShape::MakeBox(FVector(BoxHalfX - 5., BoxHalfY - 5., BoxHalfZ - 5.));
    for (int32 Index = PromotedSlots.Num() - 1; Index >= 0; --Index)
    {
        const int32 Slot = PromotedSlots[Index];
        const FTransform& Pivot = SlotTransforms[Slot];
        if (AQuebecCar* Car = PromotedCars[Slot].Get())
        {
            if (!MayRecycle(Car->Occupant != nullptr, Car->GetController() != nullptr || Car->HasAutopilot(), Car->bPolice,
                NearestPlayerDistance(Car->GetActorLocation()), NearestPlayerDistance(Pivot.GetLocation()))) continue;
            Car->Destroy();
            PromotedCars[Slot] = nullptr;
        }
        // The space fills again once no player is near it and nothing stands in it.
        const bool bBlocked = GetWorld()->OverlapBlockingTestByChannel(Pivot.TransformPosition(FVector(0., 0., BoxCentreZ)),
            Pivot.GetRotation(), ECC_Pawn, Box, Space);
        if (!MayRefill(NearestPlayerDistance(Pivot.GetLocation()), bBlocked)) continue;
        PromotedSlots.RemoveAt(Index);
        SetSlotShown(Slot, true);
        bChanged = true;
    }
    if (bChanged) ForceNetUpdate();
}

int32 AQuebecParkedCars::GetSlotCount() const { return SlotTransforms.Num(); }
bool AQuebecParkedCars::IsSlotShown(int32 Slot) const { return Shown.IsValidIndex(Slot) && Shown[Slot]; }
FTransform AQuebecParkedCars::GetSlotTransform(int32 Slot) const { return SlotTransforms.IsValidIndex(Slot) ? SlotTransforms[Slot] : FTransform::Identity; }
int32 AQuebecParkedCars::GetPartComponentCount() const
{
    int32 Count = 0;
    for (const UHierarchicalInstancedStaticMeshComponent* Group : Groups) Count += Group != nullptr;
    for (const UHierarchicalInstancedStaticMeshComponent* Boxes : TileBoxes) Count += Boxes != nullptr;
    return Count;
}

int32 AQuebecParkedCars::GetShownCount() const
{
    int32 Count = 0;
    for (bool bShown : Shown) Count += bShown;
    return Count;
}
