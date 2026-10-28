// Offline UE 5.x API stub: Sound/SoundWaveProcedural.h
#pragma once
#include "Sound/SoundWave.h"
DECLARE_DELEGATE_TwoParams(FOnSoundWaveProceduralUnderflow, class USoundWaveProcedural*, int32);
class USoundWaveProcedural : public USoundWave
{
    UESTUB_UCLASS_BODY(USoundWaveProcedural, USoundWave)
    USoundWaveProcedural(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FOnSoundWaveProceduralUnderflow OnSoundWaveProceduralUnderflow;
    int32 NumSamplesToGeneratePerCallback;
    void QueueAudio(const uint8* AudioData, const int32 BufferSize);
    void ResetAudio();
    int32 GetAvailableAudioByteCount();
    virtual int32 GeneratePCMData(uint8* PCMData, const int32 SamplesNeeded);
    virtual bool HasCompressedData(FName Format, class ITargetPlatform* TargetPlatform = nullptr) const;
};
