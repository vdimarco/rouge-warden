// Offline UE 5.x API stub: Materials/MaterialInstanceDynamic.h
#pragma once
#include "Materials/MaterialInstance.h"
class UTexture;
class UMaterialInstanceDynamic : public UMaterialInstance
{
    UESTUB_UCLASS_BODY(UMaterialInstanceDynamic, UMaterialInstance)
    UMaterialInstanceDynamic(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static UMaterialInstanceDynamic* Create(class UMaterialInterface* ParentMaterial, class UObject* InOuter);
    static UMaterialInstanceDynamic* Create(class UMaterialInterface* ParentMaterial, class UObject* InOuter, FName Name);
    void SetScalarParameterValue(FName ParameterName, float Value);
    void SetScalarParameterValueByInfo(const FMaterialParameterInfo& ParameterInfo, float Value);
    float K2_GetScalarParameterValue(FName ParameterName);
    void SetVectorParameterValue(FName ParameterName, const FLinearColor& Value);
    void SetVectorParameterValueByInfo(const FMaterialParameterInfo& ParameterInfo, const FLinearColor& Value);
    FLinearColor K2_GetVectorParameterValue(FName ParameterName);
    void SetDoubleVectorParameterValue(FName ParameterName, FVector4 Value);
    void SetTextureParameterValue(FName ParameterName, class UTexture* Value);
    void SetTextureParameterValueByInfo(const FMaterialParameterInfo& ParameterInfo, class UTexture* Value);
    UTexture* K2_GetTextureParameterValue(FName ParameterName);
    void K2_InterpolateMaterialInstanceParams(UMaterialInstance* SourceA, UMaterialInstance* SourceB, float Alpha);
    void K2_CopyMaterialInstanceParameters(UMaterialInterface* Source, bool bQuickParametersOnly = false);
    void CopyParameterOverrides(UMaterialInstance* MaterialInstance);
    void CopyInterpParameters(UMaterialInstance* Source);
    void ClearParameterValues();
};
