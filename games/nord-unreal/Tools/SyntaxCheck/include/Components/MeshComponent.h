// Offline UE 5.x API stub: Components/MeshComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
class UMeshComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(UMeshComponent, UPrimitiveComponent)
    UMeshComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<TObjectPtr<class UMaterialInterface>> OverrideMaterials;
    virtual TArray<class UMaterialInterface*> GetMaterials() const;
    virtual int32 GetNumMaterials() const override;
    virtual UMaterialInterface* GetMaterial(int32 ElementIndex) const override;
    virtual void SetMaterial(int32 ElementIndex, UMaterialInterface* Material) override;
    virtual void SetMaterialByName(FName MaterialSlotName, class UMaterialInterface* Material) override;
    virtual TArray<FName> GetMaterialSlotNames() const override;
    virtual int32 GetMaterialIndex(FName MaterialSlotName) const override;
    virtual bool IsMaterialSlotNameValid(FName MaterialSlotName) const override;
    void EmptyOverrideMaterials();
    bool HasOverrideMaterials();
    void SetScalarParameterValueOnMaterials(const FName ParameterName, const float ParameterValue);
    void SetVectorParameterValueOnMaterials(const FName ParameterName, const FVector ParameterValue);
    void SetColorParameterValueOnMaterials(const FName ParameterName, const FLinearColor ParameterValue);
    void PrestreamTextures(float Seconds, bool bPrioritizeCharacterTextures, int32 CinematicTextureGroups = 0);
};
