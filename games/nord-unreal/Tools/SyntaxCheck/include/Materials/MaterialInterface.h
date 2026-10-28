// Offline UE 5.x API stub: Materials/MaterialInterface.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
class UMaterial;
class UTexture;
class UPhysicalMaterial;
class UMaterialInterface : public UObject
{
    UESTUB_UCLASS_BODY(UMaterialInterface, UObject)
    UMaterialInterface(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    virtual UMaterial* GetMaterial();
    virtual const UMaterial* GetMaterial() const;
    UMaterial* GetBaseMaterial();
    virtual UPhysicalMaterial* GetPhysicalMaterial() const;
    virtual EBlendMode GetBlendMode() const;
    virtual bool IsTwoSided() const;
    virtual bool GetScalarParameterValue(const FMaterialParameterInfo& ParameterInfo, float& OutValue, bool bOveriddenOnly = false) const;
    virtual bool GetVectorParameterValue(const FMaterialParameterInfo& ParameterInfo, FLinearColor& OutValue, bool bOveriddenOnly = false) const;
    virtual bool GetTextureParameterValue(const FMaterialParameterInfo& ParameterInfo, class UTexture*& OutValue, bool bOveriddenOnly = false) const;
    virtual void GetAllScalarParameterInfo(TArray<FMaterialParameterInfo>& OutParameterInfo, TArray<FGuid>& OutParameterIds) const;
    virtual void GetAllVectorParameterInfo(TArray<FMaterialParameterInfo>& OutParameterInfo, TArray<FGuid>& OutParameterIds) const;
    virtual void GetAllTextureParameterInfo(TArray<FMaterialParameterInfo>& OutParameterInfo, TArray<FGuid>& OutParameterIds) const;
    virtual void GetUsedTextures(TArray<UTexture*>& OutTextures) const;
};
