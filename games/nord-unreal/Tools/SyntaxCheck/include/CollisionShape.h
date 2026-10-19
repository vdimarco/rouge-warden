// Offline UE 5.x API stub: CollisionShape.h
#pragma once
#include "UEStub/UObjectCore.h"
namespace ECollisionShape { enum Type : int { Line, Box, Sphere, Capsule }; }
struct FCollisionShape
{
    ECollisionShape::Type ShapeType;
    FCollisionShape();
    static constexpr float MinBoxExtent() { return UE_KINDA_SMALL_NUMBER; }
    static constexpr float MinSphereRadius() { return UE_KINDA_SMALL_NUMBER; }
    static constexpr float MinCapsuleRadius() { return UE_KINDA_SMALL_NUMBER; }
    static constexpr float MinCapsuleAxisHalfHeight() { return UE_KINDA_SMALL_NUMBER; }
    bool IsLine() const;
    bool IsBox() const;
    bool IsSphere() const;
    bool IsCapsule() const;
    bool IsNearlyZero() const;
    FVector GetExtent() const;
    FVector GetBox() const;
    float GetSphereRadius() const;
    float GetCapsuleRadius() const;
    float GetCapsuleHalfHeight() const;
    float GetCapsuleAxisHalfLength() const;
    void SetBox(const FVector3f& HalfExtent);
    void SetSphere(const float Radius);
    void SetCapsule(const float Radius, const float HalfHeight);
    void SetCapsule(const FVector3f& Extent);
    float GetSphericalBounds() const;
    static FCollisionShape MakeBox(const FVector& BoxHalfExtent);
    static FCollisionShape MakeBox(const FVector3f& BoxHalfExtent);
    static FCollisionShape MakeSphere(const float SphereRadius);
    static FCollisionShape MakeCapsule(const float CapsuleRadius, const float CapsuleHalfHeight);
    static FCollisionShape MakeCapsule(const FVector& Extent);
    static FCollisionShape LineShape;
};
