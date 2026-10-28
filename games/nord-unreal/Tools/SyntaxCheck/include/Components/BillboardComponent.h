// Offline UE 5.x API stub: Components/BillboardComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
class UTexture2D;
class UBillboardComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UBillboardComponent, UPrimitiveComponent)
    UBillboardComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UTexture2D> Sprite;
    uint32 bIsScreenSizeScaled : 1;
    float ScreenSize;
    float U, UL, V, VL;
    void SetSprite(UTexture2D* NewSprite);
    void SetUV(int32 NewU, int32 NewUL, int32 NewV, int32 NewVL);
    void SetSpriteAndUV(UTexture2D* NewSprite, int32 NewU, int32 NewUL, int32 NewV, int32 NewVL);
    void SetOpacityMaskRefVal(float RefVal);
};
