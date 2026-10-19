// Standalone test for Source/Quebec/QuebecHeatModel.h and QuebecPursuitModel.h. Built and run by Scripts/test_heat_model.py.
// With QUEBEC_HEAT_STRICT the Unreal macro names are poisoned before the headers are read, so they cannot use them.

#ifdef QUEBEC_HEAT_STRICT
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <limits>
#include <utility>
#include <vector>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG
#endif
#include "../Source/Quebec/QuebecHeatModel.h"
#include "../Source/Quebec/QuebecPursuitModel.h"

#include <cstdarg>
#include <cstdio>
#include <vector>

using namespace QuebecHeat;
using namespace QuebecPursuit;

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

    bool Near(double A, double B, double Tolerance)
    {
        return std::fabs(A - B) <= Tolerance;
    }

    void TestThresholds()
    {
        const float Expected[] = {30.f, 25.f, 12.f, 6.f, 15.f, 40.f, 60.f, 120.f};
        for (int Index = 0; Index < CrimeCount; ++Index)
            Expect(CrimeHeat(static_cast<ECrime>(Index)) == Expected[Index], "crime %d heat %.1f", Index, static_cast<double>(CrimeHeat(static_cast<ECrime>(Index))));
        Expect(StarsForHeat(0.f) == 0 && StarsForHeat(9.99f) == 0, "below 10 heat is no star");
        Expect(StarsForHeat(10.f) == 1 && StarsForHeat(44.9f) == 1, "10 heat is one star");
        Expect(StarsForHeat(45.f) == 2 && StarsForHeat(100.f) == 3 && StarsForHeat(180.f) == 4 && StarsForHeat(300.f) == 5, "thresholds 45/100/180/300");
        Expect(StarsForHeat(9999.f) == 5, "five stars at most");
        Expect(StarFloor(0) == 0.f && StarFloor(3) == 100.f && StarFloor(9) == 300.f, "star floors");
        Expect(SearchSeconds(1) == 25.f && SearchSeconds(3) == 45.f && SearchSeconds(5) == 65.f, "search 15 s + 10 s per star");
        Expect(AlwaysWitnessed(ECrime::AttackPolice) && AlwaysWitnessed(ECrime::RamPolice) && !AlwaysWitnessed(ECrime::HitPerson), "police know crimes against police");
        Expect(!CrimeReady(ECrime::Gunfire, 10.0, 12.9) && CrimeReady(ECrime::Gunfire, 10.0, 13.0), "gunfire counts once per 3 s");
        Expect(CrimeReady(ECrime::HitPerson, 10.0, 10.0), "every knocked person counts");
    }

    void TestCrimes()
    {
        FWanted Wanted;
        Expect(AddCrime(Wanted, ECrime::HitPerson, 0.0) == 1 && Wanted.Stars == 1, "a car hitting a person gives one star");
        Expect(AddCrime(Wanted, ECrime::HitPerson, 0.0) == 1 && Wanted.Stars == 2, "a second person gives two stars (60 heat)");
        FWanted Police;
        AddCrime(Police, ECrime::DownPolice, 0.0);
        Expect(Police.Stars == 3, "knocking out an officer gives three stars");
        FWanted Small;
        AddCrime(Small, ECrime::HitCar, 0.0);
        Expect(Small.Stars == 0 && Small.Heat == 6.f, "one scrape is no star");
        Tick(Small, 1.5, 1.5f, false);
        AddCrime(Small, ECrime::HitCar, 1.5);
        Expect(Small.Stars == 1, "two rams 1.5 s apart give a star (%.2f heat)", static_cast<double>(Small.Heat));
        FWanted Forgotten;
        AddCrime(Forgotten, ECrime::HitCar, 0.0);
        for (int Step = 0; Step < 70; ++Step) Tick(Forgotten, Step * .1, .1f, false);
        Expect(Forgotten.Heat == 0.f && Forgotten.Stars == 0, "small heat fades away");
        FWanted Capped;
        for (int Step = 0; Step < 10; ++Step) AddCrime(Capped, ECrime::DownPolice, 0.0);
        Expect(Capped.Heat == MaxHeat && Capped.Stars == 5, "heat is capped");
    }

    void TestSearch()
    {
        FWanted Wanted;
        SetStars(Wanted, 3);
        Expect(Wanted.Heat == 100.f && !Wanted.bSearching, "set stars puts heat on the floor");
        double Now = 0.0;
        // Seen for ten seconds: the stars hold and heat stays on the floor.
        for (int Step = 0; Step < 100; ++Step, Now += .1) Tick(Wanted, Now, .1f, true);
        Expect(Wanted.Stars == 3 && Wanted.Heat == 100.f && !Wanted.bSearching, "seen: stars hold and heat keeps its floor");
        // Unseen: a 45 s countdown starts.
        Tick(Wanted, Now, .1f, false);
        Expect(Wanted.bSearching && Near(Wanted.SearchEndsAt - Now, 45.0, 1e-9), "unseen at three stars searches 45 s");
        const double FirstEnd = Wanted.SearchEndsAt;
        int Dropped = 0;
        while (Now + .1 < FirstEnd - 1e-6) { Now += .1; Dropped += Tick(Wanted, Now, .1f, false); }
        Expect(Dropped == 0 && Wanted.Stars == 3, "no drop before the search ends");
        Now = FirstEnd;
        Expect(Tick(Wanted, Now, .1f, false) == -1 && Wanted.Stars == 2, "one star drops when the search ends");
        Expect(Wanted.bSearching && Near(Wanted.SearchEndsAt - Now, 35.0, 1e-9) && Wanted.Heat == 45.f, "a 35 s search starts at two stars");
        // Seen again: the countdown stops.
        Now += 5.0;
        Tick(Wanted, Now, .1f, true);
        Expect(!Wanted.bSearching && Wanted.Stars == 2, "being seen stops the search");
        // Lose them completely: 35 + 25 s.
        Tick(Wanted, Now, .1f, false);
        double Clock = Now;
        while (Wanted.Stars > 0 && Clock < Now + 200.0) { Clock += .1; Tick(Wanted, Clock, .1f, false); }
        Expect(Wanted.Stars == 0 && !Wanted.bSearching && Near(Clock - Now, 60.0, .25), "two stars clear after 60 s unseen (%.2f)", Clock - Now);
        // A witnessed crime during a search restarts the countdown.
        FWanted Running;
        SetStars(Running, 1);
        Tick(Running, 0.0, .1f, false);
        AddCrime(Running, ECrime::HitCar, 20.0);
        Expect(Running.bSearching && Near(Running.SearchEndsAt, 45.0, 1e-9), "a crime restarts the search");
    }

    void TestWitnesses()
    {
        const FVec Eye{0.0, 0.0, 160.0};
        const FVec Forward{1.0, 0.0, 0.0};
        const auto At = [](double Degrees, double Range)
        {
            const double Radians = Degrees * 3.14159265358979323846 / 180.0;
            return FVec{std::cos(Radians) * Range, std::sin(Radians) * Range, 160.0};
        };
        Expect(InView(EWatcher::OfficerOnFoot, Eye, Forward, At(54.0, 3900.0)), "foot officer sees 54 degrees at 39 m");
        Expect(!InView(EWatcher::OfficerOnFoot, Eye, Forward, At(56.0, 3900.0)), "foot officer misses 56 degrees");
        Expect(!InView(EWatcher::OfficerOnFoot, Eye, Forward, At(0.0, 4100.0)), "foot officer misses 41 m");
        Expect(InView(EWatcher::PoliceCar, Eye, Forward, At(34.0, 6900.0)), "police car sees 34 degrees at 69 m");
        Expect(!InView(EWatcher::PoliceCar, Eye, Forward, At(36.0, 3000.0)), "police car misses 36 degrees");
        Expect(!InView(EWatcher::PoliceCar, Eye, Forward, At(0.0, 7100.0)), "police car misses 71 m");
        Expect(InView(EWatcher::PoliceCar, Eye, Forward, At(180.0, 700.0)), "anything within 8 m is noticed");
        Expect(!CiviliansWitness(1) && CiviliansWitness(2), "two civilians are witnesses");
    }

    void TestArrestAndCaps()
    {
        FArrest Arrest;
        bool bArrested = false;
        int Steps = 0;
        while (!bArrested && Steps < 100) { bArrested = TickArrest(Arrest, true, 80.f, .1f); ++Steps; }
        Expect(bArrested && Steps == 20, "arrest after 2 s within reach (%d steps)", Steps);
        Expect(!TickArrest(Arrest, true, 80.f, .1f), "the arrest fires once");
        FArrest Broken;
        for (int Step = 0; Step < 15; ++Step) TickArrest(Broken, true, 80.f, .1f);
        TickArrest(Broken, true, 300.f, .1f);
        Expect(Broken.Held == 0.f, "running away resets the hold");
        for (int Step = 0; Step < 19; ++Step) TickArrest(Broken, true, 80.f, .1f);
        Expect(!TickArrest(Broken, false, 0.f, .1f) && Broken.Held == 0.f, "no officer in reach resets the hold");
        const int Cars[] = {0, 1, 2, 3, 4, 4};
        const int Officers[] = {0, 1, 2, 3, 4, 4};
        for (int Stars = 0; Stars <= MaxStars; ++Stars)
            Expect(MaxPoliceCars(Stars) == Cars[Stars] && MaxOfficers(Stars) == Officers[Stars], "caps at %d stars", Stars);
        Expect(MaxPoliceCars(9) == 4 && MaxPoliceCars(-1) == 0, "caps clamp");
        Expect(!OfficersShoot(2) && OfficersShoot(3), "officers shoot from three stars");
        Expect(ShotHitChance(300.0, 0.f, false) > ShotHitChance(2500.0, 0.f, false), "close shots hit more often");
        Expect(ShotHitChance(1000.0, 600.f, true) < ShotHitChance(1000.0, 0.f, false), "a moving driver is harder to hit");
    }

    std::vector<FSegment> Grid()
    {
        // A 3 x 3 block grid, 100 m spacing: horizontal then vertical segments.
        std::vector<FSegment> Segments;
        for (int Row = 0; Row < 3; ++Row)
            for (int Column = 0; Column < 2; ++Column)
                Segments.push_back({{Column * 10000.0, Row * 10000.0}, {(Column + 1) * 10000.0 + 15.0, Row * 10000.0 - 10.0}});
        for (int Column = 0; Column < 3; ++Column)
            for (int Row = 0; Row < 2; ++Row)
                Segments.push_back({{Column * 10000.0, Row * 10000.0}, {Column * 10000.0, (Row + 1) * 10000.0}});
        return Segments;
    }

    double PathLength(const FVec2& From, const std::vector<FVec2>& Path)
    {
        double Total = 0.0;
        FVec2 Previous = From;
        for (const FVec2& Point : Path) { Total += Distance(Previous, Point); Previous = Point; }
        return Total;
    }

    void TestPursuit()
    {
        const FVec2 Lead = PredictTarget({0.0, 0.0}, {0.0, 0.0}, {3000.0, 0.0}, {0.0, 1000.0});
        Expect(Near(Lead.X, 3000.0, 1e-6) && Near(Lead.Y, 1200.0, 1e-6), "a slow closing speed leads 1.2 s at most (%.1f)", Lead.Y);
        const FVec2 Short = PredictTarget({0.0, 0.0}, {2000.0, 0.0}, {1000.0, 0.0}, {0.0, 500.0});
        Expect(Near(Short.Y, 250.0, 1e-6), "a fast closing speed leads the time to close the gap");
        Expect(ChaseSpeed(20000.0, 0.0, true) > ChaseSpeed(5000.0, 0.0, true), "far units catch up");
        Expect(ChaseSpeed(1500.0, 2000.0, true) <= 2800.0 && ChaseSpeed(1500.0, 2000.0, true) >= 2000.0, "near units keep pace to ram");
        Expect(ChaseSpeed(900.0, 0.0, false) == 0.0 && ChaseSpeed(3000.0, 0.0, false) > 0.0, "units stop 10 m from a player on foot");
        Expect(CornerSpeed(0.0) > CornerSpeed(90.0) && Near(CornerSpeed(90.0), 800.0, 1e-9), "corner braking");

        FRoadGraph Graph;
        Graph.Build(Grid());
        Expect(Graph.SegmentCount() == 12 && Graph.NodeCount() == 9, "grid joins endpoints within 40 cm (%d nodes)", Graph.NodeCount());
        FVec2 Closest;
        Expect(Graph.Nearest({5000.0, 300.0}, Closest) == 0 && Near(Closest.Y, 0.0, 20.0), "nearest segment");
        std::vector<FVec2> Path;
        // From the bottom-left corner, heading east, to the top-right block.
        Expect(Graph.Route({500.0, 0.0}, {1.0, 0.0}, {20000.0, 19000.0}, Path), "route found");
        Expect(Near(PathLength({500.0, 0.0}, Path), 38500.0, 120.0), "route takes the shortest roads (%.0f cm)", PathLength({500.0, 0.0}, Path));
        Expect(!Path.empty() && Near(Path.back().X, 20000.0, 20.0) && Near(Path.back().Y, 19000.0, 1.0), "route ends at the road point nearest the goal");
        // Close the vertical road at x=20000 from y=0 to 10000: a car on the dead-end east road must turn back west.
        Graph.Route({15000.0, 0.0}, {1.0, 0.0}, {20000.0, 5000.0}, Path);
        Expect(Path.size() == 2 && Near(Path[0].X, 20000.0, 20.0), "the open road goes straight north");
        Graph.SetOpen(10, false);
        Graph.Route({15000.0, 0.0}, {1.0, 0.0}, {20000.0, 5000.0}, Path);
        bool bDetour = false;
        for (const FVec2& Point : Path) bDetour |= Near(Point.X, 10000.0, 20.0) && Near(Point.Y, 10000.0, 20.0);
        Expect(bDetour, "a closed road forces a detour");
        Graph.SetOpen(10, true);
        // Heading west, going on beats turning back when the routes are close.
        std::vector<FVec2> Ahead;
        Graph.Route({6000.0, 0.0}, {-1.0, 0.0}, {5000.0, 10000.0}, Ahead);
        Expect(!Ahead.empty() && Near(Ahead.front().X, 0.0, 20.0), "turning back costs extra (%.0f)", Ahead.empty() ? -1.0 : Ahead.front().X);
        Graph.Route({6000.0, 0.0}, {-1.0, 0.0}, {5000.0, 10000.0}, Ahead, 0.0);
        Expect(!Ahead.empty() && Near(Ahead.front().X, 10000.0, 20.0), "without the cost the car turns back");
        std::vector<FVec2> Same;
        Graph.Route({1000.0, 0.0}, {1.0, 0.0}, {8000.0, 400.0}, Same);
        Expect(Same.size() == 1 && Near(Same[0].X, 8000.0, 5.0), "same segment drives straight to the goal");
        FVec2 Wander;
        Expect(Graph.PointNear({10000.0, 10000.0}, 3000.0, 7u, Wander) && Distance(Wander, {10000.0, 10000.0}) <= 10000.0, "wander point on a nearby road");
        Expect(!Graph.PointNear({90000.0, 90000.0}, 3000.0, 7u, Wander), "no wander point far from roads");

        std::size_t Index = 0;
        const std::vector<FVec2> Line = {{1000.0, 0.0}, {1000.0, 1000.0}, {2000.0, 1000.0}};
        const FVec2 Look = Lookahead(Line, Index, {0.0, 0.0}, 1500.0, 200.0);
        Expect(Index == 0 && Near(Look.X, 1000.0, 1e-6) && Near(Look.Y, 500.0, 1e-6), "lookahead follows the polyline round the corner");
        const FVec2 Later = Lookahead(Line, Index, {990.0, 20.0}, 300.0, 200.0);
        Expect(Index == 1 && Later.Y > 20.0, "reached waypoints are passed");
        Expect(Near(TurnAhead(Line, 0, {0.0, 0.0}, {1.0, 0.0}, 5000.0), 90.0, 1e-6), "a right angle ahead");
        Expect(TurnAhead(Line, 0, {0.0, 0.0}, {1.0, 0.0}, 500.0) < 1.0, "corners beyond range are ignored");
    }
}

int main()
{
    TestThresholds();
    TestCrimes();
    TestSearch();
    TestWitnesses();
    TestArrestAndCaps();
    TestPursuit();
    if (Failures) { std::fprintf(stderr, "%d of %d checks failed\n", Failures, Assertions); return 1; }
    std::printf("heat and pursuit model: %d checks passed\n", Assertions);
    return 0;
}
