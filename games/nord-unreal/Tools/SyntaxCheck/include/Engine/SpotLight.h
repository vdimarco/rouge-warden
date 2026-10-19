#pragma once
#include "Engine/Light.h"
class USpotLightComponent;
class ASpotLight : public ALight
{
    UESTUB_UCLASS_BODY(ASpotLight, ALight)
    ASpotLight(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<USpotLightComponent> SpotLightComponent;
};
