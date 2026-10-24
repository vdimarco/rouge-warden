// Offline UE 5.x API stub: Camera/CameraActor.h
#pragma once
#include "GameFramework/Actor.h"
class UCameraComponent;
class ACameraActor : public AActor
{
    UESTUB_UCLASS_BODY(ACameraActor, AActor)
    ACameraActor(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    UCameraComponent* GetCameraComponent() const;
    int32 GetAutoActivatePlayerIndex() const;
};
