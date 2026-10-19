#pragma once
#include "Sound/SoundBase.h"
class USoundCue : public USoundBase
{
    UESTUB_UCLASS_BODY(USoundCue, USoundBase)
    USoundCue(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float VolumeMultiplier;
    float PitchMultiplier;
};
