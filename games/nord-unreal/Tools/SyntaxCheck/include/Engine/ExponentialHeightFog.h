// Offline UE 5.x API stub: Engine/ExponentialHeightFog.h
#pragma once
#include "GameFramework/Info.h"
class UExponentialHeightFogComponent;
class AExponentialHeightFog : public AInfo
{
    UESTUB_UCLASS_BODY(AExponentialHeightFog, AInfo)
    AExponentialHeightFog(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UExponentialHeightFogComponent* GetComponent() const;
    uint32 bEnabled : 1;
};
