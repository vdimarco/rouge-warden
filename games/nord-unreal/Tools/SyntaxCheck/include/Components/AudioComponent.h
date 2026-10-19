// Offline UE 5.x API stub: Components/AudioComponent.h
#pragma once
#include "Components/SceneComponent.h"
class USoundBase;
class USoundWave;
class USoundAttenuation;
class USoundConcurrency;
class UAudioComponent;
enum class EAudioFaderCurve : uint8 { Linear, Logarithmic, SCurve, Sin, Count };
enum class EAudioComponentPlayState : uint8 { Playing, Stopped, Paused, FadingIn, FadingOut, Count };
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAudioFinished);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnAudioFinishedNative, UAudioComponent*);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAudioPlayStateChanged, EAudioComponentPlayState, PlayState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnAudioPlaybackPercent, const USoundWave*, PlayingSoundWave, const float, PlaybackPercent);
class UAudioComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(UAudioComponent, USceneComponent)
    UAudioComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<USoundBase> Sound;
    TObjectPtr<USoundAttenuation> AttenuationSettings;
    uint8 bAutoDestroy : 1;
    uint8 bStopWhenOwnerDestroyed : 1;
    uint8 bShouldRemainActiveIfDropped : 1;
    uint8 bAllowSpatialization : 1;
    uint8 bOverrideAttenuation : 1;
    uint8 bOverrideSubtitlePriority : 1;
    uint8 bIsUISound : 1;
    uint8 bEnableLowPassFilter : 1;
    uint8 bOverridePriority : 1;
    uint8 bSuppressSubtitles : 1;
    uint8 bAutoManageAttachment : 1;
    float VolumeMultiplier;
    float PitchMultiplier;
    float Priority;
    float SubtitlePriority;
    float LowPassFilterFrequency;
    FOnAudioFinished OnAudioFinished;
    FOnAudioFinishedNative OnAudioFinishedNative;
    FOnAudioPlayStateChanged OnAudioPlayStateChanged;
    FOnAudioPlaybackPercent OnAudioPlaybackPercent;
    void SetSound(USoundBase* NewSound);
    virtual void Play(float StartTime = 0.f);
    virtual void Stop();
    virtual void StopDelayed(float DelayTime);
    virtual void FadeIn(float FadeInDuration, float FadeVolumeLevel = 1.0f, float StartTime = 0.0f, const EAudioFaderCurve FadeCurve = EAudioFaderCurve::Linear);
    virtual void FadeOut(float FadeOutDuration, float FadeVolumeLevel, const EAudioFaderCurve FadeCurve = EAudioFaderCurve::Linear);
    virtual void AdjustVolume(float AdjustVolumeDuration, float AdjustVolumeLevel, const EAudioFaderCurve FadeCurve = EAudioFaderCurve::Linear);
    bool IsPlaying() const;
    bool IsVirtualized() const;
    EAudioComponentPlayState GetPlayState() const;
    void SetPaused(bool bPause);
    void SetVolumeMultiplier(float NewVolumeMultiplier);
    void SetPitchMultiplier(float NewPitchMultiplier);
    void SetUISound(bool bInUISound);
    void SetFloatParameter(FName InName, float InFloat);
    void SetIntParameter(FName InName, int32 InInt);
    void SetBoolParameter(FName InName, bool InBool);
    void SetWaveParameter(FName InName, class USoundWave* InWave);
    void SetLowPassFilterEnabled(bool InLowPassFilterEnabled);
    void SetLowPassFilterFrequency(float InLowPassFilterFrequency);
    void SetSubmixSend(class USoundSubmixBase* Submix, float SendLevel);
    void SetAttenuationSettings(USoundAttenuation* InAttenuationSettings);
    bool GetCookedEnvelopeDataForAllPlayingSounds(TArray<struct FSoundWaveEnvelopeDataPerSound>& OutEnvelopeData);
    virtual void Activate(bool bReset = false) override;
    virtual void Deactivate() override;
};
