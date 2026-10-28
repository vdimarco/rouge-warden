// Offline UE 5.x API stub: Engine/Canvas.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
#include "CanvasItem.h"
class UFont;
class UTexture;
class UMaterialInterface;
class FCanvas;
class FSceneView;
struct FFontRenderInfo
{
    uint32 bClipText : 1;
    uint32 bEnableShadow : 1;
    FFontRenderInfo();
};
class UCanvas : public UObject
{
    UESTUB_UCLASS_BODY(UCanvas, UObject)
    UCanvas(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float OrgX;
    float OrgY;
    float ClipX;
    float ClipY;
    FColor DrawColor;
    uint32 bCenterX : 1;
    uint32 bCenterY : 1;
    uint32 bNoSmooth : 1;
    int32 SizeX;
    int32 SizeY;
    FPlane ColorModulate;
    TObjectPtr<UTexture> DefaultTexture;
    FCanvas* Canvas;
    FSceneView* SceneView;
    float GetDPIScale() const;
    FVector Project(FVector Location, bool bClampToNearPlane = true) const;
    void Deproject(FVector2D ScreenPosition, FVector& WorldOrigin, FVector& WorldDirection) const;
    void DrawItem(class FCanvasItem& Item);
    void DrawItem(class FCanvasItem& Item, const FVector2D& InPosition);
    void DrawItem(class FCanvasItem& Item, float X, float Y);
    float DrawText(const UFont* InFont, const FString& InText, float X, float Y, float XScale = 1.f, float YScale = 1.f, const FFontRenderInfo& RenderInfo = FFontRenderInfo());
    float DrawText(const UFont* InFont, const FText& InText, float X, float Y, float XScale = 1.f, float YScale = 1.f, const FFontRenderInfo& RenderInfo = FFontRenderInfo());
    void DrawTile(UTexture* Tex, float X, float Y, float XL, float YL, float U, float V, float UL, float VL, EBlendMode BlendMode = BLEND_Translucent);
    void DrawIcon(struct FCanvasIcon Icon, float X, float Y, float Scale = 0.f);
    void StrLen(const UFont* InFont, const FString& InText, float& XL, float& YL, bool bDPIAware = false);
    void StrLen(const UFont* InFont, const FString& InText, double& XL, double& YL, bool bDPIAware = false);
    void TextSize(const UFont* InFont, const FString& InText, float& XL, float& YL, float ScaleX = 1.f, float ScaleY = 1.f);
    void TextSize(const UFont* InFont, const FString& InText, double& XL, double& YL, double ScaleX = 1.0, double ScaleY = 1.0);
    void SetDrawColor(uint8 R, uint8 G, uint8 B, uint8 A = 255);
    void SetDrawColor(FColor const& C);
    void SetLinearDrawColor(FLinearColor InColor, float OverrideAlpha = -1.0f);
    void SetClip(float X, float Y);
    void Reset(bool bKeepOrigin = false);
    void K2_DrawLine(FVector2D ScreenPositionA = FVector2D(0, 0), FVector2D ScreenPositionB = FVector2D(0, 0), float Thickness = 1.0f, FLinearColor RenderColor = FLinearColor::White);
    void K2_DrawTexture(UTexture* RenderTexture, FVector2D ScreenPosition, FVector2D ScreenSize, FVector2D CoordinatePosition, FVector2D CoordinateSize = FVector2D::UnitVector, FLinearColor RenderColor = FLinearColor::White, EBlendMode BlendMode = BLEND_Translucent, float Rotation = 0.f, FVector2D PivotPoint = FVector2D(0.5f, 0.5f));
    void K2_DrawMaterial(UMaterialInterface* RenderMaterial, FVector2D ScreenPosition, FVector2D ScreenSize, FVector2D CoordinatePosition, FVector2D CoordinateSize = FVector2D::UnitVector, float Rotation = 0.f, FVector2D PivotPoint = FVector2D(0.5f, 0.5f));
    void K2_DrawText(UFont* RenderFont, const FString& RenderText, FVector2D ScreenPosition, FVector2D Scale = FVector2D(1.0f, 1.0f), FLinearColor RenderColor = FLinearColor::White, float Kerning = 0.0f, FLinearColor ShadowColor = FLinearColor(0, 0, 0), FVector2D ShadowOffset = FVector2D(1, 1), bool bCentreX = false, bool bCentreY = false, bool bOutlined = false, FLinearColor OutlineColor = FLinearColor(0, 0, 0));
    void K2_DrawBox(FVector2D ScreenPosition, FVector2D ScreenSize, float Thickness = 1.0f, FLinearColor RenderColor = FLinearColor::White);
    void K2_DrawPolygon(UTexture* RenderTexture, FVector2D ScreenPosition, FVector2D Radius = FVector2D(1.0f, 1.0f), int32 NumberOfSides = 3, FLinearColor RenderColor = FLinearColor::White);
    FVector K2_Project(FVector WorldLocation);
    void K2_Deproject(FVector2D ScreenPosition, FVector& WorldOrigin, FVector& WorldDirection);
    FVector2D K2_StrLen(UFont* RenderFont, const FString& RenderText);
    FVector2D K2_TextSize(UFont* RenderFont, const FString& RenderText, FVector2D Scale = FVector2D(1.0f, 1.0f));
};
