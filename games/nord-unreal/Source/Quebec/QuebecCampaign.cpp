#include "QuebecCampaign.h"
#include "QuebecGameplay.h"
#include "QuebecGTA.h" // Side jobs: QuebecJobs::IsJobActive for the race gate guard (JOBS).
#include "QuebecBlankRules.h"
#include "QuebecPace.h"
#include "QuebecConvoyRules.h"
#include "QuebecCourtRules.h"
#include "QuebecPondRules.h"
#include "QuebecRescueRules.h"
#include "QuebecShowRules.h"
#include "QuebecSky.h"

static_assert(QuebecPondRules::StepBanked == AQuebecCampaign::PondBankedStep,
    "mission 3 banks in the session only; the campaign and the rules share one banked index");
static_assert(QuebecCourtRules::StepBanked == AQuebecCampaign::CourtBankedStep,
    "mission 4 banks in the session only; the campaign and the rules share one banked index");
static_assert(QuebecShowRules::StepBanked == AQuebecCampaign::ShowBankedStep,
    "mission 5 banks in the session only; the campaign and the rules share one banked index");
static_assert(QuebecRescueRules::Done == AQuebecCampaign::RescueDone,
    "mission 6 banks in the session only; the campaign and the rules share one done mask");
static_assert(QuebecConvoyRules::StepBanked == AQuebecCampaign::ConvoyBankedStep,
    "mission 7 banks in the session only; the campaign and the rules share one banked index");
static_assert(QuebecBlankRules::StepBanked == AQuebecCampaign::BlankBankedStep,
    "mission 8 banks in the session only; the campaign and the rules share one banked index");

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
    if (QuebecDistrict::IsToronto(GetWorld()))
    {
        SetActorTickEnabled(false);
        return;
    }
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

    // Mission 3 posts. Hidden until the race is banked; the blink itself is in QuebecPondRules::PartVisible.
    const auto PondAt = [](const QuebecPondRules::FSpot& Spot, double Height)
    {
        return FVector(Spot.X, Spot.Y, Height);
    };
    PondParts.Add(AddPart(TEXT("PondShore"),Cylinder,PondAt(QuebecPondRules::ShoreLookout,6.),FVector(220.,220.,12.),Cream));
    PondCaptions.Add(AddCaption(TEXT("PondShoreCaption"),PondAt(QuebecPondRules::ShoreLookout,160.),TEXT("NORTH SHORE"),18.f));
    for (int32 Beam = 0; Beam < QuebecPondRules::BeamCount; ++Beam)
    {
        PondParts.Add(AddPart(*FString::Printf(TEXT("PondBeam%d"),Beam),Cylinder,PondAt(QuebecPondRules::Beams[Beam],160.),FVector(28.,28.,320.),Gold));
        PondCaptions.Add(AddCaption(*FString::Printf(TEXT("PondBeamCaption%d"),Beam),PondAt(QuebecPondRules::Beams[Beam],340.),TEXT("BEAM"),18.f));
    }
    PondParts.Add(AddPart(TEXT("PondNearLock"),Cube,PondAt(QuebecPondRules::NearLock,70.),FVector(40.,40.,140.),Gold));
    PondCaptions.Add(AddCaption(TEXT("PondNearCaption"),PondAt(QuebecPondRules::NearLock,180.),TEXT("NEAR LOCK"),18.f));
    PondParts.Add(AddPart(TEXT("PondFarLock"),Cube,PondAt(QuebecPondRules::FarLock,70.),FVector(40.,40.,140.),Lime));
    PondCaptions.Add(AddCaption(TEXT("PondFarCaption"),PondAt(QuebecPondRules::FarLock,180.),TEXT("FAR LOCK"),18.f));
    PondParts.Add(AddPart(TEXT("PondDashPost"),Cylinder,PondAt(QuebecPondRules::DashEnd,90.),FVector(24.,24.,180.),Lime));
    PondCaptions.Add(AddCaption(TEXT("PondDashCaption"),PondAt(QuebecPondRules::DashEnd,200.),TEXT("SPRINT"),18.f));
    PondParts.Add(AddPart(TEXT("PondPicnicClamp"),Sphere,PondAt(QuebecPondRules::Picnic,80.),FVector(48.,48.,48.),Berry));
    PondCaptions.Add(AddCaption(TEXT("PondPicnicCaption"),PondAt(QuebecPondRules::Picnic,180.),TEXT("PICNIC CLAMP"),18.f));

    // Mission 4 posts. Hidden until the picnic is banked. The ball and the ink sweep move in UpdatePresentation.
    const auto CourtAt = [](const QuebecCourtRules::FSpot& Spot, double Height)
    {
        return FVector(Spot.X, Spot.Y, Height);
    };
    CourtParts.Add(AddPart(TEXT("CourtArrive"),Cylinder,CourtAt(QuebecCourtRules::Arrive,6.),FVector(200.,200.,12.),Cream));
    CourtCaptions.Add(AddCaption(TEXT("CourtArriveCaption"),CourtAt(QuebecCourtRules::Arrive,160.),TEXT("EXHIBITION"),18.f));
    const TCHAR* PanelNames[] = {TEXT("PANEL"), TEXT("MIDDLE"), TEXT("GOLD")};
    for (int32 Panel = 0; Panel < QuebecCourtRules::PanelCount; ++Panel)
    {
        const bool bGold = Panel == QuebecCourtRules::GoldPanel;
        CourtParts.Add(AddPart(*FString::Printf(TEXT("CourtPanel%d"), Panel), Cube,
            CourtAt(QuebecCourtRules::Panels[Panel], bGold ? 100. : 80.), FVector(70., 70., bGold ? 200. : 160.), Gold));
        CourtCaptions.Add(AddCaption(*FString::Printf(TEXT("CourtPanelCaption%d"), Panel),
            CourtAt(QuebecCourtRules::Panels[Panel], bGold ? 230. : 190.), PanelNames[Panel], 18.f));
    }
    CourtParts.Add(AddPart(TEXT("CourtReturnGate"),Cube,CourtAt(QuebecCourtRules::ReturnGate,110.),FVector(36.,36.,220.),Lime));
    CourtCaptions.Add(AddCaption(TEXT("CourtGateCaption"),CourtAt(QuebecCourtRules::ReturnGate,250.),TEXT("RETURN"),18.f));
    CourtParts.Add(AddPart(TEXT("CourtClamp"),Sphere,CourtAt(QuebecCourtRules::Clamp,80.),FVector(48.,48.,48.),Berry));
    CourtCaptions.Add(AddCaption(TEXT("CourtClampCaption"),CourtAt(QuebecCourtRules::Clamp,180.),TEXT("COURT CLAMP"),18.f));
    CourtParts.Add(AddPart(TEXT("CourtBall"),Sphere,CourtAt(QuebecCourtRules::Panels[0],140.),FVector(90.,90.,90.),Cream));
    CourtParts.Add(AddPart(TEXT("CourtInk"),Cube,CourtAt(QuebecCourtRules::ReturnGate,40.),FVector(420.,16.,10.),Berry));

    // Mission 5 posts. Hidden until the court is banked. The page panels appear only after the curtain.
    const auto ShowAt = [](const QuebecShowRules::FSpot& Spot, double Height)
    {
        return FVector(Spot.X, Spot.Y, Height);
    };
    ShowParts.Add(AddPart(TEXT("ShowLoading"),Cylinder,ShowAt(QuebecShowRules::Loading,6.),FVector(200.,200.,12.),Cream));
    ShowCaptions.Add(AddCaption(TEXT("ShowLoadingCaption"),ShowAt(QuebecShowRules::Loading,160.),TEXT("LOADING EDGE"),18.f));
    ShowParts.Add(AddPart(TEXT("ShowFollowspot"),Cylinder,ShowAt(QuebecShowRules::Followspot,140.),FVector(28.,28.,280.),Gold));
    ShowCaptions.Add(AddCaption(TEXT("ShowSpotCaption"),ShowAt(QuebecShowRules::Followspot,300.),TEXT("FOLLOWSPOT"),18.f));
    ShowParts.Add(AddPart(TEXT("ShowBackdrop"),Cube,ShowAt(QuebecShowRules::Backdrop,110.),FVector(220.,18.,220.),Berry));
    ShowCaptions.Add(AddCaption(TEXT("ShowDropCaption"),ShowAt(QuebecShowRules::Backdrop,250.),TEXT("BACKDROP"),18.f));
    ShowParts.Add(AddPart(TEXT("ShowCurtain"),Cube,ShowAt(QuebecShowRules::Loading,90.),FVector(30.,30.,180.),Lime));
    ShowCaptions.Add(AddCaption(TEXT("ShowCueCaption"),ShowAt(QuebecShowRules::Loading,220.),TEXT("CURTAIN"),18.f));
    const FVector PanelOffset[] = {FVector(-160.,-80.,0.), FVector(160.,-80.,0.), FVector(-160.,80.,0.), FVector(160.,80.,0.)};
    const TCHAR* PanelLabels[] = {TEXT("TERRACE"), TEXT("POND"), TEXT("COURT"), TEXT("OVATION")};
    for (int32 Panel = 0; Panel < 4; ++Panel)
    {
        ShowParts.Add(AddPart(*FString::Printf(TEXT("ShowPanel%d"), Panel), Cube,
            ShowAt(QuebecShowRules::Stage, 120.) + PanelOffset[Panel], FVector(90., 8., 140.), Gold));
        ShowCaptions.Add(AddCaption(*FString::Printf(TEXT("ShowPanelCaption%d"), Panel),
            ShowAt(QuebecShowRules::Stage, 220.) + PanelOffset[Panel], PanelLabels[Panel], 16.f));
    }
    ShowParts.Add(AddPart(TEXT("ShowSouvenir"),Sphere,ShowAt(QuebecShowRules::Stage,80.),FVector(48.,48.,48.),Berry));
    ShowCaptions.Add(AddCaption(TEXT("ShowSouvenirCaption"),ShowAt(QuebecShowRules::Stage,180.),TEXT("THE PAGE"),18.f));

    // Mission 6 posts. Hidden until the show is banked. Order is terrace, pond, court.
    const auto RescueAt = [](const QuebecRescueRules::FSpot& Spot, double Height)
    {
        return FVector(Spot.X, Spot.Y, Height);
    };
    const TCHAR* RescueLabels[] = {TEXT("TERRACE"), TEXT("POND"), TEXT("COURT")};
    const TCHAR* RescueInk[] = {Cream, Gold, Lime};
    for (int32 Group = 0; Group < QuebecRescueRules::GroupCount; ++Group)
    {
        RescueParts.Add(AddPart(*FString::Printf(TEXT("RescuePost%d"), Group), Cylinder,
            RescueAt(QuebecRescueRules::Posts[Group], 80.), FVector(40., 40., 160.), RescueInk[Group]));
        RescueCaptions.Add(AddCaption(*FString::Printf(TEXT("RescueCaption%d"), Group),
            RescueAt(QuebecRescueRules::Posts[Group], 200.), RescueLabels[Group], 18.f));
    }

    // Mission 7 posts. Hidden until every group is out. Order matches QuebecConvoyRules part indexes.
    const auto ConvoyAt = [](const QuebecConvoyRules::FSpot& Spot, double Height)
    {
        return FVector(Spot.X, Spot.Y, Height);
    };
    ConvoyParts.Add(AddPart(TEXT("ConvoyFeeder"), Cylinder, ConvoyAt(QuebecConvoyRules::Feeder, 80.), FVector(40., 40., 160.), Berry));
    ConvoyCaptions.Add(AddCaption(TEXT("ConvoyFeederCaption"), ConvoyAt(QuebecConvoyRules::Feeder, 200.), TEXT("FEEDER"), 18.f));
    ConvoyParts.Add(AddPart(TEXT("ConvoyBeam"), Cube, ConvoyAt(QuebecConvoyRules::Feeder, 40.), FVector(420., 16., 10.), Berry));
    ConvoyCaptions.Add(AddCaption(TEXT("ConvoyBeamCaption"), ConvoyAt(QuebecConvoyRules::Feeder, 80.), TEXT("BEAM"), 16.f));
    ConvoyParts.Add(AddPart(TEXT("ConvoyProjector"), Cube, ConvoyAt(QuebecConvoyRules::Projector, 90.), FVector(180., 70., 80.), Gold));
    ConvoyCaptions.Add(AddCaption(TEXT("ConvoyProjectorCaption"), ConvoyAt(QuebecConvoyRules::Projector, 200.), TEXT("PROJECTOR"), 18.f));
    ConvoyParts.Add(AddPart(TEXT("ConvoyEscape"), Cube, ConvoyAt(QuebecConvoyRules::Escape, 110.), FVector(36., 36., 220.), Lime));
    ConvoyCaptions.Add(AddCaption(TEXT("ConvoyEscapeCaption"), ConvoyAt(QuebecConvoyRules::Escape, 250.), TEXT("ESCAPE"), 18.f));
    ConvoyParts.Add(AddPart(TEXT("ConvoyPlate"), Sphere, ConvoyAt(QuebecConvoyRules::Escape, 80.), FVector(48., 48., 48.), Cream));
    ConvoyCaptions.Add(AddCaption(TEXT("ConvoyPlateCaption"), ConvoyAt(QuebecConvoyRules::Escape, 180.), TEXT("BLANK PLATE"), 18.f));

    // Mission 8 posts. Hidden until the convoy is banked. Order is gate A, B, C, cue, page.
    const auto BlankAt = [](const QuebecBlankRules::FSpot& Spot, double Height)
    {
        return FVector(Spot.X, Spot.Y, Height);
    };
    const QuebecBlankRules::FSpot BlankGates[] = {QuebecBlankRules::GateA, QuebecBlankRules::GateB, QuebecBlankRules::GateC};
    const TCHAR* BlankGateLabels[] = {TEXT("GATE 1"), TEXT("GATE 2"), TEXT("GATE 3")};
    for (int32 Gate = 0; Gate < 3; ++Gate)
    {
        BlankParts.Add(AddPart(*FString::Printf(TEXT("BlankGate%d"), Gate), Cube,
            BlankAt(BlankGates[Gate], 110.), FVector(36., 36., 220.), Lime));
        BlankCaptions.Add(AddCaption(*FString::Printf(TEXT("BlankGateCaption%d"), Gate),
            BlankAt(BlankGates[Gate], 250.), BlankGateLabels[Gate], 18.f));
    }
    BlankParts.Add(AddPart(TEXT("BlankCue"), Cylinder, BlankAt(QuebecBlankRules::Cue, 80.), FVector(40., 40., 160.), Gold));
    BlankCaptions.Add(AddCaption(TEXT("BlankCueCaption"), BlankAt(QuebecBlankRules::Cue, 200.), TEXT("BLANK PAGE"), 18.f));
    BlankParts.Add(AddPart(TEXT("BlankPage"), Cube, BlankAt(QuebecBlankRules::Cue, 140.), FVector(160., 8., 200.), Cream));
    BlankCaptions.Add(AddCaption(TEXT("BlankPageCaption"), BlankAt(QuebecBlankRules::Cue, 280.), TEXT("LEFT BLANK"), 18.f));
}

void AQuebecCampaign::Tick(float DeltaSeconds)
{
    if (QuebecDistrict::IsToronto(GetWorld())) return;
    Super::Tick(DeltaSeconds);
    if (HasAuthority())
    {
        bClampOpen = FMath::Fmod(GetWorld()->GetTimeSeconds(),6.f) < 2.5f;
        if (Phase <= EQuebecCampaignPhase::ReleaseTable) TickTerrace(DeltaSeconds);
        if (Phase == EQuebecCampaignPhase::RaceReady || Phase == EQuebecCampaignPhase::RaceRunning) TickRace(DeltaSeconds);
        if (Phase == EQuebecCampaignPhase::Complete)
        {
            TickPond();
            TickCourt();
            TickShow();
            TickConvoy();
            TickBlank();
        }
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
    if (QuebecDistrict::IsToronto(GetWorld()) || !HasAuthority() || !IsAimingLight(Controller) || !CanReach(Controller,WorklightLocation,LightRadius+60.f) ||
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
    if (!QuebecDistrict::IsToronto(GetWorld()) && HasAuthority() && IsAimingLight(Controller))
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
    if (QuebecDistrict::IsToronto(GetWorld()) || !HasAuthority() || !Controller) return false;
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
    if (IsPondOpen())
    {
        if (PondStep == QuebecPondRules::StepTag)
        {
            int32 BestBeam = -1;
            double BestDistance = QuebecPondRules::Reach + 1.;
            const AQuebecCharacter* Character = Cast<AQuebecCharacter>(Controller->GetPawn());
            if (!Character) return false;
            for (int32 Beam = 0; Beam < QuebecPondRules::BeamCount; ++Beam)
            {
                const QuebecPondRules::FSpot& Spot = QuebecPondRules::Beams[Beam];
                if (!NearPond(Controller, Spot.X, Spot.Y)) continue;
                const double Distance = FVector::Dist2D(Character->GetActorLocation(), FVector(Spot.X, Spot.Y, 0.));
                if (Distance < BestDistance) { BestDistance = Distance; BestBeam = Beam; }
            }
            if (BestBeam < 0) return false;
            const int32 Next = QuebecPondRules::Apply(PondStep, QuebecPondRules::EAct::Tag, BestBeam, false);
            if (Next == PondStep)
            {
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                Controller->ShowInteractionMessage(TEXT("That beam blinks with the sky. The postcard does not."));
                return true;
            }
            AdvancePond(Next, Controller, TEXT("Worklight onto the near lock. The sheet is peeling."), false);
            return true;
        }
        const QuebecPondRules::FSpot* UseSpot = nullptr;
        const TCHAR* UseMessage = nullptr;
        bool bFinish = false;
        if (PondStep == QuebecPondRules::StepNear)
        {
            UseSpot = &QuebecPondRules::NearLock;
            UseMessage = TEXT("The sheet peeled east. The far lock is on the new path.");
        }
        else if (PondStep == QuebecPondRules::StepFar)
        {
            UseSpot = &QuebecPondRules::FarLock;
            UseMessage = TEXT("Sprint the exposed path. Walking leaves you in the picture.");
        }
        else if (PondStep == QuebecPondRules::StepPull)
        {
            UseSpot = &QuebecPondRules::Picnic;
            UseMessage = TEXT("The picnic sits up. A third souvenir, for this session.");
            bFinish = true;
        }
        if (UseSpot && NearPond(Controller, UseSpot->X, UseSpot->Y))
        {
            if (bFinish)
            {
                PlungerPoint = FVector(UseSpot->X, UseSpot->Y, 130.);
                PlungerPullTime = GetWorld()->GetTimeSeconds();
            }
            // The picnic is session state. CompletedMissions stays 2 and the v1 slot is not rewritten.
            AdvancePond(QuebecPondRules::Apply(PondStep, QuebecPondRules::EAct::Use, -1, false), Controller, UseMessage, bFinish);
            return true;
        }
        return false;
    }
    if (IsCourtOpen())
    {
        const AGameStateBase* CourtState = GetWorld()->GetGameState();
        const double CourtTime = static_cast<double>(CourtState ? CourtState->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds());
        if (CourtStep == QuebecCourtRules::StepRally)
        {
            int32 BestPanel = -1;
            double BestDistance = QuebecCourtRules::Reach + 1.;
            const AQuebecCharacter* Character = Cast<AQuebecCharacter>(Controller->GetPawn());
            if (!Character) return false;
            for (int32 Panel = 0; Panel < QuebecCourtRules::PanelCount; ++Panel)
            {
                const QuebecCourtRules::FSpot& Spot = QuebecCourtRules::Panels[Panel];
                if (!NearCourt(Controller, Spot.X, Spot.Y)) continue;
                const double Distance = FVector::Dist2D(Character->GetActorLocation(), FVector(Spot.X, Spot.Y, 0.));
                if (Distance < BestDistance) { BestDistance = Distance; BestPanel = Panel; }
            }
            if (BestPanel < 0) return false;
            const int32 Next = QuebecCourtRules::Apply(CourtStep, QuebecCourtRules::EAct::Score, BestPanel, CourtTime);
            if (Next == CourtStep)
            {
                Controller->ShowInteractionMessage(BestPanel == QuebecCourtRules::GoldPanel
                    ? TEXT("Wait until the ball is on the gold panel.")
                    : TEXT("That panel is a decoy. The gold one restarts the rally."));
                return true;
            }
            AdvanceCourt(Next, Controller, TEXT("The point restarts. The return gate is the way out. RED JERSEY: I wanted to win that."), false);
            return true;
        }
        if (CourtStep == QuebecCourtRules::StepRedirect)
        {
            const QuebecCourtRules::FSpot& Gold = QuebecCourtRules::Panels[QuebecCourtRules::GoldPanel];
            if (NearCourt(Controller, Gold.X, Gold.Y))
            {
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                Controller->ShowInteractionMessage(TEXT("That panel restarts the point. The referee is already writing the penalty."));
                return true;
            }
            if (NearCourt(Controller, QuebecCourtRules::ReturnGate.X, QuebecCourtRules::ReturnGate.Y))
            {
                const int32 Next = QuebecCourtRules::Apply(CourtStep, QuebecCourtRules::EAct::Bank, QuebecCourtRules::BankPanel, CourtTime);
                if (Next == CourtStep)
                {
                    ++CourtMisses;
                    ForceNetUpdate();
                    Controller->ShowInteractionMessage(QuebecCourtRules::SweepDanger(CourtTime)
                        ? TEXT("Ink on the line. Let it pass.")
                        : TEXT("Wait until the ball crosses the middle panel."));
                    return true;
                }
                AdvanceCourt(Next, Controller, TEXT("The bank goes in. The referee calls a penalty on the light."), false);
                return true;
            }
            return false;
        }
        if (CourtStep == QuebecCourtRules::StepPull && NearCourt(Controller, QuebecCourtRules::Clamp.X, QuebecCourtRules::Clamp.Y))
        {
            PlungerPoint = FVector(QuebecCourtRules::Clamp.X, QuebecCourtRules::Clamp.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The court is session state. CompletedMissions stays 2 and the v1 slot is not rewritten.
            AdvanceCourt(QuebecCourtRules::Apply(CourtStep, QuebecCourtRules::EAct::Use, -1, CourtTime), Controller,
                TEXT("The players sit up. Fourth souvenir, for this session."), true);
            return true;
        }
        return false;
    }
    if (IsShowOpen())
    {
        const bool bNeedsSpot = ShowStep == QuebecShowRules::StepChoice || ShowStep == QuebecShowRules::StepDrop;
        const bool bNeedsDrop = ShowStep == QuebecShowRules::StepChoice || ShowStep == QuebecShowRules::StepSpot;
        if (bNeedsSpot && NearShow(Controller, QuebecShowRules::Followspot.X, QuebecShowRules::Followspot.Y))
        {
            const int32 Next = QuebecShowRules::Apply(ShowStep, QuebecShowRules::EAct::Spot);
            const TCHAR* Message = ShowStep == QuebecShowRules::StepChoice
                ? TEXT("Followspot set. The backdrop is still a blank.")
                : TEXT("Both are live. Back to the loading edge for the curtain.");
            AdvanceShow(Next, Controller, Message, false);
            return true;
        }
        if (bNeedsDrop && NearShow(Controller, QuebecShowRules::Backdrop.X, QuebecShowRules::Backdrop.Y))
        {
            const int32 Next = QuebecShowRules::Apply(ShowStep, QuebecShowRules::EAct::Drop);
            const TCHAR* Message = ShowStep == QuebecShowRules::StepChoice
                ? TEXT("Backdrop hung. The followspot is still dark.")
                : TEXT("Both are live. Back to the loading edge for the curtain.");
            AdvanceShow(Next, Controller, Message, false);
            return true;
        }
        if ((ShowStep == QuebecShowRules::StepSpot && NearShow(Controller, QuebecShowRules::Followspot.X, QuebecShowRules::Followspot.Y))
            || (ShowStep == QuebecShowRules::StepDrop && NearShow(Controller, QuebecShowRules::Backdrop.X, QuebecShowRules::Backdrop.Y)))
        {
            Controller->ShowInteractionMessage(TEXT("That station is set. The other one is still live."));
            return true;
        }
        if (ShowStep == QuebecShowRules::StepCue && NearShow(Controller, QuebecShowRules::Loading.X, QuebecShowRules::Loading.Y))
        {
            PlungerPoint = FVector(QuebecShowRules::Loading.X, QuebecShowRules::Loading.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The ovation is session state. CompletedMissions stays 2 and the v1 slot is not rewritten.
            AdvanceShow(QuebecShowRules::Apply(ShowStep, QuebecShowRules::EAct::Cue), Controller,
                TEXT("The applause is a page turning. Four panels around the stage."), true);
            return true;
        }
        return false;
    }
    if (IsRescueOpen())
    {
        auto StillIn = [](int32 Next) -> const TCHAR*
        {
            const bool bTerrace = QuebecRescueRules::GroupOpen(Next, QuebecRescueRules::GroupTerrace);
            const bool bPond = QuebecRescueRules::GroupOpen(Next, QuebecRescueRules::GroupPond);
            const bool bCourt = QuebecRescueRules::GroupOpen(Next, QuebecRescueRules::GroupCourt);
            if (bTerrace && bPond) return TEXT("The terrace and the pond are still in the picture.");
            if (bTerrace && bCourt) return TEXT("The terrace and the court are still in the picture.");
            if (bPond && bCourt) return TEXT("The pond and the court are still in the picture.");
            if (bTerrace) return TEXT("The terrace is still in the picture.");
            if (bPond) return TEXT("The pond is still in the picture.");
            if (bCourt) return TEXT("The court is still in the picture.");
            return TEXT("");
        };
        for (int32 Group = 0; Group < QuebecRescueRules::GroupCount; ++Group)
        {
            const QuebecRescueRules::FSpot& Spot = QuebecRescueRules::Posts[Group];
            if (!NearRescue(Controller, Spot.X, Spot.Y)) continue;
            if (!QuebecRescueRules::GroupOpen(RescueMask, Group))
            {
                Controller->ShowInteractionMessage(TEXT("That group is already out."));
                return true;
            }
            const int32 Next = QuebecRescueRules::Apply(RescueMask, Group);
            const bool bFinished = Next >= RescueDone;
            const TCHAR* Lead = Group == QuebecRescueRules::GroupTerrace
                ? TEXT("The terrace guest sits up.")
                : Group == QuebecRescueRules::GroupPond
                    ? TEXT("The reversed clamp lets them off the postcard.")
                    : TEXT("The return loop breaks. That group walks off the line.");
            const FString Message = bFinished
                ? FString(TEXT("White Cap: that's the list. Memphis: Okay. Now we get our park back."))
                : FString(Lead) + TEXT(" ") + StillIn(Next);
            if (bFinished)
            {
                PlungerPoint = FVector(Spot.X, Spot.Y, 130.);
                PlungerPullTime = GetWorld()->GetTimeSeconds();
            }
            // The groups are session state. CompletedMissions stays 2 and the v1 slot is not rewritten.
            AdvanceRescue(Next, Controller, *Message, bFinished);
            return true;
        }
        return false;
    }
    if (IsConvoyOpen())
    {
        const AGameStateBase* ConvoyState = GetWorld()->GetGameState();
        const double ConvoyTime = static_cast<double>(ConvoyState ? ConvoyState->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds());
        if (ConvoyStep == QuebecConvoyRules::StepGap && NearConvoy(Controller, QuebecConvoyRules::Feeder.X, QuebecConvoyRules::Feeder.Y))
        {
            const int32 Next = QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Pull, ConvoyTime);
            if (Next == ConvoyStep)
            {
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                Controller->ShowInteractionMessage(TEXT("The beam is still painting. Wait for the gap."));
                return true;
            }
            AdvanceConvoy(Next, Controller, TEXT("The feed stalls. The projector car is sitting alone."), false);
            return true;
        }
        if (ConvoyStep == QuebecConvoyRules::StepInvert && NearConvoy(Controller, QuebecConvoyRules::Projector.X, QuebecConvoyRules::Projector.Y))
        {
            AdvanceConvoy(QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Use, ConvoyTime), Controller,
                TEXT("The plate is inverted. Blank panels. Take the escape gate."), false);
            return true;
        }
        if (ConvoyStep == QuebecConvoyRules::StepEscape && NearConvoy(Controller, QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y))
        {
            PlungerPoint = FVector(QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The convoy is session state. CompletedMissions stays 2 and the v1 slot is not rewritten.
            AdvanceConvoy(QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Use, ConvoyTime), Controller,
                TEXT("GREEN CAP: That route was fine. TOPKNOT: This one is better. The border has a gap."), true);
            return true;
        }
        return false;
    }
    if (IsBlankOpen())
    {
        if (BlankStep == QuebecBlankRules::StepCue && NearBlank(Controller, QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y))
        {
            PlungerPoint = FVector(QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The last page is session state. CompletedMissions stays 2 and the v1 slot is not rewritten.
            AdvanceBlank(QuebecBlankRules::Apply(BlankStep, QuebecBlankRules::EAct::Use), Controller,
                TEXT("MEMPHIS: Leave it blank. The park can have a tomorrow that is not a souvenir."), true);
            return true;
        }
        return false;
    }
    return false;
}

void AQuebecCampaign::TickPond()
{
    if (!IsPondOpen()) return;
    int32 Next = PondStep;
    AQuebecController* Who = nullptr;
    const TCHAR* Message = nullptr;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        AQuebecCharacter* Character = Cast<AQuebecCharacter>(It->GetPawn());
        if (!Character)
        {
            PondSamples.Remove(*It);
            continue;
        }
        FPondSample& Sample = PondSamples.FindOrAdd(*It);
        const FVector Position = Character->GetActorLocation();
        if (PondStep == QuebecPondRules::StepShore && NearPond(*It, QuebecPondRules::ShoreLookout.X, QuebecPondRules::ShoreLookout.Y))
        {
            Next = QuebecPondRules::Apply(PondStep, QuebecPondRules::EAct::Arrive, -1, false);
            Who = *It;
            Message = TEXT("The postcard is on. Tag the beam that never blinks.");
        }
        else if (PondStep == QuebecPondRules::StepDash && Sample.bSeen)
        {
            const QuebecPondRules::FSpot End = QuebecPondRules::DashEnd;
            const double Previous = FVector::Dist2D(Sample.Where, FVector(End.X, End.Y, 0.));
            const double Distance = FVector::Dist2D(Position, FVector(End.X, End.Y, 0.));
            QuebecPondRules::NoteDash(Sample.bWasFar, Previous);
            if (QuebecPondRules::SprintCross(Sample.bWasFar, Previous, Distance, Character->GetVelocity().Size2D()))
            {
                Next = QuebecPondRules::Apply(PondStep, QuebecPondRules::EAct::SprintIn, -1, true);
                Who = *It;
                Message = TEXT("The path is open. Pull the picnic clamp.");
            }
            QuebecPondRules::NoteDash(Sample.bWasFar, Distance);
        }
        else if (PondStep == QuebecPondRules::StepDash)
        {
            const QuebecPondRules::FSpot End = QuebecPondRules::DashEnd;
            QuebecPondRules::NoteDash(Sample.bWasFar, FVector::Dist2D(Position, FVector(End.X, End.Y, 0.)));
        }
        Sample.Where = Position;
        Sample.bSeen = true;
        if (Next != PondStep) break;
    }
    for (auto It = PondSamples.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
    if (Next != PondStep) AdvancePond(Next, Who, Message, false);
}

void AQuebecCampaign::AdvancePond(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == PondStep) return;
    PondStep = Next;
    PondSamples.Reset();
    if (Who && Message) Who->ShowInteractionMessage(Message);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecCampaign::NearPond(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecPondRules::Reach;
}

void AQuebecCampaign::TickCourt()
{
    if (!IsCourtOpen() || CourtStep != QuebecCourtRules::StepArrive) return;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearCourt(*It, QuebecCourtRules::Arrive.X, QuebecCourtRules::Arrive.Y)) continue;
        const int32 Next = QuebecCourtRules::Apply(CourtStep, QuebecCourtRules::EAct::Walk, -1, 0.);
        if (Next != CourtStep)
            AdvanceCourt(Next, *It, TEXT("The exhibition is one point from perfect. Score the gold panel."), false);
        break;
    }
}

void AQuebecCampaign::AdvanceCourt(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == CourtStep) return;
    CourtStep = Next;
    if (Who && Message) Who->ShowInteractionMessage(Message);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecCampaign::NearCourt(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecCourtRules::Reach;
}

void AQuebecCampaign::TickShow()
{
    if (!IsShowOpen() || ShowStep != QuebecShowRules::StepArrive) return;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearShow(*It, QuebecShowRules::Loading.X, QuebecShowRules::Loading.Y)) continue;
        const int32 Next = QuebecShowRules::Apply(ShowStep, QuebecShowRules::EAct::Walk);
        if (Next != ShowStep)
            AdvanceShow(Next, *It, TEXT("The theatre is still ours for one show. Set the followspot or drop the backdrop."), false);
        break;
    }
}

void AQuebecCampaign::AdvanceShow(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == ShowStep) return;
    ShowStep = Next;
    if (Who && Message) Who->ShowInteractionMessage(Message);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecCampaign::NearShow(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecShowRules::Reach;
}

void AQuebecCampaign::AdvanceRescue(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == RescueMask) return;
    RescueMask = Next;
    if (Who && Message) Who->ShowInteractionMessage(Message);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecCampaign::NearRescue(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecRescueRules::Reach;
}

void AQuebecCampaign::TickConvoy()
{
    if (!IsConvoyOpen() || ConvoyStep != QuebecConvoyRules::StepArrive) return;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearConvoy(*It, QuebecConvoyRules::Feeder.X, QuebecConvoyRules::Feeder.Y)) continue;
        const int32 Next = QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Walk, 0.);
        if (Next != ConvoyStep)
            AdvanceConvoy(Next, *It, TEXT("The beam paints the border, then leaves a gap. The feeder's clamp is in that bay."), false);
        break;
    }
}

void AQuebecCampaign::AdvanceConvoy(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == ConvoyStep) return;
    ConvoyStep = Next;
    if (Who && Message) Who->ShowInteractionMessage(Message);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecCampaign::NearConvoy(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecConvoyRules::Reach;
}

void AQuebecCampaign::TickBlank()
{
    if (!IsBlankOpen() || BlankStep >= QuebecBlankRules::StepCue) return;
    const QuebecBlankRules::FSpot Spot = QuebecBlankRules::Objective(BlankStep);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearBlank(*It, Spot.X, Spot.Y)) continue;
        const int32 Next = QuebecBlankRules::Apply(BlankStep, QuebecBlankRules::EAct::Walk);
        if (Next == BlankStep) break;
        const TCHAR* Message = Next == QuebecBlankRules::StepCue
            ? TEXT("Three gates cut his route. The last page is still his. Leave it blank.")
            : TEXT("That gate is blank. The next one is still his line.");
        AdvanceBlank(Next, *It, Message, false);
        break;
    }
}

void AQuebecCampaign::AdvanceBlank(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == BlankStep) return;
    BlankStep = Next;
    if (Who && Message) Who->ShowInteractionMessage(Message);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecCampaign::NearBlank(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecBlankRules::Reach;
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
    // Side jobs (JOBS): gate 0 does not start the race while a side job runs, so a job's drive cannot trigger it.
    const bool bSideJob = Phase == EQuebecCampaignPhase::RaceReady && QuebecJobs::IsJobActive(GetWorld());
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
        if (Previous && RaceGates.IsValidIndex(Index) && !bRaceTimedOut && !bSideJob)
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
                        RecordRaceResult();
                        CompletedMissions = 2;
                        SaveBoundary();
                        ChangePhase(EQuebecCampaignPhase::Complete);
                    }
                    if (Phase == EQuebecCampaignPhase::RaceRunning && RaceGateIndex > 1)
                        for (TActorIterator<AQuebecController> Player(GetWorld()); Player; ++Player)
                            Player->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
                    ForceNetUpdate();
                }
            }
        }
        LastCarPositions.Add(Car,Position);
    }
    for (auto It=LastCarPositions.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
    for (auto It=TrappedUntil.CreateIterator(); It; ++It) if (!It.Key().IsValid()) It.RemoveCurrent();
}

void AQuebecCampaign::ChangePhase(EQuebecCampaignPhase Next, bool bFeedback)
{
    const EQuebecCampaignPhase Previous = Phase;
    Phase = Next;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        It->ShowInteractionMessage(TEXT(""));
        if (bFeedback && Next > Previous)
            It->PlayFeedback(Next == EQuebecCampaignPhase::RaceReady || Next == EQuebecCampaignPhase::Complete
                ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    }
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
    if (QuebecDistrict::IsToronto(GetWorld()) || FParse::Param(FCommandLine::Get(),TEXT("NordNoCampaignSave"))) return;
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
    if (QuebecDistrict::IsToronto(GetWorld()) || !HasAuthority() || !Controller || !Controller->GetPawn()) return;
    if (Phase == EQuebecCampaignPhase::Complete)
    {
        if (IsPondOpen())
        {
            const QuebecPondRules::FSpot Spot = QuebecPondRules::RecoverAt(PondStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
            {
                PondSamples.Remove(Controller);
                Controller->ShowInteractionMessage(TEXT("This step restored. The reflection stays where you left it."));
            }
            return;
        }
        if (IsCourtOpen())
        {
            const QuebecCourtRules::FSpot Spot = QuebecCourtRules::RecoverAt(CourtStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This rally restored. The gold panel still loops."));
            return;
        }
        if (IsShowOpen())
        {
            const QuebecShowRules::FSpot Spot = QuebecShowRules::RecoverAt(ShowStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This cue restored. The stations you finished stay set."));
            return;
        }
        if (IsRescueOpen())
        {
            const QuebecRescueRules::FSpot Spot = QuebecRescueRules::RecoverAt(RescueMask);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This group restored. The groups you freed stay out."));
            return;
        }
        if (IsConvoyOpen())
        {
            const QuebecConvoyRules::FSpot Spot = QuebecConvoyRules::RecoverAt(ConvoyStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This wagon restored. The disruptions you finished stay banked."));
            return;
        }
        if (IsBlankOpen())
        {
            const QuebecBlankRules::FSpot Spot = QuebecBlankRules::RecoverAt(BlankStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This page restored. The gates you crossed stay crossed."));
            return;
        }
        Controller->ShowInteractionMessage(TEXT("The last page is blank. T replays the race."));
        return;
    }
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
        if (RaceGateIndex > 0) ChangePhase(EQuebecCampaignPhase::RaceRunning, false);
    }
    ForceNetUpdate();
}

void AQuebecCampaign::RequestReplay(AQuebecController* Controller)
{
    if (QuebecDistrict::IsToronto(GetWorld()) || !HasAuthority() || !Controller || Phase != EQuebecCampaignPhase::Complete) return;
    if (IsPondOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The picnic is still in the picture. T replays the race after it is free."));
        return;
    }
    if (IsCourtOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The match is still looping. T replays the race after the court is free."));
        return;
    }
    if (IsShowOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The ovation is still open. T replays the race after the curtain."));
        return;
    }
    if (IsRescueOpen())
    {
        Controller->ShowInteractionMessage(TEXT("People are still in the picture. T replays the race after the last group is out."));
        return;
    }
    if (IsConvoyOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The convoy is still drawing the border. T replays the race after the escape."));
        return;
    }
    if (IsBlankOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The last page is still his. T replays the race after it is blank."));
        return;
    }
    // A race replay does not rewind PondStep, CourtStep, ShowStep, RescueMask, ConvoyStep or BlankStep. Banked scenes stay banked for this session.
    RaceGateIndex = 0;
    RaceElapsed = 0.f;
    bRaceRetried = false;
    bRaceTimedOut = false;
    LastCarPositions.Reset();
    TrappedUntil.Reset();
    ChangePhase(EQuebecCampaignPhase::RaceReady);
    RequestRetry(Controller);
    bRaceRetried = false;
    Controller->ShowInteractionMessage(TEXT("Race replay ready. The banked scenes stay banked."));
}

void AQuebecCampaign::RecordRaceResult()
{
    if (!HasAuthority() || !FMath::IsFinite(RaceElapsed) || RaceElapsed <= 0.f || RaceElapsed > RaceTimeLimit) return;
    LastRaceTime = RaceElapsed;
    bLastRaceRetried = bRaceRetried;
    if (!bRaceRetried && (BestCleanRaceTime <= 0.f || RaceElapsed < BestCleanRaceTime))
        BestCleanRaceTime = RaceElapsed;
}

FString AQuebecCampaign::GetInteractionPrompt(const AQuebecController* Controller) const
{
    if (IsPondOpen())
    {
        if (PondStep == QuebecPondRules::StepTag)
        {
            for (int32 Beam = 0; Beam < QuebecPondRules::BeamCount; ++Beam)
                if (NearPond(Controller, QuebecPondRules::Beams[Beam].X, QuebecPondRules::Beams[Beam].Y))
                    return TEXT("E: tag this beam");
        }
        else if (PondStep == QuebecPondRules::StepNear && NearPond(Controller, QuebecPondRules::NearLock.X, QuebecPondRules::NearLock.Y))
            return TEXT("E: set the worklight");
        else if (PondStep == QuebecPondRules::StepFar && NearPond(Controller, QuebecPondRules::FarLock.X, QuebecPondRules::FarLock.Y))
            return TEXT("E: set the worklight");
        else if (PondStep == QuebecPondRules::StepPull && NearPond(Controller, QuebecPondRules::Picnic.X, QuebecPondRules::Picnic.Y))
            return TEXT("E: pull the picnic clamp");
        return FString();
    }
    if (IsCourtOpen())
    {
        if (CourtStep == QuebecCourtRules::StepRally)
        {
            for (int32 Panel = 0; Panel < QuebecCourtRules::PanelCount; ++Panel)
            {
                const QuebecCourtRules::FSpot& Spot = QuebecCourtRules::Panels[Panel];
                if (NearCourt(Controller, Spot.X, Spot.Y)) return TEXT("E: score this panel");
            }
        }
        else if (CourtStep == QuebecCourtRules::StepRedirect)
        {
            const QuebecCourtRules::FSpot& Gold = QuebecCourtRules::Panels[QuebecCourtRules::GoldPanel];
            if (NearCourt(Controller, Gold.X, Gold.Y)) return TEXT("E: the gold panel restarts the point");
            if (NearCourt(Controller, QuebecCourtRules::ReturnGate.X, QuebecCourtRules::ReturnGate.Y)) return TEXT("E: bank the ball");
        }
        else if (CourtStep == QuebecCourtRules::StepPull && NearCourt(Controller, QuebecCourtRules::Clamp.X, QuebecCourtRules::Clamp.Y))
            return TEXT("E: pull the court clamp");
        return FString();
    }
    if (IsShowOpen())
    {
        if ((ShowStep == QuebecShowRules::StepChoice || ShowStep == QuebecShowRules::StepDrop)
            && NearShow(Controller, QuebecShowRules::Followspot.X, QuebecShowRules::Followspot.Y))
            return TEXT("E: set the followspot");
        if ((ShowStep == QuebecShowRules::StepChoice || ShowStep == QuebecShowRules::StepSpot)
            && NearShow(Controller, QuebecShowRules::Backdrop.X, QuebecShowRules::Backdrop.Y))
            return TEXT("E: hang the backdrop");
        if (ShowStep == QuebecShowRules::StepCue && NearShow(Controller, QuebecShowRules::Loading.X, QuebecShowRules::Loading.Y))
            return TEXT("E: call the curtain");
        return FString();
    }
    if (IsRescueOpen())
    {
        for (int32 Group = 0; Group < QuebecRescueRules::GroupCount; ++Group)
        {
            const QuebecRescueRules::FSpot& Spot = QuebecRescueRules::Posts[Group];
            if (!NearRescue(Controller, Spot.X, Spot.Y)) continue;
            return QuebecRescueRules::GroupOpen(RescueMask, Group)
                ? TEXT("E: free this group")
                : TEXT("That group is already out.");
        }
        return FString();
    }
    if (IsConvoyOpen())
    {
        if (ConvoyStep == QuebecConvoyRules::StepGap && NearConvoy(Controller, QuebecConvoyRules::Feeder.X, QuebecConvoyRules::Feeder.Y))
            return TEXT("E: pull the feeder clamp");
        if (ConvoyStep == QuebecConvoyRules::StepInvert && NearConvoy(Controller, QuebecConvoyRules::Projector.X, QuebecConvoyRules::Projector.Y))
            return TEXT("E: invert the plate");
        if (ConvoyStep == QuebecConvoyRules::StepEscape && NearConvoy(Controller, QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y))
            return TEXT("E: take the escape gate");
        return FString();
    }
    if (IsBlankOpen())
    {
        if (BlankStep == QuebecBlankRules::StepCue && NearBlank(Controller, QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y))
            return TEXT("E: leave the page blank");
        return FString();
    }
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
    if (IsPondOpen()) return TEXT("03 / STILL LIFE, MOVING TARGET");
    if (IsCourtOpen()) return TEXT("04 / MATCH POINTLESS");
    if (IsShowOpen()) return TEXT("05 / STANDING OVATION");
    if (IsRescueOpen()) return TEXT("06 / NOBODY LEFT IN THE PICTURE");
    if (IsConvoyOpen()) return TEXT("07 / CAN'T TOW TOMORROW");
    if (IsBlankOpen()) return TEXT("08 / LEAVE THE LAST PAGE BLANK");
    if (Phase == EQuebecCampaignPhase::Complete) return TEXT("THE PARK IS OPEN");
    return Phase <= EQuebecCampaignPhase::ReleaseTable ? TEXT("01 / A TABLE FOR ETERNITY") : TEXT("02 / NO SUCH THING AS A QUIET LAP");
}

FString AQuebecCampaign::GetObjectiveText() const
{
    if (IsPondOpen())
    {
        switch (PondStep)
        {
        case QuebecPondRules::StepShore: return TEXT("Walk to the north shore lookout");
        case QuebecPondRules::StepTag: return TEXT("Tag the beam that never blinks");
        case QuebecPondRules::StepNear: return TEXT("Set the worklight on the near lock");
        case QuebecPondRules::StepFar: return TEXT("Set the worklight on the far lock");
        case QuebecPondRules::StepDash: return TEXT("Sprint the exposed path");
        case QuebecPondRules::StepPull: return TEXT("Pull the picnic clamp");
        default: break;
        }
    }
    if (IsCourtOpen())
    {
        switch (CourtStep)
        {
        case QuebecCourtRules::StepArrive: return TEXT("Walk to the exhibition court");
        case QuebecCourtRules::StepRally: return TEXT("Score the gold panel once. It restarts the rally.");
        case QuebecCourtRules::StepRedirect: return TEXT("Bank the ball into the return gate, not the gold panel.");
        case QuebecCourtRules::StepPull: return TEXT("Pull the court clamp");
        default: break;
        }
    }
    if (IsShowOpen())
    {
        switch (ShowStep)
        {
        case QuebecShowRules::StepArrive: return TEXT("Walk to the loading edge");
        case QuebecShowRules::StepChoice: return TEXT("Set the followspot or hang the backdrop. Either one first.");
        case QuebecShowRules::StepSpot: return TEXT("Hang the backdrop");
        case QuebecShowRules::StepDrop: return TEXT("Set the followspot");
        case QuebecShowRules::StepCue: return TEXT("Call the curtain from the loading edge");
        default: break;
        }
    }
    if (IsRescueOpen())
    {
        const bool bTerrace = QuebecRescueRules::GroupOpen(RescueMask, QuebecRescueRules::GroupTerrace);
        const bool bPond = QuebecRescueRules::GroupOpen(RescueMask, QuebecRescueRules::GroupPond);
        const bool bCourt = QuebecRescueRules::GroupOpen(RescueMask, QuebecRescueRules::GroupCourt);
        if (bTerrace && bPond && bCourt) return TEXT("Free the terrace, the pond, or the court. Any order.");
        if (bTerrace && bPond) return TEXT("Free the terrace or the pond.");
        if (bTerrace && bCourt) return TEXT("Free the terrace or the court.");
        if (bPond && bCourt) return TEXT("Free the pond or the court.");
        if (bTerrace) return TEXT("Free the terrace.");
        if (bPond) return TEXT("Free the pond.");
        if (bCourt) return TEXT("Free the court.");
    }
    if (IsConvoyOpen())
    {
        switch (ConvoyStep)
        {
        case QuebecConvoyRules::StepArrive: return TEXT("Walk to the ink feeder's bay");
        case QuebecConvoyRules::StepGap: return TEXT("Pull the feeder clamp when the beam gap is open");
        case QuebecConvoyRules::StepInvert: return TEXT("Invert the projector plate");
        case QuebecConvoyRules::StepEscape: return TEXT("Take the escape gate");
        default: break;
        }
    }
    if (IsBlankOpen())
    {
        switch (BlankStep)
        {
        case QuebecBlankRules::StepGateA: return TEXT("Walk through the first projection gate");
        case QuebecBlankRules::StepGateB: return TEXT("Walk through the second projection gate");
        case QuebecBlankRules::StepGateC: return TEXT("Walk through the third projection gate");
        case QuebecBlankRules::StepCue: return TEXT("Leave the last page blank");
        default: break;
        }
    }
    if (Phase == EQuebecCampaignPhase::Complete) return TEXT("The last page is blank / T: replay the race");
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
    if (IsPondOpen())
    {
        switch (PondStep)
        {
        case QuebecPondRules::StepShore: return TEXT("CURATOR: Every summer, held still. LIME JACKET: The pond is a postcard. Walk the north shore and watch it.");
        case QuebecPondRules::StepTag: return TEXT("SKULL SHIRT: Two of those beams blink with the sky. The postcard does not. Tag the one that stays.");
        case QuebecPondRules::StepNear: return TEXT("LIME JACKET: Worklight on the near lock. That perfect sheet should peel.");
        case QuebecPondRules::StepFar: return TEXT("WHITE CAP: It peeled east. The far lock is on the new path. Check the people before you chase anyone.");
        case QuebecPondRules::StepDash: return TEXT("TOPKNOT: Sprint. Walking leaves you in the picture with the toast.");
        case QuebecPondRules::StepPull: return TEXT("LIME JACKET: That is the real clamp. Pull. They have been toasting the same glass for hours.");
        default: break;
        }
    }
    if (IsCourtOpen())
    {
        switch (CourtStep)
        {
        case QuebecCourtRules::StepArrive: return TEXT("RED JERSEY: One point from perfect. CURATOR: The exhibition will finish itself. Walk onto the court.");
        case QuebecCourtRules::StepRally: return TEXT("The gold panel restarts the rally. Score it once so the loop is obvious.");
        case QuebecCourtRules::StepRedirect: return TEXT("RED JERSEY: I wanted to win that. Bank the ball into the return gate while the ink is off the line.");
        case QuebecCourtRules::StepPull: return TEXT("The referee is writing a penalty on the light. Pull the clamp. The players can sit up.");
        default: break;
        }
    }
    if (IsShowOpen())
    {
        switch (ShowStep)
        {
        case QuebecShowRules::StepArrive: return TEXT("The crew brought the lights back. CURATOR: The show can still be perfect. Walk to the loading edge.");
        case QuebecShowRules::StepChoice: return TEXT("RED JERSEY: Followspot or backdrop, I don't mind the order. Just don't let him write the ending.");
        case QuebecShowRules::StepSpot: return TEXT("The followspot is up. The backdrop is still a blank sheet.");
        case QuebecShowRules::StepDrop: return TEXT("The backdrop is ridiculous and up. The followspot is still dark.");
        case QuebecShowRules::StepCue: return TEXT("Everyone is off the page. Call the curtain from the loading edge.");
        default: break;
        }
    }
    if (IsRescueOpen())
    {
        const int32 Open = (QuebecRescueRules::GroupOpen(RescueMask, QuebecRescueRules::GroupTerrace) ? 1 : 0)
            + (QuebecRescueRules::GroupOpen(RescueMask, QuebecRescueRules::GroupPond) ? 1 : 0)
            + (QuebecRescueRules::GroupOpen(RescueMask, QuebecRescueRules::GroupCourt) ? 1 : 0);
        if (Open >= 3) return TEXT("WHITE CAP: The earlier rescues were real. The captured endings survived. Three groups are still in the pictures.");
        if (Open == 2) return TEXT("WHITE CAP: Two groups are still in the pictures. The ones you freed stay out.");
        return TEXT("WHITE CAP: One group left. MEMPHIS: Then we get our park back.");
    }
    if (IsConvoyOpen())
    {
        switch (ConvoyStep)
        {
        case QuebecConvoyRules::StepArrive: return TEXT("GREEN CAP: One wagon lays the border, one feeds it ink, one carries the projector. Walk to the feeder.");
        case QuebecConvoyRules::StepGap: return TEXT("The beam paints, then leaves a gap. Pull the clamp in the gap. The warning still lets the pull land.");
        case QuebecConvoyRules::StepInvert: return TEXT("The feed is stalled. Invert the plate. Blank panels are the opening.");
        case QuebecConvoyRules::StepEscape: return TEXT("GREEN CAP: Take the gate I called. TOPKNOT: Or the one that is actually clear.");
        default: break;
        }
    }
    if (IsBlankOpen())
    {
        switch (BlankStep)
        {
        case QuebecBlankRules::StepGateA: return TEXT("The projector's blank panels cut his route. Walk the first gate. He has to come back to the stage.");
        case QuebecBlankRules::StepGateB: return TEXT("One gate is blank. Two of his lines are still connected.");
        case QuebecBlankRules::StepGateC: return TEXT("Two gates are blank. One line is left, and then the page.");
        case QuebecBlankRules::StepCue: return TEXT("CURATOR: A moment this lovely should never move. MEMPHIS: Leave the last page blank.");
        default: break;
        }
    }
    if (Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep && BlankStep >= BlankBankedStep)
        return TEXT("The last page is blank. The park keeps the day that was not in his book.");
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
    if (IsPondOpen()) return TEXT("R recovers this step");
    if (IsCourtOpen()) return TEXT("R recovers this rally");
    if (IsShowOpen()) return TEXT("R recovers this cue");
    if (IsRescueOpen()) return TEXT("R recovers this group");
    if (IsConvoyOpen()) return TEXT("R recovers this wagon");
    if (IsBlankOpen()) return TEXT("R recovers this page");
    if (Phase == EQuebecCampaignPhase::AimWorklight) return FString::Printf(TEXT("Alignment %d%% / hold %d%%"),FMath::RoundToInt(LightAlignment*100.f),FMath::RoundToInt(LightHoldProgress*100.f));
    if (Phase == EQuebecCampaignPhase::CrossCable) return FString::Printf(TEXT("Sprint %s / jump %s / R: recover"),bSprintSeen?TEXT("banked"):TEXT("needed"),bJumpSeen?TEXT("banked"):TEXT("needed"));
    if (Phase == EQuebecCampaignPhase::PullClamp || Phase == EQuebecCampaignPhase::ReleaseTable) return bClampOpen ? TEXT("GREEN BEAT / pull now / R: recover") : TEXT("Press squeezing / wait for green / R: recover");
    if (Phase == EQuebecCampaignPhase::RaceRunning) return FString::Printf(TEXT("%.1fs / %.0fs / gate %d of 6 / R: recover"),RaceElapsed,RaceTimeLimit,RaceGateIndex);
    if (Phase == EQuebecCampaignPhase::Complete && LastRaceTime > 0.f)
    {
        const FString Best = BestCleanRaceTime > 0.f ? FString::Printf(TEXT("best clean %.1fs"), BestCleanRaceTime) : TEXT("no clean best yet");
        return FString::Printf(TEXT("Lap %.1fs / %s / %s / T: replay"), LastRaceTime,
            bLastRaceRetried ? TEXT("recovered") : TEXT("clean"), *Best);
    }
    if (Phase == EQuebecCampaignPhase::Complete) return TEXT("Shared progress saved / T: replay");
    return TEXT("Shared checkpoints / R: recover");
}

FVector AQuebecCampaign::GetObjectiveLocation() const
{
    if (IsPondOpen())
    {
        const QuebecPondRules::FSpot Spot = QuebecPondRules::Objective(PondStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsCourtOpen())
    {
        const QuebecCourtRules::FSpot Spot = QuebecCourtRules::Objective(CourtStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsShowOpen())
    {
        const QuebecShowRules::FSpot Spot = QuebecShowRules::Objective(ShowStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsRescueOpen())
    {
        const QuebecRescueRules::FSpot Spot = QuebecRescueRules::Objective(RescueMask);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsConvoyOpen())
    {
        const QuebecConvoyRules::FSpot Spot = QuebecConvoyRules::Objective(ConvoyStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsBlankOpen())
    {
        const QuebecBlankRules::FSpot Spot = QuebecBlankRules::Objective(BlankStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
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

bool AQuebecCampaign::GetNextObjectiveLocation(FVector& Out) const
{
    const auto At = [](double X, double Y) { return FVector(X, Y, 100.); };
    if (IsPondOpen())
    {
        if (PondStep + 1 >= PondBankedStep) return false;
        const QuebecPondRules::FSpot Spot = QuebecPondRules::Objective(PondStep + 1);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (IsCourtOpen())
    {
        if (CourtStep + 1 >= CourtBankedStep) return false;
        const QuebecCourtRules::FSpot Spot = QuebecCourtRules::Objective(CourtStep + 1);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (IsShowOpen())
    {
        const int32 Next = QuebecShowRules::NextStep(ShowStep);
        if (Next < 0) return false;
        const QuebecShowRules::FSpot Spot = QuebecShowRules::Objective(Next);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (IsRescueOpen()) return false;
    if (IsConvoyOpen())
    {
        if (ConvoyStep + 1 >= ConvoyBankedStep) return false;
        const QuebecConvoyRules::FSpot Spot = QuebecConvoyRules::Objective(ConvoyStep + 1);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (IsBlankOpen())
    {
        if (BlankStep + 1 >= BlankBankedStep) return false;
        const QuebecBlankRules::FSpot Spot = QuebecBlankRules::Objective(BlankStep + 1);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (Phase == EQuebecCampaignPhase::Complete) return false;
    switch (Phase)
    {
    case EQuebecCampaignPhase::AimWorklight: Out = JumpGateLocation; return true;
    case EQuebecCampaignPhase::CrossCable: Out = FirstClampLocation; return true;
    case EQuebecCampaignPhase::PullClamp: Out = CarLightLocation; return true;
    case EQuebecCampaignPhase::ParkCarLight: Out = FinalClampLocation; return true;
    case EQuebecCampaignPhase::ReleaseTable:
        if (RaceGates.Num() == 0) return false;
        Out = RaceGates[0];
        return true;
    case EQuebecCampaignPhase::RaceReady:
        if (RaceGates.Num() < 2) return false;
        Out = RaceGates[1];
        return true;
    case EQuebecCampaignPhase::RaceRunning:
    {
        const int32 Index = FMath::Clamp(RaceGateIndex, 0, FMath::Max(RaceGates.Num() - 1, 0)) + 1;
        if (!RaceGates.IsValidIndex(Index)) return false;
        Out = RaceGates[Index];
        return true;
    }
    default: return false;
    }
}

bool AQuebecCampaign::GetBeatPace(int32& OutIndex, int32& OutCount, int32& OutWalkSeconds) const
{
    const auto Publish = [&](const QuebecPace::FBeat& Beat)
    {
        if (Beat.Count <= 0) return false;
        OutIndex = Beat.Index;
        OutCount = Beat.Count;
        OutWalkSeconds = Beat.WalkSeconds;
        if (Beat.bMeasureWalk)
        {
            FVector Next = FVector::ZeroVector;
            OutWalkSeconds = 0;
            if (GetNextObjectiveLocation(Next))
                OutWalkSeconds = QuebecPace::WalkSeconds(static_cast<double>(FVector::Dist2D(GetObjectiveLocation(), Next)));
        }
        return true;
    };
    if (IsPondOpen()) return Publish(QuebecPace::Linear(PondStep, QuebecPondRules::StepBanked, QuebecPondRules::Objective));
    if (IsCourtOpen()) return Publish(QuebecPace::Linear(CourtStep, QuebecCourtRules::StepBanked, QuebecCourtRules::Objective));
    if (IsShowOpen()) return Publish(QuebecPace::Show(ShowStep));
    if (IsRescueOpen()) return Publish(QuebecPace::Rescue(RescueMask));
    if (IsConvoyOpen()) return Publish(QuebecPace::Linear(ConvoyStep, QuebecConvoyRules::StepBanked, QuebecConvoyRules::Objective));
    if (IsBlankOpen()) return Publish(QuebecPace::Linear(BlankStep, QuebecBlankRules::StepBanked, QuebecBlankRules::Objective));
    if (Phase == EQuebecCampaignPhase::Complete || Phase >= EQuebecCampaignPhase::RaceReady) return false;
    return Publish(QuebecPace::Terrace(static_cast<int>(Phase)));
}

void AQuebecCampaign::UpdatePresentation()
{
    if (!bBuilt || QuebecDistrict::IsToronto(GetWorld())) return;
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
    if (PondParts.Num() == QuebecPondRules::PartCount)
    {
        const AGameStateBase* PondState = GetWorld()->GetGameState();
        const double PondTime = static_cast<double>(PondState ? PondState->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds());
        const bool bPondWorld = Phase == EQuebecCampaignPhase::Complete;
        for (int32 Index = 0; Index < PondParts.Num(); ++Index)
        {
            const bool bShow = bPondWorld && QuebecPondRules::PartVisible(PondStep, Index, PondTime);
            PondParts[Index]->SetVisibility(bShow);
            if (PondCaptions.IsValidIndex(Index)) PondCaptions[Index]->SetVisibility(bShow);
        }
    }
    if (CourtParts.Num() == QuebecCourtRules::PartCount)
    {
        const AGameStateBase* CourtState = GetWorld()->GetGameState();
        const double CourtTime = static_cast<double>(CourtState ? CourtState->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds());
        const bool bCourtWorld = Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep;
        for (int32 Index = 0; Index < CourtParts.Num(); ++Index)
        {
            const bool bShow = bCourtWorld && QuebecCourtRules::PartVisible(CourtStep, Index, CourtTime);
            CourtParts[Index]->SetVisibility(bShow);
            if (CourtCaptions.IsValidIndex(Index)) CourtCaptions[Index]->SetVisibility(bShow);
        }
        const QuebecCourtRules::FSpot Ball = QuebecCourtRules::BallSpot(CourtTime);
        CourtParts[QuebecCourtRules::PartBall]->SetWorldLocation(FVector(Ball.X, Ball.Y, 140.));
    }
    if (ShowParts.Num() == QuebecShowRules::PartCount)
    {
        const bool bShowWorld = Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep;
        for (int32 Index = 0; Index < ShowParts.Num(); ++Index)
        {
            const bool bShow = bShowWorld && QuebecShowRules::PartVisible(ShowStep, Index);
            ShowParts[Index]->SetVisibility(bShow);
            if (ShowCaptions.IsValidIndex(Index)) ShowCaptions[Index]->SetVisibility(bShow);
        }
    }
    if (RescueParts.Num() == QuebecRescueRules::GroupCount)
    {
        const bool bRescueWorld = Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep
            && CourtStep >= CourtBankedStep && ShowStep >= ShowBankedStep;
        for (int32 Index = 0; Index < RescueParts.Num(); ++Index)
        {
            const bool bShow = bRescueWorld && QuebecRescueRules::PartVisible(Index);
            RescueParts[Index]->SetVisibility(bShow);
            if (RescueCaptions.IsValidIndex(Index)) RescueCaptions[Index]->SetVisibility(bShow);
        }
    }
    if (ConvoyParts.Num() == QuebecConvoyRules::PartCount)
    {
        const AGameStateBase* ConvoyState = GetWorld()->GetGameState();
        const double ConvoyTime = static_cast<double>(ConvoyState ? ConvoyState->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds());
        const bool bConvoyWorld = Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep
            && CourtStep >= CourtBankedStep && ShowStep >= ShowBankedStep && RescueMask >= RescueDone;
        for (int32 Index = 0; Index < ConvoyParts.Num(); ++Index)
        {
            const bool bShow = bConvoyWorld && QuebecConvoyRules::PartVisible(ConvoyStep, Index, ConvoyTime);
            ConvoyParts[Index]->SetVisibility(bShow);
            if (ConvoyCaptions.IsValidIndex(Index)) ConvoyCaptions[Index]->SetVisibility(bShow);
        }
    }
    if (BlankParts.Num() == QuebecBlankRules::PartCount)
    {
        const bool bBlankWorld = Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep
            && CourtStep >= CourtBankedStep && ShowStep >= ShowBankedStep && RescueMask >= RescueDone
            && ConvoyStep >= ConvoyBankedStep;
        for (int32 Index = 0; Index < BlankParts.Num(); ++Index)
        {
            const bool bShow = bBlankWorld && QuebecBlankRules::PartVisible(BlankStep, Index);
            BlankParts[Index]->SetVisibility(bShow);
            if (BlankCaptions.IsValidIndex(Index)) BlankCaptions[Index]->SetVisibility(bShow);
        }
    }
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
    DOREPLIFETIME(AQuebecCampaign,PondStep);
    DOREPLIFETIME(AQuebecCampaign,CourtStep);
    DOREPLIFETIME(AQuebecCampaign,CourtMisses);
    DOREPLIFETIME(AQuebecCampaign,ShowStep);
    DOREPLIFETIME(AQuebecCampaign,RescueMask);
    DOREPLIFETIME(AQuebecCampaign,ConvoyStep);
    DOREPLIFETIME(AQuebecCampaign,BlankStep);
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
    DOREPLIFETIME(AQuebecCampaign,LastRaceTime);
    DOREPLIFETIME(AQuebecCampaign,BestCleanRaceTime);
    DOREPLIFETIME(AQuebecCampaign,bLastRaceRetried);
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
