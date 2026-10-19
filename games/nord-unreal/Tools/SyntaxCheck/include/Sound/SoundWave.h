// Offline UE 5.x API stub: Sound/SoundWave.h
#pragma once
#include "Sound/SoundBase.h"
class USoundWave : public USoundBase
{
    UESTUB_UCLASS_BODY(USoundWave, USoundBase)
    USoundWave(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float Volume;
    float Pitch;
    int32 NumChannels;
    uint8 bLooping : 1;
    uint8 bStreaming : 1;
    uint8 bProcedural : 1;
    uint8 bCanProcessAsync : 1;
    FString SpokenText;
    float SubtitlePriority;
    int32 RawPCMDataSize;
    void SetSampleRate(uint32 InSampleRate, bool bInvalidateDerivedData = true);
    float GetSampleRateForCurrentPlatform() const;
    int32 GetSampleRateForCompressionOverrides(const struct FPlatformAudioCookOverrides* CompressionOverrides);
    virtual float GetDuration() const override;
    virtual bool IsLooping() const override;
    bool IsStreaming(const TCHAR* PlatformName = nullptr) const;
    float GetSubtitlePriority() const;
    int32 GetImportedSampleRate() const;
};
