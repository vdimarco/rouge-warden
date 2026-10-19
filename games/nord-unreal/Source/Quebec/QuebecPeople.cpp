#include "QuebecPeople.h"
#include "QuebecGameplay.h"
#include "QuebecGTA.h"
#include "QuebecLife.h"
#include "QuebecPedestrian.h"
#include "QuebecPlayerState.h"
#include "QuebecPolice.h"

#include "Animation/AnimSequence.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "GameFramework/GameStateBase.h"
#include "Materials/MaterialInterface.h"

// Punches a civilian still remembers: two inside QuebecKnock::PunchMemorySeconds knock them down. Server only.
struct FQuebecPunchMemory
{
    int32 Count = 0;
    float At = 0.f;
};

namespace
{
    // Seconds a fleeing person runs, and how many residents may run at once (each probes the street 4 times a second).
    constexpr float FleeAfterKnockSeconds = 2.5f;
    constexpr float AlarmFleeSeconds = 4.f;
    constexpr int32 MaxRunningResidents = 32;
    constexpr float RunSpeed = 380.f;
    constexpr float WalkBackSpeed = 120.f;
    // Car body half extents in its frame (4.4 m x 1.8 m) and the person radii added to them.
    constexpr float CarHalfLength = 220.f, CarHalfWidth = 90.f, CivilianRadius = 35.f, PlayerRadius = 42.f;

    TMap<TWeakObjectPtr<AActor>, FQuebecPunchMemory>& Punches()
    {
        static TMap<TWeakObjectPtr<AActor>, FQuebecPunchMemory> Memory;
        return Memory;
    }

    int32 RecentPunches(AActor* Target, float Now)
    {
        const FQuebecPunchMemory* Memory = Punches().Find(Target);
        return Memory && Now - Memory->At <= QuebecKnock::PunchMemorySeconds ? Memory->Count : 0;
    }

    void RememberPunch(AActor* Target, float Now)
    {
        if (Punches().Num() > 64)
            for (auto It = Punches().CreateIterator(); It; ++It)
                if (!It.Key().IsValid() || Now - It.Value().At > QuebecKnock::PunchMemorySeconds) It.RemoveCurrent();
        FQuebecPunchMemory& Memory = Punches().FindOrAdd(Target);
        Memory.Count = RecentPunches(Target, Now) + 1;
        Memory.At = Now;
    }

    // A player's damage from a car: 15 at the knockdown speed, rising to 70 near top speed.
    float CarDamage(float ImpactSpeed)
    {
        return FMath::Clamp(15.f + (ImpactSpeed - QuebecKnock::CarKnockSpeed) * .03f, 15.f, 70.f);
    }

    // The planar direction a hit throws the target: along the push, else away from the attacker, else backwards.
    FVector ThrowDirection(const AActor* Target, const FVector& Push, const AController* Instigator)
    {
        FVector Along = Push.GetSafeNormal2D();
        const APawn* Attacker = Instigator ? Instigator->GetPawn() : nullptr;
        if (Along.IsNearlyZero() && Attacker) Along = (Target->GetActorLocation() - Attacker->GetActorLocation()).GetSafeNormal2D();
        if (Along.IsNearlyZero()) Along = -Target->GetActorForwardVector().GetSafeNormal2D();
        return Along.IsNearlyZero() ? FVector::ForwardVector : Along;
    }

    FVector LaunchVelocity(const FVector& Along, const QuebecKnock::FLaunch& Launch)
    {
        return Along * Launch.Forward + FVector(0., 0., Launch.Up);
    }

    // Where a person's feet are: residents stand 7 cm over their route, players are capsules.
    FVector FeetOf(const AActor* Person)
    {
        if (const ACharacter* Body = Cast<ACharacter>(Person))
            return Body->GetActorLocation() - FVector(0., 0., Body->GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
        return Person->GetActorLocation();
    }

    // The ground under Point by world geometry only, so cars and people never count as floor.
    bool FloorUnder(const UWorld* World, const FVector& Point, const AActor* Ignore, float& OutZ)
    {
        FHitResult Floor;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PeopleFloor), false, Ignore);
        if (!World->LineTraceSingleByObjectType(Floor, Point + FVector(0., 0., 200.), Point - FVector(0., 0., 400.),
            FCollisionObjectQueryParams(ECC_WorldStatic), Query) || Floor.ImpactNormal.Z < .6f) return false;
        OutZ = Floor.ImpactPoint.Z;
        return true;
    }

    // Shortens a throw so the person stops short of a wall, and finds the ground where they land. Returns the ground step.
    float FitThrow(const UWorld* World, const AActor* Person, const FVector& Start, const FVector& Along, QuebecKnock::FLaunch& Launch, float Feet)
    {
        const float Reach = QuebecKnock::Timeline(Launch).RestForward;
        if (Reach > 1.f)
        {
            FHitResult Wall;
            FCollisionQueryParams Query(SCENE_QUERY_STAT(PeopleThrow), false, Person);
            const FVector Lift(0., 0., 100.);
            if (World->SweepSingleByObjectType(Wall, Start + Lift, Start + Along * Reach + Lift, FQuat::Identity,
                FCollisionObjectQueryParams(ECC_WorldStatic), FCollisionShape::MakeSphere(35.f), Query))
                Launch.Forward *= FMath::Clamp((Wall.Time * Reach - 40.f) / Reach, 0.f, 1.f);
        }
        float Ground = 0.f;
        const FVector Rest = Start + Along * QuebecKnock::Timeline(Launch).RestForward;
        return FloorUnder(World, Rest, Person, Ground) ? Ground + Feet - Start.Z : 0.f;
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Shared knockdown visuals

namespace QuebecPeopleVisuals
{
    float ServerTime(const UWorld* World)
    {
        if (!World) return 0.f;
        const AGameStateBase* State = World->GetGameState();
        return static_cast<float>(State ? State->GetServerWorldTimeSeconds() : World->GetTimeSeconds());
    }

    QuebecKnock::FLaunch Launch(const FVector& Push, float LieSeconds, float GroundDelta)
    {
        QuebecKnock::FLaunch Result;
        Result.Forward = static_cast<float>(Push.Size2D());
        Result.Up = static_cast<float>(Push.Z);
        Result.Spin = QuebecKnock::SpinFor(Result.Forward);
        Result.LieSeconds = LieSeconds;
        Result.GroundDelta = GroundDelta;
        return QuebecKnock::Sanitize(Result);
    }

    FQuat Tumble(const FVector& Push, float Pitch, float Roll)
    {
        FVector Along = Push.GetSafeNormal2D();
        if (Along.IsNearlyZero()) Along = FVector::ForwardVector;
        // A positive turn about (up x push) tips the body's up axis toward the push.
        const FVector Axis = FVector::CrossProduct(FVector::UpVector, Along);
        return FQuat(Axis, FMath::DegreesToRadians(Pitch)) * FQuat(Along, FMath::DegreesToRadians(Roll));
    }

    void PoseStars(AActor* Holder, TArray<TObjectPtr<UStaticMeshComponent>>& Stars, bool bShow, const FVector& Head, float Time)
    {
        if (!bShow)
        {
            for (UStaticMeshComponent* Star : Stars) if (Star) Star->SetVisibility(false);
            return;
        }
        if (!Holder || !Holder->GetRootComponent()) return;
        if (!Stars.Num())
        {
            // Three gold stars, each a pair of crossed bars, in world space so a scaled or tumbling root cannot bend them.
            UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
            UMaterialInterface* Gold = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/ParkComic/M_Gold.M_Gold"));
            for (int32 Bar = 0; Bar < 6; ++Bar)
            {
                UStaticMeshComponent* Star = NewObject<UStaticMeshComponent>(Holder);
                Star->SetupAttachment(Holder->GetRootComponent());
                Star->SetUsingAbsoluteLocation(true);
                Star->SetUsingAbsoluteRotation(true);
                Star->SetUsingAbsoluteScale(true);
                Star->SetStaticMesh(Cube);
                if (Gold) Star->SetMaterial(0, Gold);
                Star->SetCollisionEnabled(ECollisionEnabled::NoCollision);
                Star->SetCanEverAffectNavigation(false);
                Star->SetCastShadow(false);
                Star->SetRelativeScale3D(Bar % 2 ? FVector(.03, .03, .14) : FVector(.03, .14, .03));
                Star->RegisterComponent();
                Stars.Add(Star);
            }
        }
        for (int32 Bar = 0; Bar < Stars.Num(); ++Bar)
        {
            if (!Stars[Bar]) continue;
            const int32 Orbit = Bar / 2;
            const float Angle = Time * 2.f * PI * .9f + Orbit * 2.f * PI / 3.f;
            const FVector Point = Head + FVector(FMath::Cos(Angle) * 28.f, FMath::Sin(Angle) * 28.f, 6.f * FMath::Sin(Angle * 2.f));
            Stars[Bar]->SetWorldLocationAndRotation(Point, FRotator(0.f, FMath::RadiansToDegrees(Angle), Time * 360.f + 45.f));
            Stars[Bar]->SetVisibility(true);
        }
    }
}

UQuebecKnockPoser::UQuebecKnockPoser()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.bStartWithTickEnabled = true;
    // After character movement (pre-physics) and its smoothing of the remote mesh, so this pose is what renders.
    PrimaryComponentTick.TickGroup = TG_PostPhysics;
}

void UQuebecKnockPoser::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (AQuebecCharacter* Walker = Cast<AQuebecCharacter>(GetOwner())) Walker->ApplyKnockPose();
    else SetComponentTickEnabled(false);
}

// ---------------------------------------------------------------------------------------------------------------
// The QuebecPeople contract

namespace QuebecPeople
{
    bool IsPerson(const AActor* Actor)
    {
        return IsValid(Actor) && (Actor->IsA<AQuebecParkResident>() || Actor->IsA<AQuebecPedestrian>() ||
            Actor->IsA<AQuebecCharacter>() || Actor->IsA<AQuebecOfficer>());
    }

    bool IsDown(const AActor* Person)
    {
        if (const AQuebecParkResident* Resident = Cast<AQuebecParkResident>(Person)) return Resident->IsKnockedDown();
        if (const AQuebecPedestrian* Pedestrian = Cast<AQuebecPedestrian>(Person)) return Pedestrian->IsKnockedDown();
        if (const AQuebecOfficer* Officer = Cast<AQuebecOfficer>(Person)) return Officer->IsDown();
        if (const AQuebecCharacter* Player = Cast<AQuebecCharacter>(Person))
        {
            const AQuebecPlayerState* Stats = QuebecCombat::State(Player);
            return Player->IsKnocked() || (Stats && Stats->IsDown());
        }
        return false;
    }

    FVector AimPoint(const AActor* Person)
    {
        if (!IsValid(Person)) return FVector::ZeroVector;
        if (const AQuebecParkResident* Resident = Cast<AQuebecParkResident>(Person)) return Resident->GetAimPoint();
        if (const AQuebecPedestrian* Pedestrian = Cast<AQuebecPedestrian>(Person)) return Pedestrian->GetAimPoint();
        if (const AQuebecOfficer* Officer = Cast<AQuebecOfficer>(Person)) return Officer->GetAimPoint();
        // A player's capsule centre is at the hips; aim at the chest.
        return Person->GetActorLocation() + FVector(0., 0., 30.);
    }

    void Gather(UWorld* World, const FVector& Center, float Radius, TArray<AActor*>& Out)
    {
        if (!World || !FMath::IsFinite(Radius) || Radius <= 0.f) return;
        const double Reach = FMath::Square(static_cast<double>(Radius));
        const auto Consider = [&Out, &Center, Reach](AActor* Person)
        {
            if (IsValid(Person) && !Person->IsHidden() && FVector::DistSquared(Person->GetActorLocation(), Center) <= Reach) Out.Add(Person);
        };
        for (TActorIterator<AQuebecParkResident> It(World); It; ++It) Consider(*It);
        for (TActorIterator<AQuebecPedestrian> It(World); It; ++It) Consider(*It);
        // A driving player's character is hidden inside the car.
        for (TActorIterator<AQuebecCharacter> It(World); It; ++It) Consider(*It);
        for (TActorIterator<AQuebecOfficer> It(World); It; ++It) Consider(*It);
    }

    void Alarm(UWorld* World, const FVector& Source, float Radius)
    {
        if (!World || World->GetNetMode() == NM_Client || !FMath::IsFinite(Radius) || Radius <= 0.f || Source.ContainsNaN()) return;
        const double Reach = FMath::Square(static_cast<double>(Radius));
        int32 Running = 0;
        for (TActorIterator<AQuebecParkResident> It(World); It; ++It) Running += It->IsAway() ? 1 : 0;
        for (TActorIterator<AQuebecParkResident> It(World); It && Running < MaxRunningResidents; ++It)
            if (!It->IsAway() && FVector::DistSquared(It->GetActorLocation(), Source) <= Reach && It->Flee(Source, AlarmFleeSeconds)) ++Running;
        for (TActorIterator<AQuebecPedestrian> It(World); It; ++It)
            if (FVector::DistSquared(It->GetActorLocation(), Source) <= Reach) It->Flee(Source, AlarmFleeSeconds);
    }

    bool Hit(AActor* Target, EQuebecHitKind Kind, float Damage, const FVector& Push, AController* Instigator)
    {
        if (!IsValid(Target) || !Target->HasAuthority() || !IsPerson(Target) || IsDown(Target) || Push.ContainsNaN()) return false;
        UWorld* World = Target->GetWorld();
        const float Now = QuebecPeopleVisuals::ServerTime(World);
        const float Harm = FMath::IsFinite(Damage) ? FMath::Max(0.f, Damage) : 0.f;
        const FVector Where = Target->GetActorLocation();
        const FVector Along = ThrowDirection(Target, Push, Instigator);
        // A car's push is its velocity; weapons throw by their damage.
        const float CarSpeed = Kind == EQuebecHitKind::Car ? static_cast<float>(Push.Size2D()) : 0.f;
        const QuebecKnock::FLaunch Throw = Kind == EQuebecHitKind::Car ? QuebecKnock::CarLaunch(CarSpeed) : QuebecKnock::HitLaunch(Harm);
        const FVector Launch = LaunchVelocity(Along, Throw);
        const APawn* Attacker = Instigator ? Instigator->GetPawn() : nullptr;
        const FVector Cause = Attacker ? Attacker->GetActorLocation() : Where - Along * 300.;
        if (AQuebecOfficer* Officer = Cast<AQuebecOfficer>(Target))
        {
            if (!Officer->ReceiveHit(Kind, Kind == EQuebecHitKind::Car ? CarDamage(CarSpeed) : Harm, Launch, Instigator)) return false;
            if (Instigator && Officer->Faction == AQuebecOfficer::FactionPolice)
                QuebecCrime::Report(Instigator, Officer->IsKnockedOut() ? EQuebecCrime::DownPolice : EQuebecCrime::AttackPolice, Where);
            Alarm(World, Where, 1500.f);
            return true;
        }
        if (AQuebecCharacter* Player = Cast<AQuebecCharacter>(Target))
        {
            // Players go down only under a car; weapon hits cost health, and a K.-O. comes from the combat rules.
            if (Kind == EQuebecHitKind::Car) Player->StartKnock(Launch, Throw.LieSeconds, false);
            QuebecCombat::DamagePlayer(Player, Harm, Instigator);
            if (Instigator && Instigator != Player->GetController())
                QuebecCrime::Report(Instigator, Kind == EQuebecHitKind::Car ? EQuebecCrime::HitPerson : EQuebecCrime::AttackPerson, Where);
            return true;
        }
        const QuebecKnock::EHit Rule = Kind == EQuebecHitKind::Car ? QuebecKnock::EHit::Car : Kind == EQuebecHitKind::Melee ? QuebecKnock::EHit::Melee : QuebecKnock::EHit::Bullet;
        bool bTookHit = false;
        if (QuebecKnock::CivilianGoesDown(Rule, Kind == EQuebecHitKind::Car ? CarSpeed : Harm, RecentPunches(Target, Now)))
        {
            if (AQuebecParkResident* Resident = Cast<AQuebecParkResident>(Target)) bTookHit = Resident->Knock(Launch, Cause, Throw.LieSeconds);
            else if (AQuebecPedestrian* Pedestrian = Cast<AQuebecPedestrian>(Target)) bTookHit = Pedestrian->Knock(Launch, Cause, Throw.LieSeconds);
            if (bTookHit) Punches().Remove(Target);
        }
        else if (Kind == EQuebecHitKind::Melee)
        {
            // The first punch: the civilian runs from the attacker, and remembers it for a few seconds.
            RememberPunch(Target, Now);
            if (AQuebecParkResident* Resident = Cast<AQuebecParkResident>(Target)) Resident->Flee(Cause, AlarmFleeSeconds);
            else if (AQuebecPedestrian* Pedestrian = Cast<AQuebecPedestrian>(Target)) Pedestrian->Flee(Cause, AlarmFleeSeconds);
            bTookHit = true;
        }
        if (!bTookHit) return false;
        if (Instigator) QuebecCrime::Report(Instigator, Kind == EQuebecHitKind::Car ? EQuebecCrime::HitPerson : EQuebecCrime::AttackPerson, Where);
        Alarm(World, Where, 1500.f);
        return true;
    }

    int32 StrikeWithCar(AQuebecCar* Car, const FVector& From, const FVector& To, float Speed)
    {
        if (!IsValid(Car) || !Car->HasAuthority() || From.ContainsNaN() || To.ContainsNaN()) return 0;
        UWorld* World = Car->GetWorld();
        const FVector Velocity = Car->PlanarVelocity();
        const float Impact = FMath::Max(FMath::IsFinite(Speed) ? FMath::Abs(Speed) : 0.f, static_cast<float>(Velocity.Size2D()));
        if (!World || Impact <= QuebecKnock::CarKnockSpeed) return 0;
        const FVector Travel = To - From;
        FVector Heading = Velocity.GetSafeNormal2D();
        if (Heading.IsNearlyZero()) Heading = Travel.GetSafeNormal2D();
        if (Heading.IsNearlyZero()) return 0;
        const FQuat Facing = Car->GetActorQuat();
        AController* Driver = Car->GetDriverController();
        TArray<AActor*> Nearby;
        Gather(World, (From + To) * .5, 450.f + static_cast<float>(Travel.Size2D()) + Impact * .1f, Nearby);
        int32 Struck = 0;
        for (AActor* Person : Nearby)
        {
            // A driver's character rides attached to its car; the car's own occupant is never struck.
            if (Person == Car->Occupant.Get() || Person->GetAttachParentActor() || IsDown(Person)) continue;
            AQuebecCharacter* Player = Cast<AQuebecCharacter>(Person);
            const bool bCapsule = Person->IsA<ACharacter>();
            const FVector Feet = FeetOf(Person);
            // The car root rides about a metre over the road.
            if (FMath::Abs(Feet.Z - (To.Z - 100.)) > 140.) continue;
            const float Radius = bCapsule ? PlayerRadius : CivilianRadius;
            // From-To is the whole intended move, even when a capsule (player or officer) blocked the car's sweep.
            // Players are also met a tenth of a second early, while the car still has its speed.
            const FVector Ahead = bCapsule ? Velocity * .1 : FVector::ZeroVector;
            const FVector Start = Facing.UnrotateVector(Feet - From), End = Facing.UnrotateVector(Feet - (To + Ahead));
            if (!QuebecKnock::SweptBoxHit(static_cast<float>(Start.X), static_cast<float>(Start.Y), static_cast<float>(End.X), static_cast<float>(End.Y),
                CarHalfLength + Radius, CarHalfWidth + Radius)) continue;
            // Only people in front of the travel get thrown; a car sliding past sideways brushes them.
            const FVector Toward = (Feet - To).GetSafeNormal2D();
            if (!Toward.IsNearlyZero() && FVector::DotProduct(Toward, Heading) < .2) continue;
            if (!Hit(Person, EQuebecHitKind::Car, CarDamage(Impact), Heading * Impact, Driver)) continue;
            ++Struck;
            if (Player) Player->IgnoreCarBriefly(Car, 1.6f);
        }
        return Struck;
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Residents: knockdown, flight and the walk back to the route

bool AQuebecParkResident::IsKnockActive(float ServerTime) const
{
    if (KnockStartedAt < -100.f) return false;
    const float Elapsed = ServerTime - KnockStartedAt;
    // A client clock a little behind the server still shows the start of a fresh knock.
    return (Elapsed >= 0.f || Stride == 1) &&
        Elapsed < QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround)).Total;
}

bool AQuebecParkResident::IsKnockedDown() const
{
    return IsKnockActive(QuebecPeopleVisuals::ServerTime(GetWorld()));
}

FVector AQuebecParkResident::GetAimPoint() const
{
    const float Now = QuebecPeopleVisuals::ServerTime(GetWorld());
    if (!IsKnockActive(Now)) return GetActorLocation() + FVector(0., 0., 110.);
    const QuebecKnock::FPose Pose = QuebecKnock::Sample(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround), Now - KnockStartedAt);
    return KnockOrigin + KnockPush.GetSafeNormal2D() * Pose.Forward + FVector(0., 0., Pose.Ground + Pose.Lift + Pose.Hip);
}

void AQuebecParkResident::BeginAway(float Now)
{
    if (Stride == 0)
    {
        AwayHome = GetActorLocation();
        AwayHomeYaw = GetActorRotation().Yaw;
    }
    // Hold the shared route clock exactly as Acknowledge does, but open-ended: FinishAway closes it when the resident is back.
    RouteDelay += FMath::Clamp(Now - ReactionStartedAt, 0.f, ReactionUntil - ReactionStartedAt);
    ReactionStartedAt = Now;
    ReactionUntil = Now + 3600.f;
}

void AQuebecParkResident::FinishAway(float Now)
{
    // Ending the hold now keeps RouteTime continuous: the route resumes where the resident left it.
    ReactionUntil = FMath::Max(ReactionStartedAt, Now);
    Stride = 0;
    NextReactionAt = Now + 6.f;
    if (Activity == 2) SetActorRotation(FRotator(0.f, AwayHomeYaw, 0.f));
    ForceNetUpdate();
}

bool AQuebecParkResident::Knock(const FVector& Push, const FVector& Cause, float LieSeconds)
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World || IsHidden() || Push.ContainsNaN() || AQuebecCharacter::IsCrewTaken(World, Style)) return false;
    const float Now = World->GetTimeSeconds();
    if (IsKnockActive(Now)) return false;
    BeginAway(Now);
    const FVector Start = GetActorLocation();
    const FVector Along = Push.GetSafeNormal2D().IsNearlyZero() ? -GetActorForwardVector().GetSafeNormal2D() : Push.GetSafeNormal2D();
    QuebecKnock::FLaunch Shot = QuebecPeopleVisuals::Launch(Push, LieSeconds);
    // The route stands 7 cm over the ground.
    const float Ground = FitThrow(World, this, Start, Along, Shot, 7.f);
    KnockStartedAt = Now;
    KnockOrigin = Start;
    KnockPush = LaunchVelocity(Along, Shot);
    KnockLieSeconds = Shot.LieSeconds;
    KnockGround = QuebecKnock::Sanitize(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, Ground)).GroundDelta;
    KnockYaw = GetActorRotation().Yaw;
    FleeSource = Cause.ContainsNaN() ? Start - Along * 300. : Cause;
    Stride = 1;
    StreetGroundZ = Start.Z;
    ForceNetUpdate();
    return true;
}

bool AQuebecParkResident::Flee(const FVector& Source, float Seconds)
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World || IsHidden() || Source.ContainsNaN() || !FMath::IsFinite(Seconds) ||
        AQuebecCharacter::IsCrewTaken(World, Style)) return false;
    const float Now = World->GetTimeSeconds();
    if (Stride == 1 || IsKnockActive(Now)) return false;
    BeginAway(Now);
    FleeSource = Source;
    FleeUntil = FMath::Max(Stride == 2 ? FleeUntil : 0.f, Now + FMath::Clamp(Seconds, .5f, 10.f));
    NextFleeProbe = 0.f;
    StreetGroundZ = GetActorLocation().Z;
    Stride = 2;
    ForceNetUpdate();
    return true;
}

void AQuebecParkResident::TickAway(float ServerTime, float DeltaSeconds)
{
    UWorld* World = GetWorld();
    // Safety net: an excursion never outlives a minute and a half.
    if (ServerTime - ReactionStartedAt > 90.f)
    {
        SetActorLocation(AwayHome);
        FinishAway(ServerTime);
        return;
    }
    if (Stride == 1)
    {
        // The root follows the tumble along the ground; every peer draws the body from the same knock.
        const QuebecKnock::FPose Pose = QuebecKnock::Sample(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround), ServerTime - KnockStartedAt);
        SetActorLocation(KnockOrigin + KnockPush.GetSafeNormal2D() * Pose.Forward + FVector(0., 0., Pose.Ground));
        if (Pose.Phase != QuebecKnock::EPhase::Done) return;
        // Up again: run away from whatever hit them for a moment.
        Stride = 2;
        FleeUntil = ServerTime + FleeAfterKnockSeconds;
        NextFleeProbe = 0.f;
        StreetGroundZ = GetActorLocation().Z;
        ForceNetUpdate();
    }
    const FVector Here = GetActorLocation();
    if (Stride == 2)
    {
        if (ServerTime >= FleeUntil)
        {
            Stride = 3;
            ForceNetUpdate();
            return;
        }
        if (ServerTime >= NextFleeProbe)
        {
            // Four times a second: the clearest heading away from the threat, swept like the population's route checks.
            NextFleeProbe = ServerTime + .25f;
            FVector Away = (Here - FleeSource).GetSafeNormal2D();
            if (Away.IsNearlyZero()) Away = GetActorForwardVector().GetSafeNormal2D();
            FleeHeading = FVector::ZeroVector;
            FCollisionQueryParams Query(SCENE_QUERY_STAT(ResidentFlee), false, this);
            const FVector Lift(0., 0., 125.);
            for (float Turn : {0.f, 35.f, -35.f, 70.f, -70.f, 110.f, -110.f})
            {
                const FVector Heading = Away.RotateAngleAxis(Turn, FVector::UpVector);
                FHitResult Block;
                if (World->SweepSingleByChannel(Block, Here + Lift, Here + Heading * 140. + Lift, FQuat::Identity, ECC_Pawn,
                    FCollisionShape::MakeCapsule(35.f, 90.f), Query)) continue;
                FleeHeading = Heading;
                break;
            }
            float Ground = 0.f;
            if (FleeHeading.IsZero() || !FloorUnder(World, Here + FleeHeading * 100., this, Ground))
            {
                Stride = 3;
                ForceNetUpdate();
                return;
            }
            StreetGroundZ = Ground + 7.f;
        }
        FVector Next = Here + FleeHeading * (RunSpeed * DeltaSeconds);
        Next.Z = FMath::FInterpTo(static_cast<float>(Here.Z), StreetGroundZ, DeltaSeconds, 10.f);
        SetActorLocationAndRotation(Next, FMath::RInterpTo(GetActorRotation(), FRotator(0.f, FleeHeading.Rotation().Yaw, 0.f), DeltaSeconds, 10.f));
        return;
    }
    if (Stride == 3)
    {
        // Walk straight back to where the route was left; the held clock resumes there.
        const FVector ToHome = AwayHome - Here;
        const float Remaining = static_cast<float>(ToHome.Size2D());
        if (Remaining < 8.f)
        {
            SetActorLocation(AwayHome);
            FinishAway(ServerTime);
            return;
        }
        const float Step = FMath::Min(Remaining, WalkBackSpeed * DeltaSeconds);
        FVector Next = Here + ToHome.GetSafeNormal2D() * Step;
        Next.Z = Here.Z + ToHome.Z * (Step / Remaining);
        SetActorLocationAndRotation(Next, FMath::RInterpTo(GetActorRotation(), FRotator(0.f, ToHome.Rotation().Yaw, 0.f), DeltaSeconds, 8.f));
    }
}

bool AQuebecParkResident::StreetLifeAnimation(float ServerTime, UAnimSequence*& Animation, float& Clock) const
{
    if (IsKnockActive(ServerTime))
    {
        const QuebecKnock::FPose Pose = QuebecKnock::Sample(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround), ServerTime - KnockStartedAt);
        // In the air: the crew jump clip's flailing frames; on the ground: a held idle frame, then idle again while standing up.
        const bool bFlying = Pose.Phase == QuebecKnock::EPhase::Airborne || Pose.Phase == QuebecKnock::EPhase::Landing;
        Animation = bFlying && JumpAnimation ? JumpAnimation.Get() : IdleAnimation.Get();
        Clock = bFlying && JumpAnimation ? (Pose.Phase == QuebecKnock::EPhase::Airborne ? .47f : .73f)
            : Pose.Phase == QuebecKnock::EPhase::StandingUp ? ServerTime + Phase : Phase;
        return true;
    }
    if (Stride == 2)
    {
        Animation = RunAnimation ? RunAnimation.Get() : WalkAnimation.Get();
        Clock = (ServerTime + Phase) * (RunAnimation ? 1.4f : 2.6f);
        return true;
    }
    if (Stride == 3)
    {
        Animation = WalkAnimation.Get();
        Clock = ServerTime + Phase;
        return true;
    }
    return false;
}

void AQuebecParkResident::ResetKnockPose()
{
    bKnockPose = false;
    GeneratedBody->SetRelativeTransform(FTransform::Identity);
    for (int32 I = 0; I < Pieces.Num(); ++I)
        if (Pieces[I]) Pieces[I]->SetRelativeTransform(FTransform(PiecePivots.IsValidIndex(I) ? PiecePivots[I] : FVector::ZeroVector));
    QuebecPeopleVisuals::PoseStars(this, DazedStars, false, FVector::ZeroVector, 0.f);
}

void AQuebecParkResident::PoseStreetLife(float ServerTime, bool bRouteWalking, bool bRoutePause, bool bReturnLeg, float PauseClock, float StrideClock)
{
    const bool bKnocked = IsKnockActive(ServerTime);
    FVector Hips = GetActorLocation() + FVector(0., 0., QuebecKnock::HipHeight);
    if (bKnocked)
    {
        const QuebecKnock::FPose Pose = QuebecKnock::Sample(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround), ServerTime - KnockStartedAt);
        const FQuat Turn = QuebecPeopleVisuals::Tumble(KnockPush, Pose.Pitch, Pose.Roll);
        // Placed in world space from the replicated knock, so a client's 12 Hz root cannot make the arc stutter.
        Hips = KnockOrigin + KnockPush.GetSafeNormal2D() * Pose.Forward + FVector(0., 0., Pose.Ground + Pose.Lift + Pose.Hip);
        const FVector Feet = Hips - Turn.RotateVector(FVector(0., 0., QuebecKnock::HipHeight));
        const FTransform Body(Turn * GetActorQuat(), Feet);
        if (GeneratedBody->GetSkeletalMeshAsset()) GeneratedBody->SetWorldLocationAndRotation(Feet, Body.GetRotation());
        else
            for (int32 I = 0; I < Pieces.Num(); ++I)
            {
                // Mascot pieces keep this frame's limb swing about their own pivots.
                if (!Pieces[I]) continue;
                const FVector Pivot = I == 0 ? Pieces[I]->GetRelativeLocation() : PiecePivots.IsValidIndex(I) ? PiecePivots[I] : FVector::ZeroVector;
                Pieces[I]->SetWorldTransform(FTransform(I == 0 ? FRotator::ZeroRotator : Pieces[I]->GetRelativeRotation(), Pivot) * Body);
            }
        Label->SetVisibility(false);
        bKnockPose = true;
        QuebecPeopleVisuals::PoseStars(this, DazedStars, Pose.bDazed, Hips + Turn.RotateVector(FVector(0., 0., 82.)), ServerTime);
    }
    if (!CompanionRig) return;
    FQuebecCompanionFrame Frame;
    Frame.OwnerTransform = GetActorTransform();
    if (GeneratedBody->GetSkeletalMeshAsset()) Frame.Hand = GeneratedBody->GetSocketLocation(TEXT("LeftHand"));
    Frame.Time = ServerTime;
    Frame.DeltaSeconds = GetWorld()->GetDeltaSeconds();
    Frame.bWalking = bRouteWalking;
    Frame.bPausing = bRoutePause && Stride == 0;
    Frame.bReturnLeg = bReturnLeg;
    Frame.PauseClock = PauseClock;
    Frame.bRunning = Stride >= 2;
    Frame.bKnocked = bKnocked;
    // The things in hand stay dropped from the knock until the owner is back on the route.
    const bool bDropThisOuting = KnockStartedAt > -100.f && KnockStartedAt >= ReactionStartedAt - .01f;
    Frame.bDropped = bKnocked || (Stride != 0 && bDropThisOuting);
    Frame.DropSeconds = ServerTime - KnockStartedAt;
    Frame.DropOrigin = KnockStartedAt > -100.f ? KnockOrigin : FVector::ZeroVector;
    Frame.DropYaw = KnockYaw;
    Frame.Body = Hips;
    CompanionRig->Pose(Frame);
    (void)StrideClock;
}

void AQuebecParkResident::RefreshCompanion()
{
    if (!Companion || CompanionRig || !GetWorld() || !GetRootComponent()) return;
    CompanionRig = NewObject<UQuebecCompanionRig>(this, TEXT("CompanionRig"));
    CompanionRig->SetupAttachment(GetRootComponent());
    CompanionRig->RegisterComponent();
    CompanionRig->Build(Companion, FMath::RoundToInt(Phase * 10.f));
}

void AQuebecParkResident::OnRep_Companion()
{
    RefreshCompanion();
}

// ---------------------------------------------------------------------------------------------------------------
// Players: launch, lie, stand up; the pose is drawn after movement by UQuebecKnockPoser

void AQuebecCharacter::StartKnock(const FVector& Push, float LieSeconds, bool bStayDown)
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World) return;
    if (IsKnocked())
    {
        // Already tumbling: a K.-O. only keeps the player down.
        if (bStayDown && !bKnockStayDown)
        {
            bKnockStayDown = true;
            KnockLieSeconds = 100000.f;
            ForceNetUpdate();
        }
        return;
    }
    const FVector Launch = Push.ContainsNaN() ? FVector::ZeroVector : Push.GetClampedToMaxSize(3000.);
    KnockStartedAt = World->GetTimeSeconds();
    // Without a push the player falls backwards on the spot.
    const FVector Back = -GetActorForwardVector().GetSafeNormal2D();
    KnockPush = Launch.SizeSquared2D() < 1. ? FVector(Back.X, Back.Y, Launch.Z) : Launch;
    KnockLieSeconds = bStayDown ? 100000.f : FMath::Clamp(FMath::IsFinite(LieSeconds) ? LieSeconds : 1.6f, 0.f, 30.f);
    bKnockStayDown = bStayDown;
    if (!bInVehicle && Launch.SizeSquared() > 1.)
    {
        LaunchCharacter(Launch, true, true);
        // The owning client predicts its own movement; launch it there too so the server's launch is not a correction.
        if (!IsLocallyControlled()) ClientKnockLaunch(Launch);
    }
    OnRep_Knock();
    ForceNetUpdate();
}

void AQuebecCharacter::ClientKnockLaunch_Implementation(FVector Push)
{
    if (!HasAuthority() && !Push.ContainsNaN()) LaunchCharacter(Push, true, true);
}

void AQuebecCharacter::EndKnock()
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World || !IsKnocked()) return;
    const QuebecKnock::FLaunch Shot = QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds);
    bKnockStayDown = false;
    KnockLieSeconds = FMath::Min(KnockLieSeconds, QuebecKnock::LieToStandAt(Shot, World->GetTimeSeconds() - KnockStartedAt));
    ForceNetUpdate();
}

bool AQuebecCharacter::IsKnocked() const
{
    if (KnockStartedAt < -100.f) return false;
    if (bKnockStayDown) return true;
    return QuebecPeopleVisuals::ServerTime(GetWorld()) - KnockStartedAt <
        QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds)).Total;
}

bool AQuebecCharacter::IsInputLocked() const
{
    if (IsKnocked()) return true;
    const AQuebecPlayerState* Stats = QuebecCombat::State(this);
    return Stats && Stats->IsDown();
}

void AQuebecCharacter::IgnoreCarBriefly(AActor* Car, float Seconds)
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World || !IsValid(Car)) return;
    // Only the player's side: the car keeps its own list of people it passes through while they are down (QuebecDrive.cpp).
    if (KnockIgnoredCar.IsValid() && KnockIgnoredCar.Get() != Car) GetCapsuleComponent()->IgnoreActorWhenMoving(KnockIgnoredCar.Get(), false);
    GetCapsuleComponent()->IgnoreActorWhenMoving(Car, true);
    KnockIgnoredCar = Car;
    KnockIgnoreUntil = World->GetTimeSeconds() + FMath::Clamp(Seconds, 0.f, 5.f);
    OnRep_Knock();
}

void AQuebecCharacter::OnRep_Knock()
{
    if (!KnockPoser)
    {
        KnockPoser = NewObject<UQuebecKnockPoser>(this, TEXT("KnockPoser"));
        KnockPoser->RegisterComponent();
    }
    KnockPoser->SetComponentTickEnabled(true);
}

void AQuebecCharacter::ApplyKnockPose()
{
    UWorld* World = GetWorld();
    if (!World) return;
    // Server: the flying player stops passing through the car that hit it after a moment.
    if (HasAuthority() && KnockIgnoredCar.IsValid() && World->GetTimeSeconds() >= KnockIgnoreUntil)
    {
        GetCapsuleComponent()->IgnoreActorWhenMoving(KnockIgnoredCar.Get(), false);
        KnockIgnoredCar.Reset();
    }
    const bool bKnocked = IsKnocked();
    // Swimming poses the mesh itself, and a driver's character is hidden.
    if (!bKnocked || bInVehicle || bSwimPoseActive)
    {
        if (bKnockPose)
        {
            GetMesh()->SetRelativeTransform(KnockMeshBase);
            bKnockPose = false;
        }
        QuebecPeopleVisuals::PoseStars(this, KnockStars, false, FVector::ZeroVector, 0.f);
        if (!bKnocked && !KnockIgnoredCar.IsValid() && KnockPoser) KnockPoser->SetComponentTickEnabled(false);
        return;
    }
    if (!bKnockPose)
    {
        KnockMeshBase = GetMesh()->GetRelativeTransform();
        bKnockPose = true;
    }
    const float Now = QuebecPeopleVisuals::ServerTime(World);
    const QuebecKnock::FPose Pose = QuebecKnock::Sample(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds), Now - KnockStartedAt);
    const FQuat Turn = QuebecPeopleVisuals::Tumble(KnockPush, Pose.Pitch, Pose.Roll);
    // Character movement carries the flight; the mesh tips about the capsule centre (the hips) and sinks to the floor.
    const FVector Pivot = GetActorLocation();
    const FVector Sink(0., 0., Pose.Hip - QuebecKnock::HipHeight);
    const FTransform Upright = KnockMeshBase * GetActorTransform();
    GetMesh()->SetWorldTransform(Upright * FTransform(-Pivot) * FTransform(Turn) * FTransform(Pivot + Sink));
    QuebecPeopleVisuals::PoseStars(this, KnockStars, Pose.bDazed, Pivot + Sink + Turn.RotateVector(FVector(0., 0., 82.)), Now);
}

// ---------------------------------------------------------------------------------------------------------------
// Plateau pedestrians: the same tumble, moved by the server and replicated with the root at 30 Hz

bool AQuebecPedestrian::IsKnockedDown() const
{
    if (KnockStartedAt < -100.f) return false;
    return QuebecPeopleVisuals::ServerTime(GetWorld()) - KnockStartedAt <
        QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround)).Total;
}

FVector AQuebecPedestrian::GetAimPoint() const
{
    // The root is the body, so it tumbles with it.
    return GetActorLocation() + GetActorQuat().RotateVector(FVector(0., 0., 110.));
}

bool AQuebecPedestrian::Knock(const FVector& Push, const FVector& Cause, float LieSeconds)
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World || IsHidden() || Push.ContainsNaN() || IsKnockedDown()) return false;
    const FVector Start = GetActorLocation();
    const FVector Along = Push.GetSafeNormal2D().IsNearlyZero() ? -GetActorForwardVector().GetSafeNormal2D() : Push.GetSafeNormal2D();
    QuebecKnock::FLaunch Shot = QuebecPeopleVisuals::Launch(Push, LieSeconds);
    const float Ground = FitThrow(World, this, Start, Along, Shot, 0.f);
    KnockStartedAt = World->GetTimeSeconds();
    KnockOrigin = Start;
    KnockPush = LaunchVelocity(Along, Shot);
    KnockLieSeconds = Shot.LieSeconds;
    KnockGround = QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, Ground).GroundDelta;
    KnockFacing = FRotator(0.f, GetActorRotation().Yaw, 0.f).Quaternion();
    FleeSource = Cause.ContainsNaN() ? Start - Along * 300. : Cause;
    bTumbling = true;
    bFleeing = false;
    SetWalking(false);
    OnRep_Knock();
    ForceNetUpdate();
    return true;
}

bool AQuebecPedestrian::Flee(const FVector& Source, float Seconds)
{
    UWorld* World = GetWorld();
    if (!HasAuthority() || !World || IsHidden() || bTumbling || Source.ContainsNaN() || !FMath::IsFinite(Seconds)) return false;
    FleeSource = Source;
    FleeUntil = FMath::Max(bFleeing ? FleeUntil : 0.f, World->GetTimeSeconds() + FMath::Clamp(Seconds, .5f, 10.f));
    if (!bFleeing)
    {
        bFleeing = true;
        SetWalking(true);
        OnRep_Fleeing();
        ForceNetUpdate();
    }
    return true;
}

bool AQuebecPedestrian::TickStreetLife(float DeltaSeconds)
{
    UWorld* World = GetWorld();
    if (!World) return false;
    const float Now = QuebecPeopleVisuals::ServerTime(World);
    const bool bKnocked = IsKnockedDown();
    const QuebecKnock::FPose Pose = QuebecKnock::Sample(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround), Now - KnockStartedAt);
    const FQuat Turn = QuebecPeopleVisuals::Tumble(KnockPush, Pose.Pitch, Pose.Roll);
    const FVector Along = KnockPush.GetSafeNormal2D();
    const FVector Hips = KnockOrigin + Along * Pose.Forward + FVector(0., 0., Pose.Ground + Pose.Lift + Pose.Hip);
    // Stars on every peer; clients tick only while a knock lasts (OnRep_Knock wakes them).
    QuebecPeopleVisuals::PoseStars(this, DazedStars, bKnocked && Pose.bDazed, Hips + Turn.RotateVector(FVector(0., 0., 82.)), Now);
    if (!HasAuthority())
    {
        if (!bKnocked) SetActorTickEnabled(false);
        return true;
    }
    if (bTumbling)
    {
        if (bKnocked)
        {
            SetActorLocationAndRotation(Hips - Turn.RotateVector(FVector(0., 0., QuebecKnock::HipHeight)), Turn * KnockFacing);
            return true;
        }
        // Standing again: face the way it walked, then run from whatever hit it.
        bTumbling = false;
        const QuebecKnock::FTimeline Line = QuebecKnock::Timeline(QuebecPeopleVisuals::Launch(KnockPush, KnockLieSeconds, KnockGround));
        SetActorLocationAndRotation(KnockOrigin + Along * Line.RestForward + FVector(0., 0., KnockGround), KnockFacing);
        Flee(FleeSource, FleeAfterKnockSeconds);
    }
    if (!bFleeing) return false;
    if (World->GetTimeSeconds() >= FleeUntil)
    {
        bFleeing = false;
        SetWalking(false);
        OnRep_Fleeing();
        ForceNetUpdate();
        return false;
    }
    // Run straight away; the patrol's capsule sweep ends the run at anything in the way.
    const FVector Position = GetActorLocation();
    FVector Away = (Position - FleeSource).GetSafeNormal2D();
    if (Away.IsNearlyZero()) Away = GetActorForwardVector().GetSafeNormal2D();
    const FVector Next = StepTowards(Position, Position + Away * 100., FMath::Max(WalkSpeed * 3.2f, 280.f), DeltaSeconds);
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(PlateauResidentFlee), false, this);
    const FVector Height(0., 0., 88.);
    if (World->SweepSingleByChannel(Hit, Position + Height, Next + Height, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(27.f, 80.f), Query))
    {
        FleeUntil = 0.f;
        return true;
    }
    SetActorLocationAndRotation(Next, FRotator(0.f, Away.Rotation().Yaw, 0.f));
    return true;
}

void AQuebecPedestrian::OnRep_Knock()
{
    if (!HasAuthority()) SetActorTickEnabled(true);
}

void AQuebecPedestrian::OnRep_Fleeing()
{
    OnRep_Walking();
}
