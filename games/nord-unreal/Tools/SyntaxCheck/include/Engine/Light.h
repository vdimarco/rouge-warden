// Offline UE 5.x API stub: Engine/Light.h
#pragma once
#include "GameFramework/Actor.h"
class ULightComponent;
class ALight : public AActor
{
    UESTUB_UCLASS_BODY(ALight, AActor)
    ALight(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    ULightComponent* GetLightComponent() const;
    bool IsEnabled() const;
    void SetEnabled(bool bSetEnabled);
    void ToggleEnabled();
    void SetBrightness(float NewBrightness);
    float GetBrightness() const;
    void SetLightColor(FLinearColor NewLightColor);
    FLinearColor GetLightColor() const;
    void SetCastShadows(bool bNewValue);
protected:
    TObjectPtr<ULightComponent> LightComponent;
};
