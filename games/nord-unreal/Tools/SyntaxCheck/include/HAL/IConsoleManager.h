// Offline UE 5.x API stub: HAL/IConsoleManager.h (console variables and commands)
#pragma once
#include "CoreMinimal.h"
class UWorld;
class FOutputDevice;
enum EConsoleVariableFlags
{
    ECVF_FlagMask = 0x0000ffff,
    ECVF_Default = 0x0,
    ECVF_Cheat = 0x1,
    ECVF_ReadOnly = 0x4,
    ECVF_Unregistered = 0x8,
    ECVF_CreatedFromIni = 0x10,
    ECVF_RenderThreadSafe = 0x20,
    ECVF_Scalability = 0x40,
    ECVF_ScalabilityGroup = 0x80,
    ECVF_Preview = 0x100,
    ECVF_GeneralShaderChange = 0x200,
    ECVF_MobileShaderChange = 0x400,
    ECVF_DesktopShaderChange = 0x800,
    ECVF_ExcludeFromPreview = 0x1000,
    ECVF_SetByConstructor = 0x00000000,
    ECVF_SetByScalability = 0x01000000,
    ECVF_SetByGameSetting = 0x02000000,
    ECVF_SetByProjectSetting = 0x03000000,
    ECVF_SetBySystemSettingsIni = 0x04000000,
    ECVF_SetByDeviceProfile = 0x05000000,
    ECVF_SetByGameOverride = 0x06000000,
    ECVF_SetByConsoleVariablesIni = 0x07000000,
    ECVF_SetByCommandline = 0x08000000,
    ECVF_SetByCode = 0x09000000,
    ECVF_SetByConsole = 0x0A000000,
    ECVF_SetByMask = 0xff000000
};
class IConsoleVariable;
DECLARE_DELEGATE(FConsoleCommandDelegate);
DECLARE_DELEGATE_OneParam(FConsoleCommandWithArgsDelegate, const TArray<FString>&);
DECLARE_DELEGATE_OneParam(FConsoleCommandWithWorldDelegate, UWorld*);
DECLARE_DELEGATE_TwoParams(FConsoleCommandWithWorldAndArgsDelegate, const TArray<FString>&, UWorld*);
DECLARE_DELEGATE_OneParam(FConsoleCommandWithOutputDeviceDelegate, FOutputDevice&);
DECLARE_DELEGATE_ThreeParams(FConsoleCommandWithWorldArgsAndOutputDeviceDelegate, const TArray<FString>&, UWorld*, FOutputDevice&);
DECLARE_DELEGATE_OneParam(FConsoleVariableDelegate, IConsoleVariable*);
DECLARE_MULTICAST_DELEGATE_OneParam(FConsoleVariableMulticastDelegate, IConsoleVariable*);
class IConsoleObject
{
public:
    virtual ~IConsoleObject() {}
    virtual const TCHAR* GetHelp() const = 0;
    virtual void SetHelp(const TCHAR* Value) = 0;
    virtual EConsoleVariableFlags GetFlags() const = 0;
    virtual void SetFlags(const EConsoleVariableFlags Value) = 0;
    virtual IConsoleVariable* AsVariable() { return nullptr; }
};
class IConsoleVariable : public IConsoleObject
{
public:
    virtual void Set(const TCHAR* InValue, EConsoleVariableFlags SetBy = ECVF_SetByCode) = 0;
    virtual bool GetBool() const = 0;
    virtual int32 GetInt() const = 0;
    virtual float GetFloat() const = 0;
    virtual FString GetString() const = 0;
    void Set(bool InValue, EConsoleVariableFlags SetBy = ECVF_SetByCode);
    void Set(int32 InValue, EConsoleVariableFlags SetBy = ECVF_SetByCode);
    void Set(float InValue, EConsoleVariableFlags SetBy = ECVF_SetByCode);
    virtual void SetOnChangedCallback(const FConsoleVariableDelegate& Callback) = 0;
    virtual FConsoleVariableMulticastDelegate& OnChangedDelegate() = 0;
};
class IConsoleCommand : public IConsoleObject
{
public:
    virtual bool Execute(const TArray<FString>& Args, UWorld* InWorld, FOutputDevice& OutputDevice) = 0;
};
struct IConsoleManager
{
    static IConsoleManager& Get();
    virtual ~IConsoleManager() {}
    virtual IConsoleVariable* RegisterConsoleVariable(const TCHAR* Name, bool DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default) = 0;
    virtual IConsoleVariable* RegisterConsoleVariable(const TCHAR* Name, int32 DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default) = 0;
    virtual IConsoleVariable* RegisterConsoleVariable(const TCHAR* Name, float DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default) = 0;
    virtual IConsoleVariable* RegisterConsoleVariable(const TCHAR* Name, const TCHAR* DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default) = 0;
    virtual IConsoleVariable* RegisterConsoleVariable(const TCHAR* Name, const FString& DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default) = 0;
    virtual IConsoleCommand* RegisterConsoleCommand(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandDelegate& Command, uint32 Flags = ECVF_Default) = 0;
    virtual IConsoleCommand* RegisterConsoleCommand(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandWithArgsDelegate& Command, uint32 Flags = ECVF_Default) = 0;
    virtual void UnregisterConsoleObject(IConsoleObject* ConsoleObject, bool bKeepState = true) = 0;
    virtual IConsoleVariable* FindConsoleVariable(const TCHAR* Name, bool bTrackFrequentCalls = true) const = 0;
    virtual IConsoleObject* FindConsoleObject(const TCHAR* Name, bool bTrackFrequentCalls = true) const = 0;
};
class FAutoConsoleObject
{
public:
    virtual ~FAutoConsoleObject();
    IConsoleVariable* AsVariable();
protected:
    explicit FAutoConsoleObject(IConsoleObject* InTarget);
};
class FAutoConsoleVariableRef : private FAutoConsoleObject
{
public:
    FAutoConsoleVariableRef(const TCHAR* Name, int32& RefValue, const TCHAR* Help, uint32 Flags = ECVF_Default);
    FAutoConsoleVariableRef(const TCHAR* Name, float& RefValue, const TCHAR* Help, uint32 Flags = ECVF_Default);
    FAutoConsoleVariableRef(const TCHAR* Name, bool& RefValue, const TCHAR* Help, uint32 Flags = ECVF_Default);
    FAutoConsoleVariableRef(const TCHAR* Name, FString& RefValue, const TCHAR* Help, uint32 Flags = ECVF_Default);
    FAutoConsoleVariableRef(const TCHAR* Name, int32& RefValue, const TCHAR* Help, const FConsoleVariableDelegate& Callback, uint32 Flags = ECVF_Default);
    FAutoConsoleVariableRef(const TCHAR* Name, float& RefValue, const TCHAR* Help, const FConsoleVariableDelegate& Callback, uint32 Flags = ECVF_Default);
    FAutoConsoleVariableRef(const TCHAR* Name, bool& RefValue, const TCHAR* Help, const FConsoleVariableDelegate& Callback, uint32 Flags = ECVF_Default);
    IConsoleVariable* operator->() const;
};
template <class T>
class TAutoConsoleVariable : public FAutoConsoleObject
{
public:
    TAutoConsoleVariable(const TCHAR* Name, const T& DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default);
    TAutoConsoleVariable(const TCHAR* Name, const T& DefaultValue, const TCHAR* Help, const FConsoleVariableDelegate& Callback, uint32 Flags = ECVF_Default);
    T GetValueOnGameThread() const;
    T GetValueOnRenderThread() const;
    T GetValueOnAnyThread(bool bForceGameThread = false) const;
    IConsoleVariable& operator*();
    const IConsoleVariable& operator*() const;
    IConsoleVariable* operator->();
    const IConsoleVariable* operator->() const;
};
template <> class TAutoConsoleVariable<FString> : public FAutoConsoleObject
{
public:
    TAutoConsoleVariable(const TCHAR* Name, const FString& DefaultValue, const TCHAR* Help, uint32 Flags = ECVF_Default);
    FString GetValueOnGameThread() const;
    FString GetValueOnAnyThread(bool bForceGameThread = false) const;
    IConsoleVariable* operator->();
};
class FAutoConsoleCommand : private FAutoConsoleObject
{
public:
    FAutoConsoleCommand(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandDelegate& Command, uint32 Flags = ECVF_Default);
    FAutoConsoleCommand(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandWithArgsDelegate& Command, uint32 Flags = ECVF_Default);
    FAutoConsoleCommand(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandWithWorldAndArgsDelegate& Command, uint32 Flags = ECVF_Default);
    FAutoConsoleCommand(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandWithWorldArgsAndOutputDeviceDelegate& Command, uint32 Flags = ECVF_Default);
};
class FAutoConsoleCommandWithWorld : private FAutoConsoleObject
{
public:
    FAutoConsoleCommandWithWorld(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandWithWorldDelegate& Command, uint32 Flags = ECVF_Default);
};
class FAutoConsoleCommandWithWorldAndArgs : private FAutoConsoleObject
{
public:
    FAutoConsoleCommandWithWorldAndArgs(const TCHAR* Name, const TCHAR* Help, const FConsoleCommandWithWorldAndArgsDelegate& Command, uint32 Flags = ECVF_Default);
};
