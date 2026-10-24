// Offline UE 5.x API stub: ContentStreaming.h (Engine)
//
// Written from memory for the NORD mobile gauntlet stills; not checked against Epic's header (unverified). Only the
// blocking calls game code uses before a capture.
#pragma once
#include "CoreMinimal.h"
struct FStreamingManagerCollection;
struct IStreamingManager
{
    virtual ~IStreamingManager();
    static FStreamingManagerCollection& Get();
    static FStreamingManagerCollection* Get_Concurrent();
    virtual void UpdateResourceStreaming(float DeltaTime, bool bProcessEverything = false) = 0;
    virtual int32 BlockTillAllRequestsFinished(float TimeLimit = 0.0f, bool bLogResults = false) = 0;
};
struct FStreamingManagerCollection : public IStreamingManager
{
    virtual void UpdateResourceStreaming(float DeltaTime, bool bProcessEverything = false) override;
    virtual int32 BlockTillAllRequestsFinished(float TimeLimit = 0.0f, bool bLogResults = false) override;
    // Streams in everything the current views need and blocks until done or TimeLimit (0 waits without limit).
    virtual int32 StreamAllResources(float TimeLimit = 0.0f);
};
