#include "QuebecGameplay.h"
#include "LaFontaineMap.h"

#include "Animation/AnimInstance.h"
#include "Camera/CameraComponent.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
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
#include "Net/UnrealNetwork.h"
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
    Part(TEXT("LeftHeadlight"), Cube.Object, FVector(222., -58., -20.), FVector(.06, .42, .20));
    Part(TEXT("RightHeadlight"), Cube.Object, FVector(222., 58., -20.), FVector(.06, .42, .20));
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
        const TCHAR* MaterialName = Name.Contains(TEXT("Rim")) || Name.Contains(TEXT("Bumper")) ? TEXT("M_White") :
            Name.Contains(TEXT("Wheel")) || Name.Contains(TEXT("Trim")) ? TEXT("M_Dark") :
            Name.Contains(TEXT("Glass")) ? TEXT("M_Glass") :
            Name.Contains(TEXT("Headlight")) ? TEXT("M_Light") :
            Name.Contains(TEXT("Taillight")) ? TEXT("M_Tail") : TEXT("M_CarBody");
        const FString Path = FString::Printf(TEXT("/Game/Materials/%s.%s"), MaterialName, MaterialName);
        if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, *Path)) Part->SetMaterial(0, Material);
    }
}

void AQuebecCar::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
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
    if (!Controller) StopInput();
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
        State->AdvanceMissionNear(Character->GetActorLocation());
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
    ClientMessage(TEXT("The door is blocked. Move to an open spot to get out."));
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
    const float Scale = FMath::Clamp(Canvas->SizeY / 720.f, .75f, 1.5f);
    const float Margin = 28.f * Scale;
    const FLinearColor Ink(.89f, .94f, .97f, 1.f);
    const FLinearColor Muted(.58f, .69f, .76f, 1.f);
    const FLinearColor Accent(.18f, .9f, .76f, 1.f);
    const FLinearColor Panel(.018f, .035f, .052f, .92f);
    UFont* Font = GEngine->GetMediumFont();
    const auto Text = [this, Font, Scale](const FString& Value, FLinearColor Color, float X, float Y, float Size = 1.f)
    {
        DrawText(Value, Color, X, Y, Font, Size * Scale);
    };

    DrawRect(Panel, Margin, Margin, 400.f * Scale, 165.f * Scale);
    DrawRect(Accent, Margin, Margin, 4.f * Scale, 165.f * Scale);
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
        Text(Meters <= 5.f ? (Car ? TEXT("STEP OUT + E  /  Complete objective") : TEXT("E  /  Complete objective")) : TEXT("Follow the turquoise diamond"),
            Accent, Margin + 21.f * Scale, Margin + 133.f * Scale, .83f);
        FVector2D Marker;
        if (PlayerOwner->ProjectWorldLocationToScreen(Target + FVector(0., 0., 220.), Marker) &&
            Marker.X > 15.f && Marker.X < Canvas->SizeX - 15.f && Marker.Y > 15.f && Marker.Y < Canvas->SizeY - 80.f)
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
    DrawRect(Panel, MapX, Margin, MapSize, MapSize + 32.f * Scale);
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
    Text(TEXT("© OpenStreetMap contributors / ODbL"), Muted, MapX, Margin + MapSize + 38.f * Scale, .6f);
    Text(TEXT("openstreetmap.org/copyright"), Muted, MapX, Margin + MapSize + 52.f * Scale, .6f);
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
    DrawRect(Panel, Margin, Bottom, Canvas->SizeX - Margin * 2.f, 58.f * Scale);
    Text(Car ? TEXT("W/S  Drive     A/D  Steer     SPACE  Handbrake     E  Exit     Mouse  Look") :
        TEXT("WASD  Move     Mouse  Look     SPACE  Jump     SHIFT  Sprint     E  Interact"),
        Ink, Margin + 18.f * Scale, Bottom + 18.f * Scale, .82f);
    if (Car)
    {
        Text(FString::Printf(TEXT("%03d KM/H"), FMath::RoundToInt(FMath::Abs(Car->Speed) * .036f)), Accent,
            Canvas->SizeX - Margin - 150.f * Scale, Bottom + 14.f * Scale, 1.1f);
        if (Car->bHandbrake) Text(TEXT("HANDBRAKE"), FLinearColor(1.f, .55f, .25f), Canvas->SizeX - Margin - 150.f * Scale, Bottom - 28.f * Scale, .9f);
    }
    else if (const AQuebecController* Controller = Cast<AQuebecController>(PlayerOwner))
    {
        if (Controller->FindInteractableCar())
        {
            const float X = Canvas->SizeX * .5f - 120.f * Scale;
            DrawRect(Panel, X, Bottom - 65.f * Scale, 240.f * Scale, 44.f * Scale);
            Text(TEXT("[ E ]  ENTER CAR"), Accent, X + 32.f * Scale, Bottom - 53.f * Scale, 1.f);
        }
    }
    if (State)
    {
        if (LastMissionIndex >= 0 && State->MissionIndex > LastMissionIndex) CompletionTime = GetWorld()->GetTimeSeconds();
        LastMissionIndex = State->MissionIndex;
        if (GetWorld()->GetTimeSeconds() - CompletionTime < 4.f)
        {
            const float X = Canvas->SizeX * .5f - 160.f * Scale;
            DrawRect(Panel, X, Margin, 320.f * Scale, 70.f * Scale);
            Text(TEXT("MISSION COMPLETE"), Accent, X + 27.f * Scale, Margin + 12.f * Scale, 1.15f);
            Text(FString::Printf(TEXT("%d / 3 completed together"), State->MissionIndex), Ink, X + 27.f * Scale, Margin + 42.f * Scale, .8f);
        }
    }
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
