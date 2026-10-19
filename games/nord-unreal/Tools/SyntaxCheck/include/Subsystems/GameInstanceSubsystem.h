// Offline UE 5.x API stub: Subsystems/GameInstanceSubsystem.h
#pragma once
#include "Subsystems/Subsystem.h"
class UGameInstance;
class UGameInstanceSubsystem : public USubsystem
{
    UESTUB_UCLASS_BODY(UGameInstanceSubsystem, USubsystem)
    UGameInstanceSubsystem();
    UGameInstance* GetGameInstance() const;
    template <typename T> T* GetGameInstance() const { return Cast<T>(GetGameInstance()); }
    template <typename T> T* GetGameInstanceChecked() const { return CastChecked<T>(GetGameInstance()); }
};
