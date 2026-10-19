// Offline UE 5.x API stub: Subsystems/Subsystem.h
#pragma once
#include "UEStub/UObjectCore.h"
class FSubsystemCollectionBase
{
public:
    class USubsystem* InitializeDependency(TSubclassOf<class USubsystem> SubsystemClass);
    template <typename TSubsystemClass> TSubsystemClass* InitializeDependency() { (void)&TSubsystemClass::StaticClass; return nullptr; }
};
template <typename TBaseType> class FSubsystemCollection : public FSubsystemCollectionBase {};
class USubsystem : public UObject
{
    UESTUB_UCLASS_BODY(USubsystem, UObject)
    USubsystem();
    virtual bool ShouldCreateSubsystem(UObject* Outer) const;
    virtual void Initialize(FSubsystemCollectionBase& Collection);
    virtual void Deinitialize();
};
class UDynamicSubsystem : public USubsystem { UESTUB_UCLASS_BODY(UDynamicSubsystem, USubsystem) UDynamicSubsystem(); };
