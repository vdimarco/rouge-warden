#pragma once
#include "Engine/Light.h"
class UPointLightComponent;
class APointLight : public ALight
{
    UESTUB_UCLASS_BODY(APointLight, ALight)
    APointLight(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UPointLightComponent> PointLightComponent;
};
