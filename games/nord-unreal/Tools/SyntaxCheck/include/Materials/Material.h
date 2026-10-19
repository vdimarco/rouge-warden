#pragma once
#include "Materials/MaterialInterface.h"
enum EMaterialDomain : int { MD_Surface, MD_DeferredDecal, MD_LightFunction, MD_Volume, MD_PostProcess, MD_UI, MD_RuntimeVirtualTexture, MD_MAX };
class UMaterial : public UMaterialInterface
{
    UESTUB_UCLASS_BODY(UMaterial, UMaterialInterface)
    UMaterial(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static UMaterial* GetDefaultMaterial(enum EMaterialDomain Domain);
};
