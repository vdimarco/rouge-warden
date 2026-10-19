#include "QuebecSideJobs.h"
#include "QuebecGameplay.h"
#include "QuebecCampaign.h"
#include "QuebecJobRules.h"
#include "QuebecPlayerState.h"
#include "QuebecPolice.h"
#include "LaFontaineMap.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerState.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    constexpr int32 SideJobDelivery = static_cast<int32>(QuebecJobRules::EJob::Delivery);
    constexpr int32 SideJobThief = static_cast<int32>(QuebecJobRules::EJob::Thief);
    constexpr int32 SideJobGoons = static_cast<int32>(QuebecJobRules::EJob::Goons);
    constexpr int32 SideJobEscape = static_cast<int32>(QuebecJobRules::EJob::Escape);

    // HUD text in Québec French. The 3D captions stay ASCII: the text-render font has no accented glyphs.
    const TCHAR* const SideJobTitles[] = {TEXT("Livraison chaude"), TEXT("Voleur de char"), TEXT("L'encre déborde"), TEXT("Cinq étoiles")};
    const TCHAR* const SideJobSigns[] = {TEXT("LIVRAISON CHAUDE"), TEXT("VOLEUR DE CHAR"), TEXT("L'ENCRE DEBORDE"), TEXT("CINQ ETOILES")};
    const TCHAR* const SideJobBriefs[] = {
        TEXT("Prends la commande au café, puis trois portes. Vite, c'est chaud!"),
        TEXT("Un voleur file sur Sherbrooke. Rentre-lui dedans jusqu'à ce que son char lâche."),
        TEXT("Les sbires du Curateur envahissent le Théâtre de Verdure. Trois vagues."),
        TEXT("Trois étoiles aux trousses. Sème la police ou cache-toi au garage.")
    };
    const TCHAR* const SideJobDoorStreets[] = {TEXT("rue De Lanaudière"), TEXT("rue Garnier"), TEXT("rue De La Roche")};
    static_assert(UE_ARRAY_COUNT(SideJobTitles) == QuebecJobRules::JobCount && UE_ARRAY_COUNT(SideJobSigns) == QuebecJobRules::JobCount);
    static_assert(UE_ARRAY_COUNT(SideJobDoorStreets) == QuebecJobRules::DoorCount);

    FVector SideJobVector(const QuebecJobRules::FJobSpot& Spot)
    {
        return FVector(Spot.X, Spot.Y, Spot.Z);
    }

    FVector SideJobRight(const FVector& Direction)
    {
        return FVector(-Direction.Y, Direction.X, 0.).GetSafeNormal();
    }

    // The thief drives the surveyed traffic graph: segment ends within 40 cm are linked, as for city traffic.
    const TArray<TArray<int32>>& SideJobRoadLinks()
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

    // Roads with an onward street at both ends, so the thief never drives into a dead end.
    const TArray<bool>& SideJobRoadMask()
    {
        static const TArray<bool> Roads = []
        {
            const TArray<TArray<int32>>& Links = SideJobRoadLinks();
            TArray<bool> Result;
            Result.Init(true,UE_ARRAY_COUNT(LaFontaine::RoadSegments));
            bool bChanged;
            do
            {
                bChanged = false;
                for (int32 I = 0; I < Result.Num(); ++I)
                    if (Result[I])
                        for (int32 Side = 0; Side < 2; ++Side)
                        {
                            bool bOnward = false;
                            for (int32 Next : Links[I*2+Side]) bOnward |= Result[Next];
                            if (!bOnward) { Result[I] = false; bChanged = true; break; }
                        }
            } while (bChanged);
            return Result;
        }();
        return Roads;
    }

    // Closest point on segment AB to Point in the ground plane, at A's height.
    FVector SideJobClosest2D(const FVector& Point, const FVector& A, const FVector& B)
    {
        const FVector Flat(Point.X,Point.Y,A.Z);
        return FMath::ClosestPointOnSegment(Flat,A,FVector(B.X,B.Y,A.Z));
    }

    int32 SideJobNearestRoad(const FVector& Point)
    {
        const TArray<bool>& Roads = SideJobRoadMask();
        int32 Best = INDEX_NONE;
        double BestDistance = TNumericLimits<double>::Max();
        for (int32 I = 0; I < Roads.Num(); ++I)
        {
            if (!Roads[I]) continue;
            const FVector Closest = SideJobClosest2D(Point,LaFontaine::RoadSegments[I][0],LaFontaine::RoadSegments[I][1]);
            const double Distance = FVector::DistSquared2D(Closest,Point);
            if (Distance < BestDistance) { BestDistance = Distance; Best = I; }
        }
        return Best;
    }
}

AQuebecSideJobs::AQuebecSideJobs()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    bAlwaysRelevant = true;
    SetNetUpdateFrequency(10.f);
    Scene = CreateDefaultSubobject<USceneComponent>(TEXT("SideJobsRoot"));
    SetRootComponent(Scene);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cube = CubeAsset.Object;
    Sphere = SphereAsset.Object;
    Cylinder = CylinderAsset.Object;
}

AQuebecSideJobs* AQuebecSideJobs::Find(const UWorld* World)
{
    // The HUD asks several times a frame; the last answer is reused while it belongs to the same world.
    static TWeakObjectPtr<AQuebecSideJobs> Cached;
    if (!World) return nullptr;
    if (AQuebecSideJobs* Known = Cached.Get(); Known && Known->GetWorld() == World) return Known;
    if (QuebecDistrict::IsToronto(World)) return nullptr;
    for (TActorIterator<AQuebecSideJobs> It(const_cast<UWorld*>(World)); It; ++It)
        if (IsValid(*It)) { Cached = *It; return *It; }
    return nullptr;
}

const TCHAR* AQuebecSideJobs::JobTitle(int32 Index)
{
    return Index >= 0 && Index < QuebecJobRules::JobCount ? SideJobTitles[Index] : TEXT("");
}

void AQuebecSideJobs::BeginPlay()
{
    Super::BeginPlay();
    if (QuebecDistrict::IsToronto(GetWorld()))
    {
        SetActorTickEnabled(false);
        return;
    }
    BuildMarkers();
    UpdatePresentation();
    UE_LOG(LogTemp,Display,TEXT("NORD_SIDEJOB ready markers=%d authority=%d"),MarkerPoints.Num(),HasAuthority() ? 1 : 0);
}

void AQuebecSideJobs::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // A world that ends removes every actor itself; only an explicit removal of this actor cleans up its job.
    if (EndPlayReason == EEndPlayReason::Destroyed && HasAuthority())
    {
        ClearJobContent();
        if (IsValid(LoanCar) && !LoanCar->GetController()) LoanCar->Destroy();
        for (const TObjectPtr<AActor>& Entry : Leftovers)
            if (const AQuebecCar* Car = Cast<AQuebecCar>(Entry.Get()); Car && !Car->GetController()) Entry->Destroy();
        Leftovers.Reset();
    }
    Super::EndPlay(EndPlayReason);
}

FVector AQuebecSideJobs::GroundPoint(const FVector& Point, float Lift) const
{
    // The surveyed district is flat; the trace finds the sidewalk or road and skips balconies and crowns above 3 m.
    // Only static geometry counts, so a parked car or a player on the spot is never taken for the ground.
    FCollisionQueryParams Query(SCENE_QUERY_STAT(SideJobGround),false,this);
    FHitResult Floor;
    if (GetWorld() && GetWorld()->LineTraceSingleByObjectType(Floor,Point+FVector(0.,0.,300.),Point-FVector(0.,0.,600.),
        FCollisionObjectQueryParams(ECC_WorldStatic),Query))
        return Floor.ImpactPoint+FVector(0.,0.,Lift);
    return Point+FVector(0.,0.,Lift);
}

UStaticMeshComponent* AQuebecSideJobs::AddPart(FName Name, UStaticMesh* Mesh, const FVector& Point, const FVector& Size)
{
    UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(this,Name);
    AddInstanceComponent(Part);
    Part->SetupAttachment(Scene);
    Part->SetStaticMesh(Mesh);
    Part->SetRelativeLocation(Point);
    Part->SetRelativeScale3D(Size/100.f);
    Part->SetMobility(EComponentMobility::Movable);
    Part->SetCollisionProfileName(TEXT("NoCollision"));
    Part->SetCastShadow(false);
    if (MarkerPaint) Part->SetMaterial(0,MarkerPaint);
    Part->RegisterComponent();
    return Part;
}

UTextRenderComponent* AQuebecSideJobs::AddCaption(FName Name, const FVector& Point, const FString& Words, float WorldSize, const FColor& Color)
{
    UTextRenderComponent* Caption = NewObject<UTextRenderComponent>(this,Name);
    AddInstanceComponent(Caption);
    Caption->SetupAttachment(Scene);
    Caption->SetRelativeLocation(Point);
    Caption->SetHorizontalAlignment(EHTA_Center);
    Caption->SetVerticalAlignment(EVRTA_TextCenter);
    Caption->SetWorldSize(WorldSize);
    Caption->SetText(FText::FromString(Words));
    Caption->SetTextRenderColor(Color);
    Caption->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    if (UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Text.M_Text"))) Caption->SetTextMaterial(Mat);
    Caption->RegisterComponent();
    return Caption;
}

void AQuebecSideJobs::BuildMarkers()
{
    if (bBuilt) return;
    bBuilt = true;
    // M_Cream takes a Tint like the campaign's gate paint; M_Gold is the fallback when the instance cannot be made.
    UMaterialInterface* Cream = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Cream.M_Cream"));
    if (UMaterialInstanceDynamic* Yellow = Cream ? UMaterialInstanceDynamic::Create(Cream,this) : nullptr)
    {
        Yellow->SetVectorParameterValue(TEXT("Tint"),FLinearColor(1.f,.76f,.04f));
        MarkerPaint = Yellow;
    }
    else MarkerPaint = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Gold.M_Gold"));
    MarkerPoints.Reset();
    for (int32 Index = 0; Index < QuebecJobRules::JobCount; ++Index)
    {
        const FVector Point = GroundPoint(SideJobVector(QuebecJobRules::Markers[Index]),0.f);
        MarkerPoints.Add(Point);
        MarkerParts.Add(AddPart(*FString::Printf(TEXT("JobMarkerDisc%d"),Index),Cylinder,Point+FVector(0.,0.,4.),FVector(320.,320.,6.)));
        MarkerParts.Add(AddPart(*FString::Printf(TEXT("JobMarkerHalo%d"),Index),Cylinder,Point+FVector(0.,0.,90.),FVector(240.,240.,3.)));
        MarkerLetters.Add(AddCaption(*FString::Printf(TEXT("JobMarkerLetter%d"),Index),Point+FVector(0.,0.,250.),TEXT("M"),120.f,FColor(255,200,24)));
        MarkerTitles.Add(AddCaption(*FString::Printf(TEXT("JobMarkerTitle%d"),Index),Point+FVector(0.,0.,165.),SideJobSigns[Index],26.f,FColor(255,238,193)));
    }
    GoalDisc = AddPart(TEXT("JobGoalDisc"),Cylinder,FVector::ZeroVector,FVector(420.,420.,6.));
    GoalColumn = AddPart(TEXT("JobGoalColumn"),Cylinder,FVector::ZeroVector,FVector(30.,30.,900.));
    GoalBag = AddPart(TEXT("JobGoalBag"),Cube,FVector::ZeroVector,FVector(32.,22.,40.));
    if (UMaterialInterface* Kraft = LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/ParkComic/M_Wood.M_Wood"))) GoalBag->SetMaterial(0,Kraft);
    GoalCaption = AddCaption(TEXT("JobGoalCaption"),FVector::ZeroVector,FString(),46.f,FColor(255,200,24));
    ThiefCaption = AddCaption(TEXT("JobThiefCaption"),FVector::ZeroVector,TEXT("VOLEUR"),70.f,FColor(255,70,50));
    GoalDisc->SetVisibility(false);
    GoalColumn->SetVisibility(false);
    GoalBag->SetVisibility(false);
    GoalCaption->SetVisibility(false);
    ThiefCaption->SetVisibility(false);
}

float AQuebecSideJobs::GetServerNow() const
{
    const UWorld* World = GetWorld();
    if (!World) return 0.f;
    const AGameStateBase* Game = World->GetGameState();
    return static_cast<float>(Game ? Game->GetServerWorldTimeSeconds() : World->GetTimeSeconds());
}

float AQuebecSideJobs::GetRemainingSeconds() const
{
    if (!IsActive()) return 0.f;
    return QuebecJobRules::Remaining(static_cast<double>(DeadlineTime),static_cast<double>(GetServerNow()));
}

int32 AQuebecSideJobs::MarkerAt(const APawn* Pawn) const
{
    if (!Cast<AQuebecCharacter>(Pawn)) return INDEX_NONE;
    const FVector Here = Pawn->GetActorLocation();
    for (int32 Index = 0; Index < MarkerPoints.Num(); ++Index)
        if (FVector::DistSquared2D(Here,MarkerPoints[Index]) <= FMath::Square(QuebecJobRules::MarkerRadius) &&
            FMath::Abs(Here.Z-MarkerPoints[Index].Z) < 300.) return Index;
    return INDEX_NONE;
}

FString AQuebecSideJobs::GetPrompt(const APawn* Pawn) const
{
    const int32 Index = MarkerAt(Pawn);
    if (Index == INDEX_NONE) return FString();
    if (IsActive()) return FString::Printf(TEXT("Mission en cours : %s  /  R recommence"),JobTitle(JobIndex));
    return FString::Printf(TEXT("[ E ]  MISSION  /  %s%s"),JobTitle(Index),IsCompleted(Index) ? TEXT("  (rejouer)") : TEXT(""));
}

bool AQuebecSideJobs::GetTarget(FVector& OutLocation) const
{
    if (!IsActive() || !bHasTarget) return false;
    OutLocation = IsValid(TargetActor) ? TargetActor->GetActorLocation() : TargetLocation;
    return true;
}

AQuebecController* AQuebecSideJobs::FindStarter() const
{
    if (!StarterState || !GetWorld()) return nullptr;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        if (It->PlayerState == StarterState) return *It;
    return nullptr;
}

APawn* AQuebecSideJobs::NearestPlayerPawn(const FVector& Point, float* OutDistance) const
{
    APawn* Best = nullptr;
    double BestDistance = 1e9;
    if (GetWorld())
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            if (APawn* Body = It->GetPawn())
            {
                const double Distance = FVector::Dist2D(Body->GetActorLocation(),Point);
                if (Distance < BestDistance) { BestDistance = Distance; Best = Body; }
            }
    if (OutDistance) *OutDistance = static_cast<float>(BestDistance);
    return Best;
}

void AQuebecSideJobs::Say(const FString& Title, const FString& Detail, float Seconds) const
{
    if (!GetWorld()) return;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) QuebecNotice::Show(*It,Title,Detail,Seconds);
}

void AQuebecSideJobs::SetObjective(const FString& Words, const FVector& Location, bool bTarget)
{
    ObjectiveText = Words;
    TargetLocation = Location;
    bHasTarget = bTarget;
}

bool AQuebecSideJobs::ReachedBy(const FVector& Point, double Radius, APlayerState** OutWho, const APlayerState* Only) const
{
    if (!GetWorld()) return false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        if (Only && It->PlayerState != Only) continue;
        const APawn* Body = It->GetPawn();
        if (!Body || FMath::Abs(Body->GetActorLocation().Z-Point.Z) > 400.) continue;
        const double Distance = FVector::Dist2D(Body->GetActorLocation(),Point);
        const AQuebecCar* Car = Cast<AQuebecCar>(Body);
        const bool bHere = Radius > 0. ? Distance <= Radius : QuebecJobRules::Arrived(Distance,Car != nullptr,Car ? Car->Speed : 0.f);
        if (!bHere) continue;
        if (OutWho) *OutWho = It->PlayerState;
        return true;
    }
    return false;
}

bool AQuebecSideJobs::HandleInteract(AQuebecController* Player)
{
    if (!HasAuthority() || !Player || QuebecDistrict::IsToronto(GetWorld())) return false;
    const AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Player->GetPawn());
    const int32 Index = MarkerAt(Walker);
    if (Index == INDEX_NONE) return false;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(SideJobInteract),false,Walker);
    Query.AddIgnoredActor(this);
    FHitResult Hit;
    if (GetWorld()->LineTraceSingleByChannel(Hit,Walker->GetActorLocation()+FVector(0.,0.,35.),MarkerPoints[Index]+FVector(0.,0.,100.),ECC_Visibility,Query)) return false;
    if (const AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Player->PlayerState); Stats && Stats->IsDown()) return true;
    if (IsActive())
    {
        QuebecNotice::Show(Player,TEXT("MISSION EN COURS"),FString::Printf(TEXT("%s  /  R recommence"),JobTitle(JobIndex)),3.f);
        return true;
    }
    for (TActorIterator<AQuebecCampaign> It(GetWorld()); It; ++It)
        if (It->Phase == EQuebecCampaignPhase::RaceRunning || It->IsAimingLight(Player))
        {
            QuebecNotice::Show(Player,TEXT("PAS MAINTENANT"),TEXT("Termine d'abord la scène du Curateur."),3.f);
            return true;
        }
    return StartJob(Index,Player);
}

bool AQuebecSideJobs::StartJob(int32 Index, AQuebecController* Player)
{
    if (!HasAuthority() || Index < 0 || Index >= QuebecJobRules::JobCount) return false;
    ClearJobContent();
    const float Now = GetServerNow();
    JobIndex = Index;
    JobState = EQuebecJobState::Running;
    JobStep = 0;
    JobProgress = 0.f;
    StartedAt = Now;
    DeadlineTime = Now+QuebecJobRules::TimeLimits[Index];
    StarterState = Player ? Player->PlayerState.Get() : nullptr;
    CarrierState = nullptr;
    OutsideSince = LostSince = NextWaveAt = -1.f;
    NextTargetRefresh = NextTargetWrite = 0.f;
    bSawStars = false;
    RetryUntil = 0.f;
    // Someone already down (respawning) when the job begins does not fail it; a new K.-O. or arrest does.
    DownAtStart.Reset();
    if (GetWorld())
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            if (const AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(It->PlayerState); Stats && Stats->IsDown()) DownAtStart.Add(It->PlayerState.Get());
    BeginJobContent(Player);
    if (GetWorld())
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) It->PlayFeedback(EQuebecFeedbackCue::Dialogue);
    Say(SideJobSigns[Index],SideJobBriefs[Index],4.5f);
    UE_LOG(LogTemp,Display,TEXT("NORD_SIDEJOB start job=%d starter=%s deadline=%.1f"),Index,*GetNameSafe(StarterState),DeadlineTime);
    UpdatePresentation();
    ForceNetUpdate();
    return true;
}

void AQuebecSideJobs::BeginJobContent(AQuebecController* Player)
{
    APawn* Body = Player ? Player->GetPawn() : nullptr;
    const FVector MarkerPoint = MarkerPoints.IsValidIndex(JobIndex) ? MarkerPoints[JobIndex] : SideJobVector(QuebecJobRules::Markers[JobIndex]);
    if (JobIndex == SideJobDelivery)
    {
        SetObjective(TEXT("Prends la commande au café"),GroundPoint(SideJobVector(QuebecJobRules::DeliveryCafe),0.f),true);
    }
    else if (JobIndex == SideJobThief)
    {
        // The thief starts on the nearest through road, in the lane that leads away from the player.
        const FVector Seed = SideJobVector(QuebecJobRules::ThiefStart);
        ThiefSegment = SideJobNearestRoad(Seed);
        if (ThiefSegment != INDEX_NONE)
        {
            const FVector A = LaFontaine::RoadSegments[ThiefSegment][0], B = LaFontaine::RoadSegments[ThiefSegment][1];
            const FVector From = Body ? Body->GetActorLocation() : MarkerPoint;
            bThiefForward = FVector::DistSquared2D(B,From) >= FVector::DistSquared2D(A,From);
            const FVector Heading = ((bThiefForward ? B : A)-(bThiefForward ? A : B)).GetSafeNormal2D();
            const FVector Lane = SideJobRight(Heading)*(LaFontaine::RoadSegmentWidths[ThiefSegment]*.25f);
            const FVector Base = SideJobClosest2D(Seed,A,B);
            for (const float Along : {0.f,900.f,-900.f,1800.f})
            {
                ThiefCar = SpawnJobCar(Base+Heading*Along+Lane,Heading,3,TEXT("SideJobTarget"));
                if (ThiefCar) break;
            }
        }
        if (!ThiefCar)
        {
            UE_LOG(LogTemp,Warning,TEXT("NORD_SIDEJOB thief car could not spawn"));
            SetObjective(TEXT("Le voleur reste introuvable"),SideJobVector(QuebecJobRules::ThiefStart),false);
            return;
        }
        TargetActor = ThiefCar;
        LastThiefVelocity = FVector::ZeroVector;
        ThiefCar->SetAutopilot(0.f,0.f,false);
        SetObjective(TEXT("Rentre dans le char volé jusqu'à ce qu'il lâche"),ThiefCar->GetActorLocation(),true);
        // A walker gets a loaner at the curb unless a free car already waits near the marker.
        bool bFreeCar = !Cast<AQuebecCharacter>(Body);
        for (TActorIterator<AQuebecCar> It(GetWorld()); It && !bFreeCar; ++It)
            if (*It != ThiefCar && !It->Occupant && !It->GetController() && !It->bPolice && !It->IsWrecked() &&
                FVector::Dist2D(It->GetActorLocation(),MarkerPoint) < 3000.) bFreeCar = true;
        const int32 Curb = bFreeCar ? INDEX_NONE : SideJobNearestRoad(MarkerPoint);
        if (Curb != INDEX_NONE && !IsValid(LoanCar))
        {
            const FVector A = LaFontaine::RoadSegments[Curb][0], B = LaFontaine::RoadSegments[Curb][1];
            const FVector Heading = (B-A).GetSafeNormal2D();
            const FVector Base = SideJobClosest2D(MarkerPoint,A,B)+SideJobRight(Heading)*(LaFontaine::RoadSegmentWidths[Curb]*.4f);
            for (const float Along : {0.f,700.f,-700.f})
            {
                LoanCar = SpawnJobCar(Base+Heading*Along,Heading,1,TEXT("SideJobLoan"));
                if (LoanCar) break;
            }
        }
    }
    else if (JobIndex == SideJobGoons)
    {
        GrantPistols();
        SetObjective(TEXT("Vague 1/3 : mets les sbires K.-O."),GroundPoint(SideJobVector(QuebecJobRules::GoonArena),0.f),true);
        SpawnWave(0);
    }
    else if (JobIndex == SideJobEscape)
    {
        // At least three stars; a player who is already more wanted keeps the higher level.
        if (Player) QuebecCrime::SetStars(Player,FMath::Max(QuebecCrime::Stars(Player),QuebecJobRules::EscapeStars));
        // The way out is the police garage, which clears stars only for a car that no unit sees. The table point is the fallback.
        FVector Garage = QuebecPolice::GarageLocation();
        if (Garage.IsNearlyZero()) Garage = SideJobVector(QuebecJobRules::EscapeGarage);
        SetObjective(TEXT("Sème la police ou rejoins le garage"),GroundPoint(Garage,0.f),true);
    }
}

void AQuebecSideJobs::GrantPistols()
{
    // Every player without a gun gets a pistol, so nobody faces the goons with bare fists on a phone.
    if (!GetWorld()) return;
    const int32 Pistol = static_cast<int32>(EQuebecWeapon::Pistol);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        // A downed player would lose it at the respawn; TickJob arms them when they stand up.
        AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(It->PlayerState);
        if (!Stats || Stats->IsDown() || Stats->HasWeapon(EQuebecWeapon::Pistol) || Stats->HasWeapon(EQuebecWeapon::SMG) || Stats->HasWeapon(EQuebecWeapon::Shotgun)) continue;
        Stats->OwnedWeapons |= 1 << Pistol;
        if (Stats->Ammo.IsValidIndex(Pistol)) Stats->Ammo[Pistol] = FMath::Max(Stats->Ammo[Pistol],QuebecJobRules::PistolRounds);
        Stats->Weapon = static_cast<uint8>(Pistol);
        Stats->Changed();
    }
}

bool AQuebecSideJobs::IsHeldByPolice(const AQuebecController* Player)
{
    const AQuebecPlayerState* Stats = Player ? Cast<AQuebecPlayerState>(Player->PlayerState) : nullptr;
    if (Stats && Stats->IsDown()) return true;
    const APawn* Body = Player ? Player->GetPawn() : nullptr;
    UWorld* World = Player ? Player->GetWorld() : nullptr;
    if (!Body || !Stats || Stats->Stars == 0 || !World) return false;
    // The dispatcher's arrest hold is private; an officer on its feet within 2.5 m of a wanted player stands for it.
    for (TActorIterator<AQuebecOfficer> It(World); It; ++It)
        if (It->Faction == AQuebecOfficer::FactionPolice && !It->IsDown() &&
            FVector::DistSquared2D(It->GetActorLocation(),Body->GetActorLocation()) < FMath::Square(250.f)) return true;
    return false;
}

void AQuebecSideJobs::RetireActor(AActor* Actor)
{
    if (IsValid(Actor)) Leftovers.AddUnique(Actor);
}

void AQuebecSideJobs::TickLeftovers()
{
    // A job car leaves only when no player can see it: beyond 150 m, or out of every view cone and more than 25 m away.
    if (!GetWorld()) return;
    for (int32 Index = Leftovers.Num()-1; Index >= 0; --Index)
    {
        AActor* Leftover = Leftovers[Index];
        const AQuebecCar* Car = Cast<AQuebecCar>(Leftover);
        if (!IsValid(Leftover) || (Car && (Car->GetController() || Car->Occupant))) { Leftovers.RemoveAt(Index); continue; }
        bool bSeen = false;
        for (TActorIterator<AQuebecController> It(GetWorld()); It && !bSeen; ++It)
        {
            FVector Eye;
            FRotator View;
            It->GetPlayerViewPoint(Eye,View);
            double ConeCosine = .35;
            // A remote driver sends the server no camera updates, so assume the chase camera behind the car and a wider
            // cone for free look, as AQuebecPoliceDispatch::InAnyView does.
            if (!It->IsLocalController())
                if (const AQuebecCar* Driven = Cast<AQuebecCar>(It->GetPawn()))
                {
                    View = Driven->GetActorRotation();
                    Eye = Driven->GetActorLocation()-Driven->GetActorForwardVector()*700.+FVector(0.,0.,250.);
                    ConeCosine = .17;
                }
            const FVector Offset = Leftover->GetActorLocation()-Eye;
            const double Distance = Offset.Size();
            bSeen = Distance < 2500. || (Distance < 15000. && FVector::DotProduct(Offset/FMath::Max(Distance,1.),View.Vector()) > ConeCosine);
        }
        if (bSeen) continue;
        Leftover->Destroy();
        Leftovers.RemoveAt(Index);
    }
}

AQuebecCar* AQuebecSideJobs::SpawnJobCar(const FVector& Point, const FVector& Heading, int32 Paint, FName Tag) const
{
    UWorld* World = GetWorld();
    if (!World) return nullptr;
    const FTransform Transform(FRotator(0.,Heading.Rotation().Yaw,0.),GroundPoint(Point,102.f));
    AQuebecCar* Car = World->SpawnActorDeferred<AQuebecCar>(AQuebecCar::StaticClass(),Transform,nullptr,nullptr,
        ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButDontSpawnIfColliding);
    if (!Car) return nullptr;
    Car->PaintStyle = Paint;
    Car->BodyProfile = 1;
    Car->Tags.Add(Tag);
    // The radar reaches 250 m, beyond the car's usual cull distance.
    Car->bAlwaysRelevant = true;
    Car->FinishSpawning(Transform);
    return IsValid(Car) ? Car : nullptr;
}

void AQuebecSideJobs::SpawnWave(int32 Wave)
{
    if (!GetWorld() || Wave < 0 || Wave >= QuebecJobRules::WaveCount) return;
    const FVector Arena = SideJobVector(QuebecJobRules::GoonArena);
    APawn* Target = NearestPlayerPawn(Arena);
    for (int32 Slot = 0; Slot < QuebecJobRules::WaveSizes[Wave]; ++Slot)
    {
        const FVector Point = GroundPoint(SideJobVector(QuebecJobRules::GoonSpawns[(Slot+Wave*2)%QuebecJobRules::GoonSpawnCount]),100.f);
        const float Yaw = static_cast<float>((Arena-Point).Rotation().Yaw);
        if (AQuebecOfficer* Goon = AQuebecOfficer::SpawnOfficer(GetWorld(),Point,Yaw,AQuebecOfficer::FactionGoon))
        {
            Goon->Tags.Add(TEXT("SideJobGoon"));
            if (Target) Goon->SetTargetPlayer(Target);
            Goons.Add(Goon);
        }
    }
    UE_LOG(LogTemp,Display,TEXT("NORD_SIDEJOB wave=%d goons=%d"),Wave+1,Goons.Num());
}

void AQuebecSideJobs::ClearJobContent()
{
    if (IsValid(ThiefCar))
    {
        // A player who took the thief's car keeps it; otherwise it stops and leaves once nobody sees it.
        ThiefCar->ClearAutopilot();
        if (!ThiefCar->GetDriverController()) RetireActor(ThiefCar);
    }
    ThiefCar = nullptr;
    TargetActor = nullptr;
    // A loaner that a player drives stays until it is left empty (see Tick); an empty one leaves unseen.
    if (IsValid(LoanCar) && !LoanCar->GetController() && !LoanCar->Occupant) { RetireActor(LoanCar); LoanCar = nullptr; }
    if (!IsValid(LoanCar)) LoanCar = nullptr;
    for (const TObjectPtr<AActor>& Entry : Goons)
        if (IsValid(Entry)) Entry->Destroy();
    Goons.Reset();
    ThiefSegment = INDEX_NONE;
    ThiefSlowSince = ThiefReverseUntil = -1.f;
    LastRamAt = -10.f;
    LastThiefVelocity = FVector::ZeroVector;
}

void AQuebecSideJobs::FinishJob(bool bSucceeded, const FString& Reason)
{
    if (!HasAuthority() || JobIndex == INDEX_NONE) return;
    const int32 Finished = JobIndex;
    const int32 Reward = bSucceeded ? QuebecJobRules::Rewards[Finished] : 0;
    ClearJobContent();
    if (bSucceeded)
    {
        CompletedMask |= 1 << Finished;
        // Shared co-op: everyone in the session is paid.
        if (const AGameStateBase* Game = GetWorld() ? GetWorld()->GetGameState() : nullptr)
            for (APlayerState* Each : Game->PlayerArray)
                if (AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(Each)) { Stats->Cash += Reward; Stats->Changed(); }
        if (GetWorld())
            for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) It->PlayFeedback(EQuebecFeedbackCue::Complete);
    }
    LastJob = Finished;
    bLastSucceeded = bSucceeded;
    LastReward = Reward;
    LastResult = Reason;
    // After MISSION RATÉE, R restarts the same job from its marker for a while instead of the campaign checkpoint.
    RetryUntil = bSucceeded ? 0.f : GetServerNow()+RetrySeconds;
    ++ResultSerial;
    JobState = bSucceeded ? EQuebecJobState::Succeeded : EQuebecJobState::Failed;
    JobIndex = INDEX_NONE;
    JobStep = 0;
    DeadlineTime = 0.f;
    JobProgress = 0.f;
    StarterState = nullptr;
    CarrierState = nullptr;
    SetObjective(FString(),FVector::ZeroVector,false);
    UE_LOG(LogTemp,Display,TEXT("NORD_SIDEJOB end job=%d success=%d reward=%d reason=%s"),Finished,bSucceeded ? 1 : 0,Reward,*Reason);
    UpdatePresentation();
    ForceNetUpdate();
}

bool AQuebecSideJobs::RequestRetry(AQuebecController* Player)
{
    if (!HasAuthority() || !Player) return false;
    const bool bRetryFailed = !IsActive() && !bLastSucceeded && LastJob >= 0 && LastJob < QuebecJobRules::JobCount &&
        RetryUntil > 0.f && GetServerNow() < RetryUntil;
    if (!IsActive() && !bRetryFailed) return false;
    // A downed player waits for the respawn, and R never pulls a player out of an officer's arrest hold.
    if (IsHeldByPolice(Player)) return true;
    // The same guard as E: during the campaign race or while aiming the worklight, R belongs to the campaign.
    for (TActorIterator<AQuebecCampaign> It(GetWorld()); It; ++It)
        if (It->Phase == EQuebecCampaignPhase::RaceRunning || It->IsAimingLight(Player)) return false;
    const int32 Index = IsActive() ? JobIndex : LastJob;
    MovePlayerToMarker(Player,Index);
    StartJob(Index,Player);
    UE_LOG(LogTemp,Display,TEXT("NORD_SIDEJOB retry job=%d by=%s"),Index,*GetNameSafe(Player));
    return true;
}

bool AQuebecSideJobs::MovePlayerToMarker(AQuebecController* Player, int32 Index)
{
    APawn* Body = Player ? Player->GetPawn() : nullptr;
    if (!Body || !MarkerPoints.IsValidIndex(Index) || !GetWorld()) return false;
    AQuebecCar* Car = Cast<AQuebecCar>(Body);
    AQuebecCharacter* Walker = Cast<AQuebecCharacter>(Body);
    if (!Car && !Walker) return false;
    FVector Base = MarkerPoints[Index];
    FRotator Facing(0.f,0.f,0.f);
    if (Car)
    {
        // A driver returns to the lane beside the marker, nose along the street.
        const int32 Road = SideJobNearestRoad(Base);
        if (Road != INDEX_NONE)
        {
            const FVector A = LaFontaine::RoadSegments[Road][0], B = LaFontaine::RoadSegments[Road][1];
            const FVector Heading = (B-A).GetSafeNormal2D();
            Base = SideJobClosest2D(Base,A,B)+SideJobRight(Heading)*(LaFontaine::RoadSegmentWidths[Road]*.25f);
            Base.Z = MarkerPoints[Index].Z;
            Facing.Yaw = Heading.Rotation().Yaw;
        }
    }
    FCollisionQueryParams Query(SCENE_QUERY_STAT(SideJobRecovery),false,Body);
    Query.AddIgnoredActor(this);
    if (Car && Car->Occupant) Query.AddIgnoredActor(Car->Occupant);
    const FVector Side = Facing.RotateVector(FVector::RightVector);
    const FVector Forward = Facing.Vector();
    const FVector Offsets[] = {FVector::ZeroVector,Side*350.,-Side*350.,Forward*500.,-Forward*500.};
    for (const FVector& Offset : Offsets)
    {
        const FVector Candidate = Base+Offset;
        FHitResult Floor;
        if (!GetWorld()->LineTraceSingleByChannel(Floor,Candidate+FVector(0.,0.,300.),Candidate-FVector(0.,0.,600.),ECC_Visibility,Query) || Floor.ImpactNormal.Z < .8f) continue;
        const FVector Destination(Floor.ImpactPoint.X,Floor.ImpactPoint.Y,Floor.ImpactPoint.Z+(Car ? 102. : 100.));
        if (Car ? !Car->CanFitAt(Destination,Facing.Quaternion(),this) :
            GetWorld()->OverlapBlockingTestByChannel(Destination,FQuat::Identity,ECC_Pawn,FCollisionShape::MakeCapsule(42.f,96.f),Query)) continue;
        if (Car) Car->ResetMotion(); else Walker->GetCharacterMovement()->StopMovementImmediately();
        if (!Body->SetActorLocationAndRotation(Destination,Facing,false,nullptr,ETeleportType::TeleportPhysics)) continue;
        if (Car) Car->ResetMotion();
        Player->SetControlRotation(Facing);
        Player->ClientSetRotation(Facing,true);
        return true;
    }
    return false;
}

void AQuebecSideJobs::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!GetWorld() || QuebecDistrict::IsToronto(GetWorld())) return;
    if (HasAuthority())
    {
        if (IsActive()) TickJob(DeltaSeconds);
        else if (IsValid(LoanCar) && !LoanCar->GetController() && !LoanCar->Occupant) { RetireActor(LoanCar); LoanCar = nullptr; }
        TickLeftovers();
    }
    // The thief's caption rides above its car every frame on every peer.
    if (ThiefCaption)
    {
        const AActor* Followed = IsActive() && JobIndex == SideJobThief ? TargetActor.Get() : nullptr;
        ThiefCaption->SetVisibility(IsValid(Followed));
        if (IsValid(Followed)) ThiefCaption->SetWorldLocation(Followed->GetActorLocation()+FVector(0.,0.,250.));
    }
    const float Clock = static_cast<float>(GetWorld()->GetTimeSeconds());
    if (Clock-LastPresentationTime >= .1f)
    {
        LastPresentationTime = Clock;
        UpdatePresentation();
    }
}

void AQuebecSideJobs::TickJob(float DeltaSeconds)
{
    const float Now = GetServerNow();
    AQuebecController* Starter = FindStarter();
    if (!Starter && GetWorld())
    {
        // The starter left: the other player inherits the job. In the escape the stars belong to the new starter, who
        // must be wanted and lose them again; the old starter's lost stars must not pay out.
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
            if (It->PlayerState) { Starter = *It; StarterState = It->PlayerState; break; }
        if (Starter && JobIndex == SideJobEscape)
        {
            bSawStars = false;
            QuebecCrime::SetStars(Starter,FMath::Max(QuebecCrime::Stars(Starter),QuebecJobRules::EscapeStars));
        }
    }
    if (!Starter) { FinishJob(false,TEXT("Mission abandonnée")); return; }
    // The job is shared, so any player's new K.-O. or arrest fails it.
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
    {
        const AQuebecPlayerState* Stats = Cast<AQuebecPlayerState>(It->PlayerState);
        if (!Stats) continue;
        const int32 Waiting = DownAtStart.IndexOfByKey(TWeakObjectPtr<APlayerState>(It->PlayerState.Get()));
        if (!Stats->IsDown())
        {
            if (Waiting == INDEX_NONE) continue;
            DownAtStart.RemoveAt(Waiting);
            // A partner who was down when the goon fight began is armed once standing.
            if (JobIndex == SideJobGoons) GrantPistols();
            continue;
        }
        if (Waiting != INDEX_NONE) continue;
        FinishJob(false,Stats->GetDownState() == EQuebecDownState::Arrested ? TEXT("Arrêté par la police") : TEXT("K.-O."));
        return;
    }
    if (DeadlineTime > 0.f && Now >= DeadlineTime) { FinishJob(false,TEXT("Temps écoulé")); return; }
    if (JobIndex == SideJobDelivery) TickDelivery();
    else if (JobIndex == SideJobThief) TickThief(Now,DeltaSeconds);
    else if (JobIndex == SideJobGoons) TickGoons(Now);
    else if (JobIndex == SideJobEscape) TickEscape(Now);
}

void AQuebecSideJobs::TickDelivery()
{
    APlayerState* Who = nullptr;
    if (JobStep == 0)
    {
        if (!ReachedBy(TargetLocation,0.,&Who)) return;
        CarrierState = Who;
        JobStep = 1;
        Say(TEXT("COMMANDE RÉCUPÉRÉE"),FString::Printf(TEXT("Porte 1/3 · %s"),SideJobDoorStreets[0]),2.5f);
        SetObjective(FString::Printf(TEXT("Livre la porte 1/3 · %s"),SideJobDoorStreets[0]),GroundPoint(SideJobVector(QuebecJobRules::DeliveryDoors[0]),0.f),true);
        for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) It->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
        ForceNetUpdate();
        return;
    }
    // The bag rides with whoever picked it up; a wrecked car spills it. If the carrier left, anyone may deliver.
    bool bCarrierHere = false;
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It)
        if (It->PlayerState == CarrierState)
        {
            bCarrierHere = true;
            if (const AQuebecCar* Car = Cast<AQuebecCar>(It->GetPawn()); Car && Car->IsWrecked())
            {
                FinishJob(false,TEXT("La commande est écrasée"));
                return;
            }
        }
    if (!bCarrierHere) CarrierState = nullptr;
    // Only the carrier's own arrival counts, so a partner standing at the door never hides it.
    if (!ReachedBy(TargetLocation,0.,&Who,CarrierState)) return;
    const int32 Done = FMath::Clamp(JobStep,1,QuebecJobRules::DoorCount);
    JobProgress = static_cast<float>(Done)/QuebecJobRules::DoorCount;
    if (Done >= QuebecJobRules::DoorCount) { FinishJob(true,TEXT("Trois portes livrées, encore chaud")); return; }
    // Each door adds its bonus to the clock that is left.
    DeadlineTime = static_cast<float>(QuebecJobRules::DeliveryDeadline(StartedAt,Done));
    JobStep = Done+1;
    Say(TEXT("LIVRÉ!"),FString::Printf(TEXT("Porte %d/3 · +%.0f s"),Done,QuebecJobRules::DoorBonusSeconds),2.5f);
    SetObjective(FString::Printf(TEXT("Livre la porte %d/3 · %s"),Done+1,SideJobDoorStreets[Done]),GroundPoint(SideJobVector(QuebecJobRules::DeliveryDoors[Done]),0.f),true);
    for (TActorIterator<AQuebecController> It(GetWorld()); It; ++It) It->PlayFeedback(EQuebecFeedbackCue::Checkpoint);
    ForceNetUpdate();
}

void AQuebecSideJobs::TickThief(float Now, float DeltaSeconds)
{
    AQuebecCar* Car = ThiefCar;
    if (!IsValid(Car)) { FinishJob(false,TEXT("Le voleur s'est échappé")); return; }
    JobProgress = FMath::Clamp(Car->BodyDamage/100.f,0.f,1.f);
    if (Car->IsWrecked() || Car->GetDriverController())
    {
        Car->ClearAutopilot();
        FinishJob(true,Car->IsWrecked() ? TEXT("Le char volé est hors d'usage") : TEXT("Tu as repris le char volé"));
        return;
    }
    // A hard hit from a player's car counts as a ram on top of the car's own impact damage.
    const FVector Velocity = Car->PlanarVelocity();
    const float Change = static_cast<float>((Velocity-LastThiefVelocity).Size());
    LastThiefVelocity = Velocity;
    if (DeltaSeconds > 0.f && Now-LastRamAt > .4f && QuebecJobRules::RamDamage(Change) > 0.f)
        for (TActorIterator<AQuebecCar> It(GetWorld()); It; ++It)
            if (*It != Car && It->GetDriverController() && FVector::Dist2D(It->GetActorLocation(),Car->GetActorLocation()) < 700.)
            {
                Car->AddBodyDamage(QuebecJobRules::RamDamage(Change),It->GetDriverController());
                LastRamAt = Now;
                break;
            }
    float Nearest = 0.f;
    NearestPlayerPawn(Car->GetActorLocation(),&Nearest);
    if (Nearest > QuebecJobRules::ThiefLostDistance)
    {
        if (LostSince < 0.f) LostSince = Now;
        else if (Now-LostSince > QuebecJobRules::ThiefLostSeconds) { FinishJob(false,TEXT("Le voleur t'a semé")); return; }
    }
    else LostSince = -1.f;
    // Clients follow TargetActor; the replicated point is only a 4 Hz fallback, not a per-frame write.
    if (Now >= NextTargetWrite) { TargetLocation = Car->GetActorLocation(); NextTargetWrite = Now+.25f; }
    DriveThief(Now);
}

void AQuebecSideJobs::DriveThief(float Now)
{
    AQuebecCar* Car = ThiefCar;
    const TArray<bool>& Roads = SideJobRoadMask();
    if (!Roads.IsValidIndex(ThiefSegment))
    {
        ThiefSegment = SideJobNearestRoad(Car->GetActorLocation());
        bThiefForward = true;
        if (ThiefSegment == INDEX_NONE) { Car->SetAutopilot(0.f,0.f,true); return; }
    }
    const FVector Here = Car->GetActorLocation();
    FVector Start = LaFontaine::RoadSegments[ThiefSegment][bThiefForward ? 0 : 1];
    FVector End = LaFontaine::RoadSegments[ThiefSegment][bThiefForward ? 1 : 0];
    if (FVector::Dist2D(Here,End) < 900. || FVector::DotProduct(Here-End,(End-Start).GetSafeNormal2D()) > 0.)
    {
        ChooseThiefRoad(End);
        Start = LaFontaine::RoadSegments[ThiefSegment][bThiefForward ? 0 : 1];
        End = LaFontaine::RoadSegments[ThiefSegment][bThiefForward ? 1 : 0];
    }
    const FVector Heading = (End-Start).GetSafeNormal2D();
    const double Length = FVector::Dist2D(Start,End);
    const double Along = FMath::Clamp(FVector::DotProduct(Here-Start,Heading)+700.+.35*FMath::Abs(Car->Speed),0.,Length);
    const FVector Aim = Start+Heading*Along+SideJobRight(Heading)*(LaFontaine::RoadSegmentWidths[ThiefSegment]*.25f);
    const FVector Local = Car->GetActorTransform().InverseTransformVectorNoScale(Aim-Here);
    const float Turn = static_cast<float>(FMath::RadiansToDegrees(FMath::Atan2(Local.Y,Local.X)));
    float Nearest = 0.f;
    NearestPlayerPawn(Here,&Nearest);
    const float Cruise = QuebecJobRules::ThiefTargetSpeed(Nearest,Turn);
    const float Steer = FMath::Clamp(Turn/28.f,-1.f,1.f);
    if (Now < ThiefReverseUntil) { Car->SetAutopilot(-1.f,-Steer,false); return; }
    const float Pedal = FMath::Clamp((Cruise-Car->Speed)/300.f,-1.f,1.f);
    // Pinned against a wall or a car for 1.5 s: back out for 1.2 s with the wheel reversed.
    if (FMath::Abs(Car->Speed) < 120.f && Pedal > .3f)
    {
        if (ThiefSlowSince < 0.f) ThiefSlowSince = Now;
        else if (Now-ThiefSlowSince > 1.5f) { ThiefReverseUntil = Now+1.2f; ThiefSlowSince = -1.f; }
    }
    else ThiefSlowSince = -1.f;
    Car->SetAutopilot(Pedal,Steer,false);
}

void AQuebecSideJobs::ChooseThiefRoad(const FVector& Junction)
{
    const TArray<TArray<int32>>& Links = SideJobRoadLinks();
    const TArray<bool>& Roads = SideJobRoadMask();
    const int32 EndSide = bThiefForward ? 1 : 0;
    const FVector Heading = (LaFontaine::RoadSegments[ThiefSegment][EndSide]-LaFontaine::RoadSegments[ThiefSegment][1-EndSide]).GetSafeNormal2D();
    TArray<int32> Options;
    TArray<bool> Forwards;
    TArray<double> FarEnds, Turns, Jitters;
    for (int32 Next : Links[ThiefSegment*2+EndSide])
    {
        if (!Roads[Next] || Next == ThiefSegment) continue;
        const bool bForward = FVector::DistSquared2D(Junction,LaFontaine::RoadSegments[Next][0]) <= FMath::Square(40.f);
        const FVector FarEnd = LaFontaine::RoadSegments[Next][bForward ? 1 : 0];
        float Distance = 0.f;
        NearestPlayerPawn(FarEnd,&Distance);
        Options.Add(Next);
        Forwards.Add(bForward);
        FarEnds.Add(Distance);
        Turns.Add(FVector::DotProduct(Heading,(FarEnd-Junction).GetSafeNormal2D()));
        Jitters.Add(FMath::FRand());
    }
    const int32 Pick = QuebecJobRules::ChooseFlee(FarEnds.GetData(),Turns.GetData(),Jitters.GetData(),Options.Num());
    if (Options.IsValidIndex(Pick)) { ThiefSegment = Options[Pick]; bThiefForward = Forwards[Pick]; }
    else if (Options.Num() > 0) { ThiefSegment = Options[0]; bThiefForward = Forwards[0]; }
    else bThiefForward = !bThiefForward;
}

void AQuebecSideJobs::TickGoons(float Now)
{
    int32 Down = 0, Standing = 0;
    for (const TObjectPtr<AActor>& Entry : Goons)
    {
        const AQuebecOfficer* Goon = Cast<AQuebecOfficer>(Entry.Get());
        if (!IsValid(Goon) || Goon->IsDown()) ++Down; else ++Standing;
    }
    if (Goons.Num() == 0) { FinishJob(false,TEXT("Les sbires ne sont pas venus")); return; }
    JobProgress = QuebecJobRules::WaveProgress(JobStep,Down);
    const FVector Arena = SideJobVector(QuebecJobRules::GoonArena);
    if (const AQuebecController* Starter = FindStarter(); Starter && Starter->GetPawn())
    {
        if (FVector::Dist2D(Starter->GetPawn()->GetActorLocation(),Arena) > QuebecJobRules::GoonArenaRadius)
        {
            if (OutsideSince < 0.f)
            {
                OutsideSince = Now;
                Say(TEXT("REVIENS!"),TEXT("Le théâtre a besoin de toi : 10 s"),2.5f);
            }
            else if (Now-OutsideSince > QuebecJobRules::GoonArenaGraceSeconds) { FinishJob(false,TEXT("Tu as quitté le théâtre")); return; }
        }
        else OutsideSince = -1.f;
    }
    if (Now >= NextTargetRefresh)
    {
        // Players enter and leave cars, so each goon re-reads the nearest player's current pawn every second.
        NextTargetRefresh = Now+1.f;
        for (const TObjectPtr<AActor>& Entry : Goons)
            if (AQuebecOfficer* Goon = Cast<AQuebecOfficer>(Entry.Get()); IsValid(Goon) && !Goon->IsDown())
                if (APawn* Target = NearestPlayerPawn(Goon->GetActorLocation())) Goon->SetTargetPlayer(Target);
    }
    if (Standing > 0) return;
    if (JobStep+1 >= QuebecJobRules::WaveCount) { FinishJob(true,TEXT("Le Théâtre de Verdure est sauvé")); return; }
    if (NextWaveAt < 0.f)
    {
        NextWaveAt = Now+2.5f;
        Say(FString::Printf(TEXT("VAGUE %d/3"),JobStep+2),TEXT("D'autres sbires arrivent!"),2.5f);
        return;
    }
    if (Now < NextWaveAt) return;
    NextWaveAt = -1.f;
    for (const TObjectPtr<AActor>& Entry : Goons)
        if (IsValid(Entry)) Entry->Destroy();
    Goons.Reset();
    ++JobStep;
    SpawnWave(JobStep);
    SetObjective(FString::Printf(TEXT("Vague %d/3 : mets les sbires K.-O."),JobStep+1),TargetLocation,true);
    ForceNetUpdate();
}

void AQuebecSideJobs::TickEscape(float Now)
{
    AQuebecController* Starter = FindStarter();
    if (!Starter) return;
    const int32 Stars = QuebecCrime::Stars(Starter);
    if (Stars > 0) bSawStars = true;
    // The police garage clears stars only for a car that no unit sees, so the job wins when the stars clear.
    const APawn* Body = Starter->GetPawn();
    const bool bCarAtGarage = Cast<AQuebecCar>(Body) && FVector::Dist2D(Body->GetActorLocation(),TargetLocation) <= QuebecJobRules::GarageRadius;
    if (!QuebecJobRules::EscapeWon(bSawStars,Stars,bCarAtGarage,Now-StartedAt)) return;
    FinishJob(true,bCarAtGarage ? TEXT("Planqué au garage") : TEXT("Police semée"));
}

void AQuebecSideJobs::OnRep_Job()
{
    UpdatePresentation();
}

void AQuebecSideJobs::UpdatePresentation()
{
    if (!bBuilt || !GetWorld()) return;
    const bool bRunning = IsActive();
    const float Clock = static_cast<float>(GetWorld()->GetTimeSeconds());
    for (int32 Index = 0; Index < MarkerPoints.Num(); ++Index)
    {
        const bool bShow = !bRunning;
        if (MarkerParts.IsValidIndex(Index*2)) MarkerParts[Index*2]->SetVisibility(bShow);
        if (MarkerParts.IsValidIndex(Index*2+1))
        {
            MarkerParts[Index*2+1]->SetVisibility(bShow);
            MarkerParts[Index*2+1]->SetRelativeLocation(MarkerPoints[Index]+FVector(0.,0.,70.+25.*FMath::Sin(Clock*2.2f+Index)));
        }
        if (MarkerLetters.IsValidIndex(Index))
        {
            MarkerLetters[Index]->SetVisibility(bShow);
            MarkerLetters[Index]->SetRelativeLocation(MarkerPoints[Index]+FVector(0.,0.,250.+12.*FMath::Sin(Clock*2.6f+Index)));
        }
        if (MarkerTitles.IsValidIndex(Index)) MarkerTitles[Index]->SetVisibility(bShow);
    }
    // The goal stands on fixed places; the thief's car has its own caption instead.
    const bool bGoal = bRunning && bHasTarget && JobIndex != SideJobThief;
    GoalDisc->SetVisibility(bGoal);
    GoalColumn->SetVisibility(bGoal);
    GoalCaption->SetVisibility(bGoal);
    GoalBag->SetVisibility(bGoal && JobIndex == SideJobDelivery && JobStep == 0);
    if (bGoal)
    {
        GoalDisc->SetRelativeLocation(TargetLocation+FVector(0.,0.,4.));
        GoalColumn->SetRelativeLocation(TargetLocation+FVector(0.,0.,450.));
        GoalBag->SetRelativeLocation(TargetLocation+FVector(0.,0.,22.+6.*FMath::Sin(Clock*3.f)));
        GoalCaption->SetRelativeLocation(TargetLocation+FVector(0.,0.,330.));
        const FString Label = JobIndex == SideJobDelivery ? (JobStep == 0 ? FString(TEXT("CAFE / COMMANDE")) : FString::Printf(TEXT("PORTE %d/3"),JobStep)) :
            JobIndex == SideJobGoons ? FString(TEXT("THEATRE")) : FString(TEXT("GARAGE"));
        // SetText rebuilds the caption's glyphs, so it runs only when the label changes.
        if (!Label.Equals(GoalLabel,ESearchCase::CaseSensitive)) { GoalLabel = Label; GoalCaption->SetText(FText::FromString(Label)); }
    }
    // Every sign faces the local camera, as the campaign's do.
    if (APlayerController* Local = GetWorld()->GetFirstPlayerController())
    {
        FVector Eye;
        FRotator View;
        Local->GetPlayerViewPoint(Eye,View);
        TArray<UTextRenderComponent*> Captions;
        GetComponents<UTextRenderComponent>(Captions);
        for (UTextRenderComponent* Caption : Captions)
            if (Caption->IsVisible()) Caption->SetWorldRotation((Eye-Caption->GetComponentLocation()).Rotation());
    }
}

void AQuebecSideJobs::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AQuebecSideJobs,JobIndex);
    DOREPLIFETIME(AQuebecSideJobs,JobState);
    DOREPLIFETIME(AQuebecSideJobs,JobStep);
    DOREPLIFETIME(AQuebecSideJobs,StartedAt);
    DOREPLIFETIME(AQuebecSideJobs,DeadlineTime);
    DOREPLIFETIME(AQuebecSideJobs,ObjectiveText);
    DOREPLIFETIME(AQuebecSideJobs,TargetLocation);
    DOREPLIFETIME(AQuebecSideJobs,bHasTarget);
    DOREPLIFETIME(AQuebecSideJobs,JobProgress);
    DOREPLIFETIME(AQuebecSideJobs,StarterState);
    DOREPLIFETIME(AQuebecSideJobs,TargetActor);
    DOREPLIFETIME(AQuebecSideJobs,ResultSerial);
    DOREPLIFETIME(AQuebecSideJobs,LastJob);
    DOREPLIFETIME(AQuebecSideJobs,bLastSucceeded);
    DOREPLIFETIME(AQuebecSideJobs,LastReward);
    DOREPLIFETIME(AQuebecSideJobs,LastResult);
    DOREPLIFETIME(AQuebecSideJobs,CompletedMask);
    DOREPLIFETIME(AQuebecSideJobs,RetryUntil);
}

namespace QuebecJobs
{
    bool HandleRecover(AQuebecController* Player)
    {
        // R never moves a player who is down or held for arrest, with or without side jobs: the campaign checkpoint
        // teleport is skipped too. A standing, unwanted player's R goes to the campaign when no job claims it.
        if (Player && Player->HasAuthority() && AQuebecSideJobs::IsHeldByPolice(Player)) return true;
        AQuebecSideJobs* Jobs = Player ? AQuebecSideJobs::Find(Player->GetWorld()) : nullptr;
        return Jobs && Jobs->RequestRetry(Player);
    }

    bool IsJobActive(const UWorld* World)
    {
        const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(World);
        return Jobs && Jobs->IsActive();
    }
}
