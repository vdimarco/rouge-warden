// Offline UE 5.x API stub: Engine/SkyLight.h
#pragma once
#include "GameFramework/Info.h"
class USkyLightComponent;
class ASkyLight : public AInfo
{
    UESTUB_UCLASS_BODY(ASkyLight, AInfo)
    ASkyLight(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    USkyLightComponent* GetLightComponent() const;
    uint32 bEnabled : 1;
};
