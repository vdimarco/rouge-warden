// Offline UE 5.x API stub: Components/ArrowComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
class UArrowComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UArrowComponent, UPrimitiveComponent)
    UArrowComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FColor ArrowColor;
    float ArrowSize;
    float ArrowLength;
    float ScreenSize;
    uint8 bIsScreenSizeScaled : 1;
    uint8 bTreatAsASprite : 1;
    void SetArrowColor(FLinearColor NewColor);
    void SetArrowSize(float NewSize);
    void SetArrowLength(float NewLength);
};
