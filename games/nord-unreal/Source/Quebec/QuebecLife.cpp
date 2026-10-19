#include "QuebecLife.h"
#include "QuebecVegetation.h"

#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Materials/MaterialInterface.h"
#include "Misc/PackageName.h"

namespace QuebecLife
{
    int32 WalkerOrdinal(int32 MobileIndex)
    {
        const int32 Index = FMath::Max(0, MobileIndex);
        return Index / 11 * 9 + FMath::Max(0, Index % 11 - 2);
    }

    uint8 CompanionFor(int32 MobileIndex, int32 Activity)
    {
        if (Activity != 0 || MobileIndex < 0) return static_cast<uint8>(ECompanion::None);
        switch (WalkerOrdinal(MobileIndex) % 18)
        {
        case 1: case 7: case 13: return static_cast<uint8>(ECompanion::Dog);
        case 4: case 15: return static_cast<uint8>(ECompanion::Stroller);
        case 10: case 16: return static_cast<uint8>(ECompanion::Groceries);
        default: return static_cast<uint8>(ECompanion::None);
        }
    }

    float CompanionPace(uint8 Companion, float Pace)
    {
        return Companion == static_cast<uint8>(ECompanion::Stroller) ? FMath::Max(60.f, Pace * .85f) : Pace;
    }
}

namespace
{
    enum EDogPart { DogBody, DogHead, DogSnout, DogNose, DogEarLeft, DogEarRight, DogLegFrontLeft, DogLegFrontRight,
        DogLegRearLeft, DogLegRearRight, DogTail, DogLeash, DogPartCount };
    enum EStrollerPart { StrollerBasket, StrollerCanopy, StrollerBase, StrollerBarLeft, StrollerBarRight, StrollerHandle,
        StrollerWheel0, StrollerPartCount = StrollerWheel0 + 4 };
    enum EGroceryPart { GroceryBag, GroceryBread, GroceryGreens, GroceryOrange0, GroceryPartCount = GroceryOrange0 + 3 };

    UStaticMesh* BasicShape(const TCHAR* Name)
    {
        return LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("/Engine/BasicShapes/%s.%s"), Name, Name));
    }

    UMaterialInterface* ComicMaterial(const TCHAR* Name)
    {
        return LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/ParkComic/%s.%s"), Name, Name));
    }

    // Optional Blender props (Data/Plateau/ReplicaGeometry/Props/manifest.json) that the host imports into
    // /Game/Plateau/Replica/Props. Absent packages are remembered, so 28 companions do not ask the file system again.
    UStaticMesh* PropMesh(const UWorld* World, const TCHAR* Name)
    {
        // The cache lives for one world, so an import made between two editor play sessions is picked up.
        static TWeakObjectPtr<const UWorld> MissingWorld;
        static TSet<FString> Missing;
        if (MissingWorld.Get() != World)
        {
            Missing.Reset();
            MissingWorld = World;
        }
        const FString Package = FString::Printf(TEXT("/Game/Plateau/Replica/Props/%s"), Name);
        if (Missing.Contains(Package)) return nullptr;
        UStaticMesh* Mesh = FPackageName::DoesPackageExist(Package)
            ? LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("%s.%s"), *Package, Name), nullptr, LOAD_NoWarn | LOAD_Quiet) : nullptr;
        if (!Mesh) Missing.Add(Package);
        return Mesh;
    }

    FTransform Shape(const FVector& Location, const FVector& Scale3D, const FRotator& Rotation = FRotator::ZeroRotator)
    {
        return FTransform(Rotation, Location, Scale3D);
    }

    // Eases a decelerating roll from 0 to Distance over Seconds.
    float RollOut(float Elapsed, float Distance, float Seconds)
    {
        const float Alpha = FMath::Clamp(Elapsed / FMath::Max(Seconds, .01f), 0.f, 1.f);
        return Distance * (1.f - FMath::Square(1.f - Alpha));
    }
}

UQuebecCompanionRig::UQuebecCompanionRig()
{
    PrimaryComponentTick.bCanEverTick = false;
}

UStaticMeshComponent* UQuebecCompanionRig::AddPart(UStaticMesh* Mesh, UMaterialInterface* Material, const FTransform& PartShape, const FVector& Joint)
{
    UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(GetOwner());
    Part->SetupAttachment(this);
    // QA (smoke_test.py residents_ready) tells companion parts from the resident's hand prop by this tag.
    Part->ComponentTags.Add(TEXT("NordCompanion"));
    Part->SetStaticMesh(Mesh);
    if (Material) Part->SetMaterial(0, Material);
    Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Part->SetCanEverAffectNavigation(false);
    Part->SetCastShadow(Parts.Num() < 2);
    Part->SetCullDistance(14000.f);
    Part->SetRelativeTransform(PartShape);
    Part->RegisterComponent();
    Parts.Add(Part);
    PartShapes.Add(PartShape);
    PartJoints.Add(Joint);
    return Part;
}

void UQuebecCompanionRig::SetPart(int32 Index, const FTransform& Frame, const FQuat& Swing)
{
    if (!Parts.IsValidIndex(Index) || !Parts[Index]) return;
    // Shape the part, swing it about its joint, then carry it with its frame (body bob, head turn, sitting).
    const FTransform Joint(FQuat::Identity, PartJoints[Index]);
    Parts[Index]->SetRelativeTransform(PartShapes[Index] * Joint.Inverse() * FTransform(Swing) * Joint * Frame);
}

void UQuebecCompanionRig::Build(uint8 NewKind, int32 Seed)
{
    if (Parts.Num() || NewKind == 0 || !GetOwner()) return;
    Kind = NewKind;
    const UWorld* World = GetWorld();
    const int32 Variant = FMath::Abs(Seed);
    UStaticMesh* Cube = BasicShape(TEXT("Cube"));
    UStaticMesh* Sphere = BasicShape(TEXT("Sphere"));
    UStaticMesh* Cylinder = BasicShape(TEXT("Cylinder"));
    UMaterialInterface* Ink = ComicMaterial(TEXT("M_Ink"));
    if (Kind == static_cast<uint8>(QuebecLife::ECompanion::Dog))
    {
        // Three sizes and five coats, chosen by the walker's seed.
        const int32 SizeIndex = Variant % 3;
        const float Sizes[] = {.6f, .85f, 1.1f};
        const TCHAR* Coats[] = {TEXT("M_Fur"), TEXT("M_Ink"), TEXT("M_Cream"), TEXT("M_White"), TEXT("M_Hair")};
        SizeScale = Sizes[SizeIndex];
        const int32 CoatIndex = Variant / 3 % 5;
        UMaterialInterface* Coat = ComicMaterial(Coats[CoatIndex]);
        UMaterialInterface* Accent = CoatIndex == 1 ? ComicMaterial(TEXT("M_Cream")) : Ink;
        const float S = SizeScale;
        const FVector Neck(28.f * S, 0.f, 58.f * S);
        // The host's Blender dogs (Props manifest: SM_Props_dog_<size>_<part>) have each part's pivot at its joint, placed
        // at the medium dog's attach points scaled by size. They keep their imported coats.
        const TCHAR* SizeNames[] = {TEXT("small"), TEXT("medium"), TEXT("large")};
        const float PropScales[] = {.7f, 1.f, 4.f / 3.f};
        constexpr int32 ImportedCount = 9;
        const TCHAR* ImportedParts[ImportedCount] = {TEXT("body"), TEXT("head"), TEXT("head_dark"), TEXT("collar"),
            TEXT("leg_fl"), TEXT("leg_fr"), TEXT("leg_rl"), TEXT("leg_rr"), TEXT("tail")};
        const FVector Attach[ImportedCount] = {FVector(0.f, 0.f, .54f), FVector(21.6f, 0.f, 40.94f), FVector(21.6f, 0.f, 40.94f),
            FVector(0.f, 0.f, .54f), FVector(18.f, -5.76f, 28.34f), FVector(18.f, 5.76f, 28.34f), FVector(-18.f, -6.f, 29.74f),
            FVector(-18.f, 6.f, 29.74f), FVector(-28.2f, 0.f, 39.54f)};
        UStaticMesh* Props[ImportedCount];
        bool bImported = true;
        for (int32 I = 0; I < ImportedCount; ++I)
            bImported &= (Props[I] = PropMesh(World, *FString::Printf(TEXT("SM_Props_dog_%s_%s"), SizeNames[SizeIndex], ImportedParts[I]))) != nullptr;
        const auto Prop = [&Attach, &PropScales, SizeIndex](int32 Index) { return FTransform(Attach[Index] * PropScales[SizeIndex]); };
        const auto Joint = [&Attach, &PropScales, SizeIndex](int32 Index) { return Attach[Index] * PropScales[SizeIndex]; };
        // Part order matches EDogPart: body, head, snout (eyes and nose), nose (collar), two ears, four legs, tail, leash.
        AddPart(bImported ? Props[0] : Cube, bImported ? nullptr : Coat, bImported ? Prop(0) : Shape(FVector(0.f, 0.f, 46.f * S), FVector(.6f, .24f, .26f) * S), FVector::ZeroVector);
        AddPart(bImported ? Props[1] : Cube, bImported ? nullptr : Coat, bImported ? Prop(1) : Shape(FVector(38.f * S, 0.f, 66.f * S), FVector(.22f, .18f, .19f) * S),
            bImported ? Joint(1) : Neck);
        AddPart(bImported ? Props[2] : Cube, bImported ? nullptr : Coat, bImported ? Prop(2) : Shape(FVector(53.f * S, 0.f, 61.f * S), FVector(.13f, .11f, .09f) * S),
            bImported ? Joint(2) : Neck);
        // The imported collar sits at the neck joint, so nodding with the head barely moves it.
        AddPart(bImported ? Props[3] : Sphere, bImported ? nullptr : Ink, bImported ? Prop(3) : Shape(FVector(60.f * S, 0.f, 64.f * S), FVector(.05f) * S),
            bImported ? Joint(1) : Neck);
        for (float Side : {-1.f, 1.f})
            AddPart(bImported ? nullptr : Cube, Accent, Shape(FVector(32.f * S, Side * 8.f * S, 78.f * S), FVector(.05f, .07f, .1f) * S,
                FRotator(0.f, 0.f, Side * 18.f)), Neck);
        for (int32 Leg = 0; Leg < 4; ++Leg)
        {
            const FVector Hip((Leg < 2 ? 22.f : -22.f) * S, (Leg % 2 ? 8.f : -8.f) * S, 36.f * S);
            AddPart(bImported ? Props[4 + Leg] : Cylinder, bImported ? nullptr : Coat,
                bImported ? Prop(4 + Leg) : Shape(Hip - FVector(0.f, 0.f, 18.f * S), FVector(.075f, .075f, .36f) * S), bImported ? Joint(4 + Leg) : Hip);
        }
        const FVector TailRoot(-30.f * S, 0.f, 55.f * S);
        AddPart(bImported ? Props[8] : Cylinder, bImported ? nullptr : Coat, bImported ? Prop(8) : Shape(TailRoot + FVector(-9.2f, 0.f, 9.2f) * S,
            FVector(.04f, .04f, .26f) * S, FRotator(45.f, 0.f, 0.f)), bImported ? Joint(8) : TailRoot);
        UStaticMeshComponent* Leash = AddPart(Cylinder, ComicMaterial(TEXT("M_Red")), Shape(FVector::ZeroVector, FVector(.012f, .012f, 1.f)), FVector::ZeroVector);
        Leash->SetCastShadow(false);
        bHasDog = true;
    }
    else if (Kind == static_cast<uint8>(QuebecLife::ECompanion::Stroller))
    {
        const TCHAR* Fabrics[] = {TEXT("M_Navy"), TEXT("M_Berry"), TEXT("M_Lime")};
        UMaterialInterface* Fabric = ComicMaterial(Fabrics[Variant % 3]);
        // The host's Blender stroller: frame, seat and canopy in root space, wheels pivoting on their axles.
        const TCHAR* ImportedParts[] = {TEXT("SM_Props_stroller_frame"), TEXT("SM_Props_stroller_seat"), TEXT("SM_Props_stroller_canopy"),
            TEXT("SM_Props_stroller_wheel_fl"), TEXT("SM_Props_stroller_wheel_fr"), TEXT("SM_Props_stroller_wheel_rl"), TEXT("SM_Props_stroller_wheel_rr")};
        UStaticMesh* Props[7];
        bool bImported = true;
        for (int32 I = 0; I < 7; ++I) bImported &= (Props[I] = PropMesh(World, ImportedParts[I])) != nullptr;
        const FTransform Root(FVector(0.f, 0.f, -.08f));
        AddPart(bImported ? Props[0] : Cube, bImported ? nullptr : Fabric, bImported ? Root : Shape(FVector(0.f, 0.f, 58.f), FVector(.56f, .38f, .3f)), FVector::ZeroVector);
        AddPart(bImported ? Props[1] : Sphere, bImported ? nullptr : Fabric, bImported ? Root : Shape(FVector(-14.f, 0.f, 72.f), FVector(.42f, .4f, .4f)), FVector::ZeroVector);
        AddPart(bImported ? Props[2] : Cube, bImported ? nullptr : Ink, bImported ? Root : Shape(FVector(0.f, 0.f, 27.f), FVector(.5f, .3f, .03f)), FVector::ZeroVector);
        for (float Side : {-1.f, 1.f})
            AddPart(bImported ? nullptr : Cube, Ink, Shape(FVector(-34.f, Side * 17.f, 80.f), FVector(.03f, .03f, .5f), FRotator(-40.f, 0.f, 0.f)), FVector::ZeroVector);
        AddPart(bImported ? nullptr : Cylinder, Ink, Shape(FVector(-48.f, 0.f, 98.f), FVector(.03f, .03f, .4f), FRotator(0.f, 0.f, 90.f)), FVector::ZeroVector);
        const FVector Axles[4] = {FVector(30.f, -21.f, 9.42f), FVector(30.f, 21.f, 9.42f), FVector(-30.f, -27.5f, 13.92f), FVector(-30.f, 27.5f, 13.92f)};
        for (int32 Wheel = 0; Wheel < 4; ++Wheel)
        {
            const FVector Hub(Wheel < 2 ? 22.f : -22.f, Wheel % 2 ? 18.f : -18.f, 11.f);
            AddPart(bImported ? Props[3 + Wheel] : Cylinder, bImported ? nullptr : Ink,
                bImported ? FTransform(Axles[Wheel]) : Shape(Hub, FVector(.22f, .22f, .04f), FRotator(0.f, 0.f, 90.f)), bImported ? Axles[Wheel] : Hub);
        }
    }
    else if (Kind == static_cast<uint8>(QuebecLife::ECompanion::Groceries))
    {
        // The host's Blender bag hangs from its 43 cm grip; extra imported parts follow the six basic ones.
        UStaticMesh* Bag = PropMesh(World, TEXT("SM_Props_grocery_bag_bag"));
        const FTransform Grip(FVector(0.f, 0.f, -43.f));
        AddPart(Bag ? Bag : Cube, Bag ? nullptr : ComicMaterial(TEXT("M_Paper")), Bag ? Grip : Shape(FVector(0.f, 0.f, -20.f), FVector(.26f, .16f, .32f)), FVector::ZeroVector);
        UStaticMesh* Bread = Bag ? PropMesh(World, TEXT("SM_Props_grocery_bag_bread")) : nullptr;
        AddPart(Bread ? Bread : Cylinder, Bread ? nullptr : ComicMaterial(TEXT("M_Gold")),
            Bread ? Grip : Shape(FVector(4.f, 3.f, -2.f), FVector(.05f, .05f, .5f), FRotator(-14.f, 0.f, 8.f)), FVector::ZeroVector);
        UStaticMesh* Leaves = Bag ? PropMesh(World, TEXT("SM_Props_grocery_bag_leaves")) : nullptr;
        AddPart(Leaves ? Leaves : Sphere, Leaves ? nullptr : ComicMaterial(TEXT("M_Lime")),
            Leaves ? Grip : Shape(FVector(-5.f, -2.f, -3.f), FVector(.13f, .11f, .1f)), FVector::ZeroVector);
        UMaterialInterface* Orange = ComicMaterial(TEXT("M_Orange"));
        for (int32 Fruit = 0; Fruit < 3; ++Fruit) AddPart(Sphere, Orange, Shape(FVector::ZeroVector, FVector(.08f)), FVector::ZeroVector)->SetVisibility(false);
        if (Bag)
            for (const TCHAR* Extra : {TEXT("SM_Props_grocery_bag_bag_inner"), TEXT("SM_Props_grocery_bag_leeks")})
                if (UStaticMesh* Mesh = PropMesh(World, Extra)) AddPart(Mesh, nullptr, Grip, FVector::ZeroVector);
    }
    LastPoseTime = -1.f;
}

void UQuebecCompanionRig::SetShown(bool bShown)
{
    if (bShownNow == bShown) return;
    bShownNow = bShown;
    // Hidden while the owner is hidden or far, instead of standing where it was last posed. Pose fixes the leash and
    // fruit visibility again on the same frame it is shown.
    SetVisibility(bShown, true);
    if (bShown) LastPoseTime = -1.f;
}

void UQuebecCompanionRig::Pose(const FQuebecCompanionFrame& Frame)
{
    if (!Parts.Num()) return;
    // The first frame after a gap starts from rest instead of crossing the gap.
    bFreshPose = LastPoseTime < 0.f || Frame.Time - LastPoseTime > .5f;
    LastPoseTime = Frame.Time;
    if (bFreshPose) CarryAlpha = Frame.bDropped ? 0.f : 1.f;
    else CarryAlpha = Frame.bDropped ? 0.f : FMath::Min(1.f, CarryAlpha + Frame.DeltaSeconds * 2.f);
    if (Kind == static_cast<uint8>(QuebecLife::ECompanion::Dog)) PoseDog(Frame);
    else if (Kind == static_cast<uint8>(QuebecLife::ECompanion::Stroller)) PoseStroller(Frame);
    else if (Kind == static_cast<uint8>(QuebecLife::ECompanion::Groceries)) PoseGroceries(Frame);
}

bool UQuebecCompanionRig::FindSniffSpot(const FVector& Near, FVector& OutSpot) const
{
    // The nearest street or park tree within leash reach, read from the saved tree instances.
    double Best = FMath::Square(450.);
    bool bFound = false;
    for (TActorIterator<AQuebecVegetation> It(GetWorld()); It; ++It)
    {
        const UHierarchicalInstancedStaticMeshComponent* Trees = It->Trees;
        if (!Trees || !Trees->GetInstanceCount()) continue;
        for (int32 Instance : Trees->GetInstancesOverlappingSphere(Near, 450.f, true))
        {
            FTransform Tree;
            if (!Trees->GetInstanceTransform(Instance, Tree, true)) continue;
            const double Distance = FVector::DistSquared2D(Tree.GetLocation(), Near);
            if (Distance >= Best) continue;
            Best = Distance;
            OutSpot = FVector(Tree.GetLocation().X, Tree.GetLocation().Y, Near.Z);
            bFound = true;
        }
    }
    return bFound;
}

void UQuebecCompanionRig::PoseDog(const FQuebecCompanionFrame& Frame)
{
    const float S = SizeScale;
    const FTransform& OwnerFrame = Frame.OwnerTransform;
    const float Delta = FMath::Clamp(Frame.DeltaSeconds, 0.f, .1f);
    FVector Target(55.f + 10.f * S, -65.f, 0.f);
    float TargetYaw = 0.f, Rate = 4.f;
    bool bSit = false, bSniff = false;
    if (Frame.bKnocked)
    {
        // The owner let go: the dog runs circles around the tumbling body.
        const float Angle = Frame.Time * 2.6f;
        const FVector Around(Frame.Body.X + FMath::Cos(Angle) * 120.f, Frame.Body.Y + FMath::Sin(Angle) * 120.f, OwnerFrame.GetLocation().Z);
        Target = OwnerFrame.InverseTransformPosition(Around);
        TargetYaw = FMath::RadiansToDegrees(Angle) + 90.f - OwnerFrame.Rotator().Yaw;
        Rate = 7.f;
    }
    else if (Frame.bRunning) { Target = FVector(60.f, -70.f, 0.f); Rate = 7.f; }
    else if (Frame.bPausing && !Frame.bReturnLeg)
    {
        // Once per pause, look for a tree to sniff; otherwise sniff the ground beside the path.
        if (Frame.Time - SniffSearchedAt > Frame.PauseClock + .5f)
        {
            SniffSearchedAt = Frame.Time;
            bSniffSpot = FindSniffSpot(OwnerFrame.GetLocation(), SniffSpot);
        }
        Target = FVector(45.f, -110.f, 0.f);
        if (bSniffSpot)
        {
            const FVector Local = OwnerFrame.InverseTransformPosition(SniffSpot);
            const FVector Reach = FVector(Local.X, Local.Y, 0.f).GetClampedToMaxSize(170.f);
            Target = Reach - Reach.GetSafeNormal() * 45.f * S;
            TargetYaw = Reach.Rotation().Yaw;
        }
        bSniff = FVector::Dist2D(DogPlace, Target) < 40.f;
    }
    else if (Frame.bPausing) { Target = FVector(38.f, -55.f, 0.f); bSit = Frame.PauseClock > .8f; }
    else Target += FVector(FMath::Sin(Frame.Time * .7f) * 15.f, FMath::Sin(Frame.Time * 1.1f) * 10.f, 0.f);
    if (bFreshPose || FVector::DistSquared(DogPlace, Target) > FMath::Square(600.)) DogPlace = Target;
    else DogPlace = FMath::VInterpTo(DogPlace, Target, Delta, Rate);
    const FVector World = OwnerFrame.TransformPosition(DogPlace);
    if (bFreshPose) LastRigWorld = World;
    const float Travel = Delta > 0.f ? FVector::Dist2D(World, LastRigWorld) : 0.f;
    LastRigWorld = World;
    const float Pace = Delta > 0.f ? Travel / Delta : 0.f;
    // Face the way the dog moves when it trots; otherwise face the target.
    if (Pace > 40.f && Travel < 200.f)
    {
        const FVector Heading = OwnerFrame.InverseTransformVector(World - GetComponentLocation());
        if (!Heading.IsNearlyZero(1.)) TargetYaw = Heading.Rotation().Yaw;
    }
    DogYaw = FRotator::NormalizeAxis(FMath::FInterpTo(DogYaw, DogYaw + FRotator::NormalizeAxis(TargetYaw - DogYaw), Delta, 6.f));
    // The rig is absolute: place it in world space from the owner, only on frames the owner is posed.
    SetWorldLocationAndRotation(OwnerFrame.TransformPosition(DogPlace - FVector(0.f, 0.f, 7.f)),
        OwnerFrame.GetRotation() * FRotator(0.f, DogYaw, 0.f).Quaternion());
    // Trot: diagonal legs swing together, at a stride that matches the ground covered.
    LegPhase = FMath::Fmod(LegPhase + Travel / (24.f * S), 2.f * PI);
    const float Swing = FMath::Clamp(Pace / 120.f, 0.f, 1.f) * 30.f * FMath::Sin(LegPhase);
    const float SitPitch = bSit ? 25.f : 0.f;
    const FTransform BodyFrame = FTransform(FVector(-22.f * S, 0.f, 0.f)).Inverse() * FTransform(FRotator(SitPitch, 0.f, 0.f).Quaternion()) *
        FTransform(FVector(-22.f * S, 0.f, (bSit ? -8.f : FMath::Abs(FMath::Sin(LegPhase)) * 1.5f) * S));
    SetPart(DogBody, BodyFrame);
    const FQuat Head = FRotator(bSniff ? -35.f : (bSit ? -SitPitch + 8.f * FMath::Sin(Frame.Time * .9f) : 0.f),
        bSniff ? 10.f * FMath::Sin(Frame.Time * 7.f) : (bSit ? 25.f * FMath::Sin(Frame.Time * .6f) : 0.f), 0.f).Quaternion();
    for (int32 Part : {DogHead, DogSnout, DogNose, DogEarLeft, DogEarRight}) SetPart(Part, BodyFrame, Head);
    for (int32 Leg = 0; Leg < 4; ++Leg)
    {
        const bool bFront = Leg < 2, bDiagonal = (Leg == 0 || Leg == 3);
        const float Angle = bSit ? (bFront ? -SitPitch : 70.f) : (bDiagonal ? Swing : -Swing);
        SetPart(DogLegFrontLeft + Leg, BodyFrame, FRotator(Angle, 0.f, 0.f).Quaternion());
    }
    SetPart(DogTail, BodyFrame, FRotator(0.f, FMath::Sin(Frame.Time * (bSniff || Frame.bKnocked ? 16.f : 9.f)) * 30.f, 0.f).Quaternion());
    // The leash runs straight from the owner's hand to the collar; a dropped leash stays with the dog, hidden.
    UStaticMeshComponent* Leash = Parts[DogLeash];
    const FVector Collar = GetComponentTransform().TransformPosition(BodyFrame.TransformPosition(FVector(26.f * S, 0.f, 60.f * S)));
    const FVector Line = Frame.Hand - Collar;
    const bool bHeld = !Frame.bDropped && !Frame.Hand.IsZero() && Line.Size() < 320.;
    Leash->SetVisibility(bHeld);
    if (bHeld)
        Leash->SetWorldTransform(FTransform(FRotationMatrix::MakeFromZ(Line.GetSafeNormal()).ToQuat(), (Frame.Hand + Collar) * .5,
            FVector(.012f, .012f, FMath::Max(.01f, float(Line.Size()) / 100.f))));
}

void UQuebecCompanionRig::PoseStroller(const FQuebecCompanionFrame& Frame)
{
    const FVector Carried = Frame.OwnerTransform.TransformPosition(FVector(82.f, 0.f, -7.f));
    const FQuat CarriedRotation = Frame.OwnerTransform.GetRotation();
    // Let go at the knock, the stroller rolls on a little and stops.
    const FRotator Dropped(0.f, Frame.DropYaw + 12.f * FMath::Clamp(Frame.DropSeconds / 1.4f, 0.f, 1.f), 0.f);
    const FVector Rolled = Frame.DropOrigin + FRotator(0.f, Frame.DropYaw, 0.f).RotateVector(FVector(82.f + RollOut(Frame.DropSeconds, 140.f, 1.4f), 0.f, -7.f));
    const bool bUseDrop = CarryAlpha < 1.f && !Frame.DropOrigin.IsZero();
    const FVector Place = bUseDrop ? FMath::Lerp(Rolled, Carried, CarryAlpha) : Carried;
    SetWorldLocationAndRotation(Place, bUseDrop ? FQuat::Slerp(Dropped.Quaternion(), CarriedRotation, CarryAlpha) : CarriedRotation);
    const float Travel = bFreshPose ? 0.f : FVector::Dist2D(Place, LastRigWorld);
    LastRigWorld = Place;
    if (Travel < 200.f) WheelTurn = FMath::Fmod(WheelTurn + FMath::RadiansToDegrees(Travel / 11.f), 360.f);
    for (int32 Wheel = 0; Wheel < 4; ++Wheel) SetPart(StrollerWheel0 + Wheel, FTransform::Identity, FRotator(-WheelTurn, 0.f, 0.f).Quaternion());
}

void UQuebecCompanionRig::PoseGroceries(const FQuebecCompanionFrame& Frame)
{
    const FVector Hand = Frame.Hand.IsZero() ? Frame.OwnerTransform.TransformPosition(FVector(25.f, -38.f, 70.f)) : Frame.Hand - FVector(0.f, 0.f, 4.f);
    const FQuat Facing = FRotator(0.f, Frame.OwnerTransform.Rotator().Yaw, 0.f).Quaternion();
    // Dropped: the bag tips over beside the knock and three oranges roll out.
    const FRotator DropFacing(0.f, Frame.DropYaw, 0.f);
    const FVector Spilled = Frame.DropOrigin + DropFacing.RotateVector(FVector(45.f, -35.f, 2.f));
    const FQuat Tipped = DropFacing.Quaternion() * FRotator(0.f, 0.f, 78.f).Quaternion();
    const bool bUseDrop = CarryAlpha < 1.f && !Frame.DropOrigin.IsZero();
    SetWorldLocationAndRotation(bUseDrop ? FMath::Lerp(Spilled, Hand, CarryAlpha) : Hand, bUseDrop ? FQuat::Slerp(Tipped, Facing, CarryAlpha) : Facing);
    for (int32 Fruit = 0; Fruit < 3; ++Fruit)
    {
        UStaticMeshComponent* Orange = Parts[GroceryOrange0 + Fruit];
        Orange->SetVisibility(Frame.bDropped);
        if (!Frame.bDropped) continue;
        const FRotator Spread(0.f, Frame.DropYaw - 30.f + 30.f * Fruit, 0.f);
        Orange->SetWorldLocation(Spilled + Spread.RotateVector(FVector(RollOut(Frame.DropSeconds, 45.f + 25.f * Fruit, 1.f), 0.f, 0.f)) + FVector(0.f, 0.f, 2.f));
    }
}
