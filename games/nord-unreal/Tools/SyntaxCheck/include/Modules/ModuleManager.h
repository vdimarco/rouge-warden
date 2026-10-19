// Offline UE 5.x API stub: Modules/ModuleManager.h
#pragma once
#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
enum class EModuleLoadResult { Success, FileNotFound, FileIncompatible, CouldNotBeLoadedByOS, FailedToInitialize };
class FModuleManager
{
public:
    static FModuleManager& Get();
    IModuleInterface* LoadModule(const FName InModuleName);
    IModuleInterface& LoadModuleChecked(const FName InModuleName);
    bool IsModuleLoaded(const FName InModuleName) const;
    bool UnloadModule(const FName InModuleName, bool bIsShutdown = false);
    IModuleInterface* GetModule(const FName InModuleName);
    template <typename TModuleInterface> static TModuleInterface& GetModuleChecked(const FName ModuleName);
    template <typename TModuleInterface> static TModuleInterface* GetModulePtr(const FName ModuleName);
    template <typename TModuleInterface> static TModuleInterface& LoadModuleChecked(const FName InModuleName);
    template <typename TModuleInterface> static TModuleInterface* LoadModulePtr(const FName InModuleName);
};
class FDefaultModuleImpl : public IModuleInterface {};
class FDefaultGameModuleImpl : public FDefaultModuleImpl { public: virtual bool IsGameModule() const override { return true; } };
#define IMPLEMENT_MODULE(ModuleImplClass, ModuleName) \
    extern "C" DLLEXPORT IModuleInterface* InitializeModule() { return new ModuleImplClass(); } \
    static_assert(std::is_base_of_v<IModuleInterface, ModuleImplClass>, "module class must implement IModuleInterface");
#define IMPLEMENT_GAME_MODULE(ModuleImplClass, ModuleName) IMPLEMENT_MODULE(ModuleImplClass, ModuleName)
#define IMPLEMENT_PRIMARY_GAME_MODULE(ModuleImplClass, ModuleName, GameName) IMPLEMENT_GAME_MODULE(ModuleImplClass, ModuleName)
