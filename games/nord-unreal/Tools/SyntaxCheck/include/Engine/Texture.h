// Offline UE 5.x API stub: Engine/Texture.h
#pragma once
#include "UEStub/UObjectCore.h"
class FTexture;
class FTextureResource;
enum TextureFilter : int { TF_Nearest, TF_Bilinear, TF_Trilinear, TF_Default, TF_MAX };
class UTexture : public UObject
{
    UESTUB_UCLASS_BODY(UTexture, UObject)
    UTexture(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TEnumAsByte<enum TextureFilter> Filter;
    uint8 SRGB : 1;
    virtual float GetSurfaceWidth() const;
    virtual float GetSurfaceHeight() const;
    FTextureResource* GetResource();
    void UpdateResource();
};
class UTexture2D : public UTexture
{
    UESTUB_UCLASS_BODY(UTexture2D, UTexture)
    UTexture2D(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    int32 GetSizeX() const;
    int32 GetSizeY() const;
    static UTexture2D* CreateTransient(int32 InSizeX, int32 InSizeY, uint8 InFormat = 2, const FName InName = NAME_None);
};
class UTextureCube : public UTexture { UESTUB_UCLASS_BODY(UTextureCube, UTexture) UTextureCube(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); };
class UTextureRenderTarget2D : public UTexture { UESTUB_UCLASS_BODY(UTextureRenderTarget2D, UTexture) UTextureRenderTarget2D(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); int32 SizeX; int32 SizeY; FLinearColor ClearColor; };
class UTextureLightProfile : public UTexture2D { UESTUB_UCLASS_BODY(UTextureLightProfile, UTexture2D) UTextureLightProfile(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); };
