#include "QuebecCampaign.h"
#include "QuebecGameplay.h"
#include "QuebecSky.h"

#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerState.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Net/UnrealNetwork.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    constexpr float LightRadius = 220.f;
    constexpr float ClampRadius = 180.f;
    constexpr float AimHoldSeconds = 1.2f;

    FVector SampleRoute(const TArray<FVector>& Route, float Distance, FVector* Direction = nullptr)
    {
        for (int32 Index = 1; Index < Route.Num(); ++Index)
        {
            const FVector Delta = Route[Index] - Route[Index-1];
            const float Length = Delta.Size();
            if (Distance <= Length || Index == Route.Num()-1)
            {
                if (Direction) *Direction = Delta.GetSafeNormal();
                return Route[Index-1] + Delta * FMath::Clamp(Distance / FMath::Max(Length, 1.f), 0.f, 1.f);
            }
            Distance -= Length;
        }
        if (Direction) *Direction = FVector::ForwardVector;
        return Route.IsEmpty() ? FVector::ZeroVector : Route.Last();
    }

    FVector RightOf(const FVector& Direction)
    {
        return FVector(-Direction.Y, Direction.X, 0.).GetSafeNormal();
    }
}

AQuebecCampaign::AQuebecCampaign()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = .05f;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetNetUpdateFrequency(10.f);
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("CampaignRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cube = CubeAsset.Object;
    Sphere = SphereAsset.Object;
    Cylinder = CylinderAsset.Object;
    SetupRaceRoute();
}

void AQuebecCampaign::SetupRaceRoute()
{
    // A short surveyed street loop, not a straight shortcut across park paths.
    RaceRoute = {
        FVector(35028.68,-20083.24,102.), FVector(32619.55,-23320.43,102.),
        FVector(31324.13,-25179.47,102.), FVector(30945.88,-25893.03,102.),
        FVector(30099.68,-27792.15,102.), FVector(31623.62,-26438.50,102.),
        FVector(32145.37,-26184.69,102.), FVector(32701.44,-26175.78,102.),
        FVector(33071.12,-26269.29,102.), FVector(34038.20,-26899.36,102.),
        FVector(34097.48,-26283.77,102.), FVector(34351.73,-24550.51,102.),
        FVector(34744.80,-21691.82,102.), FVector(35028.68,-20083.24,102.)
    };
    float Length = 0.f;
    for (int32 Index=1; Index<RaceRoute.Num(); ++Index) Length += FVector::Dist(RaceRoute[Index-1],RaceRoute[Index]);
    GateDistances = {900.f,4200.f,8500.f,10800.f,14500.f,18200.f,Length+900.f};
    RaceGates.Reset();
    RaceDirections.Reset();
    for (float Distance : GateDistances)
    {
        FVector Direction;
        RaceGates.Add(SampleRoute(RaceRoute,FMath::Fmod(Distance,Length),&Direction));
        RaceDirections.Add(Direction);
    }
    const FVector Right = RightOf(RaceDirections[5]);
    TrapLocation = RaceGates[5] - Right*250.f;
    RaceGates[5] += Right*300.f;
    FVector Direction;
    RivalDistance = GateDistances[0]+180.f;
    RivalLocation = SampleRoute(RaceRoute,RivalDistance,&Direction);
    RivalYaw = Direction.Rotation().Yaw;
}

void AQuebecCampaign::BeginPlay()
{
    Super::BeginPlay();
    BuildEncounter();
    if (HasAuthority())
    {
        if (!FParse::Param(FCommandLine::Get(),TEXT("NordNoCampaignSave")) &&
            UGameplayStatics::DoesSaveGameExist(SaveSlot(),0))
        {
            const UQuebecCampaignSaveGame* Save = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromSlot(SaveSlot(),0));
            if (Save && Save->IsSupported())
            {
                CompletedMissions = Save->CompletedMissions;
                Phase = CompletedMissions == 2 ? EQuebecCampaignPhase::Complete :
                    CompletedMissions == 1 ? EQuebecCampaignPhase::RaceReady : EQuebecCampaignPhase::AimWorklight;
            }
            else
            {
                bSaveBlocked = true;
                SaveStatus = TEXT("Save unreadable; session progress only");
                UE_LOG(LogTemp,Warning,TEXT("NORD campaign: preserving unsupported/unreadable save slot %s"),*SaveSlot());
            }
        }
        const auto SpawnCar = [this](const FVector& Location, const FRotator& Rotation, int32 Paint)
        {
            const FTransform Transform(Rotation,Location);
            AQuebecCar* Car = GetWorld()->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(),Transform,
                nullptr,nullptr,ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButDontSpawnIfColliding);
            if (Car)
            {
                Car->PaintStyle = Paint;
                Car->BodyProfile = 1;
                Car->Tags.Add(TEXT("CampaignLoan"));
                Car->FinishSpawning(Transform);
            }
            return Car;
        };
        LightCar = SpawnCar(FVector(5550.,1700.,102.),FRotator(0.,90.,0.),4);
        const FVector Start = RaceGates[0] - RaceDirections[0]*650.f + RightOf(RaceDirections[0])*145.f;
        LoanCar = SpawnCar(Start,RaceDirections[0].Rotation(),2);
    }
    UpdatePresentation();
}

UStaticMeshComponent* AQuebecCampaign::AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point,
    const FVector& Size, const TCHAR* Material, bool bBlocking, USceneComponent* Parent)
{
    UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(this,Name);
    AddInstanceComponent(Part);
    Part->SetupAttachment(Parent ? Parent : Scene.Get());
    Part->SetStaticMesh(Mesh);
    Part->SetRelativeLocation(Point);
    Part->SetRelativeScale3D(Size/100.f);
    Part->SetMobility(EComponentMobility::Movable);
    Part->SetCollisionProfileName(bBlocking ? TEXT("BlockAll") : TEXT("NoCollision"));
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr,Material)) Part->SetMaterial(0,Mat);
    Part->RegisterComponent();
    return Part;
}

UTextRenderComponent* AQuebecCampaign::AddCaption(FName Name, const FVector& Point, const FString& Text, float Size)
{
    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this,Name);
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(Point);
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetWorldSize(Size);
    Caption->SetText(FText::FromString(Text));
    Caption->SetTextRenderColor(FColor(255,238,193));
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Text.M_Text"))) Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
    return Caption;
}

void AQuebecCampaign::BuildEncounter()
{
    if (bBuilt) return;
    bBuilt = true;
    const TCHAR* Ink = TEXT("/Game/ParkComic/M_Ink.M_Ink");
    const TCHAR* Gold = TEXT("/Game/ParkComic/M_Gold.M_Gold");
    const TCHAR* Cream = TEXT("/Game/ParkComic/M_Cream.M_Cream");
    const TCHAR* Berry = TEXT("/Game/ParkComic/M_Berry.M_Berry");
    const TCHAR* Lime = TEXT("/Game/ParkComic/M_Lime.M_Lime");
    AddPart(TEXT("LightTripod"),Cylinder,WorklightLocation-FVector(0.,0.,35.),FVector(18.,18.,110.),Ink);
    AddPart(TEXT("LightFoot"),Cube,FVector(WorklightLocation.X,WorklightLocation.Y,8.),FVector(100.,75.,16.),Gold);
    LampPivot = NewObject<USceneComponent>(this,TEXT("LightPivot"));
    AddInstanceComponent(LampPivot);
    LampPivot->SetupAttachment(Scene);
    LampPivot->SetRelativeLocation(WorklightLocation);
    LampPivot->RegisterComponent();
    AddPart(TEXT("WorklightHousing"),Cube,FVector::ZeroVector,FVector(30.,60.,45.),Gold,false,LampPivot);
    Worklight = NewObject<USpotLightComponent>(this,TEXT("PuzzleSpotlight"));
    AddInstanceComponent(Worklight);
    Worklight->SetupAttachment(LampPivot);
    Worklight->SetIntensity(300000.f);
    Worklight->SetAttenuationRadius(2000.f);
    Worklight->SetInnerConeAngle(4.f);
    Worklight->SetOuterConeAngle(9.f);
    Worklight->SetCastShadows(false);
    Worklight->RegisterComponent();
    LightRay = AddPart(TEXT("LightAimRay"),Cylinder,WorklightLocation,FVector(3.,3.,1400.),Cream);
    CarRay = AddPart(TEXT("CarLightRay"),Cylinder,CarLightLocation,FVector(4.,4.,1300.),Cream);
    LampCaption = AddCaption(TEXT("LightInstruction"),WorklightLocation+FVector(0.,0.,140.),TEXT("WORKLIGHT\nE / AIM WITH MOUSE"),14.f);

    // This low, swept obstacle requires an actual jump; the rest is nonblocking proxy art.
    AddPart(TEXT("CableRamp"),Cube,FVector(JumpGateLocation.X,JumpGateLocation.Y,27.5),FVector(300.,40.,55.),Gold,true);
    AddPart(TEXT("CableStripe"),Cube,FVector(JumpGateLocation.X,JumpGateLocation.Y,56.),FVector(300.,42.,3.),Ink);
    AddCaption(TEXT("SprintJumpHint"),JumpGateLocation+FVector(0.,0.,160.),TEXT("SHIFT / SPRINT + SPACE / JUMP"),14.f);

    for (int32 Index=0; Index<2; ++Index)
    {
        const FVector Point = Index == 0 ? FirstClampLocation : FinalClampLocation;
        UStaticMeshComponent* Clamp = AddPart(Index == 0 ? TEXT("FirstClamp") : TEXT("FinalClamp"),Sphere,Point,FVector(48.,48.,48.),Berry);
        if (Index == 0) FirstClamp = Clamp; else FinalClamp = Clamp;
        PressParts.Add(AddPart(*FString::Printf(TEXT("PressPost%d"),Index),Cube,Point+FVector(100.,0.,0.),FVector(25.,30.,260.),Ink));
        PressParts.Add(AddPart(*FString::Printf(TEXT("PressArm%d"),Index),Cube,Point+FVector(-30.,0.,100.),FVector(250.,45.,30.),Gold));
    }
    ClampCaption = AddCaption(TEXT("ClampInstruction"),FirstClampLocation+FVector(0.,0.,160.),TEXT("LIGHT THE GOLD SEAM"),14.f);
    AddCaption(TEXT("FinalClampHint"),FinalClampLocation+FVector(0.,0.,180.),TEXT("TABLE RELEASE / E"),14.f);
    for (int32 Index=0; Index<3; ++Index)
    {
        const FVector Base(5750.+Index*100.,3440.,0.);
        Cutouts.Add(AddPart(*FString::Printf(TEXT("PaperGuest%d"),Index),Cube,Base+FVector(0.,0.,85.),FVector(65.,10.,130.),Cream));
        Cutouts.Add(AddPart(*FString::Printf(TEXT("PaperGuestHead%d"),Index),Sphere,Base+FVector(0.,0.,170.),FVector(55.,20.,55.),Gold));
    }
    AddPart(TEXT("PressTable"),Cube,FVector(5870.,3440.,55.),FVector(380.,90.,25.),Berry);
    AddPart(TEXT("CollectorSlotFrame"),Cube,FVector(5250.,3270.,150.),FVector(90.,35.,150.),Gold);
    AddPart(TEXT("CollectorSlotMouth"),Cube,FVector(5250.,3249.,180.),FVector(70.,5.,18.),Ink);
    AddCaption(TEXT("CollectorSlotLabel"),FVector(5250.,3270.,260.),TEXT("ONE PERFECT MOMENT"),12.f);
    Souvenir = AddPart(TEXT("CapturedSouvenir"),Cube,FVector(5870.,3440.,170.),FVector(65.,4.,45.),Cream);
    Souvenir->SetVisibility(false);
    const FVector BayDirection = (FinalClampLocation-CarLightLocation).GetSafeNormal2D();
    const FVector BayRight = RightOf(BayDirection);
    for (int32 Side : {-1,1})
    {
        UStaticMeshComponent* Stripe = AddPart(*FString::Printf(TEXT("LightBay%d"),Side),Cube,
            FVector(CarLightLocation.X,CarLightLocation.Y,4.)+BayRight*135.f*Side,FVector(520.,8.,5.),Lime);
        Stripe->SetRelativeRotation(BayDirection.Rotation());
    }
    UStaticMeshComponent* Arrow = AddPart(TEXT("LightBayArrow"),Cube,FVector(CarLightLocation.X,CarLightLocation.Y,5.),FVector(180.,30.,6.),Gold);
    Arrow->SetRelativeRotation(BayDirection.Rotation());
    BayCaption = AddCaption(TEXT("LightBayInstruction"),CarLightLocation+FVector(0.,0.,250.),TEXT("PARK / AIM CAR AT TABLE"),14.f);

    Plunger = NewObject<USceneComponent>(this,TEXT("SharedPlungerTool"));
    AddInstanceComponent(Plunger);
    Plunger->SetupAttachment(Scene);
    Plunger->SetRelativeRotation(FRotator(0.,0.,90.));
    Plunger->RegisterComponent();
    AddPart(TEXT("PlungerCup"),Sphere,FVector::ZeroVector,FVector(48.,48.,24.),Berry,false,Plunger);
    AddPart(TEXT("PlungerHandle"),Cylinder,FVector(0.,0.,65.),FVector(7.,7.,125.),TEXT("/Game/ParkComic/M_Wood.M_Wood"),false,Plunger);
    AddPart(TEXT("PlungerGrip"),Sphere,FVector(0.,0.,132.),FVector(16.,16.,16.),Gold,false,Plunger);
    Plunger->SetVisibility(false,true);

    UMaterialInstanceDynamic* Blue = UMaterialInstanceDynamic::Create(LoadObject<UMaterialInterface>(nullptr,Cream),this);
    UMaterialInstanceDynamic* Purple = UMaterialInstanceDynamic::Create(LoadObject<UMaterialInterface>(nullptr,Berry),this);
    if (Blue) Blue->SetVectorParameterValue(TEXT("Tint"),FLinearColor(.04f,.42f,.95f));
    if (Purple) Purple->SetVectorParameterValue(TEXT("Tint"),FLinearColor(.3f,.015f,.5f));
    for (int32 Index=0; Index<RaceGates.Num(); ++Index)
    {
        // Finish shares the start arch. Every other gate has a separate number.
        if (Index == RaceGates.Num()-1) continue;
        const float HalfWidth = Index == 5 ? 170.f : 300.f;
        const FVector Right = RightOf(RaceDirections[Index]);
        for (int32 Side : {-1,1})
            GateParts.Add(AddPart(*FString::Printf(TEXT("Gate%dPost%d"),Index,Side),Cube,
                FVector(RaceGates[Index].X,RaceGates[Index].Y,180.)+Right*(HalfWidth+45.f)*Side,FVector(35.,35.,360.),Gold));
        UStaticMeshComponent* Beam = AddPart(*FString::Printf(TEXT("Gate%dBeam"),Index),Cube,
            FVector(RaceGates[Index].X,RaceGates[Index].Y,350.),FVector(35.,2.f*(HalfWidth+60.f),30.),Lime);
        Beam->SetRelativeRotation(RaceDirections[Index].Rotation());
        if (Blue) Beam->SetMaterial(0,Blue);
        GateParts.Add(Beam);
        const FVector ArrowTip = FVector(RaceGates[Index].X,RaceGates[Index].Y,6.)-RaceDirections[Index]*350.f;
        for (int32 Side : {-1,1})
        {
            UStaticMeshComponent* Chevron = AddPart(*FString::Printf(TEXT("Gate%dArrow%d"),Index,Side),Cube,
                ArrowTip-RaceDirections[Index]*60.f+Right*60.f*Side,FVector(180.,20.,8.),Cream);
            Chevron->SetRelativeRotation(RaceDirections[Index].Rotation()+FRotator(0.,-45.f*Side,0.));
            if (Blue) Chevron->SetMaterial(0,Blue);
            GateParts.Add(Chevron);
        }
        GateCaptions.Add(AddCaption(*FString::Printf(TEXT("Gate%dCaption"),Index),
            RaceGates[Index]+FVector(0.,0.,330.),Index == 0 ? TEXT("BLUE / START + FINISH") : FString::Printf(TEXT("BLUE / %d"),Index),32.f));
    }
    UStaticMeshComponent* InkTrap = AddPart(TEXT("InkTrap"),Cylinder,FVector(TrapLocation.X,TrapLocation.Y,4.),FVector(450.,450.,6.),Berry);
    if (Purple) InkTrap->SetMaterial(0,Purple);
    AddCaption(TEXT("TrapWarning"),TrapLocation+FVector(0.,0.,220.),TEXT("PERFECT LINE?\nINK TRAP / TAKE BLUE"),26.f);

    // A projection rival gives a visible pace reference without blocking city traffic.
    Rival = NewObject<USceneComponent>(this,TEXT("PromotionalProjection"));
    AddInstanceComponent(Rival);
    Rival->SetupAttachment(Scene);
    Rival->RegisterComponent();
    AddPart(TEXT("ProjectionBody"),Cube,FVector(0.,0.,0.),FVector(410.,190.,65.),Berry,false,Rival);
    AddPart(TEXT("ProjectionCabin"),Cube,FVector(-20.,0.,58.),FVector(190.,160.,65.),Ink,false,Rival);
    AddPart(TEXT("ProjectionBanner"),Cube,FVector(-30.,0.,120.),FVector(230.,15.,55.),Gold,false,Rival);
    for (int32 X : {-140,140}) for (int32 Y : {-95,95})
        AddPart(*FString::Printf(TEXT("ProjectionWheel%d_%d"),X,Y),Sphere,FVector(X,Y,-25.),FVector(65.,35.,65.),Ink,false,Rival);
}

void AQuebecCampaign::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (HasAuthority())
    {
        bClampOpen = FMath::Fmod(GetWorld()->GetTimeSeconds(),6.f) < 2.5f;
        if (Phase <= EQuebecCampaignPhase::ReleaseTable) TickTerrace(DeltaSeconds);
        if (Phase == EQuebecCampaignPhase::RaceReady || Phase == EQuebecCampaignPhase::RaceRunning) TickRace(DeltaSeconds);
    }
    if (GetWorld()->GetTimeSeconds()-LastPresentationTime >= .1f)
    {
        LastPresentationTime = GetWorld()->GetTimeSeconds();
        UpdatePresentation();
    }
}

bool AQuebecCampaign::CanReach(const AQuebecController* Controller, const FVector& Point, float Radius) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character || FVector::DistSquared(Character->GetActorLocation(),Point) > FMath::Square(Radius)) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CampaignInteract),false,Character);
    Query.AddIgnoredActor(this);
    FHitResult Hit;
    return !GetWorld()->LineTraceSingleByChannel(Hit,Character->GetActorLocation()+FVector(0.,0.,35.),Point,ECC_Visibility,Query);
}

bool AQuebecCampaign::IsAimingLight(const AQuebecController* Controller) const
{
    return Controller && Phase == EQuebecCampaignPhase::AimWorklight && LightOperator && LightOperator == Controller->PlayerState;
}

void AQuebecCampaign::LightAim(AQuebecController* Controller, float Yaw, float Pitch)
{
    if (!HasAuthority() || !IsAimingLight(Controller) || !CanReach(Controller,WorklightLocation,LightRadius+60.f) ||
        !FMath::IsFinite(Yaw) || !FMath::IsFinite(Pitch)) return;
    LightYaw = FRotator::NormalizeAxis(Yaw);
    LightPitch = FMath::Clamp(FRotator::NormalizeAxis(Pitch),-55.f,50.f);
    LastAimTime = GetWorld()->GetTimeSeconds();
}

void AQuebecCampaign::StopAiming()
{
    ActiveLightController.Reset();
    LightOperator = nullptr;
    LightHold = 0.f;
    LightHoldProgress = 0.f;
}

void AQuebecCampaign::ReleaseBrowserInput(AQuebecController* Controller)
{
    if (HasAuthority() && IsAimingLight(Controller))
    {
        StopAiming();
        ForceNetUpdate();
    }
}

void AQuebecCampaign::TickTerrace(float DeltaSeconds)
{
    if (Phase == EQuebecCampaignPhase::AimWorklight)
    {
        AQuebecController* Controller = ActiveLightController.Get();
        if (LightOperator && (!Controller || !CanReach(Controller,WorklightLocation,LightRadius+60.f) || GetWorld()->GetTimeSeconds()-LastAimTime > .6f)) StopAiming();
        const FVector TargetDirection = (FirstClampLocation-WorklightLocation).GetSafeNormal();
        const float Dot = FVector::DotProduct(FRotator(LightPitch,LightYaw,0.f).Vector(),TargetDirection);
        LightAlignment = FMath::Clamp((Dot-.94f)/.055f,0.f,1.f);
        FCollisionQueryParams Query(SCENE_QUERY_STAT(CampaignLight),false,this);
        FHitResult Hit;
        const bool bClear = !GetWorld()->LineTraceSingleByChannel(Hit,WorklightLocation,FirstClampLocation,ECC_Visibility,Query);
        if (ActiveLightController.IsValid() && Dot >= .995f && bClear) LightHold += DeltaSeconds;
        else LightHold = 0.f;
        LightHoldProgress = FMath::Clamp(LightHold/AimHoldSeconds,0.f,1.f);
        if (LightHold >= AimHoldSeconds) { StopAiming(); ChangePhase(EQuebecCampaignPhase::CrossCable); }
    }
    else if (Phase == EQuebecCampaignPhase::CrossCable)
    {
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        {
            AQuebecController* Controller = *It;
            AQuebecCharacter* Character = Cast<AQuebecCharacter>(Controller->GetPawn());
            if (!Character) { LastWalkerPositions.Remove(Controller); continue; }
            const FVector Position = Character->GetActorLocation();
            const FVector* Previous = LastWalkerPositions.Find(Controller);
            if (FMath::Abs(Position.X-JumpGateLocation.X)<230.f && FMath::Abs(Position.Y-JumpGateLocation.Y)<600.f)
            {
                if (Character->GetVelocity().Size2D()>550.f) bSprintSeen = true;
                if (Previous && Previous->Y<JumpGateLocation.Y && Position.Y>=JumpGateLocation.Y &&
                    FVector::Dist(*Previous,Position)<250.f && Position.Z>145.f && Character->GetCharacterMovement()->IsFalling()) bJumpSeen = true;
            }
            LastWalkerPositions.Add(Controller,Position);
        }
        if (bSprintSeen && bJumpSeen) ChangePhase(EQuebecCampaignPhase::PullClamp);
    }
    else if (Phase == EQuebecCampaignPhase::ParkCarLight)
    {
        AQuebecCar* Aligned = nullptr;
        const FVector DesiredDirection = (FinalClampLocation-CarLightLocation).GetSafeNormal2D();
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        {
            if (It->Occupant && Cast<AQuebecController>(It->GetController()) &&
                FVector::Dist2D(It->GetActorLocation(),CarLightLocation)<220.f && FMath::Abs(It->Speed)<30.f &&
                FVector::DotProduct(It->GetActorForwardVector(),DesiredDirection)>.97f) { Aligned = *It; break; }
        }
        if (Aligned) { LightCar = Aligned; LightHold += DeltaSeconds; }
        else LightHold = 0.f;
        if (LightHold >= .8f) { LightHold = 0.f; ChangePhase(EQuebecCampaignPhase::ReleaseTable); }
    }
}

bool AQuebecCampaign::CarLightAligned() const
{
    if (!IsValid(LightCar) || FVector::Dist2D(LightCar->GetActorLocation(),CarLightLocation)>250.f || FMath::Abs(LightCar->Speed)>60.f) return false;
    if (FVector::DotProduct(LightCar->GetActorForwardVector(),(FinalClampLocation-LightCar->GetActorLocation()).GetSafeNormal2D())<=.97f) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CampaignCarLight),false,this);
    Query.AddIgnoredActor(LightCar);
    if (LightCar->Occupant) Query.AddIgnoredActor(LightCar->Occupant);
    FHitResult Hit;
    return !GetWorld()->LineTraceSingleByChannel(Hit,LightCar->GetActorLocation()+FVector(0.,0.,65.),FinalClampLocation,ECC_Visibility,Query);
}

bool AQuebecCampaign::HandleInteract(AQuebecController* Controller)
{
    if (!HasAuthority() || !Controller) return false;
    if (Phase == EQuebecCampaignPhase::AimWorklight && CanReach(Controller,WorklightLocation,LightRadius))
    {
        if (LightOperator && !IsAimingLight(Controller)) Controller->ShowInteractionMessage(TEXT("A friend is aiming. Hold the gold seam in the beam."));
        else if (IsAimingLight(Controller)) { StopAiming(); Controller->ShowInteractionMessage(TEXT("Worklight released.")); }
        else
        {
            ActiveLightController = Controller;
            LightOperator = Controller->PlayerState;
            LastAimTime = GetWorld()->GetTimeSeconds();
            const FRotator Rotation = Controller->GetControlRotation();
            LightYaw = Rotation.Yaw;
            LightPitch = FMath::Clamp(FRotator::NormalizeAxis(Rotation.Pitch),-55.f,50.f);
            Controller->ShowInteractionMessage(TEXT("Mouse: aim at the gold clamp. Hold steady until the seam opens. E releases."));
        }
        ForceNetUpdate();
        return true;
    }
    if ((Phase == EQuebecCampaignPhase::CrossCable || Phase == EQuebecCampaignPhase::PullClamp) && CanReach(Controller,FirstClampLocation,ClampRadius))
    {
        if (Phase == EQuebecCampaignPhase::CrossCable) Controller->ShowInteractionMessage(TEXT("Build momentum: sprint and jump the striped cable first."));
        else if (!bClampOpen) Controller->ShowInteractionMessage(TEXT("The press is squeezing. Wait for the green release beat."));
        else
        {
            PlungerPoint = FirstClampLocation;
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            ChangePhase(EQuebecCampaignPhase::ParkCarLight);
            Controller->ShowInteractionMessage(TEXT("First clamp banked. Park a car in the lime bay, nose toward the table."));
        }
        return true;
    }
    if (Phase == EQuebecCampaignPhase::ReleaseTable && CanReach(Controller,FinalClampLocation,ClampRadius))
    {
        if (!CarLightAligned()) Controller->ShowInteractionMessage(TEXT("Keep the car parked in the lime bay and aimed at the table."));
        else if (!bClampOpen) Controller->ShowInteractionMessage(TEXT("Wait for the green release beat, then pull."));
        else
        {
            PlungerPoint = FinalClampLocation;
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            CompletedMissions = FMath::Max(CompletedMissions,1);
            SaveBoundary();
            ChangePhase(EQuebecCampaignPhase::RaceReady);
            Controller->ShowInteractionMessage(TEXT("The table unfolds! Curator's projection challenges you on the streets. R takes you to the start."));
        }
        return true;
    }
    return false;
}

void AQuebecCampaign::TickRace(float DeltaSeconds)
{
    const float Now = GetWorld()->GetTimeSeconds();
    if (Phase == EQuebecCampaignPhase::RaceRunning)
    {
        RaceElapsed = Now-RaceStartTime;
        RivalDistance = FMath::Min(RivalDistance+600.f*DeltaSeconds,GateDistances[5]-150.f);
        FVector Direction;
        RivalLocation = SampleRoute(RaceRoute,RivalDistance,&Direction);
        RivalYaw = Direction.Rotation().Yaw;
        if (RaceElapsed > RaceTimeLimit)
        {
            bRaceTimedOut = true;
            ChangePhase(EQuebecCampaignPhase::RaceReady);
            LastCarPositions.Reset();
            return;
        }
    }
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        AQuebecCar* Car = *It;
        if (!Car->Occupant || !Cast<AQuebecController>(Car->GetController())) continue;
        const FVector Position = Car->GetActorLocation();
        const FVector* Previous = LastCarPositions.Find(Car);
        const int32 Index = Phase == EQuebecCampaignPhase::RaceReady ? 0 : RaceGateIndex;
        if (Phase == EQuebecCampaignPhase::RaceRunning && Index == 5)
        {
            if (FVector::Dist2D(Position,TrapLocation)<230.f && !TrappedUntil.Contains(Car)) TrappedUntil.Add(Car,Now+1.2f);
            if (const float* Until = TrappedUntil.Find(Car))
            {
                if (Now<*Until) Car->ResetMotion();
                else if (FVector::Dist2D(Position,TrapLocation)>350.f) TrappedUntil.Remove(Car);
            }
        }
        if (Previous && RaceGates.IsValidIndex(Index) && !bRaceTimedOut)
        {
            const FVector Direction = RaceDirections[Index];
            const float Before = FVector::DotProduct(*Previous-RaceGates[Index],Direction);
            const float After = FVector::DotProduct(Position-RaceGates[Index],Direction);
            const float Width = Index == 5 ? 170.f : 300.f;
            if (Before<0.f && After>=0.f && FVector::Dist(*Previous,Position)<1800.f && Car->Speed>100.f &&
                FVector::DotProduct(Car->GetActorForwardVector(),Direction)>.5f)
            {
                const FVector Crossing = FMath::Lerp(*Previous,Position,Before/(Before-After));
                if (FMath::Abs(FVector::DotProduct(Crossing-RaceGates[Index],RightOf(Direction)))<=Width)
                {
                    if (Phase == EQuebecCampaignPhase::RaceReady)
                    {
                        RaceGateIndex = 1;
                        RaceStartTime = Now;
                        RaceElapsed = 0.f;
                        RivalDistance = GateDistances[0]+180.f;
                        ChangePhase(EQuebecCampaignPhase::RaceRunning);
                    }
                    else if (++RaceGateIndex >= RaceGates.Num())
                    {
                        CompletedMissions = 2;
                        bRaceWonThisSession = true;
                        SaveBoundary();
                        ChangePhase(EQuebecCampaignPhase::Complete);
                    }
                    ForceNetUpdate();
                }
            }
        }
        LastCarPositions.Add(Car,Position);
    }
    for (auto It=LastCarPositions.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
    for (auto It=TrappedUntil.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
}

void AQuebecCampaign::ChangePhase(EQuebecCampaignPhase Next)
{
    Phase = Next;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->ShowInteractionMessage(TEXT(""));
    if (Next == EQuebecCampaignPhase::RaceReady)
    {
        FVector Direction;
        RivalDistance = GateDistances[0]+180.f;
        RivalLocation = SampleRoute(RaceRoute,RivalDistance,&Direction);
        RivalYaw = Direction.Rotation().Yaw;
    }
    UpdatePresentation();
    ForceNetUpdate();
}

FString AQuebecCampaign::SaveSlot() const
{
    return FParse::Param(FCommandLine::Get(),TEXT("NordCampaignQA")) ? TEXT("NordCampaign_StorySliceQA_v1") : TEXT("NordCampaign_v1");
}

void AQuebecCampaign::SaveBoundary()
{
    if (FParse::Param(FCommandLine::Get(),TEXT("NordNoCampaignSave"))) return;
    if (bSaveBlocked) return;
    UQuebecCampaignSaveGame* Save = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::CreateSaveGameObject(UQuebecCampaignSaveGame::StaticClass()));
    if (Save) { Save->Version=1; Save->CompletedMissions=CompletedMissions; }
    if (!Save || !UGameplayStatics::SaveGameToSlot(Save,SaveSlot(),0))
    {
        SaveStatus = TEXT("SAVE FAILED / session progress retained");
        UE_LOG(LogTemp,Warning,TEXT("NORD campaign boundary save failed: %s"),*SaveSlot());
    }
    else SaveStatus.Empty();
}

bool AQuebecCampaign::MoveToSafeCheckpoint(AQuebecController* Controller, const FVector& Point, const FRotator& Rotation)
{
    APawn* Pawn = Controller ? Controller->GetPawn() : nullptr;
    if (!HasAuthority() || !Pawn) return false;
    AQuebecCar* Car = Cast<AQuebecCar>(Pawn);
    AQuebecCharacter* Character = Cast<AQuebecCharacter>(Pawn);
    if (!Car && !Character) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(CampaignRecovery),false,Pawn);
    Query.AddIgnoredActor(this);
    if (Car && Car->Occupant) Query.AddIgnoredActor(Car->Occupant);
    const FVector Right = Rotation.RotateVector(FVector::RightVector);
    const FVector Forward = Rotation.Vector();
    const TArray<FVector> Offsets = {FVector::ZeroVector,Right*350.f,-Right*350.f,Forward*500.f,-Forward*500.f};
    for (const FVector& Offset : Offsets)
    {
        const FVector Candidate = Point+Offset;
        FHitResult Floor;
        if (!GetWorld()->LineTraceSingleByChannel(Floor,Candidate+FVector(0.,0.,500.),Candidate-FVector(0.,0.,500.),ECC_Visibility,Query) || Floor.ImpactNormal.Z<.8f) continue;
        const FVector Destination(Floor.ImpactPoint.X,Floor.ImpactPoint.Y,Floor.ImpactPoint.Z+(Car?102.f:100.f));
        if (Car ? !Car->CanFitAt(Destination,Rotation.Quaternion(),this) :
            GetWorld()->OverlapBlockingTestByChannel(Destination,FQuat::Identity,ECC_Pawn,FCollisionShape::MakeCapsule(42.f,96.f),Query)) continue;
        if (Car) Car->ResetMotion(); else Character->GetCharacterMovement()->StopMovementImmediately();
        if (!Pawn->SetActorLocationAndRotation(Destination,Rotation,false,nullptr,ETeleportType::TeleportPhysics)) continue;
        if (Car) { Car->ResetMotion(); LastCarPositions.Remove(Car); TrappedUntil.Remove(Car); }
        LastWalkerPositions.Remove(Controller);
        Controller->SetControlRotation(Rotation);
        Controller->ClientSetRotation(Rotation,true);
        return true;
    }
    Controller->ShowInteractionMessage(TEXT("Checkpoint occupied. Move a little and press R again."));
    return false;
}

void AQuebecCampaign::RequestRetry(AQuebecController* Controller)
{
    if (!HasAuthority() || !Controller || !Controller->GetPawn()) return;
    if (Phase == EQuebecCampaignPhase::Complete) { Controller->ShowInteractionMessage(TEXT("Both scenes are banked. T replays the race.")); return; }
    if (Phase <= EQuebecCampaignPhase::ReleaseTable)
    {
        if (IsAimingLight(Controller)) StopAiming();
        FVector Point = WorklightLocation-FVector(0.,260.,0.);
        if (Cast<AQuebecCar>(Controller->GetPawn())) Point = CarLightLocation-FVector(0.,500.,0.);
        else if (Phase == EQuebecCampaignPhase::PullClamp) Point = FirstClampLocation-FVector(0.,220.,0.);
        else if (Phase >= EQuebecCampaignPhase::ParkCarLight) Point = CarLightLocation+FVector(350.,0.,0.);
        if (MoveToSafeCheckpoint(Controller,Point,FRotator(0.,90.,0.))) Controller->ShowInteractionMessage(TEXT("Terrace checkpoint restored. Completed steps stay banked."));
        return;
    }
    const int32 Gate = FMath::Clamp(RaceGateIndex-1,0,RaceGates.Num()-1);
    const FVector Point = RaceGates[Gate]-RaceDirections[Gate]*650.f;
    const FVector CarPoint = Point+RightOf(RaceDirections[Gate])*145.f;
    const FRotator Rotation = RaceDirections[Gate].Rotation();
    if (AQuebecCharacter* Character = Cast<AQuebecCharacter>(Controller->GetPawn()))
    {
        if (IsValid(LoanCar) && !LoanCar->GetController())
        {
            // Relocate only the unoccupied loaner, with the same swept clearance checks.
            FCollisionQueryParams Query(SCENE_QUERY_STAT(CampaignLoanRecovery),false,LoanCar);
            Query.AddIgnoredActor(Character);
            FHitResult Floor;
            if (GetWorld()->LineTraceSingleByChannel(Floor,CarPoint+FVector(0.,0.,500.),CarPoint-FVector(0.,0.,500.),ECC_Visibility,Query))
            {
                const FVector Destination = Floor.ImpactPoint+FVector(0.,0.,102.);
                if (LoanCar->CanFitAt(Destination,Rotation.Quaternion(),Character))
                {
                    LoanCar->ResetMotion();
                    LoanCar->SetActorLocationAndRotation(Destination,Rotation,false,nullptr,ETeleportType::TeleportPhysics);
                    LoanCar->ResetMotion();
                    LastCarPositions.Remove(LoanCar);
                }
            }
        }
        if (!MoveToSafeCheckpoint(Controller,Point+RightOf(RaceDirections[Gate])*350.f,Rotation)) return;
        Controller->ShowInteractionMessage(TEXT("Race checkpoint. E enters the loan car; cross the blue gate to start."));
    }
    else if (!MoveToSafeCheckpoint(Controller,CarPoint,Rotation)) return;
    bRaceRetried = true;
    if (bRaceTimedOut || Phase == EQuebecCampaignPhase::RaceRunning)
    {
        bRaceTimedOut = false;
        RaceStartTime = GetWorld()->GetTimeSeconds();
        RaceElapsed = 0.f;
        if (RaceGateIndex > 0) ChangePhase(EQuebecCampaignPhase::RaceRunning);
    }
    ForceNetUpdate();
}

void AQuebecCampaign::RequestReplay(AQuebecController* Controller)
{
    if (!HasAuthority() || !Controller || Phase != EQuebecCampaignPhase::Complete) return;
    RaceGateIndex = 0;
    RaceElapsed = 0.f;
    bRaceRetried = false;
    bRaceTimedOut = false;
    LastCarPositions.Reset();
    TrappedUntil.Reset();
    ChangePhase(EQuebecCampaignPhase::RaceReady);
    RequestRetry(Controller);
    bRaceRetried = false;
    Controller->ShowInteractionMessage(TEXT("Race replay ready. Your two completed scenes stay banked."));
}

FString AQuebecCampaign::GetInteractionPrompt(const AQuebecController* Controller) const
{
    if (Phase == EQuebecCampaignPhase::AimWorklight && CanReach(Controller,WorklightLocation,LightRadius))
        return IsAimingLight(Controller) ? TEXT("Mouse: aim / E: release worklight") : LightOperator ? TEXT("Friend aiming the worklight") : TEXT("E: aim worklight at gold seam");
    if (Phase == EQuebecCampaignPhase::PullClamp && CanReach(Controller,FirstClampLocation,ClampRadius))
        return bClampOpen ? TEXT("E: PLUNGER / pull first clamp NOW") : TEXT("Wait for green release beat");
    if (Phase == EQuebecCampaignPhase::ReleaseTable && CanReach(Controller,FinalClampLocation,ClampRadius))
        return !CarLightAligned() ? TEXT("Re-aim the parked car at the table") : bClampOpen ? TEXT("E: PLUNGER / release the table NOW") : TEXT("Wait for green release beat");
    return FString();
}

FString AQuebecCampaign::GetMissionTitle() const
{
    return Phase <= EQuebecCampaignPhase::ReleaseTable ? TEXT("01 / A TABLE FOR ETERNITY") : TEXT("02 / NO SUCH THING AS A QUIET LAP");
}

FString AQuebecCampaign::GetObjectiveText() const
{
    switch (Phase)
    {
    case EQuebecCampaignPhase::AimWorklight: return TEXT("Aim the worklight at the gold seam");
    case EQuebecCampaignPhase::CrossCable: return bSprintSeen ? TEXT("Jump over the striped cable") : TEXT("Sprint and jump over the striped cable");
    case EQuebecCampaignPhase::PullClamp: return TEXT("Pull the first clamp on the green beat");
    case EQuebecCampaignPhase::ParkCarLight: return TEXT("Park a car facing the table in lime bay");
    case EQuebecCampaignPhase::ReleaseTable: return TEXT("Leave car; pull table clamp on green");
    case EQuebecCampaignPhase::RaceReady: return bRaceTimedOut ? TEXT("Time out / R restores banked checkpoint") : TEXT("R: start area / drive through blue gate");
    case EQuebecCampaignPhase::RaceRunning: return RaceGateIndex == 5 ? TEXT("Avoid purple ink; take blue side gate") : RaceGateIndex == 6 ? TEXT("Cross the blue finish arch") : FString::Printf(TEXT("Drive through blue gate %d / 6"),RaceGateIndex);
    default: return TEXT("Two scenes completed / T: replay the race");
    }
}

FString AQuebecCampaign::GetBriefingText() const
{
    switch (Phase)
    {
    case EQuebecCampaignPhase::AimWorklight: return TEXT("CURATOR: A moment this lovely should never move. LIME JACKET: The chairs disagree. Strongly. Find the seam in that picnic press.");
    case EQuebecCampaignPhase::CrossCable: return TEXT("SKULL SHIRT: Nobody can toast forever. Over the cable! I'll bring the least appropriate rescue equipment in Montreal.");
    case EQuebecCampaignPhase::PullClamp: return TEXT("LIME JACKET: It relaxes between squeezes. Green means pull. SKULL SHIRT: Finally, a problem worthy of a plunger.");
    case EQuebecCampaignPhase::ParkCarLight: return TEXT("TOPKNOT: The last latch needs more light. Borrow a car. Point the nose at the table. Try to leave the table standing.");
    case EQuebecCampaignPhase::ReleaseTable: return TEXT("WHITE CAP: Beam's good. Get everyone out. CURATOR: Please remain seated for your souvenir. LIME JACKET: Absolutely not.");
    case EQuebecCampaignPhase::RaceReady: return TEXT("A souvenir slips into the collector. GREEN CAP: A quiet lap to clear our heads? MEMPHIS: Two things I don't believe. Follow that projected car.");
    case EQuebecCampaignPhase::RaceRunning: return RaceGateIndex >= 5 ? TEXT("GREEN CAP: Purple road paint? TOPKNOT: That's ink. Take the blue side gate! CURATOR: A small correction to a perfect route.") : TEXT("BLACK CAP: Same collector stamp on the race arch. CURATOR: One flawless lap. One beautiful ending. MEMPHIS: He really needs a hobby.");
    default: return TEXT("The projection skids through its own ink. Another page turns in the collector's book. WHITE CAP: We saved them. So why did he just say thank you?");
    }
}

FString AQuebecCampaign::GetStatusText() const
{
    if (!SaveStatus.IsEmpty()) return SaveStatus;
    if (Phase == EQuebecCampaignPhase::AimWorklight) return FString::Printf(TEXT("Alignment %d%% / hold %d%%"),FMath::RoundToInt(LightAlignment*100.f),FMath::RoundToInt(LightHoldProgress*100.f));
    if (Phase == EQuebecCampaignPhase::CrossCable) return FString::Printf(TEXT("Sprint %s / jump %s / R: recover"),bSprintSeen?TEXT("banked"):TEXT("needed"),bJumpSeen?TEXT("banked"):TEXT("needed"));
    if (Phase == EQuebecCampaignPhase::PullClamp || Phase == EQuebecCampaignPhase::ReleaseTable) return bClampOpen ? TEXT("GREEN BEAT / pull now / R: recover") : TEXT("Press squeezing / wait for green / R: recover");
    if (Phase == EQuebecCampaignPhase::RaceRunning) return FString::Printf(TEXT("%.1fs / %.0fs / gate %d of 6 / R: recover"),RaceElapsed,RaceTimeLimit,RaceGateIndex);
    if (Phase == EQuebecCampaignPhase::Complete) return bRaceWonThisSession && !bRaceRetried ? TEXT("Clean lap / shared progress saved") : TEXT("Shared progress saved / T: replay");
    return TEXT("Shared checkpoints / R: recover");
}

FVector AQuebecCampaign::GetObjectiveLocation() const
{
    switch (Phase)
    {
    case EQuebecCampaignPhase::AimWorklight: return WorklightLocation;
    case EQuebecCampaignPhase::CrossCable: return JumpGateLocation;
    case EQuebecCampaignPhase::PullClamp: return FirstClampLocation;
    case EQuebecCampaignPhase::ParkCarLight: return CarLightLocation;
    case EQuebecCampaignPhase::ReleaseTable: return FinalClampLocation;
    case EQuebecCampaignPhase::RaceReady: return RaceGates[0];
    case EQuebecCampaignPhase::RaceRunning: return RaceGates[FMath::Clamp(RaceGateIndex,0,RaceGates.Num()-1)];
    default: return FinalClampLocation;
    }
}

void AQuebecCampaign::UpdatePresentation()
{
    if (!bBuilt) return;
    const bool bTerrace = Phase <= EQuebecCampaignPhase::ReleaseTable;
    const bool bRace = Phase >= EQuebecCampaignPhase::RaceReady;
    const FVector Direction = FRotator(LightPitch,LightYaw,0.f).Vector();
    LampPivot->SetWorldRotation(FRotator(LightPitch,LightYaw,0.f));
    LightRay->SetWorldLocation(WorklightLocation+Direction*700.f);
    LightRay->SetWorldRotation(FRotationMatrix::MakeFromZ(Direction).Rotator());
    LightRay->SetVisibility(bTerrace);
    Worklight->SetVisibility(bTerrace);
    // The 300,000 cd worklight was tuned for the afternoon exposure; at night it would blow out.
    Worklight->SetIntensity(300000.f * AQuebecSky::LightScale(GetWorld()));
    const bool bCarBeam = Phase == EQuebecCampaignPhase::ParkCarLight || Phase == EQuebecCampaignPhase::ReleaseTable;
    CarRay->SetVisibility(bCarBeam && IsValid(LightCar));
    if (IsValid(LightCar))
    {
        const FVector Start = LightCar->GetActorLocation()+FVector(0.,0.,65.);
        const FVector Beam = LightCar->GetActorForwardVector();
        CarRay->SetWorldLocation(Start+Beam*650.f);
        CarRay->SetWorldRotation(FRotationMatrix::MakeFromZ(Beam).Rotator());
    }
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr,bClampOpen ? TEXT("/Game/ParkComic/M_Lime.M_Lime") : TEXT("/Game/ParkComic/M_Berry.M_Berry")))
    {
        FirstClamp->SetMaterial(0,Mat);
        FinalClamp->SetMaterial(0,Mat);
    }
    if (Phase == EQuebecCampaignPhase::AimWorklight)
        if (UMaterialInterface* Gold = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Gold.M_Gold"))) FirstClamp->SetMaterial(0,Gold);
    LampCaption->SetVisibility(Phase == EQuebecCampaignPhase::AimWorklight);
    ClampCaption->SetVisibility(Phase == EQuebecCampaignPhase::AimWorklight || Phase == EQuebecCampaignPhase::PullClamp);
    BayCaption->SetVisibility(bCarBeam);
    if (Phase == EQuebecCampaignPhase::AimWorklight) LampCaption->SetText(FText::FromString(LightOperator ? FString::Printf(TEXT("AIM %d%% / HOLD %d%%"),FMath::RoundToInt(LightAlignment*100.f),FMath::RoundToInt(LightHoldProgress*100.f)) : TEXT("WORKLIGHT / E + MOUSE")));
    ClampCaption->SetText(FText::FromString(Phase < EQuebecCampaignPhase::PullClamp ? TEXT("GOLD SEAM") : bClampOpen ? TEXT("GREEN / PULL NOW") : TEXT("WAIT FOR GREEN")));
    BayCaption->SetText(FText::FromString(CarLightAligned() ? TEXT("BEAM READY / EXIT + PULL") : TEXT("PARK IN LIME BAY / NOSE TO TABLE")));
    for (UStaticMeshComponent* Part : PressParts) Part->SetVisibility(CompletedMissions == 0);
    FirstClamp->SetVisibility(Phase <= EQuebecCampaignPhase::PullClamp);
    FinalClamp->SetVisibility(CompletedMissions == 0);
    const AGameStateBase* State = GetWorld()->GetGameState();
    const float Age = (State ? State->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds())-PlungerPullTime;
    Plunger->SetVisibility(Age >= 0.f && Age < .7f,true);
    Plunger->SetWorldLocation(PlungerPoint-FVector(0.,FMath::Clamp(Age/.7f,0.f,1.f)*100.f,0.));
    Souvenir->SetVisibility(CompletedMissions > 0);
    Souvenir->SetWorldLocation(FMath::Lerp(FVector(5870.,3440.,170.),FVector(5250.,3250.,180.),FMath::Clamp(Age/1.8f,0.f,1.f)));
    for (UStaticMeshComponent* Part : Cutouts)
    {
        FVector Scale = Part->GetRelativeScale3D();
        Scale.Y = CompletedMissions == 0 ? .1f : .6f;
        Part->SetRelativeScale3D(Scale);
    }
    for (UStaticMeshComponent* Part : GateParts) Part->SetVisibility(bRace);
    for (UTextRenderComponent* Caption : GateCaptions) Caption->SetVisibility(bRace);
    Rival->SetWorldLocationAndRotation(RivalLocation,FRotator(0.f,RivalYaw,0.f));
    Rival->SetVisibility(Phase == EQuebecCampaignPhase::RaceReady || Phase == EQuebecCampaignPhase::RaceRunning,true);
    // Every sign faces the local camera; the shared objective itself remains authoritative.
    if (APlayerController* Local = GetWorld()->GetFirstPlayerController())
    {
        FVector Eye; FRotator View;
        Local->GetPlayerViewPoint(Eye,View);
        TArray<UTextRenderComponent*> Captions;
        GetComponents<UTextRenderComponent>(Captions);
        for (UTextRenderComponent* Caption : Captions)
        {
            if (Caption->GetFName() == TEXT("SprintJumpHint")) Caption->SetVisibility(Phase == EQuebecCampaignPhase::CrossCable);
            if (Caption->GetFName() == TEXT("FinalClampHint")) Caption->SetVisibility(Phase == EQuebecCampaignPhase::ReleaseTable);
        }
        for (UTextRenderComponent* Caption : Captions) Caption->SetWorldRotation((Eye-Caption->GetComponentLocation()).Rotation());
    }
}

void AQuebecCampaign::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecCampaign,Phase);
    DOREPLIFETIME(AQuebecCampaign,CompletedMissions);
    DOREPLIFETIME(AQuebecCampaign,LightOperator);
    DOREPLIFETIME(AQuebecCampaign,LightYaw);
    DOREPLIFETIME(AQuebecCampaign,LightPitch);
    DOREPLIFETIME(AQuebecCampaign,LightAlignment);
    DOREPLIFETIME(AQuebecCampaign,LightHoldProgress);
    DOREPLIFETIME(AQuebecCampaign,SaveStatus);
    DOREPLIFETIME(AQuebecCampaign,bSprintSeen);
    DOREPLIFETIME(AQuebecCampaign,bJumpSeen);
    DOREPLIFETIME(AQuebecCampaign,RaceGateIndex);
    DOREPLIFETIME(AQuebecCampaign,RaceStartTime);
    DOREPLIFETIME(AQuebecCampaign,RaceElapsed);
    DOREPLIFETIME(AQuebecCampaign,RaceTimeLimit);
    DOREPLIFETIME(AQuebecCampaign,bRaceRetried);
    DOREPLIFETIME(AQuebecCampaign,bRaceTimedOut);
    DOREPLIFETIME(AQuebecCampaign,bClampOpen);
    DOREPLIFETIME(AQuebecCampaign,LightCar);
    DOREPLIFETIME(AQuebecCampaign,LoanCar);
    DOREPLIFETIME(AQuebecCampaign,RivalLocation);
    DOREPLIFETIME(AQuebecCampaign,RivalYaw);
    DOREPLIFETIME(AQuebecCampaign,PlungerPullTime);
    DOREPLIFETIME(AQuebecCampaign,PlungerPoint);
}
