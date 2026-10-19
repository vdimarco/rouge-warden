// Offline UE 5.x API stub: Animation/AnimInstance.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Animation/AnimTypes.h"
#include "Engine/EngineTypes.h"
class USkeletalMeshComponent;
class UAnimMontage;
class UAnimSequenceBase;
class UAnimationAsset;
class APawn;
class AActor;
struct FAnimInstanceProxy;
struct FBoneContainer;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnMontageEndedMCDelegate, UAnimMontage*, Montage, bool, bInterrupted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnMontageBlendingOutStartedMCDelegate, UAnimMontage*, Montage, bool, bInterrupted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMontageStartedMCDelegate, UAnimMontage*, Montage);
DECLARE_DELEGATE_TwoParams(FOnMontageEnded, class UAnimMontage*, bool);
DECLARE_DELEGATE_TwoParams(FOnMontageBlendingOutStarted, class UAnimMontage*, bool);
class UAnimInstance : public UObject
{
    UESTUB_UCLASS_BODY(UAnimInstance, UObject)
    UAnimInstance(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TEnumAsByte<ERootMotionMode::Type> RootMotionMode;
    uint8 bUseMultiThreadedAnimationUpdate : 1;
    uint8 bUsingCopyPoseFromMesh : 1;
    uint8 bReceiveNotifiesFromLinkedInstances : 1;
    uint8 bPropagateNotifiesToLinkedInstances : 1;
    FOnMontageEndedMCDelegate OnMontageEnded;
    FOnMontageBlendingOutStartedMCDelegate OnMontageBlendingOut;
    FOnMontageStartedMCDelegate OnMontageStarted;
    USkeletalMeshComponent* GetSkelMeshComponent() const;
    USkeletalMeshComponent* GetOwningComponent() const;
    AActor* GetOwningActor() const;
    APawn* TryGetPawnOwner() const;
    virtual UWorld* GetWorld() const override;
    void SetRootMotionMode(TEnumAsByte<ERootMotionMode::Type> Value);
    void SetMorphTarget(FName MorphTargetName, float Value);
    void ClearMorphTargets();
    float GetCurveValue(FName CurveName) const;
    bool GetCurveValue(FName CurveName, float& OutValue) const;
    float Montage_Play(UAnimMontage* MontageToPlay, float InPlayRate = 1.f, EMontagePlayReturnType ReturnValueType = EMontagePlayReturnType::MontageLength, float InTimeToStartMontageAt = 0.f, bool bStopAllMontages = true);
    void Montage_Stop(float InBlendOutTime, const UAnimMontage* Montage = nullptr);
    void Montage_Pause(const UAnimMontage* Montage = nullptr);
    void Montage_Resume(const UAnimMontage* Montage);
    void Montage_JumpToSection(FName SectionName, const UAnimMontage* Montage = nullptr);
    void Montage_SetPlayRate(const UAnimMontage* Montage, float NewPlayRate = 1.f);
    bool Montage_IsActive(const UAnimMontage* Montage) const;
    bool Montage_IsPlaying(const UAnimMontage* Montage) const;
    float Montage_GetPosition(const UAnimMontage* Montage) const;
    void Montage_SetEndDelegate(FOnMontageEnded& InOnMontageEnded, UAnimMontage* Montage = nullptr);
    void Montage_SetBlendingOutDelegate(FOnMontageBlendingOutStarted& InOnMontageBlendingOut, UAnimMontage* Montage = nullptr);
    void StopAllMontages(float BlendOut);
    bool IsAnyMontagePlaying() const;
    UAnimMontage* GetCurrentActiveMontage() const;
    UAnimMontage* PlaySlotAnimationAsDynamicMontage(UAnimSequenceBase* Asset, FName SlotNodeName, float BlendInTime = 0.25f, float BlendOutTime = 0.25f, float InPlayRate = 1.f, int32 LoopCount = 1, float BlendOutTriggerTime = -1.f, float InTimeToStartMontageAt = 0.f);
    void StopSlotAnimation(float InBlendOutTime = 0.25f, FName SlotNodeName = NAME_None);
    bool IsPlayingSlotAnimation(const UAnimSequenceBase* Asset, FName SlotNodeName) const;
    float GetInstanceAssetPlayerTime(int32 AssetPlayerIndex);
    void LinkAnimClassLayers(TSubclassOf<UAnimInstance> InClass);
    template <typename T> T& GetProxyOnGameThread() { return *static_cast<T*>(GetProxyOnGameThreadStandalone()); }
    template <typename T> const T& GetProxyOnGameThread() const { return *static_cast<const T*>(GetProxyOnGameThreadStandalone()); }
    virtual void NativeInitializeAnimation();
    virtual void NativeUpdateAnimation(float DeltaSeconds);
    virtual void NativeThreadSafeUpdateAnimation(float DeltaSeconds);
    virtual void NativePostEvaluateAnimation();
    virtual void NativeUninitializeAnimation();
    virtual void NativeBeginPlay();
    FBoneContainer& GetRequiredBones();
    const FBoneContainer& GetRequiredBones() const;
    const FBoneContainer& GetRequiredBonesOnAnyThread() const;
protected:
    virtual FAnimInstanceProxy* CreateAnimInstanceProxy();
    virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy);
    FAnimInstanceProxy* GetProxyOnGameThreadStandalone();
    const FAnimInstanceProxy* GetProxyOnGameThreadStandalone() const;
};
