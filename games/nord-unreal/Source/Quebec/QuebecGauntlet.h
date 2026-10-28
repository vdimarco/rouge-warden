#pragma once

#include "CoreMinimal.h"
#include "Containers/Ticker.h"
#include "Async/Future.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "QuebecGauntletModel.h"
#include "QuebecGauntlet.generated.h"

class ACameraActor;
class APlayerController;
class AQuebecCar;
class IConsoleVariable;
class UWorld;

// Where the subsystem is: waiting for a game world, running, waiting for the CSV file, finished. Outside the UCLASS,
// so the header tool sees no nested type.
enum class EQuebecGauntletStage : uint8 { Idle, Running, Ending, Finished };

// One step of the stills taken at a look-run hold (QuebecGauntlet.cpp BuildShots).
struct FQuebecGauntletShot
{
    enum class EKind : uint8 { Chase, Eye, Sky, Stream, Seconds, Frames, Shot };
    EKind Kind = EKind::Frames;
    int32 Sky = 0;          // Sky: the preset to switch to. Shot: the preset the still is filed under.
    double Seconds = 0.;    // Seconds: how long to wait.
    int32 Frames = 0;       // Frames: how many frames to wait.
    bool bEye = false;      // Shot: the <stop>-eye view, else <stop>-chase.
};

// One route.json sample, taken at 10 Hz.
struct FQuebecGauntletPose
{
    double Seconds = 0.;
    FVector Location = FVector::ZeroVector;
    double Yaw = 0.;
    double Speed = 0.;
    double Along = 0.;
    double Offset = 0.;
    int32 Lap = 0;
    int32 Leg = -1;
    int32 Stop = -1;
    QuebecGauntlet::EPhase Phase = QuebecGauntlet::EPhase::Wait;
};

/**
 * NORD mobile gauntlet (openspec/changes/nord-mobile-gauntlet): drives the player's car round the Plateau loop of
 * QuebecGauntletModel.h, records frame times and stills, and quits with the run's exit code. Created only with
 * -NordGauntlet. It never judges a budget; Scripts/gauntlet_metrics.py does.
 * The run starts on the first tick after the game world has begun play. Under RunUnreal, UQuebecGauntletController
 * (Source/QuebecGauntletTest) reads the console variable nord.GauntletExit and ends the test; a direct launch quits here.
 */
UCLASS()
class QUEBEC_API UQuebecGauntletSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

private:
    FTSTicker::FDelegateHandle Ticker;
    EQuebecGauntletStage Stage = EQuebecGauntletStage::Idle;
    TWeakObjectPtr<UWorld> RunWorld;
    TWeakObjectPtr<AQuebecCar> Car;
    TWeakObjectPtr<ACameraActor> EyeCamera;
    IConsoleVariable* RunExit = nullptr;   // nord.GauntletExit: -1 during the run, then ExitCode.
    int32 ExitCode = -1;

    // Settings from the command line.
    QuebecGauntlet::EMode Mode = QuebecGauntlet::EMode::Perf;
    FString RunDir;
    FString ExpectFile;
    int32 StartSky = 0;      // Index in the sky presets, or INDEX_NONE for a sky that is neither preset.
    int32 ShownSky = 0;
    FString StartSkyName;

    // The run.
    QuebecGauntlet::FRun Run;
    QuebecGauntlet::FFrameLog Frames;
    double LastWall = -1.;
    double LastWorld = 0.;
    bool bSeated = false;
    double NextSeatAt = 0.;
    bool bCVarsRead = false;

    // Stills at look-run holds. The model is not ticked while they run, so a hold lasts at least as long as its stills.
    TArray<FQuebecGauntletShot> Shots;
    int32 ShotIndex = 0;
    bool bShotEntered = false;
    double ShotStepAt = 0.;
    uint64 ShotStepFrame = 0;
    double ShotsStartedAt = 0.;
    int32 ShotStop = -1;

    // CSV profiler capture: perf and stream runs.
    bool bCsvStarted = false;
    TArray<FString> PendingCsvEvents;
    TSharedFuture<FString> CsvFile;
    double EndingSince = 0.;

    // route.json.
    TArray<FQuebecGauntletPose> Poses;
    double NextPoseAt = 0.;
    double MaxOffset = 0.;
    double MaxMeasuredOffset = 0.;

    bool Tick(float DeltaSeconds);
    void BeginRun(UWorld* World, double Now);
    void TickRun(UWorld* World, double Now, double FrameMs);
    bool Seat(UWorld* World, APlayerController* Player, double Now);
    void ReadCVars();
    void HandleEvent(const QuebecGauntlet::FStep& Step, UWorld* World, APlayerController* Player, double Now);
    void ApplyControls(const QuebecGauntlet::FControls& Controls);
    void BuildShots(int32 Stop);
    bool TickShots(UWorld* World, APlayerController* Player, double Now);
    void EnterShot(const FQuebecGauntletShot& Shot, UWorld* World, APlayerController* Player);
    void SnapToStop(UWorld* World, APlayerController* Player, int32 Stop);
    void ShowEye(UWorld* World, APlayerController* Player, int32 Stop);
    void SwitchSky(APlayerController* Player, int32 Sky);
    void StartCsv();
    void CsvEvent(const FString& Text);
    void FlushCsvEvents();
    void SamplePose(double Now);
    void Finish(double Now);
    void Complete();
    void WriteRoute() const;
    void LogSummaries() const;
    FString ShotPath(int32 Sky, int32 Stop, bool bEye) const;
};
