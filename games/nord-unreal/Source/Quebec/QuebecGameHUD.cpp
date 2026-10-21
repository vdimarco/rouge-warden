#include "QuebecGameplay.h"
#include "QuebecCombat.h"
#include "QuebecJobRules.h"
#include "QuebecPlayerState.h"
#include "QuebecPolice.h"
#include "QuebecSideJobs.h"
#include "QuebecCart.h"
#include "QuebecBow.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerState.h"

// The street layer of the HUD: wanted stars, vitals, weapon, cash and the side-job column; the centre banners
// (K.-O., ARRÊTÉ!, MISSION RÉUSSIE / RATÉE, notices, star changes); the aim reticle; and radar blips for police,
// goons, side jobs, the casse-croûte and pickups. It reads only replicated state, so both players see the same thing under lag.

namespace
{
    float StreetServerNow(const UWorld* World)
    {
        if (!World) return 0.f;
        const AGameStateBase* Game = World->GetGameState();
        return static_cast<float>(Game ? Game->GetServerWorldTimeSeconds() : World->GetTimeSeconds());
    }

    // Greedy word wrap at Width pixels; the last kept line ends in "..." when the text is longer than MaxLines.
    TArray<FString> StreetWrap(const AHUD* HUD, UFont* Face, const FString& Words, float Width, float FontScale, int32 MaxLines)
    {
        TArray<FString> Tokens, Lines;
        Words.ParseIntoArrayWS(Tokens);
        FString Line;
        for (const FString& Token : Tokens)
        {
            const FString Longer = Line.IsEmpty() ? Token : Line + TEXT(" ") + Token;
            float LineWidth = 0.f, LineHeight = 0.f;
            HUD->GetTextSize(Longer, LineWidth, LineHeight, Face, FontScale);
            if (LineWidth > Width && !Line.IsEmpty()) { Lines.Add(Line); Line = Token; }
            else Line = Longer;
        }
        if (!Line.IsEmpty()) Lines.Add(Line);
        if (Lines.Num() > MaxLines)
        {
            Lines.SetNum(MaxLines);
            Lines.Last() += TEXT("...");
        }
        return Lines;
    }

    bool StreetIsGun(EQuebecWeapon Weapon)
    {
        return Weapon == EQuebecWeapon::Pistol || Weapon == EQuebecWeapon::SMG || Weapon == EQuebecWeapon::Shotgun;
    }
}

namespace QuebecNotice
{
    void Show(AController* Player, const FString& Title, const FString& Detail, float Seconds)
    {
        AQuebecController* Target = Cast<AQuebecController>(Player);
        if (!Target || (Title.IsEmpty() && Detail.IsEmpty())) return;
        const UWorld* World = Target->GetWorld();
        const float Now = World ? static_cast<float>(World->GetTimeSeconds()) : 0.f;
        // A system that reports the same thing every frame cannot flood the reliable channel.
        const FString Key = Title + TEXT("|") + Detail;
        if (Key == Target->LastNoticeKey && Now - Target->LastNoticeAt < 1.5f) return;
        Target->LastNoticeKey = Key;
        Target->LastNoticeAt = Now;
        Target->ClientGameNotice(Title, Detail, FMath::IsFinite(Seconds) ? FMath::Clamp(Seconds, .5f, 10.f) : 3.f);
    }
}

void AQuebecController::ClientGameNotice_Implementation(const FString& Title, const FString& Detail, float Seconds)
{
    const float Now = GetWorld() ? static_cast<float>(GetWorld()->GetTimeSeconds()) : 0.f;
    const float Hold = FMath::IsFinite(Seconds) ? FMath::Clamp(Seconds, .5f, 10.f) : 3.f;
    // Two quick events both read: a new notice waits until the fresh one has had a second on screen.
    if (Now < GameNoticeUntil && Now - GameNoticeStart < 1.f && Title != GameNoticeTitle)
    {
        PendingNoticeTitle = Title;
        PendingNoticeDetail = Detail;
        PendingNoticeSeconds = Hold;
        return;
    }
    GameNoticeTitle = Title;
    GameNoticeDetail = Detail;
    GameNoticeStart = Now;
    GameNoticeUntil = Now + Hold;
}

void AQuebecController::TickGameNotice()
{
    const float Now = GetWorld() ? static_cast<float>(GetWorld()->GetTimeSeconds()) : 0.f;
    if (PendingNoticeSeconds <= 0.f || (Now < GameNoticeUntil && Now - GameNoticeStart < 1.f)) return;
    GameNoticeTitle = PendingNoticeTitle;
    GameNoticeDetail = PendingNoticeDetail;
    GameNoticeStart = Now;
    GameNoticeUntil = Now + PendingNoticeSeconds;
    PendingNoticeTitle.Empty();
    PendingNoticeDetail.Empty();
    PendingNoticeSeconds = 0.f;
}

FString AQuebecHUD::StreetPrompt() const
{
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld());
    if (Jobs && PlayerOwner)
    {
        const FString Job = Jobs->GetPrompt(PlayerOwner->GetPawn());
        if (!Job.IsEmpty()) return Job;
    }
    if (const AQuebecCart* Cart = AQuebecCart::Find(GetWorld()); Cart && PlayerOwner)
    {
        const FString Stall = Cart->GetPrompt(PlayerOwner->GetPawn());
        if (!Stall.IsEmpty()) return Stall;
    }
    const AQuebecBow* Bow = AQuebecBow::Find(GetWorld());
    return Bow && PlayerOwner ? Bow->GetPrompt(PlayerOwner->GetPawn()) : FString();
}

float AQuebecHUD::StreetColumnWidth() const
{
    if (!PlayerOwner || !GetWorld()) return 0.f;
    const AQuebecPlayerState* Stats = PlayerOwner->GetPlayerState<AQuebecPlayerState>();
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(GetWorld());
    const float Now = static_cast<float>(GetWorld()->GetTimeSeconds());
    // A calm street keeps the calm HUD: the column appears with stars, a job, a wound, armour, a weapon or new cash.
    const bool bBusy = (Jobs && Jobs->IsActive()) || Now - CashChangedAt < 6.f ||
        (Stats && (Stats->Stars > 0 || Stats->bSearching || Stats->Health < AQuebecPlayerState::MaxHealth - .5f ||
            Stats->Armor > 0.f || Stats->Weapon != 0));
    return bBusy ? 158.f : 0.f;
}

void AQuebecHUD::DrawStreetHUD(float UIScale, bool bTall, bool bTouch, float RadarX, float RadarY, float RadarSize, float ViewTop)
{
    UWorld* World = GetWorld();
    if (!Canvas || !PlayerOwner || !PlayerOwner->GetPawn() || !World || !GEngine) return;
    UFont* Font = GEngine->GetMediumFont();
    UFont* Large = GEngine->GetLargeFont();
    if (!Font) return;
    if (!Large) Large = Font;
    const float S = UIScale;
    const FLinearColor Ink(.004f, .006f, .009f, .95f);
    const FLinearColor Muted(.78f, .81f, .82f, 1.f);
    const FLinearColor Accent(1.f, .75f, .22f, 1.f);
    const FLinearColor Panel(.012f, .018f, .022f, .58f);
    const FLinearColor Paper(.98f, .98f, .96f, 1.f);
    const FLinearColor Danger(.95f, .16f, .1f, 1.f);
    const FLinearColor Cop(.28f, .58f, 1.f, 1.f);
    const FLinearColor JobYellow(1.f, .86f, .08f, 1.f);
    const FLinearColor CashTone(.42f, .88f, .42f, 1.f);

    // Outlined text with an ink shadow, the same treatment as DrawHUD's captions.
    const auto Write = [this, S, Ink](const FString& Words, UFont* Face, const FLinearColor& Tone, float PosX, float PosY, float Size)
    {
        FCanvasTextItem Item(FVector2D(PosX, PosY), FText::FromString(Words), Face, Tone);
        Item.Scale = FVector2D(Size * S);
        Item.bOutlined = true;
        Item.OutlineColor = Ink.CopyWithNewOpacity(Tone.A);
        Item.EnableShadow(Ink.CopyWithNewOpacity(Tone.A), FVector2D(S, S));
        Canvas->DrawItem(Item);
    };
    const auto Measure = [this, S](const FString& Words, UFont* Face, float Size)
    {
        float TextWidth = 0.f, TextHeight = 0.f;
        GetTextSize(Words, TextWidth, TextHeight, Face, Size * S);
        return FVector2D(TextWidth, TextHeight);
    };
    // A five-point star filled with horizontal scanlines, so it needs no texture and stays crisp at phone sizes.
    const auto Star = [this, S](const FVector2D& Middle, float Outer, const FLinearColor& Fill, const FLinearColor& Edge, bool bFilled)
    {
        FVector2D Corners[10];
        for (int32 Corner = 0; Corner < 10; ++Corner)
        {
            const float Angle = -PI * .5f + Corner * PI / 5.f;
            Corners[Corner] = Middle + FVector2D(FMath::Cos(Angle), FMath::Sin(Angle)) * (Corner % 2 == 0 ? Outer : Outer * .46f);
        }
        if (bFilled)
        {
            const float Step = FMath::Max(1.f, Outer / 8.f);
            for (float Row = static_cast<float>(Middle.Y) - Outer; Row <= Middle.Y + Outer; Row += Step)
            {
                float Cuts[10];
                int32 CutCount = 0;
                for (int32 Corner = 0; Corner < 10; ++Corner)
                {
                    const FVector2D& A = Corners[Corner];
                    const FVector2D& B = Corners[(Corner + 1) % 10];
                    if ((A.Y <= Row) != (B.Y <= Row))
                        Cuts[CutCount++] = static_cast<float>(A.X + (Row - A.Y) / (B.Y - A.Y) * (B.X - A.X));
                }
                for (int32 I = 1; I < CutCount; ++I)
                    for (int32 J = I; J > 0 && Cuts[J - 1] > Cuts[J]; --J) Swap(Cuts[J - 1], Cuts[J]);
                for (int32 Cut = 0; Cut + 1 < CutCount; Cut += 2) DrawLine(Cuts[Cut], Row, Cuts[Cut + 1], Row, Fill, Step * 1.35f);
            }
        }
        for (int32 Corner = 0; Corner < 10; ++Corner)
        {
            const FVector2D& A = Corners[Corner];
            const FVector2D& B = Corners[(Corner + 1) % 10];
            DrawLine(A.X, A.Y, B.X, B.Y, Edge, FMath::Max(1.f, 1.4f * S));
        }
    };
    // Quarter cuts are reference marks on the meter (Tufte, The Visual Display of
    // Quantitative Information, 1983). The lip runs only as far as the fill.
    const auto Bar = [this, S, Paper, Ink](float PosX, float PosY, float BarWidth, float BarHeight, float Share, const FLinearColor& Tone, const FLinearColor& Back)
    {
        DrawRect(Back, PosX, PosY, BarWidth, BarHeight);
        const float Fill = BarWidth * FMath::Clamp(Share, 0.f, 1.f);
        DrawRect(Tone, PosX, PosY, Fill, BarHeight);
        const float Lip = FMath::Min(FMath::Max(1.f, 2.f * S), BarHeight * .4f);
        if (Fill > Lip)
            DrawRect(Paper.CopyWithNewOpacity(.9f), PosX, PosY, Fill, Lip);
        const float Gap = FMath::Min(FMath::Max(2.f, 3.f * S), BarWidth * .08f);
        const FLinearColor Cut = Ink.CopyWithNewOpacity(.95f);
        for (int32 Notch = 1; Notch < 4; ++Notch)
        {
            const float At = PosX + BarWidth * (static_cast<float>(Notch) / 4.f) - Gap * .5f;
            const bool bCutFill = At < PosX + Fill;
            DrawRect(bCutFill ? Cut : Paper.CopyWithNewOpacity(.85f), At, PosY, Gap, BarHeight);
        }
    };
    // A centred comic plate: ink panel, coloured edges and an outlined title over a smaller detail line.
    const auto Plate = [&Write, &Measure, this, S, Font, Panel, Paper](const FString& Head, const FString& Line, const FLinearColor& Tone, float Middle, float Top, float Age, float Life)
    {
        const float Pop = FMath::Min(Age / .12f, 1.f);
        const float Fade = FMath::Clamp(FMath::Min(Age / .12f, (Life - Age) / .4f), 0.f, 1.f);
        const float HeadSize = 1.8f * (.82f + .18f * Pop);
        const FVector2D HeadBox = Measure(Head, Font, HeadSize);
        const FVector2D LineBox = Line.IsEmpty() ? FVector2D::ZeroVector : Measure(Line, Font, .9f);
        const float PlateWidth = static_cast<float>(FMath::Max(HeadBox.X, LineBox.X)) + 48.f * S;
        const float PlateHeight = static_cast<float>(HeadBox.Y + LineBox.Y) + 22.f * S;
        const float Left = Middle - PlateWidth * .5f;
        DrawRect(Panel.CopyWithNewOpacity(.72f * Fade), Left, Top, PlateWidth, PlateHeight);
        DrawRect(Tone.CopyWithNewOpacity(Fade), Left, Top, 4.f * S, PlateHeight);
        DrawRect(Tone.CopyWithNewOpacity(Fade), Left + PlateWidth - 4.f * S, Top, 4.f * S, PlateHeight);
        Write(Head, Font, Tone.CopyWithNewOpacity(Fade), Middle - static_cast<float>(HeadBox.X) * .5f, Top + 8.f * S, HeadSize);
        if (!Line.IsEmpty())
            Write(Line, Font, Paper.CopyWithNewOpacity(Fade), Middle - static_cast<float>(LineBox.X) * .5f, Top + 10.f * S + static_cast<float>(HeadBox.Y), .9f);
    };

    const APawn* Body = PlayerOwner->GetPawn();
    AQuebecController* Player = Cast<AQuebecController>(PlayerOwner);
    const AQuebecPlayerState* Stats = PlayerOwner->GetPlayerState<AQuebecPlayerState>();
    const AQuebecSideJobs* Jobs = AQuebecSideJobs::Find(World);
    const bool bJob = Jobs && Jobs->IsActive();
    const float Now = static_cast<float>(World->GetTimeSeconds());
    const float ServerNow = StreetServerNow(World);
    const float ScreenW = Canvas->SizeX, ScreenH = Canvas->SizeY;
    const float Margin = 22.f * S;
    const float Right = ScreenW - Margin;
    const FVector Here = Body->GetActorLocation();
    if (Player) Player->TickGameNotice();

    // Changes that drive the pops and banners. The first reading only records, so a late joiner sees no stale banner.
    const int32 Stars = Stats ? Stats->Stars : 0;
    if (Stars != LastStars) StarsChangedAt = Now;
    LastStars = Stars;
    const int32 Cash = Stats ? Stats->Cash : 0;
    if (LastCash >= 0 && Cash != LastCash) CashChangedAt = Now;
    LastCash = Cash;
    const float Health = Stats ? Stats->Health : AQuebecPlayerState::MaxHealth;
    if (Health < LastHealth - .5f) HurtAt = Now;
    LastHealth = Health;
    // A player who is down when a job ends sees its result once the K.-O. or ARRÊTÉ! overlay is over.
    const bool bDownNow = Stats && Stats->IsDown();
    if (Jobs)
    {
        if (LastJobSerial >= 0 && Jobs->ResultSerial != LastJobSerial)
        {
            if (bDownNow) bJobBannerWaiting = true;
            else JobBannerAt = Now;
        }
        LastJobSerial = Jobs->ResultSerial;
    }
    if (bJobBannerWaiting && !bDownNow)
    {
        bJobBannerWaiting = false;
        JobBannerAt = Now;
    }

    // A hit flashes the screen edges red for 0.3 s.
    const float HurtAge = Now - HurtAt;
    if (HurtAge >= 0.f && HurtAge < .3f)
    {
        const FLinearColor Flash = Danger.CopyWithNewOpacity(.38f * (1.f - HurtAge / .3f));
        const float Edge = 26.f * S;
        DrawRect(Flash, 0.f, 0.f, ScreenW, Edge);
        DrawRect(Flash, 0.f, ScreenH - Edge, ScreenW, Edge);
        DrawRect(Flash, 0.f, Edge, Edge, ScreenH - 2.f * Edge);
        DrawRect(Flash, ScreenW - Edge, Edge, Edge, ScreenH - 2.f * Edge);
    }

    // Radar blips use DrawHUD's MapPoint transform unchanged: 250 m radius, world +X to screen right, +Y to screen up.
    const FVector2D Centre(RadarX + RadarSize * .5f, RadarY + RadarSize * .5f);
    const float RadarRadius = RadarSize * .5f - 6.f * S;
    const auto RadarPoint = [Here, Centre, RadarRadius](const FVector& Where)
    {
        return Centre + FVector2D(Where.X - Here.X, Here.Y - Where.Y) * (RadarRadius / 25000.f);
    };
    const auto OnRadar = [Centre, RadarRadius, S](const FVector2D& Dot)
    {
        return FVector2D::DistSquared(Dot, Centre) <= FMath::Square(RadarRadius - 4.f * S);
    };
    const auto RadarEdge = [Centre, RadarRadius, S](const FVector2D& Dot)
    {
        return Centre + (Dot - Centre).GetClampedToMaxSize(RadarRadius - 8.f * S);
    };
    const bool bFlashRed = FMath::Fmod(Now * 4.f, 1.f) < .5f;
    // A calm radar stays as it was: pickups show within 60 m and job markers within 100 m only. Every QA fixture and
    // the race route are farther than that from both, so the accepted story and HUD captures do not change.
    constexpr double PickupBlipRange = 6000.;
    constexpr double MarkerBlipRange = 10000.;
    for (TActorIterator<AQuebecWeaponPickup> It(World); It; ++It)
    {
        if (!It->IsAvailable() || FVector::DistSquared2D(It->GetActorLocation(), Here) > FMath::Square(PickupBlipRange)) continue;
        const FVector2D Dot = RadarPoint(It->GetActorLocation());
        if (OnRadar(Dot)) DrawRect(Paper, Dot.X - 2.f * S, Dot.Y - 2.f * S, 4.f * S, 4.f * S);
    }
    for (TActorIterator<AQuebecCar> It(World); It; ++It)
    {
        if (!It->bPolice || *It == Body) continue;
        const FVector2D Dot = RadarPoint(It->GetActorLocation());
        if (!OnRadar(Dot)) continue;
        DrawRect(Ink, Dot.X - 4.f * S, Dot.Y - 4.f * S, 8.f * S, 8.f * S);
        DrawRect(bFlashRed ? Danger : Cop, Dot.X - 3.f * S, Dot.Y - 3.f * S, 6.f * S, 6.f * S);
    }
    for (TActorIterator<AQuebecOfficer> It(World); It; ++It)
    {
        if (It->IsDown()) continue;
        const FVector2D Dot = RadarPoint(It->GetActorLocation());
        if (!OnRadar(Dot)) continue;
        if (It->Faction == AQuebecOfficer::FactionGoon)
        {
            DrawRect(Paper, Dot.X - 3.f * S, Dot.Y - 3.f * S, 6.f * S, 6.f * S);
            DrawRect(Ink.CopyWithNewOpacity(1.f), Dot.X - 2.f * S, Dot.Y - 2.f * S, 4.f * S, 4.f * S);
        }
        else DrawRect(bFlashRed ? Cop : Danger, Dot.X - 2.f * S, Dot.Y - 2.f * S, 4.f * S, 4.f * S);
    }
    if (Jobs && !bJob)
    {
        // Job markers appear as a player comes near; only the running job's target sits on the rim when far.
        for (int32 Index = 0; Index < Jobs->NumMarkers(); ++Index)
        {
            if (FVector::DistSquared2D(Jobs->GetMarker(Index), Here) > FMath::Square(MarkerBlipRange)) continue;
            const FVector2D Dot = RadarPoint(Jobs->GetMarker(Index));
            const FLinearColor Tone = Jobs->IsCompleted(Index) ? JobYellow.CopyWithNewOpacity(.55f) : JobYellow;
            FCanvasNGonItem Rim(Dot, FVector2D(5.f * S), 12, Ink);
            Rim.BlendMode = SE_BLEND_Translucent;
            Canvas->DrawItem(Rim);
            FCanvasNGonItem Fill(Dot, FVector2D(3.5f * S), 12, Tone);
            Fill.BlendMode = SE_BLEND_Translucent;
            Canvas->DrawItem(Fill);
        }
    }
    // Chez Lise is a diamond, and only inside 80 m, so the race gates (about 94 m out) stay clear of it.
    if (const AQuebecCart* Cart = AQuebecCart::Find(World))
    {
        constexpr double StandBlipRange = 8000.;
        const FVector Spot = Cart->GetSpot();
        if (FVector::DistSquared2D(Spot, Here) <= FMath::Square(StandBlipRange))
        {
            const FVector2D Dot = RadarPoint(Spot);
            if (OnRadar(Dot))
            {
                FCanvasNGonItem Rim(Dot, FVector2D(5.f * S), 4, Ink);
                Rim.BlendMode = SE_BLEND_Translucent;
                Canvas->DrawItem(Rim);
                FCanvasNGonItem Fill(Dot, FVector2D(3.2f * S), 4, CashTone);
                Fill.BlendMode = SE_BLEND_Translucent;
                Canvas->DrawItem(Fill);
            }
        }
    }
    // The stage bow is a gold diamond, and only inside 80 m, once the goon fight is won.
    if (const AQuebecBow* Bow = AQuebecBow::Find(World); Bow && Bow->IsListed())
    {
        constexpr double BowBlipRange = 8000.;
        const FVector Spot = Bow->GetSpot();
        if (FVector::DistSquared2D(Spot, Here) <= FMath::Square(BowBlipRange))
        {
            const FVector2D Dot = RadarPoint(Spot);
            if (OnRadar(Dot))
            {
                FCanvasNGonItem Rim(Dot, FVector2D(5.f * S), 4, Ink);
                Rim.BlendMode = SE_BLEND_Translucent;
                Canvas->DrawItem(Rim);
                FCanvasNGonItem Fill(Dot, FVector2D(3.2f * S), 4, JobYellow);
                Fill.BlendMode = SE_BLEND_Translucent;
                Canvas->DrawItem(Fill);
            }
        }
    }
    FVector Goal = FVector::ZeroVector;
    const bool bGoal = bJob && Jobs->GetTarget(Goal);
    if (bGoal)
    {
        const FVector2D Dot = RadarEdge(RadarPoint(Goal));
        const float Pulse = 1.f + .35f * FMath::Abs(FMath::Sin(Now * 4.f));
        FCanvasNGonItem Rim(Dot, FVector2D(6.f * S * Pulse), 14, Ink);
        Rim.BlendMode = SE_BLEND_Translucent;
        Canvas->DrawItem(Rim);
        FCanvasNGonItem Fill(Dot, FVector2D(4.5f * S * Pulse), 14, JobYellow);
        Fill.BlendMode = SE_BLEND_Translucent;
        Canvas->DrawItem(Fill);
        // On screen: a yellow chevron over the goal with its distance, inside the same free view DrawHUD uses.
        FVector2D Mark;
        if (PlayerOwner->ProjectWorldLocationToScreen(Goal + FVector(0., 0., 260.), Mark) &&
            Mark.X > Margin + 20.f * S && Mark.X < Right - 20.f * S && Mark.Y > ViewTop && Mark.Y < (bTall ? ScreenH * .6f : ScreenH - 250.f * S))
        {
            const float Size = 11.f * S;
            for (int32 Pass = 0; Pass < 2; ++Pass)
            {
                const FLinearColor Tone = Pass == 0 ? Ink : JobYellow;
                const float Thick = (Pass == 0 ? 6.f : 3.f) * S;
                DrawLine(Mark.X - Size, Mark.Y - Size * .6f, Mark.X, Mark.Y + Size * .5f, Tone, Thick);
                DrawLine(Mark.X, Mark.Y + Size * .5f, Mark.X + Size, Mark.Y - Size * .6f, Tone, Thick);
            }
            const FString Distance = FString::Printf(TEXT("%dm"), FMath::RoundToInt(FVector::Dist(Here, Goal) / 100.f));
            Write(Distance, Font, Paper, Mark.X - static_cast<float>(Measure(Distance, Font, .85f).X) * .5f, Mark.Y + 12.f * S, .85f);
        }
    }

    // Aim reticle: four comic brackets turning over the locked target.
    if (Stats && IsValid(Stats->LockedTarget) && !Stats->IsDown())
    {
        FVector2D Aim;
        if (PlayerOwner->ProjectWorldLocationToScreen(QuebecPeople::AimPoint(Stats->LockedTarget), Aim))
        {
            const float Reach = 17.f * S * (1.f + .08f * FMath::Sin(Now * 9.f));
            const float Spin = Now * 1.6f;
            for (int32 Pass = 0; Pass < 2; ++Pass)
                for (int32 Arm = 0; Arm < 4; ++Arm)
                {
                    const float Angle = Spin + Arm * PI * .5f;
                    const FVector2D Out(FMath::Cos(Angle), FMath::Sin(Angle));
                    const FVector2D Across(-Out.Y, Out.X);
                    const FVector2D Tip = Aim + Out * Reach;
                    const FLinearColor Tone = Pass == 0 ? Ink : Danger;
                    const float Thick = (Pass == 0 ? 5.f : 2.5f) * S;
                    const FVector2D A = Tip + Across * (6.f * S) - Out * (5.f * S);
                    const FVector2D B = Tip - Across * (6.f * S) - Out * (5.f * S);
                    DrawLine(A.X, A.Y, Tip.X, Tip.Y, Tone, Thick);
                    DrawLine(Tip.X, Tip.Y, B.X, B.Y, Tone, Thick);
                }
            DrawRect(Danger, Aim.X - 1.5f * S, Aim.Y - 1.5f * S, 3.f * S, 3.f * S);
        }
    }

    // Status column: left of the radar in landscape; a strip that grows up from the touch controls when tall.
    if (StreetColumnWidth() > 0.f)
    {
        const float ColumnWidth = bTall ? RadarSize : 150.f * S;
        const float ColumnRight = bTall ? Right : RadarX - 8.f * S;
        const float ColumnLeft = ColumnRight - ColumnWidth;
        const bool bStarRow = Stars > 0 || (Stats && Stats->bSearching);
        const bool bWeaponRow = Stats && Stats->Weapon != 0;
        const bool bArmorRow = Stats && Stats->Armor > 0.f;
        const bool bCashRow = bJob || Now - CashChangedAt < 6.f;
        const float Remaining = bJob ? Jobs->GetRemainingSeconds() : 0.f;
        const TArray<FString> GoalLines = bJob ? StreetWrap(this, Font, Jobs->ObjectiveText, ColumnWidth, .78f * S, 3) : TArray<FString>();
        // Readability floor at phone scale: stars at least 12 px, bars at least 4 px.
        const float StarSlot = FMath::Max(22.f * S, 12.f);
        const float HealthHeight = FMath::Max(7.f * S, 4.f);
        const float ArmorHeight = FMath::Max(5.f * S, 3.f);
        float Total = HealthHeight + 5.f * S;
        if (bStarRow) Total += StarSlot + 5.f * S;
        if (bWeaponRow) Total += 22.f * S;
        if (bArmorRow) Total += ArmorHeight + 5.f * S;
        if (bJob) Total += (Remaining > 0.f ? 32.f * S : 0.f) + 18.f * S + GoalLines.Num() * 16.f * S + (bGoal ? 16.f * S : 0.f);
        if (bCashRow) Total += 20.f * S;
        float Row = bTall ? ScreenH * .6f - 6.f * S - Total : RadarY;
        const float PanelX = ColumnLeft - 6.f * S;
        const float PanelY = Row - 4.f * S;
        const float PanelW = ColumnWidth + 12.f * S;
        const float PanelH = Total + 8.f * S;
        DrawRect(Panel.CopyWithNewOpacity(.62f), PanelX, PanelY, PanelW, PanelH);
        // Scott McCloud, Understanding Comics (1993): the border is what separates
        // the panel from the scene. This column's padding is 4 scale units, so the
        // rule sits on the edge, where it stays off the type.
        const float RuleEdge = FMath::Min(FMath::Max(2.f, 2.f * S), 4.f * S);
        const FLinearColor Rule = Paper.CopyWithNewOpacity(.88f);
        DrawRect(Rule, PanelX, PanelY, PanelW, RuleEdge);
        DrawRect(Rule, PanelX, PanelY + PanelH - RuleEdge, PanelW, RuleEdge);
        DrawRect(Rule, PanelX, PanelY, RuleEdge, PanelH);
        DrawRect(Rule, PanelX + PanelW - RuleEdge, PanelY, RuleEdge, PanelH);
        DrawRect(Accent, PanelX, PanelY, RuleEdge, PanelH);
        if (bStarRow)
        {
            // Stars blink at 2 Hz while no officer sees the player; a change pops them for 0.4 s.
            const bool bDim = Stats && Stats->bSearching && FMath::Fmod(Now * 2.f, 1.f) >= .5f;
            const float Pop = 1.f + .45f * FMath::Max(0.f, 1.f - (Now - StarsChangedAt) / .4f);
            const float Outer = StarSlot * .5f;
            for (int32 Slot = 0; Slot < 5; ++Slot)
            {
                const FVector2D Middle(ColumnRight - (4 - Slot) * (StarSlot + 3.f * S) - Outer, Row + Outer);
                if (Slot < Stars && !bDim) Star(Middle, Outer * Pop, Accent, Ink, true);
                else Star(Middle, Outer, Accent, Slot < Stars ? Accent : Muted.CopyWithNewOpacity(.7f), false);
            }
            Row += StarSlot + 5.f * S;
        }
        if (bWeaponRow)
        {
            const EQuebecWeapon Held = Stats->CurrentWeapon();
            FString Label = QuebecCombat::WeaponName(Held);
            if (StreetIsGun(Held)) Label += FString::Printf(TEXT("  %d"), Stats->AmmoFor(Held));
            const bool bEmpty = StreetIsGun(Held) && Stats->AmmoFor(Held) <= 0;
            Write(Label, Font, bEmpty ? Danger : Paper, ColumnRight - static_cast<float>(Measure(Label, Font, .9f).X), Row, .9f);
            Row += 22.f * S;
        }
        const float HealthShare = Health / AQuebecPlayerState::MaxHealth;
        const FLinearColor HealthTone = HealthShare < .25f ? Danger.CopyWithNewOpacity(.55f + .45f * FMath::Abs(FMath::Sin(Now * 6.f)))
            : FLinearColor(.42f, .86f, .38f, 1.f);
        Bar(ColumnLeft, Row, ColumnWidth, HealthHeight, HealthShare, HealthTone, Ink.CopyWithNewOpacity(.62f));
        Row += HealthHeight + 5.f * S;
        if (bArmorRow)
        {
            Bar(ColumnLeft, Row, ColumnWidth, ArmorHeight, Stats->Armor / AQuebecPlayerState::MaxArmor, Cop, Ink.CopyWithNewOpacity(.62f));
            Row += ArmorHeight + 5.f * S;
        }
        if (bJob)
        {
            if (Remaining > 0.f)
            {
                const int32 Whole = FMath::CeilToInt(Remaining);
                const FString Clock = FString::Printf(TEXT("%d:%02d"), Whole / 60, Whole % 60);
                const bool bHurry = Remaining < 10.f;
                const float ClockSize = 1.5f * (bHurry ? 1.f + .1f * FMath::Abs(FMath::Sin(Now * 7.f)) : 1.f);
                Write(Clock, Font, bHurry ? Danger : Paper, ColumnRight - static_cast<float>(Measure(Clock, Font, ClockSize).X), Row, ClockSize);
                Row += 32.f * S;
            }
            const FString Name = AQuebecSideJobs::JobTitle(Jobs->JobIndex);
            Write(Name, Font, JobYellow, ColumnRight - static_cast<float>(Measure(Name, Font, .85f).X), Row, .85f);
            Row += 18.f * S;
            for (const FString& Line : GoalLines)
            {
                Write(Line, Font, Paper, ColumnRight - static_cast<float>(Measure(Line, Font, .78f).X), Row, .78f);
                Row += 16.f * S;
            }
            if (bGoal)
            {
                FString Info = FString::Printf(TEXT("%d m"), FMath::RoundToInt(FVector::Dist(Here, Goal) / 100.f));
                if (Jobs->JobIndex == static_cast<int32>(QuebecJobRules::EJob::Thief))
                    Info += FString::Printf(TEXT("  ·  dégâts %d %%"), FMath::RoundToInt(Jobs->JobProgress * 100.f));
                else if (Jobs->JobIndex == static_cast<int32>(QuebecJobRules::EJob::Goons))
                    Info += FString::Printf(TEXT("  ·  K.-O. %d/%d"), FMath::RoundToInt(Jobs->JobProgress * QuebecJobRules::GoonTotal()), QuebecJobRules::GoonTotal());
                if (!bTouch && !bTall) Info += TEXT("  ·  R");
                Write(Info, Font, Muted, ColumnRight - static_cast<float>(Measure(Info, Font, .78f).X), Row, .78f);
                Row += 16.f * S;
            }
        }
        if (bCashRow)
        {
            const FString Money = FString::Printf(TEXT("%d $"), Cash);
            const float MoneySize = .95f * (1.f + .25f * FMath::Max(0.f, 1.f - (Now - CashChangedAt) / .5f));
            Write(Money, Font, CashTone, ColumnRight - static_cast<float>(Measure(Money, Font, MoneySize).X), Row, MoneySize);
        }
    }

    // Centre banners, one at a time: down overlay, then job result, then notice, then a star change.
    const float BannerTop = bTall ? ViewTop + 30.f * S : ScreenH * .34f;
    const bool bDown = Stats && Stats->IsDown();
    const float JobAge = Now - JobBannerAt;
    const bool bJobBanner = !bDown && Jobs && JobAge >= 0.f && JobAge < QuebecJobRules::ResultBannerSeconds;
    const bool bNotice = !bDown && !bJobBanner && Player && Now < Player->GameNoticeUntil &&
        (!Player->GameNoticeTitle.IsEmpty() || !Player->GameNoticeDetail.IsEmpty());
    if (bJobBanner)
    {
        const FString Head = Jobs->bLastSucceeded ? TEXT("MISSION RÉUSSIE") : TEXT("MISSION RATÉE");
        FString Line = Jobs->bLastSucceeded ? FString::Printf(TEXT("+%d $  ·  %s"), Jobs->LastReward, *Jobs->LastResult) : Jobs->LastResult;
        // Touch has no R key on the pad. Recover lives in the Menu, under GAME, and sends the same key.
        if (!Jobs->bLastSucceeded && Jobs->RetryUntil > ServerNow)
            Line += bTouch ? TEXT("  ·  Menu · Recover") : TEXT("  ·  R réessaie");
        Plate(Head, Line, Jobs->bLastSucceeded ? Accent : Danger, ScreenW * .5f, BannerTop, JobAge, QuebecJobRules::ResultBannerSeconds);
    }
    else if (bNotice)
    {
        Plate(Player->GameNoticeTitle, Player->GameNoticeDetail, Accent, ScreenW * .5f, BannerTop, Now - Player->GameNoticeStart,
            Player->GameNoticeUntil - Player->GameNoticeStart);
    }
    else if (!bDown && Stars > 0 && Now - StarsChangedAt >= .6f && Now - StarsChangedAt < 2.4f &&
        (!Player || Player->GameNoticeStart < StarsChangedAt - .3f))
    {
        // The police announce most star changes with their own notice, and a respawn clears stars silently; this plate
        // covers a rise they leave silent, after a short wait so the two never show back to back.
        Plate(TEXT("RECHERCHÉ"), FString::Printf(TEXT("%d étoile%s"), Stars, Stars > 1 ? TEXT("s") : TEXT("")),
            Cop, ScreenW * .5f, BannerTop, Now - StarsChangedAt - .6f, 1.8f);
    }
    if (bDown)
    {
        // K.-O. or ARRÊTÉ!: dim the view, burst the word, and count down to the respawn from the replicated time.
        const bool bArrest = Stats->GetDownState() == EQuebecDownState::Arrested;
        const float Left = FMath::Max(0.f, Stats->DownUntil - ServerNow);
        const float Age = FMath::Max(0.f, 4.f - Left);
        const float Alpha = FMath::Clamp(Age / .5f, 0.f, 1.f);
        DrawRect(FLinearColor(0.f, 0.f, 0.f, .5f * Alpha), 0.f, 0.f, ScreenW, ScreenH);
        const FString Word = bArrest ? TEXT("ARRÊTÉ!") : TEXT("K.-O.");
        const FLinearColor Tone = bArrest ? Cop : Danger;
        const FVector2D Burst(ScreenW * .5f, ScreenH * (bTall ? .4f : .42f));
        const float Pop = FMath::Min(Age / .15f, 1.f);
        for (int32 Pass = 0; Pass < 2; ++Pass)
            for (int32 Spike = 0; Spike < 26; ++Spike)
            {
                const float Angle = Spike * PI * 2.f / 26.f + .15f;
                const float Length = ((Spike % 2 ? 70.f : 115.f) - Pass * 10.f) * S * Pop;
                DrawLine(Burst.X, Burst.Y, Burst.X + FMath::Cos(Angle) * Length, Burst.Y + FMath::Sin(Angle) * Length * .62f,
                    (Pass ? Tone : Ink).CopyWithNewOpacity(Alpha), (Pass ? 12.f : 18.f) * S);
            }
        const float WordSize = 3.f * S * (.8f + .2f * Pop);
        float WordWidth = 0.f, WordHeight = 0.f;
        GetTextSize(Word, WordWidth, WordHeight, Large, WordSize);
        const float WordX = static_cast<float>(Burst.X) - WordWidth * .5f, WordY = static_cast<float>(Burst.Y) - WordHeight * .5f;
        for (const FVector2D Offset : {FVector2D(-3, 0), FVector2D(3, 0), FVector2D(0, -3), FVector2D(0, 3), FVector2D(5, 5)})
            DrawText(Word, Ink.CopyWithNewOpacity(Alpha), WordX + Offset.X * S, WordY + Offset.Y * S, Large, WordSize);
        DrawText(Word, Paper.CopyWithNewOpacity(Alpha), WordX, WordY, Large, WordSize);
        FString Line = bArrest ? TEXT("Direction poste de quartier 38") : TEXT("Direction Hôpital Notre-Dame");
        if (Left > .05f) Line += FString::Printf(TEXT("  ·  %d"), FMath::CeilToInt(Left));
        Write(Line, Font, Paper.CopyWithNewOpacity(Alpha), ScreenW * .5f - static_cast<float>(Measure(Line, Font, 1.f).X) * .5f,
            static_cast<float>(Burst.Y) + 95.f * S, 1.f);
    }
}
