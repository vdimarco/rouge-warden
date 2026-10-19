#pragma once
#include "Materials/MaterialParameterCollection.h"
class UMaterialParameterCollectionInstance : public UObject
{
    UESTUB_UCLASS_BODY(UMaterialParameterCollectionInstance, UObject)
    UMaterialParameterCollectionInstance(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    bool SetScalarParameterValue(FName ParameterName, float ParameterValue);
    bool SetVectorParameterValue(FName ParameterName, const FLinearColor& ParameterValue);
    bool GetScalarParameterValue(FName ParameterName, float& OutParameterValue) const;
    bool GetVectorParameterValue(FName ParameterName, FLinearColor& OutParameterValue) const;
};
