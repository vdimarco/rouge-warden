#include "QuebecCampaign.h"
#include "QuebecStorySave.h"
#include "QuebecGameplay.h"
#include "QuebecGTA.h" // Side jobs: QuebecJobs::IsJobActive for the race gate guard (JOBS).
#include "QuebecBlankRules.h"
#include "QuebecTour.h"
#include "QuebecHome.h"
#include "QuebecEscort.h"
#include "QuebecShade.h"
#include "QuebecGrab.h"
#include "QuebecCut.h"
#include "QuebecChase.h"
#include "QuebecFinale.h"
#include "QuebecFollow.h"
#include "QuebecChain.h"
#include "QuebecPace.h"
#include "QuebecConvoyRules.h"
#include "QuebecCourtRules.h"
#include "QuebecPondRules.h"
#include "QuebecRescueRules.h"
#include "QuebecShowRules.h"
#include "QuebecSky.h"
#include "QuebecPlayerState.h"

static_assert(QuebecPondRules::StepBanked == AQuebecCampaign::PondBankedStep,
    "mission 3 and the story tail share one banked index");
static_assert(QuebecCourtRules::StepBanked == AQuebecCampaign::CourtBankedStep,
    "mission 4 and the story tail share one banked index");
static_assert(QuebecShowRules::StepBanked == AQuebecCampaign::ShowBankedStep,
    "mission 5 and the story tail share one banked index");
static_assert(QuebecRescueRules::Done == AQuebecCampaign::RescueDone,
    "mission 6 and the story tail share one done mask");
static_assert(QuebecConvoyRules::StepBanked == AQuebecCampaign::ConvoyBankedStep,
    "mission 7 and the story tail share one banked index");
static_assert(QuebecBlankRules::StepBanked == AQuebecCampaign::BlankBankedStep,
    "mission 8 and the story tail share one banked index");
static_assert(QuebecTour::StepBanked == AQuebecCampaign::TourBankedStep,
    "mission 9 and the story tail share one banked index");
static_assert(QuebecHome::StepBanked == AQuebecCampaign::HomeBankedStep,
    "mission 10 and the story tail share one banked index");
static_assert(QuebecStorySave::PondBanked == AQuebecCampaign::PondBankedStep, "the story tail left the pond bank");
static_assert(QuebecStorySave::CourtBanked == AQuebecCampaign::CourtBankedStep, "the story tail left the court bank");
static_assert(QuebecStorySave::ShowBanked == AQuebecCampaign::ShowBankedStep, "the story tail left the show bank");
static_assert(QuebecStorySave::RescueDone == AQuebecCampaign::RescueDone, "the story tail left the rescue mask");
static_assert(QuebecStorySave::ConvoyBanked == AQuebecCampaign::ConvoyBankedStep, "the story tail left the convoy bank");
static_assert(QuebecStorySave::BlankBanked == AQuebecCampaign::BlankBankedStep, "the story tail left the blank-page bank");
static_assert(QuebecStorySave::TourBanked == AQuebecCampaign::TourBankedStep, "the story tail left the tour bank");
static_assert(QuebecStorySave::HomeBanked == AQuebecCampaign::HomeBankedStep, "the story tail left the home bank");
static_assert(QuebecEscort::StepBanked == AQuebecCampaign::EscortBankedStep, "mission 11 and the story tail share one banked index");
static_assert(QuebecStorySave::EscortBanked == AQuebecCampaign::EscortBankedStep, "the story tail left the escort bank");
static_assert(QuebecEscort::MeetX == 29600. && QuebecEscort::MeetY == 16800., "the coat left the saved meet");
static_assert(QuebecShade::StepBanked == AQuebecCampaign::ShadeBankedStep, "mission 12 and the story tail share one banked index");
static_assert(QuebecStorySave::ShadeBanked == AQuebecCampaign::ShadeBankedStep, "the story tail left the shade bank");
static_assert(QuebecShade::PocketX == 50700. && QuebecShade::PocketY == 14500., "the dark pocket left the lawn");
static_assert(QuebecGrab::StepBanked == AQuebecCampaign::GrabBankedStep, "mission 13 and the story tail share one banked index");
static_assert(QuebecStorySave::GrabBanked == AQuebecCampaign::GrabBankedStep, "the story tail left the grab bank");
static_assert(QuebecGrab::CaseX == 36000. && QuebecGrab::CaseY == 14000., "the case left the lawn");
static_assert(QuebecCut::StepBanked == AQuebecCampaign::CutBankedStep, "mission 14 and the story tail share one banked index");
static_assert(QuebecStorySave::CutBanked == AQuebecCampaign::CutBankedStep, "the story tail left the short way");
static_assert(QuebecCut::StartX == 24000. && QuebecCut::StartY == 18000., "the line left the lawn");
static_assert(QuebecChase::StepBanked == AQuebecCampaign::ChaseBankedStep, "mission 15 and the story tail share one banked index");
static_assert(QuebecStorySave::ChaseBanked == AQuebecCampaign::ChaseBankedStep, "the story tail left the chase");
static_assert(QuebecChase::CountsAsCar(0) && !QuebecChase::CountsAsCar(1), "only a car takes the seat");
static_assert(QuebecFinale::StepBanked == AQuebecCampaign::FinaleBankedStep, "mission 16 and the story tail share one banked index");
static_assert(QuebecStorySave::FinaleBanked == AQuebecCampaign::FinaleBankedStep, "the story tail left the day");
static_assert(QuebecFinale::CountsAsCar(0) && !QuebecFinale::CountsAsCar(1), "only a car takes the last seat");
static_assert(QuebecFinale::ColumnX == 32800. && QuebecFinale::MeetY == 19000., "the meet left the lawn");
static_assert(QuebecFollow::StepBanked == AQuebecCampaign::FollowBankedStep, "mission 17 and the story tail share one banked index");
static_assert(QuebecStorySave::FollowBanked == AQuebecCampaign::FollowBankedStep, "the story tail left the gap");
static_assert(QuebecFollow::Speed == QuebecPace::WalkCmPerSecond, "a matched walk would change the gap");
static_assert(QuebecFollow::CornerX == 20000. && QuebecFollow::CornerY == 22000., "the corner left the north lawn");
static_assert(QuebecStorySave::Current != QuebecStorySave::Rejected, "the writer would plant the unsupported fixture");

static FString WithClose(const TCHAR* Line, int32 Bonus)
{
    if (Bonus <= 0 || !Line) return FString(Line);
    return FString(Line) + FString::Printf(TEXT(" Close +$%d."), Bonus);
}

static FString ChainHitText(int32 Pay, int32 ChainNow, bool bWasSpoiled, const TCHAR* Prefix)
{
    const TCHAR* Rank = ANSI_TO_TCHAR(QuebecChain::Callout(static_cast<int>(ChainNow), bWasSpoiled));
    if (bWasSpoiled)
        return FString::Printf(TEXT("%s+$%d · chain broken · %s"), Prefix, Pay, Rank);
    return FString::Printf(TEXT("%s+$%d · chain %d · %s"), Prefix, Pay, ChainNow, Rank);
}

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
                const QuebecStorySave::FSteps Steps = QuebecStorySave::Applied(Save->Version, {
                    Save->PondStep, Save->CourtStep, Save->ShowStep, Save->RescueMask,
                    Save->ConvoyStep, Save->BlankStep, Save->TourStep, Save->HomeStep, Save->EscortStep, Save->ShadeStep, Save->GrabStep, Save->CutStep, Save->ChaseStep, Save->FinaleStep, Save->FollowStep});
                PondStep = Steps.Pond;
                CourtStep = Steps.Court;
                ShowStep = Steps.Show;
                RescueMask = Steps.Rescue;
                ConvoyStep = Steps.Convoy;
                BlankStep = Steps.Blank;
                TourStep = Steps.Tour;
                HomeStep = Steps.Home;
                EscortStep = Steps.Escort;
                ShadeStep = Steps.Shade;
                GrabStep = Steps.Grab;
                CutStep = Steps.Cut;
                ChaseStep = Steps.Chase;
                FinaleStep = Steps.Finale;
                FollowStep = Steps.Follow;
                // The coat's place is not in the slot. A walk in progress starts again at the meet.
                EscortFriendX = static_cast<float>(EscortStep >= EscortBankedStep ? QuebecEscort::DoorX : QuebecEscort::MeetX);
                EscortFriendY = static_cast<float>(EscortStep >= EscortBankedStep ? QuebecEscort::DoorY : QuebecEscort::MeetY);
                bEscortPlanted = false;
                // A lamp burn is not in the slot. A reload clears it.
                bShadeBurned = false;
                // The grab clock is not in the slot. A reload during the run gives the full window again.
                GrabElapsed = 0.f;
                // The rival's clock is not in the slot. A reload during the race puts them back on the line.
                CutElapsed = 0.f;
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
        // The tail's place is not in the slot. A chase in progress starts again behind the seat.
        const QuebecChase::FTail Parked = QuebecChase::Park();
        ChaseTailX = static_cast<float>(Parked.X);
        ChaseTailY = static_cast<float>(Parked.Y);
        // The day's clocks are not in the slot. A reload keeps the stage and clears the burn, the page, the cut, and the tail.
        bFinaleBurned = false;
        bFinaleHolding = false;
        bFinaleRacing = false;
        bFinaleTailing = false;
        FinaleElapsed = 0.f;
        const QuebecFinale::FDay ParkedDay = QuebecFinale::Park();
        FinaleTailX = static_cast<float>(ParkedDay.TailX);
        FinaleTailY = static_cast<float>(ParkedDay.TailY);
        // Their place on the path is not in the slot. A walk in progress starts again at the corner.
        FollowAlong = 0.f;
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
    ConvoyParts.Add(AddPart(TEXT("ConvoyCalled"), Cube, ConvoyAt(QuebecConvoyRules::Called, 110.), FVector(36., 36., 220.), Berry));
    ConvoyCaptions.Add(AddCaption(TEXT("ConvoyCalledCaption"), ConvoyAt(QuebecConvoyRules::Called, 250.), TEXT("CALLED"), 18.f));

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
    BlankCaptions.Add(AddCaption(TEXT("BlankPageCaption"), BlankAt(QuebecBlankRules::Cue, 280.), TEXT("THE PAGE"), 18.f));
    BlankParts.Add(AddPart(TEXT("BlankKeep"), Cube, BlankAt(QuebecBlankRules::Keep, 110.), FVector(36., 36., 220.), Berry));
    BlankCaptions.Add(AddCaption(TEXT("BlankKeepCaption"), BlankAt(QuebecBlankRules::Keep, 250.), TEXT("KEEP"), 18.f));

    EscortCaption = AddCaption(TEXT("EscortCoat"), FVector(QuebecEscort::MeetX, QuebecEscort::MeetY, 200.), TEXT("GREY COAT"), 18.f);
    EscortDoor = AddPart(TEXT("EscortDoor"), Cube, FVector(QuebecEscort::DoorX, QuebecEscort::DoorY, 110.), FVector(36., 36., 220.), Lime);
    EscortDoorCaption = AddCaption(TEXT("EscortDoorCaption"), FVector(QuebecEscort::DoorX, QuebecEscort::DoorY, 250.), TEXT("EAST DOOR"), 18.f);

    ShadePocket = AddPart(TEXT("ShadePocket"), Cube, FVector(QuebecShade::PocketX, QuebecShade::PocketY, 40.), FVector(80., 80., 12.), Lime);
    ShadePocketCaption = AddCaption(TEXT("ShadePocketCaption"), FVector(QuebecShade::PocketX, QuebecShade::PocketY, 160.), TEXT("DARK"), 18.f);
    ShadeFar = AddPart(TEXT("ShadeFar"), Cube, FVector(QuebecShade::FarX, QuebecShade::FarY, 40.), FVector(80., 80., 12.), Berry);
    ShadeFarCaption = AddCaption(TEXT("ShadeFarCaption"), FVector(QuebecShade::FarX, QuebecShade::FarY, 160.), TEXT("SOUTH DARK"), 18.f);
    ShadeLampA = AddPart(TEXT("ShadeLampA"), Cylinder, FVector(QuebecShade::LampAX, QuebecShade::LampAY, 140.), FVector(28., 28., 280.), Gold);
    ShadeLampACaption = AddCaption(TEXT("ShadeLampACaption"), FVector(QuebecShade::LampAX, QuebecShade::LampAY, 300.), TEXT("LAMP"), 18.f);
    ShadeLampB = AddPart(TEXT("ShadeLampB"), Cylinder, FVector(QuebecShade::LampBX, QuebecShade::LampBY, 140.), FVector(28., 28., 280.), Gold);
    ShadeLampBCaption = AddCaption(TEXT("ShadeLampBCaption"), FVector(QuebecShade::LampBX, QuebecShade::LampBY, 300.), TEXT("LAMP"), 18.f);

    GrabCase = AddPart(TEXT("GrabCase"), Cube, FVector(QuebecGrab::CaseX, QuebecGrab::CaseY, 40.), FVector(70., 70., 16.), Gold);
    GrabCaseCaption = AddCaption(TEXT("GrabCaseCaption"), FVector(QuebecGrab::CaseX, QuebecGrab::CaseY, 160.), TEXT("CASE"), 18.f);
    GrabDrop = AddPart(TEXT("GrabDrop"), Cube, FVector(QuebecGrab::DropX, QuebecGrab::DropY, 40.), FVector(70., 70., 16.), Lime);
    GrabDropCaption = AddCaption(TEXT("GrabDropCaption"), FVector(QuebecGrab::DropX, QuebecGrab::DropY, 160.), TEXT("DROP"), 18.f);

    CutLine = AddPart(TEXT("CutLine"), Cube, FVector(QuebecCut::StartX, QuebecCut::StartY, 40.), FVector(70., 70., 16.), Gold);
    CutLineCaption = AddCaption(TEXT("CutLineCaption"), FVector(QuebecCut::StartX, QuebecCut::StartY, 160.), TEXT("LINE"), 18.f);
    CutFinish = AddPart(TEXT("CutFinish"), Cube, FVector(QuebecCut::FinishX, QuebecCut::FinishY, 40.), FVector(70., 70., 16.), Lime);
    CutFinishCaption = AddCaption(TEXT("CutFinishCaption"), FVector(QuebecCut::FinishX, QuebecCut::FinishY, 160.), TEXT("FINISH"), 18.f);
    CutRival = AddPart(TEXT("CutRival"), Cube, FVector(QuebecCut::StartX, QuebecCut::StartY, 90.), FVector(40., 40., 80.), Berry);
    CutRivalCaption = AddCaption(TEXT("CutRivalCaption"), FVector(QuebecCut::StartX, QuebecCut::StartY, 220.), TEXT("RIVAL"), 18.f);

    const QuebecChase::FTail ParkedTail = QuebecChase::Park();
    ChaseSeat = AddPart(TEXT("ChaseSeat"), Cube, FVector(QuebecChase::StartX, QuebecChase::StartY, 40.), FVector(70., 70., 16.), Gold);
    ChaseSeatCaption = AddCaption(TEXT("ChaseSeatCaption"), FVector(QuebecChase::StartX, QuebecChase::StartY, 160.), TEXT("SEAT"), 18.f);
    ChaseHide = AddPart(TEXT("ChaseHide"), Cube, FVector(QuebecChase::HideX, QuebecChase::HideY, 40.), FVector(70., 70., 16.), Lime);
    ChaseHideCaption = AddCaption(TEXT("ChaseHideCaption"), FVector(QuebecChase::HideX, QuebecChase::HideY, 160.), TEXT("HIDE"), 18.f);
    ChaseTail = AddPart(TEXT("ChaseTail"), Cube, FVector(ParkedTail.X, ParkedTail.Y, 90.), FVector(40., 40., 80.), Berry);
    ChaseTailCaption = AddCaption(TEXT("ChaseTailCaption"), FVector(ParkedTail.X, ParkedTail.Y, 220.), TEXT("TAIL"), 18.f);

    const QuebecFinale::FSpot FinaleMeetSpot = QuebecFinale::Meet();
    const QuebecFinale::FSpot FinalePocketSpot = QuebecFinale::Pocket();
    const QuebecFinale::FSpot FinaleFarSpot = QuebecFinale::Far();
    const QuebecFinale::FSpot FinaleCaseSpot = QuebecFinale::Case();
    const QuebecFinale::FSpot FinaleDropSpot = QuebecFinale::Drop();
    const QuebecFinale::FSpot FinaleLineSpot = QuebecFinale::Line();
    const QuebecFinale::FSpot FinaleFinishSpot = QuebecFinale::Finish();
    const QuebecFinale::FSpot FinaleSeatSpot = QuebecFinale::Seat();
    const QuebecFinale::FSpot FinaleHideSpot = QuebecFinale::Hide();
    const QuebecFinale::FDay FinaleParked = QuebecFinale::Park();
    FinaleMeet = AddPart(TEXT("FinaleMeet"), Cube, FVector(FinaleMeetSpot.X, FinaleMeetSpot.Y, 40.), FVector(70., 70., 16.), Gold);
    FinaleMeetCaption = AddCaption(TEXT("FinaleMeetCaption"), FVector(FinaleMeetSpot.X, FinaleMeetSpot.Y, 160.), TEXT("MEET"), 18.f);
    FinalePocket = AddPart(TEXT("FinalePocket"), Cube, FVector(FinalePocketSpot.X, FinalePocketSpot.Y, 40.), FVector(80., 80., 12.), Lime);
    FinalePocketCaption = AddCaption(TEXT("FinalePocketCaption"), FVector(FinalePocketSpot.X, FinalePocketSpot.Y, 160.), TEXT("DARK"), 18.f);
    FinaleFar = AddPart(TEXT("FinaleFar"), Cube, FVector(FinaleFarSpot.X, FinaleFarSpot.Y, 40.), FVector(80., 80., 12.), Berry);
    FinaleFarCaption = AddCaption(TEXT("FinaleFarCaption"), FVector(FinaleFarSpot.X, FinaleFarSpot.Y, 160.), TEXT("SOUTH DARK"), 18.f);
    FinaleLampA = AddPart(TEXT("FinaleLampA"), Cylinder, FVector(QuebecFinale::LampAX, QuebecFinale::LampAY, 140.), FVector(28., 28., 280.), Gold);
    FinaleLampACaption = AddCaption(TEXT("FinaleLampACaption"), FVector(QuebecFinale::LampAX, QuebecFinale::LampAY, 300.), TEXT("LAMP"), 18.f);
    FinaleLampB = AddPart(TEXT("FinaleLampB"), Cylinder, FVector(QuebecFinale::LampBX, QuebecFinale::LampBY, 140.), FVector(28., 28., 280.), Gold);
    FinaleLampBCaption = AddCaption(TEXT("FinaleLampBCaption"), FVector(QuebecFinale::LampBX, QuebecFinale::LampBY, 300.), TEXT("LAMP"), 18.f);
    FinaleCase = AddPart(TEXT("FinaleCase"), Cube, FVector(FinaleCaseSpot.X, FinaleCaseSpot.Y, 40.), FVector(70., 70., 16.), Gold);
    FinaleCaseCaption = AddCaption(TEXT("FinaleCaseCaption"), FVector(FinaleCaseSpot.X, FinaleCaseSpot.Y, 160.), TEXT("CASE"), 18.f);
    FinaleDrop = AddPart(TEXT("FinaleDrop"), Cube, FVector(FinaleDropSpot.X, FinaleDropSpot.Y, 40.), FVector(70., 70., 16.), Lime);
    FinaleDropCaption = AddCaption(TEXT("FinaleDropCaption"), FVector(FinaleDropSpot.X, FinaleDropSpot.Y, 160.), TEXT("DROP"), 18.f);
    FinaleLine = AddPart(TEXT("FinaleLine"), Cube, FVector(FinaleLineSpot.X, FinaleLineSpot.Y, 40.), FVector(70., 70., 16.), Gold);
    FinaleLineCaption = AddCaption(TEXT("FinaleLineCaption"), FVector(FinaleLineSpot.X, FinaleLineSpot.Y, 160.), TEXT("LINE"), 18.f);
    FinaleFinish = AddPart(TEXT("FinaleFinish"), Cube, FVector(FinaleFinishSpot.X, FinaleFinishSpot.Y, 40.), FVector(70., 70., 16.), Lime);
    FinaleFinishCaption = AddCaption(TEXT("FinaleFinishCaption"), FVector(FinaleFinishSpot.X, FinaleFinishSpot.Y, 160.), TEXT("FINISH"), 18.f);
    FinaleRival = AddPart(TEXT("FinaleRival"), Cube, FVector(FinaleLineSpot.X, FinaleLineSpot.Y, 90.), FVector(40., 40., 80.), Berry);
    FinaleRivalCaption = AddCaption(TEXT("FinaleRivalCaption"), FVector(FinaleLineSpot.X, FinaleLineSpot.Y, 220.), TEXT("RIVAL"), 18.f);
    FinaleSeat = AddPart(TEXT("FinaleSeat"), Cube, FVector(FinaleSeatSpot.X, FinaleSeatSpot.Y, 40.), FVector(70., 70., 16.), Gold);
    FinaleSeatCaption = AddCaption(TEXT("FinaleSeatCaption"), FVector(FinaleSeatSpot.X, FinaleSeatSpot.Y, 160.), TEXT("SEAT"), 18.f);
    FinaleHide = AddPart(TEXT("FinaleHide"), Cube, FVector(FinaleHideSpot.X, FinaleHideSpot.Y, 40.), FVector(70., 70., 16.), Lime);
    FinaleHideCaption = AddCaption(TEXT("FinaleHideCaption"), FVector(FinaleHideSpot.X, FinaleHideSpot.Y, 160.), TEXT("HIDE"), 18.f);
    FinaleTail = AddPart(TEXT("FinaleTail"), Cube, FVector(FinaleParked.TailX, FinaleParked.TailY, 90.), FVector(40., 40., 80.), Berry);
    FinaleTailCaption = AddCaption(TEXT("FinaleTailCaption"), FVector(FinaleParked.TailX, FinaleParked.TailY, 220.), TEXT("TAIL"), 18.f);
    const QuebecFollow::FSpot FollowMeetSpot = QuebecFollow::Meet();
    const QuebecFollow::FSpot FollowStopSpot = QuebecFollow::Stop();
    const QuebecFollow::FSpot FollowCorner = QuebecFollow::Place(0.);
    FollowMeet = AddPart(TEXT("FollowMeet"), Cube, FVector(FollowMeetSpot.X, FollowMeetSpot.Y, 40.), FVector(70., 70., 16.), Gold);
    FollowMeetCaption = AddCaption(TEXT("FollowMeetCaption"), FVector(FollowMeetSpot.X, FollowMeetSpot.Y, 160.), TEXT("MEET"), 18.f);
    FollowPerson = AddPart(TEXT("FollowPerson"), Cube, FVector(FollowCorner.X, FollowCorner.Y, 90.), FVector(40., 40., 80.), Berry);
    FollowPersonCaption = AddCaption(TEXT("FollowPersonCaption"), FVector(FollowCorner.X, FollowCorner.Y, 220.), TEXT("KEEP BACK"), 18.f);
    FollowStop = AddPart(TEXT("FollowStop"), Cube, FVector(FollowStopSpot.X, FollowStopSpot.Y, 40.), FVector(70., 70., 16.), Lime);
    FollowStopCaption = AddCaption(TEXT("FollowStopCaption"), FVector(FollowStopSpot.X, FollowStopSpot.Y, 160.), TEXT("STOP"), 18.f);
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
            TickPond(DeltaSeconds);
            TickCourt();
            TickShow();
            TickConvoy();
            TickBlank();
            TickTour();
            TickHome();
            TickEscort(DeltaSeconds);
            TickShade();
            TickGrab(DeltaSeconds);
            TickCut(DeltaSeconds);
            TickChase(DeltaSeconds);
            TickFinale(DeltaSeconds);
            TickFollow(DeltaSeconds);
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
            if (BestBeam != QuebecPondRules::FalseBeam)
            {
                bPondTagHolding = false;
                PondTagInside = 0.f;
                PondTagOutside = 0.f;
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                BreakChain();
                Controller->ShowInteractionMessage(TEXT("That beam blinks with the sky. The postcard does not. The chain breaks."));
                return true;
            }
            if (!bPondTagHolding)
            {
                bPondTagHolding = true;
                PondTagInside = 0.f;
                PondTagOutside = 0.f;
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                Controller->ShowInteractionMessage(TEXT("Stay in the postcard. The other two keep blinking."));
                ForceNetUpdate();
            }
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
            // The picnic step is written on the version-3 tail. CompletedMissions stays 2.
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
                BreakChain();
                Controller->ShowInteractionMessage(FString(BestPanel == QuebecCourtRules::GoldPanel
                    ? TEXT("Wait until the ball is on the gold panel.")
                    : TEXT("That panel is a decoy. The gold one restarts the rally.")) + TEXT(" The chain breaks."));
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
                BreakChain();
                Controller->ShowInteractionMessage(TEXT("That panel restarts the point. The referee is already writing the penalty. The chain breaks."));
                return true;
            }
            if (NearCourt(Controller, QuebecCourtRules::ReturnGate.X, QuebecCourtRules::ReturnGate.Y))
            {
                const int32 Next = QuebecCourtRules::Apply(CourtStep, QuebecCourtRules::EAct::Bank, QuebecCourtRules::BankPanel, CourtTime, Chain);
                if (Next == CourtStep)
                {
                    ++CourtMisses;
                    BreakChain();
                    ForceNetUpdate();
                    Controller->ShowInteractionMessage(FString(QuebecCourtRules::SweepDanger(CourtTime, Chain)
                        ? TEXT("Ink on the line. Let it pass.")
                        : TEXT("Wait until the ball crosses the middle panel.")) + TEXT(" The chain breaks."));
                    return true;
                }
                const int32 Bonus = QuebecChain::ClosePay(Chain, bChainSpoiled, QuebecCourtRules::CloseCall(CourtTime, Chain));
                if (Bonus > 0) GrantCash(Bonus);
                AdvanceCourt(Next, Controller, *WithClose(TEXT("The bank goes in. The referee calls a penalty on the light."), Bonus), false);
                return true;
            }
            return false;
        }
        if (CourtStep == QuebecCourtRules::StepPull && NearCourt(Controller, QuebecCourtRules::Clamp.X, QuebecCourtRules::Clamp.Y))
        {
            PlungerPoint = FVector(QuebecCourtRules::Clamp.X, QuebecCourtRules::Clamp.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The court step is written on the version-3 tail. CompletedMissions stays 2.
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
            // The show step is written on the version-3 tail. CompletedMissions stays 2.
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
            // The rescue mask is written on the version-3 tail. CompletedMissions stays 2.
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
            const int32 Next = QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Pull, ConvoyTime, Chain);
            if (Next == ConvoyStep)
            {
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                BreakChain();
                Controller->ShowInteractionMessage(TEXT("The beam is still painting. Wait for the gap. The chain breaks."));
                return true;
            }
            const int32 Bonus = QuebecChain::ClosePay(Chain, bChainSpoiled, QuebecConvoyRules::CloseCall(ConvoyTime, Chain));
            if (Bonus > 0) GrantCash(Bonus);
            AdvanceConvoy(Next, Controller, *WithClose(TEXT("The feed stalls. The projector car is sitting alone."), Bonus), false);
            return true;
        }
        if (ConvoyStep == QuebecConvoyRules::StepInvert && NearConvoy(Controller, QuebecConvoyRules::Projector.X, QuebecConvoyRules::Projector.Y))
        {
            AdvanceConvoy(QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Use, ConvoyTime), Controller,
                TEXT("The plate is inverted. Blank panels. Two gates. One is still painted."), false);
            return true;
        }
        if (ConvoyStep == QuebecConvoyRules::StepEscape
            && NearConvoy(Controller, QuebecConvoyRules::Called.X, QuebecConvoyRules::Called.Y)
            && !NearConvoy(Controller, QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y))
        {
            const int32 Next = QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Use, ConvoyTime, Chain, QuebecConvoyRules::EWagon::Painted);
            if (Next == ConvoyStep)
            {
                Controller->PlayFeedback(EQuebecFeedbackCue::Dialogue);
                BreakChain();
                Controller->ShowInteractionMessage(TEXT("GREEN CAP: That is the gate I called. TOPKNOT: It is still painted. The chain breaks."));
            }
            return true;
        }
        if (ConvoyStep == QuebecConvoyRules::StepEscape && NearConvoy(Controller, QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y))
        {
            PlungerPoint = FVector(QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The convoy step is written on the version-3 tail. CompletedMissions stays 2.
            AdvanceConvoy(QuebecConvoyRules::Apply(ConvoyStep, QuebecConvoyRules::EAct::Use, ConvoyTime, Chain, QuebecConvoyRules::EWagon::Clear), Controller,
                TEXT("GREEN CAP: That route was fine. TOPKNOT: This one is better. The border has a gap."), true);
            return true;
        }
        return false;
    }
    if (IsBlankOpen())
    {
        if (BlankStep == QuebecBlankRules::StepCue
            && NearBlank(Controller, QuebecBlankRules::Keep.X, QuebecBlankRules::Keep.Y)
            && !NearBlank(Controller, QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y))
        {
            const QuebecBlankRules::FFinish Done = QuebecBlankRules::Finish(BlankStep, QuebecBlankRules::EPage::Sold, false);
            PlungerPoint = FVector(QuebecBlankRules::Keep.X, QuebecBlankRules::Keep.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The sale cash stays in the session. The page step is written. CompletedMissions stays 2.
            BreakChain();
            GrantCash(Done.Cash);
            AdvanceBlank(Done.Step, Controller,
                TEXT("CURATOR: Lovely. MEMPHIS: You sold the page. The chain pays nothing."), Done.bBankChain);
            return true;
        }
        if (BlankStep == QuebecBlankRules::StepCue && NearBlank(Controller, QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y))
        {
            const QuebecBlankRules::FFinish Done = QuebecBlankRules::Finish(BlankStep, QuebecBlankRules::EPage::Blank, false);
            PlungerPoint = FVector(QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y, 130.);
            PlungerPullTime = GetWorld()->GetTimeSeconds();
            // The page step is written on the version-3 tail. CompletedMissions stays 2.
            AdvanceBlank(Done.Step, Controller,
                TEXT("MEMPHIS: Leave it blank. The park can have a tomorrow that is not a souvenir."), Done.bBankChain);
            return true;
        }
        return false;
    }
    return false;
}

void AQuebecCampaign::TickPond(float DeltaSeconds)
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
            Message = TEXT("The postcard is on. Stay in the beam that never blinks.");
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
    if (Next != PondStep)
    {
        AdvancePond(Next, Who, Message, false);
        return;
    }
    if (PondStep != QuebecPondRules::StepTag || !bPondTagHolding) return;
    bool bInside = false;
    AQuebecController* Holder = nullptr;
    const QuebecPondRules::FSpot& Postcard = QuebecPondRules::Beams[QuebecPondRules::FalseBeam];
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearPond(*It, Postcard.X, Postcard.Y)) continue;
        bInside = true;
        Holder = *It;
        break;
    }
    const QuebecPondRules::FTagHold Hold = QuebecPondRules::AdvanceTag(
        static_cast<double>(PondTagInside), static_cast<double>(PondTagOutside), bInside, static_cast<double>(DeltaSeconds));
    if (Hold.bDropped)
    {
        bPondTagHolding = false;
        PondTagInside = 0.f;
        PondTagOutside = 0.f;
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            It->ShowInteractionMessage(TEXT("You left the postcard. Tag it again."));
        ForceNetUpdate();
        return;
    }
    PondTagInside = static_cast<float>(Hold.Inside);
    PondTagOutside = static_cast<float>(Hold.Outside);
    if (Hold.bDone)
    {
        const int32 Tagged = QuebecPondRules::Apply(PondStep, QuebecPondRules::EAct::Tag, QuebecPondRules::FalseBeam, false);
        AdvancePond(Tagged, Holder, TEXT("Worklight onto the near lock. The sheet is peeling."), false);
        return;
    }
    ForceNetUpdate();
}

void AQuebecCampaign::AdvancePond(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == PondStep) return;
    PondStep = Next;
    bPondTagHolding = false;
    PondTagInside = 0.f;
    PondTagOutside = 0.f;
    PondSamples.Reset();
    ShowStepMessage(Who, Message, bFinished, QuebecChain::LinkPond);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
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
    ShowStepMessage(Who, Message, bFinished, QuebecChain::LinkCourt);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
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
    ShowStepMessage(Who, Message, bFinished, QuebecChain::LinkShow);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
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
    ShowStepMessage(Who, Message, bFinished, QuebecChain::LinkRescue);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
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
    ShowStepMessage(Who, Message, bFinished, QuebecChain::LinkConvoy);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
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
    ShowStepMessage(Who, Message, bFinished, QuebecChain::LinkBlank);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

bool AQuebecCampaign::NearBlank(const AQuebecController* Controller, double X, double Y) const
{
    const AQuebecCharacter* Character = Controller ? Cast<AQuebecCharacter>(Controller->GetPawn()) : nullptr;
    if (!Character) return false;
    const FVector Position = Character->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecBlankRules::Reach;
}

void AQuebecCampaign::TickTour()
{
    if (!IsTourOpen()) return;
    const QuebecTour::FSpot Spot = QuebecTour::Objective(TourStep);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearTour(*It, Spot.X, Spot.Y)) continue;
        const APawn* Pawn = It->GetPawn();
        const AQuebecCar* Car = Cast<AQuebecCar>(Pawn);
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        const bool bBike = Car && Car->IsBike();
        const bool bPedalo = Car && Car->IsPedalo();
        const bool bSwimming = Walker && Walker->GetCharacterMovement()->IsSwimming();
        const int32 Next = QuebecTour::Apply(TourStep, bBike, bPedalo, bSwimming,
            TourStep == QuebecTour::StepBike, TourStep == QuebecTour::StepBoat, TourStep == QuebecTour::StepSwim);
        if (Next == TourStep) continue;
        const TCHAR* Message = Next == QuebecTour::StepBoat
            ? TEXT("The east mark is banked. The pedalo is at the bridge.")
            : Next == QuebecTour::StepSwim
                ? TEXT("The buoy is banked. Swim the south float.")
                : TEXT("The tour is home.");
        AdvanceTour(Next, *It, Message, Next >= QuebecTour::StepBanked);
        break;
    }
}

void AQuebecCampaign::AdvanceTour(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == TourStep) return;
    TourStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecTour::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

bool AQuebecCampaign::NearTour(const AQuebecController* Controller, double X, double Y) const
{
    const APawn* Pawn = Controller ? Controller->GetPawn() : nullptr;
    if (!Pawn) return false;
    const FVector Position = Pawn->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecTour::Reach;
}

void AQuebecCampaign::TickHome()
{
    if (!IsHomeOpen()) return;
    const QuebecHome::FSpot Spot = QuebecHome::Objective(HomeStep);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (!NearHome(*It, Spot.X, Spot.Y)) continue;
        const APawn* Pawn = It->GetPawn();
        const AQuebecCar* Car = Cast<AQuebecCar>(Pawn);
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        const bool bBike = Car && Car->IsBike();
        const bool bPedalo = Car && Car->IsPedalo();
        const bool bWalking = Walker && !Walker->GetCharacterMovement()->IsSwimming();
        const int32 Next = QuebecHome::Apply(HomeStep, bBike, bPedalo, bWalking,
            HomeStep == QuebecHome::StepBike, HomeStep == QuebecHome::StepBoat, HomeStep == QuebecHome::StepWalk);
        if (Next == HomeStep) continue;
        const TCHAR* Message = Next == QuebecHome::StepBoat
            ? TEXT("The stand is banked. The pedalo goes back to the bridge.")
            : Next == QuebecHome::StepWalk
                ? TEXT("The berth is banked. Walk the south bank.")
                : TEXT("The day is home.");
        AdvanceHome(Next, *It, Message, Next >= QuebecHome::StepBanked);
        break;
    }
}

void AQuebecCampaign::AdvanceHome(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == HomeStep) return;
    HomeStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecHome::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

bool AQuebecCampaign::NearHome(const AQuebecController* Controller, double X, double Y) const
{
    const APawn* Pawn = Controller ? Controller->GetPawn() : nullptr;
    if (!Pawn) return false;
    const FVector Position = Pawn->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecHome::Reach;
}

void AQuebecCampaign::TickEscort(float DeltaSeconds)
{
    if (!IsEscortOpen()) return;
    if (EscortStep == QuebecEscort::StepMeet)
    {
        EscortFriendX = static_cast<float>(QuebecEscort::MeetX);
        EscortFriendY = static_cast<float>(QuebecEscort::MeetY);
        bEscortPlanted = false;
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        {
            if (!NearEscort(*It, QuebecEscort::MeetX, QuebecEscort::MeetY)) continue;
            const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(It->GetPawn());
            const bool bWalking = Walker && !Walker->GetCharacterMovement()->IsSwimming();
            const int32 Next = QuebecEscort::Meet(EscortStep, bWalking, true);
            if (Next == EscortStep) continue;
            AdvanceEscort(Next, *It, TEXT("Grey Coat will walk if you stay on foot."), false);
            break;
        }
        return;
    }
    AQuebecController* Lead = nullptr;
    double LeadX = 0.;
    double LeadY = 0.;
    bool bLeadFoot = false;
    double LeadGap = 0.;
    bool bHaveLead = false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const APawn* Pawn = It->GetPawn();
        if (!Pawn) continue;
        const FVector Position = Pawn->GetActorLocation();
        const double Gap = QuebecEscort::Gap(Position.X, Position.Y, EscortFriendX, EscortFriendY);
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        const bool bFoot = Walker && !Walker->GetCharacterMovement()->IsSwimming();
        const bool bCloser = !bHaveLead || (bFoot && !bLeadFoot) || (bFoot == bLeadFoot && Gap < LeadGap);
        if (!bCloser) continue;
        bHaveLead = true;
        Lead = *It;
        LeadX = Position.X;
        LeadY = Position.Y;
        bLeadFoot = bFoot;
        LeadGap = Gap;
    }
    QuebecEscort::FFriend Friend;
    Friend.X = EscortFriendX;
    Friend.Y = EscortFriendY;
    Friend.bPlanted = bEscortPlanted;
    if (bHaveLead) Friend = QuebecEscort::Move(Friend, LeadX, LeadY, static_cast<double>(DeltaSeconds), bLeadFoot);
    else Friend.bPlanted = true;
    EscortFriendX = static_cast<float>(Friend.X);
    EscortFriendY = static_cast<float>(Friend.Y);
    bEscortPlanted = Friend.bPlanted;
    if (bHaveLead && QuebecEscort::Arrived(EscortStep, bLeadFoot, Friend.bPlanted, LeadX, LeadY, Friend.X, Friend.Y))
        AdvanceEscort(QuebecEscort::StepBanked, Lead, TEXT("Grey Coat is at the east door."), true);
}

void AQuebecCampaign::AdvanceEscort(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == EscortStep) return;
    EscortStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecEscort::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

bool AQuebecCampaign::NearEscort(const AQuebecController* Controller, double X, double Y) const
{
    const APawn* Pawn = Controller ? Controller->GetPawn() : nullptr;
    if (!Pawn) return false;
    const FVector Position = Pawn->GetActorLocation();
    if (FMath::Abs(Position.Z) > 400.) return false;
    return FVector::Dist2D(Position, FVector(X, Y, 0.)) <= QuebecEscort::Reach;
}

void AQuebecCampaign::TickShade()
{
    if (!IsShadeOpen()) return;
    // A burned crossing clears at the north pocket. Pick that walker, even when a partner is closer to the south.
    const bool bSeekPocket = ShadeStep == QuebecShade::StepPocket || bShadeBurned;
    const double GoalX = bSeekPocket ? QuebecShade::PocketX : QuebecShade::FarX;
    const double GoalY = bSeekPocket ? QuebecShade::PocketY : QuebecShade::FarY;
    AQuebecController* Foot = nullptr;
    double FootX = 0.;
    double FootY = 0.;
    double FootSpan = 0.;
    bool bHaveFoot = false;
    bool bAnyLamp = false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const APawn* Pawn = It->GetPawn();
        if (!Pawn) continue;
        const FVector Position = Pawn->GetActorLocation();
        if (QuebecShade::InLamp(Position.X, Position.Y)) bAnyLamp = true;
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        const bool bFoot = Walker && !Walker->GetCharacterMovement()->IsSwimming();
        if (!bFoot) continue;
        const double Span = QuebecShade::Gap(Position.X, Position.Y, GoalX, GoalY);
        if (bHaveFoot && Span >= FootSpan) continue;
        bHaveFoot = true;
        Foot = *It;
        FootX = Position.X;
        FootY = Position.Y;
        FootSpan = Span;
    }
    const QuebecShade::FCross Before{static_cast<int>(ShadeStep), bShadeBurned};
    const QuebecShade::FCross After = QuebecShade::Watch(Before, bHaveFoot, FootX, FootY, bAnyLamp);
    if (After.Step != ShadeStep)
    {
        bShadeBurned = After.Step == QuebecShade::StepBanked ? false : After.bBurned;
        const TCHAR* Message = After.Step == QuebecShade::StepBanked
            ? TEXT("The south dark held. The lamps did not.")
            : TEXT("The lamps are lit. Stay in the dark.");
        AdvanceShade(After.Step, Foot, Message, After.Step == QuebecShade::StepBanked);
        return;
    }
    if (After.bBurned == bShadeBurned) return;
    bShadeBurned = After.bBurned;
    if (Foot)
    {
        Foot->ShowInteractionMessage(bShadeBurned
            ? TEXT("A lamp saw you. Go back to the dark pocket.")
            : TEXT("The dark pocket covers you. Try the south side again."));
    }
    UpdatePresentation();
    ForceNetUpdate();
}

void AQuebecCampaign::AdvanceShade(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == ShadeStep) return;
    ShadeStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecShade::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

void AQuebecCampaign::TickGrab(float DeltaSeconds)
{
    if (!IsGrabOpen()) return;
    const bool bTaking = GrabStep == QuebecGrab::StepCase;
    const double GoalX = bTaking ? QuebecGrab::CaseX : QuebecGrab::DropX;
    const double GoalY = bTaking ? QuebecGrab::CaseY : QuebecGrab::DropY;
    AQuebecController* Foot = nullptr;
    double FootX = 0.;
    double FootY = 0.;
    double FootSpan = 0.;
    bool bHaveFoot = false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const APawn* Pawn = It->GetPawn();
        if (!Pawn) continue;
        const FVector Position = Pawn->GetActorLocation();
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        if (!Walker || Walker->GetCharacterMovement()->IsSwimming()) continue;
        // Anyone already on the mark counts, even when a partner is closer to the other one.
        const bool bHere = bTaking ? QuebecGrab::InCase(Position.X, Position.Y) : QuebecGrab::InDrop(Position.X, Position.Y);
        if (bHere)
        {
            bHaveFoot = true;
            Foot = *It;
            FootX = Position.X;
            FootY = Position.Y;
            break;
        }
        const double Span = QuebecGrab::Gap(Position.X, Position.Y, GoalX, GoalY);
        if (bHaveFoot && Span >= FootSpan) continue;
        bHaveFoot = true;
        Foot = *It;
        FootX = Position.X;
        FootY = Position.Y;
        FootSpan = Span;
    }
    const QuebecGrab::FRun Before{static_cast<int>(GrabStep), static_cast<double>(GrabElapsed)};
    const QuebecGrab::FRun After = QuebecGrab::Tick(Before, static_cast<double>(DeltaSeconds), bHaveFoot, FootX, FootY);
    if (After.Step != GrabStep)
    {
        GrabElapsed = 0.f;
        const TCHAR* Message = TEXT("The window shut. The case is back.");
        bool bFinished = false;
        if (After.Step == QuebecGrab::StepBanked)
        {
            Message = TEXT("The case is in. The window held.");
            bFinished = true;
        }
        else if (Before.Step == QuebecGrab::StepCase)
            Message = TEXT("Twelve seconds. The drop is south. Stay on foot.");
        AdvanceGrab(After.Step, Foot, Message, bFinished);
        return;
    }
    const int Shown = QuebecGrab::Left(Before.Elapsed);
    GrabElapsed = static_cast<float>(After.Elapsed);
    if (QuebecGrab::Left(static_cast<double>(GrabElapsed)) != Shown) ForceNetUpdate();
}

void AQuebecCampaign::AdvanceGrab(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == GrabStep) return;
    GrabStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecGrab::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

void AQuebecCampaign::TickCut(float DeltaSeconds)
{
    if (!IsCutOpen()) return;
    const bool bLining = CutStep == QuebecCut::StepLine;
    const double GoalX = bLining ? QuebecCut::StartX : QuebecCut::FinishX;
    const double GoalY = bLining ? QuebecCut::StartY : QuebecCut::FinishY;
    AQuebecController* Foot = nullptr;
    double FootX = 0.;
    double FootY = 0.;
    double FootSpan = 0.;
    bool bHaveFoot = false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const APawn* Pawn = It->GetPawn();
        if (!Pawn) continue;
        const FVector Position = Pawn->GetActorLocation();
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        if (!Walker || Walker->GetCharacterMovement()->IsSwimming()) continue;
        const bool bHere = bLining ? QuebecCut::InStart(Position.X, Position.Y) : QuebecCut::InFinish(Position.X, Position.Y);
        if (bHere)
        {
            bHaveFoot = true;
            Foot = *It;
            FootX = Position.X;
            FootY = Position.Y;
            break;
        }
        const double Span = QuebecCut::Gap(Position.X, Position.Y, GoalX, GoalY);
        if (bHaveFoot && Span >= FootSpan) continue;
        bHaveFoot = true;
        Foot = *It;
        FootX = Position.X;
        FootY = Position.Y;
        FootSpan = Span;
    }
    const QuebecCut::FRun Before{static_cast<int>(CutStep), static_cast<double>(CutElapsed)};
    const QuebecCut::FRun After = QuebecCut::Tick(Before, static_cast<double>(DeltaSeconds), bHaveFoot, FootX, FootY);
    if (After.Step != CutStep)
    {
        CutElapsed = 0.f;
        const TCHAR* Message = TEXT("They got there first. The line is back.");
        bool bFinished = false;
        if (After.Step == QuebecCut::StepBanked)
        {
            Message = TEXT("You beat them across. The short way held.");
            bFinished = true;
        }
        else if (Before.Step == QuebecCut::StepLine)
            Message = TEXT("They took the road. Sprint the grass.");
        AdvanceCut(After.Step, Foot, Message, bFinished);
        return;
    }
    const int Shown = QuebecCut::Left(Before.Elapsed);
    CutElapsed = static_cast<float>(After.Elapsed);
    if (QuebecCut::Left(static_cast<double>(CutElapsed)) != Shown) ForceNetUpdate();
}

void AQuebecCampaign::AdvanceCut(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == CutStep) return;
    CutStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecCut::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

void AQuebecCampaign::TickChase(float DeltaSeconds)
{
    if (!IsChaseOpen()) return;
    const bool bSeating = ChaseStep == QuebecChase::StepSeat;
    const double GoalX = bSeating ? QuebecChase::StartX : QuebecChase::HideX;
    const double GoalY = bSeating ? QuebecChase::StartY : QuebecChase::HideY;
    AQuebecController* Driver = nullptr;
    double BodyX = 0.;
    double BodyY = 0.;
    double BodySpan = 0.;
    bool bHaveBody = false;
    bool bInCar = false;
    for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
    {
        AQuebecCar* Car = *It;
        if (!Car || !Car->Occupant || !QuebecChase::CountsAsCar(static_cast<int>(Car->RideKind))) continue;
        AQuebecController* Who = Cast<AQuebecController>(Car->GetController());
        if (!Who) continue;
        const FVector Position = Car->GetActorLocation();
        const bool bHere = bSeating ? QuebecChase::InStart(Position.X, Position.Y) : QuebecChase::InHide(Position.X, Position.Y);
        if (bHere)
        {
            bHaveBody = true;
            bInCar = true;
            Driver = Who;
            BodyX = Position.X;
            BodyY = Position.Y;
            break;
        }
        const double Span = QuebecChase::Apart(Position.X, Position.Y, GoalX, GoalY);
        if (bHaveBody && Span >= BodySpan) continue;
        bHaveBody = true;
        bInCar = true;
        Driver = Who;
        BodyX = Position.X;
        BodyY = Position.Y;
        BodySpan = Span;
    }
    if (!bInCar && ChaseStep == QuebecChase::StepTail)
    {
        bHaveBody = false;
        BodySpan = 0.;
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        {
            const APawn* Pawn = It->GetPawn();
            if (!Pawn) continue;
            const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
            if (Walker && Walker->GetCharacterMovement()->IsSwimming()) continue;
            const AQuebecCar* Ride = Cast<AQuebecCar>(Pawn);
            if (Ride && QuebecChase::CountsAsCar(static_cast<int>(Ride->RideKind))) continue;
            const FVector Position = Pawn->GetActorLocation();
            const double Span = QuebecChase::Apart(Position.X, Position.Y, GoalX, GoalY);
            if (bHaveBody && Span >= BodySpan) continue;
            bHaveBody = true;
            Driver = *It;
            BodyX = Position.X;
            BodyY = Position.Y;
            BodySpan = Span;
        }
    }
    const QuebecChase::FTail Before{static_cast<int>(ChaseStep), static_cast<double>(ChaseTailX), static_cast<double>(ChaseTailY)};
    const QuebecChase::FTail After = QuebecChase::Tick(Before, static_cast<double>(DeltaSeconds), bInCar, bHaveBody, BodyX, BodyY);
    if (After.Step != ChaseStep)
    {
        ChaseTailX = static_cast<float>(After.X);
        ChaseTailY = static_cast<float>(After.Y);
        const TCHAR* Message = TEXT("They caught you. The line is back.");
        bool bFinished = false;
        if (After.Step == QuebecChase::StepBanked)
        {
            Message = TEXT("You lost them at the hide. The tail is gone.");
            bFinished = true;
        }
        else if (Before.Step == QuebecChase::StepSeat)
            Message = TEXT("They are behind you. Drive.");
        AdvanceChase(After.Step, Driver, Message, bFinished);
        return;
    }
    const float NextX = static_cast<float>(After.X);
    const float NextY = static_cast<float>(After.Y);
    const bool bMoved = QuebecChase::Apart(static_cast<double>(NextX), static_cast<double>(NextY), static_cast<double>(ChaseTailX), static_cast<double>(ChaseTailY)) > 50.;
    ChaseTailX = NextX;
    ChaseTailY = NextY;
    if (bMoved) ForceNetUpdate();
}

void AQuebecCampaign::AdvanceChase(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == ChaseStep) return;
    ChaseStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecChase::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

void AQuebecCampaign::TickFinale(float DeltaSeconds)
{
    if (!IsFinaleOpen()) return;
    const int Step = static_cast<int>(FinaleStep);
    const bool bCarStage = Step == QuebecFinale::StepChase;
    AQuebecController* Who = nullptr;
    double BodyX = 0.;
    double BodyY = 0.;
    double BodySpan = 0.;
    bool bHaveBody = false;
    bool bOnFoot = false;
    bool bInCar = false;
    bool bLamp = false;
    if (!bCarStage)
    {
        double GoalX = QuebecFinale::Meet().X;
        double GoalY = QuebecFinale::Meet().Y;
        if (Step == QuebecFinale::StepDark)
        {
            const QuebecFinale::FSpot Goal = bFinaleBurned ? QuebecFinale::Pocket() : QuebecFinale::Far();
            GoalX = Goal.X;
            GoalY = Goal.Y;
        }
        else if (Step == QuebecFinale::StepPage)
        {
            const QuebecFinale::FSpot Goal = bFinaleHolding ? QuebecFinale::Drop() : QuebecFinale::Case();
            GoalX = Goal.X;
            GoalY = Goal.Y;
        }
        else if (Step == QuebecFinale::StepCut)
        {
            const QuebecFinale::FSpot Goal = bFinaleRacing ? QuebecFinale::Finish() : QuebecFinale::Line();
            GoalX = Goal.X;
            GoalY = Goal.Y;
        }
        bool bMarked = false;
        double MarkedX = 0.;
        double MarkedY = 0.;
        AQuebecController* Marked = nullptr;
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        {
            const APawn* Pawn = It->GetPawn();
            if (!Pawn) continue;
            const FVector Position = Pawn->GetActorLocation();
            if (Step == QuebecFinale::StepDark && QuebecFinale::InLamp(Position.X, Position.Y)) bLamp = true;
            const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
            if (!Walker || Walker->GetCharacterMovement()->IsSwimming()) continue;
            bool bHere = false;
            if (Step == QuebecFinale::StepMeet) bHere = QuebecFinale::InMeet(Position.X, Position.Y);
            else if (Step == QuebecFinale::StepDark) bHere = bFinaleBurned ? QuebecFinale::InPocket(Position.X, Position.Y) : QuebecFinale::InFar(Position.X, Position.Y);
            else if (Step == QuebecFinale::StepPage) bHere = bFinaleHolding ? QuebecFinale::InDrop(Position.X, Position.Y) : QuebecFinale::InCase(Position.X, Position.Y);
            else if (Step == QuebecFinale::StepCut) bHere = bFinaleRacing ? QuebecFinale::InFinish(Position.X, Position.Y) : QuebecFinale::InLine(Position.X, Position.Y);
            if (bHere)
            {
                if (!bMarked)
                {
                    bMarked = true;
                    Marked = *It;
                    MarkedX = Position.X;
                    MarkedY = Position.Y;
                }
                continue;
            }
            if (bMarked) continue;
            const double Span = QuebecFinale::Apart(Position.X, Position.Y, GoalX, GoalY);
            if (bHaveBody && Span >= BodySpan) continue;
            bHaveBody = true;
            Who = *It;
            BodyX = Position.X;
            BodyY = Position.Y;
            BodySpan = Span;
        }
        if (bMarked)
        {
            bHaveBody = true;
            Who = Marked;
            BodyX = MarkedX;
            BodyY = MarkedY;
        }
        bOnFoot = bHaveBody;
    }
    else
    {
        const bool bSeating = !bFinaleTailing;
        const QuebecFinale::FSpot Goal = bSeating ? QuebecFinale::Seat() : QuebecFinale::Hide();
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
        {
            AQuebecCar* Car = *It;
            if (!Car || !Car->Occupant || !QuebecFinale::CountsAsCar(static_cast<int>(Car->RideKind))) continue;
            AQuebecController* Driver = Cast<AQuebecController>(Car->GetController());
            if (!Driver) continue;
            const FVector Position = Car->GetActorLocation();
            const bool bHere = bSeating ? QuebecFinale::InSeat(Position.X, Position.Y) : QuebecFinale::InHide(Position.X, Position.Y);
            if (bHere)
            {
                bHaveBody = true;
                bInCar = true;
                Who = Driver;
                BodyX = Position.X;
                BodyY = Position.Y;
                break;
            }
            const double Span = QuebecFinale::Apart(Position.X, Position.Y, Goal.X, Goal.Y);
            if (bHaveBody && Span >= BodySpan) continue;
            bHaveBody = true;
            bInCar = true;
            Who = Driver;
            BodyX = Position.X;
            BodyY = Position.Y;
            BodySpan = Span;
        }
        if (!bInCar && bFinaleTailing)
        {
            bHaveBody = false;
            BodySpan = 0.;
            for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            {
                const APawn* Pawn = It->GetPawn();
                if (!Pawn) continue;
                const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
                if (Walker && Walker->GetCharacterMovement()->IsSwimming()) continue;
                const AQuebecCar* Ride = Cast<AQuebecCar>(Pawn);
                if (Ride && QuebecFinale::CountsAsCar(static_cast<int>(Ride->RideKind))) continue;
                const FVector Position = Pawn->GetActorLocation();
                const double Span = QuebecFinale::Apart(Position.X, Position.Y, Goal.X, Goal.Y);
                if (bHaveBody && Span >= BodySpan) continue;
                bHaveBody = true;
                Who = *It;
                BodyX = Position.X;
                BodyY = Position.Y;
                BodySpan = Span;
            }
        }
    }
    QuebecFinale::FDay Before;
    Before.Step = Step;
    Before.bBurned = bFinaleBurned;
    Before.bHolding = bFinaleHolding;
    Before.bRacing = bFinaleRacing;
    Before.bTailing = bFinaleTailing;
    Before.Elapsed = static_cast<double>(FinaleElapsed);
    Before.TailX = static_cast<double>(FinaleTailX);
    Before.TailY = static_cast<double>(FinaleTailY);
    const QuebecFinale::FDay After = QuebecFinale::Tick(Before, static_cast<double>(DeltaSeconds), bOnFoot, bInCar, bHaveBody, BodyX, BodyY, bLamp);
    bFinaleBurned = After.bBurned;
    bFinaleHolding = After.bHolding;
    bFinaleRacing = After.bRacing;
    bFinaleTailing = After.bTailing;
    FinaleElapsed = static_cast<float>(After.Elapsed);
    FinaleTailX = static_cast<float>(After.TailX);
    FinaleTailY = static_cast<float>(After.TailY);
    if (After.Step != Step)
    {
        const TCHAR* Message = TEXT("The day is yours. Once more, and it held.");
        if (After.Step == QuebecFinale::StepDark) Message = TEXT("They are waiting in the dark.");
        else if (After.Step == QuebecFinale::StepPage) Message = TEXT("The dark held. Five seconds on the page.");
        else if (After.Step == QuebecFinale::StepCut) Message = TEXT("The page is down. They took the road.");
        else if (After.Step == QuebecFinale::StepChase) Message = TEXT("You beat them. A car is the last of it.");
        AdvanceFinale(After.Step, Who, Message, After.Step == QuebecFinale::StepBanked);
        return;
    }
    const bool bBurnFlip = After.bBurned != Before.bBurned;
    const bool bHoldFlip = After.bHolding != Before.bHolding;
    const bool bRaceFlip = After.bRacing != Before.bRacing;
    const bool bTailFlip = After.bTailing != Before.bTailing;
    if (bBurnFlip || bHoldFlip || bRaceFlip || bTailFlip)
    {
        const TCHAR* Message = TEXT("");
        if (bBurnFlip && After.bBurned) Message = TEXT("A lamp saw you. The pocket covers you.");
        else if (bBurnFlip) Message = TEXT("The pocket covers you. The south dark is open.");
        else if (bHoldFlip && After.bHolding) Message = TEXT("Five seconds. South. Stay on foot.");
        else if (bHoldFlip) Message = TEXT("The window shut. The page is back.");
        else if (bRaceFlip && After.bRacing) Message = TEXT("They took the road. Sprint the grass.");
        else if (bRaceFlip) Message = TEXT("They got there first. The line is back.");
        else if (bTailFlip && After.bTailing) Message = TEXT("They are behind you. Drive.");
        else Message = TEXT("They caught you. The seat is back.");
        if (Who) Who->ShowInteractionMessage(Message);
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            It->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
        UpdatePresentation();
        ForceNetUpdate();
        return;
    }
    const bool bPageClock = Step == QuebecFinale::StepPage && QuebecFinale::PageLeft(Before.Elapsed) != QuebecFinale::PageLeft(After.Elapsed);
    const bool bCutClock = Step == QuebecFinale::StepCut && QuebecFinale::CutLeft(Before.Elapsed) != QuebecFinale::CutLeft(After.Elapsed);
    const bool bMoved = QuebecFinale::Apart(After.TailX, After.TailY, Before.TailX, Before.TailY) > 50.;
    if (bPageClock || bCutClock || bMoved) ForceNetUpdate();
}

void AQuebecCampaign::AdvanceFinale(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == FinaleStep) return;
    FinaleStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat, and only at the end.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecFinale::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
}

void AQuebecCampaign::TickFollow(float DeltaSeconds)
{
    if (!IsFollowOpen()) return;
    const QuebecFollow::FSpot There = QuebecFollow::Place(static_cast<double>(FollowAlong));
    AQuebecController* Foot = nullptr;
    double FootX = 0.;
    double FootY = 0.;
    bool bHaveWalker = false;
    bool bInBand = false;
    double BandError = 1.e18;
    double WalkerSpan = 1.e18;
    bool bCrowded = false;
    bool bHaveOther = false;
    AQuebecController* Other = nullptr;
    double OtherX = 0.;
    double OtherY = 0.;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const APawn* Pawn = It->GetPawn();
        if (!Pawn) continue;
        const FVector Position = Pawn->GetActorLocation();
        const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Pawn);
        const bool bWalker = Walker && !Walker->GetCharacterMovement()->IsSwimming();
        if (bWalker)
        {
            const double Span = QuebecFollow::Gap(Position.X, Position.Y, There.X, There.Y);
            if (Span <= QuebecFollow::Spook) bCrowded = true;
            if (QuebecFollow::InBand(Span))
            {
                const double Error = FMath::Abs(Span - QuebecFollow::Behind);
                if (!bInBand || Error < BandError)
                {
                    bInBand = true;
                    BandError = Error;
                    bHaveWalker = true;
                    Foot = *It;
                    FootX = Position.X;
                    FootY = Position.Y;
                }
            }
            else if (!bInBand && (!bHaveWalker || Span < WalkerSpan))
            {
                bHaveWalker = true;
                WalkerSpan = Span;
                Foot = *It;
                FootX = Position.X;
                FootY = Position.Y;
            }
        }
        else if (!bHaveOther)
        {
            bHaveOther = true;
            Other = *It;
            OtherX = Position.X;
            OtherY = Position.Y;
        }
    }
    const bool bHaveBody = bHaveWalker || bHaveOther;
    const bool bOnFoot = bHaveWalker;
    if (!bHaveWalker && bHaveOther)
    {
        Foot = Other;
        FootX = OtherX;
        FootY = OtherY;
    }
    const double BeforeAlong = static_cast<double>(FollowAlong);
    QuebecFollow::FGap Now;
    Now.Step = static_cast<int>(FollowStep);
    Now.Along = BeforeAlong;
    const QuebecFollow::FGap After = QuebecFollow::Tick(Now, static_cast<double>(DeltaSeconds), bOnFoot, bHaveBody, bCrowded, FootX, FootY);
    FollowAlong = static_cast<float>(After.Along);
    if (After.Step != FollowStep)
    {
        const TCHAR* Message = TEXT("They are walking. Keep a gap. A sprint crowds them.");
        bool bFinished = false;
        if (After.Step == QuebecFollow::StepBanked)
        {
            Message = TEXT("They made the stop. You kept the gap.");
            bFinished = true;
        }
        AdvanceFollow(After.Step, Foot, Message, bFinished);
        return;
    }
    if (BeforeAlong > 0. && After.Along <= 0.)
    {
        const TCHAR* Message = After.bCrowded
            ? TEXT("You crowded them. They are back at the corner.")
            : TEXT("You lost them. They are back at the corner.");
        if (Foot) Foot->ShowInteractionMessage(Message);
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            It->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
        UpdatePresentation();
        ForceNetUpdate();
        return;
    }
    if (!FMath::IsNearlyEqual(static_cast<float>(BeforeAlong), FollowAlong)) ForceNetUpdate();
}

void AQuebecCampaign::AdvanceFollow(int32 Next, AQuebecController* Who, const TCHAR* Message, bool bFinished)
{
    if (Next == FollowStep) return;
    FollowStep = Next;
    // Link -1 is outside the seven banks, so the chain does not move. The purse is flat, and only at the stop.
    ShowStepMessage(Who, Message, bFinished, -1);
    if (bFinished) GrantCash(QuebecFollow::Pay);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        It->PlayFeedback(bFinished ? EQuebecFeedbackCue::Complete : EQuebecFeedbackCue::Checkpoint);
    UpdatePresentation();
    ForceNetUpdate();
    SaveBoundary();
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
            BreakChain();
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
                        if (bRaceRetried) bChainSpoiled = true;
                        {
                            const bool bWasSpoiled = bChainSpoiled;
                            BankChain(QuebecChain::LinkTerrace);
                            if (LastChainPay > 0)
                            {
                                const FString Pay = ChainHitText(LastChainPay, Chain, bWasSpoiled, TEXT("Lap in.  "));
                                for (TActorIterator<AQuebecController> Player(GetWorld()); Player; ++Player)
                                {
                                    Player->ShowInteractionMessage(Pay);
                                    Player->PlayRank(Chain, bWasSpoiled);
                                }
                            }
                        }
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

bool UQuebecCampaignSaveGame::IsSupported() const
{
    const QuebecStorySave::FSteps Steps{
        PondStep, CourtStep, ShowStep, RescueMask, ConvoyStep, BlankStep, TourStep, HomeStep, EscortStep, ShadeStep, GrabStep, CutStep, ChaseStep, FinaleStep, FollowStep};
    return QuebecStorySave::Accept(Version, CompletedMissions, Steps);
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
    if (Save)
    {
        // Version 2 stays the unsupported fixture. The tail is the story after the race.
        Save->Version = QuebecStorySave::Current;
        Save->CompletedMissions = CompletedMissions;
        Save->PondStep = PondStep;
        Save->CourtStep = CourtStep;
        Save->ShowStep = ShowStep;
        Save->RescueMask = RescueMask;
        Save->ConvoyStep = ConvoyStep;
        Save->BlankStep = BlankStep;
        Save->TourStep = TourStep;
        Save->HomeStep = HomeStep;
        Save->EscortStep = EscortStep;
        Save->ShadeStep = ShadeStep;
        Save->GrabStep = GrabStep;
        Save->CutStep = CutStep;
        Save->ChaseStep = ChaseStep;
        Save->FinaleStep = FinaleStep;
        Save->FollowStep = FollowStep;
    }
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
        if (IsTourOpen())
        {
            const QuebecTour::FSpot Spot = QuebecTour::RecoverAt(TourStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This leg restored. The legs you finished stay finished."));
            return;
        }
        if (IsHomeOpen())
        {
            const QuebecHome::FSpot Spot = QuebecHome::RecoverAt(HomeStep);
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This leg restored. The legs you finished stay finished."));
            return;
        }
        if (IsEscortOpen())
        {
            const double South = EscortStep == QuebecEscort::StepWalk ? static_cast<double>(EscortFriendY) : QuebecEscort::MeetY;
            const double East = EscortStep == QuebecEscort::StepWalk ? static_cast<double>(EscortFriendX) : QuebecEscort::MeetX;
            if (MoveToSafeCheckpoint(Controller, FVector(East, South - QuebecEscort::RecoverSouth, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This walk restored. Grey Coat is where you left the meeting."));
            return;
        }
        if (IsShadeOpen())
        {
            bShadeBurned = false;
            if (MoveToSafeCheckpoint(Controller, FVector(QuebecShade::PocketX, QuebecShade::PocketY + QuebecShade::RecoverNorth, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This crossing restored. The lamps are still lit."));
            return;
        }
        if (IsGrabOpen())
        {
            if (MoveToSafeCheckpoint(Controller, FVector(QuebecGrab::CaseX, QuebecGrab::CaseY + QuebecGrab::RecoverNorth, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This window restored. The clock keeps what it had."));
            return;
        }
        if (IsCutOpen())
        {
            if (MoveToSafeCheckpoint(Controller, FVector(QuebecCut::StartX, QuebecCut::StartY + QuebecCut::RecoverNorth, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This race restored. Their clock keeps what it had."));
            return;
        }
        if (IsChaseOpen())
        {
            if (MoveToSafeCheckpoint(Controller, FVector(QuebecChase::RecoverX, QuebecChase::RecoverY, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This tail restored. They keep the ground they gained."));
            return;
        }
        if (IsFinaleOpen())
        {
            if (FinaleStep == QuebecFinale::StepDark) bFinaleBurned = false;
            const QuebecFinale::FSpot Spot = QuebecFinale::Recover(static_cast<int>(FinaleStep));
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This day restored. The stage you are on stays."));
            return;
        }
        if (IsFollowOpen())
        {
            const QuebecFollow::FSpot Spot = QuebecFollow::Recover(static_cast<int>(FollowStep), static_cast<double>(FollowAlong));
            if (MoveToSafeCheckpoint(Controller, FVector(Spot.X, Spot.Y, 100.), FRotator(0., 90., 0.)))
                Controller->ShowInteractionMessage(TEXT("This gap restored. They keep the ground they walked."));
            return;
        }
        Controller->ShowInteractionMessage(TEXT("The day held. T replays the race."));
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
    if (Phase == EQuebecCampaignPhase::RaceRunning || bRaceTimedOut) BreakChain();
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
    if (IsTourOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The tour is still open. T replays the race after the float."));
        return;
    }
    if (IsHomeOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The day is still out. T replays the race after the bank."));
        return;
    }
    if (IsEscortOpen())
    {
        Controller->ShowInteractionMessage(TEXT("Grey Coat is still waiting. T replays the race after the door."));
        return;
    }
    if (IsShadeOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The lamps are still lit. T replays the race after the dark."));
        return;
    }
    if (IsGrabOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The window is still open. T replays the race after the drop."));
        return;
    }
    if (IsCutOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The short way is still open. T replays the race after the finish."));
        return;
    }
    if (IsChaseOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The tail is still on you. T replays the race after the hide."));
        return;
    }
    if (IsFinaleOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The day is still open. T replays the race after it holds."));
        return;
    }
    if (IsFollowOpen())
    {
        Controller->ShowInteractionMessage(TEXT("The gap is still open. T replays the race after the stop."));
        return;
    }
    // A race replay does not rewind the story steps or the chain, and it does not write the slot. The story tail already holds the steps.
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

void AQuebecCampaign::GrantCash(int32 Amount)
{
    if (Amount <= 0) return;
    if (const AGameStateBase* Game = GetWorld() ? GetWorld()->GetGameState() : nullptr)
        for (APlayerState* Each : Game->PlayerArray)
            if (AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Each))
            {
                Stats->Cash += Amount;
                Stats->Changed();
            }
}

void AQuebecCampaign::BankChain(int32 Link)
{
    const QuebecChain::FBank Bank = QuebecChain::Bank(Chain, ChainMask, bChainSpoiled, Link);
    LastChainPay = Bank.Pay;
    if (Bank.Pay <= 0) return;
    Chain = Bank.Chain;
    ChainMask = Bank.Mask;
    bChainSpoiled = Bank.bSpoiled;
    if (const AGameStateBase* Game = GetWorld() ? GetWorld()->GetGameState() : nullptr)
        for (APlayerState* Each : Game->PlayerArray)
            if (AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Each))
            {
                Stats->Cash += Bank.Pay;
                Stats->Changed();
            }
    ForceNetUpdate();
}

void AQuebecCampaign::BreakChain()
{
    if (Chain == 0 && bChainSpoiled) return;
    Chain = 0;
    bChainSpoiled = true;
    ForceNetUpdate();
}

void AQuebecCampaign::ShowStepMessage(AQuebecController* Who, const TCHAR* Message, bool bFinished, int32 Link)
{
    const bool bWasSpoiled = bChainSpoiled;
    if (bFinished) BankChain(Link);
    if (!Who || !Message) return;
    if (bFinished && LastChainPay > 0)
    {
        Who->ShowInteractionMessage(FString(Message) + ChainHitText(LastChainPay, Chain, bWasSpoiled, TEXT("  ")));
        Who->PlayRank(Chain, bWasSpoiled);
        return;
    }
    Who->ShowInteractionMessage(Message);
}

bool AQuebecCampaign::GetCloseOffer(int32& OutPay) const
{
    const bool bTimed = (IsCourtOpen() && CourtStep == QuebecCourtRules::StepRedirect)
        || (IsConvoyOpen() && ConvoyStep == QuebecConvoyRules::StepGap);
    if (!bTimed) return false;
    OutPay = QuebecChain::ClosePay(static_cast<int>(Chain), bChainSpoiled, true);
    return OutPay > 0;
}

bool AQuebecCampaign::GetClearWindow(int32& OutTenths) const
{
    if (IsCourtOpen() && CourtStep == QuebecCourtRules::StepRedirect)
    {
        OutTenths = static_cast<int32>(std::lround(QuebecCourtRules::ClearSeconds(Chain) * 10.));
        return true;
    }
    if (IsConvoyOpen() && ConvoyStep == QuebecConvoyRules::StepGap)
    {
        OutTenths = static_cast<int32>(std::lround(QuebecConvoyRules::ClearSeconds(Chain) * 10.));
        return true;
    }
    return false;
}

bool AQuebecCampaign::GetChainStake(int32& OutChain, int32& OutPay, bool& bOutBroken) const
{
    const int Link = QuebecChain::OpenLink(Phase == EQuebecCampaignPhase::Complete,
        IsPondOpen(), IsCourtOpen(), IsShowOpen(), IsRescueOpen(), IsConvoyOpen(), IsBlankOpen());
    if (Link < 0) return false;
    OutChain = Chain;
    OutPay = QuebecChain::Stake(Chain, bChainSpoiled, Link);
    bOutBroken = bChainSpoiled;
    return OutPay > 0;
}

int32 AQuebecCampaign::JobStake(int32 BasePay) const
{
    return QuebecChain::Scaled(Chain, bChainSpoiled, BasePay);
}

int32 AQuebecCampaign::ApplyJobChain(int32 BasePay, bool bSucceeded)
{
    if (!bSucceeded)
    {
        BreakChain();
        return 0;
    }
    const QuebecChain::FBank Bank = QuebecChain::Extend(Chain, ChainMask, bChainSpoiled, BasePay);
    if (Bank.Pay <= 0) return 0;
    Chain = Bank.Chain;
    ChainMask = Bank.Mask;
    bChainSpoiled = Bank.bSpoiled;
    ForceNetUpdate();
    return Bank.Pay;
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
            {
                if (!NearPond(Controller, QuebecPondRules::Beams[Beam].X, QuebecPondRules::Beams[Beam].Y)) continue;
                if (Beam == QuebecPondRules::FalseBeam && bPondTagHolding)
                    return FString::Printf(TEXT("Hold %d s"), QuebecPondRules::SecondsLeft(static_cast<double>(PondTagInside)));
                if (Beam == QuebecPondRules::FalseBeam) return TEXT("E: stay on the postcard");
                return TEXT("E: tag this beam");
            }
            if (bPondTagHolding && PondTagOutside > 0.f) return TEXT("Back into the postcard");
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
        if (ConvoyStep == QuebecConvoyRules::StepEscape
            && NearConvoy(Controller, QuebecConvoyRules::Called.X, QuebecConvoyRules::Called.Y)
            && !NearConvoy(Controller, QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y))
            return TEXT("E: the gate he called");
        if (ConvoyStep == QuebecConvoyRules::StepEscape && NearConvoy(Controller, QuebecConvoyRules::Escape.X, QuebecConvoyRules::Escape.Y))
            return TEXT("E: the clear gate");
        return FString();
    }
    if (IsBlankOpen())
    {
        if (BlankStep == QuebecBlankRules::StepCue
            && NearBlank(Controller, QuebecBlankRules::Keep.X, QuebecBlankRules::Keep.Y)
            && !NearBlank(Controller, QuebecBlankRules::Cue.X, QuebecBlankRules::Cue.Y))
            return FString::Printf(TEXT("E: sell the page for %d"), QuebecBlankRules::KeepPay);
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
    if (IsTourOpen()) return TEXT("09 / THREE WAYS ACROSS");
    if (IsHomeOpen()) return TEXT("10 / PUT THEM AWAY");
    if (IsEscortOpen()) return TEXT("11 / WALK WITH ME");
    if (IsShadeOpen()) return TEXT("12 / STAY UNSEEN");
    if (IsGrabOpen()) return TEXT("13 / THE WINDOW");
    if (IsCutOpen()) return TEXT("14 / THE SHORT WAY");
    if (IsChaseOpen()) return TEXT("15 / ON YOUR TAIL");
    if (IsFinaleOpen()) return TEXT("16 / ONCE MORE");
    if (IsFollowOpen()) return TEXT("17 / KEEP BACK");
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
        case QuebecPondRules::StepTag: return TEXT("Hold the beam that never blinks");
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
        case QuebecConvoyRules::StepEscape: return TEXT("Take the clear gate. The one he called is still painted.");
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
        case QuebecBlankRules::StepCue: return TEXT("Leave the page blank. His 200 does not pay the chain.");
        default: break;
        }
    }
    if (IsTourOpen())
    {
        switch (TourStep)
        {
        case QuebecTour::StepBike: return TEXT("Ride the park bike to the east mark");
        case QuebecTour::StepBoat: return TEXT("Paddle the pedalo to the north buoy");
        case QuebecTour::StepSwim: return TEXT("Swim to the south-pond float");
        default: break;
        }
    }
    if (IsHomeOpen())
    {
        switch (HomeStep)
        {
        case QuebecHome::StepBike: return TEXT("Ride the park bike back to the stand");
        case QuebecHome::StepBoat: return TEXT("Paddle the pedalo back to the berth");
        case QuebecHome::StepWalk: return TEXT("Walk onto the south bank");
        default: break;
        }
    }
    if (IsEscortOpen())
    {
        if (EscortStep == QuebecEscort::StepMeet) return TEXT("Walk up to Grey Coat");
        return bEscortPlanted ? TEXT("Go back. Grey Coat stopped.") : TEXT("Walk Grey Coat to the east door");
    }
    if (IsShadeOpen())
    {
        if (ShadeStep == QuebecShade::StepPocket) return TEXT("Step into the dark pocket");
        return bShadeBurned ? TEXT("A lamp saw you. Return to the dark pocket.") : TEXT("Cross to the south dark. Stay out of the lamps.");
    }
    if (IsGrabOpen())
    {
        if (GrabStep == QuebecGrab::StepCase) return TEXT("Take the case");
        return FString::Printf(TEXT("Drop the case. %ds left."), QuebecGrab::Left(static_cast<double>(GrabElapsed)));
    }
    if (IsCutOpen())
    {
        if (CutStep == QuebecCut::StepLine) return TEXT("Step on the line");
        return FString::Printf(TEXT("Cut across. %ds before they arrive."), QuebecCut::Left(static_cast<double>(CutElapsed)));
    }
    if (IsChaseOpen())
    {
        if (ChaseStep == QuebecChase::StepSeat) return TEXT("Get in a car on the line");
        return TEXT("Drive to the hide before they catch you");
    }
    if (IsFinaleOpen())
    {
        if (FinaleStep == QuebecFinale::StepMeet) return TEXT("Walk up to them");
        if (FinaleStep == QuebecFinale::StepDark)
            return bFinaleBurned ? TEXT("A lamp saw you. Return to the dark pocket.") : TEXT("Cross to the south dark. Stay out of the lamps.");
        if (FinaleStep == QuebecFinale::StepPage)
        {
            if (!bFinaleHolding) return TEXT("Take the page");
            return FString::Printf(TEXT("Drop the page. %ds left."), QuebecFinale::PageLeft(static_cast<double>(FinaleElapsed)));
        }
        if (FinaleStep == QuebecFinale::StepCut)
        {
            if (!bFinaleRacing) return TEXT("Step on the line");
            return FString::Printf(TEXT("Cut across. %ds before they arrive."), QuebecFinale::CutLeft(static_cast<double>(FinaleElapsed)));
        }
        if (!bFinaleTailing) return TEXT("Get in a car on the line");
        return TEXT("Drive to the hide before they catch you");
    }
    if (IsFollowOpen())
    {
        if (FollowStep == QuebecFollow::StepMeet) return TEXT("Stand behind them");
        return TEXT("Keep the gap. Walk with them.");
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
        case QuebecPondRules::StepTag: return TEXT("SKULL SHIRT: Two of those beams blink with the sky. The postcard does not. Stay in the one that stays.");
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
        case QuebecConvoyRules::StepEscape: return TEXT("GREEN CAP: Take the wagon I called. TOPKNOT: The clear gate is the one the card marks. His is still painted.");
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
        case QuebecBlankRules::StepCue: return TEXT("CURATOR: Two hundred, and the moment never moves. MEMPHIS: Leave it blank. The chain is worth more.");
        default: break;
        }
    }
    if (IsTourOpen())
    {
        switch (TourStep)
        {
        case QuebecTour::StepBike: return TEXT("MEMPHIS: The book is blank. The park is still here. Take the bike east.");
        case QuebecTour::StepBoat: return TEXT("The buoy is the north pond. The pedalo knows the way.");
        case QuebecTour::StepSwim: return TEXT("Leave the boat. Swim the south float. The purse is flat, and the seven banks stay shut.");
        default: break;
        }
    }
    if (IsHomeOpen())
    {
        switch (HomeStep)
        {
        case QuebecHome::StepBike: return TEXT("MEMPHIS: The three ways are done. Put the bike on its stand.");
        case QuebecHome::StepBoat: return TEXT("The pedalo belongs at the bridge. Paddle it home.");
        case QuebecHome::StepWalk: return TEXT("Leave the boat. Walk the south bank. The purse is flat, and the seven banks stay shut.");
        default: break;
        }
    }
    if (IsEscortOpen())
    {
        if (EscortStep == QuebecEscort::StepMeet)
            return TEXT("MEMPHIS: Grey Coat will not cross the lawn alone. Walk up to them.");
        return bEscortPlanted
            ? TEXT("GREY COAT: I stopped. Come back on foot.")
            : TEXT("GREY COAT: Stay on foot. If you ride off, I stop. The east door is south of here.");
    }
    if (IsShadeOpen())
    {
        if (ShadeStep == QuebecShade::StepPocket)
            return TEXT("MEMPHIS: Two lamps watch the lawn. The straight line is lit. Step into the dark pocket.");
        return bShadeBurned
            ? TEXT("MEMPHIS: A lamp saw you. The pocket north of them covers you. Then try the south dark again.")
            : TEXT("MEMPHIS: Stay out of the lamps. The west side of the lawn is dark. The south pocket pays once.");
    }
    if (IsGrabOpen())
    {
        if (GrabStep == QuebecGrab::StepCase)
            return TEXT("MEMPHIS: The case is on the east lawn. Take it on foot. You get twelve seconds.");
        return TEXT("MEMPHIS: South. On foot. If the window shuts, the case goes back.");
    }
    if (IsCutOpen())
    {
        if (CutStep == QuebecCut::StepLine)
            return TEXT("MEMPHIS: They are faster on the road. The grass is shorter. Step on the line, then sprint the cut.");
        return TEXT("MEMPHIS: Stay on the grass. If they reach the finish, the line is back.");
    }
    if (IsChaseOpen())
    {
        if (ChaseStep == QuebecChase::StepSeat)
            return TEXT("MEMPHIS: A car is on your tail. Get in on the line. The hide is down the road.");
        return TEXT("MEMPHIS: Drive. If they catch you, the line is back. A bike will not lose them.");
    }
    if (IsFinaleOpen())
    {
        if (FinaleStep == QuebecFinale::StepMeet)
            return TEXT("MEMPHIS: Once more. Walk up to them. The dark is shorter than the lawn you already crossed.");
        if (FinaleStep == QuebecFinale::StepDark)
            return bFinaleBurned
                ? TEXT("MEMPHIS: A lamp saw you. The pocket covers you. Then the south dark.")
                : TEXT("MEMPHIS: Two lamps. The straight line is lit. The west side is dark. The south pocket is the page.");
        if (FinaleStep == QuebecFinale::StepPage)
            return bFinaleHolding
                ? TEXT("MEMPHIS: Five seconds. South. On foot. If it shuts, the page is back.")
                : TEXT("MEMPHIS: The page is on the lawn. Take it on foot. You get five seconds.");
        if (FinaleStep == QuebecFinale::StepCut)
            return bFinaleRacing
                ? TEXT("MEMPHIS: They took the road. Sprint the grass. If they arrive, the line is back.")
                : TEXT("MEMPHIS: They are faster on the road. The grass is shorter. Step on the line.");
        if (!bFinaleTailing)
            return TEXT("MEMPHIS: A car is the last of it. Get in on the line. The hide is down the road.");
        return TEXT("MEMPHIS: Drive. If they catch you, the seat is back. A bike will not lose them.");
    }
    if (IsFollowOpen())
    {
        if (FollowStep == QuebecFollow::StepMeet)
            return TEXT("MEMPHIS: They walk their own line. Stand behind them. A sprint crowds them, and a stop loses them.");
        return TEXT("MEMPHIS: Match their walk. A sprint crowds them. A stop loses them. A car does not count.");
    }
    if (Phase == EQuebecCampaignPhase::Complete && PondStep >= PondBankedStep && CourtStep >= CourtBankedStep && ShowStep >= ShowBankedStep && RescueMask >= RescueDone && ConvoyStep >= ConvoyBankedStep && BlankStep >= BlankBankedStep && TourStep >= TourBankedStep && HomeStep >= HomeBankedStep && EscortStep >= EscortBankedStep && ShadeStep >= ShadeBankedStep && GrabStep >= GrabBankedStep && CutStep >= CutBankedStep && ChaseStep >= ChaseBankedStep && FinaleStep >= FinaleBankedStep && FollowStep >= FollowBankedStep)
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
    if (IsTourOpen()) return TEXT("R recovers this tour");
    if (IsHomeOpen()) return TEXT("R recovers this home");
    if (IsEscortOpen()) return TEXT("R recovers this walk");
    if (IsShadeOpen()) return TEXT("R recovers this dark");
    if (IsGrabOpen()) return TEXT("R recovers this window");
    if (IsCutOpen()) return TEXT("R recovers this cut");
    if (IsChaseOpen()) return TEXT("R recovers this tail");
    if (IsFinaleOpen()) return TEXT("R recovers this day");
    if (IsFollowOpen()) return TEXT("R recovers this gap");
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
    if (IsTourOpen())
    {
        const QuebecTour::FSpot Spot = QuebecTour::Objective(TourStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsHomeOpen())
    {
        const QuebecHome::FSpot Spot = QuebecHome::Objective(HomeStep);
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsEscortOpen())
    {
        if (EscortStep == QuebecEscort::StepWalk) return FVector(QuebecEscort::DoorX, QuebecEscort::DoorY, 100.);
        return FVector(QuebecEscort::MeetX, QuebecEscort::MeetY, 100.);
    }
    if (IsShadeOpen())
    {
        if (ShadeStep == QuebecShade::StepCross && bShadeBurned) return FVector(QuebecShade::PocketX, QuebecShade::PocketY, 100.);
        if (ShadeStep == QuebecShade::StepCross) return FVector(QuebecShade::FarX, QuebecShade::FarY, 100.);
        return FVector(QuebecShade::PocketX, QuebecShade::PocketY, 100.);
    }
    if (IsGrabOpen())
    {
        if (GrabStep == QuebecGrab::StepRun) return FVector(QuebecGrab::DropX, QuebecGrab::DropY, 100.);
        return FVector(QuebecGrab::CaseX, QuebecGrab::CaseY, 100.);
    }
    if (IsCutOpen())
    {
        if (CutStep == QuebecCut::StepRun) return FVector(QuebecCut::FinishX, QuebecCut::FinishY, 100.);
        return FVector(QuebecCut::StartX, QuebecCut::StartY, 100.);
    }
    if (IsChaseOpen())
    {
        if (ChaseStep == QuebecChase::StepTail) return FVector(QuebecChase::HideX, QuebecChase::HideY, 100.);
        return FVector(QuebecChase::StartX, QuebecChase::StartY, 100.);
    }
    if (IsFinaleOpen())
    {
        const QuebecFinale::FSpot Spot = FinaleStep == QuebecFinale::StepDark
            ? (bFinaleBurned ? QuebecFinale::Pocket() : QuebecFinale::Far())
            : FinaleStep == QuebecFinale::StepPage
                ? (bFinaleHolding ? QuebecFinale::Drop() : QuebecFinale::Case())
                : FinaleStep == QuebecFinale::StepCut
                    ? (bFinaleRacing ? QuebecFinale::Finish() : QuebecFinale::Line())
                    : FinaleStep == QuebecFinale::StepChase
                        ? (bFinaleTailing ? QuebecFinale::Hide() : QuebecFinale::Seat())
                        : QuebecFinale::Meet();
        return FVector(Spot.X, Spot.Y, 100.);
    }
    if (IsFollowOpen())
    {
        const QuebecFollow::FSpot Spot = FollowStep == QuebecFollow::StepMeet
            ? QuebecFollow::Meet()
            : QuebecFollow::Place(static_cast<double>(FollowAlong));
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
    if (IsTourOpen())
    {
        if (TourStep + 1 >= TourBankedStep) return false;
        const QuebecTour::FSpot Spot = QuebecTour::Objective(TourStep + 1);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (IsHomeOpen())
    {
        if (HomeStep + 1 >= HomeBankedStep) return false;
        const QuebecHome::FSpot Spot = QuebecHome::Objective(HomeStep + 1);
        Out = At(Spot.X, Spot.Y);
        return true;
    }
    if (IsEscortOpen())
    {
        if (EscortStep != QuebecEscort::StepMeet) return false;
        Out = At(QuebecEscort::DoorX, QuebecEscort::DoorY);
        return true;
    }
    if (IsShadeOpen())
    {
        if (ShadeStep != QuebecShade::StepPocket) return false;
        Out = At(QuebecShade::FarX, QuebecShade::FarY);
        return true;
    }
    if (IsGrabOpen())
    {
        if (GrabStep != QuebecGrab::StepCase) return false;
        Out = At(QuebecGrab::DropX, QuebecGrab::DropY);
        return true;
    }
    if (IsCutOpen())
    {
        if (CutStep != QuebecCut::StepLine) return false;
        Out = At(QuebecCut::FinishX, QuebecCut::FinishY);
        return true;
    }
    if (IsChaseOpen())
    {
        if (ChaseStep != QuebecChase::StepSeat) return false;
        Out = At(QuebecChase::HideX, QuebecChase::HideY);
        return true;
    }
    if (IsFinaleOpen())
    {
        if (FinaleStep == QuebecFinale::StepMeet)
        {
            const QuebecFinale::FSpot Spot = QuebecFinale::Pocket();
            Out = At(Spot.X, Spot.Y);
            return true;
        }
        if (FinaleStep == QuebecFinale::StepDark)
        {
            const QuebecFinale::FSpot Spot = bFinaleBurned ? QuebecFinale::Far() : QuebecFinale::Case();
            Out = At(Spot.X, Spot.Y);
            return true;
        }
        if (FinaleStep == QuebecFinale::StepPage && !bFinaleHolding)
        {
            const QuebecFinale::FSpot Spot = QuebecFinale::Drop();
            Out = At(Spot.X, Spot.Y);
            return true;
        }
        if (FinaleStep == QuebecFinale::StepCut && !bFinaleRacing)
        {
            const QuebecFinale::FSpot Spot = QuebecFinale::Finish();
            Out = At(Spot.X, Spot.Y);
            return true;
        }
        if (FinaleStep == QuebecFinale::StepChase && !bFinaleTailing)
        {
            const QuebecFinale::FSpot Spot = QuebecFinale::Hide();
            Out = At(Spot.X, Spot.Y);
            return true;
        }
        return false;
    }
    if (IsFollowOpen())
    {
        if (FollowStep != QuebecFollow::StepMeet) return false;
        const QuebecFollow::FSpot Spot = QuebecFollow::Stop();
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

bool AQuebecCampaign::GetBeatPace(int32& OutIndex, int32& OutCount, int32& OutWalkSeconds, int32& OutSprintSeconds) const
{
    const auto Publish = [&](const QuebecPace::FBeat& Beat)
    {
        if (Beat.Count <= 0) return false;
        OutIndex = Beat.Index;
        OutCount = Beat.Count;
        OutWalkSeconds = Beat.WalkSeconds;
        OutSprintSeconds = Beat.SprintSeconds;
        if (Beat.bMeasureWalk)
        {
            FVector Next = FVector::ZeroVector;
            OutWalkSeconds = 0;
            OutSprintSeconds = 0;
            if (GetNextObjectiveLocation(Next))
            {
                const double Distance = static_cast<double>(FVector::Dist2D(GetObjectiveLocation(), Next));
                OutWalkSeconds = QuebecPace::WalkSeconds(Distance);
                OutSprintSeconds = QuebecPace::SprintSeconds(Distance);
            }
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
            const bool bShow = bCourtWorld && QuebecCourtRules::PartVisible(CourtStep, Index, CourtTime, Chain);
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
            const bool bShow = bConvoyWorld && QuebecConvoyRules::PartVisible(ConvoyStep, Index, ConvoyTime, Chain);
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
            if (Caption == EscortCaption)
            {
                Caption->SetVisibility(IsEscortOpen());
                Caption->SetWorldLocation(FVector(EscortFriendX, EscortFriendY, 200.f));
                Caption->SetText(FText::FromString(bEscortPlanted ? TEXT("WAITING") : TEXT("GREY COAT")));
            }
            if (Caption == EscortDoorCaption) Caption->SetVisibility(IsEscortOpen());
            if (Caption == ShadePocketCaption || Caption == ShadeFarCaption || Caption == ShadeLampACaption || Caption == ShadeLampBCaption)
                Caption->SetVisibility(IsShadeOpen());
            if (Caption == GrabCaseCaption)
            {
                Caption->SetVisibility(IsGrabOpen());
                Caption->SetText(FText::FromString(GrabStep == QuebecGrab::StepRun ? TEXT("TAKEN") : TEXT("CASE")));
            }
            if (Caption == GrabDropCaption) Caption->SetVisibility(IsGrabOpen());
            if (Caption == CutLineCaption)
            {
                Caption->SetVisibility(IsCutOpen());
                Caption->SetText(FText::FromString(CutStep == QuebecCut::StepRun ? TEXT("GONE") : TEXT("LINE")));
            }
            if (Caption == CutFinishCaption) Caption->SetVisibility(IsCutOpen());
            if (Caption == CutRivalCaption) Caption->SetVisibility(IsCutOpen());
            if (Caption == ChaseSeatCaption)
            {
                Caption->SetVisibility(IsChaseOpen());
                Caption->SetText(FText::FromString(ChaseStep == QuebecChase::StepTail ? TEXT("GONE") : TEXT("SEAT")));
            }
            if (Caption == ChaseHideCaption) Caption->SetVisibility(IsChaseOpen());
            if (Caption == ChaseTailCaption) Caption->SetVisibility(IsChaseOpen());
            if (Caption == FinaleMeetCaption) Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepMeet);
            if (Caption == FinalePocketCaption || Caption == FinaleFarCaption || Caption == FinaleLampACaption || Caption == FinaleLampBCaption)
                Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepDark);
            if (Caption == FinaleCaseCaption)
            {
                Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepPage);
                Caption->SetText(FText::FromString(bFinaleHolding ? TEXT("TAKEN") : TEXT("CASE")));
            }
            if (Caption == FinaleDropCaption) Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepPage);
            if (Caption == FinaleLineCaption)
            {
                Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepCut);
                Caption->SetText(FText::FromString(bFinaleRacing ? TEXT("GONE") : TEXT("LINE")));
            }
            if (Caption == FinaleFinishCaption) Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepCut);
            if (Caption == FinaleRivalCaption) Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepCut);
            if (Caption == FinaleSeatCaption)
            {
                Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepChase);
                Caption->SetText(FText::FromString(bFinaleTailing ? TEXT("GONE") : TEXT("SEAT")));
            }
            if (Caption == FinaleHideCaption) Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepChase);
            if (Caption == FinaleTailCaption) Caption->SetVisibility(IsFinaleOpen() && FinaleStep == QuebecFinale::StepChase);
            if (Caption == FollowMeetCaption) Caption->SetVisibility(IsFollowOpen() && FollowStep == QuebecFollow::StepMeet);
            if (Caption == FollowPersonCaption)
            {
                const QuebecFollow::FSpot Spot = QuebecFollow::Place(static_cast<double>(FollowAlong));
                Caption->SetVisibility(IsFollowOpen());
                Caption->SetWorldLocation(FVector(Spot.X, Spot.Y, 220.));
            }
            if (Caption == FollowStopCaption) Caption->SetVisibility(IsFollowOpen());
        }
        if (EscortDoor) EscortDoor->SetVisibility(IsEscortOpen());
        const bool bShadeWorld = IsShadeOpen();
        if (ShadePocket) ShadePocket->SetVisibility(bShadeWorld);
        if (ShadeFar) ShadeFar->SetVisibility(bShadeWorld);
        if (ShadeLampA) ShadeLampA->SetVisibility(bShadeWorld);
        if (ShadeLampB) ShadeLampB->SetVisibility(bShadeWorld);
        const bool bGrabWorld = IsGrabOpen();
        if (GrabCase) GrabCase->SetVisibility(bGrabWorld);
        if (GrabDrop) GrabDrop->SetVisibility(bGrabWorld);
        const bool bCutWorld = IsCutOpen();
        if (CutLine) CutLine->SetVisibility(bCutWorld);
        if (CutFinish) CutFinish->SetVisibility(bCutWorld);
        if (CutRival)
        {
            double RivalX = QuebecCut::StartX;
            double RivalY = QuebecCut::StartY;
            QuebecCut::Place(CutStep == QuebecCut::StepRun ? static_cast<double>(CutElapsed) : 0., RivalX, RivalY);
            CutRival->SetWorldLocation(FVector(RivalX, RivalY, 90.));
            CutRival->SetVisibility(bCutWorld);
            if (CutRivalCaption) CutRivalCaption->SetWorldLocation(FVector(RivalX, RivalY, 220.));
        }
        const bool bChaseWorld = IsChaseOpen();
        if (ChaseSeat) ChaseSeat->SetVisibility(bChaseWorld);
        if (ChaseHide) ChaseHide->SetVisibility(bChaseWorld);
        if (ChaseTail)
        {
            ChaseTail->SetWorldLocation(FVector(ChaseTailX, ChaseTailY, 90.));
            ChaseTail->SetVisibility(bChaseWorld);
            if (ChaseTailCaption) ChaseTailCaption->SetWorldLocation(FVector(ChaseTailX, ChaseTailY, 220.));
        }
        const bool bFinaleMeetWorld = IsFinaleOpen() && FinaleStep == QuebecFinale::StepMeet;
        const bool bFinaleDarkWorld = IsFinaleOpen() && FinaleStep == QuebecFinale::StepDark;
        const bool bFinalePageWorld = IsFinaleOpen() && FinaleStep == QuebecFinale::StepPage;
        const bool bFinaleCutWorld = IsFinaleOpen() && FinaleStep == QuebecFinale::StepCut;
        const bool bFinaleChaseWorld = IsFinaleOpen() && FinaleStep == QuebecFinale::StepChase;
        if (FinaleMeet) FinaleMeet->SetVisibility(bFinaleMeetWorld);
        if (FinalePocket) FinalePocket->SetVisibility(bFinaleDarkWorld);
        if (FinaleFar) FinaleFar->SetVisibility(bFinaleDarkWorld);
        if (FinaleLampA) FinaleLampA->SetVisibility(bFinaleDarkWorld);
        if (FinaleLampB) FinaleLampB->SetVisibility(bFinaleDarkWorld);
        if (FinaleCase) FinaleCase->SetVisibility(bFinalePageWorld);
        if (FinaleDrop) FinaleDrop->SetVisibility(bFinalePageWorld);
        if (FinaleLine) FinaleLine->SetVisibility(bFinaleCutWorld);
        if (FinaleFinish) FinaleFinish->SetVisibility(bFinaleCutWorld);
        if (FinaleRival)
        {
            double RivalX = QuebecFinale::Line().X;
            double RivalY = QuebecFinale::Line().Y;
            QuebecFinale::Place(bFinaleRacing ? static_cast<double>(FinaleElapsed) : 0., RivalX, RivalY);
            FinaleRival->SetWorldLocation(FVector(RivalX, RivalY, 90.));
            FinaleRival->SetVisibility(bFinaleCutWorld);
            if (FinaleRivalCaption) FinaleRivalCaption->SetWorldLocation(FVector(RivalX, RivalY, 220.));
        }
        if (FinaleSeat) FinaleSeat->SetVisibility(bFinaleChaseWorld);
        if (FinaleHide) FinaleHide->SetVisibility(bFinaleChaseWorld);
        if (FinaleTail)
        {
            FinaleTail->SetWorldLocation(FVector(FinaleTailX, FinaleTailY, 90.));
            FinaleTail->SetVisibility(bFinaleChaseWorld);
            if (FinaleTailCaption) FinaleTailCaption->SetWorldLocation(FVector(FinaleTailX, FinaleTailY, 220.));
        }
        const bool bFollowWorld = IsFollowOpen();
        const QuebecFollow::FSpot FollowSpot = QuebecFollow::Place(static_cast<double>(FollowAlong));
        if (FollowMeet) FollowMeet->SetVisibility(bFollowWorld && FollowStep == QuebecFollow::StepMeet);
        if (FollowStop) FollowStop->SetVisibility(bFollowWorld);
        if (FollowPerson)
        {
            FollowPerson->SetWorldLocation(FVector(FollowSpot.X, FollowSpot.Y, 90.));
            FollowPerson->SetVisibility(bFollowWorld);
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
    DOREPLIFETIME(AQuebecCampaign,bPondTagHolding);
    DOREPLIFETIME(AQuebecCampaign,PondTagInside);
    DOREPLIFETIME(AQuebecCampaign,PondTagOutside);
    DOREPLIFETIME(AQuebecCampaign,CourtStep);
    DOREPLIFETIME(AQuebecCampaign,CourtMisses);
    DOREPLIFETIME(AQuebecCampaign,Chain);
    DOREPLIFETIME(AQuebecCampaign,ChainMask);
    DOREPLIFETIME(AQuebecCampaign,bChainSpoiled);
    DOREPLIFETIME(AQuebecCampaign,ShowStep);
    DOREPLIFETIME(AQuebecCampaign,RescueMask);
    DOREPLIFETIME(AQuebecCampaign,ConvoyStep);
    DOREPLIFETIME(AQuebecCampaign,BlankStep);
    DOREPLIFETIME(AQuebecCampaign,TourStep);
    DOREPLIFETIME(AQuebecCampaign,HomeStep);
    DOREPLIFETIME(AQuebecCampaign,EscortStep);
    DOREPLIFETIME(AQuebecCampaign,EscortFriendX);
    DOREPLIFETIME(AQuebecCampaign,EscortFriendY);
    DOREPLIFETIME(AQuebecCampaign,bEscortPlanted);
    DOREPLIFETIME(AQuebecCampaign,ShadeStep);
    DOREPLIFETIME(AQuebecCampaign,bShadeBurned);
    DOREPLIFETIME(AQuebecCampaign,GrabStep);
    DOREPLIFETIME(AQuebecCampaign,GrabElapsed);
    DOREPLIFETIME(AQuebecCampaign,CutStep);
    DOREPLIFETIME(AQuebecCampaign,CutElapsed);
    DOREPLIFETIME(AQuebecCampaign,ChaseStep);
    DOREPLIFETIME(AQuebecCampaign,ChaseTailX);
    DOREPLIFETIME(AQuebecCampaign,ChaseTailY);
    DOREPLIFETIME(AQuebecCampaign,FinaleStep);
    DOREPLIFETIME(AQuebecCampaign,bFinaleBurned);
    DOREPLIFETIME(AQuebecCampaign,bFinaleHolding);
    DOREPLIFETIME(AQuebecCampaign,bFinaleRacing);
    DOREPLIFETIME(AQuebecCampaign,bFinaleTailing);
    DOREPLIFETIME(AQuebecCampaign,FinaleElapsed);
    DOREPLIFETIME(AQuebecCampaign,FinaleTailX);
    DOREPLIFETIME(AQuebecCampaign,FinaleTailY);
    DOREPLIFETIME(AQuebecCampaign,FollowStep);
    DOREPLIFETIME(AQuebecCampaign,FollowAlong);
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
