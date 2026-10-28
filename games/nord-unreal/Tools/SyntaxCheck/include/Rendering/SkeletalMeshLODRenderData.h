// Offline UE 5.x API stub: Rendering/SkeletalMeshLODRenderData.h
#pragma once
#include "CoreMinimal.h"
struct FSkelMeshRenderSection
{
    uint32 BaseIndex;
    uint32 NumTriangles;
    uint16 MaterialIndex;
    uint32 BaseVertexIndex;
    uint32 NumVertices;
    TArray<uint16> BoneMap;
    bool bDisabled;
    bool bCastShadow;
};
class FSkeletalMeshLODRenderData
{
public:
    TArray<FSkelMeshRenderSection> RenderSections;
    TArray<uint16> RequiredBones;
    TArray<uint16> ActiveBoneIndices;
    uint32 GetNumVertices() const;
    uint32 GetNumTexCoords() const;
    int32 GetTotalFaces() const;
    int32 NumNonClothingSections() const;
    bool HasClothData() const;
    SIZE_T GetResourceSizeBytes() const;
};
