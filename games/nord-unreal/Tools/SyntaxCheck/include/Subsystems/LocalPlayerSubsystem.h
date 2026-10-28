#pragma once
#include "Subsystems/Subsystem.h"
class ULocalPlayer;
class ULocalPlayerSubsystem : public USubsystem
{
    UESTUB_UCLASS_BODY(ULocalPlayerSubsystem, USubsystem)
    ULocalPlayerSubsystem();
    template <typename LocalPlayerType = ULocalPlayer> LocalPlayerType* GetLocalPlayer() const;
};
