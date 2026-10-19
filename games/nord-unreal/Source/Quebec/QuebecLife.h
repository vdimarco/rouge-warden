#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "QuebecLife.generated.h"

class UMaterialInterface;
class UStaticMesh;
class UStaticMeshComponent;

// Living street: some of the 96 runtime walkers walk a leashed dog, push a stroller or carry groceries.
// The companion is a replicated byte on the resident; every peer builds the same look from it and poses it locally.
namespace QuebecLife
{
    enum class ECompanion : uint8 { None, Dog, Stroller, Groceries };
    // The walkers counted before the MobileIndex-th mobile runtime resident; the game mode makes 2 of every 11 joggers.
    QUEBEC_API int32 WalkerOrdinal(int32 MobileIndex);
    // Deterministic companion for the MobileIndex-th mobile resident with Activity (0 walks, 1 jogs, 2 social).
    // Of every 18 walkers, three walk a dog, two push a stroller and two carry groceries: 12, 8 and 8 of the 72 walkers.
    QUEBEC_API uint8 CompanionFor(int32 MobileIndex, int32 Activity);
    // A stroller slows its pusher to a stroll.
    QUEBEC_API float CompanionPace(uint8 Companion, float Pace);
}

// What the owner does this frame. AQuebecParkResident fills it only while it is visible and near.
struct FQuebecCompanionFrame
{
    FTransform OwnerTransform = FTransform::Identity; // resident root
    FVector Hand = FVector::ZeroVector;               // left hand in world space; the right hand holds the plunger
    float Time = 0.f;                                 // shared server time
    float DeltaSeconds = 0.f;
    bool bWalking = false;                            // walking its route
    bool bPausing = false;                            // stopped at a route end
    bool bReturnLeg = false;                          // which end: the dog sniffs at one and sits at the other
    float PauseClock = 0.f;                           // seconds into the pause
    bool bRunning = false;                            // running away or walking back after a knock
    bool bKnocked = false;                            // tumbling, lying or standing up
    bool bDropped = false;                            // leash, stroller and bags let go since the knock
    float DropSeconds = 0.f;                          // since the knock
    FVector DropOrigin = FVector::ZeroVector;         // root when the knock started
    float DropYaw = 0.f;                              // facing when the knock started
    FVector Body = FVector::ZeroVector;               // tumbling hips; the dog runs around them
};

/**
 * A dog on a leash, a stroller or grocery bags beside a resident, built from engine basic shapes, or from the imported
 * Blender props under /Game/Plateau/Replica/Props when the host has imported them. It never ticks by itself.
 */
UCLASS()
class QUEBEC_API UQuebecCompanionRig : public USceneComponent
{
    GENERATED_BODY()
public:
    UQuebecCompanionRig();
    // Builds the parts once for NewKind with a size and colour chosen by Seed. The rig must be registered first.
    void Build(uint8 NewKind, int32 Seed);
    void Pose(const FQuebecCompanionFrame& Frame);
    uint8 GetKind() const { return Kind; }
    int32 GetPartCount() const { return Parts.Num(); }

private:
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
    // Per part: the transform that shapes it in the companion's frame, and the joint it swings about.
    TArray<FTransform> PartShapes;
    TArray<FVector> PartJoints;
    uint8 Kind = 0;
    float SizeScale = 1.f;
    float LegPhase = 0.f;
    float WheelTurn = 0.f;
    float CarryAlpha = 1.f;
    float LastPoseTime = -1.f;
    bool bHasDog = false;
    bool bFreshPose = true;                   // first pose after a gap starts from rest
    FVector DogPlace = FVector::ZeroVector;   // dog root in owner space
    float DogYaw = 0.f;                       // relative to the owner
    FVector LastRigWorld = FVector::ZeroVector;   // companion root last frame, for leg and wheel travel
    FVector SniffSpot = FVector::ZeroVector;  // world point of the tree or post the dog sniffs
    float SniffSearchedAt = -100.f;
    bool bSniffSpot = false;
    UStaticMeshComponent* AddPart(UStaticMesh* Mesh, UMaterialInterface* Material, const FTransform& Shape, const FVector& Joint);
    void SetPart(int32 Index, const FTransform& Frame, const FQuat& Swing = FQuat::Identity);
    void PoseDog(const FQuebecCompanionFrame& Frame);
    void PoseStroller(const FQuebecCompanionFrame& Frame);
    void PoseGroceries(const FQuebecCompanionFrame& Frame);
    bool FindSniffSpot(const FVector& Near, FVector& OutSpot) const;
};
