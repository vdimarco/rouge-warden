#pragma once
#include "UEStub/UObjectCore.h"
struct FCollectionScalarParameter { FName ParameterName; float DefaultValue; };
struct FCollectionVectorParameter { FName ParameterName; FLinearColor DefaultValue; };
class UMaterialParameterCollection : public UObject
{
    UESTUB_UCLASS_BODY(UMaterialParameterCollection, UObject)
    UMaterialParameterCollection(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FCollectionScalarParameter> ScalarParameters;
    TArray<FCollectionVectorParameter> VectorParameters;
    const FCollectionScalarParameter* GetScalarParameterByName(FName ParameterName) const;
    const FCollectionVectorParameter* GetVectorParameterByName(FName ParameterName) const;
};
