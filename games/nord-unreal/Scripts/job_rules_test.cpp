// Standalone test for Source/Quebec/QuebecJobRules.h. Built and run by Scripts/test_job_rules.py.
// With QUEBEC_JOBS_STRICT the Unreal macro names are poisoned before the header is read, so the
// header cannot use them. Pass --table to print every job point with its clearance from the QA anchors.

#ifdef QUEBEC_JOBS_STRICT
#include <cmath>
#include <cstdint>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecJobRules.h"

#include <cstdarg>
#include <cstdio>
#include <cstring>

using namespace QuebecJobRules;

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    struct FNamedSpot
    {
        const char* Name;
        FJobSpot Spot;
    };

    // Every point a job sends a player to, or spawns something at.
    const FNamedSpot JobPoints[] = {
        {"delivery marker", Markers[0]}, {"thief marker", Markers[1]}, {"goon marker", Markers[2]}, {"escape marker", Markers[3]},
        {"cafe", DeliveryCafe}, {"door 1", DeliveryDoors[0]}, {"door 2", DeliveryDoors[1]}, {"door 3", DeliveryDoors[2]},
        {"thief start", ThiefStart}, {"goon arena", GoonArena},
        {"goon spawn 1", GoonSpawns[0]}, {"goon spawn 2", GoonSpawns[1]}, {"goon spawn 3", GoonSpawns[2]},
        {"goon spawn 4", GoonSpawns[3]}, {"goon spawn 5", GoonSpawns[4]}, {"garage", EscapeGarage},
        {"poster marker", Markers[4]}, {"poster papineau", PosterBoards[0]},
        {"poster cartier", PosterBoards[1]}, {"poster dorion", PosterBoards[2]},
        {"fare marker", Markers[5]}, {"fare drop", FareDrop}
    };

    void PlacementTests()
    {
        // The playable Montréal bounds from LaFontaineExtensionMap.h.
        const double MinX = -43674.718, MaxX = 75373.303, MinY = -46754.4, MaxY = 69018.4;
        for (const FNamedSpot& Point : JobPoints)
        {
            Expect(Clearance(Point.Spot) >= MinClearance, "%s is %.0f cm from a QA anchor (needs %.0f)", Point.Name, Clearance(Point.Spot), MinClearance);
            Expect(Point.Spot.X > MinX + 1000. && Point.Spot.X < MaxX - 1000. && Point.Spot.Y > MinY + 1000. && Point.Spot.Y < MaxY - 1000.,
                "%s lies outside the playable bounds", Point.Name);
        }
        for (int A = 0; A < JobCount; ++A)
            for (int B = A + 1; B < JobCount; ++B)
                Expect(Distance2D(Markers[A], Markers[B]) > 10000., "markers %d and %d are closer than 100 m", A, B);
        // Each goon spawn sits inside the arena but not on top of the marker, so goons do not appear on the player.
        for (const FJobSpot& Spawn : GoonSpawns)
        {
            Expect(Distance2D(Spawn, GoonArena) < GoonArenaRadius * .6, "goon spawn outside the arena core");
            Expect(Distance2D(Spawn, Markers[2]) > 800., "goon spawn on the marker");
        }
        Expect(Distance2D(GoonArena, Markers[2]) < GoonArenaRadius, "goon marker outside its arena");
        // The thief starts close enough to see and far enough not to be rammed at once.
        const double ThiefGap = Distance2D(ThiefStart, Markers[1]);
        Expect(ThiefGap > 4000. && ThiefGap < 12000., "thief starts %.0f cm from the marker", ThiefGap);
        // The delivery route is a real drive: every leg is at least 50 m, the café is near the marker.
        Expect(Distance2D(DeliveryCafe, Markers[0]) < 4000., "cafe is not near the delivery marker");
        FJobSpot Previous = DeliveryCafe;
        double Route = 0.;
        for (const FJobSpot& Door : DeliveryDoors)
        {
            Expect(Distance2D(Previous, Door) > 5000., "delivery leg shorter than 50 m");
            Route += Distance2D(Previous, Door);
            Previous = Door;
        }
        // 13 m/s average by car leaves slack in the time limit with every door bonus.
        const double Allowed = static_cast<double>(TimeLimits[0] + DoorBonusSeconds * static_cast<float>(DoorCount - 1));
        Expect(Route / 1300. < Allowed, "delivery route %.0f m cannot be driven in %.0f s", Route / 100., Allowed);
        Expect(Distance2D(EscapeGarage, Markers[3]) > 15000., "garage is too close to the escape start");
        // The poster tour is a walk along rue Gauthier. The corners stay apart, the marker does not
        // paste one by itself, and a walk of the nearest-first route fits the clock with no bonus time.
        for (int Board = 0; Board < PosterCount; ++Board)
        {
            Expect(Distance2D(Markers[4], PosterBoards[Board]) > 800., "the poster marker pastes a corner");
            for (int Other = Board + 1; Other < PosterCount; ++Other)
                Expect(Distance2D(PosterBoards[Board], PosterBoards[Other]) > 4000., "two affiches share a corner");
        }
        Expect(NextPoster(Markers[4], 0) == 0, "the first affiche is not the Papineau corner");
        double Walk = 0.;
        FJobSpot At = Markers[4];
        int Mask = 0;
        while (!PostersDone(Mask))
        {
            const int Board = NextPoster(At, Mask);
            Expect(Board >= 0, "the tour runs out of corners");
            if (Board < 0) break;
            Walk += Distance2D(At, PosterBoards[Board]);
            At = PosterBoards[Board];
            Mask = PastePoster(Mask, Board);
        }
        Expect(PostersDone(Mask), "the nearest-first walk misses a corner");
        Expect(Walk / 450. < static_cast<double>(TimeLimits[4]), "the affiche walk does not fit two minutes");
        Expect(Rewards[2] == 300, "the goon reward moved");
        Expect(Rewards[4] == 350 && TimeLimits[4] == 120.f, "the affiche pay or clock drifted");
        // The fare is a drive from a south road to a west quay. The straight line fits the clock
        // at 13 m/s, and both ends stay farther from the usual guides than the jobs those guides name.
        const FJobSpot Spawn = {38793., -7522.8, 0.};
        const FJobSpot Terrace = {5550., 2460., 0.};
        const double FareLeg = Distance2D(Markers[5], FareDrop);
        Expect(FareLeg > 30000., "the fare is a hop, not a drive");
        Expect(FareLeg / 1300. < static_cast<double>(TimeLimits[5]), "the fare drive does not fit its clock");
        Expect(Distance2D(Spawn, Markers[5]) > Distance2D(Spawn, Markers[1]), "the fare is closer to the spawn than the thief");
        Expect(Distance2D(Terrace, Markers[5]) > Distance2D(Terrace, Markers[2]), "the fare is closer to the terrace than the goons");
        Expect(Rewards[5] == 450 && TimeLimits[5] == 100.f, "the fare pay or clock drifted");
        Expect(Distance2D(Markers[5], FareDrop) > WalkerArrivalRadius, "standing on the pickup also drops the passenger");
    }

    void TimerTests()
    {
        for (int Job = 0; Job < JobCount; ++Job)
        {
            Expect(TimeLimits[Job] >= 60.f && TimeLimits[Job] <= 180.f, "job %d time limit %.0f s", Job, static_cast<double>(TimeLimits[Job]));
            Expect(Rewards[Job] > 0 && Rewards[Job] <= 1000, "job %d reward", Job);
        }
        Expect(TimeLimits[3] == 180.f, "the escape lasts three minutes");
        Expect(Remaining(0., 50.) == 0.f, "untimed job has no remaining time");
        Expect(Remaining(100., 40.) == 60.f, "remaining time is the deadline minus server time");
        Expect(Remaining(100., 140.) == 0.f, "expired timer clamps at zero");
        // A client clock offset changes only the server-time reading, never the replicated deadline.
        const double Deadline = DeliveryDeadline(1000., 0);
        Expect(Remaining(Deadline, 1000. + 30.) == 45.f, "client 30 s into the job sees 45 s left");
        Expect(DeliveryDeadline(1000., 2) - DeliveryDeadline(1000., 0) == 40., "two doors add 40 s");
    }

    void ArrivalTests()
    {
        Expect(Arrived(299., false, 0.f), "walker inside the radius arrives");
        Expect(!Arrived(301., false, 0.f), "walker outside the radius does not arrive");
        Expect(Arrived(500., true, 700.f), "slow car in the lane arrives");
        Expect(!Arrived(500., true, 1200.f), "speeding car does not arrive");
        Expect(Arrived(500., true, -700.f), "reversing slowly counts");
        Expect(!Arrived(600., true, 0.f), "car outside the radius does not arrive");
    }

    void WaveTests()
    {
        Expect(GoonTotal() == 12, "three waves hold 3 + 4 + 5 goons");
        Expect(WaveProgress(0, 0) == 0.f, "no progress before the first knockout");
        Expect(WaveProgress(1, 0) == 3.f / 12.f, "first wave is a quarter");
        Expect(WaveProgress(2, 5) == 1.f, "last goon completes the job");
        float Last = -1.f;
        for (int Wave = 0; Wave < WaveCount; ++Wave)
            for (int Down = 0; Down <= WaveSizes[Wave]; ++Down)
            {
                const float Value = WaveProgress(Wave, Down);
                Expect(Value >= Last, "wave progress never goes back");
                Last = Value;
            }
        Expect(WaveSizes[0] <= GoonSpawnCount && WaveSizes[WaveCount - 1] <= GoonSpawnCount, "each wave fits the spawn points");
    }

    void ThiefTests()
    {
        const double Far[] = {9000., 12000., 15000.};
        const double Straight[] = {.2, 1., -.95};
        const double NoJitter[] = {0., 0., 0.};
        Expect(ChooseFlee(Far, Straight, NoJitter, 3) == 1, "thief takes the far straight road, never the U-turn");
        const double Back[] = {-.9, -.8, -.75};
        Expect(ChooseFlee(Far, Back, NoJitter, 3) == -1 || FleeScore(Far[0], Back[0], 0.) < 0., "a U-turn is never chosen when a road exists");
        const double Close[] = {20000., 2000.};
        const double Turn[] = {0., 1.};
        Expect(ChooseFlee(Close, Turn, NoJitter, 2) == 0, "turning away from the chaser beats a straight road toward it");
        Expect(ChooseFlee(Far, Straight, NoJitter, 0) == -1, "no option gives no road");
        Expect(ThiefTargetSpeed(2000., 0.f) > ThiefTargetSpeed(6000., 0.f), "a close chaser makes the thief flee faster");
        Expect(ThiefTargetSpeed(20000., 0.f) < ThiefTargetSpeed(6000., 0.f), "a distant chaser lets the thief slow down");
        Expect(ThiefTargetSpeed(6000., 90.f) == 700.f, "sharp corners are taken slowly");
        Expect(ThiefTargetSpeed(2000., 0.f) < 3000.f * .7f, "the thief stays slower than the player's top speed");
        Expect(RamDamage(300.f) == 0.f, "a scrape does no ram damage");
        Expect(RamDamage(900.f) == 28.f, "a 900 cm/s ram adds 28 damage");
        int Rams = 0;
        for (float Damage = 0.f; Damage < 100.f; Damage += RamDamage(800.f)) ++Rams;
        Expect(Rams >= 3 && Rams <= 5, "about four solid rams wreck the thief (%d)", Rams);
    }

    void EscapeTests()
    {
        Expect(!EscapeWon(true, 3, true, 20.f), "standing in the garage while the police still see the player does not win");
        Expect(EscapeWon(true, 0, true, 20.f), "the garage clearing the stars wins");
        Expect(!EscapeWon(false, 0, false, 30.f), "stars that never showed do not count as lost");
        Expect(!EscapeWon(true, 0, false, 1.f), "a zero reading right after the start does not count");
        Expect(EscapeWon(true, 0, false, 20.f), "losing the stars wins");
        Expect(!EscapeWon(true, 1, false, 60.f), "one star left is not an escape");
        Expect(EscapeWon(false, 0, true, 20.f), "without police, a car in the garage bay wins");
        Expect(!EscapeWon(false, 0, true, 1.f), "not in the first two seconds");
    }

    void FareTests()
    {
        const FFare Board = AdvanceFare(FareWait, 0., true, false, false, 0.f, 4.5);
        Expect(Board.Step == FareAboard && Board.OnFoot == 0., "boarding spends the grace in the same call");
        const FFare Waiting = AdvanceFare(FareWait, 0., false, true, true, 0.f, 1.);
        Expect(Waiting.Step == FareWait, "a car at the drop boards a passenger who was never picked up");
        const FFare Dropped = AdvanceFare(FareAboard, 3., false, true, true, 800.f, 1.);
        Expect(Dropped.Step == FareDone && Dropped.OnFoot == 0., "a slow car at the quay does not drop the passenger");
        const FFare Fast = AdvanceFare(FareAboard, 2., false, true, true, 801.f, 1.);
        Expect(Fast.Step == FareAboard && Fast.OnFoot == 0., "a fast car at the quay drops the passenger");
        const FFare Edge = AdvanceFare(FareAboard, 0., false, false, false, 0.f, 4.);
        Expect(Edge.Step == FareAboard && Edge.OnFoot == 4., "four seconds on foot already loses the passenger");
        const FFare Lost = AdvanceFare(FareAboard, 0., false, true, false, 0.f, 4.5);
        Expect(Lost.Step == FareLost, "stepping out at the quay still counts as a drop");
        const FFare Back = AdvanceFare(FareAboard, 3.5, false, false, true, 0.f, 1.);
        Expect(Back.Step == FareAboard && Back.OnFoot == 0., "getting back in the car leaves the grace where it was");
        const FFare StuckDone = AdvanceFare(FareDone, 0., false, false, false, 0.f, 9.);
        Expect(StuckDone.Step == FareDone, "a finished fare starts over");
        const FFare StuckLost = AdvanceFare(FareLost, 5., true, true, true, 0.f, 1.);
        Expect(StuckLost.Step == FareLost && StuckLost.OnFoot == 5., "a lost fare boards again");
        const FFare NoTick = AdvanceFare(FareAboard, 1., false, false, false, 0.f, -2.);
        Expect(NoTick.Step == FareAboard && NoTick.OnFoot == 1., "a backwards tick spends the grace");
        Expect(FareSecondsLeft(0.) == 4, "a fresh grace is not four seconds");
        Expect(FareSecondsLeft(0.5) == 4, "half a second on foot rounds the grace down");
        Expect(FareSecondsLeft(3.5) == 1, "three and a half seconds leaves no whole second");
        Expect(FareSecondsLeft(4.) == 0 && FareSecondsLeft(6.) == 0, "a spent grace still shows a second");
    }

    void GuideTests()
    {
        const FJobSpot Spawn = {38793., -7522.8, 0.};
        const FJobSpot Terrace = {5550., 2460., 0.};
        Expect(NearestOpenJob(Spawn, Markers, JobCount, 0) == 3, "from the spawn the nearest open job is the escape");
        Expect(NearestOpenJob(Terrace, Markers, JobCount, 0) == 2, "from the terrace the nearest open job is the goons");
        Expect(NearestOpenJob(Spawn, Markers, JobCount, 1 << 3) == 1, "a finished escape yields the thief, not a replay of the closer job");
        Expect(NearestOpenJob(Spawn, Markers, JobCount, (1 << JobCount) - 1) == 3, "when every job is done the nearest replay is the escape");
        Expect(NearestOpenJob(Spawn, Markers, 0, 0) == -1, "no markers means no guide");
        Expect(FreeRoamGuide(false, false, -1, Terrace, Markers, JobCount, 0) == -1, "the story card keeps the diamond during the campaign");
        Expect(FreeRoamGuide(false, true, 0, Terrace, Markers, JobCount, 0) == -1, "a side job during the story does not replace the story card");
        Expect(FreeRoamGuide(true, false, -1, Terrace, Markers, JobCount, 0) == 2, "after the story the card points at the nearest open job");
        Expect(FreeRoamGuide(true, true, 0, Spawn, Markers, JobCount, 0) == 0, "a running job stays on the card wherever the player is");
        Expect(FreeRoamGuide(true, true, 9, Spawn, Markers, JobCount, 0) == -1, "a running job with a bad index does not invent a marker");
        const int Same = PastePoster(PastePoster(0, 0), 0);
        Expect(Same == 1 && PosterBits(Same) == 1 && !PostersDone(Same), "pasting Papineau twice counts twice");
        Expect(PastePoster(0, -1) == 0 && PastePoster(0, 9) == 0, "a corner outside the tour changes the mask");
        const int Forward = PastePoster(PastePoster(PastePoster(0, 2), 0), 1);
        const int Backward = PastePoster(PastePoster(PastePoster(0, 1), 2), 0);
        Expect(Forward == Backward && PostersDone(Forward), "the order of the corners changes the result");
        Expect(NextPoster(PosterBoards[0], 1) == 1, "after Papineau the tour does not go on to Cartier");
        Expect(NextPoster(PosterBoards[2], 7) == -1, "a finished tour still names a corner");
        const FJobSpot Tied[] = {{0., 0., 0.}, {100., 0., 0.}};
        Expect(NearestOpenJob({50., 0., 0.}, Tied, 2, 0) == 0, "an equal distance keeps the earlier job");
    }

    void PrintTable()
    {
        for (const FNamedSpot& Point : JobPoints)
            std::printf("%-14s (%8.0f, %8.0f)  clearance %6.0f cm\n", Point.Name, Point.Spot.X, Point.Spot.Y, Clearance(Point.Spot));
    }
}

int main(int Count, char** Arguments)
{
    if (Count > 1 && std::strcmp(Arguments[1], "--table") == 0)
    {
        PrintTable();
        return 0;
    }
    PlacementTests();
    TimerTests();
    ArrivalTests();
    WaveTests();
    ThiefTests();
    EscapeTests();
    FareTests();
    GuideTests();
    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
