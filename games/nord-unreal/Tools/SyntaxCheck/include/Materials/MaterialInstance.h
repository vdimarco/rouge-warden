#pragma once
#include "Materials/MaterialInterface.h"
class UMaterialInstance : public UMaterialInterface
{
    UESTUB_UCLASS_BODY(UMaterialInstance, UMaterialInterface)
    UMaterialInstance(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UMaterialInterface> Parent;
};
