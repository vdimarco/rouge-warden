// EXPECT: PASS
#include "ApiCoverage.h"
#include "Camera/CameraComponent.h"
#include "CanvasItem.h"
#include "Components/AudioComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "DrawDebugHelpers.h"
#include "Engine/Canvas.h"
#include "Engine/DamageEvents.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/OverlapResult.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerStart.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Net/UnrealNetwork.h"
#include "Sound/SoundBase.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

DEFINE_LOG_CATEGORY_STATIC(LogCoverage, Log, All);

ACoverageCharacter::ACoverageCharacter()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    SetReplicateMovement(true);
    GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);
    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
    GetCharacterMovement()->MaxWalkSpeed = 600.f;
    GetCharacterMovement()->JumpZVelocity = 700.f;
    GetCharacterMovement()->AirControl = .35f;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.f, 540.f, 0.f);
    GetCharacterMovement()->GravityScale = 1.5f;
    GetCharacterMovement()->BrakingDecelerationWalking = 2048.f;
    bUseControllerRotationYaw = false;
    Engine = CreateDefaultSubobject<UAudioComponent>(TEXT("Engine"));
    Engine->SetupAttachment(GetRootComponent());
    Engine->bAutoActivate = false;
    Lamp = CreateDefaultSubobject<UPointLightComponent>(TEXT("Lamp"));
    Lamp->SetupAttachment(GetMesh(), TEXT("head"));
    Lamp->SetIntensity(5000.f);
    Lamp->SetLightColor(FLinearColor(1.f, .8f, .6f));
    Lamp->SetAttenuationRadius(800.f);
    Label = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Label"));
    Label->SetupAttachment(GetRootComponent());
    Label->SetText(FText::FromString(TEXT("Player")));
    Label->SetHorizontalAlignment(EHTA_Center);
    Label->SetWorldSize(24.f);
    Label->SetTextRenderColor(FColor::Yellow);
    static ConstructorHelpers::FObjectFinder<USoundBase> ShotFinder(TEXT("/Game/Audio/Shot.Shot"));
    if (ShotFinder.Succeeded()) ShotSound = ShotFinder.Object;
    static ConstructorHelpers::FClassFinder<AActor> ProjectileFinder(TEXT("/Game/BP_Projectile"));
    if (ProjectileFinder.Class) ProjectileClass = ProjectileFinder.Class;
    Ammo.Init(0, 5);
}

void ACoverageCharacter::BeginPlay()
{
    Super::BeginPlay();
    Random.Initialize(1234);
    GetCapsuleComponent()->OnComponentHit.AddDynamic(this, &ACoverageCharacter::OnCapsuleHit);
    GetCapsuleComponent()->OnComponentEndOverlap.AddDynamic(this, &ACoverageCharacter::OnCapsuleEndOverlap);
    if (UMaterialInterface* Base = GetMesh()->GetMaterial(0))
    {
        Paint = UMaterialInstanceDynamic::Create(Base, this);
        Paint->SetVectorParameterValue(TEXT("Tint"), FLinearColor::Red);
        Paint->SetScalarParameterValue(TEXT("Wear"), .5f);
        GetMesh()->SetMaterial(0, Paint);
    }
    if (HasAuthority() && GetNetMode() != NM_Client)
    {
        GetWorldTimerManager().SetTimer(RespawnTimer, this, &ACoverageCharacter::Respawn, 3.f, true, .5f);
        FTimerHandle Once;
        GetWorld()->GetTimerManager().SetTimer(Once, FTimerDelegate::CreateUObject(this, &ACoverageCharacter::Respawn), 1.f, false);
        GetWorldTimerManager().SetTimer(Once, [this]() { Mode = ECoverageMode::Chase; }, 2.f, false);
        GetWorldTimerManager().SetTimerForNextTick(this, &ACoverageCharacter::Respawn);
    }
    if (UStaticMesh* Loaded = SoftMesh.LoadSynchronous()) { UE_LOG(LogCoverage, Log, TEXT("Loaded %s"), *Loaded->GetName()); }
    UStaticMesh* Direct = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    UStaticMeshComponent* Extra = NewObject<UStaticMeshComponent>(this, TEXT("Extra"));
    Extra->SetStaticMesh(Direct);
    Extra->SetupAttachment(GetRootComponent());
    Extra->RegisterComponent();
    Extra->AttachToComponent(GetMesh(), FAttachmentTransformRules::SnapToTargetNotIncludingScale, TEXT("hand_r"));
    Extra->SetRelativeLocationAndRotation(FVector(0.f, 10.f, 0.f), FRotator::ZeroRotator);
    Extra->SetWorldScale3D(FVector(.2f));
}

void ACoverageCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    UWorld* World = GetWorld();
    const double Now = World->GetTimeSeconds();
    const float Delta = World->GetDeltaSeconds();
    const FVector Start = GetActorLocation() + FVector(0.f, 0.f, BaseEyeHeight);
    const FVector End = Start + GetControlRotation().Vector() * 5000.f;

    FCollisionQueryParams Params(SCENE_QUERY_STAT(CoverageShot), true, this);
    Params.AddIgnoredActor(this);
    Params.bReturnPhysicalMaterial = true;
    FHitResult Hit;
    if (World->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
    {
        DrawDebugLine(World, Start, Hit.ImpactPoint, FColor::Red, false, 1.f, 0, 2.f);
        DrawDebugSphere(World, Hit.Location, 12.f, 8, FColor::Green);
        if (AActor* HitActor = Hit.GetActor())
        {
            FPointDamageEvent PointEvent(10.f, Hit, (End - Start).GetSafeNormal(), UCoverageDamageType::StaticClass());
            HitActor->TakeDamage(10.f, PointEvent, GetController(), this);
            UGameplayStatics::ApplyPointDamage(HitActor, 10.f, (End - Start).GetSafeNormal(), Hit, GetController(), this, UDamageType::StaticClass());
        }
        if (UPrimitiveComponent* Comp = Hit.GetComponent())
        {
            if (Comp->IsSimulatingPhysics()) Comp->AddImpulseAtLocation(GetActorForwardVector() * 50000.f, Hit.ImpactPoint);
        }
    }
    TArray<FHitResult> Hits;
    World->LineTraceMultiByObjectType(Hits, Start, End, FCollisionObjectQueryParams(ECC_PhysicsBody), Params);
    World->SweepSingleByChannel(Hit, Start, End, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeSphere(30.f), Params);
    World->SweepMultiByChannel(Hits, Start, End, GetActorQuat(), ECC_WorldDynamic, FCollisionShape::MakeCapsule(30.f, 90.f), Params);
    TArray<FOverlapResult> Overlaps;
    World->OverlapMultiByObjectType(Overlaps, GetActorLocation(), FQuat::Identity, FCollisionObjectQueryParams(FCollisionObjectQueryParams::AllDynamicObjects), FCollisionShape::MakeBox(FVector(200.f)), Params);
    for (const FOverlapResult& Overlap : Overlaps) { if (AActor* A = Overlap.GetActor()) Seen.Add(A); }
    TArray<AActor*> Found;
    UGameplayStatics::GetAllActorsOfClass(this, APawn::StaticClass(), Found);
    TArray<AActor*> Ignore;
    UGameplayStatics::ApplyRadialDamage(this, 50.f, GetActorLocation(), 300.f, UDamageType::StaticClass(), Ignore, this, GetController(), true, ECC_Visibility);
    UGameplayStatics::ApplyRadialDamageWithFalloff(this, 50.f, 5.f, GetActorLocation(), 100.f, 300.f, 1.f, nullptr, Ignore);

    for (TActorIterator<ACharacter> It(World); It; ++It)
    {
        ACharacter* Other = *It;
        if (Other == this) continue;
        const float Dist = FVector::Dist(Other->GetActorLocation(), GetActorLocation());
        const float Dist2D = FVector::Dist2D(Other->GetActorLocation(), GetActorLocation());
        if (Dist < 500.f && Dist2D > 1.f) Target = Other;
    }
    for (APawn* P : TActorRange<APawn>(World)) { if (P->IsPlayerControlled()) break; }
    if (Target.IsValid())
    {
        const FRotator Look = (Target->GetActorLocation() - GetActorLocation()).Rotation();
        SetActorRotation(FMath::RInterpTo(GetActorRotation(), Look, DeltaSeconds, 5.f));
    }

    // math
    const float A = FMath::Clamp(Delta, 0.f, 1.f);
    const float B = FMath::Lerp(0.f, 10.f, A);
    const float C = FMath::FInterpTo(B, 5.f, DeltaSeconds, 2.f);
    const FVector V = FMath::VInterpTo(GetVelocity(), FVector::ZeroVector, DeltaSeconds, 3.f);
    const float R = FMath::RandRange(0.f, 1.f) + FMath::FRandRange(1.f, 2.f) + FMath::FRand();
    const int32 I = FMath::RandRange(0, 10) + FMath::RoundToInt(C) + FMath::FloorToInt(R) + FMath::TruncToInt(B);
    const float S = FMath::Sin(A) + FMath::Cos(B) + FMath::Atan2(C, 1.f) + FMath::Sqrt(4.f) + FMath::Square(2.f) + FMath::Abs(-1.f);
    const bool bNear = FMath::IsNearlyZero(S) || FMath::IsNearlyEqual(A, B, .01f);
    const float Deg = FMath::RadiansToDegrees(FMath::DegreesToRadians(45.f)) + FMath::UnwindDegrees(370.f) + FMath::FindDeltaAngleDegrees(10.f, 350.f);
    const float Mapped = FMath::GetMappedRangeValueClamped(FVector2D(0.f, 100.f), FVector2D(0.f, 1.f), 50.f);
    const FVector Rv = FMath::VRand() * Random.FRandRange(1.f, 2.f) + Random.GetUnitVector();
    const int32 Ri = Random.RandRange(0, 5) + Random.RandHelper(10);
    const FVector Cross = FVector::CrossProduct(FVector::UpVector, GetActorForwardVector());
    const float Dot = FVector::DotProduct(Cross, GetActorRightVector()) + (Cross | FVector::ForwardVector);
    const FVector2D Screen(10.f, 20.f);
    const FQuat Q = FQuat(FVector::UpVector, PI * .5f) * GetActorQuat();
    const FTransform T(Q.Rotator(), GetActorLocation(), FVector::OneVector);
    const FVector Local = T.InverseTransformPosition(Rv);
    const FVector World2 = T.TransformPosition(Local) + T.TransformVector(V) + T.GetRotation().RotateVector(FVector::ForwardVector);
    const FRotator Rot = FRotator(0.f, 90.f, 0.f) + FRotationMatrix::MakeFromX(World2).Rotator();
    const FVector Clamped = World2.GetClampedToMaxSize(100.f).GetSafeNormal2D();
    UE_LOG(LogCoverage, VeryVerbose, TEXT("%f %f %d %d %d %f %f %f %s %s %s %f"), A, S, I, Ri, bNear ? 1 : 0, Deg, Mapped, Dot, *Rot.ToString(), *Clamped.ToString(), *Screen.ToString(), Now);
    UE_CLOG(I > 100, LogCoverage, Warning, TEXT("Large %d"), I);
    ensureMsgf(Delta >= 0.f, TEXT("Negative delta %f"), Delta);
    check(World != nullptr);

    // engine globals
    if (GEngine) GEngine->AddOnScreenDebugMessage(-1, 2.f, FColor::Cyan, FString::Printf(TEXT("Speed %.0f"), GetVelocity().Size()));
    const ENetRole Role = GetLocalRole();
    const ENetRole Remote = GetRemoteRole();
    if (Role == ROLE_Authority && Remote == ROLE_SimulatedProxy && IsLocallyControlled()) { ForceNetUpdate(); }
    if (AGameStateBase* GS = World->GetGameState()) { const double ServerTime = GS->GetServerWorldTimeSeconds(); (void)ServerTime; }
    if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0)) { PC->ClientStartCameraShake(nullptr); }
    UGameplayStatics::PlaySoundAtLocation(this, ShotSound, GetActorLocation(), 1.f, 1.f);
    UGameplayStatics::SpawnSoundAttached(ShotSound, GetRootComponent());
    UGameplayStatics::PlaySound2D(this, ShotSound);
    UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
    if (!Engine->IsPlaying()) { Engine->SetSound(ShotSound); Engine->Play(); }
    Engine->SetPitchMultiplier(1.f + A);
    Engine->SetVolumeMultiplier(.5f);
    Engine->FadeOut(.5f, 0.f);
}

void ACoverageCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &ACoverageCharacter::MoveForward);
    PlayerInputComponent->BindAxis(TEXT("Turn"), this, &APawn::AddControllerYawInput);
    PlayerInputComponent->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
    PlayerInputComponent->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
    PlayerInputComponent->BindAction(TEXT("Fire"), IE_Pressed, this, &ACoverageCharacter::Fire);
    PlayerInputComponent->BindAction(TEXT("FireKey"), IE_Pressed, this, &ACoverageCharacter::FireKey);
    PlayerInputComponent->BindKey(EKeys::F, IE_Pressed, this, &ACoverageCharacter::Fire);
}

void ACoverageCharacter::MoveForward(float Value)
{
    if (Controller && Value != 0.f)
    {
        const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Value);
    }
}

void ACoverageCharacter::Fire()
{
    if (!ProjectileClass) return;
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = this;
    SpawnParams.Instigator = this;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    const FVector Muzzle = GetMesh()->GetSocketLocation(TEXT("muzzle"));
    AActor* Projectile = GetWorld()->SpawnActor<AActor>(ProjectileClass, Muzzle, GetControlRotation(), SpawnParams);
    AActor* Deferred = GetWorld()->SpawnActorDeferred<AActor>(ProjectileClass, FTransform(Muzzle), this, this);
    if (Deferred) UGameplayStatics::FinishSpawningActor(Deferred, FTransform(Muzzle));
    if (Projectile) Projectile->SetLifeSpan(5.f);
    ServerShoot(Muzzle);
}

void ACoverageCharacter::FireKey(FKey Key) { UE_LOG(LogCoverage, Log, TEXT("%s"), *Key.ToString()); }

void ACoverageCharacter::Ragdoll()
{
    GetCharacterMovement()->DisableMovement();
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    GetMesh()->SetCollisionProfileName(TEXT("Ragdoll"));
    GetMesh()->SetAllBodiesSimulatePhysics(true);
    GetMesh()->SetSimulatePhysics(true);
    GetMesh()->WakeAllRigidBodies();
    GetMesh()->bBlendPhysics = true;
    GetMesh()->AddImpulse(FVector(0.f, 0.f, 500.f), NAME_None, true);
    GetMesh()->SetPhysicsLinearVelocity(FVector::ZeroVector);
    GetMesh()->SetAllPhysicsLinearVelocity(FVector::ZeroVector);
}

void ACoverageCharacter::Respawn()
{
    if (AGameModeBase* GM = GetWorld()->GetAuthGameMode()) { GM->RestartPlayer(GetController()); }
    GetWorldTimerManager().ClearTimer(RespawnTimer);
    TeleportTo(FVector::ZeroVector, FRotator::ZeroRotator);
}

float ACoverageCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
    float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
    if (DamageEvent.IsOfType(FPointDamageEvent::ClassID))
    {
        const FPointDamageEvent* Point = static_cast<const FPointDamageEvent*>(&DamageEvent);
        Applied *= Point->HitInfo.BoneName == TEXT("head") ? 2.f : 1.f;
    }
    Stats.Kills += Applied > 50.f ? 1 : 0;
    return Applied;
}

void ACoverageCharacter::NotifyActorBeginOverlap(AActor* OtherActor) { Super::NotifyActorBeginOverlap(OtherActor); if (OtherActor && OtherActor->ActorHasTag(TEXT("Pickup"))) OtherActor->Destroy(); }
void ACoverageCharacter::NotifyHit(UPrimitiveComponent* MyComp, AActor* Other, UPrimitiveComponent* OtherComp, bool bSelfMoved, FVector HitLocation, FVector HitNormal, FVector NormalImpulse, const FHitResult& Hit)
{ Super::NotifyHit(MyComp, Other, OtherComp, bSelfMoved, HitLocation, HitNormal, NormalImpulse, Hit); }
void ACoverageCharacter::PossessedBy(AController* NewController) { Super::PossessedBy(NewController); if (APlayerState* PS = GetPlayerState()) PS->SetScore(0.f); }
void ACoverageCharacter::EndPlay(const EEndPlayReason::Type EndPlayReason) { GetWorldTimerManager().ClearAllTimersForObject(this); Super::EndPlay(EndPlayReason); }
void ACoverageCharacter::OnRep_Mode(ECoverageMode OldMode) { UE_LOG(LogCoverage, Log, TEXT("%s -> %s"), *UEnum::GetValueAsString(OldMode), *UEnum::GetValueAsString(Mode)); }
void ACoverageCharacter::OnCapsuleHit(UPrimitiveComponent* HitComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit) {}
void ACoverageCharacter::OnCapsuleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex) {}
bool ACoverageCharacter::ServerShoot_Validate(const FVector_NetQuantize& TargetLocation) { return true; }
void ACoverageCharacter::ServerShoot_Implementation(const FVector_NetQuantize& TargetLocation) { MulticastImpact(TargetLocation); }
void ACoverageCharacter::MulticastImpact_Implementation(FVector_NetQuantize Location) {}
void ACoverageCharacter::ClientNotify_Implementation(const FString& Message) {}
void ACoverageCharacter::OnScored_Implementation(int32 Points) { OnCoverageScored.Broadcast(this, Points); }

void ACoverageCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ACoverageCharacter, Mode);
    DOREPLIFETIME_CONDITION(ACoverageCharacter, Stats, COND_OwnerOnly);
    DOREPLIFETIME_CONDITION_NOTIFY(ACoverageCharacter, Ammo, COND_SkipOwner, REPNOTIFY_Always);
}

void ACoverageController::SetupInputComponent()
{
    Super::SetupInputComponent();
    bShowMouseCursor = false;
    SetInputMode(FInputModeGameOnly());
}
void ACoverageController::OnPossess(APawn* InPawn) { Super::OnPossess(InPawn); SetViewTargetWithBlend(InPawn, .5f); }
void ACoverageController::PlayerTick(float DeltaTime)
{
    Super::PlayerTick(DeltaTime);
    FVector WorldLocation, WorldDirection;
    float MouseX = 0.f, MouseY = 0.f;
    if (GetMousePosition(MouseX, MouseY)) DeprojectScreenPositionToWorld(MouseX, MouseY, WorldLocation, WorldDirection);
    FVector2D ScreenPos;
    ProjectWorldLocationToScreen(FVector::ZeroVector, ScreenPos);
    if (IsInputKeyDown(EKeys::LeftShift) || WasInputKeyJustPressed(EKeys::SpaceBar)) { AddYawInput(1.f); }
    int32 SizeX = 0, SizeY = 0;
    GetViewportSize(SizeX, SizeY);
}

void ACoverageHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas) return;
    const float W = Canvas->SizeX, H = Canvas->SizeY;
    DrawRect(FLinearColor(0.f, 0.f, 0.f, .5f), 10.f, 10.f, 200.f, 40.f);
    DrawText(TEXT("WANTED"), FLinearColor::White, 20.f, 20.f, GEngine->GetLargeFont(), 1.f);
    DrawLine(W * .5f - 10.f, H * .5f, W * .5f + 10.f, H * .5f, FLinearColor::Green, 2.f);
    FCanvasTextItem Text(FVector2D(30.f, 60.f), FText::FromString(TEXT("$100")), GEngine->GetMediumFont(), FLinearColor::Yellow);
    Text.Scale = FVector2D(1.5f, 1.5f);
    Text.bOutlined = true;
    Canvas->DrawItem(Text);
    FCanvasTileItem Tile(FVector2D(0.f, 0.f), FVector2D(W, 4.f), FLinearColor::Red);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
    float TW = 0.f, TH = 0.f;
    GetTextSize(TEXT("WANTED"), TW, TH, GEngine->GetSmallFont());
    Canvas->K2_DrawText(GEngine->GetSmallFont(), TEXT("hi"), FVector2D(5.f, 5.f), FVector2D(1.f, 1.f), FLinearColor::White);
}

ACoverageGameMode::ACoverageGameMode()
{
    DefaultPawnClass = ACoverageCharacter::StaticClass();
    PlayerControllerClass = ACoverageController::StaticClass();
    HUDClass = ACoverageHUD::StaticClass();
}
void ACoverageGameMode::PostLogin(APlayerController* NewPlayer) { Super::PostLogin(NewPlayer); }
AActor* ACoverageGameMode::ChoosePlayerStart_Implementation(AController* Player)
{
    for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It) return *It;
    return Super::ChoosePlayerStart_Implementation(Player);
}
