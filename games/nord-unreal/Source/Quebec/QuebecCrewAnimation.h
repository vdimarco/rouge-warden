#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/BlendSpace1D.h"
#include "QuebecCrewAnimation.generated.h"

class UAnimSequence;
class USkeletalMesh;
class UStaticMesh;

UCLASS(Transient)
class QUEBEC_API UQuebecCrewAnimInstance : public UAnimInstance
{
    GENERATED_BODY()
public:
    UQuebecCrewAnimInstance();
    // Editor authoring only; the saved asset remains an ordinary engine BlendSpace1D.
    UFUNCTION(BlueprintCallable, Category="NORD") static bool ConfigureCrewBlendSpace(UBlendSpace1D* Space, UAnimSequence* Idle, UAnimSequence* Walk, UAnimSequence* Run);
    UFUNCTION(BlueprintCallable, Category="NORD") static bool ConfigureTripoGrip(USkeletalMesh* Mesh, UStaticMesh* Prop);
    bool SetAssets(UBlendSpace* Locomotion, UAnimSequence* Jump);
    // Hoodie locomotion has no saved blend space. The graph blends these clips by speed.
    bool SetGaitClips(UAnimSequence* Idle, UAnimSequence* Walk, UAnimSequence* Run);
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UBlendSpace> LocomotionAsset;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UAnimSequence> JumpAsset;
    UPROPERTY(Transient) TObjectPtr<UAnimSequence> GaitIdleAsset;
    UPROPERTY(Transient) TObjectPtr<UAnimSequence> GaitWalkAsset;
    UPROPERTY(Transient) TObjectPtr<UAnimSequence> GaitRunAsset;
    UPROPERTY(Transient) float GaitPhase = 0.f;
    // Published on the game thread after the engine graph update, including its real sample weights/times.
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UAnimSequence> ObservedClip;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedClipTime = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedIdleWeight = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedWalkWeight = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedRunWeight = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedJumpWeight = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedGroundSpeed = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedFilteredSpeed = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) bool ObservedFalling = false;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedLandingSeconds = 1.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) int32 ObservedFingerControlCount = 0;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedFingerFlexDegrees = 0.f;
    UPROPERTY(Transient, VisibleAnywhere, BlueprintReadOnly) float ObservedEyeNarrowWeight = 0.f;
protected:
    virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;
    virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy) override;
};
