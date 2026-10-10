#include "QuebecGameplay.h"
#include "LaFontaineMap.h"

#include "Animation/AnimInstance.h"
#include "Animation/AnimSequence.h"
#include "Camera/CameraComponent.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/ScopedMovementUpdate.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Net/UnrealNetwork.h"
#include "UnrealClient.h"
#include "UObject/ConstructorHelpers.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"
#endif

namespace
{
    const FVector MansionSpawn = LaFontaine::Spawn;
    constexpr float MissionRadius = 500.f;
    constexpr float CarEnterRadius = 450.f;
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
    GetCharacterMovement()->MaxWalkSpeed = 450.f;
    GetCharacterMovement()->JumpZVelocity = 600.f;
    GetCharacterMovement()->AirControl = 0.35f;

    CameraArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraArm"));
    CameraArm->SetupAttachment(RootComponent);
    CameraArm->TargetArmLength = 420.f;
    CameraArm->SocketOffset = FVector(0., 50., 70.);
    CameraArm->bUsePawnControlRotation = true;
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
}

void AQuebecCharacter::BeginPlay()
{
    Super::BeginPlay();
    ApplyCrewAppearance();
}

void AQuebecCharacter::CycleCrew()
{
    if (!HasAuthority()) return;
    CrewStyle = CrewStyle >= 10 ? 3 : FMath::Clamp(CrewStyle + 1, 3, 10);
    ApplyCrewAppearance();
    ForceNetUpdate();
}

void AQuebecCharacter::ApplyCrewAppearance()
{
    if (CrewStyle < 3 || CrewStyle > 10) return;
    const FString Folder = FString::Printf(TEXT("/Game/ParkComic/Crew/Resident%d/"), CrewStyle);
    USkeletalMesh* Body = LoadObject<USkeletalMesh>(nullptr, *(Folder + TEXT("SK_Body.SK_Body")));
    if (!Body) return;
    GetMesh()->SetAnimInstanceClass(nullptr);
    GetMesh()->SetSkeletalMesh(Body);
    GetMesh()->SetRelativeRotation(FRotator::ZeroRotator);
    GetMesh()->SetAnimationMode(EAnimationMode::AnimationSingleNode);
    GetMesh()->SetRenderCustomDepth(true);
    GetMesh()->SetCustomDepthStencilValue(255);
    CrewWalk = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Walk.A_Walk")));
    CrewIdle = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Idle.A_Idle")));
    CrewRun = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Run.A_Run")));
    CrewJump = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Jump.A_Jump")));
    CrewAnimation = nullptr;
    CrewProp->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, CrewStyle == 8
        ? TEXT("/Game/ParkComic/Crew/SM_PVCTube.SM_PVCTube") : TEXT("/Game/ParkComic/Crew/SM_Plunger.SM_Plunger")));
}

void AQuebecCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveForward"), this, &AQuebecCharacter::MoveForward);
    Input->BindAxis(TEXT("MoveRight"), this, &AQuebecCharacter::MoveRight);
    Input->BindAxis(TEXT("Turn"), this, &APawn::AddControllerYawInput);
    Input->BindAxis(TEXT("LookUp"), this, &APawn::AddControllerPitchInput);
    Input->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
    Input->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
    Input->BindAction(TEXT("Sprint"), IE_Pressed, this, &AQuebecCharacter::StartSprint);
    Input->BindAction(TEXT("Sprint"), IE_Released, this, &AQuebecCharacter::StopSprint);
}

void AQuebecCharacter::MoveForward(float Value)
{
    if (Controller && Value != 0.f && !bInVehicle)
        AddMovementInput(FRotationMatrix(FRotator(0., Controller->GetControlRotation().Yaw, 0.)).GetUnitAxis(EAxis::X), Value);
}

void AQuebecCharacter::MoveRight(float Value)
{
    if (Controller && Value != 0.f && !bInVehicle)
        AddMovementInput(FRotationMatrix(FRotator(0., Controller->GetControlRotation().Yaw, 0.)).GetUnitAxis(EAxis::Y), Value);
}

void AQuebecCharacter::StartSprint()
{
    GetCharacterMovement()->MaxWalkSpeed = 800.f;
    ServerSetSprint(true);
}
void AQuebecCharacter::StopSprint()
{
    GetCharacterMovement()->MaxWalkSpeed = 450.f;
    ServerSetSprint(false);
}
void AQuebecCharacter::ServerSetSprint_Implementation(bool bSprint)
{
    GetCharacterMovement()->MaxWalkSpeed = bSprint && !bInVehicle ? 800.f : 450.f;
}

void AQuebecCharacter::SetInVehicle(bool bNewInVehicle)
{
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
    GetCharacterMovement()->MaxWalkSpeed = 450.f;
}

void AQuebecCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!bInVehicle && CrewIdle)
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
    if (HasAuthority() && !bInVehicle && GetActorLocation().Z < -1500.)
    {
        GetCharacterMovement()->StopMovementImmediately();
        TeleportTo(MansionSpawn, FRotator::ZeroRotator);
    }
}

void AQuebecCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecCharacter, bInVehicle);
    DOREPLIFETIME(AQuebecCharacter, CrewStyle);
}

AQuebecParkInstances::AQuebecParkInstances()
{
    PrimaryActorTick.bCanEverTick = false;
    Instances = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("Instances"));
    Instances->SetMobility(EComponentMobility::Static);
    Instances->SetCollisionProfileName(TEXT("NoCollision"));
    RootComponent = Instances;
}

AQuebecParkResident::AQuebecParkResident()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 1.f / 24.f;
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
    GeneratedBody->SetComponentTickEnabled(false);
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
}

void AQuebecParkResident::UpdateRouteLength()
{
    RouteLength = 0.f;
    for (int32 I = 1; I < Route.Num(); ++I) RouteLength += FVector::Distance(Route[I-1],Route[I]);
}

void AQuebecParkResident::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const AGameStateBase* State = GetWorld()->GetGameState();
    const float Time = (State ? State->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds()) + Phase;
    bool bWalking = false;
    if (Route.Num() > 1 && RouteLength > 1.f)
    {
        const float Duration = RouteLength / 85.f;
        const float Cycle = FMath::Fmod(Time, 2.f * (Duration + 4.f));
        const bool bReturn = Cycle > Duration + 4.f;
        const float LegTime = bReturn ? Cycle - Duration - 4.f : Cycle;
        bWalking = LegTime < Duration;
        float Distance = FMath::Clamp(LegTime * 85.f, 0.f, RouteLength);
        if (bReturn) Distance = RouteLength - Distance;
        if (HasAuthority())
        {
            for (int32 I = 1; I < Route.Num(); ++I)
            {
                const float Length = FVector::Distance(Route[I-1],Route[I]);
                if (Distance <= Length || I == Route.Num()-1)
                {
                    const FVector Direction = Route[I]-Route[I-1];
                    SetActorLocation(FMath::Lerp(Route[I-1],Route[I],FMath::Clamp(Distance/FMath::Max(Length,1.f),0.f,1.f)));
                    SetActorRotation((bReturn ? -Direction : Direction).Rotation());
                    break;
                }
                Distance -= Length;
            }
        }
    }
    APlayerController* Player = GetWorld()->GetFirstPlayerController();
    const bool bLocalView = Player && Player->IsLocalController() && Player->PlayerCameraManager;
    const FVector Eye = bLocalView ? Player->PlayerCameraManager->GetCameraLocation() : FVector::ZeroVector;
    Label->SetVisibility(bLocalView && FVector::DistSquared(Eye,GetActorLocation()) < FMath::Square(1800.f));
    if (!bLocalView || FVector::DistSquared(Eye,GetActorLocation()) > FMath::Square(14000.f)) return;
    const float Pose = FMath::FloorToFloat(Time * 12.f) / 12.f;
    if (GeneratedBody->GetSkeletalMeshAsset())
    {
        UAnimSequence* Animation = bWalking ? WalkAnimation : IdleAnimation;
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
    const float Swing = FMath::Sin(Pose * 6.f) * (bWalking ? 24.f : 5.f);
    Pieces[0]->SetRelativeLocation(FVector(0.,0.,bWalking ? FMath::Abs(FMath::Sin(Pose*6.f))*3.f : 0.f));
    Pieces[1]->SetRelativeRotation(FRotator(FMath::Sin(Pose*2.f)*5.f,FMath::Sin(Pose*.8f)*12.f,0.));
    for (int32 I = 2; I < 6; ++I) Pieces[I]->SetRelativeRotation(FRotator(Swing * (I%2 ? 1.f : -1.f) * (I<4 ? -1.f : 1.f),0.,0.));
    Label->SetWorldRotation((Eye-Label->GetComponentLocation()).Rotation());
}

void AQuebecParkResident::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecParkResident, Style);
    DOREPLIFETIME(AQuebecParkResident, Route);
    DOREPLIFETIME(AQuebecParkResident, Phase);
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
    Collision->SetCollisionProfileName(TEXT("Pawn"));
    RootComponent = Collision;

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
    CameraArm->bUsePawnControlRotation = true;
    CameraArm->bEnableCameraLag = true;
    CameraArm->CameraLagSpeed = 7.f;
    CameraArm->CameraLagMaxDistance = 120.f;
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
    Camera->SetupAttachment(CameraArm, USpringArmComponent::SocketName);
    Camera->FieldOfView = 85.f;
}

void AQuebecCar::BeginPlay()
{
    Super::BeginPlay();
    SetActorTickInterval(bTraffic ? .05f : .1f);
    SetNetCullDistanceSquared(FMath::Square(24000.f));
    GetComponents(Parts);
    Parts.RemoveAll([](const UStaticMeshComponent* Part) { return Part->IsEditorOnly(); });
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
}

void AQuebecCar::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    bTraffic = false;
    TrafficSegment = INDEX_NONE;
    bJunctionReserved = bJunctionEntered = false;
    SetActorTickInterval(0.f);
    LastDriveInputTime = GetWorld()->GetTimeSeconds();
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

void AQuebecCar::MoveForward(float Value) { Throttle = Value; }
void AQuebecCar::MoveRight(float Value) { Steering = Value; }
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
void AQuebecCar::StopInput() { Throttle = Steering = 0.f; bHandbrake = false; }

void AQuebecCar::ApplyPaint()
{
    const FString Path = PaintStyle > 0
        ? FString::Printf(TEXT("/Game/ParkComic/M_CarPaint%d.M_CarPaint%d"), PaintStyle % 4, PaintStyle % 4)
        : TEXT("/Game/Materials/M_CarBody.M_CarBody");
    if (UMaterialInterface* Paint = LoadObject<UMaterialInterface>(nullptr, *Path))
        for (UStaticMeshComponent* Part : Parts)
            if (Part->GetName() == TEXT("Body")) Part->SetMaterial(0, Paint);
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
    Target = LaneStart+Direction*Along;
    const float Error = FMath::FindDeltaAngleDegrees(GetActorRotation().Yaw, (Target - GetActorLocation()).Rotation().Yaw);
    Steering = FMath::Clamp(Error / 35.f, -1.f, 1.f);
    float DesiredSpeed = bWaitForJunction ? 0.f : (FMath::Abs(Error) > 35.f ? 230.f : 650.f);
    FCollisionQueryParams Query(SCENE_QUERY_STAT(TrafficYield), false, this);
    FHitResult Ahead;
    for (int32 Attempt = 0; Attempt < 4; ++Attempt)
    {
        if (!GetWorld()->SweepSingleByChannel(Ahead, GetActorLocation(),
            GetActorLocation() + GetActorForwardVector() * (450.f + FMath::Abs(Speed) * .8f), GetActorQuat(), ECC_Pawn,
            FCollisionShape::MakeBox(FVector(220.,108.,70.)), Query)) break;
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
    const float DisplaySteering = IsLocallyControlled() ? Steering : VisualSteering;
    WheelAngle = FMath::Fmod(WheelAngle + FMath::RadiansToDegrees(Speed * DeltaSeconds / 36.f), 360.f);
    for (UStaticMeshComponent* Part : Parts)
    {
        if (Part->GetName().Contains(TEXT("Wheel")) && (FMath::Abs(Speed) > 1.f || FMath::Abs(DisplaySteering) > .01f))
            Part->SetRelativeRotation(FRotator(0., Part->GetName().StartsWith(TEXT("Front")) ? DisplaySteering * 28.f : 0., 0.).Quaternion() *
                FQuat(FVector::RightVector, FMath::DegreesToRadians(WheelAngle)) * FRotator(0., 0., 90.).Quaternion());
    }
    Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView, 85.f + FMath::Abs(Speed) / 2400.f * 9.f, DeltaSeconds, 3.f));
    if (IsLocallyControlled() && Controller && FMath::Abs(Speed) > 100.f && GetWorld()->GetTimeSeconds() - LastLookTime > 2.f)
        Controller->SetControlRotation(FMath::RInterpTo(Controller->GetControlRotation(), GetActorRotation() + FRotator(-12., 0., 0.), DeltaSeconds, 2.5f));
    if (IsLocallyControlled() && !HasAuthority()) ServerSetDrive(Throttle, Steering, bHandbrake);
    if (!HasAuthority()) return;
    const float Step = FMath::Min(DeltaSeconds, .05f);
    if (bTraffic && !Controller) UpdateTraffic();
    // A lost connection must not hold its last throttle until the network timeout.
    if (!bTraffic && (!Controller || (!IsLocallyControlled() && GetWorld()->GetTimeSeconds() - LastDriveInputTime > .5f))) StopInput();
    VisualSteering = Steering;
    if (bHandbrake) Speed = FMath::FInterpConstantTo(Speed, 0.f, Step, 3200.f);
    else
    {
        const float Acceleration = Throttle * Speed < 0.f ? 2400.f : 1250.f;
        Speed = FMath::Clamp(Speed + Throttle * Acceleration * Step, -850.f, 2400.f);
        if (FMath::IsNearlyZero(Throttle)) Speed = FMath::FInterpConstantTo(Speed, 0.f, Step, 800.f);
    }
    if (FMath::Abs(Speed) > 15.f)
    {
        const float Turn = Steering * (bTraffic ? 140.f : 70.f) * FMath::Clamp(Speed / (bTraffic ? 300.f : 750.f), -1.f, 1.f) * Step;
        // shortcut: the car uses an arcade box sweep, upgrade to Chaos Vehicles for suspension and tire physics.
        const FQuat Rotation = (GetActorRotation() + FRotator(0., Turn, 0.)).Quaternion();
        FCollisionQueryParams Query(SCENE_QUERY_STAT(CarSteering), false, this);
        if (!GetWorld()->OverlapBlockingTestByChannel(GetActorLocation(), Rotation, ECC_Pawn,
            FCollisionShape::MakeBox(Collision->GetScaledBoxExtent() - FVector(1.)), Query))
            SetActorRotation(Rotation);
    }
    FHitResult Hit;
    const FVector Travel = GetActorForwardVector() * Speed * Step;
    AddActorWorldOffset(Travel, true, &Hit);
    bool bSteppedUp = false;
    if (Hit.IsValidBlockingHit() && FMath::IsNearlyZero(VerticalSpeed) && !Travel.IsNearlyZero())
    {
        constexpr float CurbHeight = 30.f;
        const double StartZ = GetActorLocation().Z;
        FScopedMovementUpdate CurbMove(Collision);
        FHitResult CurbHit;
        AddActorWorldOffset(FVector(0., 0., CurbHeight), true, &CurbHit);
        if (!CurbHit.bBlockingHit)
        {
            AddActorWorldOffset(Travel * (1.f - Hit.Time), true, &CurbHit);
            if (!CurbHit.bBlockingHit)
            {
                AddActorWorldOffset(FVector(0., 0., -CurbHeight - 2.f), true, &CurbHit);
                bSteppedUp = CurbHit.IsValidBlockingHit() && CurbHit.ImpactNormal.Z >= .7f &&
                    GetActorLocation().Z - StartZ <= CurbHeight;
            }
        }
        if (!bSteppedUp) CurbMove.RevertMove();
    }
    if (Hit.bBlockingHit && !bSteppedUp) Speed *= .1f;
    VerticalSpeed -= 980.f * Step;
    AddActorWorldOffset(FVector(0., 0., VerticalSpeed * Step), true, &Hit);
    if (Hit.bBlockingHit) VerticalSpeed = 0.f;
    if (GetActorLocation().Z < -1500.)
    {
        SetActorLocation(LaFontaine::CarSpawn);
        Speed = VerticalSpeed = 0.f;
    }
}

void AQuebecCar::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecCar, Occupant);
    DOREPLIFETIME(AQuebecCar, Speed);
    DOREPLIFETIME_CONDITION(AQuebecCar, bHandbrake, COND_SkipOwner);
    DOREPLIFETIME(AQuebecCar, VisualSteering);
    DOREPLIFETIME(AQuebecCar, PaintStyle);
    DOREPLIFETIME(AQuebecCar, bTraffic);
}

bool AQuebecGameState::CanAdvanceMission(int32 Index, const FVector& Position)
{
    return Index >= 0 && Index < MissionCount && !Position.ContainsNaN() &&
        FVector::DistSquared(Position, MissionLocations[Index]) <= FMath::Square(MissionRadius);
}

bool AQuebecGameState::AdvanceMissionNear(const FVector& Position)
{
    if (!HasAuthority() || !CanAdvanceMission(MissionIndex, Position)) return false;
    ++MissionIndex;
    ForceNetUpdate();
    return true;
}

void AQuebecGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecGameState, MissionIndex);
}


void AQuebecController::SetupInputComponent()
{
    Super::SetupInputComponent();
    InputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &AQuebecController::Interact);
    InputComponent->BindAction(TEXT("ComicStyle"), IE_Pressed, this, &AQuebecController::ToggleComicStyle);
    InputComponent->BindAction(TEXT("NextCharacter"), IE_Pressed, this, &AQuebecController::NextCharacter);
}

void AQuebecController::NextCharacter() { ServerNextCharacter(); }
void AQuebecController::ServerNextCharacter_Implementation()
{
    AQuebecCharacter* Character = Cast<AQuebecCharacter>(GetPawn());
    if (!Character) Character = WalkingCharacter;
    if (Character) Character->CycleCrew();
}

void AQuebecController::ToggleComicStyle() { bComicStyle = !bComicStyle; }

void AQuebecController::PlayerTick(float DeltaTime)
{
    Super::PlayerTick(DeltaTime);
    if (!IsLocalController()) return;
    ApplyComicStyle();
    static const bool bCapture = FParse::Param(FCommandLine::Get(), TEXT("NordCapture"));
    if (bCapture) TickCapture(DeltaTime);
}

void AQuebecController::ApplyComicStyle()
{
    // The look is local: each player's view target cameras carry the blendable at weight 0 or 1.
    // Loaded lazily so the editor can regenerate the asset without a rooted reference.
    if (!ComicMaterial) ComicMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Art/Comic/M_ComicInk.M_ComicInk"));
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
    // Animation on twos: poses step at 12 per second while movement stays smooth.
    for (TActorIterator<AQuebecCharacter> It(GetWorld()); It; ++It)
        It->GetMesh()->SetComponentTickInterval(bComicStyle ? 1.f / 12.f : 0.f);
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
    if (!Character) return nullptr;
    AQuebecCar* NearestCar = nullptr;
    double NearestDistance = FMath::Square(CarEnterRadius);
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        const double Distance = FVector::DistSquared(Character->GetActorLocation(), It->GetActorLocation());
        if (!It->Occupant && !It->GetController() && (!It->bTraffic || FMath::Abs(It->Speed) <= 120.f) && Distance <= NearestDistance)
        {
            FHitResult Hit;
            FCollisionQueryParams Query(SCENE_QUERY_STAT(EnterCar), false, Character);
            Query.AddIgnoredActor(*It);
            if (GetWorld()->LineTraceSingleByChannel(Hit, Character->GetActorLocation(), It->GetActorLocation(), ECC_Visibility, Query)) continue;
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
    if (!Character) return;
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
    if (AQuebecGameState* State = GetWorld()->GetGameState<AQuebecGameState>())
        if (State->AdvanceMissionNear(Character->GetActorLocation())) return;
    if (AQuebecParkResident* Resident = FindInteractableResident())
        ClientInteractionMessage(FString(AQuebecParkResident::NameForStyle(Resident->Style)) + TEXT("  /  ") + AQuebecParkResident::DialogueForStyle(Resident->Style));
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
        SetControlRotation(Car->GetActorRotation());
        ClientSetRotation(Car->GetActorRotation());
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

void AQuebecHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas || !PlayerOwner || !PlayerOwner->GetPawn()) return;
    const APawn* Pawn = PlayerOwner->GetPawn();
    const AQuebecCar* Car = Cast<AQuebecCar>(Pawn);
    const AQuebecGameState* State = GetWorld()->GetGameState<AQuebecGameState>();
    const AQuebecController* Controller = Cast<AQuebecController>(PlayerOwner);
    const AQuebecCar* NearbyCar = Controller && !Car ? Controller->FindInteractableCar() : nullptr;
    const bool bCanComplete = State && AQuebecGameState::CanAdvanceMission(State->MissionIndex, Pawn->GetActorLocation());
    const float Scale = FMath::Clamp(Canvas->SizeY / 720.f, .75f, 1.5f);
    const float Margin = 28.f * Scale;
    // Comic caption palette: yellow captions and white paper with ink borders and an off-register cyan shadow.
    // Canvas colours are linear: these display as near-black ink, dark plum and deep magenta.
    const FLinearColor Ink(0.f, 0.f, .004f, 1.f);
    const FLinearColor Muted(.045f, .025f, .06f, 1.f);
    const FLinearColor Accent(.62f, 0.f, .16f, 1.f);
    const FLinearColor Panel(1.f, .84f, .16f, 1.f);
    const FLinearColor Paper(.98f, .96f, .88f, 1.f);
    UFont* Font = GEngine->GetMediumFont();
    const auto Text = [this, Font, Scale](const FString& Value, FLinearColor Color, float X, float Y, float Size = 1.f)
    {
        DrawText(Value, Color, X, Y, Font, Size * Scale);
    };
    const auto Box = [this, Scale, Ink](FLinearColor Fill, float X, float Y, float W, float H)
    {
        const float Border = 3.f * Scale;
        DrawRect(FLinearColor(.05f, .8f, .95f), X + 7.f * Scale, Y + 7.f * Scale, W, H);
        DrawRect(Ink, X - Border, Y - Border, W + Border * 2.f, H + Border * 2.f);
        DrawRect(Fill, X, Y, W, H);
    };

    Box(Panel, Margin, Margin, 400.f * Scale, 165.f * Scale);
    DrawRect(Ink, Margin, Margin, 6.f * Scale, 165.f * Scale);
    Text(TEXT("NORD / MONTRÉAL"), Ink, Margin + 20.f * Scale, Margin + 14.f * Scale, 1.55f);
    Text(TEXT("PARC LA FONTAINE / SHERBROOKE EST"), Muted, Margin + 21.f * Scale, Margin + 49.f * Scale, .72f);
    if (State && State->MissionIndex < AQuebecGameState::MissionCount)
    {
        const int32 Index = FMath::Max(0, State->MissionIndex);
        const FVector Target = AQuebecGameState::MissionLocations[Index];
        const float Meters = FVector::Distance(Pawn->GetActorLocation(), Target) / 100.f;
        Text(FString::Printf(TEXT("0%d  /  %s"), Index + 1, AQuebecGameState::MissionLabels[Index]), Ink,
            Margin + 21.f * Scale, Margin + 77.f * Scale, 1.f);
        Text(FString::Printf(TEXT("%dm to the next beacon"), FMath::RoundToInt(Meters)), Muted,
            Margin + 21.f * Scale, Margin + 106.f * Scale, .83f);
        Text(Meters <= 5.f ? (Car ? TEXT("STEP OUT + E  /  Complete objective") : NearbyCar ? TEXT("Move away from car to complete objective") : TEXT("E  /  Complete objective")) : TEXT("Follow the pink diamond"),
            Accent, Margin + 21.f * Scale, Margin + 133.f * Scale, .83f);
        FVector2D Marker;
        if (PlayerOwner->ProjectWorldLocationToScreen(Target + FVector(0., 0., 220.), Marker) &&
            Marker.X > 15.f && Marker.X < Canvas->SizeX - 15.f && Marker.Y > 15.f && Marker.Y < Canvas->SizeY - 80.f &&
            !(Marker.X < Margin + 420.f * Scale && Marker.Y < Margin + 205.f * Scale))
        {
            constexpr float Radius = 12.f;
            DrawLine(Marker.X, Marker.Y - Radius, Marker.X + Radius, Marker.Y, Accent, 2.f);
            DrawLine(Marker.X + Radius, Marker.Y, Marker.X, Marker.Y + Radius, Accent, 2.f);
            DrawLine(Marker.X, Marker.Y + Radius, Marker.X - Radius, Marker.Y, Accent, 2.f);
            DrawLine(Marker.X - Radius, Marker.Y, Marker.X, Marker.Y - Radius, Accent, 2.f);
            Text(FString::Printf(TEXT("%dm"), FMath::RoundToInt(Meters)), Ink, Marker.X - 15.f, Marker.Y + 20.f, .8f);
        }
    }
    else
    {
        Text(TEXT("THE CITY IS YOURS"), Ink, Margin + 21.f * Scale, Margin + 80.f * Scale, 1.1f);
        Text(TEXT("All three missions complete. Keep exploring."), Muted, Margin + 21.f * Scale, Margin + 122.f * Scale, .76f);
    }

    const float MapSize = 188.f * Scale;
    const float MapX = Canvas->SizeX - Margin - MapSize;
    Box(Paper, MapX, Margin, MapSize, MapSize + 32.f * Scale);
    const FVector Here = Pawn->GetActorLocation();
    const auto MapPoint = [MapX, Margin, MapSize](FVector Position)
    {
        return FVector2D(MapX + MapSize * (.5f + FMath::Clamp((Position.X - 6000.) / 125000., -.46, .46)),
            Margin + MapSize * (.5f - FMath::Clamp((Position.Y - 11000.) / 125000., -.46, .46)));
    };
    for (const auto& Segment : LaFontaine::RoadSegments)
    {
        const FVector2D A = MapPoint(Segment[0]), B = MapPoint(Segment[1]);
        DrawLine(A.X, A.Y, B.X, B.Y, Muted.CopyWithNewOpacity(.55f), 1.4f * Scale);
    }
    DrawRect(Paper, MapX - 3.f * Scale, Margin + MapSize + 36.f * Scale, MapSize + 6.f * Scale, 48.f * Scale);
    Text(TEXT("© OpenStreetMap contributors / ODbL"), Muted, MapX, Margin + MapSize + 38.f * Scale, .6f);
    Text(TEXT("openstreetmap.org/copyright"), Muted, MapX, Margin + MapSize + 52.f * Scale, .6f);
    Text(TEXT("© Ville de Montréal / CC BY 4.0"), Muted, MapX, Margin + MapSize + 66.f * Scale, .6f);
    TArray<AQuebecCar*> MapCars;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        if (*It != Pawn && !It->bTraffic && FVector::DistSquared2D(Here,It->GetActorLocation()) < FMath::Square(12000.f))
            MapCars.Add(*It);
    }
    MapCars.Sort([Here](const AQuebecCar& A, const AQuebecCar& B)
    {
        return FVector::DistSquared2D(Here,A.GetActorLocation()) < FVector::DistSquared2D(Here,B.GetActorLocation());
    });
    for (int32 I = 0; I < FMath::Min(8,MapCars.Num()); ++I)
    {
        const FVector2D Vehicle = MapPoint(MapCars[I]->GetActorLocation());
        DrawRect(FLinearColor(1.f, .7f, .3f), Vehicle.X - 3.f, Vehicle.Y - 2.f, 6.f, 4.f);
    }
    const FVector2D Home = MapPoint(MansionSpawn);
    DrawRect(Ink, Home.X - 3.f, Home.Y - 3.f, 6.f, 6.f);
    if (State && State->MissionIndex >= 0 && State->MissionIndex < AQuebecGameState::MissionCount)
    {
        const FVector2D Goal = MapPoint(AQuebecGameState::MissionLocations[State->MissionIndex]);
        DrawRect(Accent, Goal.X - 5.f, Goal.Y - 5.f, 10.f, 10.f);
    }
    const FVector2D Center = MapPoint(Here);
    const FVector Facing = Pawn->GetActorForwardVector();
    DrawLine(Center.X, Center.Y, Center.X + Facing.X * 12.f, Center.Y - Facing.Y * 12.f, Ink, 3.f);
    DrawRect(Ink, Center.X - 2.f, Center.Y - 2.f, 4.f, 4.f);
    Text(TEXT("N"), Ink, MapX + MapSize / 2.f - 5.f, Margin + 3.f, .7f);
    Text(FString::Printf(TEXT("%d ONLINE"), State ? State->PlayerArray.Num() : 1), Accent,
        MapX + 13.f * Scale, Margin + MapSize + 4.f * Scale, .8f);

    const float Bottom = Canvas->SizeY - Margin - 58.f * Scale;
    Box(Paper, Margin, Bottom, Canvas->SizeX - Margin * 2.f - 8.f * Scale, 58.f * Scale);
    Text(Car ? TEXT("W/S  Drive     A/D  Steer     SPACE  Handbrake     E  Exit     Mouse  Look     F2  Comic look") :
        TEXT("WASD  Move     Mouse  Look     SPACE  Jump     SHIFT  Sprint     E  Interact     F2  Comic look"),
        Ink, Margin + 18.f * Scale, Bottom + 18.f * Scale, .82f);
    const AQuebecCharacter* Avatar = Car ? Car->Occupant.Get() : Cast<AQuebecCharacter>(Pawn);
    if (Avatar) Text(FString::Printf(TEXT("C  /  CHARACTER: %s"), AQuebecParkResident::NameForStyle(Avatar->CrewStyle)),
        Ink, Margin + 18.f * Scale, Bottom + 38.f * Scale, .75f);
    if (Controller)
    {
        if (Controller->ResidentCaptionUntil > GetWorld()->GetTimeSeconds())
        {
            Box(Paper, Margin, Bottom-112.f*Scale, Canvas->SizeX-Margin*2.f-8.f*Scale, 72.f*Scale);
            Text(Controller->ResidentCaption, Ink, Margin+18.f*Scale, Bottom-88.f*Scale, .82f);
        }
        else if (!Car && !NearbyCar && !bCanComplete)
        {
            if (AQuebecParkResident* Resident = Controller->FindInteractableResident())
            {
                Box(Panel,Margin,Bottom-70.f*Scale,420.f*Scale,44.f*Scale);
                Text(FString(TEXT("E  /  Talk to "))+AQuebecParkResident::NameForStyle(Resident->Style),Ink,Margin+15.f*Scale,Bottom-58.f*Scale,.85f);
            }
        }
    }
    if (Car)
    {
        Text(FString::Printf(TEXT("%03d KM/H"), FMath::RoundToInt(FMath::Abs(Car->Speed) * .036f)), Accent,
            Canvas->SizeX - Margin - 150.f * Scale, Bottom + 14.f * Scale, 1.1f);
        if (Car->bHandbrake) Text(TEXT("HANDBRAKE"), Accent, Canvas->SizeX - Margin - 150.f * Scale, Bottom - 30.f * Scale, .9f);
    }
    else if (Controller)
    {
        if (NearbyCar)
        {
            const float X = Canvas->SizeX * .5f - 120.f * Scale;
            Box(Panel, X, Bottom - 65.f * Scale, 240.f * Scale, 44.f * Scale);
            Text(TEXT("[ E ]  ENTER CAR"), Accent, X + 32.f * Scale, Bottom - 53.f * Scale, 1.f);
        }
    }
    if (const ACharacter* Walker = Cast<ACharacter>(Pawn))
    {
        const bool bFalling = Walker->GetCharacterMovement()->IsFalling();
        if (bFalling && !bWasFalling && Walker->GetVelocity().Z > 300.f) TriggerSoundWord(TEXT("HOP!"));
        bWasFalling = bFalling;
    }
    if (Car)
    {
        if (Car->bHandbrake && !bWasHandbrake && FMath::Abs(Car->Speed) > 300.f) TriggerSoundWord(TEXT("SKRRT!"));
        if (LastCarSpeed < 900.f && Car->Speed >= 900.f) TriggerSoundWord(TEXT("VROOM!"));
        bWasHandbrake = Car->bHandbrake;
        LastCarSpeed = Car->Speed;
    }
    const float WordAge = GetWorld()->GetTimeSeconds() - SoundWordTime;
    if (WordAge < .9f)
    {
        // A held burst: radiating ink spikes behind outlined lettering, popping in over 0.12 s.
        const float Pop = FMath::Min(WordAge / .12f, 1.f) * (WordAge > .75f ? (.9f - WordAge) / .15f : 1.f);
        const FVector2D Burst(Canvas->SizeX * .5f + 150.f * Scale, Canvas->SizeY * .42f);
        UFont* Large = GEngine->GetLargeFont();
        const float Size = 3.2f * Pop * Scale;
        // Ink spikes first, then slightly shorter yellow spikes, so the burst has an outline.
        for (int32 Pass = 0; Pass < 2; ++Pass)
            for (int32 Spike = 0; Spike < 30; ++Spike)
            {
                const float Angle = Spike * PI * 2.f / 30.f + .2f;
                const float Length = ((Spike % 2 ? 80.f : 125.f) - Pass * 8.f) * Scale * Pop;
                DrawLine(Burst.X, Burst.Y, Burst.X + FMath::Cos(Angle) * Length, Burst.Y + FMath::Sin(Angle) * Length * .7f,
                    Pass ? Panel : Ink, (Pass ? 12.f : 18.f) * Scale);
            }
        float Width = 0.f, Height = 0.f;
        GetTextSize(SoundWord, Width, Height, Large, Size);
        const float X = Burst.X - Width * .5f, Y = Burst.Y - Height * .5f;
        for (const FVector2D Offset : {FVector2D(-3, 0), FVector2D(3, 0), FVector2D(0, -3), FVector2D(0, 3), FVector2D(5, 5)})
            DrawText(SoundWord, Ink, X + Offset.X * Scale, Y + Offset.Y * Scale, Large, Size);
        DrawText(SoundWord, Accent, X, Y, Large, Size);
    }
    if (State)
    {
        if (LastMissionIndex >= 0 && State->MissionIndex > LastMissionIndex) CompletionTime = GetWorld()->GetTimeSeconds();
        LastMissionIndex = State->MissionIndex;
        if (GetWorld()->GetTimeSeconds() - CompletionTime < 4.f)
        {
            const float X = Canvas->SizeX * .5f - 160.f * Scale;
            Box(Panel, X, Margin, 320.f * Scale, 70.f * Scale);
            Text(TEXT("MISSION COMPLETE"), Accent, X + 27.f * Scale, Margin + 12.f * Scale, 1.15f);
            Text(FString::Printf(TEXT("%d / 3 completed together"), State->MissionIndex), Ink, X + 27.f * Scale, Margin + 42.f * Scale, .8f);
        }
    }
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
}

void AQuebecGameMode::BeginPlay()
{
    Super::BeginPlay();
    if (!GetWorld()->GetMapName().Contains(TEXT("LaFontaine"))) return;
    static_assert(UE_ARRAY_COUNT(LaFontaine::RoadSegments) == UE_ARRAY_COUNT(LaFontaine::RoadSegmentWidths));

    // Runtime population stays bounded and uses the surveyed streets and existing park paths.
    constexpr int32 ParkedGoal = 32, TrafficGoal = 16, ParkCrowdGoal = 64, StreetCrowdGoal = 32;
    TArray<TArray<FVector>> ParkRoutes;
    for (TActorIterator<AQuebecParkResident> It(GetWorld()); It; ++It)
        if (It->Route.Num() > 1) ParkRoutes.Add(It->Route);
    TArray<int32> NearRoads;
    for (int32 I = 0; I < UE_ARRAY_COUNT(LaFontaine::RoadSegments); ++I)
        if (FVector::DistSquared2D(LaFontaine::RoadSegments[I][0],LaFontaine::RoadSegments[I][1]) > FMath::Square(1800.f))
            NearRoads.Add(I);
    NearRoads.Sort([](int32 A, int32 B)
    {
        const FVector MidA = (LaFontaine::RoadSegments[A][0]+LaFontaine::RoadSegments[A][1])*.5;
        const FVector MidB = (LaFontaine::RoadSegments[B][0]+LaFontaine::RoadSegments[B][1])*.5;
        return FVector::DistSquared2D(MidA,MansionSpawn) < FVector::DistSquared2D(MidB,MansionSpawn);
    });
    TArray<int32> DistrictRoads = NearRoads;
    FRandomStream Random(7493);
    for (int32 I = DistrictRoads.Num()-1; I > 0; --I) DistrictRoads.Swap(I,Random.RandRange(0,I));

    const auto Ground = [this](FVector& Point)
    {
        FHitResult Hit;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PopulationFloor),false);
        if (!GetWorld()->LineTraceSingleByChannel(Hit,Point+FVector(0.,0.,500.),Point-FVector(0.,0.,1000.),ECC_Visibility,Query) ||
            !Hit.IsValidBlockingHit() || Hit.ImpactNormal.Z < .7f || Hit.ImpactPoint.Z > 50.f || Hit.ImpactPoint.Z < -200.f) return false;
        Point.Z = Hit.ImpactPoint.Z;
        return true;
    };
    // Keep the saved geographic anchor while giving the first driver a clear
    // lane: a centered starter otherwise blocks both opposing traffic lanes.
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        if (FVector::DistSquared2D(It->GetActorLocation(),LaFontaine::CarSpawn) < FMath::Square(300.f))
        {
            AQuebecCar* Starter = *It;
            FVector Point = LaFontaine::CarSpawn+Starter->GetActorRightVector()*145.f;
            if (Ground(Point))
            {
                Point.Z += 102.f;
                FCollisionQueryParams Query(SCENE_QUERY_STAT(StarterDrivingLane),false,Starter);
                FHitResult Hit;
                if (!GetWorld()->SweepSingleByChannel(Hit,Starter->GetActorLocation(),Point,Starter->GetActorQuat(),ECC_Pawn,
                    FCollisionShape::MakeBox(FVector(225.,113.,98.)),Query))
                {
                    Starter->SetActorLocation(Point,false,nullptr,ETeleportType::TeleportPhysics);
                    Starter->ForceNetUpdate();
                    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION starter_right_lane_offset_cm=145"));
                }
                else UE_LOG(LogTemp,Warning,TEXT("NORD_POPULATION starter driving lane is obstructed"));
            }
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
        if (Car->Occupant || Car->GetController() ||
            FVector::DistSquared2D(Original,LaFontaine::CarSpawn) < FMath::Square(300.f)) continue;
        TArray<int32> ParkingRoads;
        for (int32 I : NearRoads)
            if (LaFontaine::RoadSegmentWidths[I] >= 1200.f) ParkingRoads.Add(I);
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
            const float Along = FMath::Clamp(float(FVector::DotProduct(Original-Start,Direction)),400.f,float((End-Start).Size2D()-400.f));
            const FVector RoadPoint = Start+Direction*Along;
            const FRotator Facing = (Direction*(FVector::DotProduct(Car->GetActorForwardVector(),Direction) >= 0. ? 1. : -1.)).Rotation();
            const float PreferredSide = FVector::DotProduct(Original-RoadPoint,Right) >= 0. ? 1.f : -1.f;
            for (int32 Attempt = 0; Attempt < 2; ++Attempt)
            {
                FVector Point = RoadPoint+Right*(PreferredSide*(Attempt ? -470.f : 470.f));
                if (!Ground(Point)) continue;
                Point.Z += 102.f;
                FCollisionQueryParams Query(SCENE_QUERY_STAT(AuthoredCarParking),false,Car);
                if (GetWorld()->OverlapBlockingTestByChannel(Point,Facing.Quaternion(),ECC_Pawn,
                    FCollisionShape::MakeBox(FVector(225.,113.,98.)),Query)) continue;
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
    // Validate both complete lanes against this world's static collision, then
    // prune branches again so a removed corridor cannot lead traffic into a dead end.
    TArray<bool> TrafficRoads = ClosedTrafficRoads();
    FCollisionObjectQueryParams StaticObjects;
    StaticObjects.AddObjectTypesToQuery(ECC_WorldStatic);
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
                    StaticObjects,FCollisionShape::MakeBox(FVector(220.,108.,70.)),LaneQuery))
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
    const auto ClearCar = [this,&Ground](FVector& Point, const FQuat& Rotation)
    {
        if (FVector::DistSquared2D(Point,LaFontaine::CarSpawn) < FMath::Square(3500.f) || !Ground(Point)) return false;
        Point.Z += 102.f;
        FCollisionQueryParams Query(SCENE_QUERY_STAT(PopulationCar),false);
        if (GetWorld()->OverlapBlockingTestByChannel(Point,Rotation,ECC_Pawn,FCollisionShape::MakeBox(FVector(225.,113.,98.)),Query)) return false;
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
            if (FVector::DistSquared2D(Point,It->GetActorLocation()) < FMath::Square(650.f)) return false;
        return true;
    };
    const auto SpawnCar = [this,&TrafficRoads](const FVector& Point, const FRotator& Rotation, int32 Style, int32 Road, bool bForward)
    {
        const FTransform Transform(Rotation,Point);
        AQuebecCar* Car = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(),Transform,nullptr,nullptr,ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (!Car) return false;
        Car->PaintStyle = Style % 4;
        Car->Tags.Add(Road == INDEX_NONE ? TEXT("CityParked") : TEXT("CityTraffic"));
        if (Road != INDEX_NONE) Car->SetTrafficRoute(Road,bForward,TrafficRoads);
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
    const auto SpawnResident = [this](const TArray<FVector>& Route, int32 Index)
    {
        const float Phase = Index * 7.91f;
        const float Duration = FVector::Distance(Route[0],Route.Last())/85.f;
        const float Cycle = FMath::Fmod(GetWorld()->GetTimeSeconds()+Phase,2.f*(Duration+4.f));
        const bool bReturn = Cycle > Duration+4.f;
        const float Alpha = FMath::Clamp((bReturn ? Cycle-Duration-4.f : Cycle)/Duration,0.f,1.f);
        const FVector Point = FMath::Lerp(Route[0],Route.Last(),bReturn ? 1.f-Alpha : Alpha);
        const FTransform Transform((Route.Last()-Route[0]).Rotation(),Point);
        AQuebecParkResident* Resident = GetWorld()->SpawnActorDeferred<AQuebecParkResident>(AQuebecParkResident::StaticClass(),Transform,
            nullptr,nullptr,ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (!Resident) return false;
        Resident->Style = 3 + Index % 8;
        Resident->Route = Route;
        Resident->Phase = Phase;
        Resident->Tags.Add(TEXT("CityCrowd"));
        Resident->FinishSpawning(Transform);
        return true;
    };

    int32 Parked = 0, Traffic = 0, ParkCrowd = 0, StreetCrowd = 0;
    for (int32 Pass = 0; Pass < 2; ++Pass)
    {
        const int32 ParkedLimit = Pass ? ParkedGoal : ParkedGoal/2;
        const int32 TrafficLimit = Pass ? TrafficGoal : TrafficGoal/2;
        const int32 StreetLimit = Pass ? StreetCrowdGoal : StreetCrowdGoal/2;
        for (int32 Road : (Pass ? DistrictRoads : NearRoads))
        {
            const FVector Start = LaFontaine::RoadSegments[Road][0], End = LaFontaine::RoadSegments[Road][1];
            const FVector Direction = (End-Start).GetSafeNormal2D();
            const FVector Right = FVector::CrossProduct(FVector::UpVector,Direction);
            for (int32 Side : {-1,1})
            {
                const FRotator Facing = (Direction*Side).Rotation();
                if (LaFontaine::RoadSegmentWidths[Road] >= 1200.f)
                    for (float Alpha : {.25f,.5f,.75f})
                    {
                        FVector Parking = FMath::Lerp(Start,End,Alpha)+Right*(Side*470.);
                        if (Parked < ParkedLimit && ClearCar(Parking,Facing.Quaternion()) && SpawnCar(Parking,Facing,Parked,INDEX_NONE,true)) ++Parked;
                    }
                FVector Moving = FMath::Lerp(Start,End,Side > 0 ? .65 : .35)+Right*(Side*145.);
                if (Traffic < TrafficLimit && TrafficRoads[Road] && ClearCar(Moving,Facing.Quaternion()) && SpawnCar(Moving,Facing,Traffic+1,Road,Side > 0)) ++Traffic;
                if (StreetCrowd < StreetLimit)
                {
                    const FVector Center = FMath::Lerp(Start,End,.5)+Right*(Side*700.);
                    const float HalfLength = FMath::Min(float((End-Start).Size2D()*.5-400.),1300.f);
                    TArray<FVector> Route = {Center-Direction*HalfLength,Center+Direction*HalfLength};
                    if (HalfLength > 400.f && ClearRoute(Route) && SpawnResident(Route,ParkCrowdGoal+StreetCrowd)) ++StreetCrowd;
                }
            }
            if (Parked == ParkedLimit && Traffic == TrafficLimit && StreetCrowd == StreetLimit) break;
        }
    }
    // Stagger walkers on both sides of the existing mapped park paths; no navigation or path finding per frame.
    for (int32 Attempt = 0; ParkCrowd < ParkCrowdGoal && Attempt < ParkRoutes.Num()*12; ++Attempt)
    {
        TArray<FVector> Route = ParkRoutes[Attempt%ParkRoutes.Num()];
        const FVector Right = FVector::CrossProduct(FVector::UpVector,(Route.Last()-Route[0]).GetSafeNormal2D());
        const float Offset = (Attempt/ParkRoutes.Num()%2 ? -1.f : 1.f)*(25.f+15.f*(Attempt/ParkRoutes.Num()%3));
        for (FVector& Point : Route) Point += Right*Offset;
        if (ClearRoute(Route) && SpawnResident(Route,ParkCrowd)) ++ParkCrowd;
    }
    UE_LOG(LogTemp,Display,TEXT("NORD_POPULATION parked=%d/%d traffic=%d/%d pedestrians=%d/%d"),
        Parked,ParkedGoal,Traffic,TrafficGoal,ParkCrowd+StreetCrowd,ParkCrowdGoal+StreetCrowdGoal);
    if (Parked < ParkedGoal || Traffic < TrafficGoal || ParkCrowd < ParkCrowdGoal || StreetCrowd < StreetCrowdGoal)
        UE_LOG(LogTemp,Warning,TEXT("NORD_POPULATION some placements were blocked by world collision"));
}

#if WITH_DEV_AUTOMATION_TESTS
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
