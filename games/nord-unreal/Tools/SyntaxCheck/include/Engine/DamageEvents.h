// Offline UE 5.x API stub: Engine/DamageEvents.h (moved out of EngineTypes.h in UE 5.1)
#pragma once
#include "Engine/EngineTypes.h"
#include "Templates/SubclassOf.h"
class UDamageType;
struct FDamageEvent
{
    TSubclassOf<UDamageType> DamageTypeClass;
    FDamageEvent();
    FDamageEvent(const FDamageEvent& InDamageEvent);
    explicit FDamageEvent(TSubclassOf<UDamageType> InDamageTypeClass);
    virtual ~FDamageEvent();
    FDamageEvent& operator=(const FDamageEvent&);
    static const int32 ClassID = 0;
    virtual int32 GetTypeID() const;
    virtual bool IsOfType(int32 InID) const;
    virtual void GetBestHitInfo(AActor const* HitActor, AActor const* HitInstigator, FHitResult& OutHitInfo, FVector& OutImpulseDir) const;
};
struct FPointDamageEvent : public FDamageEvent
{
    float Damage;
    FVector_NetQuantizeNormal ShotDirection;
    FHitResult HitInfo;
    FPointDamageEvent();
    FPointDamageEvent(float InDamage, const FHitResult& InHitInfo, FVector const& InShotDirection, TSubclassOf<UDamageType> InDamageTypeClass);
    static const int32 ClassID = 1;
    int32 GetTypeID() const override;
    bool IsOfType(int32 InID) const override;
};
struct FRadialDamageParams
{
    float BaseDamage;
    float MinimumDamage;
    float InnerRadius;
    float OuterRadius;
    float DamageFalloff;
    FRadialDamageParams();
    FRadialDamageParams(float InBaseDamage, float InInnerRadius, float InOuterRadius, float InDamageFalloff);
    FRadialDamageParams(float InBaseDamage, float InMinimumDamage, float InInnerRadius, float InOuterRadius, float InDamageFalloff);
    FRadialDamageParams(float InBaseDamage, float InRadius);
    float GetDamageScale(float DistanceFromEpicenter) const;
    float GetMaxRadius() const;
};
struct FRadialDamageEvent : public FDamageEvent
{
    FRadialDamageParams Params;
    FVector Origin;
    TArray<FHitResult> ComponentHits;
    static const int32 ClassID = 2;
    int32 GetTypeID() const override;
    bool IsOfType(int32 InID) const override;
};
