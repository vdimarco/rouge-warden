#pragma once

#include "CoreMinimal.h"
#include "Containers/Ticker.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "QuebecStreamIdle.generated.h"

class UGameViewportClient;

struct FQuebecStreamIdleState
{
    double Started = -1.;
    double LastViewer = 0.;

    bool Update(double Now, bool bHasViewer)
    {
        if (Started < 0.) { Started = Now; LastViewer = Now; }
        if (bHasViewer) LastViewer = Now;
        return Now - Started >= 60. && Now - LastViewer >= 30.;
    }
};

/** Skip unwatched 3D rendering, retaining listen-server simulation and native multiplayer. */
UCLASS()
class QUEBEC_API UQuebecStreamIdleSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

private:
    FTSTicker::FDelegateHandle Ticker;
    FQuebecStreamIdleState State;
    FString StreamerId;
    TWeakObjectPtr<UGameViewportClient> Viewport;
    bool bOriginalDisabled = false;
    bool bSleeping = false;
    bool bThrottle = false;
    bool bLogFps = false;
    double LastFpsTime = 0.;
    uint64 LastFrames = 0;

    bool Tick(float DeltaSeconds);
    void ViewerJoined(FString Id, FString PlayerId);
    void SetSleeping(bool bSleep, int32 Viewers);
};
