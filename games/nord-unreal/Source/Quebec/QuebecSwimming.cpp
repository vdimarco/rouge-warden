#include "QuebecGameplay.h"
#include "LaFontaineWater.h"
#include "Components/BrushComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PhysicsVolume.h"

namespace
{
    double SegmentDistanceSquared(FVector2D Point, FVector2D A, FVector2D B)
    {
        const FVector2D Direction = B - A;
        const double Along = FMath::Clamp(FVector2D::DotProduct(Point - A, Direction) / FMath::Max(Direction.SizeSquared(), 1.), 0., 1.);
        return FVector2D::DistSquared(Point, A + Direction * Along);
    }

    bool PondWaterAt(FVector2D Point, float& Depth)
    {
        Depth = 0.f;
        for (const auto& Bridge : LaFontaineWater::Bridges)
            if (SegmentDistanceSquared(Point, Bridge.A, Bridge.B) <= FMath::Square(Bridge.HalfWidth + 42.f)) return false;
        for (int32 Pond = 0; Pond < 2; ++Pond)
        {
            bool bOuter = false, bHole = false;
            double Nearest = MAX_dbl;
            for (const auto& Ring : LaFontaineWater::Rings)
                if (Ring.Pond == Pond)
                {
                    bool bInside = false;
                    for (int32 I = 0, J = Ring.Points.Num() - 1; I < Ring.Points.Num(); J = I++)
                    {
                        const FVector2D A = Ring.Points[I], B = Ring.Points[J];
                        if ((A.Y > Point.Y) != (B.Y > Point.Y) && Point.X < (B.X - A.X) * (Point.Y - A.Y) / (B.Y - A.Y) + A.X)
                            bInside = !bInside;
                        Nearest = FMath::Min(Nearest, SegmentDistanceSquared(Point, A, B));
                    }
                    if (Ring.bHole) bHole |= bInside; else bOuter |= bInside;
                }
            if (bOuter && !bHole)
            {
                const double Shore = FMath::Sqrt(Nearest);
                Depth = FMath::Clamp((Shore - 42.) / 100., 0., 1.);
                return Shore > 42.;
            }
        }
        return false;
    }
}

void AQuebecCharacter::Jump()
{
    if (GetCharacterMovement()->IsSwimming())
    {
        SwimStrokeUntil = GetWorld()->GetTimeSeconds() + .2f;
        ServerSwimStroke();
    }
    else Super::Jump();
}

void AQuebecCharacter::ServerSwimStroke_Implementation()
{
    if (!bInVehicle && GetCharacterMovement()->IsSwimming() && GetWorld()->GetTimeSeconds() >= SwimStrokeUntil)
        SwimStrokeUntil = GetWorld()->GetTimeSeconds() + .2f;
}

void AQuebecCharacter::UpdateSwimming(float DeltaSeconds)
{
    if (!GetWorld()) return;
    UCharacterMovementComponent* Movement = GetCharacterMovement();
    UCapsuleComponent* Capsule = GetCapsuleComponent();
    const FVector Position = GetActorLocation();
    const float HalfHeight = Capsule->GetScaledCapsuleHalfHeight();
    float Depth = 0.f;
    const bool bToronto = QuebecDistrict::IsToronto(GetWorld());
    const bool bMappedWater = !bToronto && PondWaterAt(FVector2D(Position), Depth);
    FHitResult Floor;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(SwimFloor), true, this);
    const bool bFloor = (bMappedWater || bSwimPoseActive) &&
        GetWorld()->LineTraceSingleByChannel(Floor, Position + FVector(0., 0., 200.), Position - FVector(0., 0., 400.), ECC_Visibility, Query);
    bool bWet = !bInVehicle && bMappedWater && Position.Z - HalfHeight < LaFontaineWater::SurfaceZ + 50.f &&
        Position.Z > LaFontaineWater::SurfaceZ - 200.f && (!bFloor || Floor.ImpactPoint.Z <= LaFontaineWater::SurfaceZ + 30.f);
    if (!bToronto && !bWet && bSwimPoseActive && !bInVehicle && bFloor && Floor.ImpactNormal.Z > .65f)
    {
        const FVector Exit(Position.X, Position.Y, FMath::Max(Position.Z, Floor.ImpactPoint.Z + HalfHeight + 2.f));
        if (GetWorld()->OverlapBlockingTestByChannel(Exit, GetActorQuat(), ECC_Pawn,
            FCollisionShape::MakeCapsule(Capsule->GetScaledCapsuleRadius(), HalfHeight), Query)) bWet = true;
        else if (HasAuthority() || IsLocallyControlled()) SetActorLocation(Exit, true);
    }
    if (bWet)
    {
        if (!SwimVolume)
        {
            for (TActorIterator<APhysicsVolume> It(GetWorld()); It; ++It)
                if (It->ActorHasTag(TEXT("NordSurfaceWater"))) { SwimVolume = *It; break; }
            if (!SwimVolume)
            {
                FActorSpawnParameters Parameters;
                Parameters.ObjectFlags |= RF_Transient;
                SwimVolume = GetWorld()->SpawnActor<APhysicsVolume>(Parameters);
                if (!SwimVolume) return;
                SwimVolume->Tags.Add(TEXT("NordSurfaceWater"));
                SwimVolume->bWaterVolume = true;
                SwimVolume->FluidFriction = .8f;
                SwimVolume->GetBrushComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
            }
        }
        if (bFloor && Floor.GetActor() && !SwimFloors.Contains(Floor.GetActor()))
        {
            SwimFloors.Add(Floor.GetActor());
            Capsule->IgnoreActorWhenMoving(Floor.GetActor(), true);
        }
        // The source map has a flat ground collider under the ponds; only this swimmer ignores it.
        Capsule->SetShouldUpdatePhysicsVolume(false);
        Capsule->SetPhysicsVolume(SwimVolume, true);
        if (HasAuthority() || IsLocallyControlled())
        {
            Movement->SetMovementMode(MOVE_Swimming);
            const float Surface = LaFontaineWater::SurfaceZ + HalfHeight - 60.f * Depth;
            Movement->Velocity.Z = FMath::Clamp((Surface - Position.Z) * 5.f, -150.f, 150.f);
            if (GetWorld()->GetTimeSeconds() < SwimStrokeUntil) Movement->Velocity.Z = FMath::Max(Movement->Velocity.Z, 120.);
        }
        // shortcut: surface swimming reuses crew locomotion; replace with strokes when swim clips exist.
        const float TravelPose = FMath::Clamp(GetVelocity().Size2D() / 100., 0., 1.);
        GetMesh()->SetRelativeRotation(FRotator(0., -90., 80.f * Depth * TravelPose));
        GetMesh()->SetRelativeLocation(FVector(-85.f * Depth * TravelPose, 0., -96.f + Depth * FMath::Lerp(-77.f, 45.f, TravelPose)));
        CrewProp->SetHiddenInGame(true);
        bSwimPoseActive = true;
    }
    else if (bSwimPoseActive)
    {
        for (AActor* Actor : SwimFloors) if (IsValid(Actor)) Capsule->IgnoreActorWhenMoving(Actor, false);
        SwimFloors.Empty();
        Capsule->SetPhysicsVolume(GetWorld()->GetDefaultPhysicsVolume(), true);
        Capsule->SetShouldUpdatePhysicsVolume(true);
        GetMesh()->SetRelativeRotation(FRotator(0., -90., 0.));
        GetMesh()->SetRelativeLocation(FVector(0., 0., -96.));
        CrewProp->SetHiddenInGame(false);
        bSwimPoseActive = false;
        SwimStrokeUntil = 0.f;
    }
}

#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecSwimmingGeometryTest, "Quebec.Swimming.PondGeometry", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecSwimmingGeometryTest::RunTest(const FString& Parameters)
{
    float Depth;
    TestTrue(TEXT("North pond swims"), PondWaterAt({-10651.111588, 7939.899}, Depth) && Depth > .9f);
    TestTrue(TEXT("South pond swims"), PondWaterAt({3585.566498, -6351.3626}, Depth) && Depth > .9f);
    TestFalse(TEXT("Starting street is dry"), PondWaterAt({39113., -7523.}, Depth));
    TestFalse(TEXT("Pond island is dry"), PondWaterAt({-9394.574522, 5345.0298}, Depth));
    for (const auto& Bridge : LaFontaineWater::Bridges)
        TestFalse(TEXT("Bridge deck is dry"), PondWaterAt((Bridge.A + Bridge.B) * .5, Depth));
    return true;
}
#endif
