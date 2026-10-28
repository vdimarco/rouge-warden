#pragma once
#include "UEStub/UObjectCore.h"
class APlayerController;
class UPlayer : public UObject
{
    UESTUB_UCLASS_BODY(UPlayer, UObject)
    UPlayer(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<APlayerController> PlayerController;
    int32 CurrentNetSpeed;
    APlayerController* GetPlayerController(const UWorld* InWorld) const;
};
