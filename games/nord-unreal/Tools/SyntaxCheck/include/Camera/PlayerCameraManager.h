// Offline UE 5.x API stub: Camera/PlayerCameraManager.h
#pragma once
#include "GameFramework/Actor.h"
#include "Engine/Scene.h"
#include "Camera/CameraTypes.h"
class APlayerController;
class UCameraShakeBase;
struct FTViewTarget { TObjectPtr<AActor> Target; FMinimalViewInfo POV; AActor* GetTarget() const; };
class APlayerCameraManager : public AActor
{
    UESTUB_UCLASS_BODY(APlayerCameraManager, AActor)
    APlayerCameraManager(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<APlayerController> PCOwner;
    FName CameraStyle;
    float DefaultFOV;
    float DefaultOrthoWidth;
    float DefaultAspectRatio;
    float ViewPitchMin;
    float ViewPitchMax;
    float ViewYawMin;
    float ViewYawMax;
    float ViewRollMin;
    float ViewRollMax;
    uint32 bIsOrthographic : 1;
    uint32 bDefaultConstrainAspectRatio : 1;
    uint32 bClientSimulatingViewTarget : 1;
    uint32 bUseClientSideCameraUpdates : 1;
    uint32 bGameCameraCutThisFrame : 1;
    FTViewTarget ViewTarget;
    APlayerController* GetOwningPlayerController() const;
    virtual FVector GetCameraLocation() const;
    virtual FRotator GetCameraRotation() const;
    virtual float GetFOVAngle() const;
    virtual void SetFOV(float NewFOV);
    virtual void UnlockFOV();
    bool IsOrthographic() const;
    float GetOrthoWidth() const;
    void GetCameraViewPoint(FVector& OutCamLoc, FRotator& OutCamRot) const;
    const FMinimalViewInfo& GetCameraCacheView() const;
    AActor* GetViewTarget() const;
    virtual void SetViewTarget(class AActor* NewViewTarget, struct FViewTargetTransitionParams TransitionParams);
    virtual void ProcessViewRotation(float DeltaTime, FRotator& OutViewRotation, FRotator& OutDeltaRot);
    virtual void LimitViewPitch(FRotator& ViewRotation, float InViewPitchMin, float InViewPitchMax);
    virtual void LimitViewRoll(FRotator& ViewRotation, float InViewRollMin, float InViewRollMax);
    virtual void LimitViewYaw(FRotator& ViewRotation, float InViewYawMin, float InViewYawMax);
    void SetGameCameraCutThisFrame();
    bool GetGameCameraCutThisFrame() const;
    virtual UCameraShakeBase* StartCameraShake(TSubclassOf<UCameraShakeBase> ShakeClass, float Scale = 1.f, ECameraShakePlaySpace PlaySpace = ECameraShakePlaySpace::CameraLocal, FRotator UserPlaySpaceRot = FRotator::ZeroRotator);
    virtual void StopCameraShake(UCameraShakeBase* ShakeInstance, bool bImmediately = true);
    virtual void StopAllInstancesOfCameraShake(TSubclassOf<UCameraShakeBase> Shake, bool bImmediately = true);
    virtual void StopAllCameraShakes(bool bImmediately = true);
    virtual void StartCameraFade(float FromAlpha, float ToAlpha, float Duration, FLinearColor Color, bool bShouldFadeAudio = false, bool bHoldWhenFinished = false);
    virtual void StopCameraFade();
    virtual void SetManualCameraFade(float InFadeAmount, FLinearColor Color, bool bInFadeAudio);
    virtual void UpdateCamera(float DeltaTime);
    virtual void InitializeFor(class APlayerController* PC);
};
