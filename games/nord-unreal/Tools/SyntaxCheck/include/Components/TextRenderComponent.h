// Offline UE 5.x API stub: Components/TextRenderComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
class UFont;
class UMaterialInterface;
enum EHorizTextAligment : int { EHTA_Left, EHTA_Center, EHTA_Right };
enum EVerticalTextAligment : int { EVRTA_TextTop, EVRTA_TextCenter, EVRTA_TextBottom, EVRTA_QuadTop };
class UTextRenderComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UTextRenderComponent, UPrimitiveComponent)
    UTextRenderComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FText Text;
    TObjectPtr<UMaterialInterface> TextMaterial;
    TObjectPtr<UFont> Font;
    TEnumAsByte<EHorizTextAligment> HorizontalAlignment;
    TEnumAsByte<EVerticalTextAligment> VerticalAlignment;
    FColor TextRenderColor;
    float XScale;
    float YScale;
    float WorldSize;
    float InvDefaultSize;
    float HorizSpacingAdjust;
    float VertSpacingAdjust;
    uint8 bAlwaysRenderAsText : 1;
    void SetText(const FText& Value);
    void K2_SetText(const FText& Value);
    void SetTextMaterial(UMaterialInterface* Material);
    void SetFont(UFont* Value);
    void SetHorizontalAlignment(EHorizTextAligment Value);
    void SetVerticalAlignment(EVerticalTextAligment Value);
    void SetTextRenderColor(FColor Value);
    void SetXScale(float Value);
    void SetYScale(float Value);
    void SetHorizSpacingAdjust(float Value);
    void SetVertSpacingAdjust(float Value);
    void SetWorldSize(float Value);
    FVector GetTextLocalSize() const;
    FVector GetTextWorldSize() const;
};
