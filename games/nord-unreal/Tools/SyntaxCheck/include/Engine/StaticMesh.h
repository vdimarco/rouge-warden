// Offline UE 5.x API stub: Engine/StaticMesh.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
class UMaterialInterface;
class UBodySetup;
class UStaticMeshSocket;
struct FMeshUVChannelInfo { bool bInitialized; float LocalUVDensities[4]; };
struct FStaticMaterial
{
    FStaticMaterial();
    FStaticMaterial(class UMaterialInterface* InMaterialInterface, FName InMaterialSlotName = NAME_None);
    TObjectPtr<class UMaterialInterface> MaterialInterface;
    FName MaterialSlotName;
#if WITH_EDITORONLY_DATA
    FName ImportedMaterialSlotName;
#endif
    FMeshUVChannelInfo UVChannelData;
    friend bool operator==(const FStaticMaterial& LHS, const FStaticMaterial& RHS);
};
class UStreamableRenderAsset : public UObject { UESTUB_UCLASS_BODY(UStreamableRenderAsset, UObject) UStreamableRenderAsset(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); };
class UStaticMesh : public UStreamableRenderAsset
{
    UESTUB_UCLASS_BODY(UStaticMesh, UStreamableRenderAsset)
    UStaticMesh(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<TObjectPtr<UStaticMeshSocket>> Sockets;
    const TArray<FStaticMaterial>& GetStaticMaterials() const;
    TArray<FStaticMaterial>& GetStaticMaterials();
    void SetStaticMaterials(const TArray<FStaticMaterial>& InStaticMaterials);
    virtual UMaterialInterface* GetMaterial(int32 MaterialIndex) const;
    virtual int32 GetMaterialIndex(FName MaterialSlotName) const;
    FBox GetBoundingBox() const;
    FBoxSphereBounds GetBounds() const;
    FBoxSphereBounds GetExtendedBounds() const;
    int32 GetNumLODs() const;
    int32 GetNumSections(int32 InLOD) const;
    int32 GetNumVertices(int32 LODIndex) const;
    int32 GetNumTriangles(int32 LODIndex) const;
    UBodySetup* GetBodySetup() const;
    UStaticMeshSocket* FindSocket(FName InSocketName) const;
    bool IsNaniteEnabled() const;
    int32 GetMinLODIdx() const;
};
