// Offline UE 5.x API stub: GameFramework/HUD.h
#pragma once
#include "GameFramework/Actor.h"
class APlayerController;
class APawn;
class UCanvas;
class UFont;
class UTexture;
class UMaterialInterface;
class AHUD : public AActor
{
    UESTUB_UCLASS_BODY(AHUD, AActor)
    AHUD(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<APlayerController> PlayerOwner;
    uint8 bLostFocusPaused : 1;
    uint8 bShowHUD : 1;
    uint8 bShowDebugInfo : 1;
    uint8 bShowHitBoxDebugInfo : 1;
    uint8 bShowOverlays : 1;
    uint8 bEnableDebugTextShadow : 1;
    TArray<TObjectPtr<AActor>> PostRenderedActors;
    TArray<FName> DebugDisplay;
    TArray<FName> ToggledDebugCategories;
    TObjectPtr<UCanvas> Canvas;
    TObjectPtr<UCanvas> DebugCanvas;
    APlayerController* GetOwningPlayerController() const;
    APawn* GetOwningPawn() const;
    virtual void DrawHUD();
    virtual void PostRender();
    virtual void ShowHUD();
    virtual void ShowDebug(FName DebugType = NAME_None);
    virtual void ShowDebugToggleSubCategory(FName Category);
    virtual void DrawActorOverlays(FVector Viewpoint, FRotator ViewRotation);
    void DrawText(const FString& Text, FLinearColor TextColor, float ScreenX, float ScreenY, UFont* Font = nullptr, float Scale = 1.f, bool bScalePosition = false);
    void DrawLine(float StartScreenX, float StartScreenY, float EndScreenX, float EndScreenY, FLinearColor LineColor, float LineThickness = 0.f);
    void DrawRect(FLinearColor RectColor, float ScreenX, float ScreenY, float ScreenW, float ScreenH);
    void DrawTexture(UTexture* Texture, float ScreenX, float ScreenY, float ScreenW, float ScreenH, float TextureU, float TextureV, float TextureUWidth, float TextureVHeight, FLinearColor TintColor = FLinearColor::White, EBlendMode BlendMode = BLEND_Translucent, float Scale = 1.f, bool bScalePosition = false, float Rotation = 0.f, FVector2D RotPivot = FVector2D::ZeroVector);
    void DrawTextureSimple(UTexture* Texture, float ScreenX, float ScreenY, float Scale = 1.f, bool bScalePosition = false);
    void DrawMaterial(UMaterialInterface* Material, float ScreenX, float ScreenY, float ScreenW, float ScreenH, float MaterialU, float MaterialV, float MaterialUWidth, float MaterialVHeight, float Scale = 1.f, bool bScalePosition = false, float Rotation = 0.f, FVector2D RotPivot = FVector2D::ZeroVector);
    void DrawMaterialSimple(UMaterialInterface* Material, float ScreenX, float ScreenY, float ScreenW, float ScreenH, float Scale = 1.f, bool bScalePosition = false);
    void DrawMaterialTriangle(UMaterialInterface* Material, FVector2D V0_Pos, FVector2D V1_Pos, FVector2D V2_Pos, FVector2D V0_UV, FVector2D V1_UV, FVector2D V2_UV, FLinearColor V0_Color = FLinearColor::White, FLinearColor V1_Color = FLinearColor::White, FLinearColor V2_Color = FLinearColor::White);
    void GetTextSize(const FString& Text, float& OutWidth, float& OutHeight, UFont* Font = nullptr, float Scale = 1.f) const;
    FVector Project(FVector Location, bool bClampToZeroPlane = true) const;
    void Deproject(float ScreenX, float ScreenY, FVector& WorldPosition, FVector& WorldDirection) const;
    void AddHitBox(FVector2D Position, FVector2D Size, FName InName, bool bConsumesInput, int32 Priority = 0);
    void AddDebugText(const FString& DebugText, AActor* SrcActor = nullptr, float Duration = 0, FVector Offset = FVector(ForceInit), FVector DesiredOffset = FVector(ForceInit), FColor TextColor = FColor(255, 255, 255, 255), bool bSkipOverwriteCheck = false, bool bAbsoluteLocation = false, bool bKeepAttachedToActor = false, UFont* InFont = nullptr, float FontScale = 1.0, bool bDrawShadow = false);
    void RemoveAllDebugStrings();
    void RemoveDebugText(AActor* SrcActor, bool bLeaveDurationText = false);
    template <typename ClassFilter> void GetActorsInSelectionRectangle(const FVector2D& FirstPoint, const FVector2D& SecondPoint, TArray<ClassFilter*>& OutActors, bool bIncludeNonCollidingComponents = true, bool bActorMustBeFullyEnclosed = false);
    virtual void NotifyHitBoxClick(FName BoxName);
    virtual void NotifyHitBoxRelease(FName BoxName);
    virtual void NotifyHitBoxBeginCursorOver(FName BoxName);
    virtual void NotifyHitBoxEndCursorOver(FName BoxName);
    virtual void PostInitializeComponents() override;
};
