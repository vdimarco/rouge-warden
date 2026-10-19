// AQuebecCar for the street systems: lag-tolerant steering on roads, the AI driver (autopilot), police livery,
// body damage and smoke, people and props struck by a car, rams reported to the police, and wall forgiveness.
#include "QuebecGameplay.h"
#include "QuebecGTA.h"
#include "LaFontaineMap.h"
#include "LaFontaineExtensionMap.h"
#include "CollegeBathurstMap.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Materials/MaterialInterface.h"

namespace
{
    // QuebecPeople knocks a person down above this car speed; slower contact still stops at the person.
    constexpr float StrikeKnockSpeed = 450.f;
    // A knocked-down person's capsule stays out of the car's way at least this long, and while they are down.
    constexpr float PassedBodySeconds = 1.5f;
    // A ram this hard on a car with a driver is a crime; one report per second per car at most.
    constexpr float RamReportSpeed = 300.f;
    constexpr float SmokeDamage = 60.f;
    constexpr int32 SmokePuffCount = 7;
    constexpr float SmokePuffLife = 1.4f;

    constexpr int32 TorontoRoads = static_cast<int32>(UE_ARRAY_COUNT(CollegeBathurst::RoadSegments));
    constexpr int32 MontrealRoads = static_cast<int32>(UE_ARRAY_COUNT(LaFontaine::RoadSegmentWidths));
    constexpr int32 ExtensionRoads = static_cast<int32>(UE_ARRAY_COUNT(LaFontaineExtension::RoadSegmentWidths));
    static_assert(TorontoRoads != static_cast<int32>(UE_ARRAY_COUNT(LaFontaine::RoadSegments)) &&
        TorontoRoads != static_cast<int32>(UE_ARRAY_COUNT(LaFontaineExtension::RadarRoadSegments)), "Road arrays are told apart by length");

    // Curb-to-curb width of segment Index of the world's road array. Each translation unit has its own copy of the
    // map arrays, so the array is recognised by its length rather than its address.
    float RoadWidthAt(const QuebecDistrict::FSettings& District, int32 Index)
    {
        if (District.RoadCount == TorontoRoads)
            return Index < static_cast<int32>(UE_ARRAY_COUNT(CollegeBathurst::RoadSegmentWidths)) ? CollegeBathurst::RoadSegmentWidths[Index] : 900.f;
        if (Index < MontrealRoads) return LaFontaine::RoadSegmentWidths[Index];
        return Index-MontrealRoads < ExtensionRoads ? LaFontaineExtension::RoadSegmentWidths[Index-MontrealRoads] : 900.f;
    }
}

void AQuebecCar::SetAutopilot(float NewThrottle, float NewSteering, bool bNewHandbrake)
{
    if (!HasAuthority() || Controller || !FMath::IsFinite(NewThrottle) || !FMath::IsFinite(NewSteering)) return;
    if (!bAutopilot)
    {
        // The AI drives the player model every frame; a traffic car gives up its route and junction for good.
        // ClearAutopilot returns to the resting interval this car had (a struck car's 0 is not a resting interval).
        // A car re-engaged while still braking from the last release keeps the interval recorded then.
        if (!bRestoreRestTick) AutopilotRestTick = GetActorTickInterval() > 0.f ? GetActorTickInterval() : (bTraffic ? .05f : .1f);
        bRestoreRestTick = false;
        bTraffic = false;
        TrafficSegment = INDEX_NONE;
        bJunctionReserved = bJunctionEntered = false;
        SetActorTickInterval(0.f);
        bAutopilot = true;
    }
    AutopilotThrottle = FMath::Clamp(NewThrottle,-1.f,1.f);
    AutopilotSteering = FMath::Clamp(NewSteering,-1.f,1.f);
    bAutopilotHandbrake = bNewHandbrake;
    LastDriveInputTime = GetWorld()->GetTimeSeconds();
}

void AQuebecCar::ClearAutopilot()
{
    if (!HasAuthority() || !bAutopilot) return;
    bAutopilot = bAutopilotHandbrake = false;
    AutopilotThrottle = AutopilotSteering = 0.f;
    if (Controller) return;
    StopInput();
    // The released car brakes on every-frame ticks, so no peer sees it step at 10 Hz; FinishDriveTick restores
    // the resting interval once it stands still.
    bRestoreRestTick = true;
    FinishAutopilotRelease();
}

void AQuebecCar::FinishAutopilotRelease()
{
    if (!bRestoreRestTick) return;
    // A player or a new AI driver took over: their every-frame ticks stay.
    if (Controller || bAutopilot) { bRestoreRestTick = false; return; }
    if (KnockTime > 0.f || !FMath::IsNearlyZero(Speed,1.f) || !FMath::IsNearlyZero(LateralSpeed,1.f)) return;
    bRestoreRestTick = false;
    SetActorTickInterval(AutopilotRestTick);
}

void AQuebecCar::UnPossessed()
{
    Super::UnPossessed();
    // Only a driven car needs 60 Hz movement updates.
    SetNetUpdateFrequency(30.f);
}

AController* AQuebecCar::GetDriverController() const
{
    return Occupant ? GetController() : nullptr;
}

void AQuebecCar::SetPolice(bool bNewPolice)
{
    if (!HasAuthority()) return;
    bPolice = bNewPolice;
    if (!bPolice) bSiren = false;
    OnRep_Police();
    ForceNetUpdate();
}

void AQuebecCar::OnRep_Police()
{
    if (bPolice) QuebecCrime::DecoratePoliceCar(this);
}

void AQuebecCar::AddBodyDamage(float Amount, AController* DamagedBy)
{
    if (!HasAuthority() || !FMath::IsFinite(Amount) || Amount <= 0.f || IsWrecked()) return;
    BodyDamage = FMath::Min(100.f,BodyDamage+Amount);
    if (IsWrecked())
    {
        // A wreck is parked for good: no siren, no traffic route, no throttle.
        bSiren = false;
        if (bTraffic)
        {
            bTraffic = false;
            TrafficSegment = INDEX_NONE;
            bJunctionReserved = bJunctionEntered = false;
        }
        Throttle = DriveThrottle = 0.f;
        UE_LOG(LogTemp,Display,TEXT("NORD_CAR_WRECKED car=%s police=%d by=%s"),*GetName(),bPolice ? 1 : 0,DamagedBy ? *DamagedBy->GetName() : TEXT("none"));
    }
    ForceNetUpdate();
}

void AQuebecCar::PrepareDriveAssist()
{
    SteerAssist.Count = 0;
    bSteerAssist = false;
    LastWallNormal = FVector::ZeroVector;
    if (!Controller || !Occupant || bAutopilot || bTraffic || !GetWorld()) return;
    // Only player cars on a street are assisted, so off-road handling (and the test fixtures at the origin) is unchanged.
    const QuebecDistrict::FSettings& District = QuebecDistrict::ForWorld(GetWorld());
    const FVector Here = GetActorLocation();
    const float HereX = static_cast<float>(Here.X), HereY = static_cast<float>(Here.Y);
    for (int32 I = 0; I < District.RoadCount; ++I)
    {
        const FVector& A = District.RoadSegments[I][0];
        const FVector& B = District.RoadSegments[I][1];
        const float HalfWidth = RoadWidthAt(District,I)*.5f;
        const double Reach = HalfWidth+QuebecSteer::RoadMargin;
        if (Here.X < FMath::Min(A.X,B.X)-Reach || Here.X > FMath::Max(A.X,B.X)+Reach ||
            Here.Y < FMath::Min(A.Y,B.Y)-Reach || Here.Y > FMath::Max(A.Y,B.Y)+Reach) continue;
        const float AX = static_cast<float>(A.X), AY = static_cast<float>(A.Y), BX = static_cast<float>(B.X), BY = static_cast<float>(B.Y);
        SteerAssist.Offer(QuebecSteer::SegmentDirection(AX,AY,BX,BY),QuebecSteer::SegmentDistance(HereX,HereY,AX,AY,BX,BY),HalfWidth);
    }
    bSteerAssist = SteerAssist.Count > 0;
}

float AQuebecCar::AssistedYawRate() const
{
    const QuebecSteer::FRoadHeading Road = QuebecSteer::ChooseRoadHeading(static_cast<float>(GetActorRotation().Yaw),Steering,SteerAssist);
    return QuebecSteer::AssistedYawRate(Speed,Steering,SteeringState,bHandbrake,Road);
}

bool AQuebecCar::PassStruckPerson(const FHitResult& Hit, const FVector& From, const FVector& Travel)
{
    // Players and officers have Pawn capsules, so the hull sweep meets them before QuebecPeople's swept test can.
    AActor* Body = Hit.GetActor();
    if (!Body || !(Controller || bAutopilot || KnockTime > 0.f) || !QuebecPeople::IsPerson(Body)) return false;
    if (!QuebecPeople::IsDown(Body))
    {
        // A slow push still stops at the person, as before. A real hit knocks them down and the car drives on.
        const float Closing = static_cast<float>(-FVector::DotProduct(PlanarVelocity(),Hit.Normal.GetSafeNormal2D()));
        if (Closing < StrikeKnockSpeed) return false;
        QuebecPeople::StrikeWithCar(this,From,From+Travel,static_cast<float>(PlanarVelocity().Size2D()));
        if (!QuebecPeople::IsDown(Body)) return false;
        Speed *= .9f;
        LateralSpeed *= .9f;
    }
    const float Until = GetWorld()->GetTimeSeconds()+PassedBodySeconds;
    for (int32 I = 0; I < PassedBodies.Num(); ++I)
        if (PassedBodies[I].Get() == Body) { PassedBodiesUntil[I] = Until; return true; }
    Hull->IgnoreActorWhenMoving(Body,true);
    PassedBodies.Emplace(Body);
    PassedBodiesUntil.Add(Until);
    return true;
}

void AQuebecCar::OnCarImpact(AQuebecCar* Other, float Closing, const FVector& Where)
{
    if (!Other || !HasAuthority()) return;
    AController* Driver = GetDriverController();
    const float Damage = QuebecSteer::ImpactDamage(Closing,false);
    if (Damage > 0.f)
    {
        AddBodyDamage(Damage,Other->GetDriverController());
        Other->AddBodyDamage(Damage,Driver);
    }
    // Ramming a car with someone at the wheel is a crime; a parked car is only a dent.
    const bool bOtherDriven = Other->bPolice || Other->bTraffic || Other->bAutopilot || Other->Occupant || Other->GetController();
    // Side jobs (JOBS): ramming the Voleur de char target is the job itself, not a crime.
    static const FName SideJobTarget(TEXT("SideJobTarget"));
    if (Other->Tags.Contains(SideJobTarget)) return;
    const float Now = GetWorld()->GetTimeSeconds();
    if (!Driver || !bOtherDriven || Closing < RamReportSpeed || Now < NextRamReportAt) return;
    NextRamReportAt = Now+1.f;
    QuebecCrime::Report(Driver,Other->bPolice ? EQuebecCrime::RamPolice : EQuebecCrime::HitCar,Where);
}

void AQuebecCar::OnWallImpact(const FVector& Normal, float Closing, float Step)
{
    if (!HasAuthority()) return;
    LastWallNormal = Normal;
    const float Damage = QuebecSteer::ImpactDamage(Closing,true);
    if (Damage > 0.f && !bTraffic) AddBodyDamage(Damage,GetDriverController());
    if (!bSteerAssist || KnockTime > 0.f) return;
    // A glancing scrape along a street wall turns the nose along it instead of grinding the bumper into it.
    const FVector Forward = GetActorForwardVector().GetSafeNormal2D();
    const float Turn = QuebecSteer::GlanceTurn(static_cast<float>(Forward.X),static_cast<float>(Forward.Y),
        static_cast<float>(Normal.X),static_cast<float>(Normal.Y),QuebecSteer::GlanceTurnRate*Step);
    if (FMath::IsNearlyZero(Turn)) return;
    const FQuat Turned = (GetActorRotation()+FRotator(0.,Turn,0.)).Quaternion();
    if (CanFitAt(GetActorLocation(),Turned)) SetActorRotation(Turned);
}

bool AQuebecCar::SlideAlongStep(const FVector& Before, const FVector& Travel)
{
    const FVector Flat(Travel.X,Travel.Y,0.);
    if (Flat.IsNearlyZero()) return false;
    // Find the step's face with a level trace 12 cm above each wheel's foot, along this move.
    const FVector Ahead = Flat.GetSafeNormal()*40.;
    const FQuat Heading = FRotator(0.,GetActorRotation().Yaw,0.).Quaternion();
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CarStepFace),false,this);
    FVector Face = FVector::ZeroVector;
    for (int32 I = 0; I < 4 && Face.IsZero(); ++I)
    {
        const FVector Foot = Before+Heading.RotateVector(FVector(I < 2 ? 155. : -155.,I%2 ? 95. : -95.,-88.));
        FHitResult StepHit;
        if (GetWorld()->LineTraceSingleByObjectType(StepHit,Foot,Foot+Flat+Ahead,FCollisionObjectQueryParams(ECC_WorldStatic),Query) &&
            FMath::Abs(StepHit.ImpactNormal.Z) < .5f) Face = StepHit.ImpactNormal.GetSafeNormal2D();
    }
    if (Face.IsZero()) return false;
    // Keep only the part of the move along the face; a square approach still stops.
    const FVector Slide = FVector::VectorPlaneProject(Flat,Face);
    if (Slide.SizeSquared2D() < 1.) return false;
    AddActorWorldOffset(Slide,true);
    FRotator SupportRotation = GetActorRotation();
    double SupportZ = 0.;
    bool bStillTooHigh = false;
    WheelSupport(GetActorLocation(),SupportRotation,SupportZ,bStillTooHigh);
    if (bStillTooHigh) { SetActorLocation(Before); return false; }
    FVector Velocity = PlanarVelocity();
    Velocity -= Face*FMath::Min(0.,FVector::DotProduct(Velocity,Face));
    Speed = static_cast<float>(FVector::DotProduct(Velocity,GetActorForwardVector().GetSafeNormal2D()));
    LateralSpeed = static_cast<float>(FVector::DotProduct(Velocity,GetActorRightVector().GetSafeNormal2D()));
    LastWallNormal = Face;
    return true;
}

void AQuebecCar::FinishDriveTick(const FVector& From, bool bStriker, float DeltaSeconds)
{
    const float Now = GetWorld()->GetTimeSeconds();
    for (int32 I = PassedBodies.Num()-1; I >= 0; --I)
    {
        AActor* Body = PassedBodies[I].Get();
        if (Body && (Now < PassedBodiesUntil[I] || QuebecPeople::IsDown(Body))) continue;
        if (Body) Hull->IgnoreActorWhenMoving(Body,false);
        PassedBodies.RemoveAtSwap(I);
        PassedBodiesUntil.RemoveAtSwap(I);
    }
    // Player, AI and shoved cars knock down the people and street props their body passed through this frame.
    const FVector To = GetActorLocation();
    if ((bStriker || KnockTime > 0.f) && FVector::DistSquared2D(From,To) > 1.)
    {
        const float Pace = static_cast<float>(PlanarVelocity().Size2D());
        QuebecPeople::StrikeWithCar(this,From,To,Pace);
        QuebecTraces::StrikeProps(this,From,To,Pace);
    }
    const bool bPushing = bSteerAssist && FMath::Abs(Throttle) > .5f && !bHandbrake && !IsWrecked() && FMath::Abs(Speed) < QuebecSteer::StuckMaxSpeed;
    if (SteerAssist.Stuck.Update(DeltaSeconds,static_cast<float>(To.X),static_cast<float>(To.Y),bPushing)) NudgeStuckCar();
}

void AQuebecCar::NudgeStuckCar()
{
    // Back away from the last wall and turn toward the street, at the first pose where the hull fits.
    const FVector Here = GetActorLocation();
    const float Heading = static_cast<float>(GetActorRotation().Yaw);
    const QuebecSteer::FRoadHeading Road = QuebecSteer::ChooseRoadHeading(Heading,0.f,SteerAssist,90.f);
    const float Turn = Road.bOnRoad ? FMath::Clamp(Road.Error,-QuebecSteer::StuckTurnLimit,QuebecSteer::StuckTurnLimit) : 0.f;
    const FVector Away = !LastWallNormal.IsNearlyZero() ? LastWallNormal :
        -GetActorForwardVector().GetSafeNormal2D()*(Throttle < 0.f ? -1. : 1.);
    const double Distances[] = {80., 160., 0.};
    const float Fractions[] = {1.f, .5f};
    for (double Distance : Distances)
        for (float Fraction : Fractions)
        {
            const FVector Target = Here+Away*Distance;
            const FRotator Pose(0.,Heading+Turn*Fraction,0.);
            if (!CanFitAt(Target,Pose.Quaternion())) continue;
            SetActorLocationAndRotation(Target,Pose,false,nullptr,ETeleportType::TeleportPhysics);
            Speed = LateralSpeed = YawRate = 0.f;
            bGrounded = false;
            UE_LOG(LogTemp,Display,TEXT("NORD_CAR_UNSTUCK car=%s back=%.0f turn=%.1f"),*GetName(),Distance,Turn*Fraction);
            ForceNetUpdate();
            return;
        }
}

void AQuebecCar::UpdateDamageSmoke(float DeltaSeconds)
{
    if (GetNetMode() == NM_DedicatedServer) return;
    const float Now = GetWorld()->GetTimeSeconds();
    if (BodyDamage != SmokeSeenDamage) { SmokeSeenDamage = BodyDamage; SmokeSince = Now; }
    // White steam from a battered car for half a minute after its last hit; black smoke from a wreck for longer.
    const bool bSmoking = BodyDamage >= SmokeDamage && Now-SmokeSince < (IsWrecked() ? 90.f : 30.f);
    for (int32 I = 0; I < SmokePuffs.Num(); ++I)
    {
        UStaticMeshComponent* Puff = SmokePuffs[I];
        if (!Puff || !Puff->IsVisible()) continue;
        const float Age = Now-SmokePuffBorn[I];
        if (Age >= SmokePuffLife) { Puff->SetVisibility(false); continue; }
        // Each puff swells as it rises, then shrinks away.
        const float Life = Age/SmokePuffLife;
        const float Swell = FMath::Lerp(.25f,1.1f,FMath::Min(1.f,Life*1.6f))*(Life > .7f ? 1.f-(Life-.7f)/.3f : 1.f);
        Puff->SetWorldScale3D(FVector(FMath::Max(.02f,Swell)));
        Puff->AddWorldOffset(FVector(-25.*DeltaSeconds,0.,140.*DeltaSeconds));
    }
    // Puffs move by DeltaSeconds on the car's own tick, so a parked wreck's smoke steps at its 10 Hz (traffic 20 Hz)
    // instead of waking the whole car simulation every frame.
    if (!bSmoking || Now < NextSmokeAt || !WasRecentlyRendered(1.f)) return;
    NextSmokeAt = Now+(IsWrecked() ? .2f : .45f);
    int32 Slot = SmokePuffs.Num() < SmokePuffCount ? SmokePuffs.Num() : NextSmokePuff%SmokePuffCount;
    ++NextSmokePuff;
    if (Slot == SmokePuffs.Num())
    {
        UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr,TEXT("/Engine/BasicShapes/Sphere.Sphere"));
        if (!Sphere) return;
        UStaticMeshComponent* NewPuff = NewObject<UStaticMeshComponent>(this);
        NewPuff->SetStaticMesh(Sphere);
        NewPuff->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        NewPuff->SetCastShadow(false);
        NewPuff->SetUsingAbsoluteLocation(true);
        NewPuff->SetUsingAbsoluteRotation(true);
        NewPuff->SetUsingAbsoluteScale(true);
        NewPuff->SetupAttachment(RootComponent);
        NewPuff->RegisterComponent();
        Slot = SmokePuffs.Add(NewPuff);
        SmokePuffBorn.Add(Now);
    }
    UStaticMeshComponent* Puff = SmokePuffs[Slot];
    if (!Puff) return;
    const TCHAR* MaterialPath = IsWrecked() ? TEXT("/Game/Materials/M_Dark.M_Dark") : TEXT("/Game/Materials/M_White.M_White");
    if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr,MaterialPath)) Puff->SetMaterial(0,Material);
    // From under the bonnet, a little to either side so the column does not look like a string of beads.
    Puff->SetWorldLocation(GetActorTransform().TransformPosition(FVector(150.,25.*(NextSmokePuff%3-1),40.)));
    Puff->SetWorldScale3D(FVector(.25));
    Puff->SetVisibility(true);
    SmokePuffBorn[Slot] = Now;
}
