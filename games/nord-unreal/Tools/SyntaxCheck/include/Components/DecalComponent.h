// Offline UE 5.x API stub: Components/DecalComponent.h
#pragma once
#include "Components/SceneComponent.h"
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UDecalComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(UDecalComponent, USceneComponent)
    UDecalComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UMaterialInterface> DecalMaterial;
    int32 SortOrder;
    float FadeScreenSize;
    float FadeStartDelay;
    float FadeDuration;
    float FadeInDuration;
    float FadeInStartDelay;
    uint8 bDestroyOwnerAfterFade : 1;
    FVector DecalSize;
    FLinearColor DecalColor;
    void SetFadeOut(float StartDelay, float Duration, bool DestroyOwnerAfterFade = true);
    void SetFadeIn(float StartDelay, float Duaration);
    void SetFadeScreenSize(float NewFadeScreenSize);
    void SetSortOrder(int32 Value);
    void SetDecalMaterial(UMaterialInterface* NewDecalMaterial);
    UMaterialInterface* GetDecalMaterial() const;
    UMaterialInstanceDynamic* CreateDynamicMaterialInstance();
    void SetDecalColor(const FLinearColor& Color);
    float GetFadeDuration() const;
    float GetFadeStartDelay() const;
};
