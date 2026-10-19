// Offline UE 5.x API stub: GameFramework/DamageType.h
#pragma once
#include "UEStub/UObjectCore.h"
class UDamageType : public UObject
{
    UESTUB_UCLASS_BODY(UDamageType, UObject)
    UDamageType(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    uint32 bCausedByWorld : 1;
    uint32 bScaleMomentumByMass : 1;
    uint32 bRadialDamageVelChange : 1;
    float DamageImpulse;
    float DestructibleImpulse;
    float DestructibleDamageSpreadScale;
    float DamageFalloff;
};
