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
    CrewWalk = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Walk.A_Walk")));
    CrewIdle = LoadObject<UAnimSequence>(nullptr, *(Folder + TEXT("A_Idle.A_Idle")));
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
        UAnimSequence* Animation = Speed > 5.f ? CrewWalk : CrewIdle;
        if (Animation)
        {
            if (CrewAnimation != Animation) { GetMesh()->SetAnimation(Animation); CrewAnimation = Animation; }
            const AGameStateBase* State = GetWorld()->GetGameState();
            float Time = State ? State->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds();
            const float Interval = GetMesh()->GetComponentTickInterval();
            if (Interval > 0.f) Time = FMath::FloorToFloat(Time / Interval) * Interval;
            GetMesh()->SetPosition(FMath::Fmod(Time * (Speed > 5.f ? FMath::Clamp(Speed / 180.f, .8f, 2.f) : 1.f), Animation->GetPlayLength()), false);
            GetMesh()->TickAnimation(0.f, false);
            GetMesh()->RefreshBoneTransforms();
            CrewProp->UpdateComponentToWorld();
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
    if (APlayerController* Player = GetWorld()->GetFirstPlayerController(); Player && Player->IsLocalController())
    {
        const FVector Eye = Player->PlayerCameraManager ? Player->PlayerCameraManager->GetCameraLocation() : GetActorLocation();
        Label->SetVisibility(FVector::DistSquared(Eye,GetActorLocation()) < FMath::Square(1800.f));
        Label->SetWorldRotation((Eye-Label->GetComponentLocation()).Rotation());
    }
}

void AQuebecParkResident::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecParkResident, Style);
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
    GetComponents(Parts);
    Parts.RemoveAll([](const UStaticMeshComponent* Part) { return Part->IsEditorOnly(); });
    for (UStaticMeshComponent* Part : Parts)
    {
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
        if (Part->GetName().Contains(TEXT("Wheel")))
            Part->SetRelativeRotation(FRotator(0., Part->GetName().StartsWith(TEXT("Front")) ? DisplaySteering * 28.f : 0., 0.).Quaternion() *
                FQuat(FVector::RightVector, FMath::DegreesToRadians(WheelAngle)) * FRotator(0., 0., 90.).Quaternion());
    }
    Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView, 85.f + FMath::Abs(Speed) / 2400.f * 9.f, DeltaSeconds, 3.f));
    if (IsLocallyControlled() && Controller && FMath::Abs(Speed) > 100.f && GetWorld()->GetTimeSeconds() - LastLookTime > 2.f)
        Controller->SetControlRotation(FMath::RInterpTo(Controller->GetControlRotation(), GetActorRotation() + FRotator(-12., 0., 0.), DeltaSeconds, 2.5f));
    if (IsLocallyControlled() && !HasAuthority()) ServerSetDrive(Throttle, Steering, bHandbrake);
    if (!HasAuthority()) return;
    const float Step = FMath::Min(DeltaSeconds, .05f);
    // A lost connection must not hold its last throttle until the network timeout.
    if (!Controller || (!IsLocallyControlled() && GetWorld()->GetTimeSeconds() - LastDriveInputTime > .5f)) StopInput();
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
        const float Turn = Steering * 70.f * FMath::Clamp(Speed / 750.f, -1.f, 1.f) * Step;
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
        if (!It->Occupant && !It->GetController() && Distance <= NearestDistance)
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
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        if (*It == Pawn) continue;
        const FVector2D Vehicle = MapPoint(It->GetActorLocation());
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

#if WITH_DEV_AUTOMATION_TESTS
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
