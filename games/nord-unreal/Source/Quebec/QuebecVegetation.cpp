#include "QuebecVegetation.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"

namespace
{
    constexpr int32 LeafCount = 8;
    constexpr float LeafLife = 2.2f;
    constexpr float LeafInterval = 0.22f;
}

AQuebecVegetation::AQuebecVegetation()
{
    PrimaryActorTick.bCanEverTick = true;
    Trees = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("Trees"));
    SetRootComponent(Trees);
    Trees->SetMobility(EComponentMobility::Static);
    Trees->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Trees->SetCanEverAffectNavigation(false);
    Trees->SetCullDistances(40000, 65000);
}

void AQuebecVegetation::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    UpdateLeaves(DeltaSeconds);
}

void AQuebecVegetation::UpdateLeaves(float DeltaSeconds)
{
    if (GetNetMode() == NM_DedicatedServer || !GetWorld()) return;
    const float Now = GetWorld()->GetTimeSeconds();
    for (int32 Index = 0; Index < Leaves.Num(); ++Index)
    {
        UStaticMeshComponent* Leaf = Leaves[Index];
        if (!Leaf || !Leaf->IsVisible()) continue;
        const float Age = Now - LeafBorn[Index];
        if (Age >= LeafLife) { Leaf->SetVisibility(false); continue; }
        // A steady drift, down and across, so the cards leave the crown instead of orbiting it.
        Leaf->AddWorldOffset(FVector(55.f, 120.f, -140.f) * DeltaSeconds);
        Leaf->AddWorldRotation(FRotator(0.f, 40.f * DeltaSeconds, 18.f * DeltaSeconds));
    }
    APawn* Pawn = nullptr;
    if (APlayerController* Player = GetWorld()->GetFirstPlayerController()) Pawn = Player->GetPawn();
    FTransform Tree;
    bool bTree = false;
    if (Pawn && Trees && Trees->GetInstanceCount() > 0)
    {
        double Best = FMath::Square(1800.0);
        for (int32 Instance : Trees->GetInstancesOverlappingSphere(Pawn->GetActorLocation(), 1800.f, true))
        {
            FTransform Candidate;
            if (!Trees->GetInstanceTransform(Instance, Candidate, true)) continue;
            const double Distance = FVector::DistSquared2D(Candidate.GetLocation(), Pawn->GetActorLocation());
            if (Distance >= Best) continue;
            Best = Distance;
            Tree = Candidate;
            bTree = true;
        }
    }
    if (!bTree || Now < NextLeafAt || !Trees->WasRecentlyRendered(1.f)) return;
    NextLeafAt = Now + LeafInterval;
    int32 Slot = Leaves.Num() < LeafCount ? Leaves.Num() : NextLeaf % LeafCount;
    ++NextLeaf;
    if (Slot == Leaves.Num())
    {
        UStaticMesh* Plane = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Plane.Plane"));
        if (!Plane) return;
        UStaticMeshComponent* NewLeaf = NewObject<UStaticMeshComponent>(this);
        NewLeaf->SetStaticMesh(Plane);
        NewLeaf->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        NewLeaf->SetCastShadow(false);
        NewLeaf->SetUsingAbsoluteLocation(true);
        NewLeaf->SetUsingAbsoluteRotation(true);
        NewLeaf->SetUsingAbsoluteScale(true);
        NewLeaf->SetupAttachment(RootComponent);
        NewLeaf->RegisterComponent();
        Slot = Leaves.Add(NewLeaf);
        LeafBorn.Add(Now);
    }
    UStaticMeshComponent* Leaf = Leaves[Slot];
    if (!Leaf) return;
    if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Art/M_DetailedAutumnLeaves.M_DetailedAutumnLeaves")))
        Leaf->SetMaterial(0, Material);
    // In the lower crown, stepped sideways so the eight cards are not one bead.
    Leaf->SetWorldLocation(Tree.GetLocation() + FVector(22.f * static_cast<float>(NextLeaf % 5 - 2), 16.f * static_cast<float>(NextLeaf % 3 - 1), 420.f));
    Leaf->SetWorldRotation(FRotator(68.f, 35.f * static_cast<float>(NextLeaf % 4), 12.f));
    Leaf->SetWorldScale3D(FVector(0.90f, 0.90f, 0.90f));
    Leaf->SetVisibility(true);
    LeafBorn[Slot] = Now;
}
