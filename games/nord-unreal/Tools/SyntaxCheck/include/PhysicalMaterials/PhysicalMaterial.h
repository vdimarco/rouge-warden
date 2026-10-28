// Offline UE 5.x API stub: PhysicalMaterials/PhysicalMaterial.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
namespace EFrictionCombineMode { enum Type : int { Average = 0, Min = 1, Multiply = 2, Max = 3 }; }
class UPhysicalMaterial : public UObject
{
    UESTUB_UCLASS_BODY(UPhysicalMaterial, UObject)
    UPhysicalMaterial(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float Friction;
    float StaticFriction;
    TEnumAsByte<EFrictionCombineMode::Type> FrictionCombineMode;
    bool bOverrideFrictionCombineMode;
    float Restitution;
    TEnumAsByte<EFrictionCombineMode::Type> RestitutionCombineMode;
    bool bOverrideRestitutionCombineMode;
    float Density;
    float SleepLinearVelocityThreshold;
    float SleepAngularVelocityThreshold;
    float RaiseMassToPower;
    TEnumAsByte<EPhysicalSurface> SurfaceType;
    static EPhysicalSurface DetermineSurfaceType(UPhysicalMaterial const* PhysicalMaterial);
};
