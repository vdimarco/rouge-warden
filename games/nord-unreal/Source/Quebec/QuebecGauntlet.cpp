#include "QuebecGauntlet.h"

#include "QuebecGameplay.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "ContentStreaming.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "HAL/IConsoleManager.h"
#include "HAL/PlatformTime.h"
#include "Misc/CommandLine.h"
#include "Misc/DateTime.h"
#include "Misc/FileHelper.h"
#include "Misc/PackageName.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "ProfilingDebugging/CsvProfiler.h"
#include "UnrealClient.h"

#include <string>
#include <vector>

// Log lines, all "NORD_GAUNTLET ..." on LogTemp, read by Scripts/gauntlet_loop.py and gauntlet_metrics.py:
//   begin, route, seated, cvar and cvars (readback), stop=<S> lap=<n> pass|hold=begin (one per stop and lap),
//   leg=<S1-S2> lap=<n> begin, lap=<n> warm=begin, still, sky, csv, summary (leg=all lap=all first), result.
// CSV events (EVENTS column): "NordGauntlet leg=S1-S2 lap=1", "... hold stop=S2 lap=1", "... warm lap=0",
//   "... done" and "... fail exit=<code>", as gauntlet_metrics.py classify_event expects.
// Files under -NordGauntletRun=<dir>: native/NordGauntlet-<mode>-<sky>.csv, native/route.json and
//   look/<sky>/<stop>-<eye|chase>-<W>x<H>.png (Data/Gauntlet/loop.json names.still).
// Engine APIs written from memory and not yet built against UE 5.8 (unverified): FCsvProfiler (BeginCapture,
//   EndCapture, IsCapturing, CSV_EVENT_GLOBAL, CSV_METADATA), FPlatformMisc::RequestExitWithStatus,
//   IStreamingManager::StreamAllResources, ACameraActor, FScreenshotRequest with a full path, console variables
//   registered at run time (RegisterConsoleVariable, UnregisterConsoleObject, IConsoleVariable::Set), and that
//   DisableInput on the controller itself drops a viewer's input.

namespace
{
    using QuebecGauntlet::EEvent;
    using QuebecGauntlet::EExit;
    using QuebecGauntlet::EMode;
    using QuebecGauntlet::EPhase;
    using QuebecPursuit::FVec2;

    // Data/Gauntlet/loop.json "skies". A look run takes both at each hold, starting with the one on the command line.
    struct FGauntletSky
    {
        const TCHAR* Name;
        float Hour;
        const TCHAR* Weather;
    };
    const FGauntletSky GauntletSkies[] = { {TEXT("day"), 15.f, TEXT("Clear")}, {TEXT("night_rain"), 22.f, TEXT("Rain")} };
    constexpr int32 GauntletSkyCount = UE_ARRAY_COUNT(GauntletSkies);

    constexpr double PoseInterval = .1;     // route.json at 10 Hz.
    constexpr double CVarReadAfter = 5.;    // -ExecCmds and a -DeviceProfile have applied by then.
    constexpr double SeatRetry = 1.;
    constexpr double CarHeight = 102.;      // Car origin above the road, as the population places cars.
    constexpr double AvatarSide = 260.;     // The avatar steps in from beside the car, as -NordCapture does.
    constexpr double StopRoadMax = 5000.;   // loop.json route.stop_road_max_m.
    constexpr double CaptureLead = 30000.;  // Perf: the CSV capture starts this far before the warm laps end.
    constexpr double ChaseSettle = 2.5;     // loop.json views.chase_settle_s; the chase camera re-centres after 1.8 s.
    constexpr int32 TsrFrames = 120;        // loop.json views.tsr_settle_frames.
    constexpr double SkyBlend = 10.5;       // QuebecSky.cpp SkyCommandBlend (10 s) plus half a second (see SwitchSky).
    constexpr int32 ShotFrames = 2;         // Frames after a still before the view may change.
    constexpr int32 ViewFrames = 2;         // Frames for a new view to reach the texture streamer.
    constexpr float StreamLimit = 10.f;     // Longest wait for texture streaming before a still.
    constexpr float ChasePitch = -12.f;     // AQuebecCar's chase camera pitch at rest.

    // The Gauntlet controller (Source/QuebecGauntletTest) reads the run through console variables, so its module needs
    // no Quebec header. nord.GauntletExit exists while the subsystem does: -1 during the run, then the exit code. The
    // controller sets nord.GauntletController to 1, and then it ends the test instead of the game quitting by itself.
    const TCHAR* const ExitVariableName = TEXT("nord.GauntletExit");
    const TCHAR* const ControllerVariableName = TEXT("nord.GauntletController");

    FString ToFString(const std::string& Text) { return FString(Text.c_str()); }
    std::string ToStd(const FString& Text) { return std::string(TCHAR_TO_UTF8(*Text)); }

    // The car's input handlers and the controller's Interact are private UFUNCTIONs. Reflection reaches them, as the
    // Python checks (call_method) and the `ke` console command do, so the run uses the player's own input path.
    void CallInput(UObject* Target, const TCHAR* FunctionName)
    {
        if (UFunction* Function = Target ? Target->FindFunction(FName(FunctionName)) : nullptr) Target->ProcessEvent(Function, nullptr);
    }

    void CallInput(UObject* Target, const TCHAR* FunctionName, float Value)
    {
        if (UFunction* Function = Target ? Target->FindFunction(FName(FunctionName)) : nullptr) Target->ProcessEvent(Function, &Value);
    }

    // The road height under Point, as the population's ground trace finds it; Point.Z when nothing is below.
    double GroundBelow(const UWorld* World, const FVector& Point, const AActor* Ignore)
    {
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(NordGauntletGround), false, Ignore);
        if (World->LineTraceSingleByChannel(Hit, Point + FVector(0., 0., 500.), Point - FVector(0., 0., 1000.), ECC_Visibility, Query) &&
            Hit.ImpactNormal.Z >= .7) return Hit.ImpactPoint.Z;
        return Point.Z;
    }

    // The preset that matches -NordHour= and -NordWeather=, or INDEX_NONE with a file-safe name for that sky.
    int32 SkyFromCommandLine(FString& OutName)
    {
        float Hour = -1.f;
        FString Weather;
        FParse::Value(FCommandLine::Get(), TEXT("NordHour="), Hour);
        FParse::Value(FCommandLine::Get(), TEXT("NordWeather="), Weather);
        for (int32 Index = 0; Index < GauntletSkyCount; ++Index)
            if (FMath::IsNearlyEqual(Hour, GauntletSkies[Index].Hour, .01f) && Weather.Equals(GauntletSkies[Index].Weather, ESearchCase::IgnoreCase))
            {
                OutName = GauntletSkies[Index].Name;
                return Index;
            }
        FString Safe;
        for (const TCHAR Character : Weather.ToLower())
            if (FChar::IsAlnum(Character)) Safe.AppendChar(Character);
        OutName = FString::Printf(TEXT("h%02d-%s"), FMath::Clamp(FMath::RoundToInt(Hour), 0, 99), *Safe);
        return INDEX_NONE;
    }

    const TCHAR* PhaseName(EPhase Phase)
    {
        switch (Phase)
        {
        case EPhase::WarmLap: return TEXT("warm");
        case EPhase::Measure: return TEXT("measure");
        case EPhase::Hold: return TEXT("hold");
        case EPhase::Done: return TEXT("done");
        case EPhase::Fail: return TEXT("fail");
        default: return TEXT("wait");
        }
    }
}

bool UQuebecGauntletSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
    return !GIsEditor && FParse::Param(FCommandLine::Get(), TEXT("NordGauntlet"));
}

void UQuebecGauntletSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    RunExit = IConsoleManager::Get().RegisterConsoleVariable(ExitVariableName, -1,
        TEXT("NORD mobile gauntlet: -1 while the run goes on, then its exit code (read by the Gauntlet controller)."), ECVF_Default);
    // Every frame: the run steers the car with inputs that the world tick reads, as a player's axes do.
    Ticker = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateUObject(this, &UQuebecGauntletSubsystem::Tick));
}

void UQuebecGauntletSubsystem::Deinitialize()
{
    FTSTicker::GetCoreTicker().RemoveTicker(Ticker);
    if (Stage == EQuebecGauntletStage::Running || Stage == EQuebecGauntletStage::Ending)
        UE_LOG(LogTemp, Warning, TEXT("NORD_GAUNTLET abandoned phase=%s lap=%d leg=%d"), PhaseName(Run.Phase), Run.Lap, Run.Leg);
    if (RunExit) IConsoleManager::Get().UnregisterConsoleObject(RunExit, false);
    RunExit = nullptr;
    Super::Deinitialize();
}

bool UQuebecGauntletSubsystem::Tick(float DeltaSeconds)
{
    // The subsystem's own frame times, for the summary line that cross-checks the CSV parse.
    const double Wall = FPlatformTime::Seconds();
    const double FrameMs = LastWall >= 0. ? (Wall - LastWall) * 1000. : 0.;
    LastWall = Wall;
    if (Stage == EQuebecGauntletStage::Finished) return true;
    if (Stage == EQuebecGauntletStage::Idle)
    {
        UWorld* World = GetGameInstance()->GetWorld();
        if (World && World->HasBegunPlay()) BeginRun(World, World->GetTimeSeconds());
        return true;
    }
    // Waits for the CSV file, also when the world is gone.
    if (Stage == EQuebecGauntletStage::Ending)
    {
        ApplyControls(QuebecGauntlet::FControls());
        if (!CsvFile.IsValid() || CsvFile.IsReady() || Wall - EndingSince > QuebecGauntlet::CsvWait) Complete();
        return true;
    }
    UWorld* World = RunWorld.Get();
    if (!World)
    {
        // A map reload or travel mid-run. The CSV capture still ends, so the failed run keeps its frame times.
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=world_lost phase=%s lap=%d leg=%d"), PhaseName(Run.Phase), Run.Lap, Run.Leg);
        QuebecGauntlet::Abort(Run, EExit::Setup);
        CsvEvent(FString::Printf(TEXT("NordGauntlet fail exit=%d"), static_cast<int32>(Run.Exit)));
        Finish(LastWorld);
        return true;
    }
    TickRun(World, World->GetTimeSeconds(), FrameMs);
    return true;
}

void UQuebecGauntletSubsystem::BeginRun(UWorld* World, double Now)
{
    Stage = EQuebecGauntletStage::Running;
    RunWorld = World;
    LastWorld = Now;
    NextPoseAt = Now;
    const TCHAR* Line = FCommandLine::Get();
    FString ModeText = TEXT("perf");
    FParse::Value(Line, TEXT("NordGauntletMode="), ModeText);
    const bool bModeKnown = QuebecGauntlet::ParseMode(ToStd(ModeText), Mode);
    QuebecGauntlet::FRunSettings Settings = QuebecGauntlet::ForMode(Mode);
    int32 LapCount = Settings.Laps;
    if (FParse::Value(Line, TEXT("NordGauntletLaps="), LapCount)) Settings.Laps = FMath::Max(LapCount, 1);
    double Delay = Settings.Delay;
    if (FParse::Value(Line, TEXT("NordGauntletDelay="), Delay) && FMath::IsFinite(Delay)) Settings.Delay = FMath::Max(Delay, 0.);
    FString Unused;
    const bool bSkyArgs = FParse::Value(Line, TEXT("NordHour="), Unused) && FParse::Value(Line, TEXT("NordWeather="), Unused);
    StartSky = ShownSky = SkyFromCommandLine(StartSkyName);
    const bool bExpect = FParse::Value(Line, TEXT("NordGauntletExpect="), ExpectFile) && !ExpectFile.IsEmpty();
    if (bExpect) ExpectFile = FPaths::ConvertRelativePathToFull(ExpectFile);
    if (!FParse::Value(Line, TEXT("NordGauntletRun="), RunDir) || RunDir.IsEmpty())
        RunDir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Gauntlet"),
            FDateTime::UtcNow().ToString(TEXT("%Y%m%dT%H%M%SZ")) + TEXT("-") + FString(QuebecGauntlet::ModeName(Mode)));
    RunDir = FPaths::ConvertRelativePathToFull(RunDir);
    IFileManager::Get().MakeDirectory(*FPaths::Combine(RunDir, TEXT("native")), true);

    // The loop over the map's road set; QuebecGauntletModel.h BuildLoop is the same call the offline test makes.
    const FString MapName = FPackageName::GetShortName(UWorld::RemovePIEPrefix(World->GetMapName()));
    const bool bPlateau = MapName == TEXT("LaFontaine");
    const QuebecDistrict::FSettings& District = QuebecDistrict::ForWorld(World);
    std::vector<QuebecPursuit::FSegment> Segments;
    Segments.reserve(static_cast<size_t>(District.RoadCount));
    for (int32 Index = 0; Index < District.RoadCount; ++Index)
        Segments.push_back({{District.RoadSegments[Index][0].X, District.RoadSegments[Index][0].Y}, {District.RoadSegments[Index][1].X, District.RoadSegments[Index][1].Y}});
    QuebecPursuit::FRoadGraph Graph;
    Graph.Build(Segments);
    const std::vector<FVec2> Eyes = QuebecGauntlet::RouteEyes();
    QuebecGauntlet::FLoop Loop;
    const bool bLoop = QuebecGauntlet::BuildLoop(Graph, Eyes, Loop);
    double FarthestStop = 0.;
    for (int32 Stop = 0; bLoop && Stop < Loop.StopCount(); ++Stop)
        FarthestStop = FMath::Max(FarthestStop, QuebecPursuit::Distance(Loop.Points[Loop.Stops[static_cast<size_t>(Stop)]], Eyes[static_cast<size_t>(Stop)]));
    const bool bDrivable = bPlateau && bLoop && FarthestStop <= StopRoadMax;

    // A bad mode, the wrong map, no loop or a stop off the road leaves no loop to drive: Begin fails it with exit setup.
    QuebecGauntlet::Begin(Run, bDrivable && bModeKnown ? Loop : QuebecGauntlet::FLoop(), Settings, Now, bSkyArgs, bExpect);
    UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET begin mode=%s laps=%d warm_laps=%d hold_s=%.1f delay_s=%.1f sky=%s map=%s loop_m=%.1f stops=%d farthest_stop_m=%.1f expect=%d run=%s"),
        *FString(QuebecGauntlet::ModeName(Mode)), Run.Settings.Laps, Run.Settings.WarmLaps, Run.Settings.Hold, Run.Settings.Delay, *StartSkyName,
        *MapName, Loop.Length / 100., Loop.StopCount(), FarthestStop / 100., bExpect ? 1 : 0, *RunDir);
    if (!bModeKnown) UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=bad_mode mode=%s (perf, look or stream)"), *ModeText);
    if (!bSkyArgs) UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=no_sky (pass -NordHour= and -NordWeather=, or the run measures no sky)"));
    // UE_LOG is a block, so an if that logs before an else takes braces.
    if (!bPlateau)
    {
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=wrong_map map=%s (the loop is on /Game/Maps/LaFontaine)"), *MapName);
    }
    else if (!bLoop)
    {
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=no_loop"));
    }
    else if (!bDrivable)
    {
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=stop_off_road farthest_stop_m=%.1f"), FarthestStop / 100.);
    }
    if (Mode == EMode::Look && !FParse::Param(Line, TEXT("NordNoAmbient")))
        UE_LOG(LogTemp, Warning, TEXT("NORD_GAUNTLET warning=ambient (look runs pass -NordNoAmbient, so the stills repeat)"));
    for (int32 Stop = 0; Stop < Run.Loop.StopCount(); ++Stop)
    {
        const FVec2& Point = Run.Loop.Points[Run.Loop.Stops[static_cast<size_t>(Stop)]];
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET route stop=%s x_m=%.2f y_m=%.2f along_m=%.1f leg=%s leg_m=%.1f"),
            *ToFString(QuebecGauntlet::StopLabel(Stop)), Point.X / 100., Point.Y / 100., Run.Loop.StopAlong(Stop) / 100.,
            *ToFString(QuebecGauntlet::LegName(Stop)), Run.Loop.LegLength(Stop) / 100.);
    }
    if (QuebecGauntlet::Finished(Run)) Finish(Now);
}

void UQuebecGauntletSubsystem::TickRun(UWorld* World, double Now, double FrameMs)
{
    const double DeltaSeconds = FMath::Max(Now - LastWorld, 0.);
    LastWorld = Now;
    APlayerController* Player = GetGameInstance()->GetFirstLocalPlayerController(World);
    const bool bReady = Player && Seat(World, Player, Now);
    if (Mode == EMode::Look && Player && Player->MyHUD) Player->MyHUD->bShowHUD = false;
    if (Run.bExpectCVars && !bCVarsRead && Now - Run.BeganAt >= CVarReadAfter) ReadCVars();
    // The frame that just ended belongs to the leg the model was in before this tick.
    if (Run.Phase == EPhase::Measure && FrameMs > 0.) Frames.Add(Run.Lap, Run.Leg, FrameMs);
    FlushCsvEvents();
    if (Shots.Num() > 0)
    {
        // Stills at a look-run hold: the car stands braked and the model waits, so the hold ends after the stills.
        ApplyControls(QuebecGauntlet::FControls());
        if (!TickShots(World, Player, Now))
        {
            Shots.Reset();
            ShotStop = -1;
        }
        else if (Now - ShotsStartedAt > QuebecGauntlet::StillsTimeout)
        {
            UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=stills_timeout stop=%s step=%d"), *ToFString(QuebecGauntlet::StopLabel(ShotStop)), ShotIndex);
            QuebecGauntlet::Abort(Run, EExit::Timeout);
        }
    }
    else
    {
        const AQuebecCar* Driven = Car.Get();
        const FVector Location = Driven ? Driven->GetActorLocation() : FVector::ZeroVector;
        const QuebecGauntlet::FStep Step = QuebecGauntlet::Tick(Run, Now, DeltaSeconds, {Location.X, Location.Y},
            Driven ? Driven->GetActorRotation().Yaw : 0., Driven ? static_cast<double>(Driven->Speed) : 0., bReady && Driven);
        HandleEvent(Step, World, Player, Now);
        ApplyControls(Step.Controls);
    }
    if (Run.Phase == EPhase::WarmLap || Run.Phase == EPhase::Measure) MaxOffset = FMath::Max(MaxOffset, Run.Tracker.Offset);
    if (Run.Phase == EPhase::Measure) MaxMeasuredOffset = FMath::Max(MaxMeasuredOffset, Run.Tracker.Offset);
    // Perf: start the capture CaptureLead before the warm laps end, so the first measured leg's event is in the file.
    // The parser drops the frames before that event.
    if (Mode == EMode::Perf && Run.Phase == EPhase::WarmLap && Run.Lap == 0 &&
        Run.Tracker.Along >= QuebecGauntlet::LapStart(Run, 1) - CaptureLead) StartCsv();
    SamplePose(Now);
    if (QuebecGauntlet::Finished(Run)) Finish(Now);
}

bool UQuebecGauntletSubsystem::Seat(UWorld* World, APlayerController* Player, double Now)
{
    AQuebecCar* Driven = Car.Get();
    if (!Driven)
    {
        if (bSeated || Now < NextSeatAt || Run.Loop.Points.empty()) return false;
        NextSeatAt = Now + SeatRetry;
        // A car of the player's kind on the first stop's road point, facing along the first leg (FLoop::StartYaw).
        const FVec2& Start = Run.Loop.Points.front();
        FVector Location(Start.X, Start.Y, 0.);
        Location.Z = GroundBelow(World, Location, nullptr) + CarHeight;
        FActorSpawnParameters Spawn;
        Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        Driven = World->SpawnActor<AQuebecCar>(Location, FRotator(0., Run.Loop.StartYaw(), 0.), Spawn);
        if (!Driven) return false;
        Driven->Tags.Add(TEXT("NordGauntlet"));
        Car = Driven;
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET car=%s spawn_offset_m=%.2f"), *Driven->GetName(), FVector::Dist2D(Driven->GetActorLocation(), Location) / 100.);
    }
    if (Player->GetPawn() == Driven)
    {
        if (!bSeated)
        {
            bSeated = true;
            // Real input writes the axes again every frame (Scripts/test_race_drive.py), and a viewer's touches must not
            // steer or leave the car, so the car's input and the controller's own bindings both stop.
            Driven->DisableInput(Player);
            Player->DisableInput(Player);
            int32 Width = 0, Height = 0;
            Player->GetViewportSize(Width, Height);
            UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET seated car=%s x_m=%.2f y_m=%.2f yaw_deg=%.1f size=%dx%d"), *Driven->GetName(),
                Driven->GetActorLocation().X / 100., Driven->GetActorLocation().Y / 100., Driven->GetActorRotation().Yaw, Width, Height);
        }
        return true;
    }
    if (bSeated || Now < NextSeatAt) return false;
    NextSeatAt = Now + SeatRetry;
    APawn* Avatar = Player->GetPawn();
    if (!Avatar) return false;
    // In some other car: Interact gets out first.
    if (Avatar->IsA<AQuebecCar>())
    {
        CallInput(Player, TEXT("Interact"));
        return false;
    }
    // Step in from beside the car, as -NordCapture does, through the controller's own Interact (E).
    FCollisionQueryParams Query(SCENE_QUERY_STAT(NordGauntletSeat), false, Avatar);
    for (const double Side : {AvatarSide, -AvatarSide})
    {
        const FVector Spot = Driven->GetActorLocation() + Driven->GetActorRightVector() * Side + FVector(0., 0., 20.);
        if (World->OverlapBlockingTestByChannel(Spot, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(42.f, 96.f), Query)) continue;
        Avatar->SetActorLocation(Spot);
        break;
    }
    CallInput(Player, TEXT("Interact"));
    return false;
}

void UQuebecGauntletSubsystem::ReadCVars()
{
    bCVarsRead = true;
    FString Text;
    if (!FFileHelper::LoadFileToString(Text, *ExpectFile))
    {
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET cvars error=unreadable file=%s"), *ExpectFile);
        QuebecGauntlet::ReportCVars(Run, 1);
        return;
    }
    const QuebecGauntlet::FCVarFile File = QuebecGauntlet::ParseExpectedCVars(ToStd(Text));
    int32 Mismatches = static_cast<int32>(File.BadLines.size());
    for (const int BadLine : File.BadLines) UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET cvars error=bad_line line=%d file=%s"), BadLine, *ExpectFile);
    // Every expected CVar is logged with its readback, so the runner can store the readback whether it matches or not.
    for (const QuebecGauntlet::FCVarExpectation& Want : File.Values)
    {
        const FString CVarName = ToFString(Want.Name);
        IConsoleVariable* Variable = IConsoleManager::Get().FindConsoleVariable(*CVarName);
        const FString Actual = Variable ? Variable->GetString() : FString(TEXT("missing"));
        const bool bMatch = Variable && QuebecGauntlet::CVarValueMatches(Want.Value, ToStd(Actual));
        Mismatches += bMatch ? 0 : 1;
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET cvar name=%s expected=%s actual=%s match=%d"), *CVarName, *ToFString(Want.Value), *Actual, bMatch ? 1 : 0);
    }
    UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET cvars checked=%d mismatches=%d file=%s"), static_cast<int32>(File.Values.size()), Mismatches, *ExpectFile);
    QuebecGauntlet::ReportCVars(Run, Mismatches);
}

void UQuebecGauntletSubsystem::HandleEvent(const QuebecGauntlet::FStep& Step, UWorld* World, APlayerController* Player, double Now)
{
    switch (Step.Event)
    {
    case EEvent::WarmBegin:
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET lap=%d warm=begin"), Step.Lap);
        CsvEvent(FString::Printf(TEXT("NordGauntlet warm lap=%d"), Step.Lap));
        break;
    case EEvent::HoldBegin:
    {
        const FString Label = ToFString(QuebecGauntlet::StopLabel(Step.Stop));
        // stream-sample.mjs --trigger and the runner wait for this line to save a decoded frame.
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET stop=%s lap=%d hold=begin hold_s=%.1f"), *Label, Step.Lap, Run.Settings.Hold);
        StartCsv();
        CsvEvent(FString::Printf(TEXT("NordGauntlet hold stop=%s lap=%d"), *Label, Step.Lap));
        if (Mode == EMode::Look)
        {
            ShotsStartedAt = Now;
            BuildShots(Step.Stop);
        }
        break;
    }
    case EEvent::LegBegin:
    {
        const FString Leg = ToFString(QuebecGauntlet::LegName(Step.Leg));
        if (Run.Settings.Hold <= 0.)
            UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET stop=%s lap=%d pass"), *ToFString(QuebecGauntlet::StopLabel(Step.Leg)), Step.Lap);
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET leg=%s lap=%d begin"), *Leg, Step.Lap);
        StartCsv();
        CsvEvent(FString::Printf(TEXT("NordGauntlet leg=%s lap=%d"), *Leg, Step.Lap));
        break;
    }
    case EEvent::Done:
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET done laps=%d"), Step.Lap);
        CsvEvent(TEXT("NordGauntlet done"));
        break;
    case EEvent::Fail:
    {
        const AQuebecCar* Driven = Car.Get();
        const FVector Location = Driven ? Driven->GetActorLocation() : FVector::ZeroVector;
        UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET fail exit=%d reason=%s lap=%d leg=%d along_m=%.1f x_m=%.2f y_m=%.2f reversals=%d"),
            static_cast<int32>(Run.Exit), *FString(QuebecGauntlet::ExitName(Run.Exit)), Run.Lap, Run.Leg, Run.Tracker.Along / 100.,
            Location.X / 100., Location.Y / 100., Run.Driver.Reversals);
        CsvEvent(FString::Printf(TEXT("NordGauntlet fail exit=%d"), static_cast<int32>(Run.Exit)));
        break;
    }
    default:
        break;
    }
}

void UQuebecGauntletSubsystem::ApplyControls(const QuebecGauntlet::FControls& Controls)
{
    AQuebecCar* Driven = Car.Get();
    if (!Driven || !bSeated) return;
    CallInput(Driven, TEXT("MoveForward"), static_cast<float>(Controls.Pedal));
    CallInput(Driven, TEXT("MoveRight"), static_cast<float>(Controls.Wheel));
    CallInput(Driven, Controls.bBrake ? TEXT("ApplyHandbrake") : TEXT("ReleaseHandbrake"));
}

void UQuebecGauntletSubsystem::BuildShots(int32 Stop)
{
    using EKind = FQuebecGauntletShot::EKind;
    const auto Add = [this](EKind Kind, int32 Sky, double Seconds, int32 FrameCount, bool bEye)
    {
        FQuebecGauntletShot& Shot = Shots.AddDefaulted_GetRef();
        Shot.Kind = Kind;
        Shot.Sky = Sky;
        Shot.Seconds = Seconds;
        Shot.Frames = FrameCount;
        Shot.bEye = bEye;
    };
    Shots.Reset();
    ShotIndex = 0;
    bShotEntered = false;
    ShotStop = Stop;
    // The chase view, then the eye view, in the sky now showing. With the sky switch the other sky follows, eye first,
    // so each hold switches once and the next hold starts in the sky this one ends in.
    // Each new view first lets the texture streamer catch up, so a still does not depend on how far streaming got.
    const int32 First = ShownSky;
    const auto NewView = [&Add](EKind View)
    {
        Add(View, 0, 0., 0, View == EKind::Eye);
        Add(EKind::Frames, 0, 0., ViewFrames, false);
        Add(EKind::Stream, 0, 0., 0, false);
    };
    NewView(EKind::Chase);
    Add(EKind::Seconds, 0, ChaseSettle, 0, false);
    Add(EKind::Frames, 0, 0., TsrFrames, false);
    Add(EKind::Shot, First, 0., 0, false);
    NewView(EKind::Eye);
    Add(EKind::Frames, 0, 0., TsrFrames, true);
    Add(EKind::Shot, First, 0., 0, true);
    if (Run.Settings.bSkySwitch)
    {
        const int32 Other = First == 0 ? 1 : 0;
        Add(EKind::Sky, Other, 0., 0, true);
        Add(EKind::Seconds, 0, SkyBlend, 0, true);
        Add(EKind::Frames, 0, 0., TsrFrames, true);
        Add(EKind::Shot, Other, 0., 0, true);
        NewView(EKind::Chase);
        Add(EKind::Frames, 0, 0., TsrFrames, false);
        Add(EKind::Shot, Other, 0., 0, false);
    }
    // Back to the car's own camera for the next leg.
    Add(EKind::Chase, 0, 0., 0, false);
}

bool UQuebecGauntletSubsystem::TickShots(UWorld* World, APlayerController* Player, double Now)
{
    using EKind = FQuebecGauntletShot::EKind;
    while (ShotIndex < Shots.Num())
    {
        const FQuebecGauntletShot& Shot = Shots[ShotIndex];
        if (!bShotEntered)
        {
            bShotEntered = true;
            ShotStepAt = Now;
            ShotStepFrame = GFrameCounter;
            EnterShot(Shot, World, Player);
        }
        const uint64 FramesIn = GFrameCounter - ShotStepFrame;
        const bool bDone = Shot.Kind == EKind::Seconds ? Now - ShotStepAt >= Shot.Seconds
            : Shot.Kind == EKind::Frames ? FramesIn >= static_cast<uint64>(Shot.Frames)
            : Shot.Kind == EKind::Shot ? !FScreenshotRequest::IsScreenshotRequested() && FramesIn >= static_cast<uint64>(ShotFrames)
            : true;
        if (!bDone) return true;
        ++ShotIndex;
        bShotEntered = false;
    }
    return false;
}

void UQuebecGauntletSubsystem::EnterShot(const FQuebecGauntletShot& Shot, UWorld* World, APlayerController* Player)
{
    using EKind = FQuebecGauntletShot::EKind;
    switch (Shot.Kind)
    {
    case EKind::Chase: SnapToStop(World, Player, ShotStop); break;
    case EKind::Eye: ShowEye(World, Player, ShotStop); break;
    case EKind::Sky: SwitchSky(Player, Shot.Sky); break;
    // Blocks the game thread until the streamer has loaded what the current view needs, or StreamLimit (unverified API).
    case EKind::Stream: IStreamingManager::Get().StreamAllResources(StreamLimit); break;
    case EKind::Shot:
    {
        const FString Path = ShotPath(Shot.Sky, ShotStop, Shot.bEye);
        IFileManager::Get().MakeDirectory(*FPaths::GetPath(Path), true);
        // HUD off; the path has a folder, so the engine writes it there rather than in Saved/Screenshots (unverified).
        FScreenshotRequest::RequestScreenshot(Path, false, false);
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET still stop=%s view=%s sky=%s file=%s"), *ToFString(QuebecGauntlet::StopLabel(ShotStop)),
            Shot.bEye ? TEXT("eye") : TEXT("chase"), Shot.Sky == INDEX_NONE ? *StartSkyName : GauntletSkies[Shot.Sky].Name, *Path);
        break;
    }
    default:
        break;
    }
}

void UQuebecGauntletSubsystem::SnapToStop(UWorld* World, APlayerController* Player, int32 Stop)
{
    AQuebecCar* Driven = Car.Get();
    if (!Driven || !Player || Stop < 0 || Stop >= Run.Loop.StopCount()) return;
    // The chase still: the car stands on the stop's road point facing along the next leg, so the view repeats from
    // run to run although the car stops anywhere within ArriveRadius.
    const FVec2& Point = Run.Loop.Points[Run.Loop.Stops[static_cast<size_t>(Stop)]];
    const double Yaw = QuebecGauntlet::YawOf(Run.Loop.DirectionAt(Run.Loop.StopAlong(Stop)));
    FVector Location(Point.X, Point.Y, 0.);
    Location.Z = GroundBelow(World, Location, Driven) + CarHeight;
    const FRotator Facing(0., Yaw, 0.);
    if (Driven->CanFitAt(Location, Facing.Quaternion(), Driven))
    {
        Driven->SetActorLocationAndRotation(Location, Facing, false, nullptr, ETeleportType::TeleportPhysics);
        Driven->ResetMotion();
    }
    else UE_LOG(LogTemp, Warning, TEXT("NORD_GAUNTLET snap=blocked stop=%s"), *ToFString(QuebecGauntlet::StopLabel(Stop)));
    Player->SetViewTargetWithBlend(Driven, 0.f);
    // At rest the chase camera does not re-centre by itself (AQuebecCar::Tick needs speed), so set its rest pose.
    Player->SetControlRotation(FRotator(ChasePitch, Yaw, 0.));
    if (Player->PlayerCameraManager) Player->PlayerCameraManager->SetGameCameraCutThisFrame();
}

void UQuebecGauntletSubsystem::ShowEye(UWorld* World, APlayerController* Player, int32 Stop)
{
    if (!Player || Stop < 0 || Stop >= QuebecGauntletRoute::StopCount) return;
    ACameraActor* View = EyeCamera.Get();
    if (!View)
    {
        FActorSpawnParameters Spawn;
        Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
        View = World->SpawnActor<ACameraActor>(FVector::ZeroVector, FRotator::ZeroRotator, Spawn);
        if (!View) return;
        EyeCamera = View;
        // The game camera's 85 degrees and no letterbox, so portrait frames fill the picture as the chase view does.
        View->GetCameraComponent()->SetConstraintAspectRatio(false);
        View->GetCameraComponent()->SetFieldOfView(static_cast<float>(QuebecGauntletRoute::EyeFieldOfView));
    }
    const QuebecGauntletRoute::FStop& Pose = QuebecGauntletRoute::Stops[Stop];
    const FVector From(Pose.EyeX, Pose.EyeY, Pose.EyeZ);
    const FVector To(Pose.TargetX, Pose.TargetY, Pose.TargetZ);
    View->SetActorLocationAndRotation(From, (To - From).Rotation());
    Player->SetViewTargetWithBlend(View, 0.f);
    if (Player->PlayerCameraManager) Player->PlayerCameraManager->SetGameCameraCutThisFrame();
}

void UQuebecGauntletSubsystem::SwitchSky(APlayerController* Player, int32 Sky)
{
    AQuebecController* Host = Cast<AQuebecController>(Player);
    if (!Host || Sky < 0 || Sky >= GauntletSkyCount) return;
    // The host's sky console commands. The hour changes at once. Under -NordGauntlet, QuebecSky.cpp HostSetWeather also
    // settles the new weather and the street wetness at once, as a -NordWeather= start does, so a still never depends
    // on how long the streets had to wet or dry, which would differ with the frame rate. SkyBlend still waits out the
    // usual blend, in world seconds, in case the settle did not apply; the log then lacks "NORD_SKY_WEATHER ... settled".
    Host->NordTime(GauntletSkies[Sky].Hour);
    Host->NordWeather(GauntletSkies[Sky].Weather);
    ShownSky = Sky;
    UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET sky=%s hour=%.1f weather=%s"), GauntletSkies[Sky].Name, GauntletSkies[Sky].Hour, GauntletSkies[Sky].Weather);
}

void UQuebecGauntletSubsystem::StartCsv()
{
    if (bCsvStarted || Mode == EMode::Look) return;
#if CSV_PROFILER
    // The HORU pattern: the capture starts from code after the map loads, not from -csvCaptureFrames (which would
    // also start at load and include the shader compiles of the warm lap).
    if (FCsvProfiler* Profiler = FCsvProfiler::Get())
    {
        bCsvStarted = true;
        const FString Folder = FPaths::Combine(RunDir, TEXT("native")) + TEXT("/");
        const FString File = FString::Printf(TEXT("NordGauntlet-%s-%s.csv"), *FString(QuebecGauntlet::ModeName(Mode)), *StartSkyName);
        IFileManager::Get().MakeDirectory(*Folder, true);
        // A given file name is used as it is (unverified; only the default "Profile(<date>)" name gets ".csv" added), and
        // the runner reads native/*.csv. Should the engine add ".csv" anyway, ".csv.csv" still matches. -csvCompression=0
        // on the command line keeps the file plain text.
        Profiler->BeginCapture(-1, Folder, File);
        CSV_METADATA(TEXT("NordGauntletMode"), *FString(QuebecGauntlet::ModeName(Mode)));
        CSV_METADATA(TEXT("NordGauntletSky"), *StartSkyName);
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET csv=begin folder=%s file=%s"), *Folder, *File);
        return;
    }
#endif
    UE_LOG(LogTemp, Warning, TEXT("NORD_GAUNTLET csv=unavailable (no CSV profiler in this build)"));
}

void UQuebecGauntletSubsystem::CsvEvent(const FString& Text)
{
    if (!bCsvStarted) return;
    PendingCsvEvents.Add(Text);
    FlushCsvEvents();
}

void UQuebecGauntletSubsystem::FlushCsvEvents()
{
#if CSV_PROFILER
    // BeginCapture starts with the next frame, so an event waits until the capture runs.
    const FCsvProfiler* Profiler = FCsvProfiler::Get();
    if (PendingCsvEvents.Num() == 0 || !Profiler || !Profiler->IsCapturing()) return;
    for (const FString& Text : PendingCsvEvents)
    {
        CSV_EVENT_GLOBAL(TEXT("%s"), *Text);
    }
    PendingCsvEvents.Reset();
#endif
}

void UQuebecGauntletSubsystem::SamplePose(double Now)
{
    if (Now < NextPoseAt) return;
    while (NextPoseAt <= Now) NextPoseAt += PoseInterval;
    const AQuebecCar* Driven = Car.Get();
    if (!Driven) return;
    FQuebecGauntletPose& Pose = Poses.AddDefaulted_GetRef();
    Pose.Seconds = Now - Run.BeganAt;
    Pose.Location = Driven->GetActorLocation();
    Pose.Yaw = Driven->GetActorRotation().Yaw;
    Pose.Speed = Driven->Speed;
    Pose.Along = Run.Tracker.Along;
    Pose.Offset = Run.Tracker.Offset;
    Pose.Lap = Run.Lap;
    Pose.Leg = Run.Leg;
    Pose.Stop = Run.Stop;
    Pose.Phase = Run.Phase;
}

void UQuebecGauntletSubsystem::Finish(double Now)
{
    Stage = EQuebecGauntletStage::Ending;
    EndingSince = FPlatformTime::Seconds();
    ApplyControls(QuebecGauntlet::FControls());
#if CSV_PROFILER
    if (FCsvProfiler* Profiler = bCsvStarted ? FCsvProfiler::Get() : nullptr)
    {
        FlushCsvEvents();
        // The future is set once the file is written; the ticker waits for it before quitting.
        CsvFile = Profiler->EndCapture();
    }
#endif
}

void UQuebecGauntletSubsystem::Complete()
{
    Stage = EQuebecGauntletStage::Finished;
    ExitCode = static_cast<int32>(Run.Exit == EExit::Running ? EExit::Timeout : Run.Exit);
    if (CsvFile.IsValid() && CsvFile.IsReady())
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET csv=%s"), *CsvFile.Get());
    }
    else if (bCsvStarted)
    {
        UE_LOG(LogTemp, Warning, TEXT("NORD_GAUNTLET csv=unfinished (not written within %.0f s)"), QuebecGauntlet::CsvWait);
    }
    LogSummaries();
    WriteRoute();
    UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET result exit=%d reason=%s mode=%s laps=%d max_offset_m=%.3f"), ExitCode,
        *FString(QuebecGauntlet::ExitName(Run.Exit)), *FString(QuebecGauntlet::ModeName(Mode)), Run.Settings.Laps, MaxOffset / 100.);
    if (RunExit) RunExit->Set(*FString::FromInt(ExitCode));
    // A Gauntlet controller ends the test with this code; a direct launch quits here.
    const IConsoleVariable* Controller = IConsoleManager::Get().FindConsoleVariable(ControllerVariableName);
    if (!Controller || Controller->GetInt() != 1) FPlatformMisc::RequestExitWithStatus(false, static_cast<uint8>(ExitCode));
}

void UQuebecGauntletSubsystem::LogSummaries() const
{
    // gauntlet_metrics.py run_summary takes the line whose leg and lap are "all"; FormatSummary's keys match
    // Data/Gauntlet/fixtures/frametimes_expected.json.
    UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET summary leg=all lap=all mode=%s %s"), *FString(QuebecGauntlet::ModeName(Mode)),
        *ToFString(QuebecGauntlet::FormatSummary(Frames.All())));
    for (int32 Leg = 0; Leg < Run.Loop.StopCount(); ++Leg)
        if (const QuebecGauntlet::FFrameSummary Summary = Frames.ForLeg(Leg); Summary.Frames > 0)
            UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET summary leg=%s lap=all %s"), *ToFString(QuebecGauntlet::LegName(Leg)),
                *ToFString(QuebecGauntlet::FormatSummary(Summary)));
    for (int32 Lap = 1; Lap <= Run.Settings.Laps; ++Lap)
        if (const QuebecGauntlet::FFrameSummary Summary = Frames.ForLap(Lap); Summary.Frames > 0)
            UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET summary leg=all lap=%d %s"), Lap, *ToFString(QuebecGauntlet::FormatSummary(Summary)));
}

void UQuebecGauntletSubsystem::WriteRoute() const
{
    // native/route.json: metres, m/s and degrees, as Data/Gauntlet/loop.json. offset_m is the lateral error from the
    // driven line (QuebecGauntletModel.h FTracker::Offset); max_offset_m covers the warm and measured laps.
    FString Json = TEXT("{\n");
    Json += FString::Printf(TEXT("  \"version\": 1,\n  \"mode\": \"%s\",\n  \"sky\": \"%s\",\n  \"rate_hz\": 10,\n"),
        *FString(QuebecGauntlet::ModeName(Mode)), *StartSkyName);
    Json += FString::Printf(TEXT("  \"exit\": %d,\n  \"exit_name\": \"%s\",\n  \"laps\": %d,\n  \"warm_laps\": %d,\n"), ExitCode,
        *FString(QuebecGauntlet::ExitName(Run.Exit)), Run.Settings.Laps, Run.Settings.WarmLaps);
    Json += FString::Printf(TEXT("  \"loop_length_m\": %.2f,\n  \"max_offset_m\": %.3f,\n  \"max_measured_offset_m\": %.3f,\n  \"reversals\": %d,\n"),
        Run.Loop.Length / 100., MaxOffset / 100., MaxMeasuredOffset / 100., Run.Driver.Reversals);
    Json += TEXT("  \"stops\": [");
    for (int32 Stop = 0; Stop < Run.Loop.StopCount(); ++Stop)
    {
        const FVec2& Point = Run.Loop.Points[Run.Loop.Stops[static_cast<size_t>(Stop)]];
        Json += FString::Printf(TEXT("%s\n    {\"label\": \"%s\", \"x_m\": %.3f, \"y_m\": %.3f, \"yaw_deg\": %.2f, \"along_m\": %.2f, \"leg_m\": %.2f}"),
            Stop > 0 ? TEXT(",") : TEXT(""), *ToFString(QuebecGauntlet::StopLabel(Stop)), Point.X / 100., Point.Y / 100.,
            QuebecGauntlet::YawOf(Run.Loop.DirectionAt(Run.Loop.StopAlong(Stop))), Run.Loop.StopAlong(Stop) / 100., Run.Loop.LegLength(Stop) / 100.);
    }
    Json += TEXT("\n  ],\n  \"samples\": [");
    for (int32 Index = 0; Index < Poses.Num(); ++Index)
    {
        const FQuebecGauntletPose& Pose = Poses[Index];
        const FString Leg = Pose.Leg >= 0 ? TEXT("\"") + ToFString(QuebecGauntlet::LegName(Pose.Leg)) + TEXT("\"") : FString(TEXT("null"));
        const FString Stop = Pose.Stop >= 0 ? TEXT("\"") + ToFString(QuebecGauntlet::StopLabel(Pose.Stop)) + TEXT("\"") : FString(TEXT("null"));
        Json += FString::Printf(TEXT("%s\n    {\"t\": %.2f, \"phase\": \"%s\", \"lap\": %d, \"leg\": %s, \"stop\": %s, \"x_m\": %.3f, \"y_m\": %.3f, \"z_m\": %.3f, ")
            TEXT("\"yaw_deg\": %.2f, \"speed_m_s\": %.3f, \"along_m\": %.3f, \"offset_m\": %.3f}"),
            Index > 0 ? TEXT(",") : TEXT(""), Pose.Seconds, PhaseName(Pose.Phase), Pose.Lap, *Leg, *Stop, Pose.Location.X / 100., Pose.Location.Y / 100.,
            Pose.Location.Z / 100., Pose.Yaw, Pose.Speed / 100., Pose.Along / 100., Pose.Offset / 100.);
    }
    Json += TEXT("\n  ]\n}\n");
    const FString Path = FPaths::Combine(RunDir, TEXT("native"), TEXT("route.json"));
    if (FFileHelper::SaveStringToFile(Json, *Path))
    {
        UE_LOG(LogTemp, Display, TEXT("NORD_GAUNTLET route=%s samples=%d max_offset_m=%.3f"), *Path, Poses.Num(), MaxOffset / 100.);
    }
    else UE_LOG(LogTemp, Error, TEXT("NORD_GAUNTLET error=route_unwritten file=%s"), *Path);
}

FString UQuebecGauntletSubsystem::ShotPath(int32 Sky, int32 Stop, bool bEye) const
{
    int32 Width = 0, Height = 0;
    if (UWorld* World = RunWorld.Get())
        if (APlayerController* Player = GetGameInstance()->GetFirstLocalPlayerController(World)) Player->GetViewportSize(Width, Height);
    const FString SkyName = Sky >= 0 && Sky < GauntletSkyCount ? FString(GauntletSkies[Sky].Name) : StartSkyName;
    return FPaths::Combine(RunDir, TEXT("look"), SkyName, FString::Printf(TEXT("%s-%s-%dx%d.png"),
        *ToFString(QuebecGauntlet::StopLabel(Stop)), bEye ? TEXT("eye") : TEXT("chase"), Width, Height));
}
