// Offline UE 5.x API stub: Animation/AnimInstanceProxy.h
#pragma once
#include "Animation/AnimInstance.h"
#include "Animation/AnimNodeBase.h"
class USkeleton;
class USkeletalMeshComponent;
struct FBoneContainer;
struct FAnimInstanceProxy
{
public:
    FAnimInstanceProxy();
    FAnimInstanceProxy(UAnimInstance* Instance);
    virtual ~FAnimInstanceProxy();
    UObject* GetAnimInstanceObject();
    const UObject* GetAnimInstanceObject() const;
    USkeleton* GetSkeleton();
    USkeletalMeshComponent* GetSkelMeshComponent();
    USkeletalMeshComponent* GetSkelMeshComponent() const;
    FBoneContainer& GetRequiredBones();
    const FBoneContainer& GetRequiredBones() const;
    float GetDeltaSeconds() const;
    FTransform GetComponentTransform() const;
    FTransform GetComponentRelativeTransform() const;
    FTransform GetActorTransform() const;
    bool IsSkeletonCompatible(const USkeleton* InSkeleton) const;
    void ResetDynamics(ETeleportType InTeleportType);
protected:
    virtual void Initialize(UAnimInstance* InAnimInstance);
    virtual void Uninitialize(UAnimInstance* InAnimInstance);
    virtual void PreUpdate(UAnimInstance* InAnimInstance, float DeltaSeconds);
    virtual void Update(float DeltaSeconds);
    virtual void PostUpdate(UAnimInstance* InAnimInstance) const;
    virtual bool Evaluate(FPoseContext& Output);
    virtual void CacheBones();
    virtual void PreEvaluateAnimation(UAnimInstance* InAnimInstance);
    virtual void PostEvaluate(UAnimInstance* InAnimInstance);
    virtual FAnimNode_Base* GetCustomRootNode();
    virtual void GetCustomNodes(TArray<FAnimNode_Base*>& OutNodes);
    virtual void UpdateAnimationNode(const FAnimationUpdateContext& InContext);
};
