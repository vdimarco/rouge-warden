// Offline UE 5.x API stub: Kismet/KismetMaterialLibrary.h
#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
class UMaterialParameterCollection;
class UMaterialInterface;
class UMaterialInstanceDynamic;
enum class EMIDCreationFlags : uint8 { None = 0x0, Transient = 0x1 };
class UKismetMaterialLibrary : public UBlueprintFunctionLibrary
{
    UESTUB_UCLASS_BODY(UKismetMaterialLibrary, UBlueprintFunctionLibrary)
    UKismetMaterialLibrary(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static void SetScalarParameterValue(UObject* WorldContextObject, UMaterialParameterCollection* Collection, FName ParameterName, float ParameterValue);
    static void SetVectorParameterValue(UObject* WorldContextObject, UMaterialParameterCollection* Collection, FName ParameterName, const FLinearColor& ParameterValue);
    static float GetScalarParameterValue(UObject* WorldContextObject, UMaterialParameterCollection* Collection, FName ParameterName);
    static FLinearColor GetVectorParameterValue(UObject* WorldContextObject, UMaterialParameterCollection* Collection, FName ParameterName);
    static UMaterialInstanceDynamic* CreateDynamicMaterialInstance(UObject* WorldContextObject, class UMaterialInterface* Parent, FName OptionalName = NAME_None, EMIDCreationFlags CreationFlags = EMIDCreationFlags::None);
};
