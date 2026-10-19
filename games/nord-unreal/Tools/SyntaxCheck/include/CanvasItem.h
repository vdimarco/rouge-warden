// Offline UE 5.x API stub: CanvasItem.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
class FCanvas;
class FTexture;
class UFont;
class FMaterialRenderProxy;
struct FFontRenderInfo;
class FCanvasItem
{
public:
    FCanvasItem(const FVector2D& InPosition);
    virtual ~FCanvasItem();
    virtual void Draw(FCanvas* InCanvas) = 0;
    virtual void Draw(FCanvas* InCanvas, const FVector2D& InPosition);
    virtual void Draw(FCanvas* InCanvas, float X, float Y);
    virtual void SetColor(const FLinearColor& InColor);
    FVector2D Position;
    ESimpleElementBlendMode BlendMode;
    FLinearColor Color;
};
class FCanvasTileItem : public FCanvasItem
{
public:
    FCanvasTileItem(const FVector2D& InPosition, const FTexture* InTexture, const FLinearColor& InColor);
    FCanvasTileItem(const FVector2D& InPosition, const FTexture* InTexture, const FVector2D& InSize, const FLinearColor& InColor);
    FCanvasTileItem(const FVector2D& InPosition, const FVector2D& InSize, const FLinearColor& InColor);
    FCanvasTileItem(const FVector2D& InPosition, const FTexture* InTexture, const FVector2D& InSize, const FVector2D& InUV0, const FVector2D& InUV1, const FLinearColor& InColor);
    FCanvasTileItem(const FVector2D& InPosition, const FMaterialRenderProxy* InMaterialRenderProxy, const FVector2D& InSize);
    virtual void Draw(FCanvas* InCanvas) override;
    FVector2D Size;
    float Z;
    FVector2D UV0;
    FVector2D UV1;
    const FTexture* Texture;
    float Rotation_Deprecated;
    FRotator Rotation;
    FVector2D PivotPoint;
};
class FCanvasTextItem : public FCanvasItem
{
public:
    FCanvasTextItem(const FVector2D& InPosition, const FText& InText, const UFont* InFont, const FLinearColor& InColor);
    FCanvasTextItem(const FVector2D& InPosition, const FText& InText, const UFont* InFont, const FLinearColor& InColor, const FFontRenderInfo& InFontRenderInfo);
    virtual void Draw(FCanvas* InCanvas) override;
    void EnableShadow(const FLinearColor& InColor, const FVector2D& InOffset = FVector2D(1.0f, 1.0f));
    void DisableShadow();
    FText Text;
    const UFont* Font;
    FVector2D Scale;
    FVector2D HorizSpacingAdjust;
    FVector2D ShadowOffset;
    FLinearColor ShadowColor;
    FLinearColor OutlineColor;
    uint32 bCentreX : 1;
    uint32 bCentreY : 1;
    uint32 bOutlined : 1;
    uint32 bDontCorrectStereoscopic : 1;
    FVector2D DrawnSize;
};
class FCanvasLineItem : public FCanvasItem
{
public:
    FCanvasLineItem();
    FCanvasLineItem(const FVector2D& InPosition, const FVector2D& InEndPos);
    FCanvasLineItem(const FVector& InPosition, const FVector& InEndPos);
    virtual void Draw(FCanvas* InCanvas) override;
    void SetEndPos(const FVector2D& InEndPos);
    FVector Origin;
    FVector EndPos;
    float LineThickness;
};
class FCanvasBoxItem : public FCanvasItem
{
public:
    FCanvasBoxItem(const FVector2D& InPosition, const FVector2D& InSize);
    virtual void Draw(FCanvas* InCanvas) override;
    FVector2D Size;
    float LineThickness;
};
class FCanvasNGonItem : public FCanvasItem
{
public:
    FCanvasNGonItem(const FVector2D& InPos, const FVector2D& InRadius, int32 InNumSides, const FLinearColor& InColor);
    FCanvasNGonItem(const FVector2D& InPos, const FVector2D& InRadius, int32 InNumSides, const FTexture* InTexture, const FLinearColor& InColor);
    virtual void Draw(FCanvas* InCanvas) override;
    void SetupPosition(const FVector2D& InPos, const FVector2D& InRadius);
};
class FCanvasTriangleItem : public FCanvasItem
{
public:
    FCanvasTriangleItem(const FVector2D& InPointA, const FVector2D& InPointB, const FVector2D& InPointC, const FTexture* InTexture);
    virtual void Draw(FCanvas* InCanvas) override;
};
