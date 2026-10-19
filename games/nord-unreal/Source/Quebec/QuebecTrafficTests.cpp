#include "QuebecGameplay.h"
#include "QuebecGTA.h"
#include "QuebecTraces.h"
#include "LaFontaineMap.h"
#include "LaFontaineStops.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/BoxComponent.h"
#include "Engine/World.h"
#include "Misc/AutomationTest.h"

namespace
{
    // An isolated authority world with a flat floor and the surveyed road coordinates; no saved map, city or crowd.
    struct FTrafficTestWorld
    {
        UWorld* World = nullptr;
        TArray<bool> Roads;

        FTrafficTestWorld()
        {
            UWorld::InitializationValues Initialization;
            Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
            World = UWorld::CreateWorld(EWorldType::Game,false,NAME_None,nullptr,true,ERHIFeatureLevel::Num,&Initialization);
            if (!World) return;
            Block(FVector(0.,0.,-20.),FVector(200000.,200000.,20.),FRotator::ZeroRotator);
            Roads.Init(true,UE_ARRAY_COUNT(LaFontaine::RoadSegments));
        }
        ~FTrafficTestWorld() { if (World) World->DestroyWorld(false); }

        void Block(const FVector& Center, const FVector& Extent, const FRotator& Rotation) const
        {
            AActor* Actor = World->SpawnActor<AActor>();
            UBoxComponent* Box = NewObject<UBoxComponent>(Actor);
            Actor->SetRootComponent(Box);
            Box->SetBoxExtent(Extent);
            Box->SetCollisionProfileName(TEXT("BlockAll"));
            Box->SetCollisionObjectType(ECC_WorldStatic);
            Box->RegisterComponent();
            Actor->SetActorLocationAndRotation(Center,Rotation);
        }
        template <typename T> T* Spawn(const FVector& Location, const FRotator& Rotation) const
        {
            FActorSpawnParameters Parameters;
            Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            return World->SpawnActor<T>(Location,Rotation,Parameters);
        }
        // A traffic car in the right-hand lane of Segment, Along cm from the segment start in its travel direction.
        AQuebecCar* TrafficCar(int32 Segment, bool bForward, float Along) const
        {
            const FVector Start = LaFontaine::RoadSegments[Segment][bForward ? 0 : 1], End = LaFontaine::RoadSegments[Segment][bForward ? 1 : 0];
            const FVector Direction = (End-Start).GetSafeNormal2D();
            AQuebecCar* Car = Spawn<AQuebecCar>(Start+Direction*Along+FVector::CrossProduct(FVector::UpVector,Direction)*145.+FVector(0.,0.,102.),
                Direction.Rotation());
            if (Car) Car->SetTrafficRoute(Segment,bForward,Roads);
            return Car;
        }
    };

    float TrafficSegmentLength(int32 Segment) { return float(FVector::Dist2D(LaFontaine::RoadSegments[Segment][0],LaFontaine::RoadSegments[Segment][1])); }

    // A long straight segment with a parking curb on the right of forward travel and no ARRET within 30 m of its ends.
    int32 QuietTrafficSegment(float MinLength)
    {
        for (int32 I = 0; I < UE_ARRAY_COUNT(LaFontaine::RoadSegments); ++I)
        {
            if (TrafficSegmentLength(I) < MinLength || !(LaFontaine::RoadParkingSides[I] & 2)) continue;
            bool bQuiet = true;
            for (int32 Stop = 0; Stop < LaFontaine::StopApproachCount; ++Stop)
                for (int32 Side = 0; Side < 2; ++Side)
                    bQuiet &= FVector::Dist2D(LaFontaine::StopApproaches[Stop][0],LaFontaine::RoadSegments[I][Side]) > 3000.;
            if (bQuiet) return I;
        }
        return INDEX_NONE;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTrafficStopSignTest,"Quebec.Traffic.StopSignFullStop",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTrafficStopSignTest::RunTest(const FString& Parameters)
{
    // Walk back from a mapped ARRET approach along the same street to a point 22 m before the junction.
    int32 Segment = INDEX_NONE, Approach = INDEX_NONE;
    bool bForward = true;
    float StartAlong = 0.f;
    for (int32 Stop = 0; Stop < LaFontaine::StopApproachCount && Segment == INDEX_NONE; ++Stop)
    {
        const FVector Junction = LaFontaine::StopApproaches[Stop][0], Into = LaFontaine::StopApproaches[Stop][1];
        int32 Current = LaFontaine::StopSegments[Stop];
        bool bCurrentForward = FVector::Dist2D(LaFontaine::RoadSegments[Current][1],Junction) <= 40.;
        float Covered = TrafficSegmentLength(Current);
        for (int32 Step = 0; Step < 8 && Covered < 2400.f; ++Step)
        {
            const FVector Far = LaFontaine::RoadSegments[Current][bCurrentForward ? 0 : 1];
            int32 Previous = INDEX_NONE;
            for (int32 I = 0; I < UE_ARRAY_COUNT(LaFontaine::RoadSegments) && Previous == INDEX_NONE; ++I)
                for (int32 Side = 0; Side < 2 && Previous == INDEX_NONE; ++Side)
                    if (I != Current && FVector::Dist2D(LaFontaine::RoadSegments[I][Side],Far) <= 40. &&
                        FVector::DotProduct((LaFontaine::RoadSegments[I][Side]-LaFontaine::RoadSegments[I][1-Side]).GetSafeNormal2D(),Into) >= .95)
                    { Previous = I; bCurrentForward = Side == 1; }
            if (Previous == INDEX_NONE) break;
            Current = Previous;
            Covered += TrafficSegmentLength(Current);
        }
        if (Covered < 2400.f) continue;
        // The car starts on the farthest segment of the walk, 22 m before the junction.
        const FVector SegmentStart = LaFontaine::RoadSegments[Current][bCurrentForward ? 0 : 1];
        StartAlong = float(FVector::DotProduct((Junction-Into*2200.)-SegmentStart,Into));
        if (StartAlong < 0.f || StartAlong > TrafficSegmentLength(Current)) continue;
        Segment = Current; bForward = bCurrentForward; Approach = Stop;
    }
    if (!TestTrue(TEXT("A mapped ARRET approach has 24 m of straight street before it"),Segment != INDEX_NONE)) return false;
    FTrafficTestWorld Fixture;
    if (!TestNotNull(TEXT("Isolated traffic world"),Fixture.World)) return false;
    AQuebecCar* Car = Fixture.TrafficCar(Segment,bForward,StartAlong);
    if (!TestNotNull(TEXT("Traffic car"),Car)) return false;
    const FVector Junction = LaFontaine::StopApproaches[Approach][0];
    float StillFor = 0.f, LongestStill = 0.f, StoppedAt = -1.f, Closest = 1e9f, Elapsed = 0.f;
    bool bHandbrakeWhileStill = true;
    for (int32 Frame = 0; Frame < 300 && Closest > 300.f; ++Frame)
    {
        Car->Tick(.05f);
        Elapsed += .05f;
        const float Distance = float(FVector::Dist2D(Car->GetActorLocation(),Junction));
        Closest = FMath::Min(Closest,Distance);
        if (FMath::Abs(Car->Speed) < QuebecTrafficModel::StopSpeed && Distance > 600.f)
        {
            StillFor += .05f;
            if (StoppedAt < 0.f) StoppedAt = Distance;
            if (StillFor < QuebecTrafficModel::StopHold) bHandbrakeWhileStill &= Car->bHandbrake;
        }
        else { LongestStill = FMath::Max(LongestStill,StillFor); StillFor = 0.f; }
    }
    LongestStill = FMath::Max(LongestStill,StillFor);
    AddInfo(FString::Printf(TEXT("ARRET approach %d: stopped %.0f cm from the junction centre for %.2f s; reached the junction after %.2f s"),
        Approach,StoppedAt,LongestStill,Elapsed));
    TestTrue(TEXT("Traffic comes to a full stop before the ARRET junction, not inside it"),StoppedAt > 850.f && StoppedAt < 1100.f);
    TestTrue(TEXT("The stop lasts at least 0.8 s below 30 cm/s"),LongestStill >= QuebecTrafficModel::StopHold-.01f);
    TestTrue(TEXT("The car brakes on its handbrake while it holds"),bHandbrakeWhileStill);
    TestTrue(TEXT("Then it proceeds into the junction"),Closest <= 300.f && Car->TrafficStop.bServed);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTrafficYieldTest,"Quebec.Traffic.YieldToPeople",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTrafficYieldTest::RunTest(const FString& Parameters)
{
    const int32 Segment = QuietTrafficSegment(6000.f);
    if (!TestTrue(TEXT("A long quiet street exists"),Segment != INDEX_NONE)) return false;
    FTrafficTestWorld Fixture;
    if (!TestNotNull(TEXT("Isolated traffic world"),Fixture.World)) return false;
    AQuebecCar* Car = Fixture.TrafficCar(Segment,true,600.f);
    if (!TestNotNull(TEXT("Traffic car"),Car)) return false;
    const FVector Forward = Car->GetActorForwardVector().GetSafeNormal2D();
    const FVector Right = FVector::CrossProduct(FVector::UpVector,Forward);
    const FVector Ground = FVector(Car->GetActorLocation().X,Car->GetActorLocation().Y,7.);
    // A resident has no collision at all: only the position test can see it.
    AQuebecParkResident* Resident = Fixture.Spawn<AQuebecParkResident>(Ground+Forward*1100.,FRotator(0.,90.,0.));
    if (!TestNotNull(TEXT("Resident on the crossing"),Resident)) return false;
    float MinGap = 1e9f;
    for (int32 Frame = 0; Frame < 80; ++Frame)
    {
        Car->Tick(.05f);
        MinGap = FMath::Min(MinGap,float(FVector::DotProduct(Resident->GetActorLocation()-Car->GetActorLocation(),Forward))-QuebecTrafficModel::YieldBumper);
    }
    AddInfo(FString::Printf(TEXT("Closest front-bumper gap to the resident: %.0f cm"),MinGap));
    TestTrue(TEXT("Traffic stops for a resident in its lane"),FMath::Abs(Car->Speed) < 30.f && Car->bHandbrake);
    TestTrue(TEXT("It stops short of the resident"),MinGap >= 150.f && MinGap <= QuebecTrafficModel::YieldReach);
    // The resident steps onto the sidewalk: the lane is free again.
    Resident->SetActorLocation(Resident->GetActorLocation()+Right*600.);
    for (int32 Frame = 0; Frame < 40; ++Frame) Car->Tick(.05f);
    TestTrue(TEXT("A person on the sidewalk beside the lane does not hold traffic"),Car->Speed > 200.f);
    // A walking player ahead (collision off, so the movement sweep cannot see it) slows and stops the car too.
    AQuebecCharacter* Walker = Fixture.Spawn<AQuebecCharacter>(Car->GetActorLocation()+Forward*1000.,FRotator::ZeroRotator);
    if (!TestNotNull(TEXT("Walking player"),Walker)) return false;
    Walker->SetActorEnableCollision(false);
    float LowestSpeed = Car->Speed;
    for (int32 Frame = 0; Frame < 60; ++Frame) { Car->Tick(.05f); LowestSpeed = FMath::Min(LowestSpeed,Car->Speed); }
    TestTrue(TEXT("A player walking in front of traffic is given way"),LowestSpeed < 30.f &&
        FVector::DotProduct(Walker->GetActorLocation()-Car->GetActorLocation(),Forward) > QuebecTrafficModel::YieldBumper+100.);
    // Pure rule: a person 8 m beyond the bumper or 2 m to the side is ignored.
    TestTrue(TEXT("Only the lane ahead counts"),QuebecTrafficModel::LaneGap(1200.f,0.f,0.f) < 0.f && QuebecTrafficModel::LaneGap(600.f,220.f,0.f) < 0.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTrafficCurbStopTest,"Quebec.Traffic.CurbStopClearOfJunctions",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTrafficCurbStopTest::RunTest(const FString& Parameters)
{
    using namespace QuebecTrafficModel;
    // The planner never picks a stop point within 24 m of the junction ahead, at the junction behind, near an ARRET,
    // on a no-stopping curb, beside another stopped car, or during the race.
    FCurbSite Site;
    Site.SegmentLength = 6000.f;
    Site.bParkingSide = true;
    bool bClear = true;
    for (float Along = 0.f; Along <= Site.SegmentLength; Along += 50.f)
    {
        Site.Along = Along;
        const float Stop = CurbStopAlong(Site);
        if (Stop >= 0.f) bClear &= Stop <= Site.SegmentLength-CurbJunctionClear && Stop >= CurbStartAlong+CurbAhead;
    }
    TestTrue(TEXT("Every planned curb stop lies at least 24 m from both junctions"),bClear);
    Site.Along = 600.f;
    TestTrue(TEXT("A mid-block stretch of parking curb is used"),CurbStopAlong(Site) > 0.f);
    Site.bRace = true;
    TestTrue(TEXT("No curb stop starts during the campaign race"),CurbStopAlong(Site) < 0.f);
    Site.bRace = false; Site.StopAhead = 3000.f;
    TestTrue(TEXT("No curb stop starts in an ARRET approach"),CurbStopAlong(Site) < 0.f);

    // A whole curb stop on a real street with an 18 cm curb 5.5 m from the centre line.
    const int32 Segment = QuietTrafficSegment(6000.f);
    if (!TestTrue(TEXT("A long quiet parking street exists"),Segment != INDEX_NONE)) return false;
    FTrafficTestWorld Fixture;
    if (!TestNotNull(TEXT("Isolated traffic world"),Fixture.World)) return false;
    const FVector SegmentStart = LaFontaine::RoadSegments[Segment][0];
    const FVector Direction = (LaFontaine::RoadSegments[Segment][1]-SegmentStart).GetSafeNormal2D();
    const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
    const float Length = TrafficSegmentLength(Segment);
    Fixture.Block(SegmentStart+Direction*(Length*.5)+Right*700.+FVector(0.,0.,9.),FVector(Length*.5,150.,9.),Direction.Rotation());
    AQuebecCar* Car = Fixture.TrafficCar(Segment,true,600.f);
    if (!TestNotNull(TEXT("Traffic car"),Car)) return false;
    // Make the seeded stop due now instead of minutes from now.
    Car->TrafficCurb.Seed = 17U;
    Car->TrafficCurb.NextAt = 0.f;
    bool bSignalledRight = false;
    float StopAlong = -1.f, StopOffset = 0.f;
    for (int32 Frame = 0; Frame < 400 && StopAlong < 0.f; ++Frame)
    {
        Car->Tick(.05f);
        bSignalledRight |= Car->TrafficSignal == SignalRight;
        if (Car->TrafficSignal == SignalHazard)
        {
            StopAlong = float(FVector::DotProduct(Car->GetActorLocation()-SegmentStart,Direction));
            StopOffset = float(FVector::DotProduct(Car->GetActorLocation()-SegmentStart,Right));
        }
    }
    AddInfo(FString::Printf(TEXT("Curb stop at %.0f cm along a %.0f cm street, %.0f cm from its centre line"),StopAlong,Length,StopOffset));
    TestTrue(TEXT("The car signals right before it pulls over"),bSignalledRight);
    TestTrue(TEXT("It stops with hazard lights at the curb, clear of the lane"),StopAlong > 0.f && StopOffset >= CurbMinOffset-40.f && StopOffset <= 470.f);
    TestTrue(TEXT("The stop is never at a junction"),StopAlong >= CurbStartAlong+CurbAhead-CurbArrive && StopAlong <= Length-CurbJunctionClear+5.f);
    TestTrue(TEXT("It stays 15-40 s"),Car->TrafficCurb.Until-Car->TrafficCurb.Clock >= CurbPark-1.f && Car->TrafficCurb.Until-Car->TrafficCurb.Clock <= CurbPark+CurbParkSpan+.1f);
    // Skip the wait: the car signals left, merges back and drives on in its lane.
    Car->TrafficCurb.Until = Car->TrafficCurb.Clock;
    bool bSignalledLeft = false;
    for (int32 Frame = 0; Frame < 300 && Car->TrafficCurb.Phase != ECurbPhase::Cruise; ++Frame)
    {
        Car->Tick(.05f);
        bSignalledLeft |= Car->TrafficSignal == SignalLeft;
    }
    for (int32 Frame = 0; Frame < 20; ++Frame) Car->Tick(.05f);
    const float LaneOffset = float(FVector::DotProduct(Car->GetActorLocation()-SegmentStart,Right));
    TestTrue(TEXT("It signals left and rejoins the traffic lane"),bSignalledLeft && Car->TrafficCurb.Phase == ECurbPhase::Cruise &&
        FMath::Abs(LaneOffset-CurbLane) < 70.f && Car->TrafficSignal == SignalOff && Car->Speed > 200.f);
    TestTrue(TEXT("The next curb stop is minutes away"),Car->TrafficCurb.NextAt-Car->TrafficCurb.Clock >= CurbEvery-1.f);
    // A car that leaves traffic (a player or an autopilot takes it) drops the manoeuvre and its lamps.
    Car->TrafficCurb.Begin(Segment,Length-CurbJunctionClear,420.f);
    Car->SetTrafficSignal(SignalRight);
    Car->bTraffic = false;
    Car->BlinkTrafficSignal();
    TestTrue(TEXT("Leaving traffic turns the lamps off and ends the curb stop"),Car->TrafficSignal == SignalOff && Car->TrafficCurb.Phase == ECurbPhase::Cruise);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTraceMarkPoolTest,"Quebec.Traffic.TracePoolCap",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTraceMarkPoolTest::RunTest(const FString& Parameters)
{
    FTrafficTestWorld Fixture;
    if (!TestNotNull(TEXT("Isolated traffic world"),Fixture.World)) return false;
    AQuebecCar* Car = Fixture.Spawn<AQuebecCar>(FVector(0.,0.,102.),FRotator::ZeroRotator);
    if (!TestNotNull(TEXT("Car"),Car)) return false;
    // An empty world is safe: no layer for a slow car, and no props to strike.
    QuebecTraces::TickCar(Car,1.f/60.f);
    QuebecTraces::StrikeProps(Car,FVector(0.,0.,102.),FVector(50.,0.,102.),1500.f);
    TestNull(TEXT("A slow car creates no mark layer"),AQuebecTraceMarks::Get(Fixture.World,false));
    // Ambient traffic braking on its handbrake at a stop leaves no marks.
    Car->bTraffic = true;
    Car->bHandbrake = true;
    Car->Speed = 600.f;
    for (int32 Frame = 0; Frame < 60; ++Frame)
    {
        Car->SetActorLocation(Car->GetActorLocation()+FVector(10.,0.,0.));
        QuebecTraces::TickCar(Car,1.f/60.f);
    }
    AQuebecTraceMarks* Layer = AQuebecTraceMarks::Get(Fixture.World,false);
    TestTrue(TEXT("Traffic stopping at an ARRET leaves the road clean"),!Layer || Layer->GetMarkCount() == 0);
    // A long handbrake slide lays far more marks than the pool holds.
    Car->bTraffic = false;
    Car->Speed = 1500.f;
    Car->LateralSpeed = 600.f;
    for (int32 Frame = 0; Frame < 3000; ++Frame)
    {
        Car->SetActorLocation(Car->GetActorLocation()+FVector(45.,0.,0.));
        QuebecTraces::TickCar(Car,1.f/60.f);
    }
    Layer = AQuebecTraceMarks::Get(Fixture.World,false);
    if (!TestNotNull(TEXT("A skidding car creates the mark layer"),Layer)) return false;
    AddInfo(FString::Printf(TEXT("Marks in the pool after a 1350 m slide: %d (written %d slots)"),Layer->GetMarkCount(),Layer->Ring.Count));
    TestEqual(TEXT("The tyre-mark pool is capped per world"),Layer->GetMarkCount(),QuebecTrafficModel::MarkCapacity);
    TestEqual(TEXT("Every pooled mark is visible while fresh"),Layer->GetVisibleMarkCount(),QuebecTrafficModel::MarkCapacity);
    // 90 s later the marks are gone but the pool is kept for reuse.
    Fixture.World->TimeSeconds = 100.;
    Layer->Tick(1.f);
    TestEqual(TEXT("Marks fade away after 90 s"),Layer->GetVisibleMarkCount(),0);
    TestEqual(TEXT("The pooled instances are reused, not destroyed"),Layer->GetMarkCount(),QuebecTrafficModel::MarkCapacity);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTracePropTest,"Quebec.Traffic.StreetPropKnock",EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTracePropTest::RunTest(const FString& Parameters)
{
    FTrafficTestWorld Fixture;
    if (!TestNotNull(TEXT("Isolated traffic world"),Fixture.World)) return false;
    AQuebecStreetProp* Cone = AQuebecStreetProp::SpawnProp(Fixture.World,AQuebecStreetProp::KindCone,FVector(0.,0.,0.),0.f);
    AQuebecStreetProp* Bin = AQuebecStreetProp::SpawnProp(Fixture.World,AQuebecStreetProp::KindRecycling,FVector(0.,300.,0.),90.f);
    AQuebecCar* Car = Fixture.Spawn<AQuebecCar>(FVector(-600.,0.,102.),FRotator::ZeroRotator);
    if (!TestNotNull(TEXT("Cone"),Cone) || !TestNotNull(TEXT("Bin"),Bin) || !TestNotNull(TEXT("Car"),Car)) return false;
    Car->Speed = 1500.f;
    // One 3 m step: the car body sweeps over the cone and passes 3 m from the bin.
    QuebecTraces::StrikeProps(Car,FVector(-400.,0.,102.),FVector(-100.,0.,102.),1500.f);
    TestTrue(TEXT("A car knocks over the cone in its path"),Cone->IsKnocked());
    TestFalse(TEXT("A bin 3 m to the side stays standing"),Bin->IsKnocked());
    TestTrue(TEXT("The cone flies ahead of the car"),Cone->RestPoint.X > 150.);
    Cone->ApplyPose(Cone->KnockedAt+2.f);
    TestTrue(TEXT("It comes to rest lying on its side where it fell"),FVector::Dist2D(Cone->GetActorLocation(),FVector(Cone->RestPoint)) < 1. &&
        FMath::Abs(Cone->GetActorUpVector().Z) < .2);
    TestFalse(TEXT("A fallen cone is not knocked again"),Cone->Knock(FVector(1500.,0.,0.),FVector(-100.,0.,102.),Car));
    Cone->ResetProp();
    TestTrue(TEXT("After the reset it stands at home again"),!Cone->IsKnocked() && FVector::Dist(Cone->GetActorLocation(),FVector::ZeroVector) < 1. &&
        Cone->GetActorUpVector().Z > .99);
    TestTrue(TEXT("Props reset 120 s after a hit"),FMath::IsNearlyEqual(QuebecTrafficModel::PropReset,120.f));
    TestTrue(TEXT("The prop count stays modest"),AQuebecStreetProp::MaxProps <= 60);
    return true;
}
#endif
