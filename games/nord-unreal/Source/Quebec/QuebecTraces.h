#pragma once

#include "CoreMinimal.h"
#include "Engine/NetSerialization.h"
#include "Engine/TimerHandle.h"
#include "GameFramework/Actor.h"
#include "QuebecTrafficModel.h"
#include "QuebecTraces.generated.h"

class AQuebecCar;
class UInstancedStaticMeshComponent;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;

// Street geometry probes shared by curb stops and street props (QuebecTraces.cpp).
namespace QuebecStreet
{
    // Distance (cm) along Outward from RoadPoint, a point on the road, to the face of a raised curb: a walkable step
    // 12-32 cm above the road, the rule the runtime curb parking relies on. Checked at three points 2.35 m apart
    // along Along; false when there is no consistent curb within 3-7.6 m.
    QUEBEC_API bool FindCurb(const UWorld* World, const FVector& RoadPoint, const FVector& Along, const FVector& Outward, float& OutEdge);
    // Height of the walkable surface under Point (cm), ignoring cars and people. False when there is none.
    QUEBEC_API bool GroundAt(const UWorld* World, const FVector& Point, float& OutZ);
}

/** A traffic cone, wheeled bin or work-zone barricade that a car can knock over. Every peer poses the tumble from the
    replicated hit and the shared server time; the prop rests where it fell and stands up again after 120 s. */
UCLASS()
class QUEBEC_API AQuebecStreetProp : public AActor
{
    GENERATED_BODY()
    friend class FQuebecTracePropTest;
public:
    static constexpr uint8 KindCone = 0;
    static constexpr uint8 KindRecycling = 1;
    static constexpr uint8 KindCompost = 2;
    static constexpr uint8 KindBarricade = 3;
    static constexpr int32 MaxProps = 60;

    AQuebecStreetProp();
    // Joins its world's prop list, so car strikes never scan the actor list.
    virtual void PostInitializeComponents() override;
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    // Server: knocks the prop away from a car moving at CarVelocity whose centre is at CarCenter; Striker, the car,
    // does not stop the flight. False when it is already down.
    bool Knock(const FVector& CarVelocity, const FVector& CarCenter, const AActor* Striker = nullptr);
    bool IsKnocked() const { return KnockedAt >= 0.f; }
    // Footprint radius used by the car strike test.
    float StrikeRadius() const;
    // Server: one prop standing on a ground point. Null when the spawn fails.
    static AQuebecStreetProp* SpawnProp(UWorld* World, uint8 NewKind, const FVector& Ground, float Yaw, uint8 NewVariant = 0);
    // Server, La Fontaine: cones and barricades around two 'chantier' work zones in parking lanes, and recycling and
    // compost bins at the curb, on the surveyed streets nearest the spawn. At most MaxProps. Returns how many.
    static int32 SpawnStreetProps(UWorld* World);

    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Kind) uint8 Kind = KindCone;
    // Recycling bins: 0 the older green bin, 1 the newer blue one.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Kind) uint8 Variant = 0;
    // Server time of the hit, or negative while standing.
    UPROPERTY(VisibleAnywhere, ReplicatedUsing=OnRep_Knock) float KnockedAt = -1.f;
    UPROPERTY(VisibleAnywhere, Replicated) FVector_NetQuantize10 Home;
    UPROPERTY(VisibleAnywhere, Replicated) float HomeYaw = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) FVector_NetQuantize10 RestPoint;
    // Direction of the push, and the yaw the prop turns through while it tumbles.
    UPROPERTY(VisibleAnywhere, Replicated) float TumbleYaw = 0.f;
    UPROPERTY(VisibleAnywhere, Replicated) float TumbleSpin = 0.f;

private:
    UPROPERTY() TObjectPtr<USceneComponent> PropRoot;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> PropPieces;
    UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
    UPROPERTY() TObjectPtr<UStaticMesh> ConeMesh;
    UPROPERTY() TObjectPtr<UStaticMesh> CylinderMesh;
    FTimerHandle PropResetTimer;
    uint8 BuiltKind = 255;
    uint8 BuiltVariant = 255;
    int32 ResetDeferrals = 0;
    void BuildPieces();
    void ApplyPose(float ServerTime);
    float ServerNow() const;
    void ResetProp();
    UFUNCTION() void OnRep_Kind();
    UFUNCTION() void OnRep_Knock();
};

// Per-car state of the tyre-mark layer on one peer.
struct FQuebecTyreTrail
{
    float LastSpeed = 0.f;
    float Deceleration = 0.f;
    FVector Wheel[2] = {FVector::ZeroVector, FVector::ZeroVector};
    bool bWheel[2] = {false, false};
};

/** Tyre marks on one peer: a pool of thin dark planes in one instanced component, at most
    QuebecTrafficModel::MarkCapacity per world. Marks stay whole for 75 s, narrow away and vanish at 90 s; when the pool
    is full the oldest mark is reused. Local only, so it costs no bandwidth. */
UCLASS(Transient, NotPlaceable)
class QUEBEC_API AQuebecTraceMarks : public AActor
{
    GENERATED_BODY()
    friend class FQuebecTraceMarkPoolTest;
public:
    AQuebecTraceMarks();
    virtual void Tick(float DeltaSeconds) override;
    // The world's mark layer; spawns it when bCreate is set. Null on a dedicated server, which draws nothing.
    static AQuebecTraceMarks* Get(UWorld* World, bool bCreate);
    // Every peer, each frame for a moving car (QuebecTraces::TickCar).
    void TrackCar(AQuebecCar* Car, float DeltaSeconds);
    // One mark from From to To on ground with Normal.
    void LayMark(const FVector& From, const FVector& To, const FVector& Normal);
    // Marks in the pool, and marks still visible now.
    int32 GetMarkCount() const;
    int32 GetVisibleMarkCount() const;

private:
    UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> MarkInstances;
    QuebecTrafficModel::FMarkRing Ring;
    TArray<FTransform> MarkShapes;
    TArray<float> MarkShownScale;
    TMap<TWeakObjectPtr<AQuebecCar>, FQuebecTyreTrail> Trails;
    float WorldNow() const;
    void ShowMark(int32 Slot, float Scale);
};
