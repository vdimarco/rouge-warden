// Offline UE 5.x API stub: Rendering/SkeletalMeshRenderData.h
#pragma once
#include "CoreMinimal.h"
#include "Rendering/SkeletalMeshLODRenderData.h"
class USkinnedAsset;
class FSkeletalMeshRenderData
{
public:
    TIndirectArray<FSkeletalMeshLODRenderData> LODRenderData;
    uint8 bReadyForStreaming : 1;
    uint8 NumInlinedLODs;
    uint8 CurrentFirstLODIdx;
    bool IsInitialized() const;
    int32 GetPendingFirstLODIdx(int32 MinLODIdx) const;
    int32 GetFirstValidLODIdx(int32 MinLODIdx) const;
    const FSkeletalMeshLODRenderData* GetPendingFirstLOD(int32 MinLODIdx) const;
    uint32 GetNumBoneInfluences() const;
};
