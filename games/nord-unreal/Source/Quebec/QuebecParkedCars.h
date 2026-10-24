#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Engine/TimerHandle.h"
#include "QuebecParkedCars.generated.h"

class AController;
class AQuebecCar;
class UHierarchicalInstancedStaticMeshComponent;
class UStaticMesh;

// Where one slot's parts sit in the instanced components: its tile (QuebecParkedRules::TileKey, as an index into the
// fill's tiles), the part groups (QuebecParkedRules groups) and the instances in them. The tyres and rims of a slot
// are four consecutive instances. Box is the slot's instance in its tile's collision component.
struct FQuebecParkedSlotParts
{
    int32 Tile = INDEX_NONE;
    int32 Box = INDEX_NONE;
    int32 BodyGroup = INDEX_NONE;
    int32 RoofGroup = INDEX_NONE;
    int32 CabinGroup = INDEX_NONE;
    int32 Body = INDEX_NONE;
    int32 Roof = INDEX_NONE;
    int32 Cabin = INDEX_NONE;
    int32 Tires = INDEX_NONE;
    int32 Rims = INDEX_NONE;
};

/**
 * The parked cars on the Plateau curbs: one car per legal curb space in LaFontaineParking.h (Scripts/plateau_parking.py).
 * Every peer builds the same instanced parts at BeginPlay from the meshes and paints AQuebecCar uses, one instanced
 * component per 190 m tile, part mesh and paint, so a parked car looks like a real one and a promotion touches only
 * its own tile. A hidden component per tile holds one collision box per car; the boxes block cars and people but
 * ignore the Visibility channel, so floor probes never land on a roof. The server leaves out the spaces where a car,
 * a cone or anything else already stands, and turns a space into a real AQuebecCar with the same transform and style
 * when a player gets in, a car or a person hits it hard, or a shot's line ends on it. Clients hide those spaces from
 * the replicated lists.
 */
UCLASS()
class QUEBEC_API AQuebecParkedCars : public AActor
{
    GENERATED_BODY()
    friend class FQuebecParkedCarsTest;
    friend class FQuebecParkedThrownPersonTest;
public:
    AQuebecParkedCars();
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    // Server, Montréal map only: spawns the fill once, after the cars, cones and bins it must leave room for.
    // -NordNoParkedFill leaves the curbs empty, for a frame-time comparison.
    static AQuebecParkedCars* SpawnFill(UWorld* World);
    static AQuebecParkedCars* Find(const UWorld* World);

    // Every peer: the shown space whose car a walker at its door can get into (a clear line to it), or INDEX_NONE.
    int32 FindEnterableSlot(const AActor* Walker, float& OutDistanceSquared) const;
    // Server: the space becomes a real AQuebecCar with its transform and style. Null when the space is not shown.
    AQuebecCar* Promote(int32 Slot);
    // Server hooks: a car's sweep (AQuebecCar::MoveWithCollision) that ends on a parked car's box, a person's move
    // that does (ACharacter::MoveBlockedBy, with the velocity before the movement turns it into a slide), or a box hit
    // a weapon reports. A strong enough hit promotes it; the caller then applies the hit to the returned car.
    static AQuebecCar* PromoteOnImpact(const FHitResult& Hit, const FVector& StrikerVelocity);
    static AQuebecCar* PromoteOnBody(const FHitResult& Impact, const FVector& BodyVelocity, const AActor* Body);
    static AQuebecCar* PromoteOnShot(const FHitResult& Hit);
    // Server: the first shown parked car a shot's line from From to To passes through (the boxes ignore the
    // Visibility channel the shot's trace uses) turns into a real car. OutImpact is where the line enters it.
    static AQuebecCar* PromoteOnLine(const UWorld* World, const FVector& From, const FVector& To, FVector& OutImpact);
    // Every peer: the first shown space the line enters, or INDEX_NONE, and where.
    int32 FindSlotOnLine(const FVector& From, const FVector& To, FVector& OutImpact) const;

    UFUNCTION(BlueprintCallable, Category="Quebec|Parked") int32 GetSlotCount() const;
    UFUNCTION(BlueprintCallable, Category="Quebec|Parked") bool IsSlotShown(int32 Slot) const;
    UFUNCTION(BlueprintCallable, Category="Quebec|Parked") FTransform GetSlotTransform(int32 Slot) const;
    UFUNCTION(BlueprintCallable, Category="Quebec|Parked") int32 GetShownCount() const;
    UFUNCTION(BlueprintCallable, Category="Quebec|Parked") int32 GetPartComponentCount() const;
    UFUNCTION(BlueprintCallable, Category="Quebec|Parked") int32 GetPromotedCount() const { return PromotedSlots.Num(); }

private:
    // Spaces the server found taken when it filled the curbs, and spaces turned into real cars.
    UPROPERTY(ReplicatedUsing=OnRep_Hidden) TArray<int32> VacantSlots;
    UPROPERTY(ReplicatedUsing=OnRep_Hidden) TArray<int32> PromotedSlots;
    UFUNCTION() void OnRep_Hidden();

    UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
    // Tile T's part group G is Groups[T * VisibleGroups + G], null where no space of the tile uses it.
    UPROPERTY() TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> Groups;
    UPROPERTY() TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> TileBoxes;
    UPROPERTY() TObjectPtr<UStaticMesh> BoxMesh;

    TArray<FQuebecParkedSlotParts> Parts;
    TArray<TArray<int32>> TileSlots;                 // the slot of each box instance, per tile
    TArray<FTransform> SlotTransforms;
    TArray<bool> Shown;                              // as drawn on this peer
    TArray<TWeakObjectPtr<AQuebecCar>> PromotedCars; // server: the real car each promoted space became
    TArray<float> PromotedAt;
    TArray<int32> PendingHide;                       // client: promoted spaces waiting for their real car
    float PendingSince = 0.f;
    bool bBuilt = false;
    FTimerHandle RecycleTimer;
    FTimerHandle PendingTimer;

    void PrepareSlots();
    void Build();
    void FindVacancies();
    // The homes and strike radii of the street props (cones, barricades, bins), and whether one takes a space.
    TArray<TPair<FVector, float>> StreetPropHomes() const;
    static bool PropTakes(const FTransform& Pivot, const TArray<TPair<FVector, float>>& Props);
    void ApplyHidden();
    void SetSlotShown(int32 Slot, bool bShow);
    void FlushPendingHides();
    void Recycle();
    int32 SlotOfHit(const UPrimitiveComponent* Component, int32 Item) const;
    UHierarchicalInstancedStaticMeshComponent* GroupOf(int32 Tile, int32 Group) const;
    float NearestPlayerDistance(const FVector& Where) const;
};
