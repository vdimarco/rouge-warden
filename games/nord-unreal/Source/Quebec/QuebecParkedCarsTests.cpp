#include "QuebecParkedCars.h"
#include "QuebecGameplay.h"
#include "QuebecParkedRules.h"
#include "QuebecTraces.h"
#include "LaFontaineParking.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"

namespace
{
    UWorld* NewParkedWorld()
    {
        UWorld::InitializationValues Initialization;
        Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
        return UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
    }
}

// The fill of the curbs: every peer builds the same instances, tile by tile; a hard hit, a shot or E turns a space into
// a real AQuebecCar with the space's transform and style, and the space's instance and box go away.
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecParkedCarsTest, "Quebec.Parked.FillAndPromote", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecParkedCarsTest::RunTest(const FString& Parameters)
{
    using namespace QuebecParkedRules;
    UWorld* World = NewParkedWorld();
    if (!TestNotNull(TEXT("Parked-car test world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    // A cone of a chantier on space 3 takes it: street props have no collision, so the fill reads their homes.
    const FTransform Space3(FRotator(0., LaFontaineParking::Slots[3].Yaw, 0.),
        FVector(LaFontaineParking::Slots[3].X, LaFontaineParking::Slots[3].Y, LaFontaineParking::Slots[3].Z + PivotHeight));
    AQuebecStreetProp* Cone = AQuebecStreetProp::SpawnProp(World, AQuebecStreetProp::KindCone,
        Space3.TransformPosition(FVector(100., 20., -PivotHeight)), 0.f);
    AQuebecParkedCars* Fill = World->SpawnActor<AQuebecParkedCars>(FVector::ZeroVector, FRotator::ZeroRotator, Spawn);
    if (!TestNotNull(TEXT("Parked-car fill"), Fill)) return false;
    // The world has not begun play: build as a client does, with no space taken.
    Fill->PrepareSlots();
    if (TestNotNull(TEXT("A cone for the vacancy check"), Cone))
    {
        const TArray<TPair<FVector, float>> Props = Fill->StreetPropHomes();
        TestTrue(TEXT("The fill sees the cone"), Props.Num() == 1);
        TestTrue(TEXT("A space under a cone is left out"), AQuebecParkedCars::PropTakes(Space3, Props));
        TestFalse(TEXT("The next space is not"), AQuebecParkedCars::PropTakes(Fill->GetSlotTransform(40), Props) &&
            FVector::Dist(Fill->GetSlotTransform(40).GetLocation(), Space3.GetLocation()) > 1000.);
        Cone->Destroy();
    }
    Fill->Build();
    const int32 Count = LaFontaineParking::SlotCount;
    TestEqual(TEXT("One space per header row"), Fill->GetSlotCount(), Count);
    const int32 Tiles = Fill->TileBoxes.Num();
    TestTrue(TEXT("The fill is cut into a few 190 m tiles"), Tiles > 4 && Fill->Groups.Num() == Tiles * VisibleGroups);
    int32 BodyCount = 0, TyreCount = 0, BoxCount = 0;
    for (int32 Tile = 0; Tile < Tiles; ++Tile)
    {
        for (int32 Group = 0; Group < BodyGroups; ++Group)
            if (UHierarchicalInstancedStaticMeshComponent* Part = Fill->GroupOf(Tile, Group)) BodyCount += Part->GetInstanceCount();
        if (UHierarchicalInstancedStaticMeshComponent* Part = Fill->GroupOf(Tile, TireGroup)) TyreCount += Part->GetInstanceCount();
        BoxCount += Fill->TileBoxes[Tile]->GetInstanceCount();
        // No component spans more than a tile and a car.
        if (UHierarchicalInstancedStaticMeshComponent* Part = Fill->GroupOf(Tile, TireGroup))
        {
            const FBox Bounds = Part->Bounds.GetBox();
            TestTrue(TEXT("A tile's tyres span at most 200 m"), FMath::Max(Bounds.GetSize().X, Bounds.GetSize().Y) <= 20000.);
        }
    }
    TestEqual(TEXT("A body per space"), BodyCount, Count);
    TestEqual(TEXT("Four tyres per space"), TyreCount, Count * WheelsPerCar);
    TestEqual(TEXT("A box per space"), BoxCount, Count);
    const FQuebecParkedSlotParts& First = Fill->Parts[0];
    TestEqual(TEXT("Bodies cull at 90 m"), Fill->GroupOf(First.Tile, First.BodyGroup)->InstanceEndCullDistance, BodyCullEnd);
    TestEqual(TEXT("Rims cull at 35 m"), Fill->GroupOf(First.Tile, RimGroup)->InstanceEndCullDistance, RimCullEnd);
    TestEqual(TEXT("Every space is shown"), Fill->GetShownCount(), Count);

    // The boxes ignore the Visibility channel: a floor probe down onto a shown space passes through to the road.
    const FVector Over = Fill->GetSlotTransform(5).GetLocation();
    FHitResult Floor;
    const bool bFloor = World->LineTraceSingleByChannel(Floor, Over + FVector(0., 0., 300.), Over - FVector(0., 0., 300.), ECC_Visibility);
    TestFalse(TEXT("A Visibility floor probe never lands on a parked car"), bFloor && Floor.GetActor() == Fill);
    FHitResult Pawn;
    const bool bPawn = World->LineTraceSingleByChannel(Pawn, Over + FVector(-400., 0., 0.), Over + FVector(400., 0., 0.), ECC_Pawn);
    TestTrue(TEXT("Cars and people still stop at it"), bPawn && Pawn.GetActor() == Fill);

    // A gentle bump leaves the car parked; a hard one turns it into a real car of the same paint and body.
    const auto BoxHit = [Fill](int32 Slot)
    {
        const FQuebecParkedSlotParts& Where = Fill->Parts[Slot];
        FHitResult Hit(Fill, Fill->TileBoxes[Where.Tile], Fill->GetSlotTransform(Slot).GetLocation(), FVector(1., 0., 0.));
        Hit.bBlockingHit = true;
        Hit.Item = Where.Box;
        Hit.Normal = FVector(1., 0., 0.);
        return Hit;
    };
    TestNull(TEXT("A bump under 300 cm/s does not promote"), AQuebecParkedCars::PromoteOnImpact(BoxHit(1), FVector(-200., 0., 0.)));
    TestTrue(TEXT("The bumped car stays an instance"), Fill->IsSlotShown(1));
    AQuebecCar* Rammed = AQuebecParkedCars::PromoteOnImpact(BoxHit(1), FVector(-500., 0., 0.));
    if (!TestNotNull(TEXT("A hard hit promotes the space"), Rammed)) return false;
    const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[1];
    TestEqual(TEXT("Same paint"), Rammed->PaintStyle, int32(Row.Paint));
    TestEqual(TEXT("Same body"), Rammed->BodyProfile, int32(Row.Body));
    TestTrue(TEXT("Same place"), Rammed->GetActorLocation().Equals(Fill->GetSlotTransform(1).GetLocation(), 1.));
    TestTrue(TEXT("Same heading"), FMath::IsNearlyEqual(float(Rammed->GetActorRotation().Yaw), float(FRotator::NormalizeAxis(Row.Yaw)), .5f));
    TestFalse(TEXT("The promoted space is hidden"), Fill->IsSlotShown(1));
    FTransform Box;
    Fill->TileBoxes[Fill->Parts[1].Tile]->GetInstanceTransform(Fill->Parts[1].Box, Box, true);
    TestTrue(TEXT("Its box left the space"), Box.GetLocation().Z < Fill->GetSlotTransform(1).GetLocation().Z - 400.);
    TestTrue(TEXT("Promoted cars are not CityParked"), !Rammed->ActorHasTag(TEXT("CityParked")) && !Rammed->bTraffic);
    TestNull(TEXT("A space promotes once"), Fill->Promote(1));

    // A shot's line across a shown space promotes it and stops at its side; one over the roof does not.
    const FTransform Target = Fill->GetSlotTransform(2);
    FVector ShotImpact = FVector::ZeroVector;
    TestEqual(TEXT("A line over the roof finds no car"), Fill->FindSlotOnLine(Target.TransformPosition(FVector(0., -600., 200.)),
        Target.TransformPosition(FVector(0., 600., 200.)), ShotImpact), int32(INDEX_NONE));
    AQuebecCar* Shot = AQuebecParkedCars::PromoteOnLine(World, Target.TransformPosition(FVector(0., -600., 40.)),
        Target.TransformPosition(FVector(0., 600., 40.)), ShotImpact);
    TestNotNull(TEXT("A shot promotes"), Shot);
    TestTrue(TEXT("The shot stops at the car's side"), ShotImpact.Equals(Target.TransformPosition(FVector(0., -BoxHalfY, 40.)), 1.));
    TestEqual(TEXT("Two promoted spaces"), Fill->GetPromotedCount(), 2);
    AActor* Walker = World->SpawnActor<AActor>(Fill->GetSlotTransform(1).GetLocation() + FVector(0., 0., 50.), FRotator::ZeroRotator, Spawn);
    float Distance = 0.f;
    if (Walker) TestNotEqual(TEXT("E skips a promoted space"), Fill->FindEnterableSlot(Walker, Distance), 1);

    // With no player in the world both cars go and their spaces fill again.
    Fill->Recycle();
    TestEqual(TEXT("Recycled"), Fill->GetPromotedCount(), 0);
    TestTrue(TEXT("The space is drawn again"), Fill->IsSlotShown(1) && Fill->IsSlotShown(2));
    return true;
}

// A person thrown into a parked car: the movement reports the blocked move with the velocity it had before the slide,
// so a hard throw promotes the space and a walk into it does not.
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecParkedThrownPersonTest, "Quebec.Parked.ThrownPerson", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecParkedThrownPersonTest::RunTest(const FString& Parameters)
{
    using namespace QuebecParkedRules;
    UWorld* World = NewParkedWorld();
    if (!TestNotNull(TEXT("Parked-car test world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecParkedCars* Fill = World->SpawnActor<AQuebecParkedCars>(FVector::ZeroVector, FRotator::ZeroRotator, Spawn);
    if (!TestNotNull(TEXT("Parked-car fill"), Fill)) return false;
    Fill->PrepareSlots();
    Fill->Build();
    const FTransform Space = Fill->GetSlotTransform(4);
    // The person stands 3 m out from the car's side, at the box's height, and is thrown at it.
    const FVector Start = Space.TransformPosition(FVector(0., -300., 0.));
    AQuebecCharacter* Person = World->SpawnActor<AQuebecCharacter>(Start, FRotator::ZeroRotator, Spawn);
    if (!TestNotNull(TEXT("A person to throw"), Person)) return false;
    // No controller in this world: the movement still runs, as for a thrown body.
    Person->GetCharacterMovement()->bRunPhysicsWithNoController = true;
    Person->GetCharacterMovement()->SetMovementMode(MOVE_Falling);
    Person->GetCharacterMovement()->Velocity = (Space.GetLocation() - Start).GetSafeNormal2D() * 1200.;
    for (int32 Step = 0; Step < 30 && Fill->IsSlotShown(4); ++Step)
        Person->GetCharacterMovement()->TickComponent(1.f / 30.f, LEVELTICK_All, nullptr);
    TestFalse(TEXT("A person thrown at 12 m/s promotes the space"), Fill->IsSlotShown(4));
    TestEqual(TEXT("One promoted space"), Fill->GetPromotedCount(), 1);
    // The hook itself: a slow push is not a throw.
    FHitResult Slow(Fill, Fill->TileBoxes[Fill->Parts[6].Tile], Fill->GetSlotTransform(6).GetLocation(), FVector(0., 1., 0.));
    Slow.bBlockingHit = true;
    Slow.Item = Fill->Parts[6].Box;
    TestNull(TEXT("A walk into a parked car does not promote it"), AQuebecParkedCars::PromoteOnBody(Slow, FVector(0., 400., 0.), Person));
    return true;
}
#endif
