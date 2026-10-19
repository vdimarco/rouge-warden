// Offline UE 5.x API stub: Engine/EngineBaseTypes.h
#pragma once
#include "UEStub/UObjectCore.h"

class AActor;
class UActorComponent;
class UWorld;

enum ETickingGroup : int
{
    TG_PrePhysics, TG_StartPhysics, TG_DuringPhysics, TG_EndPhysics, TG_PostPhysics, TG_PostUpdateWork, TG_LastDemotable, TG_NewlySpawned, TG_MAX,
};
enum ELevelTick { LEVELTICK_TimeOnly = 0, LEVELTICK_ViewportsOnly = 1, LEVELTICK_All = 2, LEVELTICK_PauseTick = 3 };
#include "Async/TaskGraphInterfaces.h"
class FGraphEvent;
using FGraphEventRef = TSharedPtr<FGraphEvent>;

struct FTickFunction
{
    TEnumAsByte<ETickingGroup> TickGroup;
    TEnumAsByte<ETickingGroup> EndTickGroup;
    uint8 bTickEvenWhenPaused : 1;
    uint8 bCanEverTick : 1;
    uint8 bStartWithTickEnabled : 1;
    uint8 bAllowTickOnDedicatedServer : 1;
    uint8 bAllowTickBatching : 1;
    uint8 bHighPriority : 1;
    uint8 bRunOnAnyThread : 1;
    float TickInterval;
    FTickFunction();
    virtual ~FTickFunction();
    void RegisterTickFunction(class ULevel* Level);
    void UnRegisterTickFunction();
    bool IsTickFunctionRegistered() const;
    void SetTickFunctionEnable(bool bInEnabled);
    bool IsTickFunctionEnabled() const;
    bool IsCompletionHandleValid() const;
    float GetLastTickGameTimeSeconds() const;
    void AddPrerequisite(UObject* TargetObject, struct FTickFunction& TargetTickFunction);
    void RemovePrerequisite(UObject* TargetObject, struct FTickFunction& TargetTickFunction);
    void SetPriorityIncludingPrerequisites(bool bInHighPriority);
    void UpdateTickIntervalAndCoolDown(float NewTickInterval);
    virtual void ExecuteTick(float DeltaTime, ELevelTick TickType, ENamedThreads::Type CurrentThread, const FGraphEventRef& MyCompletionGraphEvent) = 0;
    virtual FString DiagnosticMessage() = 0;
};
struct FActorTickFunction : public FTickFunction
{
    AActor* Target;
    void ExecuteTick(float DeltaTime, ELevelTick TickType, ENamedThreads::Type CurrentThread, const FGraphEventRef& MyCompletionGraphEvent) override;
    FString DiagnosticMessage() override;
};
struct FActorComponentTickFunction : public FTickFunction
{
    UActorComponent* Target;
    void ExecuteTick(float DeltaTime, ELevelTick TickType, ENamedThreads::Type CurrentThread, const FGraphEventRef& MyCompletionGraphEvent) override;
    FString DiagnosticMessage() override;
};

enum ENetMode { NM_Standalone, NM_DedicatedServer, NM_ListenServer, NM_Client, NM_MAX };
enum ENetRole : int { ROLE_None, ROLE_SimulatedProxy, ROLE_AutonomousProxy, ROLE_Authority, ROLE_MAX };
enum EInputEvent : int { IE_Pressed = 0, IE_Released = 1, IE_Repeat = 2, IE_DoubleClick = 3, IE_Axis = 4, IE_MAX = 5 };
enum ETravelType { TRAVEL_Absolute, TRAVEL_Partial, TRAVEL_Relative, TRAVEL_MAX };
enum class EMouseCaptureMode : uint8 { NoCapture, CapturePermanently, CapturePermanently_IncludingInitialMouseDown, CaptureDuringMouseDown, CaptureDuringRightMouseDown };
enum class EMouseLockMode : uint8 { DoNotLock, LockOnCapture, LockAlways, LockInFullscreen };
namespace EMouseCursor { enum Type : int { None, Default, TextEditBeam, ResizeLeftRight, ResizeUpDown, ResizeSouthEast, ResizeSouthWest, CardinalCross, Crosshairs, Hand, GrabHand, GrabHandClosed, SlashedCircle, EyeDropper, Custom, TotalCursorCount }; }
enum EViewModeIndex : int { VMI_BrushWireframe = 0, VMI_Wireframe = 1, VMI_Unlit = 2, VMI_Lit = 3 };

struct FURL
{
    FString Protocol;
    FString Host;
    int32 Port;
    int32 Valid;
    FString Map;
    FString RedirectURL;
    TArray<FString> Op;
    FString Portal;
    FURL(const TCHAR* Filename = nullptr);
    FURL(FURL* Base, const TCHAR* TextURL, ETravelType Type);
    bool IsInternal() const;
    bool IsLocalInternal() const;
    bool HasOption(const TCHAR* Test) const;
    const TCHAR* GetOption(const TCHAR* Match, const TCHAR* Default) const;
    void AddOption(const TCHAR* Str);
    FString ToString(bool FullyQualified = false) const;
};
