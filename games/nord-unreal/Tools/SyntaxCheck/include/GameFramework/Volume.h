#pragma once
#include "Engine/Brush.h"
class AVolume : public ABrush
{
    UESTUB_UCLASS_BODY(AVolume, ABrush)
    AVolume(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    bool EncompassesPoint(FVector Point, float SphereRadius = 0.f, float* OutDistanceToPoint = nullptr) const;
};
