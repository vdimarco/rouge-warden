// Offline UE 5.x API stub: Components/SkeletalMeshComponent.h
#pragma once
#include "Components/SkinnedMeshComponent.h"
class UAnimInstance;
class UAnimationAsset;
class UAnimSequenceBase;
class USkeletalMesh;
class UPhysicsAsset;
class UAnimMontage;
namespace EAnimationMode { enum Type : int { AnimationBlueprint, AnimationSingleNode, AnimationCustomMode }; }
namespace EKinematicBonesUpdateToPhysics { enum Type : int { SkipSimulatingBones, SkipAllBones }; }
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAnimInitialized);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FiveParams(FConstraintBrokenSignature, int32, ConstraintIndex, int32, A, int32, B, int32, C, int32, D);

class USkeletalMeshComponent : public USkinnedMeshComponent
{
    UESTUB_UCLASS_BODY(USkeletalMeshComponent, USkinnedMeshComponent)
    USkeletalMeshComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TSubclassOf<UAnimInstance> AnimClass;
    float GlobalAnimRateScale;
    uint8 bPauseAnims : 1;
    uint8 bNoSkeletonUpdate : 1;
    uint8 bEnablePhysicsOnDedicatedServer : 1;
    uint8 bUpdateJointsFromAnimation : 1;
    uint8 bBlendPhysics : 1;
    uint8 bEnablePerPolyCollision : 1;
    uint8 bPropagateCurvesToFollowers : 1;
    uint8 bSkipKinematicUpdateWhenInterpolating : 1;
    uint8 bSkipBoundsUpdateWhenInterpolating : 1;
    uint8 bUpdateOverlapsOnAnimationFinalize : 1;
    uint8 bOnlyAllowAutonomousTickPose : 1;
    TEnumAsByte<EKinematicBonesUpdateToPhysics::Type> KinematicBonesUpdateType;
    FOnAnimInitialized OnAnimInitialized;
    FConstraintBrokenSignature OnConstraintBroken;

    USkeletalMesh* GetSkeletalMeshAsset() const;
    void SetSkeletalMeshAsset(USkeletalMesh* NewMesh);
    virtual void SetSkeletalMesh(class USkeletalMesh* NewMesh, bool bReinitPose = true);
    virtual void SetSkinnedAssetAndUpdate(USkinnedAsset* NewMesh, bool bReinitPose = true) override;
    UAnimInstance* GetAnimInstance() const;
    UAnimInstance* GetPostProcessInstance() const;
    class UAnimSingleNodeInstance* GetSingleNodeInstance() const;
    bool InitializeAnimScriptInstance(bool bForceReinit = true, bool bInDeferRootNodeInitialization = false);
    const TArray<UAnimInstance*>& GetLinkedAnimInstances() const;
    UAnimInstance* GetLinkedAnimGraphInstanceByTag(FName InTag) const;
    void SetAnimInstanceClass(UClass* NewClass);
    void SetAnimClass(UClass* NewClass);
    UClass* GetAnimClass();
    void SetAnimationMode(EAnimationMode::Type InAnimationMode, bool bForceInitAnimScriptInstance = true);
    EAnimationMode::Type GetAnimationMode() const;
    void PlayAnimation(class UAnimationAsset* NewAnimToPlay, bool bLooping);
    void SetAnimation(class UAnimationAsset* NewAnimToPlay);
    void Play(bool bLooping);
    void Stop();
    bool IsPlaying() const;
    void SetPosition(float InPos, bool bFireNotifies = true);
    float GetPosition() const;
    void SetPlayRate(float Rate);
    float GetPlayRate() const;
    UAnimationAsset* GetAnimationAsset() const;
    void TickAnimation(float DeltaTime, bool bNeedsValidRootMotion);
    void TickPose(float DeltaTime, bool bNeedsValidRootMotion);
    virtual void RefreshBoneTransforms(FActorComponentTickFunction* TickFunction = nullptr) override;
    void InitAnim(bool bForceReinit);
    bool IsPostEvaluatingAnimation() const;
    void SetUpdateAnimationInEditor(const bool NewUpdateState);
    void SetUpdateClothInEditor(const bool NewUpdateState);
    // morph targets / curves
    void SetMorphTarget(FName MorphTargetName, float Value, bool bRemoveZeroWeight = true);
    void ClearMorphTargets();
    float GetMorphTarget(FName MorphTargetName) const;
    // physics
    UPhysicsAsset* GetPhysicsAsset() const;
    void SetPhysicsAsset(class UPhysicsAsset* NewPhysicsAsset, bool bForceReInit = false);
    void SetAllBodiesSimulatePhysics(bool bNewSimulate);
    void SetAllBodiesBelowSimulatePhysics(const FName& InBoneName, bool bNewSimulate, bool bIncludeSelf = true);
    void SetAllBodiesPhysicsBlendWeight(float PhysicsBlendWeight, bool bSkipCustomPhysicsType = false);
    void SetAllBodiesBelowPhysicsBlendWeight(const FName& InBoneName, float PhysicsBlendWeight, bool bSkipCustomPhysicsType = false, bool bIncludeSelf = true);
    void AccumulateAllBodiesBelowPhysicsBlendWeight(const FName& InBoneName, float AddPhysicsBlendWeight, bool bSkipCustomPhysicsType = false);
    void SetPhysicsBlendWeight(float PhysicsBlendWeight);
    void SetEnablePhysicsBlending(bool bNewBlendPhysics);
    void ResetAllBodiesSimulatePhysics();
    void SetEnableBodyGravity(bool bEnableGravity, FName BoneName);
    bool IsBodyGravityEnabled(FName BoneName);
    void SetEnableGravityOnAllBodiesBelow(bool bEnableGravity, FName BoneName, bool bIncludeSelf = true);
    void SetConstraintProfile(FName JointName, FName ProfileName, bool bDefaultIfNotFound = false);
    void SetConstraintProfileForAll(FName ProfileName, bool bDefaultIfNotFound = false);
    void BreakConstraint(FVector Impulse, FVector HitLocation, FName InBoneName);
    void SetAngularLimits(FName InBoneName, float Swing1LimitAngle, float TwistLimitAngle, float Swing2LimitAngle);
    void SetNotifyRigidBodyCollisionBelow(bool bNewNotifyRigidBodyCollision, FName BoneName = NAME_None, bool bIncludeSelf = true);
    float GetBoneMass(FName BoneName = NAME_None, bool bScaleMass = true) const;
    FVector GetSkeletalCenterOfMass() const;
    void KinematicBonesUpdateToPhysics(const TArray<FTransform>& InComponentSpaceTransforms, EKinematicBonesUpdateToPhysics::Type UpdateType, enum ETeleportType Teleport, bool bNeedsSkinning, int32 ForceUpdateBodiesIndex = INDEX_NONE);
    virtual void SetSimulatePhysics(bool bEnabled) override;
    virtual void AddImpulse(FVector Impulse, FName BoneName = NAME_None, bool bVelChange = false) override;
    virtual void AddForce(FVector Force, FName BoneName = NAME_None, bool bAccelChange = false) override;
    virtual void SetPhysicsLinearVelocity(FVector NewVel, bool bAddToCurrent = false, FName BoneName = NAME_None) override;
    virtual void SetAllPhysicsLinearVelocity(FVector NewVel, bool bAddToCurrent = false) override;
    virtual void WakeAllRigidBodies() override;
    virtual FBodyInstance* GetBodyInstance(FName BoneName = NAME_None, bool bGetWelded = true, int32 Index = INDEX_NONE) const override;
    virtual void SetCollisionObjectType(ECollisionChannel Channel) override;
    virtual void SetCollisionEnabled(ECollisionEnabled::Type NewType) override;
    // montage helpers
    void LinkAnimClassLayers(TSubclassOf<UAnimInstance> InClass);
    void UnlinkAnimClassLayers(TSubclassOf<UAnimInstance> InClass);
    virtual FTransform GetSocketTransform(FName InSocketName, ERelativeTransformSpace TransformSpace = RTS_World) const override;
    virtual void TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
};
