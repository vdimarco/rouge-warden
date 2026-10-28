// Offline UE 5.x API stub: GameFramework/PlayerStart.h
#pragma once
#include "GameFramework/NavigationObjectBase.h"
class APlayerStart : public ANavigationObjectBase
{
    UESTUB_UCLASS_BODY(APlayerStart, ANavigationObjectBase)
    APlayerStart(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FName PlayerStartTag;
};
