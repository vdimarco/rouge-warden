#include "QuebecCrewAnimation.h"
#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS && WITH_EDITOR
#include "Animation/AnimSequence.h"
#include "Animation/AnimationPoseData.h"
#include "Animation/AnimCurveTypes.h"
#include "Animation/AttributesRuntime.h"
#include "Animation/Skeleton.h"
#include "BonePose.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/SkeletalMeshSocket.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Misc/AutomationTest.h"
#include "Misc/CommandLine.h"
#include "Misc/MemStack.h"
#include "Misc/ScopeExit.h"

// Keep the existing character friend and registered pilot test as the shared fixture.
// The parameterized cast test inherits its checks without widening gameplay access.
class FQuebecTripoPilotTest : public FAutomationTestBase
{
public:
    FQuebecTripoPilotTest(const FString& InName, bool bComplexTask = false)
        : FAutomationTestBase(InName, bComplexTask) {}
    virtual EAutomationTestFlags GetTestFlags() const override { return EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter; }
    virtual bool IsStressTest() const { return false; }
    virtual uint32 GetRequiredDeviceNum() const override { return 1; }
    virtual FString GetTestSourceFileName() const override { return __FILE__; }
    virtual int32 GetTestSourceFileLine() const override { return __LINE__; }
    virtual FString GetBeautifiedTestName() const override { return TEXT("Quebec.Animation.TripoPilot"); }
protected:
    virtual void GetTests(TArray<FString>& Names, TArray<FString>& Commands) const override
    {
        Names.Add(TEXT("Quebec.Animation.TripoPilot"));
        Commands.Add(FString());
    }
    AUTORTFM_DISABLE_IF(true)
    virtual bool RunTest(const FString& Parameters) override { return RunStyle(9); }
    bool RunStyle(int32 Style);
};
#if WITH_AUTOMATION_WORKER
namespace { FQuebecTripoPilotTest FQuebecTripoPilotTestAutomationTestInstance(TEXT("FQuebecTripoPilotTest")); }
#endif

IMPLEMENT_CUSTOM_COMPLEX_AUTOMATION_TEST(FQuebecTripoCastTest, FQuebecTripoPilotTest, "Quebec.Animation.TripoCast",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
void FQuebecTripoCastTest::GetTests(TArray<FString>& Names, TArray<FString>& Commands) const
{
    for (int32 Style = 3; Style <= 8; ++Style)
    {
        Names.Add(FString::Printf(TEXT("Resident%d"), Style));
        Commands.Add(FString::FromInt(Style));
    }
}
bool FQuebecTripoCastTest::RunTest(const FString& Parameters)
{
    const int32 Style = FCString::Atoi(*Parameters);
    if (!TestTrue(TEXT("Cast case explicitly selects one of styles 3 through 8"),
        Style >= 3 && Style <= 8 && Parameters == FString::FromInt(Style))) return false;
    return RunStyle(Style);
}

bool FQuebecTripoPilotTest::RunStyle(int32 Style)
{
    const FString OriginalCommandLine = FCommandLine::Get();
    const TCHAR* Flags[] = {TEXT("NordGraphicNovelCandidate"), TEXT("NordGraphicNovelGenerated"),
        TEXT("NordGraphicNovelHighDetail"), TEXT("NordGraphicNovelTripo")};
    FString DefaultCommandLine = OriginalCommandLine;
    for (const TCHAR* Flag : Flags)
        DefaultCommandLine = DefaultCommandLine.Replace(*(FString(TEXT("-")) + Flag), TEXT(""), ESearchCase::IgnoreCase);
    FCommandLine::Set(*DefaultCommandLine);
    ON_SCOPE_EXIT { FCommandLine::Set(*OriginalCommandLine); };
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated Tripo test world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecCharacter* Character = World->SpawnActor<AQuebecCharacter>();
    if (!TestNotNull(TEXT("Native Tripo test character"), Character)) return false;
    Character->SetActorEnableCollision(false);
    World->InitializeActorsForPlay(FURL());
    if (!TestTrue(TEXT("Fixture selects the requested crew"), Character->ChooseCrew(Style))) return false;
    USkeletalMeshComponent* Mesh = Character->GetMesh();
    const FString PilotFolder = FString::Printf(TEXT("/Game/ParkComic/CrewGraphicNovelTripo/Resident%d/"), Style);
    const FString ProductionFolder = FString::Printf(TEXT("/Game/ParkComic/Crew/Resident%d/"), Style);
    USkeletalMesh* Pilot = LoadObject<USkeletalMesh>(nullptr, *(PilotFolder + TEXT("SK_Body.SK_Body")));
    if (!TestNotNull(TEXT("Mandatory actual imported Tripo body; missing assets fail this test"), Pilot)) return false;
    USkeletalMesh* Production = LoadObject<USkeletalMesh>(nullptr, *(ProductionFolder + TEXT("SK_Body.SK_Body")));
    if (!TestNotNull(TEXT("Retained production body"), Production)) return false;
    TestTrue(TEXT("Tripo has its own skeleton rather than replacing production"), Pilot->GetSkeleton() &&
        Pilot->GetSkeleton() != Production->GetSkeleton());
    if (!TestNotNull(TEXT("Mandatory own Tripo skeleton"), Pilot->GetSkeleton())) return false;
    TestTrue(TEXT("The skeleton belongs to this character's isolated folder"), Pilot->GetSkeleton()->GetPathName().StartsWith(PilotFolder));
    for (int32 Mask = 0; Mask < 16; ++Mask)
    {
        FString CommandLine = DefaultCommandLine;
        for (int32 Index = 0; Index < 4; ++Index)
            if (Mask & (1 << Index)) CommandLine += FString(TEXT(" -")) + Flags[Index];
        FCommandLine::Set(*CommandLine);
        Character->ApplyCrewAppearance();
        const bool Candidate = (Mask & 1) != 0;
        const bool Generated = Candidate && (Mask & 2) != 0;
        const bool HighDetail = Generated && (Mask & 4) != 0;
        const FString Folder = Mask == 15 ? PilotFolder : Style != 9 ? ProductionFolder
            : HighDetail ? TEXT("/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9/")
            : Generated ? TEXT("/Game/ParkComic/CrewGraphicNovelGenerated/Resident9/")
            : Candidate ? TEXT("/Game/ParkComic/CrewGraphicNovel/Resident9/") : ProductionFolder;
        TestTrue(FString::Printf(TEXT("Flag combination %d selects only its complete opt-in level"), Mask),
            Mesh->GetSkeletalMeshAsset() && Mesh->GetSkeletalMeshAsset()->GetPathName() == Folder + TEXT("SK_Body.SK_Body"));
        if (Mask != 15)
        {
            TestTrue(TEXT("Non-Tripo appearances restore the original mesh orientation"), Mesh->GetRelativeRotation().IsNearlyZero());
            TestEqual(TEXT("Non-Tripo appearance restores the production attachment"), Character->CrewProp->GetAttachSocketName(), FName(TEXT("RightHand")));
            TestTrue(TEXT("Non-Tripo appearance restores absolute prop rotation"), Character->CrewProp->IsUsingAbsoluteRotation());
        }
    }
    if (!TestEqual(TEXT("All four flags select the actual isolated Tripo mesh"), Mesh->GetSkeletalMeshAsset(), Pilot)) return false;
    const FBox BodyBounds = Pilot->GetBounds().GetBox().TransformBy(Mesh->GetComponentTransform());
    TestTrue(TEXT("The actual native body is 182 cm tall within 0.1 cm"), FMath::IsNearlyEqual(BodyBounds.GetSize().Z, 182., .1));
    const double GroundZ = Character->GetActorLocation().Z - Character->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
    TestTrue(TEXT("The actual native feet meet the capsule ground within 0.1 cm"), FMath::IsNearlyEqual(BodyBounds.Min.Z, GroundZ, .1));
    const FReferenceSkeleton& Reference = Pilot->GetRefSkeleton();
    TMap<FName, FName> Parents = {{TEXT("root"), NAME_None}, {TEXT("pelvis"), TEXT("root")},
        {TEXT("spine_01"), TEXT("pelvis")}, {TEXT("spine_02"), TEXT("spine_01")},
        {TEXT("spine_03"), TEXT("spine_02")}, {TEXT("neck_01"), TEXT("spine_03")}, {TEXT("head"), TEXT("neck_01")}};
    TArray<FName> Fingers;
    for (const TCHAR* Side : {TEXT("l"), TEXT("r")})
    {
        const auto Bone = [Side](const TCHAR* Name) { return FName(*FString::Printf(TEXT("%s_%s"), Name, Side)); };
        Parents.Add(Bone(TEXT("clavicle")), TEXT("spine_03"));
        Parents.Add(Bone(TEXT("upperarm")), Bone(TEXT("clavicle")));
        Parents.Add(Bone(TEXT("lowerarm")), Bone(TEXT("upperarm")));
        Parents.Add(Bone(TEXT("hand")), Bone(TEXT("lowerarm")));
        Parents.Add(Bone(TEXT("upperarm_twist_01")), Bone(TEXT("upperarm")));
        Parents.Add(Bone(TEXT("lowerarm_twist_01")), Bone(TEXT("lowerarm")));
        Parents.Add(Bone(TEXT("thigh")), TEXT("pelvis"));
        Parents.Add(Bone(TEXT("calf")), Bone(TEXT("thigh")));
        Parents.Add(Bone(TEXT("foot")), Bone(TEXT("calf")));
        Parents.Add(Bone(TEXT("ball")), Bone(TEXT("foot")));
        Parents.Add(Bone(TEXT("thigh_twist_01")), Bone(TEXT("thigh")));
        Parents.Add(Bone(TEXT("calf_twist_01")), Bone(TEXT("calf")));
        for (const TCHAR* Digit : {TEXT("thumb"), TEXT("index"), TEXT("middle"), TEXT("ring"), TEXT("pinky")})
            for (int32 Joint = 1; Joint <= 3; ++Joint)
            {
                const FName Name(*FString::Printf(TEXT("%s_%02d_%s"), Digit, Joint, Side));
                const FName Parent = Joint == 1 ? Bone(TEXT("hand"))
                    : FName(*FString::Printf(TEXT("%s_%02d_%s"), Digit, Joint - 1, Side));
                Fingers.Add(Name);
                Parents.Add(Name, Parent);
            }
    }
    TestEqual(TEXT("Expected provider hierarchy has all 61 bones"), Parents.Num(), 61);
    if (!TestTrue(TEXT("Native hierarchy contains only 61 provider bones plus an optional FBX Armature wrapper"),
        Reference.GetNum() == 61 || (Reference.GetNum() == 62 && Reference.GetBoneName(0) == FName(TEXT("Armature"))))) return false;
    for (const TPair<FName, FName>& Pair : Parents)
    {
        const int32 Index = Reference.FindBoneIndex(Pair.Key);
        if (!TestTrue(FString::Printf(TEXT("Actual provider bone %s exists"), *Pair.Key.ToString()), Index != INDEX_NONE)) return false;
        const int32 Parent = Reference.GetParentIndex(Index);
        const FName Actual = Parent == INDEX_NONE ? NAME_None : Reference.GetBoneName(Parent);
        const FName Expected = Pair.Key == TEXT("root") && Reference.GetNum() == 62 ? FName(TEXT("Armature")) : Pair.Value;
        TestEqual(FString::Printf(TEXT("Provider parent of %s is preserved"), *Pair.Key.ToString()), Actual, Expected);
    }
    UAnimSequence* Clips[] = {Character->CrewIdle, Character->CrewWalk, Character->CrewRun, Character->CrewJump};
    const TCHAR* Kinds[] = {TEXT("Idle"), TEXT("Walk"), TEXT("Run"), TEXT("Jump")};
    const float Lengths[] = {4.f, 31.f / 30.f, 19.f / 30.f, 1.2f};
    for (int32 Index = 0; Index < 4; ++Index)
    {
        if (!TestNotNull(TEXT("Mandatory actual own Tripo clip"), Clips[Index])) return false;
        TestTrue(TEXT("Every clip uses the isolated own rig and disables root motion"),
            Clips[Index]->GetPathName() == PilotFolder + FString::Printf(TEXT("A_%s.A_%s"), Kinds[Index], Kinds[Index]) &&
            Clips[Index]->GetSkeleton() == Pilot->GetSkeleton() && !Clips[Index]->HasRootMotion());
        TestTrue(TEXT("Native imports retain the authored gait/idle/jump durations"), FMath::IsNearlyEqual(Clips[Index]->GetPlayLength(), Lengths[Index], .002f));
    }
    UBlendSpace* Space = Character->CrewLocomotion;
    if (!TestNotNull(TEXT("Mandatory saved Tripo BlendSpace"), Space)) return false;
    TestTrue(TEXT("Tripo uses its own saved graph and skeleton"), Space->GetPathName() == PilotFolder + TEXT("BS_Locomotion.BS_Locomotion") &&
        Space->GetSkeleton() == Pilot->GetSkeleton());
    if (!TestEqual(TEXT("Tripo graph has three locomotion samples"), Space->GetBlendSamples().Num(), 3)) return false;
    for (int32 Index = 0; Index < 3; ++Index)
        TestEqual(TEXT("Each graph sample belongs to this own rig"), Space->GetBlendSample(Index).Animation.Get(), Clips[Index]);
    UQuebecCrewAnimInstance* Animation = Cast<UQuebecCrewAnimInstance>(Mesh->GetAnimInstance());
    if (!TestNotNull(TEXT("Actual native blended Tripo AnimInstance"), Animation)) return false;
    Animation->bUseMultiThreadedAnimationUpdate = false;
    Mesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
    Mesh->bEnableUpdateRateOptimizations = false;
    UCharacterMovementComponent* Movement = Character->GetCharacterMovement();
    const FVector Origin = Character->GetActorLocation();
    const FName GripName(TEXT("TripoGrip"));
    const USkeletalMeshSocket* Grip = Pilot->FindSocket(GripName);
    if (!TestNotNull(TEXT("Actual new native grip socket"), Grip)) return false;
    TestEqual(TEXT("Grip socket belongs to the native right hand"), Grip->BoneName, FName(TEXT("hand_r")));
    TestEqual(TEXT("Tripo prop attaches to its own grip socket"), Character->CrewProp->GetAttachSocketName(), GripName);
    TestFalse(TEXT("Tripo prop inherits its animated hand rotation"), Character->CrewProp->IsUsingAbsoluteRotation());
    TestTrue(TEXT("Tripo prop uses the socket calibration without a second offset"), Character->CrewProp->GetRelativeTransform().Equals(FTransform::Identity, .0001f));
    UStaticMesh* Prop = Character->CrewProp->GetStaticMesh();
    if (!TestNotNull(TEXT("Mandatory actual held prop"), Prop)) return false;
    TestEqual(TEXT("Each crew uses its intended actual prop"), Prop->GetPathName(), Style == 8
        ? FString(TEXT("/Game/ParkComic/Crew/SM_PVCTube.SM_PVCTube")) : FString(TEXT("/Game/ParkComic/Crew/SM_Plunger.SM_Plunger")));
    const auto CheckProp = [&]()
    {
        Character->CrewProp->UpdateComponentToWorld();
        const FTransform Expected = Grip->GetSocketLocalTransform() * Mesh->GetSocketTransform(TEXT("hand_r"), RTS_World);
        TestTrue(TEXT("Native prop position, rotation and scale follow the actual evaluated hand"),
            Character->CrewProp->GetComponentTransform().Equals(Expected, .01f));
        const FVector Size = Prop->GetBoundingBox().GetSize() * Character->CrewProp->GetComponentScale().GetAbs();
        TestTrue(FString::Printf(TEXT("The hand-following prop retains intended centimeters style=%d clip=%s width=%.9f length=%.9f"),
                Style, *GetNameSafe(Animation->ObservedClip), FMath::Max(Size.X, Size.Y), Size.Z),
            FMath::IsNearlyEqual(FMath::Max(Size.X, Size.Y), Style == 8 ? 6.6 : 16., .01) &&
            FMath::IsNearlyEqual(Size.Z, Style == 8 ? 90. : 55., .01));
    };
    const auto Advance = [Mesh, Movement](int32 Frames, float Speed, float Vertical = 0.f, bool Falling = false)
    {
        Movement->SetMovementMode(Falling ? MOVE_Falling : MOVE_Walking);
        Movement->Velocity = FVector(Speed, 0.f, Vertical);
        for (int32 Frame = 0; Frame < Frames; ++Frame)
        {
            Mesh->TickAnimation(1.f / 60.f, false);
            Mesh->RefreshBoneTransforms();
        }
    };
    const auto CheckOwnPose = [&](UAnimSequence* Clip)
    {
        TestTrue(TEXT("In-place own clips retain the static root reference transform, including jump scale"),
            Mesh->GetSocketTransform(Reference.GetBoneName(0), RTS_ParentBoneSpace).Equals(Reference.GetRefBonePose()[0], .0001f));
        FMemMark Mark(FMemStack::Get());
        const FBoneContainer& Required = Animation->GetRequiredBones();
        FCompactPose Pose;
        Pose.SetBoneContainer(&Required);
        FBlendedCurve Curve;
        Curve.InitFrom(Required);
        UE::Anim::FStackAttributeContainer Attributes;
        FAnimationPoseData Data(Pose, Curve, Attributes);
        Clip->GetAnimationPose(Data, FAnimExtractContext(Animation->ObservedClipTime, false, {}, true));
        for (const TPair<FName, FName>& Pair : Parents)
        {
            const int32 Index = Clip->GetSkeleton()->GetReferenceSkeleton().FindBoneIndex(Pair.Key);
            if (!TestTrue(TEXT("The actual clip contains each provider bone"), Index != INDEX_NONE)) continue;
            const FCompactPoseBoneIndex Compact = Required.GetCompactPoseIndexFromSkeletonPoseIndex(FSkeletonPoseBoneIndex(Index));
            if (!TestTrue(TEXT("The native graph requires each provider bone"), Compact.GetInt() != INDEX_NONE)) continue;
            const FTransform Actual = Mesh->GetSocketTransform(Pair.Key, RTS_ParentBoneSpace);
            TestTrue(FString::Printf(TEXT("Native %s evaluates the own clip's actual %s local pose"), *Clip->GetName(), *Pair.Key.ToString()),
                Actual.Equals(Pose[Compact], .01f));
        }
        TestEqual(TEXT("Tripo fingers come from real authored tracks, without unrelated GN procedural controls"), Animation->ObservedFingerControlCount, 0);
        int32 Curled = 0;
        for (FName Name : Fingers)
        {
            const int32 Index = Reference.FindBoneIndex(Name);
            const FQuat Actual = Mesh->GetSocketTransform(Name, RTS_ParentBoneSpace).GetRotation();
            if (Actual.AngularDistance(Reference.GetRefBonePose()[Index].GetRotation()) > FMath::DegreesToRadians(1.f)) ++Curled;
        }
        TestEqual(TEXT("All 30 actual native finger locals remain loose rather than bind-straight"), Curled, 30);
        CheckProp();
    };
    Advance(30, 0.f);
    TestTrue(TEXT("Tripo idle reaches its real own clip"), Animation->ObservedIdleWeight > .99f && Animation->ObservedClip == Clips[0]);
    CheckOwnPose(Clips[0]);
    FVector ToeForward = FVector::ZeroVector;
    for (const TCHAR* Side : {TEXT("l"), TEXT("r")})
        ToeForward += Mesh->GetSocketLocation(FName(*FString::Printf(TEXT("ball_%s"), Side))) -
            Mesh->GetSocketLocation(FName(*FString::Printf(TEXT("foot_%s"), Side)));
    TestTrue(TEXT("Actual evaluated feet face the native forward movement direction"),
        FVector::DotProduct(ToeForward.GetSafeNormal2D(), Character->GetActorForwardVector()) > .98);
    const FQuat IdleKnee = Mesh->GetSocketTransform(TEXT("calf_l"), RTS_Component).GetRotation();
    const FTransform IdleProp = Character->CrewProp->GetComponentTransform();
    Advance(1, 450.f);
    TestTrue(TEXT("Starting moves through an actual idle/walk crossfade"), Animation->ObservedIdleWeight > 0.f && Animation->ObservedWalkWeight > 0.f);
    Advance(30, 450.f);
    TestTrue(TEXT("Tripo walk reaches its real own clip"), Animation->ObservedWalkWeight > .99f && Animation->ObservedClip == Clips[1]);
    CheckOwnPose(Clips[1]);
    const FVector Foot = Mesh->GetSocketTransform(TEXT("foot_l"), RTS_Component).GetTranslation();
    const float WalkTime = Animation->ObservedClipTime;
    Advance(1, 450.f);
    TestTrue(TEXT("Tripo walk advances time and real foot pose"), Animation->ObservedClipTime != WalkTime &&
        !Mesh->GetSocketTransform(TEXT("foot_l"), RTS_Component).GetTranslation().Equals(Foot, .0001f));
    Advance(30, 625.f);
    TestTrue(TEXT("Intermediate speed blends actual walk and run"), Animation->ObservedWalkWeight > .4f && Animation->ObservedRunWeight > .4f);
    Advance(30, 800.f);
    TestTrue(TEXT("Tripo sprint reaches its real own clip"), Animation->ObservedRunWeight > .99f && Animation->ObservedClip == Clips[2]);
    CheckOwnPose(Clips[2]);
    TestFalse(TEXT("Prop follows changing hand motion rather than remaining at idle"), Character->CrewProp->GetComponentTransform().Equals(IdleProp, .01f));
    Advance(1, 0.f);
    TestTrue(TEXT("Stopping preserves ground crossfade weights"), Animation->ObservedIdleWeight < .99f && Animation->ObservedRunWeight > 0.f);
    Advance(30, 0.f);
    TestTrue(TEXT("Tripo stopping settles to idle"), Animation->ObservedIdleWeight > .99f);
    Advance(1, 0.f, 600.f, true);
    TestTrue(TEXT("Takeoff begins with an actual jump crossfade"), Animation->ObservedJumpWeight > 0.f && Animation->ObservedJumpWeight < 1.f);
    Advance(12, 0.f, 600.f, true);
    TestTrue(TEXT("Airborne reaches the own jump clip and rising phase"), Animation->ObservedJumpWeight > .99f && Animation->ObservedClip == Clips[3] &&
        FMath::IsNearlyEqual(Animation->ObservedClipTime, .23f / 1.2f * Clips[3]->GetPlayLength(), .002f));
    Advance(1, 0.f, 0.f, true);
    TestTrue(TEXT("Apex selects the authored own jump phase"), FMath::IsNearlyEqual(Animation->ObservedClipTime, .47f / 1.2f * Clips[3]->GetPlayLength(), .002f));
    TestTrue(TEXT("Apex bends the actual native knee"), Mesh->GetSocketTransform(TEXT("calf_l"), RTS_Component).GetRotation().AngularDistance(IdleKnee) > .3f);
    CheckOwnPose(Clips[3]);
    Advance(1, 0.f, -600.f, true);
    TestTrue(TEXT("Descent selects the own descent phase"), FMath::IsNearlyEqual(Animation->ObservedClipTime, .73f / 1.2f * Clips[3]->GetPlayLength(), .002f));
    Advance(1, 0.f);
    TestTrue(TEXT("First grounded frame retains actual landing recoil"), Animation->ObservedJumpWeight > .99f && Animation->ObservedLandingSeconds < .03f &&
        Animation->ObservedClipTime >= .93f / 1.2f * Clips[3]->GetPlayLength());
    Advance(18, 0.f);
    TestTrue(TEXT("Landing recoil crossfades back toward ground motion"), Animation->ObservedJumpWeight > 0.f && Animation->ObservedJumpWeight < 1.f);
    Advance(15, 0.f);
    TestTrue(TEXT("Landing returns to the actual own idle"), Animation->ObservedIdleWeight > .99f && Animation->ObservedClip == Clips[0]);
    CheckOwnPose(Clips[0]);
    TestEqual(TEXT("Own animation never displaces the native capsule"), Character->GetActorLocation(), Origin);
    Character->CycleCrew();
    if (Style == 9)
    {
        TestEqual(TEXT("Crew cycling leaves Tripo style 9 normally"), Character->CrewStyle, 10);
        TestTrue(TEXT("Other crew retain production bodies with all pilot flags present"),
            Mesh->GetSkeletalMeshAsset() && Mesh->GetSkeletalMeshAsset()->GetPathName().Contains(TEXT("/Crew/Resident10/SK_Body")));
        TestEqual(TEXT("Cycling restores the production hand attachment"), Character->CrewProp->GetAttachSocketName(), FName(TEXT("RightHand")));
        TestTrue(TEXT("Cycling restores production absolute rotation"), Character->CrewProp->IsUsingAbsoluteRotation());
        TestTrue(TEXT("Returning to crew 9 selects the private Tripo candidate again"), Character->ChooseCrew(9) && Mesh->GetSkeletalMeshAsset() == Pilot);
    }
    else
    {
        TestEqual(TEXT("Crew cycling selects the next style"), Character->CrewStyle, Style + 1);
        const FString NextFolder = FString::Printf(TEXT("/Game/ParkComic/CrewGraphicNovelTripo/Resident%d/"), Style + 1);
        USkeletalMesh* Next = Mesh->GetSkeletalMeshAsset();
        if (!TestNotNull(TEXT("Cycling selects an actual next crew mesh"), Next)) return false;
        TestEqual(TEXT("Cycling selects the next crew's own Tripo body"), Next->GetPathName(), NextFolder + TEXT("SK_Body.SK_Body"));
        TestTrue(TEXT("Cycling selects the next crew's separate skeleton"), Next->GetSkeleton() &&
            Next->GetSkeleton() != Pilot->GetSkeleton() && Next->GetSkeleton()->GetPathName().StartsWith(NextFolder));
        const USkeletalMeshSocket* NextGrip = Next->FindSocket(GripName);
        if (!TestNotNull(TEXT("The next crew has its own native grip"), NextGrip)) return false;
        TestEqual(TEXT("The next grip belongs to its own hand"), NextGrip->BoneName, FName(TEXT("hand_r")));
        TestEqual(TEXT("Cycling uses the next own grip attachment"), Character->CrewProp->GetAttachSocketName(), GripName);
        TestFalse(TEXT("Cycling retains animated hand rotation"), Character->CrewProp->IsUsingAbsoluteRotation());
        TestTrue(TEXT("Returning to this crew restores its own Tripo candidate"), Character->ChooseCrew(Style) && Mesh->GetSkeletalMeshAsset() == Pilot);
    }
    FCommandLine::Set(*DefaultCommandLine);
    Character->ApplyCrewAppearance();
    TestEqual(TEXT("Removing the opt-in flags restores the original production mesh"), Mesh->GetSkeletalMeshAsset(), Production);
    TestEqual(TEXT("Removing flags restores the original prop attachment"), Character->CrewProp->GetAttachSocketName(), FName(TEXT("RightHand")));
    TestTrue(TEXT("Removing flags restores absolute prop rotation and identity relative offset"), Character->CrewProp->IsUsingAbsoluteRotation() &&
        Character->CrewProp->GetRelativeTransform().Equals(FTransform::Identity, .0001f));
    if (!HasAnyErrors())
    {
        if (Style == 9) AddInfo(TEXT("NORD_TRIPO_NATIVE_CHECKED flags=16 providerBones=61 ownClips=4 authoredFingers=30 proceduralFingers=0 locomotionJumpLanding=1 socketHandFollow=1 crewRestore=1"));
        else AddInfo(FString::Printf(TEXT("NORD_TRIPO_CAST_NATIVE_CHECKED style=%d flags=16 heightCm=182 grounded=1 providerBones=61 ownClips=4 authoredFingers=30 proceduralFingers=0 locomotionJumpLanding=1 socketHandFollow=1 crewRestore=1"), Style));
    }
    return !HasAnyErrors();
}
#endif
