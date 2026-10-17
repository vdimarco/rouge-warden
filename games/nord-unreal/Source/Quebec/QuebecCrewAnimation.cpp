#include "QuebecCrewAnimation.h"

#include "Animation/AnimInstanceProxy.h"
#include "Animation/Skeleton.h"
#include "Animation/AnimSequence.h"
#include "Animation/AnimNodeSpaceConversions.h"
#include "AnimNodes/AnimNode_BlendSpacePlayer.h"
#include "AnimNodes/AnimNode_SequenceEvaluator.h"
#include "AnimNodes/AnimNode_TwoWayBlend.h"
#include "BoneControllers/AnimNode_ModifyBone.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/SkeletalMeshSocket.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "UObject/UnrealType.h"

bool UQuebecCrewAnimInstance::ConfigureCrewBlendSpace(UBlendSpace1D* Space, UAnimSequence* Idle, UAnimSequence* Walk, UAnimSequence* Run)
{
#if WITH_EDITOR
    if (!Space || !Idle || !Walk || !Run || !Space->GetSkeleton() || Idle->GetSkeleton() != Space->GetSkeleton() ||
        Walk->GetSkeleton() != Space->GetSkeleton() || Run->GetSkeleton() != Space->GetSkeleton() ||
        Idle->HasRootMotion() || Walk->HasRootMotion() || Run->HasRootMotion()) return false;
    const FStructProperty* AxisProperty = FindFProperty<FStructProperty>(Space->GetClass(), TEXT("BlendParameters"));
    const FArrayProperty* SamplesProperty = FindFProperty<FArrayProperty>(Space->GetClass(), TEXT("SampleData"));
    if (!AxisProperty || !SamplesProperty) return false;
    Space->Modify();
    // These editable engine fields are protected, and UBlendSpace's MinimalAPI vtable cannot be subclassed in the installed engine.
    FBlendParameter& Axis = *AxisProperty->ContainerPtrToValuePtr<FBlendParameter>(Space);
    Axis.DisplayName = TEXT("Speed");
    Axis.Min = 0.f;
    Axis.Max = 800.f;
    Axis.GridNum = 16;
    Space->InterpolationParam[0].InterpolationTime = .12f;
    Space->InterpolationParam[0].InterpolationType = BSIT_Linear;
    Space->bScaleAnimation = false;
    while (Space->GetNumberOfBlendSamples()) Space->DeleteSample(Space->GetNumberOfBlendSamples() - 1);
    const int32 IdleIndex = Space->AddSample(Idle, FVector::ZeroVector);
    const int32 WalkIndex = Space->AddSample(Walk, FVector(450.f, 0.f, 0.f));
    const int32 RunIndex = Space->AddSample(Run, FVector(800.f, 0.f, 0.f));
    if (IdleIndex == INDEX_NONE || WalkIndex == INDEX_NONE || RunIndex == INDEX_NONE) return false;
    TArray<FBlendSample>& Samples = *SamplesProperty->ContainerPtrToValuePtr<TArray<FBlendSample>>(Space);
    Samples[IdleIndex].RateScale = 1.f;
    Samples[WalkIndex].RateScale = 2.f;
    Samples[RunIndex].RateScale = 800.f / 600.f;
    Space->ValidateSampleData();
    Space->ResampleData();
    Space->MarkPackageDirty();
    return Space->GetNumberOfBlendSamples() == 3;
#else
    return false;
#endif
}

bool UQuebecCrewAnimInstance::ConfigureTripoGrip(USkeletalMesh* Mesh, UStaticMesh* Prop)
{
#if WITH_EDITOR
    if (!Mesh || !Prop || !Mesh->GetSkeleton() ||
        !Mesh->GetPathName().StartsWith(TEXT("/Game/ParkComic/CrewGraphicNovelTripo/Resident9/"))) return false;
    const FReferenceSkeleton& Reference = Mesh->GetRefSkeleton();
    const int32 HandIndex = Reference.FindBoneIndex(TEXT("hand_r"));
    const int32 PalmIndex = Reference.FindBoneIndex(TEXT("middle_01_r"));
    const FVector Size = Prop->GetBoundingBox().GetSize();
    if (HandIndex == INDEX_NONE || PalmIndex == INDEX_NONE || Size.Z < 1.f || FMath::Max(Size.X, Size.Y) < 1.f) return false;
    TArray<FTransform> Bind = Reference.GetRefBonePose();
    for (int32 Index = 0; Index < Bind.Num(); ++Index)
        if (const int32 Parent = Reference.GetParentIndex(Index); Parent != INDEX_NONE) Bind[Index] *= Bind[Parent];
    const FTransform& Hand = Bind[HandIndex];
    const FVector HandScale = Hand.GetScale3D();
    if (HandScale.GetMin() <= 0.f || !FMath::IsNearlyEqual(HandScale.GetMax(), HandScale.GetMin(), .0001f)) return false;
    const FVector FinalScale(16.f / FMath::Max(Size.X, Size.Y), 16.f / FMath::Max(Size.X, Size.Y), 55.f / Size.Z);
    const FQuat Desired = FRotationMatrix::MakeFromZ(FVector(-.2, .55, -.8).GetSafeNormal()).ToQuat();
    const FQuat Relative = Hand.GetRotation().Inverse() * Desired;
    const FVector LocalScale = FinalScale / HandScale;
    const FVector Palm = FMath::Lerp(Hand.GetTranslation(), Bind[PalmIndex].GetTranslation(), .55f);
    const FVector Offset = Hand.InverseTransformPosition(Palm) - Relative.RotateVector(FVector(0., 0., -20.) * LocalScale);
    USkeleton* Skeleton = Mesh->GetSkeleton();
    Skeleton->Modify();
    USkeletalMeshSocket* Socket = Skeleton->FindSocket(TEXT("TripoGrip"));
    if (!Socket)
    {
        Socket = NewObject<USkeletalMeshSocket>(Skeleton, TEXT("TripoGrip"));
        Skeleton->Sockets.Add(Socket);
    }
    Socket->SocketName = TEXT("TripoGrip");
    Socket->BoneName = TEXT("hand_r");
    Socket->RelativeLocation = Offset;
    Socket->RelativeRotation = Relative.Rotator();
    Socket->RelativeScale = LocalScale;
    Skeleton->MarkPackageDirty();
    return true;
#else
    return false;
#endif
}

namespace
{
    struct FCrewLocomotionNode : FAnimNode_BlendSpacePlayer_Standalone
    {
        const TArray<FBlendSampleData>& Samples() const { return BlendSampleDataCache; }
    };

    struct FCrewJumpBlendNode : FAnimNode_TwoWayBlend
    {
        FCrewJumpBlendNode()
        {
            AlphaInputType = EAnimAlphaInputType::Bool;
            AlphaBoolBlend.BlendInTime = .1f;
            AlphaBoolBlend.BlendOutTime = .16f;
            bAlphaBoolEnabled = false;
            bAlwaysUpdateChildren = true;
        }
        float Weight() const { return InternalBlendAlpha; }
    };

    struct FCrewAnimationProxy : FAnimInstanceProxy
    {
        FCrewLocomotionNode Locomotion;
        FAnimNode_SequenceEvaluator_Standalone Jump;
        FCrewJumpBlendNode Blend;
        FAnimNode_ConvertLocalToComponentSpace ToComponent;
        TArray<FAnimNode_ModifyBone> Fingers;
        TArray<FVector> FingerAxes;
        FAnimNode_ConvertComponentToLocalSpace ToLocal;
        bool bHasEyeMorphs = false;
        bool bWasFalling = false;
        float LandingSeconds = 1.f;

        explicit FCrewAnimationProxy(UAnimInstance* Instance) : FAnimInstanceProxy(Instance)
        {
            Blend.A.SetLinkNode(&Locomotion);
            Blend.B.SetLinkNode(&Jump);
            Jump.SetShouldLoop(false);
            Jump.SetTeleportToExplicitTime(true);
        }

        virtual void Initialize(UAnimInstance* Instance) override
        {
            Fingers.Reset();
            FingerAxes.Reset();
            const USkeletalMeshComponent* Component = Instance->GetSkelMeshComponent();
            const USkeletalMesh* Mesh = Component ? Component->GetSkeletalMeshAsset() : nullptr;
            bHasEyeMorphs = Mesh && Mesh->FindMorphTarget(TEXT("GN_EyeNarrow_L")) && Mesh->FindMorphTarget(TEXT("GN_EyeNarrow_R"));
            if (Mesh)
            {
                const FReferenceSkeleton& Reference = Mesh->GetRefSkeleton();
                TArray<FName> Names;
                for (const TCHAR* Side : {TEXT("Left"), TEXT("Right")})
                    for (const TCHAR* Digit : {TEXT("Pinky"), TEXT("Ring"), TEXT("Middle"), TEXT("Index"), TEXT("Thumb")})
                        for (int32 Segment = 1; Segment <= 2; ++Segment)
                            Names.Emplace(*FString::Printf(TEXT("GN_%s_%s%d"), Side, Digit, Segment));
                const bool bHasFingers = !Names.ContainsByPredicate([&Reference](FName Name) { return Reference.FindBoneIndex(Name) == INDEX_NONE; });
                if (bHasFingers)
                {
                    TArray<FTransform> Bind = Reference.GetRefBonePose();
                    for (int32 Index = 0; Index < Bind.Num(); ++Index)
                        if (const int32 Parent = Reference.GetParentIndex(Index); Parent != INDEX_NONE) Bind[Index] *= Bind[Parent];
                    FVector Forward = FVector::ForwardVector;
                    const int32 Head = Reference.FindBoneIndex(TEXT("Head")), Face = Reference.FindBoneIndex(TEXT("headfront"));
                    if (Head != INDEX_NONE && Face != INDEX_NONE)
                        Forward = (Bind[Face].GetTranslation() - Bind[Head].GetTranslation()).GetSafeNormal2D();
                    Fingers.SetNum(Names.Num());
                    FingerAxes.SetNum(Names.Num());
                    ToComponent.LocalPose.SetLinkNode(&Blend);
                    for (int32 Index = 0; Index < Names.Num(); ++Index)
                    {
                        const int32 Bone = Reference.FindBoneIndex(Names[Index]);
                        const int32 First = Reference.FindBoneIndex(Names[Index - Index % 2]);
                        const int32 Second = Reference.FindBoneIndex(Names[Index - Index % 2 + 1]);
                        FVector Direction = Bind[Second].GetTranslation() - Bind[First].GetTranslation();
                        // Infer the terminal direction in its imported basis; never copy Blender-local axes through FBX.
                        if (Index % 2) Direction = Bind[Bone].TransformVectorNoScale(Bind[First].InverseTransformVectorNoScale(Direction));
                        FingerAxes[Index] = Bind[Bone].InverseTransformVectorNoScale(FVector::CrossProduct(Direction, Forward)).GetSafeNormal();
                        FAnimNode_ModifyBone& Finger = Fingers[Index];
                        Finger.BoneToModify.BoneName = Names[Index];
                        Finger.RotationMode = BMM_Additive;
                        Finger.RotationSpace = BCS_BoneSpace;
                        Finger.ComponentPose.SetLinkNode(Index ? static_cast<FAnimNode_Base*>(&Fingers[Index - 1]) : static_cast<FAnimNode_Base*>(&ToComponent));
                    }
                    ToLocal.ComponentPose.SetLinkNode(&Fingers.Last());
                }
            }
            FAnimInstanceProxy::Initialize(Instance);
        }

        virtual FAnimNode_Base* GetCustomRootNode() override { return Fingers.Num() ? static_cast<FAnimNode_Base*>(&ToLocal) : static_cast<FAnimNode_Base*>(&Blend); }
        virtual void GetCustomNodes(TArray<FAnimNode_Base*>& Nodes) override
        {
            Nodes.Append({&Locomotion, &Jump, &Blend});
            if (Fingers.Num())
            {
                Nodes.Append({&ToComponent, &ToLocal});
                for (FAnimNode_ModifyBone& Finger : Fingers) Nodes.Add(&Finger);
            }
        }

        virtual void PreUpdate(UAnimInstance* Instance, float DeltaSeconds) override
        {
            FAnimInstanceProxy::PreUpdate(Instance, DeltaSeconds);
            UQuebecCrewAnimInstance* Crew = CastChecked<UQuebecCrewAnimInstance>(Instance);
            const ACharacter* Character = Cast<ACharacter>(Instance->GetOwningActor());
            const FVector Velocity = Character ? Character->GetVelocity() : FVector::ZeroVector;
            const bool bFalling = Character && Character->GetCharacterMovement()->IsFalling();
            if (bWasFalling && !bFalling) LandingSeconds = 0.f;
            bWasFalling = bFalling;
            LandingSeconds += DeltaSeconds;
            Locomotion.SetBlendSpace(Crew->LocomotionAsset);
            Locomotion.SetPosition(FVector(Velocity.Size2D(), 0.f, 0.f));
            Jump.SetSequence(Crew->JumpAsset);
            const float JumpVelocity = Character ? Character->GetCharacterMovement()->JumpZVelocity : 600.f;
            const float Vertical = Velocity.Z / FMath::Max(JumpVelocity, 1.f);
            const float Time = bFalling ? (Vertical > 0.f ? FMath::Lerp(.47f, .23f, FMath::Clamp(Vertical, 0.f, 1.f))
                : FMath::Lerp(.47f, .73f, FMath::Clamp(-Vertical, 0.f, 1.f))) : .93f + LandingSeconds;
            const float Length = Crew->JumpAsset ? Crew->JumpAsset->GetPlayLength() : 1.2f;
            Jump.SetExplicitTime(FMath::Clamp(Time / 1.2f * Length, 0.f, Length));
            Blend.bAlphaBoolEnabled = bFalling || LandingSeconds < .27f;
            const float Effort = FMath::Clamp(Crew->ObservedFilteredSpeed / 800.f, 0.f, 1.f);
            const float Flex = FMath::Lerp(4.f, 10.f, Effort);
            for (int32 Index = 0; Index < Fingers.Num(); ++Index)
                Fingers[Index].Rotation = FQuat(FingerAxes[Index], FMath::DegreesToRadians(Flex)).Rotator();
            if (bHasEyeMorphs)
            {
                Instance->SetMorphTarget(TEXT("GN_EyeNarrow_L"), Effort * .35f);
                Instance->SetMorphTarget(TEXT("GN_EyeNarrow_R"), Effort * .35f);
            }
            Crew->ObservedFingerControlCount = Fingers.Num();
            Crew->ObservedFingerFlexDegrees = Fingers.Num() ? Flex : 0.f;
            Crew->ObservedEyeNarrowWeight = bHasEyeMorphs ? Instance->GetSkelMeshComponent()->GetMorphTarget(TEXT("GN_EyeNarrow_L")) : 0.f;
            Crew->ObservedGroundSpeed = Velocity.Size2D();
            Crew->ObservedFalling = bFalling;
            Crew->ObservedLandingSeconds = LandingSeconds;
        }

        virtual void PostUpdate(UAnimInstance* Instance) const override
        {
            FAnimInstanceProxy::PostUpdate(Instance);
            UQuebecCrewAnimInstance* Crew = CastChecked<UQuebecCrewAnimInstance>(Instance);
            Crew->ObservedJumpWeight = Blend.Weight();
            Crew->ObservedFilteredSpeed = Locomotion.GetFilteredPosition().X;
            Crew->ObservedIdleWeight = Crew->ObservedWalkWeight = Crew->ObservedRunWeight = 0.f;
            Crew->ObservedClip = Crew->JumpAsset;
            Crew->ObservedClipTime = Jump.GetExplicitTime();
            float DominantWeight = Crew->ObservedJumpWeight;
            if (const UBlendSpace* Space = Locomotion.GetBlendSpace())
                for (const FBlendSampleData& Sample : Locomotion.Samples())
                {
                    if (!Space->GetBlendSamples().IsValidIndex(Sample.SampleDataIndex)) continue;
                    const FBlendSample& Source = Space->GetBlendSample(Sample.SampleDataIndex);
                    const float Weight = Sample.GetClampedWeight() * (1.f - Crew->ObservedJumpWeight);
                    if (Sample.SampleDataIndex == 0) Crew->ObservedIdleWeight += Weight;
                    else if (Sample.SampleDataIndex == 1) Crew->ObservedWalkWeight += Weight;
                    else if (Sample.SampleDataIndex == 2) Crew->ObservedRunWeight += Weight;
                    if (Weight > DominantWeight)
                    {
                        DominantWeight = Weight;
                        Crew->ObservedClip = Source.Animation;
                        Crew->ObservedClipTime = Sample.Time;
                    }
                }
        }
    };
}

UQuebecCrewAnimInstance::UQuebecCrewAnimInstance()
{
    SetRootMotionMode(ERootMotionMode::NoRootMotionExtraction);
}

bool UQuebecCrewAnimInstance::SetAssets(UBlendSpace* Locomotion, UAnimSequence* Jump)
{
    const USkeletalMeshComponent* Component = GetSkelMeshComponent();
    const USkeletalMesh* Mesh = Component ? Component->GetSkeletalMeshAsset() : nullptr;
    if (!Mesh || !Locomotion || !Jump || Locomotion->GetSkeleton() != Mesh->GetSkeleton() ||
        Jump->GetSkeleton() != Mesh->GetSkeleton() || Jump->HasRootMotion() || Locomotion->GetBlendSamples().Num() != 3) return false;
    LocomotionAsset = Locomotion;
    JumpAsset = Jump;
    return true;
}

FAnimInstanceProxy* UQuebecCrewAnimInstance::CreateAnimInstanceProxy() { return new FCrewAnimationProxy(this); }
void UQuebecCrewAnimInstance::DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy) { delete InProxy; }
