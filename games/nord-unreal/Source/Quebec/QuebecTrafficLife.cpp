#include "QuebecGameplay.h"
#include "QuebecCampaign.h"
#include "QuebecPedestrian.h"
#include "QuebecTraces.h"
#include "LaFontaineMap.h"
#include "LaFontaineStops.h"

#include "CollisionQueryParams.h"
#include "CollisionShape.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Character.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "TimerManager.h"

// Traffic street life for ambient AQuebecCar traffic: full stops at mapped ARRET junctions, yielding to people in
// the lane ahead, and curb stops with signals and hazard lights. The rules live in QuebecTrafficModel.h, where
// Scripts/test_traffic_model.py runs them without Unreal; this file gathers the world facts and lights the lamps.

namespace
{
    // Amber lamps at the four corners of the body: 0 front left, 1 front right, 2 rear left, 3 rear right.
    const FVector TrafficLampSpots[4] = {FVector(226.,-74.,-6.),FVector(226.,74.,-6.),FVector(-226.,-74.,-6.),FVector(-226.,74.,-6.)};
    constexpr float TrafficBlinkSeconds = .35f;
    // At most this many cars stand at a curb at once, and never two within 40 m.
    constexpr int32 TrafficCurbStopCap = 3;
    constexpr float TrafficCurbSpacing = 4000.f;
    // People are gathered per car at about 7 Hz within 20 m: the 13 m test reach plus what a car and a runner can
    // close between scans. Their positions are read live on every 20 Hz traffic update.
    constexpr float TrafficPeopleScanSeconds = .15f;
    constexpr float TrafficPeopleRadius = 2000.f;

    bool TrafficRaceActive(UWorld* World)
    {
        for (TActorIterator<AQuebecCampaign> It(World); It; ++It)
            if (It->Phase == EQuebecCampaignPhase::RaceReady || It->Phase == EQuebecCampaignPhase::RaceRunning) return true;
        return false;
    }
}

float AQuebecCar::UpdateTrafficLife(float DesiredSpeed, const FVector& Direction, float Projection)
{
    using namespace QuebecTrafficModel;
    UWorld* const LifeWorld = GetWorld();
    if (!LifeWorld || TrafficSegment == INDEX_NONE) return DesiredSpeed;
    const float Now = LifeWorld->GetTimeSeconds();
    // Real time between traffic updates; a test world with a frozen clock advances by the tick interval.
    const float Elapsed = TrafficClock >= 0.f && Now > TrafficClock ? FMath::Min(Now-TrafficClock,.25f) : FMath::Max(GetActorTickInterval(),1.f/60.f);
    TrafficClock = Now;
    const FVector CarAt = GetActorLocation();
    const FVector LaneRight = FVector::CrossProduct(FVector::UpVector,Direction);

    // ARRET: the nearest mapped stop approach ahead on this street. The table is small (LaFontaineStops.h).
    int32 StopApproach = INDEX_NONE;
    float StopAhead = 1e9f;
    for (int32 I = 0; I < LaFontaine::StopApproachCount; ++I)
    {
        const FVector ToJunction = LaFontaine::StopApproaches[I][0]-CarAt;
        const float Ahead = float(FVector::DotProduct(ToJunction,Direction));
        if (Ahead < StopAhead && StopApplies(Ahead,float(FVector::DotProduct(ToJunction,LaneRight)),
            float(FVector::DotProduct(Direction,LaFontaine::StopApproaches[I][1]))))
        {
            StopApproach = I;
            StopAhead = Ahead;
        }
    }
    DesiredSpeed = TrafficStop.Update(StopApproach,StopAhead,Speed,Elapsed,DesiredSpeed);

    // Curb stops: seeded per car, rare, only on long parking streets well clear of junctions.
    TrafficCurb.Advance(Elapsed,Mix(uint32(TrafficSegment+1)*2654435761U^uint32(PaintStyle+7)*40503U^uint32(GetFName().GetNumber())));
    if (TrafficCurb.Due(TrafficSegment))
    {
        const FVector SegmentStart = LaFontaine::RoadSegments[TrafficSegment][bTrafficForward ? 0 : 1];
        const float SegmentLength = float(FVector::Dist2D(LaFontaine::RoadSegments[TrafficSegment][0],LaFontaine::RoadSegments[TrafficSegment][1]));
        FCurbSite Site;
        Site.Along = Projection;
        Site.SegmentLength = SegmentLength;
        Site.StopAhead = StopApproach == INDEX_NONE ? 1e9f : StopAhead-StopLine;
        // RoadParkingSides marks the left (1) and right (2) curbs of the surveyed segment direction.
        Site.bParkingSide = (LaFontaine::RoadParkingSides[TrafficSegment] & (bTrafficForward ? 2 : 1)) != 0;
        Site.bRace = TrafficRaceActive(LifeWorld);
        int32 StoppedCars = 0;
        for (TActorIterator<AQuebecCar> It(LifeWorld); It; ++It)
            if (*It != this && It->bTraffic && It->TrafficCurb.Phase != ECurbPhase::Cruise)
            {
                ++StoppedCars;
                if (FVector::DistSquared2D(It->GetActorLocation(),CarAt) < FMath::Square(TrafficCurbSpacing)) ++Site.NearbyStops;
            }
        if (StoppedCars >= TrafficCurbStopCap) ++Site.NearbyStops;
        const float StopAlong = CurbStopAlong(Site);
        if (Site.bRace || Site.NearbyStops > 0) TrafficCurb.Retry(TrafficSegment,false);
        else if (StopAlong < 0.f)
        {
            // A segment that is too short, has no stopping curb, or is already behind the car is skipped until it turns.
            const bool bNever = !Site.bParkingSide || Projection+CurbAhead > SegmentLength-CurbJunctionClear;
            TrafficCurb.Retry(TrafficSegment,bNever);
        }
        else
        {
            // The curb must be real (a raised step 12-32 cm high), far enough out to clear the lane, and the curb lane
            // must be free of parked cars, people and posts from 16 m before the stop point to 4 m past it.
            const FVector StopCentre = SegmentStart+Direction*StopAlong;
            const FQuat Facing = Direction.Rotation().Quaternion();
            float Edge = 0.f;
            bool bUsable = QuebecStreet::FindCurb(LifeWorld,FVector(StopCentre.X,StopCentre.Y,CarAt.Z),Direction,LaneRight,Edge) &&
                CurbOffsetFits(Edge-CurbBodyGap);
            const float CurbOffset = Edge-CurbBodyGap;
            if (bUsable)
            {
                const FVector Parked = FVector(StopCentre.X,StopCentre.Y,CarAt.Z)+LaneRight*CurbOffset;
                FCollisionQueryParams Query(SCENE_QUERY_STAT(TrafficCurbLane),false,this);
                FHitResult Blocker;
                bUsable = !LifeWorld->SweepSingleByChannel(Blocker,Parked-Direction*1600.,Parked+Direction*400.,Facing,ECC_Pawn,
                    FCollisionShape::MakeBox(FVector(235.,105.,80.)),Query) && CanFitAt(Parked,Facing);
            }
            if (bUsable) TrafficCurb.Begin(TrafficSegment,StopAlong,CurbOffset);
            else TrafficCurb.Retry(TrafficSegment,true);
        }
    }
    bool bLaneClear = true;
    if (TrafficCurb.Phase == ECurbPhase::Signal)
        for (TActorIterator<AQuebecCar> It(LifeWorld); It && bLaneClear; ++It)
        {
            if (*It == this) continue;
            // Anything in the lane from 25 m behind to 4 m ahead keeps the car waiting at the curb.
            const FVector ToOther = It->GetActorLocation()-CarAt;
            const float Behind = float(FVector::DotProduct(ToOther,Direction));
            const float Across = float(FVector::DotProduct(ToOther,LaneRight));
            bLaneClear = !(Behind > -2500.f && Behind < 400.f && Across < -60.f && Across > CurbLane-TrafficCurb.Offset-260.f);
        }
    uint8 Signal = SignalOff;
    DesiredSpeed = TrafficCurb.Update(TrafficSegment,Projection,Speed,DesiredSpeed,bLaneClear,Signal);
    if (Signal != TrafficSignal) SetTrafficSignal(Signal);

    // People in the lane ahead: residents and pedestrians have no collision, so positions are tested directly.
    // Characters (players, officers) are included for the slow-down; the movement sweep still stops for them.
    float NearestGap = -1.f;
    TrafficPeopleScanIn -= Elapsed;
    if (DesiredSpeed > 0.f && TrafficYield.IgnoreFor <= 0.f)
    {
        if (TrafficPeopleScanIn <= 0.f)
        {
            TrafficPeopleScanIn = TrafficPeopleScanSeconds;
            TrafficPeopleNear.Reset();
            const auto Collect = [this,&CarAt](AActor* Person)
            {
                if (Person && FVector::DistSquared2D(Person->GetActorLocation(),CarAt) < FMath::Square(TrafficPeopleRadius)) TrafficPeopleNear.Add(Person);
            };
            for (TActorIterator<AQuebecParkResident> It(LifeWorld); It; ++It) Collect(*It);
            for (TActorIterator<AQuebecPedestrian> It(LifeWorld); It; ++It) Collect(*It);
            for (TActorIterator<ACharacter> It(LifeWorld); It; ++It) Collect(*It);
        }
        const FVector CarForward = GetActorForwardVector().GetSafeNormal2D();
        const FVector CarRight = FVector::CrossProduct(FVector::UpVector,CarForward);
        const auto Consider = [&NearestGap,&CarAt,&CarForward,&CarRight](const AActor* Person)
        {
            if (!Person || Person->IsHidden()) return;
            const FVector ToPerson = Person->GetActorLocation()-CarAt;
            if (ToPerson.SizeSquared2D() > FMath::Square(1300.)) return;
            const float Gap = LaneGap(float(FVector::DotProduct(ToPerson,CarForward)),float(FVector::DotProduct(ToPerson,CarRight)),float(ToPerson.Z));
            if (Gap >= 0.f && (NearestGap < 0.f || Gap < NearestGap)) NearestGap = Gap;
        };
        for (const TWeakObjectPtr<AActor>& Near : TrafficPeopleNear) Consider(Near.Get());
    }
    return TrafficYield.Update(NearestGap,Elapsed,DesiredSpeed);
}

void AQuebecCar::ClearTrafficLife()
{
    TrafficStop = QuebecTrafficModel::FStopGate();
    TrafficYield = QuebecTrafficModel::FYield();
    // Keep the car's seed and schedule clock; only the manoeuvre ends.
    if (TrafficCurb.Phase != QuebecTrafficModel::ECurbPhase::Cruise) TrafficCurb.Finish();
    if (HasAuthority()) SetTrafficSignal(QuebecTrafficModel::SignalOff);
}

void AQuebecCar::SetTrafficSignal(uint8 NewSignal)
{
    if (TrafficSignal == NewSignal) return;
    TrafficSignal = NewSignal;
    ForceNetUpdate();
    OnRep_TrafficSignal();
}

void AQuebecCar::OnRep_TrafficSignal()
{
    if (!GetWorld()) return;
    FTimerManager& Timers = GetWorldTimerManager();
    if (TrafficSignal == QuebecTrafficModel::SignalOff)
    {
        Timers.ClearTimer(TrafficBlinkTimer);
        bTrafficLampsLit = false;
        for (UStaticMeshComponent* Lamp : TrafficLamps) if (Lamp) Lamp->SetVisibility(false);
        return;
    }
    if (TrafficLamps.Num() == 0 && GetNetMode() != NM_DedicatedServer)
    {
        // Built on first use: most cars never signal. M_Light is the emissive lamp material; tint it amber when the
        // material exposes its Tint parameter, otherwise keep its warm white.
        UStaticMesh* LampMesh = LoadObject<UStaticMesh>(nullptr,TEXT("/Engine/BasicShapes/Cube.Cube"));
        UMaterialInterface* LampBase = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/Materials/M_Light.M_Light"));
        UMaterialInstanceDynamic* Amber = LampBase ? UMaterialInstanceDynamic::Create(LampBase,this) : nullptr;
        if (Amber) Amber->SetVectorParameterValue(TEXT("Tint"),FLinearColor(1.f,.38f,.02f));
        TrafficLampPaint = Amber ? Amber : LampBase;
        for (int32 I = 0; I < 4 && LampMesh; ++I)
        {
            UStaticMeshComponent* Lamp = NewObject<UStaticMeshComponent>(this,FName(*FString::Printf(TEXT("TrafficLamp%d"),I)));
            Lamp->SetupAttachment(GetRootComponent());
            Lamp->SetStaticMesh(LampMesh);
            Lamp->SetRelativeLocation(TrafficLampSpots[I]);
            Lamp->SetRelativeScale3D(FVector(.06,.16,.07));
            Lamp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
            Lamp->SetGenerateOverlapEvents(false);
            Lamp->SetCanEverAffectNavigation(false);
            Lamp->SetCastShadow(false);
            Lamp->SetVisibility(false);
            // The car's BeginPlay and ApplyPaint leave components with this tag alone.
            Lamp->ComponentTags.Add(TEXT("NordOwnPaint"));
            if (TrafficLampPaint) Lamp->SetMaterial(0,TrafficLampPaint);
            Lamp->RegisterComponent();
            TrafficLamps.Add(Lamp);
        }
    }
    bTrafficLampsLit = false;
    BlinkTrafficSignal();
    if (!Timers.IsTimerActive(TrafficBlinkTimer))
        Timers.SetTimer(TrafficBlinkTimer,this,&AQuebecCar::BlinkTrafficSignal,TrafficBlinkSeconds,true);
}

void AQuebecCar::BlinkTrafficSignal()
{
    // A car that left traffic (a player, an autopilot or a wreck took it) drops its manoeuvre and its lamps.
    if (!bTraffic && HasAuthority() && TrafficSignal != QuebecTrafficModel::SignalOff) { ClearTrafficLife(); return; }
    const uint8 Shown = bTraffic ? TrafficSignal : QuebecTrafficModel::SignalOff;
    bTrafficLampsLit = !bTrafficLampsLit && Shown != QuebecTrafficModel::SignalOff;
    for (int32 I = 0; I < TrafficLamps.Num(); ++I)
    {
        const bool bThisSide = Shown == QuebecTrafficModel::SignalHazard || (Shown == QuebecTrafficModel::SignalLeft) == (I%2 == 0);
        UStaticMeshComponent* Lamp = TrafficLamps[I];
        if (!Lamp) continue;
        const bool bLit = bTrafficLampsLit && bThisSide;
        // Lamps built before BeginPlay on a client could be repainted with the body; restore the amber when lit.
        if (bLit && TrafficLampPaint && Lamp->GetMaterial(0) != TrafficLampPaint.Get()) Lamp->SetMaterial(0,TrafficLampPaint);
        Lamp->SetVisibility(bLit);
    }
    if (Shown == QuebecTrafficModel::SignalOff && GetWorld()) GetWorldTimerManager().ClearTimer(TrafficBlinkTimer);
}
