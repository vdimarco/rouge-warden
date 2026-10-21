#include "QuebecGameplay.h"
#include "Misc/PackageName.h"
#include "QuebecCampaign.h"
#include "QuebecChain.h"
#include "QuebecPace.h"
#include "QuebecBail.h"
#include "QuebecRide.h"
#include "QuebecCycle.h"
#include "QuebecScoot.h"
#include "QuebecRingMark.h" // Two lawn marks. One bike lap pays session cash once.
#include "QuebecRing.h"
#include "QuebecCrateMark.h" // A Sherbrooke caisse. One bike run to Persillier pays once.
#include "QuebecCrate.h"
#include "QuebecRouteLine.h"
#include "QuebecCourtRules.h"
#include "QuebecCourtTone.h"
#include "QuebecRankTone.h"
#include "QuebecSkidTone.h"
#include "QuebecImpactTone.h"
#include "QuebecLossTone.h"
#include "QuebecStoryBed.h"
#include "QuebecBarks.h"
#include "QuebecPondRules.h"
#include "QuebecPondTone.h"
#include "QuebecShowRules.h"
#include "QuebecShowTone.h"
#include "QuebecJobRules.h"
#include "QuebecSky.h"
#include "QuebecCrewAnimation.h"
#include "QuebecGTA.h" // AQuebecCar: street traces each frame (DRIVE).
#include "QuebecTraces.h" // Street traces: knockable street props spawned by the game mode (TRAFFIC).
#include "QuebecCombat.h" // Combat: pickups and the player state class (COMBAT).
#include "QuebecPlayerState.h"
#include "QuebecLife.h" // Living street: companion assignment for runtime walkers (PEOPLE).
#include "QuebecSideJobs.h" // Side jobs: markers, E, R and the game mode spawn (JOBS).
#include "QuebecCart.h" // Chez Lise: the stall that spends session cash.
#include "QuebecBow.h" // The stage bow after the goon fight.
#include "QuebecBay.h" // The sidewalk atelier that spends cash on a dented car.
#include "QuebecBuoy.h" // The north-pond buoy. One pedalo lap pays session cash once.
#include "QuebecLap.h"
#include "QuebecWadeMark.h" // The south-pond float. One wade pays session cash once.
#include "QuebecWade.h"
#include "QuebecTrioMark.h" // Three sidewalk posts. One walker, in order, paid once.
#include "QuebecTrio.h"
#include "QuebecPolice.h" // Police: the dispatcher spawned by the game mode (POLICE).
#include "LaFontaineMap.h"
#include "LaFontaineExtensionMap.h"
#include "CollegeBathurstMap.h"
#include "QuebecStreetLook.h"
#include "QuebecSway.h"
#include "QuebecScuff.h"

#include "Animation/AnimInstance.h"
#include "Animation/AnimSequence.h"
#include "Camera/CameraComponent.h"
#include "Components/BoxComponent.h"
#include "Components/AudioComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/OverlapResult.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/PlayerStart.h"
#include "IPixelStreaming2Module.h"
#include "PixelStreaming2Delegates.h"
#include "GameFramework/SpringArmComponent.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/PackageName.h"
#include "Net/UnrealNetwork.h"
#include "Sound/SoundWaveProcedural.h"
#include "Sound/SoundBase.h"
#include "UnrealClient.h"
#include "UObject/ConstructorHelpers.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Engine/LocalPlayer.h"
#include "GameFramework/InputSettings.h"
#include "GameFramework/PlayerInput.h"
#include "InputKeyEventArgs.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"
#endif

namespace QuebecDistrict
{
    bool IsTorontoMapName(const FString& MapName)
    {
        return FPackageName::GetShortName(UWorld::RemovePIEPrefix(MapName)) == TEXT("CollegeBathurst");
    }

    bool IsToronto(const UWorld* World)
    {
        return World && IsTorontoMapName(World->GetMapName());
    }

    const FSettings& ForWorld(const UWorld* World)
    {
        static const FSettings Montreal{LaFontaine::Spawn, LaFontaine::CarSpawn, LaFontaine::RoadSegments,
            UE_ARRAY_COUNT(LaFontaine::RoadSegments), TEXT("MONTRÉAL"), TEXT("© Ville de Montréal / CC BY 4.0")};
        static const FSettings Toronto{CollegeBathurst::Spawn, CollegeBathurst::CarSpawn, CollegeBathurst::RoadSegments,
            UE_ARRAY_COUNT(CollegeBathurst::RoadSegments), TEXT("TORONTO"), TEXT("City of Toronto / Open Government Licence")};
        static const FSettings ExpandedMontreal{LaFontaine::Spawn, LaFontaine::CarSpawn, LaFontaineExtension::RadarRoadSegments,
            UE_ARRAY_COUNT(LaFontaineExtension::RadarRoadSegments), TEXT("MONTRÉAL"), TEXT("© Ville de Montréal / CC BY 4.0")};
        if (IsToronto(World)) return Toronto;
        // Expand the saved Montréal radar; synthetic worlds and traffic keep their original arrays.
        return World && FPackageName::GetShortName(UWorld::RemovePIEPrefix(World->GetMapName())) == TEXT("LaFontaine")
            ? ExpandedMontreal : Montreal;
    }
}

namespace
{
    const FVector MansionSpawn = LaFontaine::Spawn;
    constexpr float MissionRadius = 500.f;
    constexpr float CarEnterRadius = 450.f;
    AQuebecCampaign* CampaignFor(UWorld* World)
    {
        if (QuebecDistrict::IsToronto(World)) return nullptr;
        TActorIterator<AQuebecCampaign> It(World);
        return It ? *It : nullptr;
    }

    const TCHAR* RouteTurnWord(QuebecRouteLine::ETurn Turn)
    {
        switch (Turn)
        {
        case QuebecRouteLine::ETurn::Ahead: return TEXT("ahead");
        case QuebecRouteLine::ETurn::Right: return TEXT("right");
        case QuebecRouteLine::ETurn::Behind: return TEXT("behind");
        case QuebecRouteLine::ETurn::Left: return TEXT("left");
        default: return TEXT("here");
        }
    }

    bool ClipHUDRadarSegment(FVector2D& A, FVector2D& B, const FVector2D& Center, float Radius)
    {
        const FVector2D Start = A, Direction = B - A, Offset = A - Center;
        const double LengthSquared = Direction.SizeSquared();
        if (FMath::IsNearlyZero(LengthSquared)) return Offset.SizeSquared() <= FMath::Square(Radius);
        const double Middle = -FVector2D::DotProduct(Offset, Direction) / LengthSquared;
        const double Discriminant = FMath::Square(Middle) - (Offset.SizeSquared() - FMath::Square(Radius)) / LengthSquared;
        if (Discriminant < 0.) return false;
        const double Half = FMath::Sqrt(Discriminant);
        const double Enter = FMath::Max(0., Middle - Half), Leave = FMath::Min(1., Middle + Half);
        if (Enter > Leave) return false;
        A = Start + Direction * Enter;
        B = Start + Direction * Leave;
        return true;
    }

    void KeepCharacterInView(USpringArmComponent* Arm, FRotator View)
    {
        View.Pitch = FMath::Clamp(FRotator::NormalizeAxis(View.Pitch), -25.f, -5.f);
        Arm->SetWorldRotation(View);
    }

    void ReleasePawnInput(APawn* Pawn)
    {
        if (!Pawn) return;
        Pawn->ConsumeMovementInputVector();
        if (AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn))
        {
            Walker->StopJumping();
            Walker->GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(QuebecPace::WalkCmPerSecond);
            Walker->GetCharacterMovement()->MaxSwimSpeed = 260.f;
            Walker->GetCharacterMovement()->StopMovementImmediately();
            Walker->ReleaseCombatInput(); // Combat: a held Fire or Aim must not outlive the browser.
        }
        else if (AQuebecCar* Car = Cast<AQuebecCar>(Pawn)) Car->StopInput();
    }
}

const FVector AQuebecGameState::MissionLocations[MissionCount] = {
    LaFontaine::Missions[0], LaFontaine::Missions[1], LaFontaine::Missions[2]
};
const TCHAR* AQuebecGameState::MissionLabels[MissionCount] = {
    TEXT("Explore the pond"), TEXT("Visit Theatre de Verdure"), TEXT("Meet your crew in the park")
};

AQuebecCharacter::AQuebecCharacter()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);
    bUseControllerRotationYaw = false;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.f, 500.f, 0.f);
    GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(QuebecPace::WalkCmPerSecond);
    GetCharacterMovement()->JumpZVelocity = 600.f;
    GetCharacterMovement()->AirControl = 0.35f;
    GetCharacterMovement()->GetNavAgentPropertiesRef().bCanSwim = true;
    GetCharacterMovement()->MaxSwimSpeed = 260.f;
    GetCharacterMovement()->BrakingDecelerationSwimming = 400.f;
    GetCharacterMovement()->Buoyancy = 1.f;

    CameraArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraArm"));
    CameraArm->SetupAttachment(RootComponent);
    CameraArm->TargetArmLength = 420.f;
    // The aim pose already sits 70 cm to the figure's right. Idle uses that same shoulder,
    // so the street stays open beside them and aiming does not slide the frame sideways.
    // Raising the socket drops the figure in the frame, so the street ahead is the picture.
    CameraArm->SocketOffset = FVector(0., 70., 110.);
    CameraArm->bUsePawnControlRotation = false;
    CameraArm->SetUsingAbsoluteRotation(true);
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
    Camera->SetupAttachment(CameraArm, USpringArmComponent::SocketName);

    static ConstructorHelpers::FObjectFinderOptional<USkeletalMesh> MeshAsset(
        TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"));
    if (MeshAsset.Succeeded())
    {
        GetMesh()->SetSkeletalMesh(MeshAsset.Get());
        GetMesh()->SetRelativeLocation(FVector(0., 0., -96.));
        GetMesh()->SetRelativeRotation(FRotator(0., -90., 0.));
    }
    static ConstructorHelpers::FClassFinder<UAnimInstance> AnimAsset(
        TEXT("/Game/Characters/Mannequins/Anims/Unarmed/ABP_Unarmed"));
    if (AnimAsset.Succeeded()) GetMesh()->SetAnimInstanceClass(AnimAsset.Class);
    CrewProp = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("CrewProp"));
    CrewProp->SetupAttachment(GetMesh(), TEXT("RightHand"));
    CrewProp->SetCollisionProfileName(TEXT("NoCollision"));
    CrewProp->SetUsingAbsoluteRotation(true);
    // Feet on the capsule bottom. Stays hidden until a missing crew rig shows the casual idle.
    CasualStand = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("CasualStand"));
    CasualStand->SetupAttachment(GetCapsuleComponent());
    CasualStand->SetRelativeLocation(FVector(0., 0., -96.));
    CasualStand->SetCollisionProfileName(TEXT("NoCollision"));
    CasualStand->SetVisibility(false);
    CasualStand->SetHiddenInGame(true);
}

void AQuebecCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    if (AQuebecController* Player = Cast<AQuebecController>(NewController))
        Player->FrameTheStreet(NewController->GetControlRotation().Yaw);
}

void AQuebecCharacter::BeginPlay()
{
    Super::BeginPlay();
    // A new player starts as a crew member nobody else is playing.
    if (HasAuthority() && IsCrewTaken(GetWorld(), CrewStyle, this))
        for (int32 Step = 1; Step < 8; ++Step)
        {
            const int32 Next = 3 + (CrewStyle - 3 + Step) % 8;
            if (!IsCrewTaken(GetWorld(), Next, this)) { CrewStyle = Next; break; }
        }
    ApplyCrewAppearance();
}

bool AQuebecCharacter::IsCrewTaken(const UWorld* World, int32 Style, const AQuebecCharacter* Except)
{
    if (!World) return false;
    // Every AQuebecCharacter in play belongs to a player, including one parked while its player drives.
    for (TActorIterator<AQuebecCharacter> It(World); It; ++It)
        if (*It != Except && !It->IsPendingKillPending() && It->CrewStyle == Style) return true;
    return false;
}

bool AQuebecCharacter::ChooseCrew(int32 Style)
{
    if (!HasAuthority() || Style < 3 || Style > 10) return false;
    if (Style == CrewStyle) return true;
    if (IsCrewTaken(GetWorld(), Style, this)) return false;
    CrewStyle = Style;
    ApplyCrewAppearance();
    ForceNetUpdate();
    return true;
}

void AQuebecCharacter::CycleCrew()
{
    if (!HasAuthority()) return;
    // Skip crew members the other player is wearing.
    for (int32 Step = 1; Step <= 8; ++Step)
        if (ChooseCrew(3 + (FMath::Clamp(CrewStyle, 3, 10) - 3 + Step) % 8)) return;
}

void AQuebecCharacter::ApplyCrewAppearance()
{
    if (CrewStyle < 3 || CrewStyle > 10) return;
    const bool bCandidateRequested = FParse::Param(FCommandLine::Get(), TEXT("NordGraphicNovelCandidate"));
    const bool bGeneratedRequested = bCandidateRequested && FParse::Param(FCommandLine::Get(), TEXT("NordGraphicNovelGenerated"));
    const bool bHighDetailRequested = bGeneratedRequested && FParse::Param(FCommandLine::Get(), TEXT("NordGraphicNovelHighDetail"));
    const bool bGraphicNovelCandidate = CrewStyle == 9 && bCandidateRequested;
    const bool bGraphicNovelGenerated = CrewStyle == 9 && bGeneratedRequested;
    const bool bGraphicNovelHighDetail = CrewStyle == 9 && bHighDetailRequested;
    // Topknot stays on production until the rejected bag skin has been repaired.
    bool bGraphicNovelTripo = CrewStyle < 10 && bHighDetailRequested && FParse::Param(FCommandLine::Get(), TEXT("NordGraphicNovelTripo"));
    const FString TripoFolder = FString::Printf(TEXT("/Game/ParkComic/CrewGraphicNovelTripo/Resident%d/"), CrewStyle);
    if (bGraphicNovelTripo)
        for (const TCHAR* Asset : {TEXT("SK_Body"), TEXT("A_Idle"), TEXT("A_Walk"), TEXT("A_Run"), TEXT("A_Jump"), TEXT("BS_Locomotion")})
            bGraphicNovelTripo &= FPackageName::DoesPackageExist(TripoFolder + Asset);
    const FString Folder = bGraphicNovelTripo ? TripoFolder
        : bGraphicNovelHighDetail ? TEXT("/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9/")
        : bGraphicNovelGenerated ? TEXT("/Game/ParkComic/CrewGraphicNovelGenerated/Resident9/")
        : bGraphicNovelCandidate ? TEXT("/Game/ParkComic/CrewGraphicNovel/Resident9/")
        : FString::Printf(TEXT("/Game/ParkComic/Crew/Resident%d/"), CrewStyle);
    USkeletalMesh* Body = LoadObject<USkeletalMesh>(nullptr, *(Folder + TEXT("SK_Body.SK_Body")));
    if (!Body)
    {
        // The crew blend space cannot be posed here. The casual skeleton's own walk can:
        // feet and arms come from that clip, and the body rock still leans the whole mesh.
        // The prepared body faces the component's +X, the axis a pedestrian root walks along.
        USkeletalMesh* CasualBody = LoadObject<USkeletalMesh>(nullptr,
            TEXT("/Game/Plateau/Life/Civilians/MenCasual/SK_MenCasual.SK_MenCasual"),
            nullptr, LOAD_NoWarn | LOAD_Quiet);
        UAnimSequence* CasualIdle = LoadObject<UAnimSequence>(nullptr,
            TEXT("/Game/Plateau/Life/Civilians/MenCasual/A_MenCasual_Idle.A_MenCasual_Idle"),
            nullptr, LOAD_NoWarn | LOAD_Quiet);
        UAnimSequence* CasualWalk = LoadObject<UAnimSequence>(nullptr,
            TEXT("/Game/Plateau/Life/Civilians/MenCasual/A_MenCasual_Walk.A_MenCasual_Walk"),
            nullptr, LOAD_NoWarn | LOAD_Quiet);
        if (CasualBody && CasualIdle && CasualWalk)
        {
            CasualStand->SetHiddenInGame(true);
            CasualStand->SetVisibility(false);
            GetMesh()->SetVisibility(true);
            GetMesh()->SetAnimationMode(EAnimationMode::AnimationSingleNode);
            GetMesh()->SetSkeletalMesh(CasualBody);
            GetMesh()->SetRelativeLocation(FVector(0., 0., -96.));
            GetMesh()->SetRelativeRotation(FRotator(0., 0., 0.));
            GetMesh()->SetRenderCustomDepth(true);
            GetMesh()->SetCustomDepthStencilValue(255);
            CrewIdle = CasualIdle;
            CrewWalk = CasualWalk;
            CrewRun = nullptr;
            CrewJump = nullptr;
            CrewLocomotion = nullptr;
            CrewAnimation = nullptr;
            CrewProp->SetVisibility(false);
            return;
        }
        // The clothed casual idle replaces the mannequin when the crew rig is missing.
        // Feet sit on the mesh origin and the face points +X. A loaded rig hides this stand.
        if (UStaticMesh* Stand = LoadObject<UStaticMesh>(nullptr,
            TEXT("/Game/Plateau/Life/Civilians/MenCasual/SM_MenCasualStand.SM_MenCasualStand"),
            nullptr, LOAD_NoWarn | LOAD_Quiet))
        {
            CasualStand->SetStaticMesh(Stand);
            CasualStand->SetRelativeLocation(FVector(0., 0., -96.));
            CasualStand->SetRelativeRotation(FRotator::ZeroRotator);
            CasualStand->SetRelativeScale3D(FVector(1.));
            CasualStand->SetHiddenInGame(false);
            CasualStand->SetVisibility(true);
            GetMesh()->SetVisibility(false);
        }
        return;
    }
    CasualStand->SetHiddenInGame(true);
    CasualStand->SetVisibility(false);
    GetMesh()->SetVisibility(true);
    GetMesh()->SetAnimationMode(EAnimationMode::AnimationSingleNode);
    GetMesh()->SetSkeletalMesh(Body);
    // Generated cast bodies face -Y; the retained Meshy pilot already faces +X.
    GetMesh()->SetRelativeRotation(FRotator(0., bGraphicNovelTripo && CrewStyle < 9 ? 90. : 0., 0.));
    GetMesh()->SetRenderCustomDepth(true);
    GetMesh()->SetCustomDepthStencilValue((bGraphicNovelCandidate || bGraphicNovelTripo) ? 254 : 255);
    CrewWalk = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Walk.A_Walk")));
    CrewIdle = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Idle.A_Idle")));
    CrewRun = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Run.A_Run")));
    CrewJump = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Jump.A_Jump")));
    // Own jumps move the pelvis; the static root must keep its imported reference scale.
    if (bGraphicNovelTripo && CrewJump) CrewJump->bForceRootLock = true;
    CrewLocomotion = LoadObject<UBlendSpace>(nullptr, *(Folder + TEXT("BS_Locomotion.BS_Locomotion")), nullptr, LOAD_NoWarn | LOAD_Quiet);
    CrewAnimation = nullptr;
    CrewProp->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, CrewStyle == 8
        ? TEXT("/Game/ParkComic/Crew/SM_PVCTube.SM_PVCTube") : TEXT("/Game/ParkComic/Crew/SM_Plunger.SM_Plunger")));
    CrewProp->AttachToComponent(GetMesh(), FAttachmentTransformRules::KeepRelativeTransform,
        bGraphicNovelTripo ? TEXT("TripoGrip") : TEXT("RightHand"));
    CrewProp->SetUsingAbsoluteRotation(!bGraphicNovelTripo);
    CrewProp->SetRelativeTransform(FTransform::Identity);
    ConfigureCrewAnimation();
}

bool AQuebecCharacter::ConfigureCrewAnimation()
{
    const USkeletalMesh* Mesh = GetMesh()->GetSkeletalMeshAsset();
    if (!CrewLocomotion || !CrewJump || !Mesh || CrewLocomotion->GetSkeleton() != Mesh->GetSkeleton() ||
        CrewJump->GetSkeleton() != Mesh->GetSkeleton() || CrewJump->HasRootMotion() ||
        CrewLocomotion->GetBlendSamples().Num() != 3) return false;
    GetMesh()->SetAnimInstanceClass(UQuebecCrewAnimInstance::StaticClass());
    UQuebecCrewAnimInstance* Animation = Cast<UQuebecCrewAnimInstance>(GetMesh()->GetAnimInstance());
    return Animation && Animation->SetAssets(CrewLocomotion, CrewJump);
}

void AQuebecCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveForward"), this, &AQuebecCharacter::MoveForward);
    Input->BindAxis(TEXT("MoveRight"), this, &AQuebecCharacter::MoveRight);
    Input->BindAxis(TEXT("Turn"), this, &AQuebecCharacter::TurnView); // Combat: slower turn while aiming.
    Input->BindAxis(TEXT("LookUp"), this, &APawn::AddControllerPitchInput);
    Input->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
    Input->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
    Input->BindAction(TEXT("Sprint"), IE_Pressed, this, &AQuebecCharacter::StartSprint);
    Input->BindAction(TEXT("Sprint"), IE_Released, this, &AQuebecCharacter::StopSprint);
    // Combat (QuebecCombat.cpp): hold Fire for the SMG, tap for the rest; hold Aim for the shoulder camera.
    Input->BindAction(TEXT("Fire"), IE_Pressed, this, &AQuebecCharacter::StartFire);
    Input->BindAction(TEXT("Fire"), IE_Released, this, &AQuebecCharacter::StopFire);
    Input->BindAction(TEXT("Aim"), IE_Pressed, this, &AQuebecCharacter::StartAim);
    Input->BindAction(TEXT("Aim"), IE_Released, this, &AQuebecCharacter::StopAim);
    Input->BindAction(TEXT("NextWeapon"), IE_Pressed, this, &AQuebecCharacter::CycleWeapon);
}

void AQuebecCharacter::MoveForward(float Value)
{
    // People: a knocked-down, K.-O. or arrested player cannot walk.
    if (Controller && Value != 0.f && !bInVehicle && !IsInputLocked())
        AddMovementInput(FRotationMatrix(FRotator(0., Controller->GetControlRotation().Yaw, 0.)).GetUnitAxis(EAxis::X), Value);
}

void AQuebecCharacter::MoveRight(float Value)
{
    if (Controller && Value != 0.f && !bInVehicle && !IsInputLocked())
        AddMovementInput(FRotationMatrix(FRotator(0., Controller->GetControlRotation().Yaw, 0.)).GetUnitAxis(EAxis::Y), Value);
}

void AQuebecCharacter::StartSprint()
{
    if (IsInputLocked()) return; // People: no sprint while down.
    GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(QuebecPace::SprintCmPerSecond);
    GetCharacterMovement()->MaxSwimSpeed = 390.f;
    ServerSetSprint(true);
}
void AQuebecCharacter::StopSprint()
{
    GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(QuebecPace::WalkCmPerSecond);
    GetCharacterMovement()->MaxSwimSpeed = 260.f;
    ServerSetSprint(false);
}
void AQuebecCharacter::ServerSetSprint_Implementation(bool bSprint)
{
    const bool bCanSprint = bSprint && !bInVehicle && !IsInputLocked(); // People: no sprint while down.
    GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(bCanSprint ? QuebecPace::SprintCmPerSecond : QuebecPace::WalkCmPerSecond);
    GetCharacterMovement()->MaxSwimSpeed = bCanSprint ? 390.f : 260.f;
}

void AQuebecCharacter::BeginBail(const FVector& Direction, float Speed)
{
    if (bInVehicle || IsInputLocked() || !(Speed > 0.f)) return;
    const FVector Flat = Direction.GetSafeNormal2D();
    if (Flat.IsNearlyZero()) return;
    BailDirection = Flat;
    BailSpeed = Speed;
    if (UCharacterMovementComponent* Move = GetCharacterMovement())
    {
        Move->MaxWalkSpeed = Speed;
        Move->Velocity = Flat * Speed;
    }
}

void AQuebecCharacter::EndBail()
{
    BailSpeed = 0.f;
    BailDirection = FVector::ZeroVector;
    if (bInVehicle) return;
    UCharacterMovementComponent* Move = GetCharacterMovement();
    if (!Move) return;
    bool bSprint = false;
    if (APlayerController* Player = Cast<APlayerController>(GetController()))
        bSprint = Player->IsInputKeyDown(EKeys::LeftShift);
    Move->MaxWalkSpeed = static_cast<float>(bSprint ? QuebecPace::SprintCmPerSecond : QuebecPace::WalkCmPerSecond);
}

void AQuebecCharacter::TickBail(float DeltaSeconds)
{
    if (!HasAuthority() || bInVehicle || !(BailSpeed > 0.f)) return;
    UCharacterMovementComponent* Move = GetCharacterMovement();
    if (!Move || IsInputLocked() || Move->IsSwimming() || Move->IsFalling() || Move->Velocity.Z > 1.f
        || !GetPendingMovementInputVector().IsNearlyZero())
    {
        EndBail();
        return;
    }
    Move->MaxWalkSpeed = BailSpeed;
    Move->Velocity = BailDirection * BailSpeed;
    BailSpeed = QuebecBail::Ease(BailSpeed, DeltaSeconds);
    if (!(BailSpeed > 0.f)) EndBail();
}

void AQuebecCharacter::SetInVehicle(bool bNewInVehicle)
{
    if (bNewInVehicle) { BailSpeed = 0.f; BailDirection = FVector::ZeroVector; }
    bInVehicle = bNewInVehicle;
    OnRep_InVehicle();
    ForceNetUpdate();
}

void AQuebecCharacter::OnRep_InVehicle()
{
    SetActorHiddenInGame(bInVehicle);
    SetActorEnableCollision(!bInVehicle);
    GetCharacterMovement()->StopMovementImmediately();
    GetCharacterMovement()->SetMovementMode(bInVehicle ? MOVE_None : MOVE_Walking);
    GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(QuebecPace::WalkCmPerSecond);
    GetCharacterMovement()->MaxSwimSpeed = 260.f;
    // Combat: the car takes the input, so a Fire or Aim held while getting in would never see its release.
    ReleaseCombatInput();
}

void AQuebecCharacter::RestoreStreetSway()
{
    const float Yaw = GetMesh()->GetRelativeRotation().Yaw;
    GetMesh()->SetRelativeLocation(FVector(0., 0., -96.));
    GetMesh()->SetRelativeRotation(FRotator(0., Yaw, 0.));
    CasualStand->SetRelativeLocation(FVector(0., 0., -96.));
    CasualStand->SetRelativeRotation(FRotator::ZeroRotator);
    bSwayApplied = false;
}

void AQuebecCharacter::ApplyStreetSway(float DeltaSeconds)
{
    // The crew blend space already poses the body. A second rock would stack on it.
    // Swimming and a knockdown own the mesh rotation. A fall holds the rest pose.
    const bool bHeld = bInVehicle || IsKnocked() || !GetCharacterMovement() || GetCharacterMovement()->IsSwimming()
        || Cast<UQuebecCrewAnimInstance>(GetMesh()->GetAnimInstance());
    if (bHeld || GetCharacterMovement()->IsFalling())
    {
        if (bSwayApplied) RestoreStreetSway();
        return;
    }
    const float Speed = GetVelocity().Size2D();
    SwayPhase = static_cast<float>(QuebecSway::Advance(SwayPhase, DeltaSeconds, Speed));
    const QuebecSway::FPose Sway = QuebecSway::Pose(SwayPhase, Speed);
    const float Yaw = GetMesh()->GetRelativeRotation().Yaw;
    GetMesh()->SetRelativeLocation(FVector(0., Sway.Side, -96. + Sway.Bob));
    GetMesh()->SetRelativeRotation(FRotator(Sway.Pitch, Yaw, Sway.Roll));
    CasualStand->SetRelativeLocation(FVector(0., Sway.Side, -96. + Sway.Bob));
    CasualStand->SetRelativeRotation(FRotator(Sway.Pitch, 0., Sway.Roll));
    bSwayApplied = true;
}

void AQuebecCharacter::UpdateFootDust(float DeltaSeconds)
{
    // Age comes from the birth clock, so a long frame does not step the puff twice.
    (void)DeltaSeconds;
    if (GetNetMode() == NM_DedicatedServer || !GetCharacterMovement()) return;
    const float Now = GetWorld()->GetTimeSeconds();
    for (int32 Index = 0; Index < FootDust.Num(); ++Index)
    {
        UStaticMeshComponent* Puff = FootDust[Index];
        if (!Puff || !Puff->IsVisible()) continue;
        const float Age = Now - FootDustBorn[Index];
        if (Age >= static_cast<float>(QuebecScuff::Life))
        {
            Puff->SetVisibility(false);
            continue;
        }
        const QuebecScuff::FPuff Dust = QuebecScuff::At(Age, Index);
        const QuebecScuff::FPuff Born = QuebecScuff::At(0., Index);
        Puff->SetWorldLocation(FootDustOrigin[Index]
            - FootDustForward[Index] * static_cast<float>(Dust.Back - Born.Back)
            + FootDustRight[Index] * static_cast<float>(Dust.Side - Born.Side)
            + FVector(0.f, 0.f, static_cast<float>(Dust.Up - Born.Up)));
        Puff->SetWorldScale3D(FVector(static_cast<float>(Dust.Radius / 50.)));
    }
    const bool bScuffing = !bInVehicle && !IsKnocked() && !GetCharacterMovement()->IsSwimming()
        && !GetCharacterMovement()->IsFalling()
        && GetVelocity().Size2D() > static_cast<float>(QuebecScuff::WalkSpeed);
    UPrimitiveComponent* Body = GetMesh()->IsVisible() ? static_cast<UPrimitiveComponent*>(GetMesh()) : CasualStand;
    if (!bScuffing || Now < NextFootDustAt || !Body || !Body->WasRecentlyRendered(1.f)) return;
    NextFootDustAt = Now + static_cast<float>(QuebecScuff::Interval);
    const int32 Slot = FootDust.Num() < QuebecScuff::Count ? FootDust.Num() : NextFootDust % QuebecScuff::Count;
    ++NextFootDust;
    if (Slot == FootDust.Num())
    {
        UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
        if (!Sphere) return;
        UStaticMeshComponent* NewPuff = NewObject<UStaticMeshComponent>(this);
        NewPuff->SetStaticMesh(Sphere);
        NewPuff->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        NewPuff->SetCastShadow(false);
        NewPuff->SetUsingAbsoluteLocation(true);
        NewPuff->SetUsingAbsoluteRotation(true);
        NewPuff->SetUsingAbsoluteScale(true);
        NewPuff->SetupAttachment(GetCapsuleComponent());
        NewPuff->RegisterComponent();
        FootDust.Add(NewPuff);
        FootDustBorn.Add(Now);
        FootDustOrigin.Add(FVector::ZeroVector);
        FootDustForward.Add(FVector::ForwardVector);
        FootDustRight.Add(FVector::RightVector);
    }
    UStaticMeshComponent* Puff = FootDust[Slot];
    if (!Puff) return;
    if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Materials/M_White.M_White")))
        Puff->SetMaterial(0, Material);
    const QuebecScuff::FPuff Born = QuebecScuff::At(0., Slot);
    const FVector Local(
        -static_cast<float>(QuebecScuff::FootBack),
        static_cast<float>(QuebecScuff::FootSide + Born.Side),
        static_cast<float>(QuebecScuff::FootUp + Born.Up));
    FootDustOrigin[Slot] = Body->GetComponentTransform().TransformPosition(Local);
    FootDustForward[Slot] = GetActorForwardVector();
    FootDustRight[Slot] = GetActorRightVector();
    FootDustBorn[Slot] = Now;
    Puff->SetWorldLocation(FootDustOrigin[Slot]);
    Puff->SetWorldScale3D(FVector(static_cast<float>(Born.Radius / 50.)));
    Puff->SetVisibility(true);
}

void AQuebecCharacter::Tick(float DeltaSeconds)
{
    UpdateSwimming(DeltaSeconds);
    TickBail(DeltaSeconds);
    Super::Tick(DeltaSeconds);
    KeepCharacterInView(CameraArm, GetViewRotation());
    TickCombat(DeltaSeconds); // Combat: held weapon, aim camera, autofire, melee hits and the K.-O. respawn.
    if (!bInVehicle && CrewIdle && !Cast<UQuebecCrewAnimInstance>(GetMesh()->GetAnimInstance()))
    {
        const float Speed = GetVelocity().Size2D();
        const bool bFalling = GetCharacterMovement()->IsFalling();
        if (bCrewWasFalling && !bFalling) CrewLandingTime = 0.f;
        bCrewWasFalling = bFalling;
        CrewLandingTime += DeltaSeconds;
        const bool bLanding = !bFalling && CrewLandingTime < .27f;
        UAnimSequence* Animation = (bFalling || bLanding) && CrewJump ? CrewJump
            : Speed > 520.f && CrewRun ? CrewRun : Speed > 5.f ? CrewWalk : CrewIdle;
        if (Animation)
        {
            const bool bChanged = CrewAnimation != Animation;
            if (bChanged)
            {
                GetMesh()->SetAnimation(Animation);
                CrewAnimation = Animation;
                CrewAnimationTime = 0.f;
            }
            const float Rate = Speed > 5.f ? FMath::Clamp(Speed / (Animation == CrewRun ? 600.f : 180.f), .8f, 2.f) : 1.f;
            CrewAnimationTime = FMath::Fmod(CrewAnimationTime + DeltaSeconds * Rate, FMath::Max(Animation->GetPlayLength(), .01f));
            float Time = CrewAnimationTime;
            if (Animation == CrewJump)
            {
                const float Vertical = GetVelocity().Z / GetCharacterMovement()->JumpZVelocity;
                Time = bFalling ? (Vertical > 0.f ? FMath::Lerp(.47f, .23f, FMath::Clamp(Vertical, 0.f, 1.f))
                    : FMath::Lerp(.47f, .73f, FMath::Clamp(-Vertical, 0.f, 1.f))) : .93f + CrewLandingTime;
            }
            const float Interval = GetMesh()->GetComponentTickInterval();
            CrewPoseElapsed += DeltaSeconds;
            if (bChanged || Interval <= 0.f || CrewPoseElapsed >= Interval)
            {
                CrewPoseElapsed = Interval > 0.f ? FMath::Fmod(CrewPoseElapsed, Interval) : 0.f;
                GetMesh()->SetPosition(Time, false);
                GetMesh()->TickAnimation(0.f, false);
                GetMesh()->RefreshBoneTransforms();
                CrewProp->UpdateComponentToWorld();
            }
        }
    }
    ApplyStreetSway(DeltaSeconds);
    UpdateFootDust(DeltaSeconds);
    if (HasAuthority() && !bInVehicle && GetActorLocation().Z < -1500.)
    {
        GetCharacterMovement()->StopMovementImmediately();
        TeleportTo(QuebecDistrict::ForWorld(GetWorld()).PlayerSpawn, FRotator::ZeroRotator);
    }
}

void AQuebecCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecCharacter, bInVehicle);
    DOREPLIFETIME(AQuebecCharacter, CrewStyle);
    // People: knockdown.
    DOREPLIFETIME(AQuebecCharacter, KnockStartedAt);
    DOREPLIFETIME(AQuebecCharacter, KnockPush);
    DOREPLIFETIME(AQuebecCharacter, KnockLieSeconds);
    DOREPLIFETIME(AQuebecCharacter, bKnockStayDown);
}

AQuebecParkInstances::AQuebecParkInstances()
{
    PrimaryActorTick.bCanEverTick = false;
    Instances = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("Instances"));
    Instances->SetMobility(EComponentMobility::Static);
    Instances->SetCollisionProfileName(TEXT("NoCollision"));
    RootComponent = Instances;
}

namespace
{
    struct FResidentTravel
    {
        float Distance = 0.f;
        float AnimationTime = 0.f;
        bool bMoving = false;
        bool bReturn = false;
    };

    FResidentTravel SampleResidentTravel(float Time, float Length, float Pace, float Pause)
    {
        FResidentTravel Result;
        if (Length <= 1.f) return Result;
        Pace = FMath::Clamp(Pace,40.f,260.f);
        // A short acceleration/deceleration at each end avoids an instantaneous
        // full-speed jog into the idle pose. Position is continuous through both pauses.
        const float Ramp = FMath::Min(.45f,Length/Pace*.25f);
        const float Duration = Length/Pace+Ramp;
        Pause = FMath::Clamp(Pause,1.f,10.f);
        const float Cycle = FMath::Fmod(FMath::Max(Time,0.f),2.f*(Duration+Pause));
        Result.bReturn = Cycle >= Duration+Pause;
        const float Leg = Result.bReturn ? Cycle-Duration-Pause : Cycle;
        Result.bMoving = Leg < Duration;
        const float TravelTime = FMath::Clamp(Leg,0.f,Duration);
        if (TravelTime < Ramp) Result.Distance = .5f*Pace/Ramp*FMath::Square(TravelTime);
        else if (TravelTime < Duration-Ramp) Result.Distance = Pace*(TravelTime-.5f*Ramp);
        else Result.Distance = Length-.5f*Pace/Ramp*FMath::Square(Duration-TravelTime);
        Result.AnimationTime = Result.bMoving ? Result.Distance/Pace : Leg-Duration;
        if (Result.bReturn) Result.Distance = Length-Result.Distance;
        return Result;
    }

    FVector ResidentPointOnRoute(const TArray<FVector>& Route, float Distance, FVector& Direction)
    {
        for (int32 I = 1; I < Route.Num(); ++I)
        {
            const float Length = FVector::Distance(Route[I-1],Route[I]);
            if (Distance <= Length || I == Route.Num()-1)
            {
                Direction = (Route[I]-Route[I-1]).GetSafeNormal2D();
                return FMath::Lerp(Route[I-1],Route[I],FMath::Clamp(Distance/FMath::Max(Length,1.f),0.f,1.f));
            }
            Distance -= Length;
        }
        Direction = FVector::ForwardVector;
        return Route.Num() ? Route[0] : FVector::ZeroVector;
    }

    TArray<FVector> TrimResidentRoute(const TArray<FVector>& Route, float StartTrim, float EndTrim)
    {
        float Length = 0.f;
        for (int32 I = 1; I < Route.Num(); ++I) Length += FVector::Distance(Route[I-1],Route[I]);
        const float Start = FMath::Max(0.f,StartTrim), End = Length-FMath::Max(0.f,EndTrim);
        TArray<FVector> Result;
        if (Route.Num() < 2 || End <= Start) return Result;
        FVector Direction;
        Result.Add(ResidentPointOnRoute(Route,Start,Direction));
        float Along = 0.f;
        for (int32 I = 1; I < Route.Num(); ++I)
        {
            Along += FVector::Distance(Route[I-1],Route[I]);
            if (Along > Start && Along < End) Result.Add(Route[I]);
        }
        Result.Add(ResidentPointOnRoute(Route,End,Direction));
        return Result;
    }
}

AQuebecParkResident::AQuebecParkResident()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    SetReplicateMovement(true);
    SetNetUpdateFrequency(12.f);
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    const TCHAR* Names[] = {TEXT("Body"), TEXT("Head"), TEXT("LeftArm"), TEXT("RightArm"), TEXT("LeftLeg"), TEXT("RightLeg")};
    const FVector Pivots[] = {FVector::ZeroVector, FVector(0.,0.,145.), FVector(0.,-43.,126.), FVector(0.,43.,126.), FVector(0.,-20.,68.), FVector(0.,20.,68.)};
    for (int32 I = 0; I < 6; ++I)
    {
        UStaticMeshComponent* Piece = CreateDefaultSubobject<UStaticMeshComponent>(Names[I]);
        Piece->SetupAttachment(RootComponent);
        Piece->SetRelativeLocation(Pivots[I]);
        Piece->SetCollisionProfileName(TEXT("NoCollision"));
        Pieces.Add(Piece);
    }
    GeneratedBody = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("GeneratedBody"));
    GeneratedBody->SetupAttachment(RootComponent);
    GeneratedBody->SetCollisionProfileName(TEXT("NoCollision"));
    GeneratedBody->PrimaryComponentTick.bCanEverTick = false;
    GeneratedBody->SetRenderCustomDepth(true);
    GeneratedBody->SetCustomDepthStencilValue(255);
    HandProp = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HandProp"));
    HandProp->SetupAttachment(RootComponent);
    HandProp->SetCollisionProfileName(TEXT("NoCollision"));
    HandProp->SetUsingAbsoluteRotation(true);
    Label = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Name"));
    Label->SetupAttachment(RootComponent);
    Label->SetRelativeLocation(FVector(0.,0.,262.));
    Label->SetWorldSize(25.f);
    Label->SetHorizontalAlignment(EHTA_Center);
    Label->SetTextRenderColor(FColor(255,238,173));
    Label->SetCollisionProfileName(TEXT("NoCollision"));
}

const TCHAR* AQuebecParkResident::NameForStyle(int32 Index)
{
    const TCHAR* Names[] = {TEXT("CAPITAINE BAGEL"), TEXT("RATON PHILOSOPHE"), TEXT("MADAME POUTINE"), TEXT("GREEN CAP 51"), TEXT("MEMPHIS 33"), TEXT("BLACK CAP"), TEXT("WHITE CAP"), TEXT("RED JERSEY"), TEXT("LIME JACKET"), TEXT("SKULL SHIRT"), TEXT("TOPKNOT PLUNGER")};
    return Names[FMath::Clamp(Index, 0, 10)];
}

const TCHAR* AQuebecParkResident::DialogueForStyle(int32 Index)
{
    const TCHAR* Lines[] = {TEXT("My superpower? A hole lot of courage."), TEXT("I came for the picnic. I stayed for the existential crumbs."), TEXT("Stay cheesy, Montreal. The fries are counting on you."), TEXT("Team cottage! Montreal is our warm-up lap."), TEXT("Thirty-three points. One plunger. No refunds."), TEXT("I brought backup. It is mostly plumbing supplies."), TEXT("White cap, black coffee, questionable plan."), TEXT("I only swing for the fences. And blocked drains."), TEXT("This jacket is visible from orbit. You are welcome."), TEXT("Heavy metal. Light luggage. Emergency plunger."), TEXT("The bag has everything. Except a sensible explanation.")};
    return Lines[FMath::Clamp(Index, 0, 10)];
}

void AQuebecParkResident::ApplyAppearance()
{
    const TCHAR* Names[] = {TEXT("Body"), TEXT("Head"), TEXT("LeftArm"), TEXT("RightArm"), TEXT("LeftLeg"), TEXT("RightLeg")};
    for (int32 I = 0; I < Pieces.Num(); ++I)
    {
        const FString Path = FString::Printf(TEXT("/Game/ParkComic/SM_Resident%d%s.SM_Resident%d%s"), FMath::Clamp(Style,0,10), Names[I], FMath::Clamp(Style,0,10), Names[I]);
        if (UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, *Path)) Pieces[I]->SetStaticMesh(Mesh);
    }
    const FString Folder = FString::Printf(TEXT("/Game/ParkComic/Crew/Resident%d/"), Style);
    USkeletalMesh* GeneratedMesh = Style >= 3 && Style <= 10
        ? LoadObject<USkeletalMesh>(nullptr, *(Folder + TEXT("SK_Body.SK_Body")), nullptr, LOAD_NoWarn | LOAD_Quiet) : nullptr;
    HandProp->AttachToComponent(RootComponent, FAttachmentTransformRules::KeepRelativeTransform);
    GeneratedBody->SetSkeletalMesh(GeneratedMesh);
    if (GeneratedMesh) HandProp->AttachToComponent(GeneratedBody, FAttachmentTransformRules::KeepRelativeTransform, TEXT("RightHand"));
    GeneratedBody->SetVisibility(GeneratedMesh != nullptr);
    for (UStaticMeshComponent* Piece : Pieces) Piece->SetVisibility(GeneratedMesh == nullptr);
    WalkAnimation = GeneratedMesh ? LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Walk.A_Walk"))) : nullptr;
    IdleAnimation = GeneratedMesh ? LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Idle.A_Idle"))) : nullptr;
    RunAnimation = GeneratedMesh ? LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Run.A_Run"))) : nullptr;
    // People: the crew jump clip's airborne frames pose a knocked-down resident in flight.
    JumpAnimation = GeneratedMesh ? LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Jump.A_Jump")), nullptr, LOAD_NoWarn | LOAD_Quiet) : nullptr;
    CurrentAnimation = nullptr;
    const TCHAR* PropPath = Style == 8 ? TEXT("/Game/ParkComic/Crew/SM_PVCTube.SM_PVCTube") : TEXT("/Game/ParkComic/Crew/SM_Plunger.SM_Plunger");
    HandProp->SetStaticMesh(GeneratedMesh ? LoadObject<UStaticMesh>(nullptr, PropPath) : nullptr);
    HandProp->SetVisibility(GeneratedMesh != nullptr);
    GeneratedBody->SetAnimationMode(EAnimationMode::AnimationSingleNode);
    Label->SetRelativeLocation(FVector(0.,0.,GeneratedMesh ? 215. : 262.));
    Label->SetText(FText::FromString(NameForStyle(Style)));
    if (UMaterialInterface* TextMaterial = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Text.M_Text"))) Label->SetTextMaterial(TextMaterial);
}

void AQuebecParkResident::BeginPlay()
{
    Super::BeginPlay();
    ApplyAppearance();
    UpdateRouteLength();
    SetNetCullDistanceSquared(FMath::Square(18000.f));
    GeneratedBody->SetCullDistance(14000.f);
    HandProp->SetCullDistance(14000.f);
    for (UStaticMeshComponent* Piece : Pieces) Piece->SetCullDistance(14000.f);
    // People: mascot pivots to restore after a tumble, and the walker's dog, stroller or groceries.
    PiecePivots.Reset();
    for (UStaticMeshComponent* Piece : Pieces) PiecePivots.Add(Piece->GetRelativeLocation());
    RefreshCompanion();
}

void AQuebecParkResident::UpdateRouteLength()
{
    RouteLength = 0.f;
    for (int32 I = 1; I < Route.Num(); ++I) RouteLength += FVector::Distance(Route[I-1],Route[I]);
}

void AQuebecParkResident::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    // A player's crew member is never also a resident: hide the matching residents on every machine.
    // The server sees every player character; clients follow the worn crew the game state shares.
    const AQuebecGameState* Game = GetWorld()->GetGameState<AQuebecGameState>();
    const bool bPlayerWears = HasAuthority() ? AQuebecCharacter::IsCrewTaken(GetWorld(), Style) : Game && Game->IsCrewWorn(Style);
    if (bPlayerWears != IsHidden())
    {
        SetActorHiddenInGame(bPlayerWears);
        SetActorEnableCollision(!bPlayerWears);
    }
    const AGameStateBase* State = GetWorld()->GetGameState();
    const float ServerTime = State ? State->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds();
    const float Time = RouteTime(ServerTime);
    const bool bReacting = ServerTime >= ReactionStartedAt && ServerTime < ReactionUntil;
    const FResidentTravel Travel = SampleResidentTravel(Time,RouteLength,Pace,PauseSeconds);
    const bool bWalking = !bReacting && Activity != 2 && Route.Num() > 1 && Travel.bMoving;
    // People: a knockdown or a flight moves the root itself while the route clock holds (QuebecPeople.cpp).
    const bool bAway = Stride != 0;
    if (bAway && HasAuthority()) TickAway(ServerTime, DeltaSeconds);
    if (Activity != 2 && Route.Num() > 1 && HasAuthority() && !bAway)
    {
        FVector Direction;
        SetActorLocation(ResidentPointOnRoute(Route,Travel.Distance,Direction));
        if (!bReacting)
        {
            const FRotator Facing = (Travel.bReturn ? -Direction : Direction).Rotation();
            SetActorRotation(FMath::RInterpTo(GetActorRotation(),Facing,DeltaSeconds,6.f));
        }
    }
    if (bReacting && HasAuthority() && !bAway)
        SetActorRotation(FMath::RInterpTo(GetActorRotation(),FRotator(0.f,ReactionYaw,0.f),DeltaSeconds,6.f));
    APlayerController* Player = GetWorld()->GetFirstPlayerController();
    const bool bLocalView = Player && Player->IsLocalController() && Player->PlayerCameraManager;
    const FVector Eye = bLocalView ? Player->PlayerCameraManager->GetCameraLocation() : FVector::ZeroVector;
    // Nearby, focused names stay legible; the E prompt still identifies the
    // closest resident throughout the existing 450 cm interaction range.
    const FVector TowardLabel = Label->GetComponentLocation()-Eye;
    const FVector View = bLocalView ? Player->PlayerCameraManager->GetCameraRotation().Vector() : FVector::ZeroVector;
    Label->SetVisibility(bLocalView && TowardLabel.SizeSquared() < FMath::Square(900.f) &&
        FVector::DotProduct(View,TowardLabel.GetSafeNormal()) > .99f);
    // People: drop a finished tumble pose even when hidden or far, so the body never keeps a stale offset.
    if (bKnockPose && !IsKnockActive(ServerTime)) ResetKnockPose();
    const bool bPosed = !IsHidden() && bLocalView && FVector::DistSquared(Eye,GetActorLocation()) <= FMath::Square(14000.f);
    // People: the absolute companion rig hides while unposed instead of standing where it was last posed.
    if (CompanionRig) CompanionRig->SetShown(bPosed);
    if (!bPosed) return;
    // People: tumbling and running residents pick their own clip and clock.
    UAnimSequence* StreetAnimation = nullptr;
    float StreetClock = 0.f;
    const bool bStreetLife = StreetLifeAnimation(ServerTime, StreetAnimation, StreetClock);
    const bool bLimbsSwing = bWalking || (bStreetLife && Stride >= 2);
    const float AnimationClock = bStreetLife ? StreetClock : bReacting || Activity == 2 ? ServerTime + Phase :
        Travel.AnimationTime*(bWalking ? Pace/(Activity == 1 ? 260.f : 120.f) : 1.f)+Phase;
    const float Pose = AnimationClock;
    if (GeneratedBody->GetSkeletalMeshAsset())
    {
        UAnimSequence* Animation = bWalking ? (Activity == 1 && RunAnimation ? RunAnimation : WalkAnimation) : IdleAnimation;
        if (bStreetLife) Animation = StreetAnimation;
        if (Animation)
        {
            if (CurrentAnimation != Animation)
            {
                GeneratedBody->SetAnimation(Animation);
                CurrentAnimation = Animation;
            }
            GeneratedBody->SetPosition(FMath::Fmod(Pose, FMath::Max(Animation->GetPlayLength(), .01f)), false);
            GeneratedBody->TickAnimation(0.f, false);
            GeneratedBody->RefreshBoneTransforms();
            HandProp->UpdateComponentToWorld();
        }
    }
    const float Swing = FMath::Sin(Pose * 6.f) * (bLimbsSwing ? 24.f : 5.f);
    Pieces[0]->SetRelativeLocation(FVector(0.,0.,bLimbsSwing ? FMath::Abs(FMath::Sin(Pose*6.f))*3.f : 0.f));
    Pieces[1]->SetRelativeRotation(FRotator(FMath::Sin(Pose*2.f)*5.f,FMath::Sin(Pose*.8f)*12.f,0.));
    for (int32 I = 2; I < 6; ++I) Pieces[I]->SetRelativeRotation(FRotator(Swing * (I%2 ? 1.f : -1.f) * (I<4 ? -1.f : 1.f),0.,0.));
    // People: the tumble, dazed stars and the companion, posed only here, like the body.
    PoseStreetLife(ServerTime, bWalking, !bWalking && Activity != 2, Travel.bReturn, Travel.bMoving ? 0.f : Travel.AnimationTime, AnimationClock);
    Label->SetWorldRotation((Eye-Label->GetComponentLocation()).Rotation());
}

void AQuebecParkResident::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecParkResident, Style);
    DOREPLIFETIME(AQuebecParkResident, Route);
    DOREPLIFETIME(AQuebecParkResident, Phase);
    DOREPLIFETIME(AQuebecParkResident, Activity);
    DOREPLIFETIME(AQuebecParkResident, Pace);
    DOREPLIFETIME(AQuebecParkResident, PauseSeconds);
    DOREPLIFETIME(AQuebecParkResident, ReactionStartedAt);
    DOREPLIFETIME(AQuebecParkResident, ReactionUntil);
    DOREPLIFETIME(AQuebecParkResident, RouteDelay);
    DOREPLIFETIME(AQuebecParkResident, ReactionYaw);
    // People: knockdowns, flight and companions.
    DOREPLIFETIME(AQuebecParkResident, Companion);
    DOREPLIFETIME(AQuebecParkResident, Stride);
    DOREPLIFETIME(AQuebecParkResident, KnockStartedAt);
    DOREPLIFETIME(AQuebecParkResident, KnockOrigin);
    DOREPLIFETIME(AQuebecParkResident, KnockPush);
    DOREPLIFETIME(AQuebecParkResident, KnockLieSeconds);
    DOREPLIFETIME(AQuebecParkResident, KnockGround);
    DOREPLIFETIME(AQuebecParkResident, KnockYaw);
}

AQuebecCar::AQuebecCar()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    AutoPossessAI = EAutoPossessAI::Disabled;
    SetReplicateMovement(true);
    SetNetUpdateFrequency(30.f);
    Collision = CreateDefaultSubobject<UBoxComponent>(TEXT("Collision"));
    Collision->SetBoxExtent(FVector(220., 108., 100.));
    Collision->SetCollisionProfileName(TEXT("NoCollision"));
    Hull = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("VehicleHull"));
    Hull->SetCollisionProfileName(TEXT("Pawn"));
    Hull->SetVisibility(false);
    RootComponent = Hull;
    Collision->SetupAttachment(Hull);
    for (int32 Profile = 0; Profile < 3; ++Profile)
    {
        const FString Path = FString::Printf(TEXT("/Game/ParkComic/SM_CarCollision%d.SM_CarCollision%d"),Profile,Profile);
        ConstructorHelpers::FObjectFinder<UStaticMesh> Mesh(*Path);
        CollisionMeshes.Add(Mesh.Object);
    }
    Hull->SetStaticMesh(CollisionMeshes[0]);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    const auto Part = [this](const TCHAR* Name, UStaticMesh* Mesh, FVector Location, FVector Scale, FRotator Rotation = FRotator::ZeroRotator)
    {
        UStaticMeshComponent* Component = CreateDefaultSubobject<UStaticMeshComponent>(Name);
        Component->SetupAttachment(RootComponent);
        Component->SetStaticMesh(Mesh);
        Component->SetRelativeLocation(Location);
        Component->SetRelativeScale3D(Scale);
        Component->SetRelativeRotation(Rotation);
        Component->SetCollisionProfileName(TEXT("NoCollision"));
        Parts.Add(Component);
    };
    Part(TEXT("Body"), Cube.Object, FVector(0., 0., -25.), FVector(4.4, 1.8, .75));
    Part(TEXT("Glass"), Cube.Object, FVector(-20., 0., 47.), FVector(2.1, 1.6, .7));
    Part(TEXT("Roof"), Cube.Object, FVector(-20., 0., 85.), FVector(2.2, 1.7, .1));
    Part(TEXT("FrontLeftWheel"), Cylinder.Object, FVector(155., -95., -64.), FVector(.72, .72, .26), FRotator(0., 0., 90.));
    Part(TEXT("FrontRightWheel"), Cylinder.Object, FVector(155., 95., -64.), FVector(.72, .72, .26), FRotator(0., 0., 90.));
    Part(TEXT("RearLeftWheel"), Cylinder.Object, FVector(-155., -95., -64.), FVector(.72, .72, .26), FRotator(0., 0., 90.));
    Part(TEXT("RearRightWheel"), Cylinder.Object, FVector(-155., 95., -64.), FVector(.72, .72, .26), FRotator(0., 0., 90.));
    Part(TEXT("LeftHeadlight"), Cylinder.Object, FVector(222., -58., -20.), FVector(.35, .35, .08), FRotator(90.,0.,0.));
    Part(TEXT("RightHeadlight"), Cylinder.Object, FVector(222., 58., -20.), FVector(.35, .35, .08), FRotator(90.,0.,0.));
    Part(TEXT("LeftTaillight"), Cube.Object, FVector(-222., -58., -20.), FVector(.06, .42, .20));
    Part(TEXT("RightTaillight"), Cube.Object, FVector(-222., 58., -20.), FVector(.06, .42, .20));
    Part(TEXT("FrontBumper"), Cube.Object, FVector(220., 0., -51.), FVector(.16, 1.72, .12));
    Part(TEXT("RearBumper"), Cube.Object, FVector(-220., 0., -51.), FVector(.16, 1.72, .12));
    Part(TEXT("GrilleTrim"), Cube.Object, FVector(222., 0., -17.), FVector(.07, .58, .25));
    Part(TEXT("LeftMirror"), Cube.Object, FVector(58., -100., 29.), FVector(.32, .25, .19));
    Part(TEXT("RightMirror"), Cube.Object, FVector(58., 100., 29.), FVector(.32, .25, .19));
    for (int32 Side = 0; Side < 2; ++Side)
    {
        for (int32 Axle = 0; Axle < 2; ++Axle)
        {
            const FString Name = FString(Axle == 0 ? TEXT("Front") : TEXT("Rear")) + (Side == 0 ? TEXT("LeftWheel") : TEXT("RightWheel"));
            const FVector Location(Axle == 0 ? 155. : -155., Side == 0 ? -111. : 111., -64.);
            Part(*(Name + TEXT("Rim")), Cylinder.Object, Location, FVector(.44, .44, .07), FRotator(0., 0., 90.));
            Part(*(Name + TEXT("Spoke")), Cube.Object, Location + FVector(0., Side == 0 ? -4. : 4., 0.), FVector(.36, .07, .06), FRotator(0., 0., 90.));
        }
    }

    CameraArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraArm"));
    CameraArm->SetupAttachment(RootComponent);
    CameraArm->TargetArmLength = 720.f;
    CameraArm->SocketOffset = FVector(0., 0., 80.);
    CameraArm->bUsePawnControlRotation = false;
    CameraArm->SetUsingAbsoluteRotation(true);
    CameraArm->bEnableCameraLag = true;
    CameraArm->CameraLagSpeed = 7.f;
    CameraArm->CameraLagMaxDistance = 120.f;
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
    Camera->SetupAttachment(CameraArm, USpringArmComponent::SocketName);
    Camera->FieldOfView = 85.f;
    DriveAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("DriveAudio"));
    DriveAudio->SetupAttachment(RootComponent);
    DriveAudio->bAutoActivate = false;
    DriveAudio->bAllowSpatialization = false;
}

void AQuebecCar::BeginPlay()
{
    Super::BeginPlay();
    SetActorTickInterval(bTraffic ? .05f : .1f);
    SetNetCullDistanceSquared(FMath::Square(24000.f));
    // Saved levels can serialize the former box root; migrate only this car's attachments.
    const FTransform Transform = GetActorTransform();
    Collision->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (RootComponent != Hull)
    {
        Hull->DetachFromComponent(FDetachmentTransformRules::KeepWorldTransform);
        SetRootComponent(Hull);
        SetActorTransform(Transform);
        TArray<USceneComponent*> Children = Collision->GetAttachChildren();
        for (USceneComponent* Child : Children)
            if (Child != Hull) Child->AttachToComponent(Hull,FAttachmentTransformRules::KeepRelativeTransform);
        Collision->AttachToComponent(Hull,FAttachmentTransformRules::KeepRelativeTransform);
    }
    Collision->SetRelativeTransform(FTransform::Identity);
    GetComponents(Parts);
    // Livery and lamp pieces added by the street systems keep their own materials (POLICE, TRAFFIC: tag NordOwnPaint).
    Parts.RemoveAll([this](const UStaticMeshComponent* Part) { return Part == Hull || Part->IsEditorOnly() || Part->ComponentHasTag(TEXT("NordOwnPaint")); });
    for (UStaticMeshComponent* Part : Parts)
    {
        Part->SetCullDistance(20000.f);
        const FString Name = Part->GetName();
        const TCHAR* MeshName = Name == TEXT("Body") ? TEXT("CarShell") : Name == TEXT("Glass") ? TEXT("CarCabin") : Name == TEXT("Roof") ? TEXT("CarRoof") : nullptr;
        if (MeshName)
        {
            const FString MeshPath = FString::Printf(TEXT("/Game/ParkComic/SM_%s.SM_%s"), MeshName, MeshName);
            if (UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr,*MeshPath))
            {
                Part->SetStaticMesh(Mesh);
                Part->SetRelativeLocation(FVector::ZeroVector);
                Part->SetRelativeScale3D(FVector::OneVector);
            }
        }
        const TCHAR* MaterialName = Name.Contains(TEXT("Rim")) || Name.Contains(TEXT("Bumper")) || Name == TEXT("Roof") ? TEXT("M_White") :
            Name.Contains(TEXT("Wheel")) || Name.Contains(TEXT("Trim")) ? TEXT("M_Dark") :
            Name.Contains(TEXT("Glass")) ? TEXT("M_Glass") :
            Name.Contains(TEXT("Headlight")) ? TEXT("M_Light") :
            Name.Contains(TEXT("Taillight")) ? TEXT("M_Tail") : TEXT("M_CarBody");
        const FString Path = FString::Printf(TEXT("/Game/Materials/%s.%s"), MaterialName, MaterialName);
        if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, *Path)) Part->SetMaterial(0, Material);
        if (Name == TEXT("Body") && PaintStyle > 0)
        {
            const FString PaintPath = FString::Printf(TEXT("/Game/ParkComic/M_CarPaint%d.M_CarPaint%d"), PaintStyle % 4, PaintStyle % 4);
            if (UMaterialInterface* Paint = LoadObject<UMaterialInterface>(nullptr,*PaintPath)) Part->SetMaterial(0,Paint);
        }
    }
    ApplyPaint();
}

void AQuebecCar::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    bTraffic = false;
    TrafficSegment = INDEX_NONE;
    bJunctionReserved = bJunctionEntered = false;
    SetActorTickInterval(0.f);
    LastDriveInputTime = GetWorld()->GetTimeSeconds();
    LateralSpeed = DriveThrottle = SteeringState = 0.f;
    // Lag-tolerant driving: a player takes over from any AI driver, and the driven car updates at 60 Hz.
    ClearAutopilot();
    SetNetUpdateFrequency(60.f);
    // Server-only driving needs movement replication for the owning client too.
    SetAutonomousProxy(false);
    NewController->SetControlRotation(GetActorRotation() + FRotator(-12., 0., 0.));
    if (APlayerController* Player = Cast<APlayerController>(NewController))
        Player->ClientSetRotation(NewController->GetControlRotation());
}

void AQuebecCar::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveForward"), this, &AQuebecCar::MoveForward);
    Input->BindAxis(TEXT("MoveRight"), this, &AQuebecCar::MoveRight);
    Input->BindAxis(TEXT("Turn"), this, &AQuebecCar::LookYaw);
    Input->BindAxis(TEXT("LookUp"), this, &AQuebecCar::LookPitch);
    Input->BindAction(TEXT("Handbrake"), IE_Pressed, this, &AQuebecCar::ApplyHandbrake);
    Input->BindAction(TEXT("Handbrake"), IE_Released, this, &AQuebecCar::ReleaseHandbrake);
}

void AQuebecCar::PawnClientRestart()
{
    Super::PawnClientRestart();
    SetActorTickInterval(0.f);
    StopInput();
}

void AQuebecCar::MoveForward(float Value) { Throttle = FMath::IsFinite(Value) ? FMath::Clamp(Value,-1.f,1.f) : 0.f; }
void AQuebecCar::MoveRight(float Value) { Steering = FMath::IsFinite(Value) ? FMath::Clamp(Value,-1.f,1.f) : 0.f; }
void AQuebecCar::ApplyHandbrake() { bHandbrake = true; }
void AQuebecCar::ReleaseHandbrake() { bHandbrake = false; }
void AQuebecCar::LookYaw(float Value)
{
    if (Value != 0.f) LastLookTime = GetWorld()->GetTimeSeconds();
    AddControllerYawInput(Value);
}
void AQuebecCar::LookPitch(float Value)
{
    if (Value != 0.f) LastLookTime = GetWorld()->GetTimeSeconds();
    AddControllerPitchInput(Value);
}
void AQuebecCar::StopInput() { Throttle = Steering = DriveThrottle = 0.f; bHandbrake = false; }

void AQuebecCar::ResetMotion()
{
    if (!HasAuthority()) return;
    StopInput();
    Speed = LateralSpeed = VerticalSpeed = SteeringState = WheelSteering = VisualSteering = YawRate = KnockTime = 0.f;
    bGrounded = false;
    LastDriveInputTime = GetWorld()->GetTimeSeconds();
    ForceNetUpdate();
}

void AQuebecCar::ApplyPaint()
{
    const int32 Profile = FMath::Clamp(BodyProfile,0,2);
    Hull->SetStaticMesh(CollisionMeshes[Profile]);
    Hull->SetCollisionProfileName(TEXT("Pawn"));
    Hull->SetVisibility(false);
    const FString BodyPath = FString::Printf(TEXT("/Game/ParkComic/SM_Car70Body%d.SM_Car70Body%d"),Profile,Profile);
    if (UStaticMesh* BodyMesh = LoadObject<UStaticMesh>(nullptr,*BodyPath))
    {
        const FString PaintPath = FString::Printf(TEXT("/Game/ParkComic/M_Car70_Paint%d.M_Car70_Paint%d"),PaintStyle % 4,PaintStyle % 4);
        UMaterialInterface* Paint = LoadObject<UMaterialInterface>(nullptr,*PaintPath);
        for (UStaticMeshComponent* Part : Parts)
        {
            if (Part->ComponentHasTag(TEXT("NordOwnPaint"))) continue; // Street livery and lamps (POLICE, TRAFFIC).
            const FString Name = Part->GetName();
            FString MeshName;
            if (Name == TEXT("Body")) MeshName = FString::Printf(TEXT("Car70Body%d"),Profile);
            else if (Name == TEXT("Glass")) MeshName = FString::Printf(TEXT("Car70Cabin%d"),Profile);
            else if (Name == TEXT("Roof")) MeshName = FString::Printf(TEXT("Car70Roof%d"),Profile);
            else if (Name.EndsWith(TEXT("Wheel"))) MeshName = TEXT("Car70Tire");
            else if (Name.EndsWith(TEXT("WheelRim"))) MeshName = TEXT("Car70Rim");
            // Lamps, bumpers, mirrors and grille are now authored into the body mesh.
            Part->SetVisibility(!MeshName.IsEmpty());
            if (MeshName.IsEmpty()) continue;
            const FString MeshPath = FString::Printf(TEXT("/Game/ParkComic/SM_%s.SM_%s"),*MeshName,*MeshName);
            if (UStaticMesh* Mesh = Name == TEXT("Body") ? BodyMesh : LoadObject<UStaticMesh>(nullptr,*MeshPath))
            {
                Part->SetStaticMesh(Mesh);
                Part->SetRelativeScale3D(FVector::OneVector);
                if (!Name.Contains(TEXT("Wheel"))) Part->SetRelativeLocation(FVector::ZeroVector);
                else if (Name.EndsWith(TEXT("WheelRim")))
                {
                    FVector Location = Part->GetRelativeLocation();
                    Location.Y = Location.Y < 0. ? -106.5 : 106.5;
                    Part->SetRelativeLocation(Location);
                }
                const TArray<FStaticMaterial>& Materials = Mesh->GetStaticMaterials();
                for (int32 I = 0; I < Materials.Num(); ++I)
                    Part->SetMaterial(I,Paint && Materials[I].MaterialSlotName == TEXT("Paint") ? Paint : Mesh->GetMaterial(I));
            }
        }
        // A repaint must not wash out the police livery (street contract).
        if (bPolice) QuebecCrime::DecoratePoliceCar(this);
        return;
    }
    const FString Path = PaintStyle > 0
        ? FString::Printf(TEXT("/Game/ParkComic/M_CarPaint%d.M_CarPaint%d"), PaintStyle % 4, PaintStyle % 4)
        : TEXT("/Game/Materials/M_CarBody.M_CarBody");
    UMaterialInterface* Paint = LoadObject<UMaterialInterface>(nullptr,*Path);
    // Hatch, lower compact sedan, and long-roof wagon use the existing artwork.
    // Only the upper cabin changes: tires, body/wheel arches and collision stay aligned.
    const FVector CabinScale = Profile == 1 ? FVector(.78,1.,.85) : Profile == 2 ? FVector(1.27,1.,1.08) : FVector::OneVector;
    const FVector CabinOffset = Profile == 1 ? FVector(18.,0.,1.35) : Profile == 2 ? FVector(-12.,0.,-.72) : FVector::ZeroVector;
    for (UStaticMeshComponent* Part : Parts)
    {
        if (Part->ComponentHasTag(TEXT("NordOwnPaint"))) continue; // Street livery and lamps (POLICE, TRAFFIC).
        const FString Name = Part->GetName();
        if (Name == TEXT("Body") && Paint) Part->SetMaterial(0,Paint);
        if ((Name == TEXT("Glass") || Name == TEXT("Roof")) && Part->GetStaticMesh() &&
            Part->GetStaticMesh()->GetName().StartsWith(TEXT("SM_Car")))
        {
            Part->SetRelativeScale3D(CabinScale);
            Part->SetRelativeLocation(CabinOffset);
        }
    }
    if (bPolice) QuebecCrime::DecoratePoliceCar(this);
}

namespace
{
    const TArray<TArray<int32>>& TrafficRoadLinks()
    {
        static const TArray<TArray<int32>> Links = []
        {
            constexpr int32 Count = UE_ARRAY_COUNT(LaFontaine::RoadSegments);
            TArray<TArray<int32>> Result;
            Result.SetNum(Count*2);
            for (int32 I = 0; I < Count; ++I)
                for (int32 J = I+1; J < Count; ++J)
                    for (int32 A = 0; A < 2; ++A)
                        for (int32 B = 0; B < 2; ++B)
                            if (FVector::DistSquared2D(LaFontaine::RoadSegments[I][A],LaFontaine::RoadSegments[J][B]) <= FMath::Square(40.f))
                            {
                                Result[I*2+A].AddUnique(J);
                                Result[J*2+B].AddUnique(I);
                            }
            return Result;
        }();
        return Links;
    }

    void PruneTrafficBranches(TArray<bool>& Roads)
    {
        // Every retained endpoint needs an onward street, avoiding unsupported U-turns.
        const TArray<TArray<int32>>& Links = TrafficRoadLinks();
        bool bChanged;
        do
        {
            bChanged = false;
            for (int32 I = 0; I < Roads.Num(); ++I)
                if (Roads[I])
                    for (int32 Side = 0; Side < 2; ++Side)
                    {
                        bool bOnward = false;
                        for (int32 Next : Links[I*2+Side]) bOnward |= Roads[Next];
                        if (!bOnward) { Roads[I] = false; bChanged = true; break; }
                    }
        } while (bChanged);
    }

    const TArray<bool>& ClosedTrafficRoads()
    {
        // Only fixed surveyed connectivity is cached. World collision is checked per GameMode.
        static const TArray<bool> Roads = []
        {
            TArray<bool> Result;
            Result.Init(true,UE_ARRAY_COUNT(LaFontaine::RoadSegments));
            PruneTrafficBranches(Result);
            return Result;
        }();
        return Roads;
    }

    bool NextTrafficJunction(int32 Segment, bool bForward, const TArray<bool>& Roads, FVector& Junction)
    {
        // Collinear OSM waypoints are not junctions. Look through short inline
        // segments so traffic reserves the actual turn before reaching it.
        const TArray<TArray<int32>>& Links = TrafficRoadLinks();
        for (int32 Attempt = 0; Attempt < 16; ++Attempt)
        {
            const int32 EndSide = bForward ? 1 : 0;
            const FVector End = LaFontaine::RoadSegments[Segment][EndSide];
            const FVector Direction = (End-LaFontaine::RoadSegments[Segment][1-EndSide]).GetSafeNormal2D();
            int32 Next = INDEX_NONE, Count = 0;
            for (int32 I : Links[Segment*2+EndSide])
                if (Roads[I]) { Next = I; ++Count; }
            if (Count != 1) { Junction = End; return Count > 0; }
            bForward = FVector::DistSquared2D(End,LaFontaine::RoadSegments[Next][0]) <= FMath::Square(40.f);
            const FVector Out = (LaFontaine::RoadSegments[Next][bForward ? 1 : 0]-End).GetSafeNormal2D();
            if (FVector::DotProduct(Direction,Out) < .97f) { Junction = End; return true; }
            Segment = Next;
        }
        return false;
    }
}

void AQuebecCar::SetTrafficRoute(int32 Segment, bool bForward, const TArray<bool>& AllowedRoads)
{
    check(AllowedRoads.Num() == UE_ARRAY_COUNT(LaFontaine::RoadSegments) && AllowedRoads.IsValidIndex(Segment) && AllowedRoads[Segment]);
    TrafficRoadMask = AllowedRoads;
    TrafficSegment = Segment;
    bTrafficForward = bForward;
    TrafficTurns = Segment % 7;
    bJunctionReserved = bJunctionEntered = false;
    bTraffic = true;
    SetActorTickInterval(.05f);
}

void AQuebecCar::UpdateTraffic()
{
    if (TrafficSegment == INDEX_NONE) { StopInput(); return; }
    if (bJunctionReserved)
    {
        const double Distance = FVector::DistSquared2D(GetActorLocation(),TrafficJunction);
        if (Distance < FMath::Square(800.f)) bJunctionEntered = true;
        if (bJunctionEntered && Distance > FMath::Square(1100.f)) bJunctionReserved = false;
    }
    bool bWaitForJunction = false;
    FVector Junction;
    if (!bJunctionReserved && NextTrafficJunction(TrafficSegment,bTrafficForward,TrafficRoadMask,Junction) &&
        FVector::DistSquared2D(GetActorLocation(),Junction) < FMath::Square(1400.f))
    {
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
            if (*It != this && It->bTraffic && It->bJunctionReserved &&
                !(It->bJunctionEntered && FVector::DistSquared2D(It->GetActorLocation(),It->TrafficJunction)>FMath::Square(1100.f)) &&
                FVector::DistSquared2D(Junction,It->TrafficJunction) < FMath::Square(1600.f))
            { bWaitForJunction = true; break; }

        if (!bWaitForJunction)
        {
            TrafficJunction = Junction;
            bJunctionReserved = true;
            bJunctionEntered = FVector::DistSquared2D(GetActorLocation(),Junction) < FMath::Square(800.f);
        }
    }
    FVector End = LaFontaine::RoadSegments[TrafficSegment][bTrafficForward ? 1 : 0];
    FVector Direction = (End - LaFontaine::RoadSegments[TrafficSegment][bTrafficForward ? 0 : 1]).GetSafeNormal2D();
    FVector Target = End + FVector::CrossProduct(FVector::UpVector, Direction) * 145.f;
    if (FVector::DistSquared2D(GetActorLocation(), Target) < FMath::Square(300.f))
    {
        int32 Next = INDEX_NONE;
        bool bForward = true;
        float Best = -2.f;
        ++TrafficTurns;
        for (int32 I = 0; I < UE_ARRAY_COUNT(LaFontaine::RoadSegments); ++I)
        {
            if (I == TrafficSegment || !TrafficRoadMask[I]) continue;
            for (int32 Side = 0; Side < 2; ++Side)
            {
                if (FVector::DistSquared2D(End, LaFontaine::RoadSegments[I][Side]) > FMath::Square(40.f)) continue;
                const FVector Out = (LaFontaine::RoadSegments[I][1-Side] - End).GetSafeNormal2D();
                if (Out.IsNearlyZero()) continue;
                const float Choice = ((I * 37 + TrafficTurns * 17) % 101) / 100.f;
                const float Score = FVector::DotProduct(Direction, Out) * (TrafficTurns % 3 ? 1.f : .2f) + Choice * .5f;
                if (Score > Best) { Best = Score; Next = I; bForward = Side == 0; }
            }
        }
        if (Next == INDEX_NONE) { StopInput(); bHandbrake = true; return; }
        TrafficSegment = Next;
        bTrafficForward = bForward;
        End = LaFontaine::RoadSegments[Next][bForward ? 1 : 0];
        Direction = (End - LaFontaine::RoadSegments[Next][bForward ? 0 : 1]).GetSafeNormal2D();
    }
    const FVector LaneStart = LaFontaine::RoadSegments[TrafficSegment][bTrafficForward ? 0 : 1] +
        FVector::CrossProduct(FVector::UpVector,Direction)*145.f;
    const float Projection = FVector::DotProduct(GetActorLocation()-LaneStart,Direction);
    const float LookAhead = 450.f+FMath::Abs(Speed)*.3f;
    const float Along = FMath::Clamp(Projection+LookAhead,0.f,float(FVector::DotProduct(End-LaneStart,Direction)));
    // Traffic street life: a curb stop slides the steering target toward the curb and back; zero while cruising.
    Target = LaneStart+Direction*Along+FVector::CrossProduct(FVector::UpVector,Direction)*TrafficCurbShift(Along);
    const float Error = FMath::FindDeltaAngleDegrees(GetActorRotation().Yaw, (Target - GetActorLocation()).Rotation().Yaw);
    Steering = FMath::Clamp(Error / 35.f, -1.f, 1.f);
    float DesiredSpeed = bWaitForJunction ? 0.f : (FMath::Abs(Error) > 35.f ? 230.f : 570.f+40.f*(FMath::Abs(PaintStyle)%4));
    // Traffic street life: full stops at ARRÊT junctions, people in the lane ahead, curb stops (QuebecTrafficLife.cpp).
    DesiredSpeed = UpdateTrafficLife(DesiredSpeed,Direction,Projection);
    FCollisionQueryParams Query(SCENE_QUERY_STAT(TrafficYield), false, this);
    FHitResult Ahead;
    for (int32 Attempt = 0; Attempt < 4; ++Attempt)
    {
        if (!GetWorld()->SweepSingleByChannel(Ahead, GetActorLocation(),
            GetActorLocation() + GetActorForwardVector() * (450.f + FMath::Abs(Speed) * .8f), GetActorQuat(), ECC_Pawn,
            FCollisionShape::MakeBox(FVector(235.,110.,80.)), Query)) break;
        const AQuebecCar* Other = Cast<AQuebecCar>(Ahead.GetActor());
        // Give crossing traffic a stable priority; following cars always yield.
        // The actual movement sweep still blocks every car, including priority traffic.
        if (Other && Other->bTraffic && ((bJunctionReserved && !Other->bJunctionReserved) ||
            (!bWaitForJunction && GetUniqueID() < Other->GetUniqueID())) &&
            FVector::DotProduct(GetActorForwardVector(),Other->GetActorForwardVector()) < .65f)
        {
            Query.AddIgnoredActor(Other);
            continue;
        }
        DesiredSpeed = 0.f;
        break;
    }
    // A blocked approach must not reserve an empty junction indefinitely.
    // Once inside, retain priority until the car has cleared the junction.
    if (DesiredSpeed == 0.f && !bJunctionEntered) bJunctionReserved = false;
    bHandbrake = DesiredSpeed == 0.f;
    Throttle = DesiredSpeed > Speed + 40.f ? .65f : (Speed > DesiredSpeed + 40.f ? -.6f : 0.f);
}

void AQuebecCar::ServerSetDrive_Implementation(float NewThrottle, float NewSteering, bool bNewHandbrake)
{
    if (!Controller || !Occupant || !FMath::IsFinite(NewThrottle) || !FMath::IsFinite(NewSteering)) return;
    LastDriveInputTime = GetWorld()->GetTimeSeconds();
    Throttle = FMath::Clamp(NewThrottle, -1.f, 1.f);
    Steering = FMath::Clamp(NewSteering, -1.f, 1.f);
    bHandbrake = bNewHandbrake;
}

void AQuebecCar::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!FMath::IsFinite(DeltaSeconds) || DeltaSeconds <= 0.f) return;
    const float SpeedRatio = FMath::Clamp(FMath::Abs(Speed)/3000.f,0.f,1.f);
    WheelSteering = FMath::FInterpTo(WheelSteering,IsLocallyControlled() ? Steering : VisualSteering,DeltaSeconds,10.f);
    WheelAngle = FMath::Fmod(WheelAngle+FMath::RadiansToDegrees(Speed*DeltaSeconds/36.f),360.f);
    const float WheelLock = bTraffic ? 28.f : FMath::Lerp(30.f,4.2f,FMath::SmoothStep(0.f,2400.f,FMath::Abs(Speed)));
    for (UStaticMeshComponent* Part : Parts)
        if (Part->GetName().Contains(TEXT("Wheel")))
            Part->SetRelativeRotation(FRotator(0.,Part->GetName().StartsWith(TEXT("Front")) ? WheelSteering*WheelLock : 0.,0.).Quaternion()*
                FQuat(FVector::RightVector,FMath::DegreesToRadians(WheelAngle))*FRotator(0.,0.,90.).Quaternion());
    if (IsLocallyControlled() && Controller)
    {
        Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView,85.f+12.f*SpeedRatio,DeltaSeconds,3.f));
        CameraArm->TargetArmLength = FMath::FInterpTo(CameraArm->TargetArmLength,690.f+130.f*SpeedRatio,DeltaSeconds,3.f);
        CameraArm->SocketOffset.Z = FMath::FInterpTo(CameraArm->SocketOffset.Z,90.f+25.f*SpeedRatio,DeltaSeconds,3.f);
        if (FMath::Abs(Speed)>100.f && GetWorld()->GetTimeSeconds()-LastLookTime>1.8f)
        {
            const float SlipLook = FMath::RadiansToDegrees(FMath::Atan2(LateralSpeed,FMath::Max(300.f,FMath::Abs(Speed))));
            const FRotator Target(-12.f,GetActorRotation().Yaw+FMath::Clamp(SlipLook,-16.f,16.f)*.35f,0.f);
            Controller->SetControlRotation(FMath::RInterpTo(Controller->GetControlRotation(),Target,DeltaSeconds,3.f+SpeedRatio*1.5f));
        }
        if (!HasAuthority()) ServerSetDrive(Throttle,Steering,bHandbrake);
    }
    KeepCharacterInView(CameraArm, GetViewRotation());
    UpdateDriveAudio(DeltaSeconds);
    // Street traces: tyre marks on every peer while the car moves, and smoke from a battered car.
    if (!FMath::IsNearlyZero(Speed,1.f) || !FMath::IsNearlyZero(LateralSpeed,1.f)) QuebecTraces::TickCar(this,DeltaSeconds);
    UpdateDamageSmoke(DeltaSeconds);
    UpdateExhaust(DeltaSeconds);
    if (!HasAuthority()) return;
    if (bTraffic && !Controller) UpdateTraffic();
    // An AI driver (police, side jobs) writes the same inputs a player would.
    const bool bAIDriver = bAutopilot && !Controller;
    if (bAIDriver) { Throttle = AutopilotThrottle; Steering = AutopilotSteering; bHandbrake = bAutopilotHandbrake; }
    // Lost input/disconnected occupancy brakes safely instead of retaining throttle.
    const bool bFailsafe = !bTraffic && !bAIDriver && (!Controller || (!IsLocallyControlled() && GetWorld()->GetTimeSeconds()-LastDriveInputTime>.5f));
    if (bFailsafe) StopInput();
    // A wreck ignores throttle; steering, brakes and the handbrake still work.
    if (IsWrecked()) Throttle = DriveThrottle = 0.f;
    PrepareDriveAssist();
    const FVector StrikeFrom = GetActorLocation();
    const bool bStriker = Controller || bAIDriver || KnockTime > 0.f;
    if (bTraffic)
    {
        // Keep the already-tested route follower and junction timing unchanged.
        SimulateDrive(FMath::Min(DeltaSeconds,.05f),false);
    }
    else
    {
        // Small swept steps keep steering/grip stable at both high and low render rates.
        float Remaining = FMath::Min(DeltaSeconds,.15f);
        while (Remaining>UE_SMALL_NUMBER)
        {
            const float Step = FMath::Min(Remaining,1.f/60.f);
            SimulateDrive(Step,bFailsafe);
            Remaining -= Step;
        }
    }
    VisualSteering = bTraffic ? Steering : SteeringState;
    // Street contract: strikes on people and props, passed bodies and the stuck nudge.
    FinishDriveTick(StrikeFrom,bStriker,DeltaSeconds);
}

void AQuebecCar::SimulatePedalo(float Step, bool bFailsafe)
{
    const float ThrottleNow = bFailsafe ? 0.f : Throttle;
    const bool bOnWater = QuebecPondContains(static_cast<float>(GetActorLocation().X), static_cast<float>(GetActorLocation().Y));
    Speed = QuebecRide::Advance(Speed, ThrottleNow, bOnWater, Step);
    LateralSpeed = 0.f;
    SteeringState = Steering;
    if (FMath::Abs(Speed) > 15.f)
    {
        const float Turn = QuebecRide::YawDegrees(Speed, Steering, Step);
        const FQuat Rotation = (GetActorRotation() + FRotator(0., Turn, 0.)).Quaternion();
        if (CanFitAt(GetActorLocation(), Rotation)) SetActorRotation(Rotation);
    }
    const FVector Travel = GetActorForwardVector().GetSafeNormal2D() * Speed * Step;
    MoveWithCollision(Step, Travel);
}

void AQuebecCar::SimulateBike(float Step, bool bFailsafe)
{
    const float ThrottleNow = bFailsafe ? 0.f : Throttle;
    const bool bInWater = QuebecPondContains(static_cast<float>(GetActorLocation().X), static_cast<float>(GetActorLocation().Y));
    Speed = QuebecCycle::Advance(Speed, ThrottleNow, bInWater, Step);
    LateralSpeed = 0.f;
    SteeringState = Steering;
    if (FMath::Abs(Speed) > 15.f)
    {
        const float Turn = QuebecCycle::YawDegrees(Speed, Steering, Step);
        const FQuat Rotation = (GetActorRotation() + FRotator(0., Turn, 0.)).Quaternion();
        if (CanFitAt(GetActorLocation(), Rotation)) SetActorRotation(Rotation);
    }
    const FVector Travel = GetActorForwardVector().GetSafeNormal2D() * Speed * Step;
    MoveWithCollision(Step, Travel);
}

void AQuebecCar::SimulateScoot(float Step, bool bFailsafe)
{
    const float ThrottleNow = bFailsafe ? 0.f : Throttle;
    const bool bInWater = QuebecPondContains(static_cast<float>(GetActorLocation().X), static_cast<float>(GetActorLocation().Y));
    Speed = QuebecScoot::Advance(Speed, ThrottleNow, bInWater, Step);
    LateralSpeed = 0.f;
    SteeringState = Steering;
    if (FMath::Abs(Speed) > 15.f)
    {
        const float Turn = QuebecScoot::YawDegrees(Speed, Steering, Step);
        const FQuat Rotation = (GetActorRotation() + FRotator(0., Turn, 0.)).Quaternion();
        if (CanFitAt(GetActorLocation(), Rotation)) SetActorRotation(Rotation);
    }
    const FVector Travel = GetActorForwardVector().GetSafeNormal2D() * Speed * Step;
    MoveWithCollision(Step, Travel);
}

void AQuebecCar::SimulateDrive(float Step, bool bFailsafe)
{
    if (IsPedalo())
    {
        SimulatePedalo(Step, bFailsafe);
        return;
    }
    if (IsBike())
    {
        SimulateBike(Step, bFailsafe);
        return;
    }
    if (IsScoot())
    {
        SimulateScoot(Step, bFailsafe);
        return;
    }
    if (KnockTime > 0.f)
    {
        // Struck: tyres scrub instead of rolling, so the car slides, spins and bleeds speed until it settles.
        KnockTime -= Step;
        Speed = FMath::FInterpConstantTo(Speed,0.f,Step,650.f);
        LateralSpeed = FMath::FInterpConstantTo(LateralSpeed,0.f,Step,900.f);
        YawRate = FMath::FInterpConstantTo(YawRate,0.f,Step,220.f);
        if (!FMath::IsNearlyZero(YawRate))
        {
            const FQuat Rotation = (GetActorRotation()+FRotator(0.,YawRate*Step,0.)).Quaternion();
            if (CanFitAt(GetActorLocation(),Rotation)) SetActorRotation(Rotation);
        }
        MoveWithCollision(Step,PlanarVelocity()*Step);
        if (KnockTime <= 0.f || (FMath::Abs(Speed)<20.f && FMath::Abs(LateralSpeed)<20.f && FMath::Abs(YawRate)<5.f))
        {
            KnockTime = YawRate = 0.f;
            // An AI driver (autopilot) drives on after a shove, like a player.
            if (!Controller && !bAutopilot) { Speed = LateralSpeed = 0.f; SetActorTickInterval(bTraffic ? .05f : .1f); }
        }
        return;
    }
    if (bTraffic)
    {
        LateralSpeed = 0.f;
        if (bHandbrake) Speed = FMath::FInterpConstantTo(Speed,0.f,Step,3200.f);
        else
        {
            Speed = FMath::Clamp(Speed+Throttle*(Throttle*Speed<0.f ? 2400.f : 1250.f)*Step,-850.f,2400.f);
            if (FMath::IsNearlyZero(Throttle)) Speed = FMath::FInterpConstantTo(Speed,0.f,Step,800.f);
        }
    }
    else
    {
        DriveThrottle = FMath::FInterpConstantTo(DriveThrottle,Throttle,Step,5.f);
        // Lag-tolerant driving: graded levels ease back as fast as a release, and on roads high-speed turn-in is calmer.
        const float SteeringRate = QuebecSteer::TurnInRate(Speed,Steering,SteeringState,bSteerAssist);
        SteeringState = FMath::FInterpConstantTo(SteeringState,Steering,Step,SteeringRate);
        if (bFailsafe || bHandbrake)
            Speed = FMath::FInterpConstantTo(Speed,0.f,Step,bFailsafe ? 1600.f : 2300.f);
        else if (Throttle*Speed<0.f)
        {
            // S first uses the service brake; reverse engages only after stopping.
            Speed = FMath::FInterpConstantTo(Speed,0.f,Step,3200.f*FMath::Abs(Throttle));
            if (Speed == 0.f) DriveThrottle = 0.f;
        }
        else if (!FMath::IsNearlyZero(Throttle,.01f))
        {
            const float CornerSpeed = FMath::Lerp(2400.f,900.f,FMath::Clamp((FMath::Abs(SteeringState)-.2f)/.8f,0.f,1.f));
            // Ease off power through tight forward turns; reverse and deliberate handbrake slides stay manual.
            if (Throttle>0.f && FMath::Abs(SteeringState)>.2f && Speed>CornerSpeed)
                Speed = FMath::FInterpConstantTo(Speed,CornerSpeed,Step,1200.f);
            else
            {
                const float Power = FMath::Lerp(1050.f,700.f,FMath::Clamp(FMath::Abs(Speed)/3000.f,0.f,1.f));
                const float RequestedPower = FMath::Max(0.f,DriveThrottle*FMath::Sign(Throttle))*FMath::Sign(Throttle);
                Speed += RequestedPower*Power*Step;
                Speed = FMath::FInterpConstantTo(Speed,0.f,Step,100.f+FMath::Square(Speed)*.000035f);
            }
        }
        else Speed = FMath::FInterpConstantTo(Speed,0.f,Step,360.f+FMath::Square(Speed)*.000035f);
        Speed = FMath::Clamp(Speed,-950.f,3000.f);
    }
    const FVector Momentum = GetActorForwardVector().GetSafeNormal2D()*Speed+GetActorRightVector().GetSafeNormal2D()*LateralSpeed;
    if (FMath::Abs(Speed)>15.f)
    {
        float Turn = Steering*140.f*FMath::Clamp(Speed/300.f,-1.f,1.f)*Step;
        if (!bTraffic)
        {
            const float Lock = FMath::Lerp(30.f,4.2f,FMath::SmoothStep(0.f,2400.f,FMath::Abs(Speed)));
            float SteeringYawRate = FMath::RadiansToDegrees(Speed/310.f*FMath::Tan(FMath::DegreesToRadians(SteeringState*Lock)));
            if (bHandbrake && FMath::Abs(Speed)>450.f) SteeringYawRate *= 1.4f;
            Turn = FMath::Clamp(SteeringYawRate,-110.f,110.f)*Step;
            // On a road a player car damps leftover yaw and straightens along the street near the wheel's centre.
            if (bSteerAssist) Turn = AssistedYawRate()*Step;
        }
        const FQuat Rotation = (GetActorRotation()+FRotator(0.,Turn,0.)).Quaternion();
        if (CanFitAt(GetActorLocation(),Rotation)) SetActorRotation(Rotation);
        else if (bSteerAssist)
        {
            // Against a wall, a partial turn still lets the driver steer away instead of feeling stuck.
            const FQuat Partial = (GetActorRotation()+FRotator(0.,Turn*.4f,0.)).Quaternion();
            if (CanFitAt(GetActorLocation(),Partial)) SetActorRotation(Partial);
        }
    }
    if (!bTraffic)
    {
        Speed = FVector::DotProduct(Momentum,GetActorForwardVector().GetSafeNormal2D());
        LateralSpeed = FVector::DotProduct(Momentum,GetActorRightVector().GetSafeNormal2D());
        const bool bCounterSteering = Steering*LateralSpeed>50.f;
        const float Grip = bHandbrake && !bFailsafe ? 1.15f : (bCounterSteering ? 11.f : 8.f);
        LateralSpeed = FMath::FInterpTo(LateralSpeed,0.f,Step,Grip);
        LateralSpeed = FMath::Clamp(LateralSpeed,-FMath::Abs(Speed)*.7f-80.f,FMath::Abs(Speed)*.7f+80.f);
        if (bFailsafe || FMath::Abs(Speed)<100.f)
            LateralSpeed = FMath::FInterpConstantTo(LateralSpeed,0.f,Step,3600.f);
        if (FMath::Abs(Speed)<1.f && FMath::Abs(Throttle)<.01f) Speed=0.f;
    }
    MoveWithCollision(Step,(GetActorForwardVector().GetSafeNormal2D()*Speed+GetActorRightVector().GetSafeNormal2D()*LateralSpeed)*Step);
}

QuebecCarImpact::FResult QuebecCarImpact::Resolve(const FVector& VelocityA, const FVector& VelocityB, const FVector& Normal,
    const FVector& ArmA, const FVector& ArmB)
{
    FResult Result;
    const FVector N = Normal.GetSafeNormal2D();
    const FVector Relative = FVector(VelocityA.X-VelocityB.X,VelocityA.Y-VelocityB.Y,0.);
    const double Closing = FVector::DotProduct(Relative,N);
    // Resting or separating contact exchanges nothing; it only blocks.
    if (N.IsNearlyZero() || Closing > -60.) return Result;
    // Equal masses: each car takes half of the (1 + restitution) normal exchange, which conserves momentum.
    constexpr double Restitution = .25;
    const double Normal_J = -(1.+Restitution)*Closing*.5;
    Result.DeltaA = N*Normal_J;
    // Scraping friction resists the sideways slide between the bodies, never reversing it.
    const FVector Tangent = Relative-N*Closing;
    const double TangentSpeed = Tangent.Size();
    if (TangentSpeed > 1.) Result.DeltaA -= Tangent/TangentSpeed*FMath::Min(.3*Normal_J,TangentSpeed*.5);
    // Off-centre hits spin each car: yaw change = (arm x impulse) / box inertia (4.6 m x 1.9 m), damped for road tyres.
    constexpr double InertiaScale = 12./(460.*460.+190.*190.);
    const auto Spin = [](const FVector& Arm, const FVector& Delta)
    {
        const double Radians = InertiaScale*(Arm.X*Delta.Y-Arm.Y*Delta.X);
        return static_cast<float>(FMath::Clamp(FMath::RadiansToDegrees(Radians)*.45,-180.,180.));
    };
    Result.SpinA = Spin(ArmA,Result.DeltaA);
    Result.SpinB = Spin(ArmB,-Result.DeltaA);
    Result.bImpact = true;
    return Result;
}

FVector AQuebecCar::PlanarVelocity() const
{
    return GetActorForwardVector().GetSafeNormal2D()*Speed+GetActorRightVector().GetSafeNormal2D()*LateralSpeed;
}

void AQuebecCar::ReceiveImpact(const FVector& DeltaVelocity, float DeltaSpin, float KnockSeconds)
{
    if (!HasAuthority() || !FMath::IsFinite(DeltaSpin) || DeltaVelocity.ContainsNaN()) return;
    const FVector Velocity = PlanarVelocity()+FVector(DeltaVelocity.X,DeltaVelocity.Y,0.);
    Speed = FMath::Clamp(FVector::DotProduct(Velocity,GetActorForwardVector().GetSafeNormal2D()),-3000.,3000.);
    LateralSpeed = FMath::Clamp(FVector::DotProduct(Velocity,GetActorRightVector().GetSafeNormal2D()),-3000.,3000.);
    YawRate = FMath::Clamp(YawRate+DeltaSpin,-240.f,240.f);
    KnockTime = FMath::Max(KnockTime,KnockSeconds);
    bGrounded = false;
    // Parked and traffic cars tick slowly; a struck car moves every frame until it settles.
    SetActorTickInterval(0.f);
    ForceNetUpdate();
}

bool AQuebecCar::CanFitAt(const FVector& Point, const FQuat& Rotation, const AActor* Ignore) const
{
    TArray<FOverlapResult> Hits;
    FComponentQueryParams Query(SCENE_QUERY_STAT(CarHullFit),this);
    if (Ignore) Query.AddIgnoredActor(Ignore);
    if (Occupant) Query.AddIgnoredActor(Occupant);
    // People this car knocked down do not block it while they tumble (street contract).
    for (const TWeakObjectPtr<AActor>& Passed : PassedBodies) if (Passed.IsValid()) Query.AddIgnoredActor(Passed.Get());
    Hull->ComponentOverlapMulti(Hits,GetWorld(),Point,Rotation,ECC_Pawn,Query);
    for (const FOverlapResult& Hit : Hits) if (Hit.bBlockingHit) return false;
    return true;
}

bool AQuebecCar::WheelSupport(const FVector& Point, FRotator& Rotation, double& Height, bool& bTooHigh) const
{
    bTooHigh = false;
    double Ground[4];
    const FQuat Yaw = FRotator(0.,Rotation.Yaw,0.).Quaternion();
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CarWheelGround),true,this);
    for (int32 I = 0; I < 4; ++I)
    {
        const FVector Foot = Point+Yaw.RotateVector(FVector(I < 2 ? 155. : -155.,I%2 ? 95. : -95.,-100.));
        FHitResult Hit;
        if (!GetWorld()->LineTraceSingleByObjectType(Hit,Foot+FVector(0.,0.,80.),Foot-FVector(0.,0.,250.),
            FCollisionObjectQueryParams(ECC_WorldStatic),Query) || Hit.ImpactNormal.Z < .65f) return false;
        Ground[I] = Hit.ImpactPoint.Z;
        if (Ground[I]-Foot.Z>22.) { bTooHigh = true; return false; }
    }
    Rotation.Pitch = FMath::RadiansToDegrees(FMath::Atan2((Ground[0]+Ground[1]-Ground[2]-Ground[3])*.5,310.));
    Rotation.Roll = -FMath::RadiansToDegrees(FMath::Atan2((Ground[1]+Ground[3]-Ground[0]-Ground[2])*.5,190.));
    if (FMath::Abs(Rotation.Pitch)>15. || FMath::Abs(Rotation.Roll)>15.) return false;
    Height = -DBL_MAX;
    for (int32 I = 0; I < 4; ++I)
        Height = FMath::Max(Height,Ground[I]-Rotation.RotateVector(FVector(I < 2 ? 155. : -155.,I%2 ? 95. : -95.,-100.)).Z);
    return true;
}

void AQuebecCar::MoveWithCollision(float Step, const FVector& Travel)
{
    // shortcut: wheel-supported arcade motion; use Chaos Vehicles for jumps and tire-force simulation.
    if (Travel.IsNearlyZero() && bGrounded && GroundedTransform.Equals(GetActorTransform(),.01)) return;
    const FVector Before = GetActorLocation();
    FHitResult Hit;
    AddActorWorldOffset(Travel,true,&Hit);
    // Street contract: a striking car knocks down the player or officer it meets and drives on past them.
    FVector Unswept = Travel;
    if (Hit.bBlockingHit && HasAuthority() && PassStruckPerson(Hit,Before,Travel))
    {
        Unswept = Travel*(1.-Hit.Time);
        AddActorWorldOffset(Unswept,true,&Hit);
    }
    if (Hit.bBlockingHit)
    {
        const FVector Normal = Hit.Normal.GetSafeNormal2D();
        FVector Velocity = PlanarVelocity();
        AQuebecCar* Other = HasAuthority() ? Cast<AQuebecCar>(Hit.GetActor()) : nullptr;
        if (Other && Other != this)
        {
            // Another car is a body, not a wall: trade momentum so the struck car is shoved and spun.
            const FVector OtherVelocity = Other->PlanarVelocity();
            const QuebecCarImpact::FResult Impact = QuebecCarImpact::Resolve(Velocity,OtherVelocity,Normal,
                Hit.ImpactPoint-GetActorLocation(),Hit.ImpactPoint-Other->GetActorLocation());
            if (Impact.bImpact)
            {
                // Dents both bodies and reports a player's ram on a driven car (street contract).
                OnCarImpact(Other,static_cast<float>(-FVector::DotProduct(Velocity-OtherVelocity,Normal)),Hit.ImpactPoint);
                Velocity += Impact.DeltaA;
                YawRate = FMath::Clamp(YawRate+Impact.SpinA,-240.f,240.f);
                if (!FMath::IsNearlyZero(Impact.SpinA,2.f)) KnockTime = FMath::Max(KnockTime,Controller ? .35f : 1.5f);
                Other->ReceiveImpact(-Impact.DeltaA,Impact.SpinB,Other->Controller ? .35f : 1.5f);
            }
            // Only the closing speed relative to the other car is lost, so a pushing car keeps pace behind it.
            Velocity -= Normal*FMath::Min(0.,FVector::DotProduct(Velocity-Other->PlanarVelocity(),Normal));
        }
        else
        {
            // Walls keep the sliding speed. Hard hits dent the body; on a road a glancing scrape turns the nose along.
            if (!(Hit.GetActor() && QuebecPeople::IsPerson(Hit.GetActor()))) OnWallImpact(Normal,static_cast<float>(-FVector::DotProduct(Velocity,Normal)),Step);
            Velocity -= Normal*FMath::Min(0.,FVector::DotProduct(Velocity,Normal));
        }
        Speed = FVector::DotProduct(Velocity,GetActorForwardVector().GetSafeNormal2D());
        LateralSpeed = FVector::DotProduct(Velocity,GetActorRightVector().GetSafeNormal2D());
        AddActorWorldOffset(FVector::VectorPlaneProject(Unswept*(1.-Hit.Time),Normal),true);
    }
    FRotator SupportRotation = GetActorRotation();
    double SupportZ;
    bool bTooHigh;
    bGrounded = WheelSupport(GetActorLocation(),SupportRotation,SupportZ,bTooHigh) && SupportZ <= Before.Z+22.;
    if (bTooHigh)
    {
        SetActorLocation(Before);
        // A step too high to climb stops only the speed into its face; the car keeps sliding along it.
        if (!SlideAlongStep(Before,Travel)) Speed = LateralSpeed = 0.f;
        bGrounded = WheelSupport(GetActorLocation(),SupportRotation,SupportZ,bTooHigh);
    }
    if (bGrounded && SupportZ >= GetActorLocation().Z-4.)
    {
        FVector Supported = GetActorLocation(); Supported.Z = SupportZ+.5;
        if (CanFitAt(Supported,SupportRotation.Quaternion()))
        {
            SetActorLocationAndRotation(Supported,SupportRotation,false,nullptr,ETeleportType::TeleportPhysics);
            VerticalSpeed = 0.f;
            GroundedTransform = GetActorTransform();
            return;
        }
        bGrounded = false;
    }
    VerticalSpeed -= 980.f*Step;
    FVector Falling = GetActorLocation(); Falling.Z += VerticalSpeed*Step;
    if (bGrounded && Falling.Z <= SupportZ+.5)
    {
        Falling.Z = SupportZ+.5;
        SetActorRotation(SupportRotation);
        VerticalSpeed = 0.f;
    }
    else bGrounded = false;
    SetActorLocation(Falling,true,&Hit);
    if (Hit.bBlockingHit) VerticalSpeed = 0.f;
    if (bGrounded) GroundedTransform = GetActorTransform();
    if (GetActorLocation().Z < -1500.)
    {
        SetActorLocation(QuebecDistrict::ForWorld(GetWorld()).CarSpawn);
        Speed = LateralSpeed = VerticalSpeed = 0.f;
        bGrounded = false;
    }
}

void AQuebecCar::UpdateDriveAudio(float DeltaSeconds)
{
    if (!GetWorld()->AllowAudioPlayback() || GetNetMode()==NM_DedicatedServer) return;
    if (!IsLocallyControlled() || !Controller || !Occupant)
    {
        if (DriveAudio->IsPlaying()) { DriveAudio->Stop(); if (DriveWave) DriveWave->ResetAudio(); }
        return;
    }
    if (!DriveWave)
    {
        DriveWave=NewObject<USoundWaveProcedural>(this);
        DriveWave->SetSampleRate(24000);
        DriveWave->NumChannels=1;
        DriveWave->Duration=INDEFINITELY_LOOPING_DURATION;
        DriveAudio->SetSound(DriveWave);
    }
    const float SpeedRatio=FMath::Clamp(FMath::Abs(Speed)/3000.f,0.f,1.f);
    const float GearPhase=Speed<0.f ? FMath::Abs(Speed)/1900.f : FMath::Fmod(FMath::Abs(Speed),650.f)/650.f;
    const float Load=bHandbrake ? 0.f : FMath::Max(0.f,Throttle);
    AudioFrequency=FMath::FInterpTo(AudioFrequency,32.f+45.f*SpeedRatio+38.f*GearPhase+12.f*Load,DeltaSeconds,8.f);
    const float Tire=FMath::Clamp(FMath::Abs(LateralSpeed)/450.f+(bHandbrake ? SpeedRatio*.3f : 0.f),0.f,1.f);
    const int32 Frames=FMath::Clamp(3600-DriveWave->GetAvailableAudioByteCount()/2,0,3600);
    if (Frames>0)
    {
        TArray<int16> PCM; PCM.SetNumUninitialized(Frames);
        for (int16& Sample : PCM)
        {
            AudioPhase=FMath::Fmod(AudioPhase+AudioFrequency/24000.f,1.f);
            TirePhase=FMath::Fmod(TirePhase+(750.f+700.f*Tire)/24000.f,1.f);
            AudioNoise=AudioNoise*1664525u+1013904223u;
            const float Noise=float(AudioNoise>>8)/8388607.5f-1.f;
            const float Engine=(FMath::Sin(AudioPhase*2.f*PI)+.4f*FMath::Sin(AudioPhase*4.f*PI)+.18f*FMath::Sin(AudioPhase*8.f*PI))*(.045f+.025f*Load+.015f*SpeedRatio);
            const float Squeal=Tire*.045f*(Noise*.35f+FMath::Sin(TirePhase*2.f*PI)*.65f);
            Sample=int16(FMath::Clamp(Engine+Squeal,-1.f,1.f)*32767.f);
        }
        DriveWave->QueueAudio(reinterpret_cast<const uint8*>(PCM.GetData()),PCM.Num()*sizeof(int16));
    }
    if (!DriveAudio->IsPlaying()) DriveAudio->Play();
}

void AQuebecCar::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecCar, Occupant);
    DOREPLIFETIME(AQuebecCar, Speed);
    DOREPLIFETIME(AQuebecCar, LateralSpeed);
    DOREPLIFETIME_CONDITION(AQuebecCar, bHandbrake, COND_SkipOwner);
    DOREPLIFETIME(AQuebecCar, VisualSteering);
    DOREPLIFETIME(AQuebecCar, PaintStyle);
    DOREPLIFETIME(AQuebecCar, BodyProfile);
    DOREPLIFETIME(AQuebecCar, RideKind);
    DOREPLIFETIME(AQuebecCar, bTraffic);
    // Street contract.
    DOREPLIFETIME(AQuebecCar, bPolice);
    DOREPLIFETIME(AQuebecCar, bSiren);
    DOREPLIFETIME(AQuebecCar, BodyDamage);
    // Traffic street life: turn signals and hazard lights.
    DOREPLIFETIME(AQuebecCar, TrafficSignal);
}

bool AQuebecGameState::CanAdvanceMission(int32 Index, const FVector& Position)
{
    return Index >= 0 && Index < MissionCount && !Position.ContainsNaN() &&
        FVector::DistSquared(Position, MissionLocations[Index]) <= FMath::Square(MissionRadius);
}

bool AQuebecGameState::AdvanceMissionNear(const FVector& Position)
{
    if (QuebecDistrict::IsToronto(GetWorld()) || !HasAuthority() || !CanAdvanceMission(MissionIndex, Position)) return false;
    ++MissionIndex;
    ForceNetUpdate();
    return true;
}

AQuebecGameState::AQuebecGameState()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AQuebecGameState::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!HasAuthority()) return;
    // Remote controllers skip PlayerTick on the server; resident decisions must include every player.
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) It->TickResidentGreetings(DeltaSeconds);
    // A client loses a player character that is far away or parked while its player drives; the game state always replicates.
    int32 Mask = 0;
    for (int32 Style = 3; Style <= 10; ++Style)
        if (AQuebecCharacter::IsCrewTaken(GetWorld(), Style)) Mask |= 1 << Style;
    WornCrewMask = Mask;
}

void AQuebecGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecGameState, MissionIndex);
    DOREPLIFETIME(AQuebecGameState, WornCrewMask);
}


AQuebecController::AQuebecController()
{
    static ConstructorHelpers::FObjectFinderOptional<USoundBase> Checkpoint(TEXT("/Game/Audio/Feedback/Checkpoint.Checkpoint"));
    static ConstructorHelpers::FObjectFinderOptional<USoundBase> Complete(TEXT("/Game/Audio/Feedback/Complete.Complete"));
    static ConstructorHelpers::FObjectFinderOptional<USoundBase> Dialogue(TEXT("/Game/Audio/Feedback/Dialogue.Dialogue"));
    FeedbackSounds = {Checkpoint.Get(), Complete.Get(), Dialogue.Get()};
    static ConstructorHelpers::FObjectFinderOptional<USoundBase> Neighborhood(TEXT("/Game/Audio/Music/NeighborhoodLoop.NeighborhoodLoop"));
    static ConstructorHelpers::FObjectFinderOptional<USoundBase> Race(TEXT("/Game/Audio/Music/RaceLoop.RaceLoop"));
    NeighborhoodMusic = Neighborhood.Get();
    RaceMusic = Race.Get();
    MusicAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("MusicAudio"));
    MusicAudio->bAutoActivate = false;
    MusicAudio->bAllowSpatialization = false;
    MusicAudio->VolumeMultiplier = .045f;
    PondTickAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("PondTickAudio"));
    PondTickAudio->bAutoActivate = false;
    PondTickAudio->bAllowSpatialization = false;
    PondTickAudio->VolumeMultiplier = .55f;
    ShowPageAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("ShowPageAudio"));
    ShowPageAudio->bAutoActivate = false;
    ShowPageAudio->bAllowSpatialization = false;
    ShowPageAudio->VolumeMultiplier = .6f;
    CourtWhistleAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("CourtWhistleAudio"));
    CourtWhistleAudio->bAutoActivate = false;
    CourtWhistleAudio->bAllowSpatialization = false;
    CourtWhistleAudio->VolumeMultiplier = .6f;
    CourtRaspAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("CourtRaspAudio"));
    CourtRaspAudio->bAutoActivate = false;
    CourtRaspAudio->bAllowSpatialization = false;
    CourtRaspAudio->VolumeMultiplier = .5f;
    RankAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("RankAudio"));
    RankAudio->bAutoActivate = false;
    RankAudio->bAllowSpatialization = false;
    RankAudio->VolumeMultiplier = .55f;
    SkidAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("SkidAudio"));
    SkidAudio->bAutoActivate = false;
    SkidAudio->bAllowSpatialization = false;
    SkidAudio->VolumeMultiplier = .7f;
    ImpactAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("ImpactAudio"));
    ImpactAudio->bAutoActivate = false;
    ImpactAudio->bAllowSpatialization = false;
    ImpactAudio->VolumeMultiplier = .8f;
    LossAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("LossAudio"));
    LossAudio->bAutoActivate = false;
    LossAudio->bAllowSpatialization = false;
    LossAudio->VolumeMultiplier = .65f;
    StoryBedAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("StoryBedAudio"));
    StoryBedAudio->bAutoActivate = false;
    StoryBedAudio->bAllowSpatialization = false;
    StoryBedAudio->VolumeMultiplier = .05f;
    BarkAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("BarkAudio"));
    BarkAudio->bAutoActivate = false;
    BarkAudio->bAllowSpatialization = false;
    BarkAudio->VolumeMultiplier = .85f;
}

void AQuebecController::PlayFeedback(EQuebecFeedbackCue Cue)
{
    const int32 Index = static_cast<int32>(Cue);
    if (FeedbackSounds.IsValidIndex(Index) && FeedbackSounds[Index])
        ClientPlaySound(FeedbackSounds[Index], 1.f);
}

void AQuebecController::FrameTheStreet(float Yaw, bool bResetCamera)
{
    // An unset pitch of 0 is pulled to the upward stop at -5, so the horizon sits near the middle.
    // -16 stays inside the -25..-5 clamp and tips the view down the street.
    const FRotator Look(-16.f, Yaw, 0.f);
    SetControlRotation(Look);
    ClientSetRotation(Look, bResetCamera);
}

void AQuebecController::BeginPlay()
{
    Super::BeginPlay();
    if (PlayerCameraManager)
    {
        PlayerCameraManager->ViewPitchMin = -25.f;
        PlayerCameraManager->ViewPitchMax = -5.f;
    }
    BindBrowserInputRelease();
    // The game mode paints the host. A remote client has no game mode, so it paints its own copy.
    if (IsLocalController() && GetNetMode() == NM_Client) AQuebecLanePaint::Spawn(GetWorld());
}

void AQuebecController::BindBrowserInputRelease()
{
    if (!IsLocalController() || !IPixelStreaming2Module::IsAvailable()) return;
    BrowserStreamerId = IPixelStreaming2Module::Get().GetDefaultStreamerID();
    if (UPixelStreaming2Delegates* Delegates = UPixelStreaming2Delegates::Get())
    {
        Delegates->OnDataTrackClosedNative.AddUObject(this, &AQuebecController::BrowserDataTrackClosed);
        Delegates->OnAllConnectionsClosedNative.AddUObject(this, &AQuebecController::BrowserDisconnected);
        Delegates->OnDisconnectedFromSignallingServerNative.AddUObject(this, &AQuebecController::BrowserDisconnected);
    }
}

void AQuebecController::UnbindBrowserInputRelease()
{
    if (UPixelStreaming2Delegates* Delegates = UPixelStreaming2Delegates::Get())
    {
        Delegates->OnDataTrackClosedNative.RemoveAll(this);
        Delegates->OnAllConnectionsClosedNative.RemoveAll(this);
        Delegates->OnDisconnectedFromSignallingServerNative.RemoveAll(this);
    }
}

void AQuebecController::BrowserDataTrackClosed(FString StreamerId, FString PlayerId)
{
    BrowserDisconnected(StreamerId);
}

void AQuebecController::BrowserDisconnected(FString StreamerId)
{
    if (!IsLocalController() || BrowserStreamerId.IsEmpty() || BrowserStreamerId != StreamerId) return;
    // A browser leaving does not destroy its Unreal client. Release its latched
    // controls on both peers while retaining possession and campaign progress.
    FlushPressedKeys();
    ReleasePawnInput(GetPawn());
    ServerReleaseBrowserInput();
    UE_LOG(LogTemp, Display, TEXT("NORD_BROWSER_INPUT_RELEASE streamer=%s pawn=%s"), *StreamerId, *GetNameSafe(GetPawn()));
}

void AQuebecController::ServerReleaseBrowserInput_Implementation()
{
    ReleasePawnInput(GetPawn());
    if (AQuebecCampaign* Campaign = CampaignFor(GetWorld())) Campaign->ReleaseBrowserInput(this);
}

void AQuebecController::SetupInputComponent()
{
    Super::SetupInputComponent();
    InputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &AQuebecController::Interact);
    InputComponent->BindAction(TEXT("ComicStyle"), IE_Pressed, this, &AQuebecController::ToggleComicStyle);
    InputComponent->BindAction(TEXT("NextCharacter"), IE_Pressed, this, &AQuebecController::NextCharacter);
    const FKey CrewKeys[] = {EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five, EKeys::Six, EKeys::Seven, EKeys::Eight};
    for (int32 Slot = 0; Slot < 8; ++Slot)
    {
        FInputKeyBinding Binding(FInputChord(CrewKeys[Slot]), IE_Pressed);
        Binding.KeyDelegate.GetDelegateForManualSet().BindUObject(this, &AQuebecController::ChooseCrewKey, Slot);
        InputComponent->KeyBindings.Add(Binding);
    }
    InputComponent->BindAction(TEXT("RetryCampaign"), IE_Pressed, this, &AQuebecController::RetryCampaign);
    InputComponent->BindAction(TEXT("ReplayCampaign"), IE_Pressed, this, &AQuebecController::ReplayCampaign);
}

void AQuebecController::RetryCampaign() { ServerRetryCampaign(); }
void AQuebecController::ReplayCampaign() { ServerReplayCampaign(); }
void AQuebecController::ServerRetryCampaign_Implementation()
{
    // Side jobs (JOBS): R inside a running job restarts the job instead of the campaign checkpoint.
    if (QuebecJobs::HandleRecover(this)) return;
    if (AQuebecCampaign* Campaign = CampaignFor(GetWorld())) Campaign->RequestRetry(this);
}
void AQuebecController::ServerReplayCampaign_Implementation()
{
    if (AQuebecCampaign* Campaign = CampaignFor(GetWorld())) Campaign->RequestReplay(this);
}
void AQuebecController::ServerCampaignAim_Implementation(float Yaw, float Pitch)
{
    if (AQuebecCampaign* Campaign = CampaignFor(GetWorld())) Campaign->LightAim(this, Yaw, Pitch);
}

void AQuebecController::NextCharacter() { ServerNextCharacter(); }
void AQuebecController::ServerNextCharacter_Implementation()
{
    AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
    if (!Character) Character = WalkingCharacter;
    if (Character) Character->CycleCrew();
}

void AQuebecController::ChooseCrewKey(int32 Slot) { ServerChooseCrew(3 + Slot); }
void AQuebecController::ServerChooseCrew_Implementation(int32 Style)
{
    if (Style < 3 || Style > 10) return;
    AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
    if (!Character) Character = WalkingCharacter;
    if (Character && !Character->ChooseCrew(Style))
        ClientInteractionMessage(FString(AQuebecParkResident::NameForStyle(Style)) + TEXT("  /  The other player is already this crew member."));
}

void AQuebecController::ToggleComicStyle() { bComicStyle = !bComicStyle; }

void AQuebecController::TickStoryBed(bool bPlay)
{
    if (!StoryBedAudio || !GetWorld()) return;
    if (!bPlay)
    {
        if (StoryBedOrigin >= 0.)
        {
            StoryBedAudio->Stop();
            StoryBedOrigin = -1.;
            StoryBedQueued = 0.;
            if (MusicAudio && MusicAudio->Sound && GetWorld()->AllowAudioPlayback()) MusicAudio->FadeIn(.35f);
        }
        return;
    }
    if (!GetWorld()->AllowAudioPlayback()) return;
    if (MusicAudio && MusicAudio->IsPlaying()) MusicAudio->Stop();
    if (!StoryBedWave)
    {
        StoryBedWave = NewObject<USoundWaveProcedural>(this);
        StoryBedWave->SetSampleRate(static_cast<uint32>(QuebecStoryBed::SampleRate));
        StoryBedWave->NumChannels = 2;
        StoryBedWave->Duration = static_cast<float>(QuebecStoryBed::LoopSeconds);
        StoryBedAudio->SetSound(StoryBedWave);
    }
    if (StoryBedPcm.Num() == 0)
    {
        StoryBedPcm.SetNumUninitialized(QuebecStoryBed::Frames * 2);
        for (int32 Frame = 0; Frame < QuebecStoryBed::Frames; ++Frame)
        {
            const QuebecStoryBed::FStereo Sample = QuebecStoryBed::SampleAt(Frame);
            StoryBedPcm[Frame * 2] = static_cast<int16>(FMath::Clamp(static_cast<float>(Sample.L), -1.f, 1.f) * 32767.f);
            StoryBedPcm[Frame * 2 + 1] = static_cast<int16>(FMath::Clamp(static_cast<float>(Sample.R), -1.f, 1.f) * 32767.f);
        }
    }
    const double Now = static_cast<double>(GetWorld()->GetTimeSeconds());
    const double Loop = QuebecStoryBed::LoopSeconds;
    if (StoryBedOrigin < 0. || !StoryBedAudio->IsPlaying())
    {
        StoryBedWave->ResetAudio();
        StoryBedWave->QueueAudio(reinterpret_cast<const uint8*>(StoryBedPcm.GetData()), StoryBedPcm.Num() * static_cast<int32>(sizeof(int16)));
        StoryBedAudio->Play();
        StoryBedOrigin = Now;
        StoryBedQueued = Loop;
        return;
    }
    if (Now - StoryBedOrigin > StoryBedQueued - 0.5)
    {
        StoryBedWave->QueueAudio(reinterpret_cast<const uint8*>(StoryBedPcm.GetData()), StoryBedPcm.Num() * static_cast<int32>(sizeof(int16)));
        StoryBedQueued += Loop;
    }
}

void AQuebecController::ClientPlayBark_Implementation(int32 Style)
{
    if (!IsLocalController() || !BarkAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    const QuebecBarks::FSpan Span = QuebecBarks::Span(Style);
    if (Span.Count <= 0) return;
    if (BarkPcm.Num() != QuebecBarks::PcmSamples)
    {
        BarkPcm.SetNumUninitialized(QuebecBarks::PcmSamples);
        if (QuebecBarks::Decode(BarkPcm.GetData(), BarkPcm.Num()) != QuebecBarks::PcmSamples)
        {
            BarkPcm.Reset();
            return;
        }
    }
    if (!BarkWave)
    {
        BarkWave = NewObject<USoundWaveProcedural>(this);
        BarkWave->SetSampleRate(static_cast<uint32>(QuebecBarks::SampleRate));
        BarkWave->NumChannels = 1;
        BarkAudio->SetSound(BarkWave);
    }
    BarkWave->Duration = static_cast<float>(Span.Count) / static_cast<float>(QuebecBarks::SampleRate);
    BarkWave->ResetAudio();
    BarkWave->QueueAudio(reinterpret_cast<const uint8*>(BarkPcm.GetData() + Span.Begin), Span.Count * static_cast<int32>(sizeof(int16)));
    BarkAudio->Play();
}

void AQuebecController::PlayPondTick()
{
    if (!PondTickAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    if (!PondTickWave)
    {
        PondTickWave = NewObject<USoundWaveProcedural>(this);
        PondTickWave->SetSampleRate(static_cast<uint32>(QuebecPondTone::SampleRate));
        PondTickWave->NumChannels = 1;
        PondTickWave->Duration = static_cast<float>(QuebecPondTone::TickFrames) / static_cast<float>(QuebecPondTone::SampleRate);
        PondTickAudio->SetSound(PondTickWave);
    }
    PondTickWave->ResetAudio();
    int16 Pcm[QuebecPondTone::TickFrames];
    for (int32 Frame = 0; Frame < QuebecPondTone::TickFrames; ++Frame)
    {
        const float Sample = FMath::Clamp(static_cast<float>(QuebecPondTone::SampleAt(Frame)), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    PondTickWave->QueueAudio(reinterpret_cast<const uint8*>(Pcm), QuebecPondTone::TickFrames * static_cast<int32>(sizeof(int16)));
    PondTickAudio->Play();
}

void AQuebecController::PlayShowPage()
{
    if (!ShowPageAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    if (!ShowPageWave)
    {
        ShowPageWave = NewObject<USoundWaveProcedural>(this);
        ShowPageWave->SetSampleRate(static_cast<uint32>(QuebecShowTone::SampleRate));
        ShowPageWave->NumChannels = 1;
        ShowPageWave->Duration = static_cast<float>(QuebecShowTone::PageFrames) / static_cast<float>(QuebecShowTone::SampleRate);
        ShowPageAudio->SetSound(ShowPageWave);
    }
    ShowPageWave->ResetAudio();
    int16 Pcm[QuebecShowTone::PageFrames];
    for (int32 Frame = 0; Frame < QuebecShowTone::PageFrames; ++Frame)
    {
        const float Sample = FMath::Clamp(static_cast<float>(QuebecShowTone::SampleAt(Frame)), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    ShowPageWave->QueueAudio(reinterpret_cast<const uint8*>(Pcm), QuebecShowTone::PageFrames * static_cast<int32>(sizeof(int16)));
    ShowPageAudio->Play();
}

void AQuebecController::TickShowPage()
{
    const AQuebecCampaign* Campaign = CampaignFor(GetWorld());
    const int32 Step = (IsLocalController() && Campaign) ? Campaign->ShowStep : -1;
    if (Step == QuebecShowRules::StepBanked && ShowHeardStep == QuebecShowRules::StepCue) PlayShowPage();
    ShowHeardStep = (IsLocalController() && Campaign) ? Step : -1;
}

void AQuebecController::PlayRank(int32 ChainAfter, bool bWasSpoiled)
{
    ClientPlayRank(ChainAfter, bWasSpoiled);
}

void AQuebecController::ClientPlayRank_Implementation(int32 ChainAfter, bool bWasSpoiled)
{
    PlayRankTone(ChainAfter, bWasSpoiled);
}

void AQuebecController::PlayRankTone(int32 ChainAfter, bool bWasSpoiled)
{
    if (!RankAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    const int32 Hz = QuebecRankTone::RankHz(static_cast<int>(ChainAfter), bWasSpoiled);
    if (!RankWave)
    {
        RankWave = NewObject<USoundWaveProcedural>(this);
        RankWave->SetSampleRate(static_cast<uint32>(QuebecRankTone::SampleRate));
        RankWave->NumChannels = 1;
        RankWave->Duration = static_cast<float>(QuebecRankTone::Frames) / static_cast<float>(QuebecRankTone::SampleRate);
        RankAudio->SetSound(RankWave);
    }
    RankWave->ResetAudio();
    int16 Pcm[QuebecRankTone::Frames];
    for (int32 Frame = 0; Frame < QuebecRankTone::Frames; ++Frame)
    {
        const float Sample = FMath::Clamp(static_cast<float>(QuebecRankTone::SampleAt(Frame, Hz)), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    RankWave->QueueAudio(reinterpret_cast<const uint8*>(Pcm), QuebecRankTone::Frames * static_cast<int32>(sizeof(int16)));
    RankAudio->Play();
}

void AQuebecController::TickSkid()
{
    const AQuebecCar* Car = Cast<AQuebecCar>(GetPawn());
    const bool bLocked = Car && Car->bHandbrake;
    const double Speed = Car ? static_cast<double>(Car->Speed) : 0.;
    if (QuebecSkidTone::Caught(bLocked, bWasSkidLocked, Speed)) PlaySkidTone();
    bWasSkidLocked = bLocked;
}

void AQuebecController::PlaySkidTone()
{
    if (!SkidAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    if (!SkidWave)
    {
        SkidWave = NewObject<USoundWaveProcedural>(this);
        SkidWave->SetSampleRate(static_cast<uint32>(QuebecSkidTone::SampleRate));
        SkidWave->NumChannels = 1;
        SkidWave->Duration = static_cast<float>(QuebecSkidTone::Frames) / static_cast<float>(QuebecSkidTone::SampleRate);
        SkidAudio->SetSound(SkidWave);
    }
    SkidWave->ResetAudio();
    int16 Pcm[QuebecSkidTone::Frames];
    for (int32 Frame = 0; Frame < QuebecSkidTone::Frames; ++Frame)
    {
        const float Sample = FMath::Clamp(static_cast<float>(QuebecSkidTone::SampleAt(Frame)), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    SkidWave->QueueAudio(reinterpret_cast<const uint8*>(Pcm), QuebecSkidTone::Frames * static_cast<int32>(sizeof(int16)));
    SkidAudio->Play();
}

void AQuebecController::PlayImpact()
{
    ClientPlayImpact();
}

void AQuebecController::ClientPlayImpact_Implementation()
{
    PlayImpactTone();
}

void AQuebecController::PlayImpactTone()
{
    if (!ImpactAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    if (!ImpactWave)
    {
        ImpactWave = NewObject<USoundWaveProcedural>(this);
        ImpactWave->SetSampleRate(static_cast<uint32>(QuebecImpactTone::SampleRate));
        ImpactWave->NumChannels = 1;
        ImpactWave->Duration = static_cast<float>(QuebecImpactTone::Frames) / static_cast<float>(QuebecImpactTone::SampleRate);
        ImpactAudio->SetSound(ImpactWave);
    }
    ImpactWave->ResetAudio();
    int16 Pcm[QuebecImpactTone::Frames];
    for (int32 Frame = 0; Frame < QuebecImpactTone::Frames; ++Frame)
    {
        const float Sample = FMath::Clamp(static_cast<float>(QuebecImpactTone::SampleAt(Frame)), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    ImpactWave->QueueAudio(reinterpret_cast<const uint8*>(Pcm), QuebecImpactTone::Frames * static_cast<int32>(sizeof(int16)));
    ImpactAudio->Play();
}

void AQuebecController::PlayLoss()
{
    ClientPlayLoss();
}

void AQuebecController::ClientPlayLoss_Implementation()
{
    PlayLossTone();
}

void AQuebecController::PlayLossTone()
{
    if (!LossAudio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    if (!LossWave)
    {
        LossWave = NewObject<USoundWaveProcedural>(this);
        LossWave->SetSampleRate(static_cast<uint32>(QuebecLossTone::SampleRate));
        LossWave->NumChannels = 1;
        LossWave->Duration = static_cast<float>(QuebecLossTone::Frames) / static_cast<float>(QuebecLossTone::SampleRate);
        LossAudio->SetSound(LossWave);
    }
    LossWave->ResetAudio();
    int16 Pcm[QuebecLossTone::Frames];
    for (int32 Frame = 0; Frame < QuebecLossTone::Frames; ++Frame)
    {
        const float Sample = FMath::Clamp(static_cast<float>(QuebecLossTone::SampleAt(Frame)), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    LossWave->QueueAudio(reinterpret_cast<const uint8*>(Pcm), QuebecLossTone::Frames * static_cast<int32>(sizeof(int16)));
    LossAudio->Play();
}

void AQuebecController::PlayCourtWave(UAudioComponent* Audio, TObjectPtr<USoundWaveProcedural>& Wave, int32 Frames, bool bWhistle)
{
    if (!Audio || !GetWorld() || !GetWorld()->AllowAudioPlayback()) return;
    if (!Wave)
    {
        Wave = NewObject<USoundWaveProcedural>(this);
        Wave->SetSampleRate(static_cast<uint32>(QuebecCourtTone::SampleRate));
        Wave->NumChannels = 1;
        Wave->Duration = static_cast<float>(Frames) / static_cast<float>(QuebecCourtTone::SampleRate);
        Audio->SetSound(Wave);
    }
    Wave->ResetAudio();
    TArray<int16> Pcm;
    Pcm.SetNumUninitialized(Frames);
    for (int32 Frame = 0; Frame < Frames; ++Frame)
    {
        const double Raw = bWhistle ? QuebecCourtTone::WhistleAt(Frame) : QuebecCourtTone::RaspAt(Frame);
        const float Sample = FMath::Clamp(static_cast<float>(Raw), -1.f, 1.f);
        Pcm[Frame] = static_cast<int16>(Sample * 32767.f);
    }
    Wave->QueueAudio(reinterpret_cast<const uint8*>(Pcm.GetData()), Frames * static_cast<int32>(sizeof(int16)));
    Audio->Play();
}

void AQuebecController::TickCourtFeel()
{
    const AQuebecCampaign* Campaign = CampaignFor(GetWorld());
    if (!IsLocalController() || !Campaign)
    {
        CourtHeardStep = -1;
        CourtHeardMisses = -1;
        return;
    }
    if (Campaign->CourtStep == QuebecCourtRules::StepPull && CourtHeardStep == QuebecCourtRules::StepRedirect)
        PlayCourtWave(CourtWhistleAudio, CourtWhistleWave, QuebecCourtTone::WhistleFrames, true);
    if (CourtHeardMisses >= 0 && Campaign->CourtMisses != CourtHeardMisses)
        PlayCourtWave(CourtRaspAudio, CourtRaspWave, QuebecCourtTone::RaspFrames, false);
    CourtHeardStep = Campaign->CourtStep;
    CourtHeardMisses = Campaign->CourtMisses;
}

void AQuebecController::TickPondBlink()
{
    const AQuebecCampaign* Campaign = CampaignFor(GetWorld());
    const bool bTag = IsLocalController() && Campaign && Campaign->IsPondOpen() && Campaign->PondStep == QuebecPondRules::StepTag;
    const AGameStateBase* State = GetWorld() ? GetWorld()->GetGameState() : nullptr;
    const double Now = static_cast<double>(State ? State->GetServerWorldTimeSeconds() : (GetWorld() ? GetWorld()->GetTimeSeconds() : 0.));
    if (bTag && PondBlinkTime >= 0. && QuebecPondRules::BlinkEdge(PondBlinkTime, Now)) PlayPondTick();
    PondBlinkTime = bTag ? Now : -1.;
}

void AQuebecController::PlayerTick(float DeltaTime)
{
    AQuebecCampaign* Campaign = IsLocalController() ? CampaignFor(GetWorld()) : nullptr;
    if (PlayerCameraManager)
    {
        const bool bAim = Campaign && Campaign->IsAimingLight(this);
        PlayerCameraManager->ViewPitchMin = bAim ? -55.f : -25.f;
        PlayerCameraManager->ViewPitchMax = bAim ? 30.f : -5.f;
    }
    Super::PlayerTick(DeltaTime);
    if (!IsLocalController()) return;
    const bool bRacing = Campaign && Campaign->Phase == EQuebecCampaignPhase::RaceRunning;
    const bool bStory = Campaign && Campaign->IsStoryBeatOpen();
    if (QuebecStoryBed::BedFor(bRacing, bStory) == QuebecStoryBed::EBed::Story) TickStoryBed(true);
    else
    {
        TickStoryBed(false);
        UpdateMusic(bRacing);
    }
    TickPondBlink();
    TickShowPage();
    TickCourtFeel();
    TickSkid();
    BrowserStateElapsed += DeltaTime;
    if (BrowserStateElapsed >= .5f && !BrowserStreamerId.IsEmpty() && IPixelStreaming2Module::IsAvailable())
    {
        BrowserStateElapsed = 0.f;
        if (const TSharedPtr<IPixelStreaming2Streamer> Streamer = IPixelStreaming2Module::Get().FindStreamer(BrowserStreamerId))
        {
            const AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
            Streamer->SendAllPlayersMessage(TEXT("Response"), FString::Printf(TEXT("{\"nordDriving\":%s,\"nordSwimming\":%s}"),
                Cast<AQuebecCar>(GetPawn()) ? TEXT("true") : TEXT("false"),
                Character && Character->GetCharacterMovement()->IsSwimming() ? TEXT("true") : TEXT("false")));
        }
    }
    ApplyComicStyle();
    ApplySkyGrading();
    CampaignAimElapsed += DeltaTime;
    if (CampaignAimElapsed >= .1f)
    {
        CampaignAimElapsed = 0.f;
        // Keep aim updates flowing while the server's ownership reply is in flight.
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(GetPawn());
        if (Campaign && Walker &&
            Campaign->Phase == EQuebecCampaignPhase::AimWorklight &&
            FVector::DistSquared(Walker->GetActorLocation(),Campaign->WorklightLocation) <= FMath::Square(280.f))
        {
            const FRotator Aim = GetControlRotation();
            ServerCampaignAim(Aim.Yaw, Aim.Pitch);
        }
    }
    static const bool bCapture = FParse::Param(FCommandLine::Get(), TEXT("NordCapture"));
    if (bCapture) TickCapture(DeltaTime);
}

void AQuebecController::ApplyComicStyle()
{
    // The look is local: each player's view target cameras carry the blendable at weight 0 or 1.
    // Loaded lazily so the editor can regenerate the asset without a rooted reference.
    if (!ComicMaterial) ComicMaterial = LoadObject<UMaterialInterface>(nullptr,
        FParse::Param(FCommandLine::Get(), TEXT("NordGraphicNovelCandidate"))
            ? TEXT("/Game/ParkComic/CrewGraphicNovel/Resident9/M_ComicInk.M_ComicInk")
            : TEXT("/Game/Art/Comic/M_ComicInk.M_ComicInk"));
    const float Weight = bComicStyle ? 1.f : 0.f;
    if (AActor* Target = GetViewTarget(); Target && ComicMaterial)
    {
        TArray<UCameraComponent*> Cameras;
        Target->GetComponents(Cameras);
        for (UCameraComponent* Camera : Cameras)
        {
            TArray<FWeightedBlendable>& Blendables = Camera->PostProcessSettings.WeightedBlendables.Array;
            FWeightedBlendable* Entry = Blendables.FindByPredicate([this](const FWeightedBlendable& B) { return B.Object == ComicMaterial; });
            if (Entry) Entry->Weight = Weight;
            else Blendables.Add(FWeightedBlendable(Weight, ComicMaterial));
        }
    }
    // Ink affects the picture; character poses keep the full simulation cadence.
    for (TActorIterator<AQuebecCharacter> It(GetWorld()); It; ++It)
        It->GetMesh()->SetComponentTickInterval(0.f);
}

void AQuebecController::ApplySkyGrading()
{
    // Exposure and grading follow the shared sky on each local view. Without a sky, clear only the
    // overrides set here, so the level volume applies unchanged.
    const AQuebecSky* Sky = AQuebecSky::Find(GetWorld());
    AActor* Target = GetViewTarget();
    if ((!Sky && !bSkyGrading) || !Target) return;
    bSkyGrading = Sky != nullptr;
    // Runs every frame, so the camera list stays on the stack.
    TInlineComponentArray<UCameraComponent*> Cameras(Target, false);
    for (UCameraComponent* Camera : Cameras)
    {
        FPostProcessSettings& Settings = Camera->PostProcessSettings;
        Settings.bOverride_AutoExposureMinBrightness = bSkyGrading;
        Settings.bOverride_AutoExposureMaxBrightness = bSkyGrading;
        Settings.bOverride_ColorSaturation = bSkyGrading;
        Settings.bOverride_ColorContrast = bSkyGrading;
        Settings.bOverride_WhiteTemp = bSkyGrading;
        if (!Sky) continue;
        Settings.AutoExposureMinBrightness = Settings.AutoExposureMaxBrightness = QuebecSky::AuthoredEV100 + Sky->GetExposureOffset();
        const float Saturation = Sky->GetSaturation(), Contrast = Sky->GetContrast();
        Settings.ColorSaturation = FVector4(Saturation, Saturation, Saturation, 1.f);
        Settings.ColorContrast = FVector4(Contrast, Contrast, Contrast, 1.f);
        Settings.WhiteTemp = Sky->GetWhiteTemp();
    }
}

void AQuebecController::NordWeather(const FString& Weather)
{
    if (AQuebecSky::Find(GetWorld())) ServerNordWeather(Weather);
}

void AQuebecController::NordTime(float Hours)
{
    if (AQuebecSky::Find(GetWorld())) ServerNordTime(Hours);
}

void AQuebecController::NordSkyFreeze(int32 Frozen)
{
    if (AQuebecSky::Find(GetWorld())) ServerNordSkyFreeze(Frozen != 0);
}

namespace
{
    // On the server only the listen-server host's own controller is local, so a guest's sky command is refused.
    bool AcceptSkyCommand(AQuebecController* Controller)
    {
        if (Controller->IsLocalController()) return true;
        Controller->ShowInteractionMessage(TEXT("Only the host can change the sky"));
        return false;
    }
}

void AQuebecController::ServerNordWeather_Implementation(const FString& Weather)
{
    if (!AcceptSkyCommand(this)) return;
    for (TActorIterator<AQuebecSky> It(GetWorld()); It; ++It)
        if (!It->HostSetWeather(Weather)) ClientInteractionMessage(FString::Printf(TEXT("Unknown weather %s"), *Weather));
}

void AQuebecController::ServerNordTime_Implementation(float Hours)
{
    if (!AcceptSkyCommand(this)) return;
    for (TActorIterator<AQuebecSky> It(GetWorld()); It; ++It) It->HostSetHour(Hours);
}

void AQuebecController::ServerNordSkyFreeze_Implementation(bool bFrozen)
{
    if (!AcceptSkyCommand(this)) return;
    for (TActorIterator<AQuebecSky> It(GetWorld()); It; ++It) It->HostSetFrozen(bFrozen);
}

void AQuebecController::TickCapture(float DeltaTime)
{
    // -NordCapture: fixed reference shots from spawn for reviewing the look, then quit.
    CaptureClock += DeltaTime;
    struct FShot { float Time; float Yaw; bool bComic; const TCHAR* Name; };
    static const FShot Shots[] = {
        {8.f, 0.f, true, TEXT("NordComic_East")}, {10.f, 90.f, true, TEXT("NordComic_North")},
        {12.f, 200.f, true, TEXT("NordComic_West")}, {14.f, 0.f, false, TEXT("NordRealistic_East")},
        {16.f, 90.f, false, TEXT("NordRealistic_North")}, {18.f, 0.f, true, TEXT("NordComic_Jump")},
        {21.f, 0.f, true, TEXT("NordComic_Car")},
    };
    if (CaptureStep < UE_ARRAY_COUNT(Shots))
    {
        const FShot& Shot = Shots[CaptureStep];
        if (CaptureClock > Shot.Time - 1.5f)
        {
            bComicStyle = Shot.bComic;
            if (FCString::Strcmp(Shot.Name, TEXT("NordComic_Jump")) == 0 && CaptureClock > Shot.Time - .35f)
                if (ACharacter* Walker = Cast<ACharacter>(GetPawn())) Walker->Jump();
            if (!GetPawn() || !GetPawn()->IsA<AQuebecCar>()) SetControlRotation(FRotator(-6.f, Shot.Yaw, 0.f));
            if (CaptureStep == UE_ARRAY_COUNT(Shots) - 1 && HasAuthority() && GetPawn() && GetPawn()->IsA<AQuebecCharacter>())
            {
                if (TActorIterator<AQuebecCar> Car(GetWorld()); Car)
                {
                    GetPawn()->SetActorLocation(Car->GetActorLocation() + Car->GetActorRightVector() * 260. + FVector(0., 0., 20.));
                    ServerInteract();
                }
            }
        }
        if (CaptureClock > Shot.Time)
        {
            FScreenshotRequest::RequestScreenshot(Shot.Name, false, false);
            UE_LOG(LogTemp, Display, TEXT("NORD_CAPTURE %s"), Shot.Name);
            ++CaptureStep;
        }
    }
    else if (CaptureClock > 24.f) ConsoleCommand(TEXT("quit"));
}

void AQuebecController::Interact() { ServerInteract(); }

AQuebecCar* AQuebecController::FindInteractableCar() const
{
    AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
    if (!Character || Character->GetCharacterMovement()->IsSwimming()) return nullptr;
    AQuebecCar* NearestCar = nullptr;
    double NearestDistance = FMath::Square(CarEnterRadius);
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        const double Distance = FVector::DistSquared(Character->GetActorLocation(), It->GetActorLocation());
        if (!It->Occupant && !It->GetController() && (!It->bTraffic || FMath::Abs(It->Speed) <= QuebecJobRules::FareTakeSpeed) && Distance <= NearestDistance)
        {
            FHitResult Hit;
            FCollisionQueryParams Query(SCENE_QUERY_STAT(EnterCar), false, Character);
            Query.AddIgnoredActor(*It);
            // The pedalo sits in the channel. The bridge rail is between the deck and the boat, and E on the deck still boards.
            if (!It->IsPedalo() && GetWorld()->LineTraceSingleByChannel(Hit, Character->GetActorLocation(), It->GetActorLocation(), ECC_Visibility, Query)) continue;
            NearestDistance = Distance;
            NearestCar = *It;
        }
    }
    return NearestCar;
}

AQuebecParkResident* AQuebecController::FindInteractableResident() const
{
    const AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
    if (!Character) return nullptr;
    AQuebecParkResident* Nearest = nullptr;
    double Best = FMath::Square(450.f);
    for (TActorIterator<AQuebecParkResident> It(GetWorld()); It; ++It)
    {
        if (It->IsHidden() || It->IsAway()) continue; // People: nobody chats while knocked down or running.
        const double Distance = FVector::DistSquared(Character->GetActorLocation(),It->GetActorLocation()+FVector(0.,0.,100.));
        if (Distance > Best) continue;
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(TalkResident),false,Character);
        Query.AddIgnoredActor(*It);
        if (GetWorld()->LineTraceSingleByChannel(Hit,Character->GetActorLocation(),It->GetActorLocation()+FVector(0.,0.,130.),ECC_Visibility,Query)) continue;
        Best=Distance;
        Nearest=*It;
    }
    return Nearest;
}

void AQuebecController::ClientInteractionMessage_Implementation(const FString& Message)
{
    ResidentCaption = Message;
    ResidentCaptionUntil = Message.IsEmpty() ? 0.f : GetWorld()->GetTimeSeconds() + 7.f;
}

void AQuebecController::ServerInteract_Implementation()
{
    if (!HasAuthority()) return;
    if (AQuebecCar* Car = Cast<AQuebecCar>(GetPawn()))
    {
        ExitCar(Car);
        return;
    }
    AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
    if (!Character || Character->IsInputLocked()) return; // People: no E while knocked down, K.-O. or arrested.
    if (AQuebecCar* NearestCar = FindInteractableCar())
    {
        ClientInteractionMessage(TEXT(""));
        WalkingCharacter = Character;
        Character->SetInVehicle(true);
        Character->SetActorLocation(NearestCar->GetActorLocation());
        Character->AttachToActor(NearestCar, FAttachmentTransformRules::KeepWorldTransform);
        NearestCar->Occupant = Character;
        NearestCar->StopInput();
        Possess(NearestCar);
        return;
    }
    if (AQuebecCampaign* Campaign = CampaignFor(GetWorld()))
    {
        if (Campaign->HandleInteract(this)) return;
    }
    else if (AQuebecGameState* State = GetWorld()->GetGameState<AQuebecGameState>())
        if (State->AdvanceMissionNear(Character->GetActorLocation())) return;
    // Side jobs (JOBS): E at a yellow marker starts a job, after car and campaign interactions.
    if (AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld()); Jobs && Jobs->HandleInteract(this)) return;
    if (AQuebecCart* Cart = AQuebecCart::Find(GetWorld()); Cart && Cart->HandleInteract(this)) return;
    if (AQuebecBow* Bow = AQuebecBow::Find(GetWorld()); Bow && Bow->HandleInteract(this)) return;
    if (AQuebecBay* Bay = AQuebecBay::Find(GetWorld()); Bay && Bay->HandleInteract(this)) return;
    if (AQuebecParkResident* Resident = FindInteractableResident())
    {
        Resident->Acknowledge(Character, true);
        ClientInteractionMessage(FString(AQuebecParkResident::NameForStyle(Resident->Style)) + TEXT("  /  ") + AQuebecParkResident::DialogueForStyle(Resident->Style));
        ClientPlayBark(Resident->Style);
    }
}

void AQuebecController::ExitCar(AQuebecCar* Car)
{
    if (!IsValid(WalkingCharacter) || Car->Occupant != WalkingCharacter) return;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(ExitCar), false, Car);
    Query.AddIgnoredActor(WalkingCharacter);
    const FVector Offsets[] = {
        Car->GetActorRightVector() * 210., Car->GetActorRightVector() * -210., Car->GetActorForwardVector() * -350.
    };
    for (const FVector& Offset : Offsets)
    {
        FVector Location = Car->GetActorLocation() + Offset;
        FHitResult Floor;
        if (!GetWorld()->LineTraceSingleByChannel(Floor, Location + FVector(0., 0., 250.),
            Location - FVector(0., 0., 500.), ECC_Visibility, Query) || Floor.ImpactNormal.Z < .7f) continue;
        Location.Z = Floor.ImpactPoint.Z + 100.;
        if (GetWorld()->OverlapBlockingTestByChannel(Location, FQuat::Identity, ECC_Pawn,
            FCollisionShape::MakeCapsule(42.f, 96.f), Query)) continue;
        ClientInteractionMessage(TEXT(""));
        WalkingCharacter->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
        WalkingCharacter->SetActorLocationAndRotation(Location, Car->GetActorRotation());
        WalkingCharacter->SetInVehicle(false);
        Car->Occupant = nullptr;
        Car->StopInput();
        Possess(WalkingCharacter);
        FrameTheStreet(Car->GetActorRotation().Yaw);
        const float Pace = QuebecBail::CarryPace(Car->Speed, Car->LateralSpeed);
        const FVector Planar = Car->GetActorForwardVector().GetSafeNormal2D() * Car->Speed
            + Car->GetActorRightVector().GetSafeNormal2D() * Car->LateralSpeed;
        if (Pace > 0.f) WalkingCharacter->BeginBail(Planar, Pace);
        WalkingCharacter = nullptr;
        return;
    }
    ClientInteractionMessage(TEXT("DOORS BLOCKED  /  Move the car to an open spot, then press E to get out."));
}

void AQuebecController::PawnLeavingGame()
{
    if (AQuebecCar* Car = Cast<AQuebecCar>(GetPawn()))
    {
        Car->Occupant = nullptr;
        Car->StopInput();
        UnPossess();
    }
    if (IsValid(WalkingCharacter)) WalkingCharacter->Destroy();
    WalkingCharacter = nullptr;
    Super::PawnLeavingGame();
}

void AQuebecController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    UnbindBrowserInputRelease();
    if (HasAuthority())
    {
        if (AQuebecCar* Car = Cast<AQuebecCar>(GetPawn()))
        {
            Car->Occupant = nullptr;
            Car->StopInput();
            UnPossess();
        }
        if (IsValid(WalkingCharacter)) WalkingCharacter->Destroy();
    }
    Super::EndPlay(EndPlayReason);
}

bool AQuebecHUD::CanShowResidentGreeting() const
{
    return GetWorld() && FirstHUDTime >= 0.f && GetWorld()->GetTimeSeconds() >= BriefingUntil && BriefingPausedAt < 0.f;
}

void AQuebecHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas || !PlayerOwner || !PlayerOwner->GetPawn()) return;
    const APawn* Pawn = PlayerOwner->GetPawn();
    const AQuebecCar* Car = Cast<AQuebecCar>(Pawn);
    const AQuebecGameState* State = GetWorld()->GetGameState<AQuebecGameState>();
    const AQuebecController* Controller = Cast<AQuebecController>(PlayerOwner);
    const bool bToronto = QuebecDistrict::IsToronto(GetWorld());
    const QuebecDistrict::FSettings& District = QuebecDistrict::ForWorld(GetWorld());
    const AQuebecCampaign* Campaign = CampaignFor(GetWorld());
    const AQuebecCar* NearbyCar = Controller && !Car ? Controller->FindInteractableCar() : nullptr;
    const bool bCanComplete = !bToronto && !Campaign && State && AQuebecGameState::CanAdvanceMission(State->MissionIndex, Pawn->GetActorLocation());
    const bool bComic = Controller && Controller->IsComicStyle();
    const float Now = GetWorld()->GetTimeSeconds();
    if (FirstHUDTime < 0.f) FirstHUDTime = Now;
    // A phone held upright streams a tall frame: panels stack at the top and the lower 40% stays clear for the touch controls.
    // The page asks for tall frames at least 1.15 times taller than wide, so this threshold never sits on a rounding edge.
    const bool bPortrait = Canvas->SizeY > Canvas->SizeX * 1.1f;
    static const bool bTouchControls = FParse::Param(FCommandLine::Get(), TEXT("NordTouchControls"));
    const float Scale = bPortrait ? FMath::Clamp(FMath::Min(Canvas->SizeX / 720.f * 1.3f, Canvas->SizeY / 900.f * 1.15f), .6f, 2.f)
        : FMath::Clamp(FMath::Min(Canvas->SizeY / 720.f, Canvas->SizeX / 1280.f), .4f, 1.5f);
    const float Margin = 22.f * Scale;
    const float ControlsTop = Canvas->SizeY * .6f;
    const FLinearColor Ink(.004f, .006f, .009f, .95f);
    const FLinearColor Muted(.78f, .81f, .82f, 1.f);
    const FLinearColor Accent(1.f, .75f, .22f, 1.f);
    const FLinearColor Panel(.012f, .018f, .022f, .58f);
    const FLinearColor Paper(.98f, .98f, .96f, 1.f);
    UFont* Font = GEngine->GetMediumFont();
    const auto Text = [this, Font, Scale, Ink](const FString& Value, FLinearColor Color, float X, float Y, float Size = 1.f)
    {
        FCanvasTextItem Item(FVector2D(X, Y), FText::FromString(Value), Font, Color);
        Item.Scale = FVector2D(Size * Scale);
        Item.bOutlined = true;
        Item.OutlineColor = Ink.CopyWithNewOpacity(Color.A);
        Item.EnableShadow(Ink.CopyWithNewOpacity(Color.A), FVector2D(Scale, Scale));
        Canvas->DrawItem(Item);
    };
    const auto RightText = [this, Font, Scale, &Text](const FString& Value, FLinearColor Color, float Right, float Y, float Size)
    {
        float W = 0.f, H = 0.f;
        GetTextSize(Value, W, H, Font, Size * Scale);
        Text(Value, Color, Right - W, Y, Size);
    };
    // A paper rule and a crop tick turn a flat fill into a printed card. Scott McCloud,
    // Understanding Comics (1993): the border is what separates the panel from the scene.
    // Type stays at its existing inset, which is wider than this rule.
    const auto PanelRule = [this, Scale, Paper](float X, float Y, float W, float H)
    {
        const float Inset = 4.f * Scale;
        const float Weight = FMath::Max(1.f, 2.f * Scale);
        const FLinearColor Rule = Paper.CopyWithNewOpacity(.7f);
        DrawLine(X + Inset, Y + Inset, X + W - Inset, Y + Inset, Rule, Weight);
        DrawLine(X + Inset, Y + H - Inset, X + W - Inset, Y + H - Inset, Rule, Weight);
        const float Tick = 6.f * Scale;
        DrawLine(X + W - Inset - Tick, Y + Inset, X + W - Inset, Y + Inset + Tick, Rule, Weight);
    };
    const auto WrappedLines = [this, Font, Scale](const FString& Value, float Width, float Size)
    {
        TArray<FString> Words, Lines;
        Value.ParseIntoArrayWS(Words);
        FString Line;
        for (const FString& Word : Words)
        {
            float W = 0.f, H = 0.f;
            GetTextSize(Line.IsEmpty() ? Word : Line + TEXT(" ") + Word, W, H, Font, Size * Scale);
            if (W > Width && !Line.IsEmpty())
            {
                Lines.Add(Line);
                Line.Empty();
            }
            GetTextSize(Word, W, H, Font, Size * Scale);
            if (W <= Width) Line += (Line.IsEmpty() ? TEXT("") : TEXT(" ")) + Word;
            else for (TCHAR Character : Word)
            {
                GetTextSize(Line + FString::Chr(Character), W, H, Font, Size * Scale);
                if (W > Width && !Line.IsEmpty())
                {
                    Lines.Add(Line);
                    Line.Empty();
                }
                Line.AppendChar(Character);
            }
        }
        if (!Line.IsEmpty()) Lines.Add(Line);
        return Lines;
    };

    const AQuebecCharacter* Avatar = Car ? Car->Occupant.Get() : Cast<AQuebecCharacter>(Pawn);
    const float Right = Canvas->SizeX - Margin;
    RightText(FString::Printf(TEXT("NORD · %s  /  %d ONLINE"), District.City, State ? State->PlayerArray.Num() : 1), Paper, Right, Margin, .92f);
    if (Avatar) RightText(AQuebecParkResident::NameForStyle(Avatar->CrewStyle), Paper, Right, Margin + 23.f * Scale, 1.f);
    // Phones have touch buttons for these keys. R still restarts a side job after the story, so the legend stays.
    const AQuebecSideJobs* SideJobs = AQuebecSideJobs::Find(GetWorld());
    const bool bSideJobRunning = SideJobs && SideJobs->IsActive();
    if (!bPortrait)
    {
        const bool bShowRecover = bSideJobRunning || (Campaign && (!Campaign->IsCampaignComplete() || Campaign->IsStoryBeatOpen()));
        RightText(bShowRecover ? TEXT("C  Character   /   F2  Look   /   R  Recover") : TEXT("C  Character   /   F2  Look"), Muted, Right, Margin + 48.f * Scale, .85f);
    }

    const FVector Here = Pawn->GetActorLocation();
    FString Title, Action, Status;
    FVector Target = FVector::ZeroVector;
    bool bHasObjective = false;
    bool bHasNext = false;
    FVector NextStop = FVector::ZeroVector;
    double RouteBearing = 0.;
    QuebecRouteLine::ETurn RouteTurn = QuebecRouteLine::ETurn::Here;
    if (bToronto)
    {
        Title = TEXT("TORONTO FREE ROAM");
        Action = TEXT("Explore College Street and Sneaky Dee's.");
        Status = TEXT("Head west through Euclid to Grace Street.");
    }
    else if (Campaign)
    {
        Title = Campaign->GetMissionTitle();
        Action = Campaign->GetObjectiveText();
        Status = Campaign->GetStatusText();
        Target = Campaign->GetObjectiveLocation();
        bHasNext = Campaign->GetNextObjectiveLocation(NextStop);
        bHasObjective = !Campaign->IsCampaignComplete() || Campaign->IsStoryBeatOpen();
        // After the open story beats the card used to say the city was finished, while the five side jobs
        // stayed off the radar until the player was within 100 m. The same gold diamond now leads to the
        // next job. Missions 3 through 8 keep that diamond until they are banked. During the earlier story
        // the campaign objective keeps the diamond.
        if (Campaign->IsPondOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this step");
        else if (Campaign->IsCourtOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this rally");
        else if (Campaign->IsShowOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this cue");
        else if (Campaign->IsRescueOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this group");
        else if (Campaign->IsConvoyOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this wagon");
        else if (Campaign->IsBlankOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this page");
        else if (Campaign->IsTourOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this tour");
        else if (Campaign->IsHomeOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this home");
        else if (Campaign->IsEscortOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this walk");
        else if (Campaign->IsShadeOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this dark");
        else if (Campaign->IsGrabOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this window");
        else if (Campaign->IsCutOpen() && bTouchControls)
            Status = TEXT("Menu · Recover restores this cut");
        else if (Campaign->IsCampaignComplete() && !Campaign->IsStoryBeatOpen() && SideJobs)
        {
            const int32 Guide = SideJobs->GuideMarker(Here, true);
            if (Guide >= 0)
            {
                const bool bThisJob = bSideJobRunning && Guide == SideJobs->JobIndex;
                Title = bThisJob ? AQuebecSideJobs::JobTitle(Guide)
                    : (SideJobs->IsCompleted(Guide) ? TEXT("REPLAY A SIDE JOB") : TEXT("NEXT SIDE JOB"));
                Action = (bThisJob && !SideJobs->ObjectiveText.IsEmpty())
                    ? SideJobs->ObjectiveText
                    : FString::Printf(TEXT("Go to %s"), AQuebecSideJobs::JobTitle(Guide));
                FVector Goal = FVector::ZeroVector;
                const bool bGoal = bThisJob && SideJobs->GetTarget(Goal);
                if (bGoal) Target = Goal;
                else if (Guide < SideJobs->NumMarkers()) Target = SideJobs->GetMarker(Guide);
                if (bGoal || Guide < SideJobs->NumMarkers()) bHasObjective = true;
                bHasNext = false;
                if (bThisJob)
                {
                    const int32 Whole = FMath::Max(0, FMath::CeilToInt(SideJobs->GetRemainingSeconds()));
                    const FString Clock = Whole > 0 ? FString::Printf(TEXT("%d:%02d left · "), Whole / 60, Whole % 60) : FString();
                    Status = Clock + (bTouchControls ? FString(TEXT("Menu · Recover restarts")) : FString(TEXT("R restarts")));
                }
                else Status = bTouchControls ? TEXT("Use at the yellow M · Menu · Race replay") : TEXT("E at the yellow M · T replays the race");
                const int32 Offer = Campaign->JobStake(QuebecJobRules::Rewards[Guide]);
                if (Offer > 0)
                {
                    if (Campaign->bChainSpoiled) Status += FString::Printf(TEXT(" · chain broken · +$%d"), Offer);
                    else Status += FString::Printf(TEXT(" · chain %d · +$%d"), Campaign->Chain, Offer);
                }
            }
        }
        int32 PaceIndex = 0, PaceCount = 0, PaceWalk = 0, PaceSprint = 0;
        if (Campaign->GetBeatPace(PaceIndex, PaceCount, PaceWalk, PaceSprint))
        {
            Status += FString::Printf(TEXT(" · %d of %d"), PaceIndex, PaceCount);
            // On foot the clock is the time left to this diamond. A car keeps the stored leg,
            // which is zero on the drive, so the card does not invent a walk.
            if (bHasObjective && !Car)
            {
                int LeftWalk = 0;
                int LeftSprint = 0;
                QuebecPace::TimeLeft(static_cast<double>(FVector::Dist2D(Here, Target)), LeftWalk, LeftSprint);
                PaceWalk = LeftWalk;
                PaceSprint = LeftSprint;
            }
            if (PaceWalk > 0) Status += FString::Printf(TEXT(" · ~%ds walk"), PaceWalk);
            if (PaceSprint > 0 && PaceSprint < PaceWalk) Status += FString::Printf(TEXT(" · ~%ds sprint"), PaceSprint);
        }
        int32 Chain = 0;
        int32 ChainPay = 0;
        bool bChainBroken = false;
        if (Campaign->GetChainStake(Chain, ChainPay, bChainBroken))
        {
            if (bChainBroken) Status += FString::Printf(TEXT(" · chain broken · +$%d"), ChainPay);
            else Status += FString::Printf(TEXT(" · chain %d · +$%d"), Chain, ChainPay);
        }
        int32 ClearTenths = 0;
        if (Campaign->GetClearWindow(ClearTenths))
            Status += FString::Printf(TEXT(" · %d.%ds clear"), ClearTenths / 10, ClearTenths % 10);
        int32 CloseOffer = 0;
        if (Campaign->GetCloseOffer(CloseOffer))
            Status += FString::Printf(TEXT(" · close +$%d"), CloseOffer);
    }
    else if (State && State->MissionIndex >= 0 && State->MissionIndex < AQuebecGameState::MissionCount)
    {
        const int32 Index = State->MissionIndex;
        Title = FString::Printf(TEXT("0%d  /  PARK EXPLORATION"), Index + 1);
        Action = AQuebecGameState::MissionLabels[Index];
        Target = AQuebecGameState::MissionLocations[Index];
        bHasObjective = true;
        Status = bCanComplete ? Car ? TEXT("Step out to complete the objective") : NearbyCar ? TEXT("Move away from car to complete objective") : TEXT("E  /  Complete objective") : TEXT("Follow the gold diamond");
    }
    else
    {
        Title = TEXT("THE CITY IS YOURS");
        Action = TEXT("All three missions complete. Keep exploring.");
    }
    const float Meters = bHasObjective ? FVector::Distance(Here, Target) / 100.f : 0.f;

    // Map: top right, under the name and player count, clear of the phone move stick in the lower left.
    const float MapWidth = bPortrait ? Canvas->SizeX * .28f : 160.f * Scale;
    const float MapHeight = MapWidth;
    const float MapX = Right - MapWidth, MapY = Margin + (bPortrait ? 50.f : 74.f) * Scale;
    const float CreditSize = bPortrait ? .62f : .85f, CreditStep = (bPortrait ? 15.f : 18.f) * Scale;
    // The shared sky's clock and weather sit under the map, above the credits, only while a sky runs.
    const AQuebecSky* Sky = AQuebecSky::Find(GetWorld());
    const float SkyStep = Sky ? CreditStep * 1.2f : 0.f;
    const float MapBlock = MapHeight + 4.f * Scale + SkyStep + 3.f * CreditStep;
    // Touch controls reserve the lower corners; the mission sits beside the radar.
    const float MissionWidth = bPortrait ? MapX - Margin - 12.f * Scale : 460.f * Scale;
    // With touch controls the street status column (JOBS) takes the strip left of the radar, so the card moves left of it.
    const float MissionX = bPortrait ? Margin : bTouchControls ? MapX - MissionWidth - (18.f + StreetColumnWidth()) * Scale : Right - MissionWidth;
    const TArray<FString> Titles = WrappedLines(Title, MissionWidth - 24.f * Scale, .9f);
    const TArray<FString> Actions = WrappedLines(Action, MissionWidth - 24.f * Scale, 1.15f);
    const TArray<FString> Statuses = WrappedLines(Status, MissionWidth - 24.f * Scale, .9f);
    const float MissionHeight = (20.f + Titles.Num() * 20.f + Actions.Num() * 25.f + Statuses.Num() * 20.f + (bHasObjective ? 20.f : 0.f)) * Scale;
    const float MissionY = bPortrait || bTouchControls ? Margin : Canvas->SizeY - Margin - 78.f * Scale - MissionHeight;
    const float TopClear = bPortrait ? FMath::Max(MissionY + MissionHeight, MapY + MapBlock) + 12.f * Scale : Margin;

    FString Prompt;
    const bool bSwimming = Avatar && Avatar->GetCharacterMovement()->IsSwimming();
    // On a tall screen the Use button already says car; an always-on exit prompt would only cover the view.
    if (bSwimming) Prompt = TEXT("SWIMMING · Move toward shore");
    else if (Car) Prompt = bPortrait ? FString() : (Car->IsPedalo() ? TEXT("[ E ]  STEP ASHORE") : Car->IsScoot() ? TEXT("[ E ]  STEP OFF") : Car->IsBike() ? TEXT("[ E ]  STEP OFF") : TEXT("[ E ]  EXIT CAR"));
    else if (NearbyCar) Prompt = NearbyCar->IsPedalo() ? TEXT("[ E ]  BOARD PEDALO") : NearbyCar->IsScoot() ? TEXT("[ E ]  BOARD SCOOTER") : NearbyCar->IsBike() ? TEXT("[ E ]  BOARD BIKE") : TEXT("[ E ]  ENTER CAR");
    else if (bCanComplete) Prompt = TEXT("[ E ]  COMPLETE OBJECTIVE");
    else if (Controller)
    {
        if (Campaign) Prompt = Campaign->GetInteractionPrompt(Controller);
        if (Prompt.IsEmpty()) Prompt = StreetPrompt(); // Side-job marker, or Chez Lise.
        if (Prompt.IsEmpty())
            if (AQuebecParkResident* Resident = Controller->FindInteractableResident())
                Prompt = FString(TEXT("E  /  Talk to ")) + AQuebecParkResident::NameForStyle(Resident->Style);
    }
    const float LowerLeft = !bPortrait && bTouchControls ? 240.f * Scale : Margin;
    const float LowerRight = Right - (!bPortrait ? ((bTouchControls ? 420.f : 0.f) + (Car ? 190.f : 0.f)) * Scale : 0.f);
    const float PromptWidth = FMath::Min(480.f * Scale, LowerRight - LowerLeft);
    const TArray<FString> PromptLines = Prompt.IsEmpty() ? TArray<FString>() : WrappedLines(Prompt, PromptWidth - 24.f * Scale, 1.1f);
    const float PromptX = (LowerLeft + LowerRight - PromptWidth) * .5f;
    const float PromptHeight = (20.f + PromptLines.Num() * 24.f) * Scale;

    const FString Briefing = Campaign ? Campaign->GetBriefingText() : FString();
    const bool bPrivateCaption = Controller && Controller->ResidentCaptionUntil > Now && !Controller->ResidentCaption.IsEmpty();
    if (Briefing != LastBriefing)
    {
        LastBriefing = Briefing;
        BriefingUntil = Now + 9.f;
        BriefingPausedAt = -1.f;
    }
    if (bPrivateCaption && BriefingPausedAt < 0.f && Now < BriefingUntil) BriefingPausedAt = Now;
    else if (!bPrivateCaption && BriefingPausedAt >= 0.f)
    {
        // Private messages must not consume the phase briefing's reading time.
        BriefingUntil += Now - BriefingPausedAt;
        BriefingPausedAt = -1.f;
    }
    const FString Caption = bPrivateCaption ? Controller->ResidentCaption : Now < BriefingUntil ? Briefing : FString();
    // A tall screen stacks the caption and then the prompt under the mission card and map, so the middle stays clear for the player.
    float CaptionBottom = TopClear;
    if (!Caption.IsEmpty())
    {
        const float Width = bPortrait ? Canvas->SizeX - 2.f * Margin : 440.f * Scale;
        const TArray<FString> Lines = WrappedLines(Caption, Width - 28.f * Scale, 1.05f);
        const float Height = (22.f + Lines.Num() * 22.f) * Scale;
        DrawRect(Panel, Margin, TopClear, Width, Height);
        DrawRect(Accent, Margin, TopClear, 2.f * Scale, Height);
        PanelRule(Margin, TopClear, Width, Height);
        for (int32 Row = 0; Row < Lines.Num(); ++Row)
            Text(Lines[Row], Paper, Margin + 14.f * Scale, TopClear + (11.f + Row * 22.f) * Scale, 1.05f);
        CaptionBottom = TopClear + Height + 8.f * Scale;
    }
    const float PromptY = bPortrait ? CaptionBottom : Canvas->SizeY - Margin - PromptHeight;
    const float ViewTop = bPortrait ? PromptY + (Prompt.IsEmpty() ? 0.f : PromptHeight + 8.f * Scale) : 280.f * Scale;

    const FVector2D Center(MapX + MapWidth * .5f, MapY + MapHeight * .5f);
    const float MapRadius = MapWidth * .5f - 6.f * Scale;
    FCanvasNGonItem Border(Center, FVector2D(MapWidth * .5f), 64, Muted.CopyWithNewOpacity(.7f));
    Border.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Border);
    FCanvasNGonItem Disc(Center, FVector2D(MapWidth * .5f - 2.f * Scale), 64, Panel.CopyWithNewOpacity(.82f));
    Disc.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Disc);
    const auto MapPoint = [Here, Center, MapRadius](const FVector& Position)
    {
        return Center + FVector2D(Position.X - Here.X, Here.Y - Position.Y) * (MapRadius / 25000.f);
    };
    const auto MapMarker = [&MapPoint, Center, MapRadius, Scale](const FVector& Position)
    {
        const FVector2D Offset = MapPoint(Position) - Center;
        return Center + Offset.GetClampedToMaxSize(MapRadius - 8.f * Scale);
    };
    // Jacques Bertin, Semiology of Graphics (1983): size is the visual variable that
    // orders a quantity. A 9 m avenue and a side street are ordered, so the avenue's
    // stroke is wider. A dark edge keeps the light center readable on the panel.
    // Side streets stay the grey line. The clip is unchanged.
    const auto RoadWidthCm = [&District](int32 Index) -> float
    {
        if (District.RoadSegments == LaFontaineExtension::RadarRoadSegments)
        {
            const int32 ParkCount = UE_ARRAY_COUNT(LaFontaine::RoadSegments);
            if (Index < ParkCount) return LaFontaine::RoadSegmentWidths[Index];
            const int32 Extension = Index - ParkCount;
            if (Extension < UE_ARRAY_COUNT(LaFontaineExtension::RoadSegmentWidths))
                return LaFontaineExtension::RoadSegmentWidths[Extension];
        }
        else if (District.RoadSegments == LaFontaine::RoadSegments
            && Index < UE_ARRAY_COUNT(LaFontaine::RoadSegmentWidths))
            return LaFontaine::RoadSegmentWidths[Index];
        else if (District.RoadSegments == CollegeBathurst::RoadSegments
            && Index < UE_ARRAY_COUNT(CollegeBathurst::RoadSegmentWidths))
            return CollegeBathurst::RoadSegmentWidths[Index];
        return 400.f;
    };
    for (int32 Pass = 0; Pass < 3; ++Pass)
    {
        for (int32 Index = 0; Index < District.RoadCount; ++Index)
        {
            const bool bAvenue = RoadWidthCm(Index) >= 900.f;
            if (Pass == 0 && bAvenue) continue;
            if (Pass > 0 && !bAvenue) continue;
            const auto& Segment = District.RoadSegments[Index];
            FVector2D A = MapPoint(Segment[0]), B = MapPoint(Segment[1]);
            // Clip the segment: clamping its endpoints invents roads along the radar border.
            if (!ClipHUDRadarSegment(A, B, Center, MapRadius)) continue;
            if (Pass == 0)
                DrawLine(A.X, A.Y, B.X, B.Y, FLinearColor(.53f, .58f, .59f, .85f), 1.5f * Scale);
            else if (Pass == 1)
                DrawLine(A.X, A.Y, B.X, B.Y, Ink, 5.2f * Scale);
            else
                DrawLine(A.X, A.Y, B.X, B.Y, FLinearColor(.92f, .89f, .82f, .95f), 2.6f * Scale);
        }
    }
    const float CreditRight = Right - 7.f * Scale;
    DrawRect(Panel, Right - 240.f * Scale, MapY + MapHeight + 4.f * Scale, 240.f * Scale, SkyStep + 3.f * CreditStep);
    if (Sky)
    {
        const int32 Minutes = FMath::Clamp(FMath::FloorToInt(Sky->GetHour() * 60.f), 0, 24 * 60 - 1);
        RightText(FString::Printf(TEXT("%02d:%02d · %s"), Minutes / 60, Minutes % 60, *Sky->GetWeatherName()), Paper, CreditRight, MapY + MapHeight + 4.f * Scale, CreditSize * 1.15f);
    }
    const float CreditY = MapY + MapHeight + 4.f * Scale + SkyStep;
    RightText(TEXT("© OpenStreetMap contributors / ODbL"), Paper, CreditRight, CreditY, CreditSize);
    RightText(TEXT("openstreetmap.org/copyright"), Paper, CreditRight, CreditY + CreditStep, CreditSize);
    RightText(District.SurveyCredit, Paper, CreditRight, CreditY + 2.f * CreditStep, CreditSize);
    TArray<AQuebecCar*> MapCars;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        const FVector2D Point = MapPoint(It->GetActorLocation());
        if (*It != Pawn && !It->bTraffic && FVector2D::DistSquared(Point, Center) <= FMath::Square(MapRadius - 5.f * Scale))
            MapCars.Add(*It);
    }
    MapCars.Sort([Here](const AQuebecCar& A, const AQuebecCar& B)
    {
        return FVector::DistSquared2D(Here, A.GetActorLocation()) < FVector::DistSquared2D(Here, B.GetActorLocation());
    });
    for (int32 I = 0; I < FMath::Min(8, MapCars.Num()); ++I)
    {
        const FVector2D Vehicle = MapPoint(MapCars[I]->GetActorLocation());
        DrawRect(FLinearColor(.73f, .84f, .89f), Vehicle.X - 3.f * Scale, Vehicle.Y - 2.f * Scale, 6.f * Scale, 4.f * Scale);
    }
    const FVector2D Home = MapMarker(District.PlayerSpawn);
    Text(TEXT("H"), Paper, Home.X - 4.f * Scale, Home.Y - 8.f * Scale, .85f);
    const FVector Facing = Pawn->GetActorForwardVector();
    const FVector2D Nose(Facing.X, -Facing.Y), Side(-Nose.Y, Nose.X);
    const FVector2D Tip = Center + Nose * 10.f * Scale;
    const FVector2D TailA = Center - Nose * 5.f * Scale + Side * 5.f * Scale;
    const FVector2D TailB = Center - Nose * 5.f * Scale - Side * 5.f * Scale;
    // Jacques Bertin, Semiology of Graphics (1983): a mark that shares its ground's value
    // disappears. The avenue center is paper, and this arrow was a paper outline, so the
    // heading broke up along a wide road. The ink wedge is larger. The paper wedge sits inside it.
    const FVector2D ArrowMid = (Tip + TailA + TailB) / 3.f;
    const FVector2D CaseTip = ArrowMid + (Tip - ArrowMid) * 1.55f;
    const FVector2D CaseA = ArrowMid + (TailA - ArrowMid) * 1.55f;
    const FVector2D CaseB = ArrowMid + (TailB - ArrowMid) * 1.55f;
    for (int32 Row = 0; Row <= 14; ++Row)
    {
        const float Along = static_cast<float>(Row) / 14.f;
        const FVector2D CaseLeft = FMath::Lerp(CaseTip, CaseA, Along);
        const FVector2D CaseRight = FMath::Lerp(CaseTip, CaseB, Along);
        DrawLine(CaseLeft.X, CaseLeft.Y, CaseRight.X, CaseRight.Y, Ink, 2.f * Scale);
    }
    for (int32 Row = 0; Row <= 14; ++Row)
    {
        const float Along = static_cast<float>(Row) / 14.f;
        const FVector2D FillLeft = FMath::Lerp(Tip, TailA, Along);
        const FVector2D FillRight = FMath::Lerp(Tip, TailB, Along);
        DrawLine(FillLeft.X, FillLeft.Y, FillRight.X, FillRight.Y, Paper, 2.f * Scale);
    }
    DrawLine(TailA.X, TailA.Y, Tip.X, Tip.Y, Paper, 2.f * Scale);
    DrawLine(Tip.X, Tip.Y, TailB.X, TailB.Y, Paper, 2.f * Scale);
    DrawLine(TailB.X, TailB.Y, TailA.X, TailA.Y, Paper, 2.f * Scale);
    Text(TEXT("N"), Paper, Center.X - 5.f * Scale, MapY + 8.f * Scale, .9f);

    if (bHasObjective)
    {
        const FVector2D Goal = MapMarker(Target);
        const FVector ToStop = Target - Here;
        const FVector PawnForward = Pawn->GetActorForwardVector();
        const QuebecRouteLine::FVec2 RouteFace = QuebecRouteLine::RouteFacing(
            Car != nullptr,
            static_cast<double>(PlayerOwner->GetControlRotation().Yaw),
            {PawnForward.X, PawnForward.Y});
        const double PlanCm = QuebecRouteLine::Length({ToStop.X, ToStop.Y});
        RouteBearing = QuebecRouteLine::BearingFromPlayer(RouteFace, {ToStop.X, ToStop.Y});
        RouteTurn = QuebecRouteLine::TurnFor(RouteBearing, PlanCm);
        QuebecRouteLine::FVec2 StrokeA, StrokeB;
        if (QuebecRouteLine::RadarStroke({Center.X, Center.Y}, {Goal.X, Goal.Y}, 12. * Scale, 8. * Scale, StrokeA, StrokeB))
            DrawLine(static_cast<float>(StrokeA.X), static_cast<float>(StrokeA.Y), static_cast<float>(StrokeB.X), static_cast<float>(StrokeB.Y), Accent, 2.2f * Scale);
        if (bHasNext)
        {
            FVector2D From = MapPoint(Target);
            FVector2D To = MapPoint(NextStop);
            if (ClipHUDRadarSegment(From, To, Center, MapRadius - 6.f * Scale))
                DrawLine(From.X, From.Y, To.X, To.Y, Accent.CopyWithNewOpacity(.4f), 1.4f * Scale);
        }
        const float Radius = 5.f * Scale;
        DrawLine(Goal.X, Goal.Y - Radius, Goal.X + Radius, Goal.Y, Accent, 2.f * Scale);
        DrawLine(Goal.X + Radius, Goal.Y, Goal.X, Goal.Y + Radius, Accent, 2.f * Scale);
        DrawLine(Goal.X, Goal.Y + Radius, Goal.X - Radius, Goal.Y, Accent, 2.f * Scale);
        DrawLine(Goal.X - Radius, Goal.Y, Goal.X, Goal.Y - Radius, Accent, 2.f * Scale);
        FVector2D Marker;
        const FVector Pin = Target + FVector(0., 0., 220.);
        const float ViewBottom = bPortrait ? ControlsTop : Canvas->SizeY - 250.f * Scale;
        if (PlayerOwner->ProjectWorldLocationToScreen(Pin, Marker) &&
            Marker.X > Margin + 20.f * Scale && Marker.X < Right - 20.f * Scale &&
            Marker.Y > ViewTop && Marker.Y < ViewBottom)
        {
            const float R = 10.f * Scale;
            DrawLine(Marker.X, Marker.Y - R, Marker.X + R, Marker.Y, Accent, 2.f * Scale);
            DrawLine(Marker.X + R, Marker.Y, Marker.X, Marker.Y + R, Accent, 2.f * Scale);
            DrawLine(Marker.X, Marker.Y + R, Marker.X - R, Marker.Y, Accent, 2.f * Scale);
            DrawLine(Marker.X - R, Marker.Y, Marker.X, Marker.Y - R, Accent, 2.f * Scale);
            Text(FString::Printf(TEXT("%dm"), FMath::RoundToInt(Meters)), Paper, Marker.X - 15.f * Scale, Marker.Y + 15.f * Scale, .85f);
        }
        else
        {
            FVector Eye = FVector::ZeroVector;
            FRotator View = FRotator::ZeroRotator;
            PlayerOwner->GetPlayerViewPoint(Eye, View);
            const FRotationMatrix Axes(View);
            const FVector ToPin = Pin - Eye;
            double DirX = 0., DirY = 0.;
            QuebecRouteLine::ViewToScreen(
                FVector::DotProduct(ToPin, Axes.GetUnitAxis(EAxis::X)),
                FVector::DotProduct(ToPin, Axes.GetUnitAxis(EAxis::Y)),
                FVector::DotProduct(ToPin, Axes.GetUnitAxis(EAxis::Z)),
                DirX, DirY);
            const double EdgeLeft = static_cast<double>(Margin + 28.f * Scale);
            const double EdgeTop = static_cast<double>(ViewTop);
            const double EdgeRight = static_cast<double>(Right - 28.f * Scale);
            const double EdgeBottom = static_cast<double>(ViewBottom - 28.f * Scale);
            QuebecRouteLine::FVec2 Edge;
            if (EdgeRight - EdgeLeft >= 40. * Scale && EdgeBottom - EdgeTop >= 40. * Scale &&
                QuebecRouteLine::EdgeArrow(DirX, DirY, EdgeLeft, EdgeTop, EdgeRight, EdgeBottom, Edge))
            {
                const double Span = std::hypot(DirX, DirY);
                if (Span > 1e-6)
                {
                    const float Ux = static_cast<float>(DirX / Span);
                    const float Uy = static_cast<float>(DirY / Span);
                    const float Wing = 10.f * Scale;
                    const float Spread = 6.f * Scale;
                    const float TipX = static_cast<float>(Edge.X);
                    const float TipY = static_cast<float>(Edge.Y);
                    const float BackX = TipX - Ux * Wing;
                    const float BackY = TipY - Uy * Wing;
                    DrawLine(TipX, TipY, BackX - Uy * Spread, BackY + Ux * Spread, Accent, 2.f * Scale);
                    DrawLine(TipX, TipY, BackX + Uy * Spread, BackY - Ux * Spread, Accent, 2.f * Scale);
                }
            }
        }
    }

    DrawRect(Panel, MissionX, MissionY, MissionWidth, MissionHeight);
    DrawRect(Accent, MissionX, MissionY, 2.f * Scale, MissionHeight);
    PanelRule(MissionX, MissionY, MissionWidth, MissionHeight);
    float RowY = MissionY + 10.f * Scale;
    for (const FString& Line : Titles) { Text(Line, Accent, MissionX + 12.f * Scale, RowY, .9f); RowY += 20.f * Scale; }
    for (const FString& Line : Actions) { Text(Line, Paper, MissionX + 12.f * Scale, RowY, 1.15f); RowY += 25.f * Scale; }
    for (const FString& Line : Statuses) { Text(Line, Muted, MissionX + 12.f * Scale, RowY, .9f); RowY += 20.f * Scale; }
    if (bHasObjective)
    {
        const FString Distance = RouteTurn == QuebecRouteLine::ETurn::Here
            ? FString(TEXT("here"))
            : FString::Printf(TEXT("%dm · %s"), FMath::RoundToInt(Meters), RouteTurnWord(RouteTurn));
        Text(Distance, Paper, MissionX + 12.f * Scale, RowY, .9f);
        if (RouteTurn != QuebecRouteLine::ETurn::Here)
        {
            float TextW = 0.f, TextH = 0.f;
            GetTextSize(Distance, TextW, TextH, Font, .9f * Scale);
            const float Box = 18.f * Scale;
            const float BoxX = MissionX + 12.f * Scale + TextW + 8.f * Scale;
            if (BoxX + Box <= MissionX + MissionWidth - 6.f * Scale)
            {
                QuebecRouteLine::FVec2 NeedleStart, NeedleTip;
                QuebecRouteLine::CardNeedle(RouteBearing, static_cast<double>(Box), NeedleStart, NeedleTip);
                DrawLine(BoxX + static_cast<float>(NeedleStart.X), RowY + static_cast<float>(NeedleStart.Y),
                    BoxX + static_cast<float>(NeedleTip.X), RowY + static_cast<float>(NeedleTip.Y), Accent, 2.f * Scale);
            }
        }
    }

    if (!Prompt.IsEmpty())
    {
        DrawRect(Panel, PromptX, PromptY, PromptWidth, PromptHeight);
        PanelRule(PromptX, PromptY, PromptWidth, PromptHeight);
        for (int32 I = 0; I < PromptLines.Num(); ++I) Text(PromptLines[I], Paper, PromptX + 12.f * Scale, PromptY + (10.f + I * 24.f) * Scale, 1.1f);
    }
    FString PedaloPortrait = TEXT("km/h  /  PEDALO");
    FString PedaloLandscape = TEXT("Hold gas to paddle");
    FString BikePortrait = TEXT("km/h  /  VELO");
    FString BikeLandscape = TEXT("Hold gas to pedal");
    const FString ScootPortrait = TEXT("km/h  /  TROT");
    const FString ScootLandscape = TEXT("Hold gas to kick");
    if (Car && Car->IsPedalo())
    {
        if (const AQuebecBuoy* Buoy = AQuebecBuoy::Find(GetWorld()))
        {
            PedaloPortrait = Buoy->DriveLine(true);
            PedaloLandscape = Buoy->DriveLine(false);
        }
    }
    else if (Car && Car->IsBike())
    {
        const AQuebecRing* Ring = AQuebecRing::Find(GetWorld());
        const AQuebecCrate* Crate = AQuebecCrate::Find(GetWorld());
        const FString Carry = Crate ? Crate->BikeLine(false) : FString();
        if (Ring && Ring->IsOpen())
        {
            BikePortrait = Ring->DriveLine(true);
            BikeLandscape = Ring->DriveLine(false);
        }
        else if (!Carry.IsEmpty())
        {
            BikePortrait = Crate->BikeLine(true);
            BikeLandscape = Carry;
        }
        else if (Ring)
        {
            BikePortrait = Ring->DriveLine(true);
            BikeLandscape = Ring->DriveLine(false);
        }
    }
    if (Car && bPortrait)
    {
        const float Y = ControlsTop - 66.f * Scale;
        Text(FString::Printf(TEXT("%03d"), FMath::RoundToInt(FMath::Abs(Car->Speed) * .036f)), Paper, Margin, Y, 1.8f);
        const bool bKick = Car->IsBike() || Car->IsPedalo() || Car->IsScoot();
        const FString KickCaption = Car->IsScoot() ? ScootPortrait : Car->IsBike() ? BikePortrait : Car->IsPedalo() ? PedaloPortrait : (Car->bHandbrake ? TEXT("km/h  /  HANDBRAKE") : TEXT("km/h"));
        Text(KickCaption, bKick ? Accent : (Car->bHandbrake ? Accent : Muted), Margin, Y + 38.f * Scale, .85f);
    }
    else if (Car)
    {
        const float SpeedRight = Right - (bTouchControls ? 420.f * Scale : 0.f);
        const float X = SpeedRight - 164.f * Scale;
        const float Y = Canvas->SizeY - Margin - 74.f * Scale;
        RightText(FString::Printf(TEXT("%03d"), FMath::RoundToInt(FMath::Abs(Car->Speed) * .036f)), Paper, SpeedRight - 42.f * Scale, Y, 1.8f);
        RightText(TEXT("km/h"), Muted, SpeedRight, Y + 23.f * Scale, .85f);
        Text(TEXT("WASD or arrows  Drive / steer"), Muted, X, Y + 42.f * Scale, .85f);
        const bool bKick = Car->IsBike() || Car->IsPedalo() || Car->IsScoot();
        const FString KickLine = Car->IsScoot() ? ScootLandscape : Car->IsBike() ? BikeLandscape : Car->IsPedalo() ? PedaloLandscape : (Car->bHandbrake ? TEXT("SPACE  HANDBRAKE ON") : TEXT("SPACE  Handbrake"));
        Text(KickLine, bKick || Car->bHandbrake ? Accent : Muted, X, Y + 59.f * Scale, .85f);
    }
    else if (!bPortrait && !bTouchControls)
    {
        if (const AQuebecTrio* Trio = AQuebecTrio::Find(GetWorld()))
        {
            const FString TrioLine = Trio->WalkLine();
            if (!TrioLine.IsEmpty()) Text(TrioLine, Accent, LowerLeft, Canvas->SizeY - Margin - 90.f * Scale, .9f);
        }
        if (const AQuebecCrate* Crate = AQuebecCrate::Find(GetWorld()))
        {
            const FString CrateLine = Crate->WalkLine();
            if (!CrateLine.IsEmpty()) Text(CrateLine, Accent, LowerLeft, Canvas->SizeY - Margin - 112.f * Scale, .9f);
        }
        if (Now - FirstHUDTime < 10.f)
            Text(TEXT("SPACE  Jump   /   SHIFT  Sprint"), Muted, LowerLeft, Canvas->SizeY - Margin - 68.f * Scale, .9f);
    }

    bool bFalling = false;
    if (const ACharacter* Walker = Cast<ACharacter>(Pawn))
    {
        bFalling = Walker->GetCharacterMovement()->IsFalling();
        if (bComic && bFalling && !bWasFalling && Walker->GetVelocity().Z > 300.f) TriggerSoundWord(TEXT("HOP!"));
    }
    if (bComic && Car)
    {
        if (QuebecSkidTone::Caught(Car->bHandbrake, bWasHandbrake, static_cast<double>(Car->Speed))) TriggerSoundWord(TEXT("SKRRT!"));
        if (LastCarSpeed < 900.f && Car->Speed >= 900.f) TriggerSoundWord(TEXT("VROOM!"));
    }
    bWasFalling = bFalling;
    bWasHandbrake = Car && Car->bHandbrake;
    LastCarSpeed = Car ? Car->Speed : 0.f;
    if (!bComic) SoundWordTime = -10.f;
    const float WordAge = Now - SoundWordTime;
    if (bComic && WordAge >= 0.f && WordAge < .9f)
    {
        // A held burst: radiating ink spikes behind outlined lettering, popping in over 0.12 s.
        const float Pop = FMath::Min(WordAge / .12f, 1.f) * (WordAge > .75f ? (.9f - WordAge) / .15f : 1.f);
        const FVector2D Burst(Canvas->SizeX * .5f + (bPortrait ? 0.f : 150.f * Scale), Canvas->SizeY * (bPortrait ? .42f : .47f));
        UFont* Large = GEngine->GetLargeFont();
        const float Size = 2.4f * Pop * Scale;
        // Ink spikes first, then slightly shorter yellow spikes, so the burst has an outline.
        for (int32 Pass = 0; Pass < 2; ++Pass)
            for (int32 Spike = 0; Spike < 30; ++Spike)
            {
                const float Angle = Spike * PI * 2.f / 30.f + .2f;
                const float Length = ((Spike % 2 ? 58.f : 90.f) - Pass * 8.f) * Scale * Pop;
                DrawLine(Burst.X, Burst.Y, Burst.X + FMath::Cos(Angle) * Length, Burst.Y + FMath::Sin(Angle) * Length * .7f,
                    Pass ? Accent : Ink, (Pass ? 12.f : 18.f) * Scale);
            }
        float Width = 0.f, Height = 0.f;
        GetTextSize(SoundWord, Width, Height, Large, Size);
        const float X = Burst.X - Width * .5f, Y = Burst.Y - Height * .5f;
        for (const FVector2D Offset : {FVector2D(-3, 0), FVector2D(3, 0), FVector2D(0, -3), FVector2D(0, 3), FVector2D(5, 5)})
            DrawText(SoundWord, Ink, X + Offset.X * Scale, Y + Offset.Y * Scale, Large, Size);
        DrawText(SoundWord, Paper, X, Y, Large, Size);
    }
    if (State && !bToronto)
    {
        const int32 Completed = Campaign ? Campaign->GetCompletedMissionCount() : State->MissionIndex;
        if (LastMissionIndex >= 0 && Completed > LastMissionIndex) CompletionTime = Now;
        LastMissionIndex = Completed;
        const float Age = Now - CompletionTime;
        if (Age >= 0.f && Age < 4.f)
        {
            const float Alpha = FMath::Min(FMath::Min(Age / .2f, (4.f - Age) / .6f), 1.f);
            const FString Banner = TEXT("MISSION COMPLETE");
            float W = 0.f, H = 0.f;
            GetTextSize(Banner, W, H, Font, 2.f * Scale);
            const float X = Canvas->SizeX * .5f - W * .5f;
            // On a tall screen the banner briefly covers the mission card, which is changing anyway.
            const float Y = bPortrait ? Margin + 40.f * Scale : Canvas->SizeY * .23f;
            DrawRect(Panel.CopyWithNewOpacity(.4f * Alpha), X - 25.f * Scale, Y - 10.f * Scale, W + 50.f * Scale, 85.f * Scale);
            Text(Banner, Accent.CopyWithNewOpacity(Alpha), X, Y, 2.f);
            const FString Together = FString::Printf(TEXT("%d / %d completed together"), Completed, Campaign ? 2 : 3);
            GetTextSize(Together, W, H, Font, .83f * Scale);
            Text(Together, Paper.CopyWithNewOpacity(Alpha), Canvas->SizeX * .5f - W * .5f, Y + 46.f * Scale, .83f);
        }
    }
    // Street HUD (JOBS): status column, radar blips, reticle and banners, drawn last so the banners sit on top.
    DrawStreetHUD(Scale, bPortrait, bTouchControls, MapX, MapY, MapWidth, ViewTop);
}

void AQuebecHUD::TriggerSoundWord(const TCHAR* Word)
{
    SoundWord = Word;
    SoundWordTime = GetWorld()->GetTimeSeconds();
}

AQuebecGameMode::AQuebecGameMode()
{
    DefaultPawnClass = AQuebecCharacter::StaticClass();
    PlayerControllerClass = AQuebecController::StaticClass();
    GameStateClass = AQuebecGameState::StaticClass();
    HUDClass = AQuebecHUD::StaticClass();
    PlayerStateClass = AQuebecPlayerState::StaticClass(); // Street state: health, weapons, stars, cash (COMBAT).
}

float QuebecStreetLook::OpeningYaw(const UWorld* World, const FVector& Here, float FallbackYaw)
{
    // Same length test as RoadWidthAt: each map's width array is recognised by the road count.
    const QuebecDistrict::FSettings& District = QuebecDistrict::ForWorld(World);
    const int32 TorontoRoads = static_cast<int32>(UE_ARRAY_COUNT(CollegeBathurst::RoadSegments));
    const int32 MontrealRoads = static_cast<int32>(UE_ARRAY_COUNT(LaFontaine::RoadSegmentWidths));
    const int32 ExtensionRoads = static_cast<int32>(UE_ARRAY_COUNT(LaFontaineExtension::RoadSegmentWidths));
    TArray<FSegment> Segments;
    Segments.Reserve(District.RoadCount);
    for (int32 Index = 0; Index < District.RoadCount; ++Index)
    {
        const FVector& A = District.RoadSegments[Index][0];
        const FVector& B = District.RoadSegments[Index][1];
        float Width = 0.f;
        if (District.RoadCount == TorontoRoads)
            Width = Index < static_cast<int32>(UE_ARRAY_COUNT(CollegeBathurst::RoadSegmentWidths)) ? CollegeBathurst::RoadSegmentWidths[Index] : 0.f;
        else if (Index < MontrealRoads)
            Width = LaFontaine::RoadSegmentWidths[Index];
        else
        {
            const int32 Extra = Index - MontrealRoads;
            Width = Extra < ExtensionRoads ? LaFontaineExtension::RoadSegmentWidths[Extra] : 0.f;
        }
        Segments.Add(FSegment{A.X, A.Y, B.X, B.Y, Width});
    }
    return static_cast<float>(AimYaw(Here.X, Here.Y, Segments.GetData(), Segments.Num(), FallbackYaw));
}

void AQuebecGameMode::FinishRestartPlayer(AController* NewPlayer, const FRotator& StartRotation)
{
    Super::FinishRestartPlayer(NewPlayer, StartRotation);
    // The base class writes the start rotator after possess, which puts pitch back at 0.
    // The start yaw looks along the avenue, which from this sidewalk leaves the street as a side sliver.
    if (AQuebecController* Player = Cast<AQuebecController>(NewPlayer))
        if (AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Player->GetPawn()))
            Player->FrameTheStreet(QuebecStreetLook::OpeningYaw(GetWorld(), Walker->GetActorLocation(), StartRotation.Yaw));
}

AActor* AQuebecGameMode::ChoosePlayerStart_Implementation(AController* Player)
{
    // Keep authored multiplayer starts and PIE's "Play from Here" behavior.
    AActor* Start = Super::ChoosePlayerStart_Implementation(Player);
    if (Start || !QuebecDistrict::IsToronto(GetWorld())) return Start;
    FActorSpawnParameters Parameters;
    Parameters.ObjectFlags |= RF_Transient;
    return GetWorld()->SpawnActor<APlayerStart>(QuebecDistrict::ForWorld(GetWorld()).PlayerSpawn, FRotator::ZeroRotator, Parameters);
}

void AQuebecGameMode::BeginPlay()
{
    Super::BeginPlay();
    // Any map can have a sky. QA runs keep the authored afternoon unless they ask for a time or weather.
    if (AQuebecSky::ShouldSpawn()) GetWorld()->SpawnActor<AQuebecSky>();
    const bool bToronto = QuebecDistrict::IsToronto(GetWorld());
    if (!bToronto && !GetWorld()->GetMapName().Contains(TEXT("LaFontaine"))) return;
    TArray<AActor*> RoadSurfaces;
    for (TActorIterator<AStaticMeshActor> It(GetWorld()); It; ++It)
    {
        UStaticMeshComponent* Surface = It->GetStaticMeshComponent();
        const UStaticMesh* Mesh = Surface->GetStaticMesh();
        if (Mesh && (Mesh->GetName() == TEXT("SM_Road") || Mesh->GetName().StartsWith(TEXT("SM_Asphalt"))))
        {
            RoadSurfaces.Add(*It);
            Surface->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
            Surface->SetCollisionObjectType(ECC_WorldStatic);
            Surface->SetCollisionResponseToAllChannels(ECR_Ignore);
            Surface->SetCollisionResponseToChannel(ECC_Visibility,ECR_Block);
        }
    }
    // After the road meshes accept a ground trace, so a dash is not dropped for lack of a hit.
    if (!bToronto) AQuebecLanePaint::Spawn(GetWorld());
    // Toronto has its own origin and starts as free roam, with only its authored starter car.
    if (bToronto) return;
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")))
    {
        GetWorld()->SpawnActor<AQuebecCampaign>();
        for (TActorIterator<AStaticMeshActor> It(GetWorld()); It; ++It)
            if (const UMaterialInterface* Material = It->GetStaticMeshComponent()->GetMaterial(0);
                Material && Material->GetName().Contains(TEXT("Beacon")))
                It->SetActorHiddenInGame(true);
    }
    // Side jobs (JOBS): six yellow markers, one shared job at a time. No cars spawn here, so population is unchanged.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")) && !FParse::Param(FCommandLine::Get(), TEXT("NordNoSideJobs")))
        GetWorld()->SpawnActor<AQuebecSideJobs>();
    // Chez Lise, on the Sherbrooke sidewalk. E spends session cash. No population change.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")))
        GetWorld()->SpawnActor<AQuebecCart>();
    // The stage bow. Hidden until the goon fight is won. No population change.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")))
        GetWorld()->SpawnActor<AQuebecBow>();
    // The atelier. E spends session cash to clear body damage on a nearby car. No population change.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")))
        GetWorld()->SpawnActor<AQuebecBay>();
    // One pedalo in the channel beside the north-pond bridge. It is not a parked street car.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")))
    {
        static_assert(QuebecRide::PedaloKind == 1, "IsPedalo() follows PedaloKind");
        const FVector Point(static_cast<float>(QuebecRide::BerthX), static_cast<float>(QuebecRide::BerthY), QuebecRide::BerthZ);
        const FRotator Facing(0.f, QuebecRide::BerthYaw, 0.f);
        const FTransform Transform(Facing, Point);
        AQuebecCar* Boat = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(), Transform, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (Boat)
        {
            Boat->RideKind = QuebecRide::PedaloKind;
            Boat->Tags.Add(TEXT("Pedalo"));
            Boat->FinishSpawning(Transform);
            UE_LOG(LogTemp, Display, TEXT("NORD_PEDALO berth x=%.0f y=%.0f"), Point.X, Point.Y);
        }
        GetWorld()->SpawnActor<AQuebecBuoy>(FVector(QuebecLap::BuoyX, QuebecLap::BuoyY, 0.), FRotator::ZeroRotator);
        GetWorld()->SpawnActor<AQuebecWade>(FVector(QuebecWade::BuoyX, QuebecWade::BuoyY, 0.), FRotator::ZeroRotator);
        GetWorld()->SpawnActor<AQuebecTrio>(FVector(QuebecTrio::Stops[0].X, QuebecTrio::Stops[0].Y, 0.), FRotator::ZeroRotator);
        // One bike in the dry park east of the spawn. It is not a parked street car.
        static_assert(QuebecCycle::BikeKind == 2, "IsBike() follows BikeKind");
        FVector BikePoint(static_cast<float>(QuebecCycle::StandX), static_cast<float>(QuebecCycle::StandY), 0.f);
        FHitResult GroundHit;
        FCollisionQueryParams GroundQuery(SCENE_QUERY_STAT(BikeStand), false);
        const FVector TraceStart = BikePoint + FVector(0.f, 0.f, 200.f);
        if (GetWorld()->LineTraceSingleByChannel(GroundHit, TraceStart, TraceStart - FVector(0.f, 0.f, 800.f), ECC_Visibility, GroundQuery))
            BikePoint = GroundHit.ImpactPoint + FVector(0.f, 0.f, 102.f);
        else
            BikePoint.Z = QuebecCycle::StandZ;
        const FRotator BikeYaw(0.f, QuebecCycle::StandYaw, 0.f);
        const FTransform BikeTransform(BikeYaw, BikePoint);
        AQuebecCar* Bike = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(), BikeTransform, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (Bike)
        {
            Bike->RideKind = QuebecCycle::BikeKind;
            Bike->Tags.Add(TEXT("Velo"));
            Bike->FinishSpawning(BikeTransform);
            UE_LOG(LogTemp, Display, TEXT("NORD_BIKE stand x=%.0f y=%.0f"), BikePoint.X, BikePoint.Y);
        }
        GetWorld()->SpawnActor<AQuebecRing>(FVector(QuebecRing::GateAX, QuebecRing::GateAY, 0.), FRotator::ZeroRotator);
        GetWorld()->SpawnActor<AQuebecCrate>(FVector(QuebecCrate::CurbX, QuebecCrate::CurbY, 0.), FRotator::ZeroRotator);
        // One kick scooter on the dry lawn. It is not a parked street car.
        static_assert(QuebecScoot::ScootKind == 3, "IsScoot() follows ScootKind");
        FVector ScootPoint(static_cast<float>(QuebecScoot::StandX), static_cast<float>(QuebecScoot::StandY), 0.f);
        FHitResult ScootGround;
        FCollisionQueryParams ScootQuery(SCENE_QUERY_STAT(ScootStand), false);
        const FVector ScootTrace = ScootPoint + FVector(0.f, 0.f, 200.f);
        if (GetWorld()->LineTraceSingleByChannel(ScootGround, ScootTrace, ScootTrace - FVector(0.f, 0.f, 800.f), ECC_Visibility, ScootQuery))
            ScootPoint = ScootGround.ImpactPoint + FVector(0.f, 0.f, 102.f);
        else
            ScootPoint.Z = QuebecScoot::StandZ;
        const FRotator ScootYaw(0.f, QuebecScoot::StandYaw, 0.f);
        const FTransform ScootTransform(ScootYaw, ScootPoint);
        AQuebecCar* Scooter = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(), ScootTransform, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (Scooter)
        {
            Scooter->RideKind = QuebecScoot::ScootKind;
            Scooter->Tags.Add(TEXT("Trot"));
            Scooter->FinishSpawning(ScootTransform);
            UE_LOG(LogTemp, Display, TEXT("NORD_SCOOT stand x=%.0f y=%.0f"), ScootPoint.X, ScootPoint.Y);
        }
    }
    // Combat: weapon, vest and health pickups at street and park points, none near a QA anchor and no collision.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign"))) QuebecCombat::SpawnPickups(GetWorld());
    // Police (POLICE): the dispatcher and its garage sign. Police cars and officers appear only while a player has stars.
    if (!FParse::Param(FCommandLine::Get(), TEXT("NordNoCampaign")) && !FParse::Param(FCommandLine::Get(), TEXT("NordNoPolice")))
        GetWorld()->SpawnActor<AQuebecPoliceDispatch>();
    static_assert(UE_ARRAY_COUNT(LaFontaine::RoadSegments) == UE_ARRAY_COUNT(LaFontaine::RoadSegmentWidths));
    static_assert(UE_ARRAY_COUNT(LaFontaine::RoadSegments) == UE_ARRAY_COUNT(LaFontaine::RoadParkingDirections));
    static_assert(UE_ARRAY_COUNT(LaFontaine::RoadSegments) == UE_ARRAY_COUNT(LaFontaine::RoadParkingSides));

    // Runtime population stays bounded and uses the surveyed streets and existing park paths.
    constexpr int32 ParkedGoal = 32, TrafficGoal = 16, ParkCrowdGoal = 64, StreetCrowdGoal = 32;
    TArray<TArray<FVector>> ParkRoutes;
    for (TActorIterator<AQuebecParkResident> It(GetWorld()); It; ++It)
        if (It->Route.Num() > 1) ParkRoutes.Add(It->Route);
    TArray<int32> NearRoads;
    for (int32 I = 0; I < UE_ARRAY_COUNT(LaFontaine::RoadSegments); ++I)
        if (FVector::DistSquared2D(LaFontaine::RoadSegments[I][0],LaFontaine::RoadSegments[I][1]) > FMath::Square(1800.f))
            NearRoads.Add(I);
    TArray<int32> StreetRoads = NearRoads;
    StreetRoads.Sort([](int32 A, int32 B)
    {
        const FVector PointA = FMath::ClosestPointOnSegment(MansionSpawn,LaFontaine::RoadSegments[A][0],LaFontaine::RoadSegments[A][1]);
        const FVector PointB = FMath::ClosestPointOnSegment(MansionSpawn,LaFontaine::RoadSegments[B][0],LaFontaine::RoadSegments[B][1]);
        return FVector::DistSquared2D(PointA,MansionSpawn) < FVector::DistSquared2D(PointB,MansionSpawn);
    });
    NearRoads.Sort([](int32 A, int32 B)
    {
        const FVector MidA = (LaFontaine::RoadSegments[A][0]+LaFontaine::RoadSegments[A][1])*.5;
        const FVector MidB = (LaFontaine::RoadSegments[B][0]+LaFontaine::RoadSegments[B][1])*.5;
        return FVector::DistSquared2D(MidA,MansionSpawn) < FVector::DistSquared2D(MidB,MansionSpawn);
    });
    TArray<int32> DistrictRoads = NearRoads;
    FRandomStream Random(7493);
    for (int32 I = DistrictRoads.Num()-1; I > 0; --I) DistrictRoads.Swap(I,Random.RandRange(0,I));

    const auto Ground = [this,&RoadSurfaces](FVector& Point, bool bRoadSurface = false)
    {
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PopulationFloor),bRoadSurface);
        if (!bRoadSurface) Query.AddIgnoredActors(RoadSurfaces);
        if (!GetWorld()->LineTraceSingleByChannel(Hit,Point+FVector(0.,0.,500.),Point-FVector(0.,0.,1000.),ECC_Visibility,Query) ||
            !Hit.IsValidBlockingHit() || Hit.ImpactNormal.Z < .7f || Hit.ImpactPoint.Z > 50.f || Hit.ImpactPoint.Z < -200.f) return false;
        if (bRoadSurface)
        {
            const UStaticMeshComponent* Surface = Cast<UStaticMeshComponent>(Hit.GetComponent());
            const UStaticMesh* Mesh = Surface ? Surface->GetStaticMesh() : nullptr;
            if (!Mesh || (Mesh->GetName()!=TEXT("SM_Road") && !Mesh->GetName().StartsWith(TEXT("SM_Asphalt")))) return false;
        }
        Point.Z = Hit.ImpactPoint.Z;
        return true;
    };
    const auto CurbParking = [this,&Ground](const FVector& Center, const FVector& Direction, const FVector& Right, float Side, float Width, FVector& Point, FVector& ParkingDirection)
    {
        double Edges[3];
        int32 Index = 0;
        double Nearest = DBL_MAX, Farthest = 0.;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(ParkingCurb),true);
        for (float Along : {-235.f,0.f,235.f})
        {
            double Edge = 0.;
            for (double Lateral = Width*.5-100.; Lateral <= Width*.5+1000.; Lateral += 20.)
            {
                FVector Sample = Center+Direction*Along+Right*(Side*Lateral);
                Sample.Z = 0.;
                FHitResult Hit;
                if (!GetWorld()->LineTraceSingleByChannel(Hit,Sample+FVector(0.,0.,45.),Sample-FVector(0.,0.,30.),ECC_Visibility,Query)) continue;
                const UStaticMeshComponent* Component = Cast<UStaticMeshComponent>(Hit.GetComponent());
                const UStaticMesh* Mesh = Component ? Component->GetStaticMesh() : nullptr;
                if (Mesh && Mesh->GetName().StartsWith(TEXT("SM_Concrete_Collision")) && Hit.ImpactPoint.Z>=17. && Hit.ImpactPoint.Z<=25.)
                { Edge = Lateral; break; }
            }
            if (Edge == 0.) return false;
            Edges[Index++] = Edge;
            Nearest = FMath::Min(Nearest,Edge);
            Farthest = FMath::Max(Farthest,Edge);
        }
        if (Farthest-Nearest>100. || Nearest<540. || FMath::Abs(Edges[1]-(Edges[0]+Edges[2])*.5)>20.) return false;
        ParkingDirection = (Direction*470.+Right*(Side*(Edges[2]-Edges[0]))).GetSafeNormal2D();
        const FVector CurbRight = FVector::CrossProduct(FVector::UpVector,ParkingDirection);
        // Leave 30 cm for the body, including the 20 cm curb sampling tolerance.
        Point = Center+Right*(Side*Edges[1])-CurbRight*(Side*140.);
        const double InnerEdge = FMath::Abs(FVector::DotProduct(Point-Center,Right))-
            FMath::Abs(FVector::DotProduct(ParkingDirection,Right))*235.-FMath::Abs(FVector::DotProduct(ParkingDirection,Direction))*110.;
        if (InnerEdge<280.) return false;
        return Ground(Point,true) && Point.Z<=12.f;
    };
    // Preserve the starter's block and heading, using its actual raised curb.
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        if (FVector::DistSquared2D(It->GetActorLocation(),LaFontaine::CarSpawn) < FMath::Square(300.f))
        {
            AQuebecCar* Starter = *It;
            Starter->Tags.AddUnique(TEXT("StarterCar"));
            int32 Nearest = INDEX_NONE;
            double Distance = DBL_MAX;
            for (int32 Road : NearRoads)
            {
                const FVector Point = FMath::ClosestPointOnSegment(LaFontaine::CarSpawn,LaFontaine::RoadSegments[Road][0],LaFontaine::RoadSegments[Road][1]);
                const double Candidate = FVector::DistSquared2D(Point,LaFontaine::CarSpawn);
                if (Candidate<Distance) { Nearest=Road; Distance=Candidate; }
            }
            bool bParked = false;
            if (Nearest != INDEX_NONE)
            {
                const FVector Direction = (LaFontaine::RoadSegments[Nearest][1]-LaFontaine::RoadSegments[Nearest][0]).GetSafeNormal2D();
                const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
                const float Preferred = FVector::DotProduct(MansionSpawn-LaFontaine::CarSpawn,Right)>=0. ? 1.f : -1.f;
                for (float Offset : {0.f,600.f,-600.f,1200.f,-1200.f})
                {
                    const FVector Center = LaFontaine::CarSpawn+Direction*Offset;
                    const double Along = FVector::DotProduct(Center-LaFontaine::RoadSegments[Nearest][0],Direction);
                    if (Along<1470. || Along>FVector::Dist2D(LaFontaine::RoadSegments[Nearest][0],LaFontaine::RoadSegments[Nearest][1])-1470.) continue;
                    for (float Side : {Preferred,-Preferred})
                    {
                        if (!(LaFontaine::RoadParkingSides[Nearest] & (Side<0.f ? 1 : 2))) continue;
                        FVector Point, CurbDirection;
                        if (!CurbParking(Center,Direction,Right,Side,LaFontaine::RoadSegmentWidths[Nearest],Point,CurbDirection)) continue;
                        Point.Z += 102.f;
                        const FQuat Facing = (CurbDirection*(LaFontaine::RoadParkingDirections[Nearest] ? LaFontaine::RoadParkingDirections[Nearest] : Side)).Rotation().Quaternion();
                        if (!Starter->CanFitAt(Point,Facing)) continue;
                        Starter->SetActorLocationAndRotation(Point,Facing,false,nullptr,ETeleportType::TeleportPhysics);
                        Starter->ForceNetUpdate();
                        bParked = true;
                        UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION starter_curb_offset_cm=%.0f"),FVector::Dist2D(Point,LaFontaine::CarSpawn));
                        break;
                    }
                    if (bParked) break;
                }
            }
            if (!bParked) UE_LOG(LogTemp,Warning,TEXT("NORD_POPULATION no valid starter curb space"));
            break;
        }
    if (FParse::Param(FCommandLine::Get(),TEXT("NordNoAmbient"))) return;
    // Old saved cars at a 210 cm offset overlap traffic. Keep the starter
    // anchor and find real asphalt spaces on the nearest sufficiently wide road.
    int32 Reparked = 0;
    float FarthestParkingMove = 0.f;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        AQuebecCar* Car = *It;
        const FVector Original = Car->GetActorLocation();
        if (Car->Occupant || Car->GetController() || Car->ActorHasTag(TEXT("CampaignLoan")) ||
            Car->ActorHasTag(TEXT("StarterCar"))) continue;
        TArray<int32> ParkingRoads;
        for (int32 I : NearRoads)
            if (LaFontaine::RoadSegmentWidths[I] >= 600.f && FVector::Dist2D(LaFontaine::RoadSegments[I][0],LaFontaine::RoadSegments[I][1])>=2940.f) ParkingRoads.Add(I);
        ParkingRoads.Sort([Original](int32 A, int32 B)
        {
            const FVector PointA = FMath::ClosestPointOnSegment(Original,LaFontaine::RoadSegments[A][0],LaFontaine::RoadSegments[A][1]);
            const FVector PointB = FMath::ClosestPointOnSegment(Original,LaFontaine::RoadSegments[B][0],LaFontaine::RoadSegments[B][1]);
            return FVector::DistSquared2D(Original,PointA) < FVector::DistSquared2D(Original,PointB);
        });
        bool bParked = false;
        for (int32 Road : ParkingRoads)
        {
            const FVector Start = LaFontaine::RoadSegments[Road][0], End = LaFontaine::RoadSegments[Road][1];
            const FVector Direction = (End-Start).GetSafeNormal2D();
            const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
            const float Along = FMath::Clamp(float(FVector::DotProduct(Original-Start,Direction)),1470.f,float((End-Start).Size2D()-1470.f));
            const FVector RoadPoint = Start+Direction*Along;
            const float PreferredSide = FVector::DotProduct(Original-RoadPoint,Right) >= 0. ? 1.f : -1.f;
            for (int32 Attempt = 0; Attempt < 2; ++Attempt)
            {
                const float Side = PreferredSide*(Attempt ? -1.f : 1.f);
                if (!(LaFontaine::RoadParkingSides[Road] & (Side<0.f ? 1 : 2))) continue;
                FVector Point, CurbDirection;
                if (!CurbParking(RoadPoint,Direction,Right,Side,LaFontaine::RoadSegmentWidths[Road],Point,CurbDirection)) continue;
                const FRotator Facing = (CurbDirection*(LaFontaine::RoadParkingDirections[Road] ? LaFontaine::RoadParkingDirections[Road] : Side)).Rotation();
                Point.Z += 102.f;
                if (!Car->CanFitAt(Point,Facing.Quaternion())) continue;
                bool bClose = false;
                for (TActorIterator<AQuebecCar> Other(GetWorld()); Other; ++Other)
                    if (*Other != Car && FVector::DistSquared2D(Point,Other->GetActorLocation())<FMath::Square(600.f)) bClose = true;
                if (bClose) continue;
                Car->SetActorLocationAndRotation(Point,Facing,false,nullptr,ETeleportType::TeleportPhysics);
                Car->ForceNetUpdate();
                FarthestParkingMove = FMath::Max(FarthestParkingMove,float(FVector::Dist2D(Point,Original)));
                ++Reparked;
                bParked = true;
                break;
            }
            if (bParked) break;
        }
    }
    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION authored_cars_reparked=%d max_repark_distance_cm=%.0f"),Reparked,FarthestParkingMove);
    // A mapped street can run through an estimated building or a surveyed tree.
    // Validate both complete lanes against fixed geometry and idle cars, then
    // prune branches again so a removed corridor cannot lead traffic into a dead end.
    TArray<bool> TrafficRoads = ClosedTrafficRoads();
    FCollisionObjectQueryParams StaticObjects;
    StaticObjects.AddObjectTypesToQuery(ECC_WorldStatic);
    StaticObjects.AddObjectTypesToQuery(ECC_Pawn);
    FCollisionQueryParams LaneQuery(SCENE_QUERY_STAT(TrafficLaneClearance),false);
    int32 BlockedRoads = 0, CirculatingRoads = 0;
    for (int32 I = 0; I < TrafficRoads.Num(); ++I)
        if (TrafficRoads[I])
        {
            const FVector Start = LaFontaine::RoadSegments[I][0], End = LaFontaine::RoadSegments[I][1];
            const FVector Direction = (End-Start).GetSafeNormal2D();
            const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
            for (int32 Side : {-1,1})
            {
                FHitResult Hit;
                const FVector Offset = Right*(Side*145.)+FVector(0.,0.,102.);
                if (GetWorld()->SweepSingleByObjectType(Hit,Start+Offset,End+Offset,Direction.Rotation().Quaternion(),
                    StaticObjects,FCollisionShape::MakeBox(FVector(235.,110.,80.)),LaneQuery))
                {
                    TrafficRoads[I] = false;
                    ++BlockedRoads;
                    break;
                }
            }
        }
    PruneTrafficBranches(TrafficRoads);
    for (bool bAllowed : TrafficRoads) if (bAllowed) ++CirculatingRoads;
    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION static_blocked_roads=%d circulating_roads=%d"),BlockedRoads,CirculatingRoads);
    TArray<bool> LocalTrafficRoads = TrafficRoads;
    for (int32 I = 0; I < LocalTrafficRoads.Num(); ++I)
        LocalTrafficRoads[I] = LocalTrafficRoads[I] &&
            FVector::DistSquared2D(LaFontaine::RoadSegments[I][0], MansionSpawn) <= FMath::Square(25000.f) &&
            FVector::DistSquared2D(LaFontaine::RoadSegments[I][1], MansionSpawn) <= FMath::Square(25000.f);
    PruneTrafficBranches(LocalTrafficRoads);
    int32 LocalRoadCount = 0;
    for (bool bAllowed : LocalTrafficRoads) if (bAllowed) ++LocalRoadCount;
    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION local_circulating_roads=%d radius_m=250"),LocalRoadCount);
    const auto ClearCar = [this,&Ground](FVector& Point, const FQuat& Rotation, bool bParking = false)
    {
        if (FVector::DistSquared2D(Point,LaFontaine::CarSpawn) < FMath::Square(bParking ? 600.f : 3500.f) || !Ground(Point,true)) return false;
        Point.Z += 102.f;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PopulationCar),false);
        if (GetWorld()->OverlapBlockingTestByChannel(Point,Rotation,ECC_Pawn,FCollisionShape::MakeBox(FVector(235.,113.,98.)),Query)) return false;
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
            if (FVector::DistSquared2D(Point,It->GetActorLocation()) < FMath::Square(600.f)) return false;
        return true;
    };
    const auto SpawnCar = [this,&TrafficRoads,&LocalTrafficRoads](const FVector& Point, const FRotator& Rotation, int32 Style, int32 Road, bool bForward, bool bLocal = false)
    {
        const FTransform Transform(Rotation,Point);
        AQuebecCar* Car = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(),Transform,nullptr,nullptr,ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (!Car) return false;
        Car->PaintStyle = Style % 4;
        Car->BodyProfile = Style % 3;
        Car->Tags.Add(Road == INDEX_NONE ? TEXT("CityParked") : TEXT("CityTraffic"));
        if (Road != INDEX_NONE)
        {
            Car->SetTrafficRoute(Road,bForward,bLocal ? LocalTrafficRoads : TrafficRoads);
            if (bLocal) Car->Tags.Add(TEXT("CityLocalTraffic"));
        }
        Car->FinishSpawning(Transform);
        return true;
    };
    const auto ClearRoute = [this,&Ground](TArray<FVector>& Route)
    {
        for (FVector& Point : Route)
        {
            if (!Ground(Point)) return false;
            Point.Z += 7.f;
        }
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PopulationWalk),false);
        for (int32 I = 1; I < Route.Num(); ++I)
        {
            FHitResult Hit;
            if (GetWorld()->SweepSingleByChannel(Hit,Route[I-1]+FVector(0.,0.,100.),Route[I]+FVector(0.,0.,100.),
                FQuat::Identity,ECC_Pawn,FCollisionShape::MakeCapsule(35.f,90.f),Query)) return false;
        }
        return true;
    };
    int32 ResidentIndex = 0, MobileIndex = 0;
    const auto SpawnResident = [this,&ResidentIndex,&MobileIndex](const TArray<FVector>& Route, bool bSocial, FName Hub = NAME_None)
    {
        const int32 Index = ResidentIndex;
        const int32 Activity = bSocial ? 2 : (MobileIndex%11 < 2 ? 1 : 0);
        // Living street: some walkers bring a dog, a stroller or groceries; a stroller slows its pusher. Counts stay 14 + 96.
        const uint8 Companion = QuebecLife::CompanionFor(MobileIndex,Activity);
        const float Pace = QuebecLife::CompanionPace(Companion,Activity == 1 ? 185.f+12.f*(Index%5) : 78.f+8.f*(Index%6));
        const float Pause = 2.f+.7f*(Index%8);
        const float Phase = Index*7.91f;
        float Length = 0.f;
        for (int32 I = 1; I < Route.Num(); ++I) Length += FVector::Distance(Route[I-1],Route[I]);
        const FResidentTravel Travel = SampleResidentTravel(GetWorld()->GetTimeSeconds()+Phase,Length,Pace,Pause);
        FVector Direction;
        const FVector Point = ResidentPointOnRoute(Route,bSocial ? 0.f : Travel.Distance,Direction);
        if (!bSocial && Travel.bReturn) Direction *= -1.;
        const FTransform Transform(Direction.Rotation(),Point);
        AQuebecParkResident* Resident = GetWorld()->SpawnActorDeferred<AQuebecParkResident>(AQuebecParkResident::StaticClass(),Transform,
            nullptr,nullptr,ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (!Resident) return false;
        Resident->Style = 3+Index%8;
        Resident->Route = Route;
        Resident->Phase = Phase;
        Resident->Activity = Activity;
        Resident->Pace = Pace;
        Resident->PauseSeconds = Pause;
        Resident->Companion = Companion;
        Resident->Tags.Add(TEXT("CityCrowd"));
        Resident->Tags.Add(Activity == 2 ? TEXT("CitySocial") : Activity == 1 ? TEXT("CityJog") : TEXT("CityWalk"));
        if (!Hub.IsNone()) Resident->Tags.Add(Hub);
        Resident->FinishSpawning(Transform);
        ++ResidentIndex;
        if (!bSocial) ++MobileIndex;
        return true;
    };
    const auto StreetRoute = [](int32 Road, int32 Side, bool bNearSpawn)
    {
        const FVector Start = LaFontaine::RoadSegments[Road][0], End = LaFontaine::RoadSegments[Road][1];
        const FVector Direction = (End-Start).GetSafeNormal2D();
        const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
        const float Length = FVector::Dist2D(Start,End);
        const float HalfLength = FMath::Min(Length*.5f-400.f,1300.f);
        const float Along = bNearSpawn ? FMath::Clamp(float(FVector::DotProduct(MansionSpawn-Start,Direction)),
            HalfLength+400.f,Length-HalfLength-400.f) : Length*.5f;
        const FVector Center = Start+Direction*Along+Right*(Side*(LaFontaine::RoadSegmentWidths[Road]*.5f+150.f));
        return TArray<FVector>{Center-Direction*HalfLength,Center+Direction*HalfLength};
    };
    // Exact subset of surveyed ParkComic/layout.json paths[170], beside the
    // pond-facing chalet edge. Use the path itself, not a line across the terrace or pond.
    TArray<TArray<FVector>> HubRoutes;
    HubRoutes.Add(TArray<FVector>{FVector(5365.751,1054.200,7.),FVector(5414.885,1361.444,7.),FVector(5387.588,1745.498,7.),
        FVector(5282.301,2022.684,7.),FVector(4103.084,4124.406,7.)});
    for (int32 Mission : {0,2,1})
    {
        int32 Best = INDEX_NONE;
        double BestDistance = TNumericLimits<double>::Max();
        for (int32 I = 0; I < ParkRoutes.Num(); ++I)
        {
            const FVector Right = FVector::CrossProduct(FVector::UpVector,(ParkRoutes[I].Last()-ParkRoutes[I][0]).GetSafeNormal2D());
            bool bClear = true;
            for (float Offset : {-55.f,55.f})
            {
                TArray<FVector> Lane = ParkRoutes[I];
                for (FVector& Point : Lane) Point += Right*Offset;
                if (!ClearRoute(Lane)) { bClear = false; break; }
            }
            if (!bClear) continue;
            const FVector Center = (ParkRoutes[I][0]+ParkRoutes[I].Last())*.5;
            const double Distance = FVector::DistSquared2D(Center,AQuebecGameState::MissionLocations[Mission]);
            if (Distance < BestDistance) { Best = I; BestDistance = Distance; }
        }
        if (Best != INDEX_NONE) HubRoutes.Add(ParkRoutes[Best]);
    }
    const FName ParkHubNames[] = {TEXT("CityChalet"),TEXT("CityPond"),TEXT("CitySports"),TEXT("CityTheatre")};
    TArray<FVector> SpawnStreet;
    for (int32 Road : StreetRoads)
    {
        for (int32 Side : {-1,1})
        {
            TArray<FVector> Route = StreetRoute(Road,Side,true);
            if (ClearRoute(Route)) { SpawnStreet = Route; break; }
        }
        if (SpawnStreet.Num()) break;
    }
    int32 Parked = 0, Traffic = 0, ParkCrowd = 0, StreetCrowd = 0;
    int32 SocialCount = 0;
    const auto SocialPair = [&ClearRoute,&SpawnResident,&SocialCount](const TArray<FVector>& Base, FName Hub)
    {
        if (Base.Num() < 2) return false;
        float Length = 0.f;
        for (int32 I = 1; I < Base.Num(); ++I) Length += FVector::Distance(Base[I-1],Base[I]);
        FVector Direction;
        const FVector Center = ResidentPointOnRoute(Base,Length*.5f,Direction);
        const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
        for (float Offset : {125.f,-125.f,180.f,-180.f,0.f})
        {
            TArray<FVector> Pair = {Center+Right*Offset-Direction*80.f,Center+Right*Offset+Direction*80.f};
            if (!ClearRoute(Pair)) continue;
            if (!SpawnResident(Pair,true,Hub)) return false;
            Pair.Swap(0,1);
            if (!SpawnResident(Pair,true,Hub)) return false;
            SocialCount += 2;
            return true;
        }
        return false;
    };
    // Four small social pairs reuse eight slots. The remaining 88 residents move.
    for (int32 I : {0,1,2})
        if (HubRoutes.IsValidIndex(I) && SocialPair(HubRoutes[I],ParkHubNames[I])) ParkCrowd += 2;
    if (SocialPair(SpawnStreet,TEXT("CitySherbrooke"))) StreetCrowd += 2;
    for (int32 I = 0; SocialCount < 8 && I < ParkRoutes.Num(); ++I)
        if (SocialPair(ParkRoutes[I],NAME_None)) ParkCrowd += 2;
    // Stagger turnaround points along the surveyed polyline, keeping separate
    // 110 cm walking lanes and enough distance for a useful walk between pauses.
    // Static capsule sweeps still validate each complete route and its bends.
    for (int32 Hub = 0; Hub < HubRoutes.Num(); ++Hub)
    {
        float Length = 0.f;
        for (int32 I = 1; I < HubRoutes[Hub].Num(); ++I) Length += FVector::Distance(HubRoutes[Hub][I-1],HubRoutes[Hub][I]);
        const int32 Count = FMath::Clamp(FMath::FloorToInt((Length-600.f)/120.f)+1,1,6);
        for (int32 I = 0; I < Count; ++I)
        {
            TArray<FVector> Route = TrimResidentRoute(HubRoutes[Hub],I*120.f,(Count-1-I)*120.f);
            const FVector Right = FVector::CrossProduct(FVector::UpVector,(Route.Last()-Route[0]).GetSafeNormal2D());
            for (FVector& Point : Route) Point += Right*(I%2 ? -55.f : 55.f);
            if (ClearRoute(Route) && SpawnResident(Route,false,ParkHubNames[Hub])) ++ParkCrowd;
        }
    }

    for (int32 Pass = 0; Pass < 2; ++Pass)
    {
        const int32 ParkedLimit = Pass ? ParkedGoal : ParkedGoal/2;
        const int32 TrafficLimit = Pass ? TrafficGoal : TrafficGoal/2;
        for (int32 Road : (Pass ? DistrictRoads : NearRoads))
        {
            const FVector Start = LaFontaine::RoadSegments[Road][0], End = LaFontaine::RoadSegments[Road][1];
            const FVector Direction = (End-Start).GetSafeNormal2D();
            const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
            for (int32 Side : {-1,1})
            {
                const FRotator Facing = (Direction*Side).Rotation();
                if (LaFontaine::RoadSegmentWidths[Road] >= 600.f && Parked < ParkedLimit && (LaFontaine::RoadParkingSides[Road] & (Side<0 ? 1 : 2)))
                    for (float Along = 1470.f; Along <= (End-Start).Size2D()-1470.f && Parked < ParkedLimit; Along += 200.f)
                    {
                        FVector Parking, CurbDirection;
                        if (!CurbParking(Start+Direction*Along,Direction,Right,Side,LaFontaine::RoadSegmentWidths[Road],Parking,CurbDirection)) continue;
                        const FRotator ParkFacing = (CurbDirection*(LaFontaine::RoadParkingDirections[Road] ? LaFontaine::RoadParkingDirections[Road] : Side)).Rotation();
                        if (Parked < ParkedLimit && Ground(Parking,true) && Parking.Z<=12.f && ClearCar(Parking,ParkFacing.Quaternion(),true) && SpawnCar(Parking,ParkFacing,Parked,INDEX_NONE,true)) ++Parked;
                    }
                FVector Moving = FMath::Lerp(Start,End,Side > 0 ? .65 : .35)+Right*(Side*145.);
                if (Traffic < TrafficLimit && (Pass ? TrafficRoads[Road] : LocalTrafficRoads[Road]) &&
                    ClearCar(Moving,Facing.Quaternion()) && SpawnCar(Moving,Facing,Traffic+1,Road,Side > 0,!Pass)) ++Traffic;

            }
            if (Parked == ParkedLimit && Traffic == TrafficLimit) break;
        }
    }
    for (int32 Pass = 0; Pass < 2; ++Pass)
    {
        const int32 Limit = Pass ? StreetCrowdGoal : StreetCrowdGoal/2;
        for (int32 Road : (Pass ? DistrictRoads : StreetRoads))
        {
            for (int32 Side : {-1,1})
            {
                if (StreetCrowd >= Limit) break;
                TArray<FVector> Route = StreetRoute(Road,Side,Pass == 0);
                const bool bNearSpawn = FVector::DistSquared2D((Route[0]+Route.Last())*.5,MansionSpawn) < FMath::Square(5000.f);
                if (ClearRoute(Route) && SpawnResident(Route,false,bNearSpawn ? FName(TEXT("CitySherbrooke")) : NAME_None)) ++StreetCrowd;
            }
            if (StreetCrowd == Limit) break;
        }
    }
    // Stagger walkers on both sides of the existing mapped park paths; no navigation or path finding per frame.
    for (int32 Attempt = 0; ParkCrowd < ParkCrowdGoal && Attempt < ParkRoutes.Num()*12; ++Attempt)
    {
        TArray<FVector> Route = ParkRoutes[Attempt%ParkRoutes.Num()];
        const FVector Right = FVector::CrossProduct(FVector::UpVector,(Route.Last()-Route[0]).GetSafeNormal2D());
        const float Offset = (Attempt/ParkRoutes.Num()%2 ? -1.f : 1.f)*(25.f+15.f*(Attempt/ParkRoutes.Num()%3));
        for (FVector& Point : Route) Point += Right*Offset;
        if (ClearRoute(Route) && SpawnResident(Route,false)) ++ParkCrowd;
    }
    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION parked=%d/%d traffic=%d/%d pedestrians=%d/%d"),
        Parked,ParkedGoal,Traffic,TrafficGoal,ParkCrowd+StreetCrowd,ParkCrowdGoal+StreetCrowdGoal);
    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION social=%d mobile=%d"),SocialCount,MobileIndex);
    if (Parked < ParkedGoal || Traffic < TrafficGoal || ParkCrowd < ParkCrowdGoal || StreetCrowd < StreetCrowdGoal)
        UE_LOG(LogTemp,Warning,TEXT("NORD_POPULATION some placements were blocked by world collision"));
    // Street traces: knockable cones around two work zones and bins at the curb, placed after the parked cars.
    AQuebecStreetProp::SpawnStreetProps(GetWorld());
}

#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCrewReapplyTest, "Quebec.Animation.ReapplyCrew", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCrewReapplyTest::RunTest(const FString& Parameters)
{
    const FString OriginalCommandLine = FCommandLine::Get();
    FCommandLine::Set(*OriginalCommandLine.Replace(TEXT("-NordGraphicNovelCandidate"), TEXT(""), ESearchCase::IgnoreCase)
        .Replace(TEXT("-NordGraphicNovelGenerated"), TEXT(""), ESearchCase::IgnoreCase)
        .Replace(TEXT("-NordGraphicNovelHighDetail"), TEXT(""), ESearchCase::IgnoreCase)
        .Replace(TEXT("-NordGraphicNovelTripo"), TEXT(""), ESearchCase::IgnoreCase));
    ON_SCOPE_EXIT { FCommandLine::Set(*OriginalCommandLine); };
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false);
    if (!TestNotNull(TEXT("Crew test world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecCharacter* Walker = World->SpawnActor<AQuebecCharacter>();
    if (!TestNotNull(TEXT("Crew character"), Walker)) return false;
    World->InitializeActorsForPlay(FURL());
    Walker->ProcessEvent(Walker->FindFunctionChecked(TEXT("ApplyCrewAppearance")), nullptr);
    USkeletalMeshComponent* Mesh = Walker->GetMesh();
    UQuebecCrewAnimInstance* InitialAnimation = Cast<UQuebecCrewAnimInstance>(Mesh->GetAnimInstance());
    if (!TestNotNull(TEXT("Initial saved production animation graph"), InitialAnimation)) return false;
    UBlendSpace* SavedSpace = InitialAnimation->LocomotionAsset;
    if (!TestNotNull(TEXT("Initial selected crew's saved locomotion asset"), SavedSpace)) return false;
    TestEqual(TEXT("Initial graph uses the selected crew's saved asset"), SavedSpace->GetPathName(),
        FString(TEXT("/Game/ParkComic/Crew/Resident9/BS_Locomotion.BS_Locomotion")));
    USkeletalMesh* Body = Mesh->GetSkeletalMeshAsset();
    TestTrue(TEXT("Fixture wears the real selected crew body"), Body && Body->GetPathName().Contains(TEXT("/ParkComic/Crew/Resident9/SK_Body")));
    Walker->ProcessEvent(Walker->FindFunctionChecked(TEXT("ApplyCrewAppearance")), nullptr);
    TestEqual(TEXT("Reapplying retains the selected body"), Mesh->GetSkeletalMeshAsset(), Body);
    UQuebecCrewAnimInstance* Animation = Cast<UQuebecCrewAnimInstance>(Mesh->GetAnimInstance());
    if (!TestNotNull(TEXT("Reapplying retains the live native blended graph"), Animation)) return false;
    TestEqual(TEXT("Reapplying keeps the same saved locomotion asset"), Animation->LocomotionAsset.Get(), SavedSpace);
    UAnimSequence* Idle = LoadObject<UAnimSequence>(nullptr, TEXT("/Game/ParkComic/Crew/Resident9/A_Idle.A_Idle"));
    UAnimSequence* Walk = LoadObject<UAnimSequence>(nullptr, TEXT("/Game/ParkComic/Crew/Resident9/A_Walk.A_Walk"));
    if (!TestNotNull(TEXT("Selected crew's idle clip"), Idle) || !TestNotNull(TEXT("Selected crew's walk clip"), Walk)) return false;
    if (!TestEqual(TEXT("Reapplied saved graph retains three own samples"), SavedSpace->GetBlendSamples().Num(), 3)) return false;
    TestTrue(TEXT("Reapplied graph retains the selected own idle and walk"),
        SavedSpace->GetBlendSample(0).Animation == Idle && SavedSpace->GetBlendSample(1).Animation == Walk);
    Animation->bUseMultiThreadedAnimationUpdate = false;
    Mesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
    Mesh->bEnableUpdateRateOptimizations = false;
    UCharacterMovementComponent* Movement = Walker->GetCharacterMovement();
    Movement->SetMovementMode(MOVE_Walking);
    const auto Advance = [Mesh, Movement](int32 Frames, float Speed)
    {
        Movement->Velocity = FVector(Speed, 0.f, 0.f);
        for (int32 Frame = 0; Frame < Frames; ++Frame)
        {
            Mesh->TickAnimation(1.f / 60.f, false);
            Mesh->RefreshBoneTransforms();
        }
    };
    Advance(30, 0.f);
    TestTrue(TEXT("Reapplied crew evaluates its actual idle pose"), Animation->ObservedClip == Idle && Animation->ObservedIdleWeight > .99f);
    Advance(30, 450.f);
    TestTrue(TEXT("Reapplied crew reaches its own walking graph sample"), Animation->ObservedClip == Walk && Animation->ObservedWalkWeight > .99f);
    const float First = Animation->ObservedClipTime;
    const FVector Foot = Mesh->GetSocketTransform(TEXT("LeftFoot"), RTS_Component).GetTranslation();
    Advance(1, 450.f);
    const float Expected = FMath::Fmod(First + SavedSpace->GetBlendSample(1).RateScale * Walk->RateScale / 60.f, Walk->GetPlayLength());
    TestTrue(TEXT("Reapplied grounded graph advances by its own authored cadence each frame"), FMath::IsNearlyEqual(Animation->ObservedClipTime, Expected, .002f));
    TestTrue(TEXT("Reapplied grounded graph evaluates a new actual foot pose each frame"),
        !Mesh->GetSocketTransform(TEXT("LeftFoot"), RTS_Component).GetTranslation().Equals(Foot, .0001));
    TestTrue(TEXT("Reapplied character keeps the native blended instance during playback"), Mesh->GetAnimInstance() == Animation);
    return !HasAnyErrors();
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecHUDRadarClipTest, "Quebec.HUD.RadarClip", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecHUDRadarClipTest::RunTest(const FString& Parameters)
{
    const FVector2D Center(80., 80.);
    constexpr float Radius = 70.f;
    const auto Check = [this, Center, Radius](const TCHAR* Label, FVector2D A, FVector2D B, bool bVisible, FVector2D ExpectedA, FVector2D ExpectedB)
    {
        const bool bActual = ClipHUDRadarSegment(A, B, Center, Radius);
        TestEqual(Label, bActual, bVisible);
        if (bActual)
        {
            TestTrue(TEXT("Clipped start retains the real circle intersection"), A.Equals(ExpectedA, .001));
            TestTrue(TEXT("Clipped end retains the real circle intersection"), B.Equals(ExpectedB, .001));
        }
    };
    Check(TEXT("Interior unchanged"), {60., 70.}, {100., 90.}, true, {60., 70.}, {100., 90.});
    Check(TEXT("Crossing both edges"), {-20., 80.}, {180., 80.}, true, {10., 80.}, {150., 80.});
    Check(TEXT("Reverse crossing"), {180., 80.}, {-20., 80.}, true, {150., 80.}, {10., 80.});
    Check(TEXT("Ray to outside"), {80., 80.}, {80., 200.}, true, {80., 80.}, {80., 150.});
    Check(TEXT("Outside does not invent a rim road"), {0., 0.}, {160., 0.}, false, {}, {});
    Check(TEXT("Outside short segment rejected"), {0., 80.}, {5., 80.}, false, {}, {});
    Check(TEXT("Tangent touches one point"), {0., 10.}, {160., 10.}, true, {80., 10.}, {80., 10.});
    Check(TEXT("Interior point retained"), {80., 80.}, {80., 80.}, true, {80., 80.}, {80., 80.});
    Check(TEXT("Exterior point rejected"), {0., 0.}, {0., 0.}, false, {}, {});
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecResidentRouteTest, "Quebec.Residents.RouteContinuity", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecResidentRouteTest::RunTest(const FString& Parameters)
{
    constexpr float Length = 1800.f, Pace = 210.f, Pause = 6.2f;
    const float Duration = Length/Pace+.45f;
    TestTrue(TEXT("Pause holds the far endpoint"),FMath::IsNearlyEqual(SampleResidentTravel(Duration+Pause*.5f,Length,Pace,Pause).Distance,Length,.01f));
    TestFalse(TEXT("Endpoint pause uses idle"),SampleResidentTravel(Duration+Pause*.5f,Length,Pace,Pause).bMoving);
    TestTrue(TEXT("Return starts at the same endpoint"),FMath::IsNearlyEqual(SampleResidentTravel(Duration+Pause,Length,Pace,Pause).Distance,Length,.01f));
    for (float Seam : {0.f,Duration,Duration+Pause,2.f*Duration+Pause,2.f*(Duration+Pause)})
    {
        const float Before = SampleResidentTravel(FMath::Max(0.f,Seam-.001f),Length,Pace,Pause).Distance;
        const float After = SampleResidentTravel(Seam+.001f,Length,Pace,Pause).Distance;
        TestTrue(TEXT("Root is continuous through endpoint/phase boundaries"),FMath::Abs(Before-After) < .5f);
    }
    FVector Direction;
    const TArray<FVector> Corner = {FVector(0.,0.,7.),FVector(300.,0.,7.),FVector(300.,400.,7.)};
    TestTrue(TEXT("Curved route uses accumulated segment length"),ResidentPointOnRoute(Corner,500.f,Direction).Equals(FVector(300.,200.,7.),.01f));
    TestTrue(TEXT("Curved route follows the current segment"),Direction.Equals(FVector::RightVector,.01f));
    const TArray<FVector> Trimmed = TrimResidentRoute(Corner,100.f,100.f);
    TestEqual(TEXT("Trim keeps surveyed interior bends"),Trimmed.Num(),3);
    TestTrue(TEXT("Trim starts on the first mapped segment"),Trimmed[0].Equals(FVector(100.,0.,7.),.01f));
    TestTrue(TEXT("Trim preserves the original corner"),Trimmed[1].Equals(Corner[1],.01f));
    TestTrue(TEXT("Trim ends on the final mapped segment"),Trimmed.Last().Equals(FVector(300.,300.,7.),.01f));
    const TArray<FVector> Straight = {FVector::ZeroVector,FVector(1800.,0.,0.)};
    TArray<FVector> Starts, Ends;
    for (int32 I = 0; I < 6; ++I)
    {
        const TArray<FVector> Route = TrimResidentRoute(Straight,I*120.f,(5-I)*120.f);
        const FVector Offset(0.,I%2 ? -55. : 55.,0.);
        for (int32 J = 0; J < Starts.Num(); ++J)
        {
            TestTrue(TEXT("Hub start capsules do not overlap"),FVector::Dist2D(Route[0]+Offset,Starts[J]) >= 70.f);
            TestTrue(TEXT("Hub end capsules do not overlap"),FVector::Dist2D(Route.Last()+Offset,Ends[J]) >= 70.f);
        }
        Starts.Add(Route[0]+Offset); Ends.Add(Route.Last()+Offset);
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTrafficBlockedApproachTest, "Quebec.Traffic.BlockedApproach", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTrafficBlockedApproachTest::RunTest(const FString& Parameters)
{
    // Exercise actual authority vehicle ticks and collision in an isolated world;
    // the reservation fields remain private and no saved map is modified.
    const TArray<bool>& Roads = ClosedTrafficRoads();
    const TArray<TArray<int32>>& Links = TrafficRoadLinks();
    int32 ApproachA = INDEX_NONE, ApproachB = INDEX_NONE;
    bool bForwardA = false, bForwardB = false;
    FVector Junction, DirectionA, DirectionB;
    for (int32 I = 0; I < Roads.Num() && ApproachA == INDEX_NONE; ++I)
        if (Roads[I])
            for (int32 Side = 0; Side < 2 && ApproachA == INDEX_NONE; ++Side)
            {
                const FVector End = LaFontaine::RoadSegments[I][Side];
                const FVector InA = End-LaFontaine::RoadSegments[I][1-Side];
                int32 Onward = 0;
                for (int32 Next : Links[I*2+Side]) Onward += Roads[Next] ? 1 : 0;
                if (InA.Size2D() < 2500.f || Onward < 2) continue;
                for (int32 J : Links[I*2+Side])
                {
                    if (!Roads[J]) continue;
                    const int32 OtherSide = FVector::DistSquared2D(End,LaFontaine::RoadSegments[J][0]) <= FMath::Square(40.f) ? 0 : 1;
                    const FVector InB = End-LaFontaine::RoadSegments[J][1-OtherSide];
                    if (InB.Size2D() < 2500.f || FMath::Abs(FVector::DotProduct(InA.GetSafeNormal2D(),InB.GetSafeNormal2D())) > .15f) continue;
                    ApproachA = I; ApproachB = J; bForwardA = Side == 1; bForwardB = OtherSide == 1;
                    Junction = End; DirectionA = InA.GetSafeNormal2D(); DirectionB = InB.GetSafeNormal2D();
                    break;
                }
            }
    if (!TestTrue(TEXT("Surveyed grid has perpendicular approaches to a junction"),ApproachA != INDEX_NONE)) return false;
    UWorld* World = UWorld::CreateWorld(EWorldType::Game,false);
    if (!TestNotNull(TEXT("Isolated collision world"),World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    const auto Start = [&Junction](const FVector& Direction)
    {
        return Junction-Direction*1250.f+FVector::CrossProduct(FVector::UpVector,Direction)*145.f+FVector(0.,0.,102.);
    };
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecCar* Blocked = World->SpawnActor<AQuebecCar>(Start(DirectionA),DirectionA.Rotation(),Spawn);
    AQuebecCar* Crossing = World->SpawnActor<AQuebecCar>(Start(DirectionB),DirectionB.Rotation(),Spawn);
    AQuebecCharacter* Obstacle = World->SpawnActor<AQuebecCharacter>(Start(DirectionA)+DirectionA*450.f,FRotator::ZeroRotator,Spawn);
    if (!TestNotNull(TEXT("Blocked approach car"),Blocked) || !TestNotNull(TEXT("Crossing car"),Crossing) ||
        !TestNotNull(TEXT("Player obstacle"),Obstacle)) return false;
    // A plain static floor keeps gravity active without importing the full city.
    AActor* Floor = World->SpawnActor<AActor>();
    UBoxComponent* FloorBox = NewObject<UBoxComponent>(Floor);
    Floor->SetRootComponent(FloorBox);
    FloorBox->SetBoxExtent(FVector(200000.,200000.,20.));
    FloorBox->SetCollisionProfileName(TEXT("BlockAll"));
    FloorBox->RegisterComponent();
    Floor->SetActorLocation(FVector(0.,0.,-20.));
    Blocked->SetTrafficRoute(ApproachA,bForwardA,Roads);
    Crossing->SetTrafficRoute(ApproachB,bForwardB,Roads);
    const FVector BlockedStart = Blocked->GetActorLocation(), CrossingStart = Crossing->GetActorLocation();
    Blocked->Tick(.05f);
    Crossing->Tick(.05f);
    TestTrue(TEXT("Player stops the car outside the occupied junction"),Blocked->bHandbrake && FVector::Dist2D(Blocked->GetActorLocation(),Junction) > 800.f);
    TestFalse(TEXT("A blocked approach does not stop clear cross traffic"),Crossing->bHandbrake);
    for (int32 Frame = 0; Frame < 80 && FVector::Dist2D(Crossing->GetActorLocation(),Junction) > 700.f; ++Frame)
    {
        Blocked->Tick(.05f);
        Crossing->Tick(.05f);
    }
    TestTrue(TEXT("Blocked car stays behind the player"),FVector::Dist2D(Blocked->GetActorLocation(),BlockedStart) < 5.f);
    TestTrue(TEXT("Cross traffic visibly advances into the junction"),FVector::Dist2D(Crossing->GetActorLocation(),Junction) < 800.f &&
        FVector::Dist2D(Crossing->GetActorLocation(),CrossingStart) > 450.f);
    // Move the same player into the crossing car's path, then free the original
    // approach. A car already occupying the junction must retain its reservation.
    Obstacle->SetActorLocation(Crossing->GetActorLocation()+Crossing->GetActorForwardVector()*450.f);
    Crossing->Tick(.05f);
    Blocked->Tick(.05f);
    TestTrue(TEXT("Player stops a car already inside the junction"),Crossing->bHandbrake);
    TestTrue(TEXT("Occupied junction retains priority while its owner is stopped"),Blocked->bHandbrake);
    // A cleared holder must release priority even when its own actor ticks later.
    Obstacle->SetActorLocation(FVector(100000.,100000.,102.));
    Crossing->SetActorLocation(Junction+DirectionB*1600.f);
    Blocked->Tick(.05f);
    TestFalse(TEXT("A cleared reservation cannot starve an earlier-ticking car"),Blocked->bHandbrake);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecTrafficCircuitTest, "Quebec.Traffic.ClosedRoadGraph", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecTrafficCircuitTest::RunTest(const FString& Parameters)
{
    const TArray<bool>& Roads = ClosedTrafficRoads();
    int32 Active = 0, DeadEnds = 0;
    for (int32 I = 0; I < Roads.Num(); ++I)
        if (Roads[I])
        {
            ++Active;
            for (int32 Side = 0; Side < 2; ++Side)
            {
                bool bOnward = false;
                for (int32 J = 0; J < Roads.Num(); ++J)
                    if (I != J && Roads[J])
                        for (int32 End = 0; End < 2; ++End)
                            bOnward |= FVector::DistSquared2D(LaFontaine::RoadSegments[I][Side],LaFontaine::RoadSegments[J][End]) <= FMath::Square(40.f);
                if (!bOnward) ++DeadEnds;
            }
        }
    TestTrue(TEXT("Surveyed grid provides enough circulating streets"), Active >= 100);
    TestEqual(TEXT("Every traffic endpoint has an onward road"), DeadEnds, 0);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCameraBoundsTest, "Quebec.Camera.LookBounds", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecCameraBoundsTest::RunTest(const FString& Parameters)
{
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false);
    if (!TestNotNull(TEXT("Camera test world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    World->InitializeActorsForPlay(FURL());
    AQuebecController* Controller = World->SpawnActor<AQuebecController>();
    AQuebecCharacter* Walker = World->SpawnActor<AQuebecCharacter>();
    AQuebecCar* Car = World->SpawnActor<AQuebecCar>(FVector(5000.,5000.,102.),FRotator::ZeroRotator);
    if (!TestNotNull(TEXT("Controller"), Controller) || !TestNotNull(TEXT("Walker"), Walker) || !TestNotNull(TEXT("Car"), Car)) return false;
    Controller->SetAsLocalPlayerController();
    Controller->DispatchBeginPlay();
    if (!TestNotNull(TEXT("Camera manager"), Controller->PlayerCameraManager.Get())) return false;
    TestEqual(TEXT("Normal upward limit"), Controller->PlayerCameraManager->ViewPitchMax, -5.f);
    TestEqual(TEXT("Normal downward limit"), Controller->PlayerCameraManager->ViewPitchMin, -25.f);
    for (APawn* Pawn : {static_cast<APawn*>(Walker), static_cast<APawn*>(Car)})
    {
        Controller->Possess(Pawn);
        USpringArmComponent* Arm = Pawn->FindComponentByClass<USpringArmComponent>();
        UCameraComponent* Camera = Pawn->FindComponentByClass<UCameraComponent>();
        Arm->bDoCollisionTest = false;
        for (float Pitch : {-89.f, -25.f, -6.f, -5.f, 0.f, 30.f, 89.f, 270.f})
        {
            FRotator View(Pitch, 25.f, 0.f), Delta = FRotator::ZeroRotator;
            Controller->PlayerCameraManager->ProcessViewRotation(.016f, View, Delta);
            TestTrue(TEXT("Normal input clamps immediately without hidden overtravel"), FRotator::NormalizeAxis(View.Pitch) >= -25.01f && FRotator::NormalizeAxis(View.Pitch) <= -4.99f);
            Controller->SetControlRotation(FRotator(Pitch, 25.f, 0.f));
            Pawn->Tick(.016f);
            Arm->TickComponent(.016f, LEVELTICK_All, nullptr);
            const float CameraPitch = FRotator::NormalizeAxis(Camera->GetComponentRotation().Pitch);
            TestTrue(TEXT("Camera orbit stays between -25 and -5 degrees"), CameraPitch >= -25.01f && CameraPitch <= -4.99f);
            TestEqual(TEXT("Orbit target stays on the character"), Arm->TargetOffset.Z, 0.);
            // Project the capsule endpoints through the real camera in wide and tall frames.
            for (float Aspect : {16.f / 9.f, 9.f / 20.f})
                for (float Height : {-96.f, 96.f})
                {
                    const FVector Point = Camera->GetComponentRotation().UnrotateVector(
                        Pawn->GetActorLocation() + FVector(0., 0., Height) - Camera->GetComponentLocation());
                    const double TanHalfVerticalFov = FMath::Tan(FMath::DegreesToRadians(Camera->FieldOfView * .5f)) / (16.f / 9.f);
                    TestTrue(TEXT("Character head/feet stay inside wide and tall framing"), Point.X > 0. &&
                        FMath::Abs(Point.Z / (Point.X * TanHalfVerticalFov)) < .95 &&
                        FMath::Abs(Point.Y / (Point.X * TanHalfVerticalFov * Aspect)) < .95);
                }
        }
        Arm->bDoCollisionTest = true;
        FActorSpawnParameters Spawn;
        AActor* Wall = World->SpawnActor<AActor>(Spawn);
        UBoxComponent* Block = NewObject<UBoxComponent>(Wall);
        Wall->SetRootComponent(Block);
        Block->SetBoxExtent(FVector(1000., 1000., 1000.));
        Block->SetCollisionResponseToAllChannels(ECR_Block);
        Block->RegisterComponent();
        Controller->SetControlRotation(FRotator(30.f, 25.f, 0.f));
        Pawn->Tick(.016f);
        Arm->TickComponent(.016f, LEVELTICK_All, nullptr);
        TestTrue(TEXT("Collision retraction cannot turn the camera upward"), Camera->GetComponentRotation().Pitch <= -4.99f);
        Wall->Destroy();
        Arm->bDoCollisionTest = false;
        Controller->SetControlRotation(FRotator(-6.f, 25.f, 0.f));
        Pawn->Tick(.016f);
        Pawn->SetActorRotation(FRotator(0.f, 120.f, 0.f));
        Arm->TickComponent(.016f, LEVELTICK_All, nullptr);
        TestTrue(TEXT("Movement turning cannot kick the camera after its update"),
            FMath::Abs(FRotator::NormalizeAxis(Camera->GetComponentRotation().Yaw - 25.f)) < .01f);
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecBrowserInputReleaseTest, "Quebec.Browser.InputRelease", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecBrowserInputReleaseTest::RunTest(const FString& Parameters)
{
    // Feed actual engine key events/bindings and the plugin's native close
    // delegates in an isolated world. No browser, saved map or save slot is used.
    UWorld* World = UWorld::CreateWorld(EWorldType::Game,false);
    if (!TestNotNull(TEXT("Isolated browser-input world"),World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    // Actor::ProcessEvent drops reflected RPC calls before this initialization.
    // BeginPlay is intentionally omitted so this fixture never loads/saves progress.
    World->InitializeActorsForPlay(FURL());
    if (!TestTrue(TEXT("Fixture supports the real RPC call path"),World->AreActorsInitialized())) return false;
    FActorSpawnParameters Spawn;
    Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AQuebecController* Controller = World->SpawnActor<AQuebecController>();
    AQuebecController* Other = World->SpawnActor<AQuebecController>();
    AQuebecCampaign* Campaign = World->SpawnActor<AQuebecCampaign>();
    if (!TestNotNull(TEXT("Local controller"),Controller) || !TestNotNull(TEXT("Other controller"),Other) ||
        !TestNotNull(TEXT("Campaign"),Campaign)) return false;
    Controller->Player = NewObject<ULocalPlayer>(GEngine);
    Controller->PlayerInput = NewObject<UPlayerInput>(Controller,UInputSettings::GetDefaultPlayerInputClass());
    Controller->PlayerState = World->SpawnActor<APlayerState>();
    Other->PlayerState = World->SpawnActor<APlayerState>();
    AQuebecCharacter* Walker = World->SpawnActor<AQuebecCharacter>(Campaign->WorklightLocation+FVector(0.,-175.,10.),FRotator::ZeroRotator,Spawn);
    AQuebecCar* Car = World->SpawnActor<AQuebecCar>(FVector(5000.,5000.,102.),FRotator::ZeroRotator,Spawn);
    if (!TestNotNull(TEXT("Walker"),Walker) || !TestNotNull(TEXT("Car"),Car)) return false;
    Controller->Possess(Walker);
    Controller->BindBrowserInputRelease();
    Controller->BrowserStreamerId = TEXT("QuebecBrowserInputReleaseTest");
    ON_SCOPE_EXIT { Controller->UnbindBrowserInputRelease(); };
    UPixelStreaming2Delegates* Delegates = UPixelStreaming2Delegates::Get();
    if (!TestNotNull(TEXT("Native streaming delegates"),Delegates)) return false;
    UInputComponent* WalkerInput = NewObject<UInputComponent>(Walker,UInputSettings::GetDefaultInputComponentClass());
    Walker->SetupPlayerInputComponent(WalkerInput);
    const TArray<UInputComponent*> WalkerStack = {WalkerInput};
    const auto Press = [Controller](FKey Key)
    {
        Controller->PlayerInput->InputKey(FInputKeyEventArgs::CreateSimulated(Key,IE_Pressed,1.f,1));
    };
    Press(EKeys::W); Press(EKeys::LeftShift); Press(EKeys::SpaceBar);
    Controller->PlayerInput->ProcessInputStack(WalkerStack,.016f,false);
    TestTrue(TEXT("Native W key is held"),Controller->PlayerInput->IsPressed(EKeys::W));
    TestEqual(TEXT("Native sprint binding is active"),Walker->GetCharacterMovement()->MaxWalkSpeed,static_cast<float>(QuebecPace::SprintCmPerSecond));
    TestTrue(TEXT("Native movement creates pending input"),!Walker->GetPendingMovementInputVector().IsNearlyZero());
    if (!TestTrue(TEXT("Controller acquires actual worklight"),Campaign->HandleInteract(Controller))) return false;
    TestTrue(TEXT("Worklight belongs to departing controller"),Campaign->IsAimingLight(Controller));
    Other->ServerReleaseBrowserInput_Implementation();
    TestTrue(TEXT("Other controller cannot release this worklight"),Campaign->IsAimingLight(Controller));
    Delegates->OnAllConnectionsClosedNative.Broadcast(TEXT("UnrelatedStreamer"));
    TestTrue(TEXT("Other streamer cannot flush local keys"),Controller->PlayerInput->IsPressed(EKeys::W));
    TestTrue(TEXT("Other streamer cannot release worklight"),Campaign->IsAimingLight(Controller));
    const FVector WalkerLocation = Walker->GetActorLocation();
    const EQuebecCampaignPhase Phase = Campaign->Phase;
    const int32 Completed = Campaign->CompletedMissions;
    Delegates->OnDataTrackClosedNative.Broadcast(Controller->BrowserStreamerId,TEXT("BrowserPeer"));
    TestFalse(TEXT("Data loss flushes W"),Controller->PlayerInput->IsPressed(EKeys::W));
    TestFalse(TEXT("Data loss flushes sprint"),Controller->PlayerInput->IsPressed(EKeys::LeftShift));
    TestFalse(TEXT("Data loss flushes jump"),Controller->PlayerInput->IsPressed(EKeys::SpaceBar));
    TestTrue(TEXT("Data loss clears pending movement"),Walker->GetPendingMovementInputVector().IsNearlyZero());
    TestEqual(TEXT("Sprint returns to walking speed"),Walker->GetCharacterMovement()->MaxWalkSpeed,static_cast<float>(QuebecPace::WalkCmPerSecond));
    TestNull(TEXT("Only departing operator is released"),Campaign->LightOperator.Get());
    TestTrue(TEXT("Campaign phase is preserved"),Campaign->Phase==Phase);
    TestEqual(TEXT("Completed missions are preserved"),Campaign->CompletedMissions,Completed);
    TestTrue(TEXT("Walker remains possessed for reconnect"),Controller->GetPawn()==Walker && Walker->GetActorLocation().Equals(WalkerLocation));
    Controller->PlayerInput->ProcessInputStack(WalkerStack,.016f,false);
    Walker->SetInVehicle(true);
    Car->Occupant = Walker;
    Controller->Possess(Car);
    UInputComponent* CarInput = NewObject<UInputComponent>(Car,UInputSettings::GetDefaultInputComponentClass());
    Car->SetupPlayerInputComponent(CarInput);
    const TArray<UInputComponent*> CarStack = {CarInput};
    Press(EKeys::W); Press(EKeys::D); Press(EKeys::SpaceBar);
    Controller->PlayerInput->ProcessInputStack(CarStack,.016f,false);
    TestTrue(TEXT("Native drive bindings hold throttle, steering and brake"),Car->Throttle==1.f && Car->Steering==1.f && Car->bHandbrake);
    Delegates->OnAllConnectionsClosedNative.Broadcast(Controller->BrowserStreamerId);
    TestTrue(TEXT("Last viewer loss releases car controls"),Car->Throttle==0.f && Car->Steering==0.f && Car->DriveThrottle==0.f && !Car->bHandbrake);
    TestTrue(TEXT("Car, occupant and possession survive browser loss"),IsValid(Car) && Car->Occupant==Walker && Controller->GetPawn()==Car);
    Controller->PlayerInput->ProcessInputStack(CarStack,.016f,false);
    Press(EKeys::W);
    Controller->PlayerInput->ProcessInputStack(CarStack,.016f,false);
    TestEqual(TEXT("New browser input works on the retained pawn"),Car->Throttle,1.f);
    Delegates->OnDisconnectedFromSignallingServerNative.Broadcast(Controller->BrowserStreamerId);
    TestEqual(TEXT("Signalling loss also releases throttle"),Car->Throttle,0.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecMissionProximityTest, "Quebec.Missions.Proximity", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecMissionProximityTest::RunTest(const FString& Parameters)
{
    const FVector Target = AQuebecGameState::MissionLocations[0];
    TestTrue(TEXT("At current objective"), AQuebecGameState::CanAdvanceMission(0, Target));
    TestTrue(TEXT("At the interaction boundary"), AQuebecGameState::CanAdvanceMission(0, Target + FVector(500., 0., 0.)));
    TestFalse(TEXT("Outside interaction range"), AQuebecGameState::CanAdvanceMission(0, Target + FVector(501., 0., 0.)));
    TestFalse(TEXT("Cannot skip ahead"), AQuebecGameState::CanAdvanceMission(0, AQuebecGameState::MissionLocations[1]));
    TestFalse(TEXT("Reject invalid objective"), AQuebecGameState::CanAdvanceMission(-1, Target));
    TestFalse(TEXT("Completed campaign stays complete"), AQuebecGameState::CanAdvanceMission(AQuebecGameState::MissionCount, Target));
    return true;
}
#endif
