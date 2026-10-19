// Offline UE 5.x API stub: Modules/ModuleInterface.h
#pragma once
#include "CoreMinimal.h"
class IModuleInterface
{
public:
    virtual ~IModuleInterface() {}
    virtual void StartupModule() {}
    virtual void PreUnloadCallback() {}
    virtual void PostLoadCallback() {}
    virtual void ShutdownModule() {}
    virtual bool SupportsDynamicReloading() { return true; }
    virtual bool SupportsAutomaticShutdown() { return true; }
    virtual bool IsGameModule() const { return false; }
};
