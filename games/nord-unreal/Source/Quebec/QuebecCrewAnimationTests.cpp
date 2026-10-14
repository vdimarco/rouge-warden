#include "QuebecCrewAnimation.h"
#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS && WITH_EDITOR
#include "Animation/AnimSequence.h"
#include "Animation/AnimSingleNodeInstance.h"
#include "Animation/Skeleton.h"
#include "Animation/AnimationPoseData.h"
#include "Animation/AnimCurveTypes.h"
#include "Animation/AttributesRuntime.h"
#include "BonePose.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "Engine/SkeletalMesh.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Misc/AutomationTest.h"
#include "Misc/CommandLine.h"
#include "Misc/ScopeExit.h"
#include "Misc/MemStack.h"
#include "Materials/MaterialInterface.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCrewAnimationTest, "Quebec.Animation.BlendedLocomotion",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCrewAnimationTest::RunTest(const FString& Parameters)
{
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated animation world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecCharacter* Character = World->SpawnActor<AQuebecCharacter>();
    if (!TestNotNull(TEXT("Native crew character"), Character)) return false;
    Character->SetActorEnableCollision(false);
    World->InitializeActorsForPlay(FURL());
    Character->ApplyCrewAppearance();
    if (!TestNotNull(TEXT("Own idle clip"), Character->CrewIdle.Get()) || !TestNotNull(TEXT("Own walk clip"), Character->CrewWalk.Get()) ||
        !TestNotNull(TEXT("Own run clip"), Character->CrewRun.Get()) || !TestNotNull(TEXT("Own jump clip"), Character->CrewJump.Get())) return false;
    UBlendSpace1D* Space = NewObject<UBlendSpace1D>();
    Space->SetSkeleton(Character->CrewIdle->GetSkeleton());
    if (!TestTrue(TEXT("Transient engine BlendSpace authored from own production clips"),
        UQuebecCrewAnimInstance::ConfigureCrewBlendSpace(Space, Character->CrewIdle, Character->CrewWalk, Character->CrewRun))) return false;
    TestEqual(TEXT("Idle/Walk/Run samples"), Space->GetBlendSamples().Num(), 3);
    TestEqual(TEXT("Walk preserves authored cadence multiplier"), Space->GetBlendSample(1).RateScale, 2.f);
    TestEqual(TEXT("Run preserves authored cadence multiplier"), Space->GetBlendSample(2).RateScale, 800.f / 600.f);
    UAnimSequence* OtherIdle = LoadObject<UAnimSequence>(nullptr, TEXT("/Game/ParkComic/Crew/Resident8/A_Idle.A_Idle"));
    if (!TestNotNull(TEXT("Other rig's retained clip"), OtherIdle)) return false;
    TestFalse(TEXT("Reject another body's rig before replacing samples"), UQuebecCrewAnimInstance::ConfigureCrewBlendSpace(Space, OtherIdle, Character->CrewWalk, Character->CrewRun));
    TestEqual(TEXT("Invalid authoring preserves all existing samples"), Space->GetBlendSamples().Num(), 3);
    TestTrue(TEXT("Invalid authoring preserves original idle"), Space->GetBlendSample(0).Animation == Character->CrewIdle);
    Character->CrewLocomotion = Space;
    if (!TestTrue(TEXT("Native character selects the standard blended graph"), Character->ConfigureCrewAnimation())) return false;
    USkeletalMeshComponent* Mesh = Character->GetMesh();
    UQuebecCrewAnimInstance* Animation = Cast<UQuebecCrewAnimInstance>(Mesh->GetAnimInstance());
    if (!TestNotNull(TEXT("Crew AnimInstance"), Animation)) return false;
    Animation->bUseMultiThreadedAnimationUpdate = false;
    Mesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
    Mesh->bEnableUpdateRateOptimizations = false;
    UCharacterMovementComponent* Movement = Character->GetCharacterMovement();
    const FVector Origin = Character->GetActorLocation();
    const auto Advance = [Mesh, Movement](int32 Frames, float Speed, float Vertical = 0.f, bool bFalling = false)
    {
        Movement->SetMovementMode(bFalling ? MOVE_Falling : MOVE_Walking);
        Movement->Velocity = FVector(Speed, 0.f, Vertical);
        for (int32 Frame = 0; Frame < Frames; ++Frame)
        {
            Mesh->TickAnimation(1.f / 60.f, false);
            Mesh->RefreshBoneTransforms();
        }
    };
    Advance(30, 0.f);
    TestTrue(TEXT("Idle is the actual dominant graph clip"), Animation->ObservedClip == Character->CrewIdle);
    TestTrue(TEXT("Idle graph contribution reaches full weight"), Animation->ObservedIdleWeight > .99f);
    const FQuat IdleKnee = Mesh->GetSocketTransform(TEXT("LeftLeg"), RTS_Component).GetRotation();
    Advance(1, 450.f);
    TestTrue(TEXT("Starting movement blends idle and walk without a clip reset"), Animation->ObservedIdleWeight > 0.f && Animation->ObservedWalkWeight > 0.f);
    Advance(30, 450.f);
    TestTrue(TEXT("Steady walk reaches its actual sample"), Animation->ObservedWalkWeight > .99f && Animation->ObservedClip == Character->CrewWalk);
    const float WalkTime = Animation->ObservedClipTime;
    const FVector Foot = Mesh->GetSocketTransform(TEXT("LeftFoot"), RTS_Component).GetTranslation();
    Advance(1, 450.f);
    TestTrue(TEXT("Steady walk phase advances each animation frame"), Animation->ObservedClipTime != WalkTime);
    TestTrue(TEXT("The engine graph evaluates a new foot pose"), !Mesh->GetSocketTransform(TEXT("LeftFoot"), RTS_Component).GetTranslation().Equals(Foot, .0001));
    Advance(30, 625.f);
    TestTrue(TEXT("Intermediate sprint speed blends walk and run"), Animation->ObservedWalkWeight > .4f && Animation->ObservedRunWeight > .4f);
    Advance(30, 800.f);
    TestTrue(TEXT("Steady sprint reaches run"), Animation->ObservedRunWeight > .99f && Animation->ObservedClip == Character->CrewRun);
    Advance(1, 0.f);
    TestTrue(TEXT("Stopping retains intermediate ground weights"), Animation->ObservedIdleWeight < .99f && Animation->ObservedRunWeight > 0.f);
    Advance(30, 0.f);
    TestTrue(TEXT("Stopping settles to idle"), Animation->ObservedIdleWeight > .99f);
    Advance(1, 0.f, 600.f, true);
    TestTrue(TEXT("Jump begins with an engine crossfade"), Animation->ObservedJumpWeight > 0.f && Animation->ObservedJumpWeight < 1.f);
    Advance(12, 0.f, 600.f, true);
    TestTrue(TEXT("Airborne reaches jump pose"), Animation->ObservedJumpWeight > .99f && Animation->ObservedClip == Character->CrewJump);
    TestTrue(TEXT("Takeoff uses the authored rising phase"), FMath::IsNearlyEqual(Animation->ObservedClipTime, .23f / 1.2f * Character->CrewJump->GetPlayLength(), .002f));
    Advance(1, 0.f, 0.f, true);
    TestTrue(TEXT("Apex uses the authored knee tuck"), FMath::IsNearlyEqual(Animation->ObservedClipTime, .47f / 1.2f * Character->CrewJump->GetPlayLength(), .002f));
    TestTrue(TEXT("Apex evaluates an actual bent knee, not only jump metadata"),
        Mesh->GetSocketTransform(TEXT("LeftLeg"), RTS_Component).GetRotation().AngularDistance(IdleKnee) > .6f);
    {
        FMemMark Mark(FMemStack::Get());
        const FBoneContainer& RequiredBones = Animation->GetRequiredBones();
        FCompactPose SourcePose;
        SourcePose.SetBoneContainer(&RequiredBones);
        FBlendedCurve SourceCurve;
        SourceCurve.InitFrom(RequiredBones);
        UE::Anim::FStackAttributeContainer SourceAttributes;
        FAnimationPoseData SourceData(SourcePose, SourceCurve, SourceAttributes);
        Character->CrewJump->GetAnimationPose(SourceData, FAnimExtractContext(Animation->ObservedClipTime, false));
        const int32 Index = Character->CrewJump->GetSkeleton()->GetReferenceSkeleton().FindBoneIndex(TEXT("LeftLeg"));
        const FCompactPoseBoneIndex KneeIndex = RequiredBones.GetCompactPoseIndexFromSkeletonPoseIndex(FSkeletonPoseBoneIndex(Index));
        if (TestTrue(TEXT("Authored jump knee is required"), KneeIndex.GetInt() != INDEX_NONE))
        {
            const FTransform Expected = SourcePose[KneeIndex], Actual = Mesh->GetSocketTransform(TEXT("LeftLeg"), RTS_ParentBoneSpace);
            TestTrue(FString::Printf(TEXT("Evaluated apex knee matches the engine's full A_Jump pose; expected={%s} observed={%s}"),
                *Expected.ToString(), *Actual.ToString()), Actual.Equals(Expected, .01f));
        }
    }
    Advance(1, 0.f, -600.f, true);
    TestTrue(TEXT("Descent advances to the authored descent phase"), FMath::IsNearlyEqual(Animation->ObservedClipTime, .73f / 1.2f * Character->CrewJump->GetPlayLength(), .002f));
    Advance(1, 0.f);
    TestTrue(TEXT("First grounded frame preserves landing recoil"), Animation->ObservedJumpWeight > .99f && Animation->ObservedLandingSeconds < .03f);
    TestTrue(TEXT("Landing evaluates the recoil segment"), Animation->ObservedClipTime >= .93f / 1.2f * Character->CrewJump->GetPlayLength());
    Advance(18, 0.f);
    TestTrue(TEXT("Recoil blends back into ground motion"), Animation->ObservedJumpWeight > 0.f && Animation->ObservedJumpWeight < 1.f);
    Advance(15, 0.f);
    TestTrue(TEXT("Landing returns to idle"), Animation->ObservedIdleWeight > .99f && Animation->ObservedClip == Character->CrewIdle);
    TestEqual(TEXT("Animation graph never moves the native capsule"), Character->GetActorLocation(), Origin);
    TestFalse(TEXT("Wrong-rig jump is rejected"), Animation->SetAssets(Space, OtherIdle));
    TestTrue(TEXT("Rejected jump preserves current assets"), Animation->JumpAsset == Character->CrewJump);
    TestTrue(TEXT("Crew selection still works after blended playback"), Character->ChooseCrew(8));
    TestTrue(TEXT("Unmigrated production style retains SingleNode fallback"), Mesh->GetAnimInstance()->IsA<UAnimSingleNodeInstance>());
    TestNotNull(TEXT("Crew switching preserves its carried prop"), Character->CrewProp->GetStaticMesh().Get());
    return !HasAnyErrors();
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecGraphicNovelControlsTest, "Quebec.Animation.GraphicNovelHandsEyes",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecGraphicNovelControlsTest::RunTest(const FString& Parameters)
{
    const FString Folder = TEXT("/Game/ParkComic/CrewGraphicNovel/Resident9/");
    USkeletalMesh* Body = LoadObject<USkeletalMesh>(nullptr, *(Folder + TEXT("SK_Body.SK_Body")), nullptr, LOAD_NoWarn | LOAD_Quiet);
    if (!Body)
    {
        AddWarning(TEXT("NORD_GRAPHIC_NOVEL_CONTROLS_SKIPPED: candidate body has not been imported; no hand/eye acceptance"));
        return true;
    }
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated pilot animation world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecCharacter* Character = World->SpawnActor<AQuebecCharacter>();
    if (!TestNotNull(TEXT("Native pilot character"), Character)) return false;
    World->InitializeActorsForPlay(FURL());
    USkeletalMeshComponent* Mesh = Character->GetMesh();
    Mesh->SetSkeletalMesh(Body);
    Character->CrewIdle = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Idle.A_Idle")));
    Character->CrewWalk = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Walk.A_Walk")));
    Character->CrewRun = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Run.A_Run")));
    Character->CrewJump = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Jump.A_Jump")));
    Character->CrewLocomotion = LoadObject<UBlendSpace>(nullptr, *(Folder + TEXT("BS_Locomotion.BS_Locomotion")));
    if (!TestTrue(TEXT("Candidate own rig, clips and authored BlendSpace configure"), Character->ConfigureCrewAnimation())) return false;
    UQuebecCrewAnimInstance* Animation = Cast<UQuebecCrewAnimInstance>(Mesh->GetAnimInstance());
    if (!TestNotNull(TEXT("Pilot blended AnimInstance"), Animation)) return false;
    Animation->bUseMultiThreadedAnimationUpdate = false;
    Mesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
    Mesh->bEnableUpdateRateOptimizations = false;
    const auto Advance = [Character, Mesh](int32 Frames, float Speed)
    {
        Character->GetCharacterMovement()->SetMovementMode(MOVE_Walking);
        Character->GetCharacterMovement()->Velocity = FVector(Speed, 0.f, 0.f);
        for (int32 Frame = 0; Frame < Frames; ++Frame)
        {
            Mesh->TickAnimation(1.f / 60.f, false);
            Mesh->RefreshBoneTransforms();
        }
    };
    const auto LocalBone = [Mesh](FName Name)
    {
        const int32 Index = Mesh->GetBoneIndex(Name);
        const FName Parent = Mesh->GetBoneName(Mesh->GetSkeletalMeshAsset()->GetRefSkeleton().GetParentIndex(Index));
        return Mesh->GetSocketTransform(Name, RTS_Component).GetRelativeTransform(Mesh->GetSocketTransform(Parent, RTS_Component));
    };
    Advance(40, 0.f);
    if (!TestEqual(TEXT("All twenty actual finger controls are present"), Animation->ObservedFingerControlCount, 20)) return false;
    TestNotNull(TEXT("Accepted left squint morph exists"), Body->FindMorphTarget(TEXT("GN_EyeNarrow_L")));
    TestNotNull(TEXT("Accepted right squint morph exists"), Body->FindMorphTarget(TEXT("GN_EyeNarrow_R")));
    const FName Finger = TEXT("GN_Left_Index1");
    const FQuat BindFinger = Body->GetRefSkeleton().GetRefBonePose()[Mesh->GetBoneIndex(Finger)].GetRotation();
    const FQuat IdleFinger = LocalBone(Finger).GetRotation();
    const float IdleFlex = FMath::RadiansToDegrees(IdleFinger.AngularDistance(BindFinger));
    TestTrue(TEXT("Idle evaluates a restrained real finger flex"), FMath::IsNearlyEqual(IdleFlex, 4.f, .05f));
    TestTrue(TEXT("Idle leaves accepted eyes open"), Mesh->GetMorphTarget(TEXT("GN_EyeNarrow_L")) < .001f && Mesh->GetMorphTarget(TEXT("GN_EyeNarrow_R")) < .001f);
    Advance(1, 800.f);
    const FQuat FirstRunFinger = LocalBone(Finger).GetRotation();
    Advance(1, 800.f);
    TestTrue(TEXT("Finger effort changes continuously through the engine speed filter"),
        FMath::RadiansToDegrees(LocalBone(Finger).GetRotation().AngularDistance(FirstRunFinger)) < 1.5f);
    Advance(40, 800.f);
    const float RunFlex = FMath::RadiansToDegrees(LocalBone(Finger).GetRotation().AngularDistance(BindFinger));
    TestTrue(TEXT("Run modestly flexes actual finger bones further"), FMath::IsNearlyEqual(RunFlex, 10.f, .05f) && RunFlex > IdleFlex + 5.f);
    TestTrue(TEXT("Run drives the two accepted squints, not full closure"),
        FMath::IsNearlyEqual(Mesh->GetMorphTarget(TEXT("GN_EyeNarrow_L")), .35f, .002f) &&
        FMath::IsNearlyEqual(Mesh->GetMorphTarget(TEXT("GN_EyeNarrow_R")), .35f, .002f));
    {
        FMemMark Mark(FMemStack::Get());
        const FBoneContainer& RequiredBones = Animation->GetRequiredBones();
        FCompactPose SourcePose;
        SourcePose.SetBoneContainer(&RequiredBones);
        FBlendedCurve SourceCurve;
        SourceCurve.InitFrom(RequiredBones);
        UE::Anim::FStackAttributeContainer SourceAttributes;
        FAnimationPoseData SourceData(SourcePose, SourceCurve, SourceAttributes);
        // Match the engine graph's full pose extraction, including root locking and retargeting.
        const FAnimExtractContext Context(Animation->ObservedClipTime, false, {}, true);
        Character->CrewRun->GetAnimationPose(SourceData, Context);
        for (const FName Name : {FName(TEXT("Hips")), FName(TEXT("Head")), FName(TEXT("LeftLeg"))})
        {
            const int32 Index = Character->CrewRun->GetSkeleton()->GetReferenceSkeleton().FindBoneIndex(Name);
            const FCompactPoseBoneIndex CompactIndex = RequiredBones.GetCompactPoseIndexFromSkeletonPoseIndex(FSkeletonPoseBoneIndex(Index));
            if (!TestTrue(TEXT("Observed source body bone is required"), CompactIndex.GetInt() != INDEX_NONE)) continue;
            const FTransform Expected = SourcePose[CompactIndex], Actual = LocalBone(Name);
            if (Name == TEXT("Hips"))
            {
                FTransform Raw;
                Character->CrewRun->GetBoneTransform(Raw, FSkeletonPoseBoneIndex(Index), Context, false);
                AddInfo(FString::Printf(TEXT("NORD_PILOT_HIPS sourceIndex=%d root=%s forceRootLock=%d rootLock=%d time=%.6f rawTrack={%s} fullSourcePose={%s} graphObserved={%s}"),
                    Index, *Body->GetRefSkeleton().GetBoneName(0).ToString(), Character->CrewRun->bForceRootLock,
                    int32(Character->CrewRun->RootMotionRootLock), Animation->ObservedClipTime, *Raw.ToString(), *Expected.ToString(), *Actual.ToString()));
            }
            TestTrue(FString::Printf(TEXT("Finger controls preserve the source run's %s local body pose; expected={%s} observed={%s}"),
                *Name.ToString(), *Expected.ToString(), *Actual.ToString()), Actual.Equals(Expected, .01f));
        }
    }
    Advance(40, 0.f);
    TestTrue(TEXT("Stopping releases the squint"), Mesh->GetMorphTarget(TEXT("GN_EyeNarrow_L")) < .001f && Mesh->GetMorphTarget(TEXT("GN_EyeNarrow_R")) < .001f);
    TestTrue(TEXT("Stopping returns the real finger to its relaxed flex"),
        FMath::IsNearlyEqual(FMath::RadiansToDegrees(LocalBone(Finger).GetRotation().AngularDistance(BindFinger)), IdleFlex, .05f));
    if (!HasAnyErrors()) AddInfo(FString::Printf(TEXT("NORD_GRAPHIC_NOVEL_CONTROLS_CHECKED bones=20 idleFlex=%.3f runFlex=%.3f runSquint=.35 sourceBodyPreserved=1"), IdleFlex, RunFlex));
    return !HasAnyErrors();
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecGraphicNovelCandidateTest, "Quebec.Animation.GraphicNovelCandidateSelection",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecGraphicNovelCandidateTest::RunTest(const FString& Parameters)
{
    const FString OriginalCommandLine = FCommandLine::Get();
    const FString DefaultCommandLine = OriginalCommandLine.Replace(TEXT("-NordGraphicNovelCandidate"), TEXT(""), ESearchCase::IgnoreCase)
        .Replace(TEXT("-NordGraphicNovelGenerated"), TEXT(""), ESearchCase::IgnoreCase);
    FCommandLine::Set(*DefaultCommandLine);
    ON_SCOPE_EXIT { FCommandLine::Set(*OriginalCommandLine); };
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated candidate selection world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecCharacter* Character = World->SpawnActor<AQuebecCharacter>();
    AQuebecController* DefaultController = World->SpawnActor<AQuebecController>();
    if (!TestNotNull(TEXT("Selected character"), Character) || !TestNotNull(TEXT("Default local controller"), DefaultController)) return false;
    World->InitializeActorsForPlay(FURL());
    const auto ApplyAppearance = [Character]
    {
        Character->ProcessEvent(Character->FindFunctionChecked(TEXT("ApplyCrewAppearance")), nullptr);
    };
    ApplyAppearance();
    USkeletalMesh* DefaultBody = Character->GetMesh()->GetSkeletalMeshAsset();
    TestTrue(TEXT("Without the opt-in flag style 9 keeps the production body"),
        DefaultBody && DefaultBody->GetPathName().Contains(TEXT("/ParkComic/Crew/Resident9/SK_Body")));
    TestEqual(TEXT("Default crew retains stencil 255"), Character->GetMesh()->CustomDepthStencilValue, 255);
    DefaultController->ApplyComicStyle();
    TestTrue(TEXT("Default controller lazily loads the production ink"), DefaultController->ComicMaterial &&
        DefaultController->ComicMaterial->GetPathName() == TEXT("/Game/Art/Comic/M_ComicInk.M_ComicInk"));
    TestFalse(TEXT("The default view starts in standard mode"), DefaultController->IsComicStyle());
    FCommandLine::Set(*(DefaultCommandLine + TEXT(" -NordGraphicNovelGenerated")));
    ApplyAppearance();
    TestEqual(TEXT("Generated flag alone cannot replace the production body"), Character->GetMesh()->GetSkeletalMeshAsset(), DefaultBody);
    TestEqual(TEXT("Generated flag alone retains production stencil"), Character->GetMesh()->CustomDepthStencilValue, 255);

    USkeletalMesh* CandidateBody = LoadObject<USkeletalMesh>(nullptr,
        TEXT("/Game/ParkComic/CrewGraphicNovel/Resident9/SK_Body.SK_Body"), nullptr, LOAD_NoWarn | LOAD_Quiet);
    if (!CandidateBody)
    {
        AddWarning(TEXT("NORD_GRAPHIC_NOVEL_SELECTION_SKIPPED: candidate body has not been imported; default selection checked only"));
        return !HasAnyErrors();
    }
    FCommandLine::Set(*(DefaultCommandLine + TEXT(" -NordGraphicNovelCandidate")));
    ApplyAppearance();
    TestEqual(TEXT("Opt-in style 9 loads the actual native pilot body"), Character->GetMesh()->GetSkeletalMeshAsset(), CandidateBody);
    TestEqual(TEXT("Opt-in pilot uses the candidate ink stencil"), Character->GetMesh()->CustomDepthStencilValue, 254);
    if (!TestNotNull(TEXT("Opt-in pilot creates a live animation instance"), Character->GetMesh()->GetAnimInstance())) return false;
    TestTrue(TEXT("Opt-in pilot selects the engine blended graph without an override"), Character->GetMesh()->GetAnimInstance()->IsA<UQuebecCrewAnimInstance>());
    AQuebecController* CandidateController = World->SpawnActor<AQuebecController>();
    if (!TestNotNull(TEXT("Candidate local controller"), CandidateController)) return false;
    CandidateController->ApplyComicStyle();
    TestTrue(TEXT("Opt-in controller lazily loads the pilot ink"), CandidateController->ComicMaterial &&
        CandidateController->ComicMaterial->GetPathName() == TEXT("/Game/ParkComic/CrewGraphicNovel/Resident9/M_ComicInk.M_ComicInk"));
    TestFalse(TEXT("Opt-in view still starts in standard mode"), CandidateController->IsComicStyle());
    CandidateController->ToggleComicStyle();
    TestTrue(TEXT("F2 enables the candidate controller's private comic view"), CandidateController->IsComicStyle());
    TestFalse(TEXT("Another controller's view stays private"), DefaultController->IsComicStyle());
    CandidateController->ToggleComicStyle();
    TestFalse(TEXT("F2 returns the candidate view to standard mode"), CandidateController->IsComicStyle());
    const FString GeneratedFolder = TEXT("/Game/ParkComic/CrewGraphicNovelGenerated/Resident9/");
    USkeletalMesh* GeneratedBody = LoadObject<USkeletalMesh>(nullptr,
        *(GeneratedFolder + TEXT("SK_Body.SK_Body")), nullptr, LOAD_NoWarn | LOAD_Quiet);
    if (GeneratedBody)
    {
        FCommandLine::Set(*(DefaultCommandLine + TEXT(" -NordGraphicNovelCandidate -NordGraphicNovelGenerated")));
        ApplyAppearance();
        TestEqual(TEXT("Both flags select the isolated generated body"), Character->GetMesh()->GetSkeletalMeshAsset(), GeneratedBody);
        TestEqual(TEXT("Generated body reuses candidate stencil"), Character->GetMesh()->CustomDepthStencilValue, 254);
        UQuebecCrewAnimInstance* Animation = Cast<UQuebecCrewAnimInstance>(Character->GetMesh()->GetAnimInstance());
        if (!TestNotNull(TEXT("Generated body's native blended graph"), Animation)) return false;
        if (!TestNotNull(TEXT("Generated body's own locomotion asset"), Animation->LocomotionAsset.Get()) ||
            !TestNotNull(TEXT("Generated body's own jump asset"), Animation->JumpAsset.Get())) return false;
        TestTrue(TEXT("Generated graph loads from its isolated folder"), Animation->LocomotionAsset->GetPathName().StartsWith(GeneratedFolder));
        TestEqual(TEXT("Generated graph has three own locomotion clips"), Animation->LocomotionAsset->GetBlendSamples().Num(), 3);
        for (const FBlendSample& Sample : Animation->LocomotionAsset->GetBlendSamples())
            TestTrue(TEXT("Generated locomotion never borrows an older body's clip"), Sample.Animation &&
                Sample.Animation->GetPathName().StartsWith(GeneratedFolder) && Sample.Animation->GetSkeleton() == GeneratedBody->GetSkeleton());
        TestTrue(TEXT("Generated jump belongs to its own body"), Animation->JumpAsset->GetPathName().StartsWith(GeneratedFolder) &&
            Animation->JumpAsset->GetSkeleton() == GeneratedBody->GetSkeleton() && !Animation->JumpAsset->HasRootMotion());
        AQuebecController* GeneratedController = World->SpawnActor<AQuebecController>();
        if (!TestNotNull(TEXT("Generated local controller"), GeneratedController)) return false;
        GeneratedController->ApplyComicStyle();
        TestTrue(TEXT("Generated view reuses the unchanged candidate ink"), GeneratedController->ComicMaterial == CandidateController->ComicMaterial);
        TestFalse(TEXT("Generated view still starts in standard mode"), GeneratedController->IsComicStyle());
    }
    else AddWarning(TEXT("NORD_GRAPHIC_NOVEL_GENERATED_SELECTION_SKIPPED: generated body has not been imported; no generated selection acceptance"));
    TestTrue(TEXT("Opt-in still permits native crew selection"), Character->ChooseCrew(8));
    TestTrue(TEXT("Other styles keep their production body under the candidate flag"),
        Character->GetMesh()->GetSkeletalMeshAsset()->GetPathName().Contains(TEXT("/ParkComic/Crew/Resident8/SK_Body")));
    TestEqual(TEXT("Other styles retain stencil 255 under the candidate flag"), Character->GetMesh()->CustomDepthStencilValue, 255);
    TestTrue(TEXT("Other styles retain their single-node fallback"), Character->GetMesh()->GetAnimInstance()->IsA<UAnimSingleNodeInstance>());
    if (!HasAnyErrors()) AddInfo(TEXT("NORD_GRAPHIC_NOVEL_SELECTION_CHECKED default=production pilot=native style8=production privateF2=1"));
    return !HasAnyErrors();
}
#endif
