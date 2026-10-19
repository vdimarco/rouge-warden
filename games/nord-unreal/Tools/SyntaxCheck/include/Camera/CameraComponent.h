// Offline UE 5.x API stub: Camera/CameraComponent.h
#pragma once
#include "Components/SceneComponent.h"
#include "Engine/Scene.h"
#include "Camera/CameraTypes.h"
class UCameraComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(UCameraComponent, USceneComponent)
    UCameraComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float FieldOfView;
    float OrthoWidth;
    float OrthoNearClipPlane;
    float OrthoFarClipPlane;
    float AspectRatio;
    uint8 bConstrainAspectRatio : 1;
    uint8 bUseFieldOfViewForLOD : 1;
    uint8 bLockToHmd : 1;
    uint8 bUsePawnControlRotation : 1;
    TEnumAsByte<ECameraProjectionMode::Type> ProjectionMode;
    float PostProcessBlendWeight;
    FPostProcessSettings PostProcessSettings;
    virtual void SetFieldOfView(float InFieldOfView);
    void SetOrthoWidth(float InOrthoWidth);
    void SetOrthoNearClipPlane(float InOrthoNearClipPlane);
    void SetOrthoFarClipPlane(float InOrthoFarClipPlane);
    void SetAspectRatio(float InAspectRatio);
    void SetConstraintAspectRatio(bool bInConstrainAspectRatio);
    void SetUseFieldOfViewForLOD(bool bInUseFieldOfViewForLOD);
    void SetProjectionMode(ECameraProjectionMode::Type InProjectionMode);
    void SetPostProcessBlendWeight(float InPostProcessBlendWeight);
    virtual void GetCameraView(float DeltaTime, FMinimalViewInfo& DesiredView);
    void AddOrUpdateBlendable(TScriptInterface<class IBlendableInterface> InBlendableObject, float InWeight = 1.0f);
    void RemoveBlendable(TScriptInterface<class IBlendableInterface> InBlendableObject);
};
