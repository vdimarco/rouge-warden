#pragma once

// Engine-independent side-job rules: places, timers, waves, rewards, arrival tests and the thief's escape choices.
// No Unreal includes, so Scripts/test_job_rules.py can build and run it with the system compiler.
// Positions are game-frame centimetres (X east, Y north), the frame of LaFontaineMap.h. Z is found by a ground
// trace at runtime, so every table Z is 0. Display text lives in QuebecSideJobs.cpp.

#include <cmath>
#include <cstdint>

namespace QuebecJobRules
{
    struct FJobSpot
    {
        double X = 0.;
        double Y = 0.;
        double Z = 0.;
    };

    enum class EJob : uint8_t { Delivery, Thief, Goons, Escape, Posters, Fare };
    inline constexpr int JobCount = 6;

    // Yellow 'M' markers, all on sidewalks or park paths. Sources: OSM centrelines in Data/LaFontaine/osm.xml.
    // Delivery: Rue Rachel Est sidewalk, 25 m from the Maison des cyclistes café. Thief: park-side Sherbrooke
    // sidewalk south of Avenue Papineau. Goons: the path west of the Théâtre de Verdure bleachers. Escape: east
    // Sherbrooke sidewalk at Avenue du Parc-La Fontaine / Rue Atateken.
    inline constexpr FJobSpot Markers[JobCount] = {
        {-22296., 25268., 0.}, {44747., 29578., 0.}, {-14333., 3740., 0.}, {34714., -38068., 0.},
        {18031., 49813., 0.}, {-1683., -36868., 0.}
    };
    // Base time limit in seconds. A delivery earns DoorBonusSeconds at each door. The poster tour and the fare do not.
    inline constexpr float TimeLimits[JobCount] = {75.f, 150.f, 150.f, 180.f, 120.f, 100.f};
    inline constexpr int Rewards[JobCount] = {250, 400, 300, 500, 350, 450};

    // Livraison chaude: pick up at the café, then three doors in order.
    inline constexpr FJobSpot DeliveryCafe = {-23677., 23184., 0.};
    inline constexpr int DoorCount = 3;
    inline constexpr FJobSpot DeliveryDoors[DoorCount] = {
        {-24679., 38588., 0.}, {-14869., 40205., 0.}, {-38833., 23478., 0.}
    };
    inline constexpr float DoorBonusSeconds = 20.f;

    // Voleur de char: the thief starts on Sherbrooke north of Papineau, heading away from the marker.
    inline constexpr FJobSpot ThiefStart = {47568., 37601., 0.};
    inline constexpr double ThiefLostDistance = 30000.;
    inline constexpr float ThiefLostSeconds = 10.f;

    // L'encre déborde: three waves of goons on the lawn west of the stage.
    inline constexpr FJobSpot GoonArena = {-13467., 5100., 0.};
    inline constexpr double GoonArenaRadius = 4500.;
    inline constexpr float GoonArenaGraceSeconds = 10.f;
    inline constexpr int GoonSpawnCount = 5;
    inline constexpr FJobSpot GoonSpawns[GoonSpawnCount] = {
        {-15200., 5600., 0.}, {-14200., 6900., 0.}, {-12600., 7000., 0.}, {-15400., 4200., 0.}, {-12300., 5900., 0.}
    };
    inline constexpr int WaveCount = 3;
    inline constexpr int WaveSizes[WaveCount] = {3, 4, 5};
    inline constexpr int PistolRounds = 36;

    // Cinq étoiles: three stars at the start; win by losing them or by pulling into the police garage, the bay that
    // QuebecPolice::GarageLocation() returns (midpoint of its street bay, 1.5 m to the right). Quebec.Jobs.MarkerClearance
    // checks that the two stay together.
    inline constexpr int EscapeStars = 3;
    inline constexpr FJobSpot EscapeGarage = {50591., -17400., 0.};
    inline constexpr double GarageRadius = 700.;

    // Trois affiches: three corners of rue Gauthier, any order. Papineau, then Cartier, then Dorion.
    // The spots sit one sidewalk off the crossing. The clock is the base limit and does not grow.
    inline constexpr int PosterCount = 3;
    inline constexpr FJobSpot PosterBoards[PosterCount] = {
        {18922., 51143., 0.}, {23957., 58660., 0.}, {27489., 63934., 0.}
    };

    // La course: the marker is the pickup, on a mapped road south of the park. The drop is a quay road
    // west of the terrace. The passenger boards at the pickup and stays only while someone is in a car.
    // Four seconds on foot after boarding, and they get out. The clock does not grow. A drop counts only
    // for a car that has slowed to CarArrivalSpeed.
    inline constexpr FJobSpot FareDrop = {-31212., 18782., 0.};
    inline constexpr int FareWait = 0;
    inline constexpr int FareAboard = 1;
    inline constexpr int FareDone = 2;
    inline constexpr int FareLost = 3;
    inline constexpr float FareGraceSeconds = 4.f;

    struct FFare
    {
        int Step = FareWait;
        double OnFoot = 0.;
    };

    inline constexpr double MarkerRadius = 250.;
    inline constexpr double WalkerArrivalRadius = 300.;
    inline constexpr double CarArrivalRadius = 550.;
    inline constexpr float CarArrivalSpeed = 800.f;
    inline constexpr float ResultBannerSeconds = 4.f;

    // Every job point stays this far from the QA anchors and respawn points below.
    inline constexpr double MinClearance = 1500.;
    // Campaign worklight, cable, clamps, car bay, light car, loan car, race gates 0-5 (6 is gate 0), ink trap;
    // the three legacy objectives; spawn, starter car and the smoke walk start; hospital and PDQ 38 respawns.
    inline constexpr FJobSpot KeepClear[] = {
        {5550., 2460., 0.}, {5550., 2820., 0.}, {5550., 3270., 0.}, {5700., 2200., 0.}, {5550., 3520., 0.},
        {5550., 1700., 0.}, {34995.7, -20370.4, 0.},
        {34491.4, -20805.2, 0.}, {32525.4, -23455.6, 0.}, {30379.6, -27163.8, 0.}, {31305.0, -26721.5, 0.},
        {34095.9, -26300.2, 0.}, {34317.7, -22596.0, 0.}, {34862.5, -22670.9, 0.},
        {10998.9, -2417.7, 0.}, {-8258.4, 4915.9, 0.}, {7558.8, 41024.8, 0.},
        {38793.0, -7522.8, 0.}, {37671.4, -7274.8, 0.}, {37887.3, -6298.4, 0.},
        {44072., 17544., 0.}, {-40878., 5405., 0.}
    };
    inline constexpr int KeepClearCount = static_cast<int>(sizeof(KeepClear) / sizeof(KeepClear[0]));

    inline double Distance2D(const FJobSpot& A, const FJobSpot& B)
    {
        return std::hypot(A.X - B.X, A.Y - B.Y);
    }

    // Distance from Point to the closest keep-clear point.
    inline double Clearance(const FJobSpot& Point)
    {
        double Best = 1e30;
        for (const FJobSpot& Anchor : KeepClear) Best = std::fmin(Best, Distance2D(Point, Anchor));
        return Best;
    }

    // Seconds left before Deadline (server time). 0 when untimed or expired.
    inline float Remaining(double Deadline, double Now)
    {
        if (Deadline <= 0.) return 0.f;
        return static_cast<float>(std::fmax(0., Deadline - Now));
    }

    // The deadline after DoorsDone deliveries.
    inline double DeliveryDeadline(double StartTime, int DoorsDone)
    {
        return StartTime + static_cast<double>(TimeLimits[0]) + static_cast<double>(DoorBonusSeconds) * DoorsDone;
    }

    // A walker reaches a point by standing near it; a car must also slow down.
    inline bool Arrived(double Distance, bool bInCar, float Speed)
    {
        return bInCar ? Distance <= CarArrivalRadius && std::fabs(Speed) <= CarArrivalSpeed : Distance <= WalkerArrivalRadius;
    }

    // One step of the fare. Boarding does not spend the grace: the next tick starts the four seconds.
    // A car at the drop that is still fast stays aboard. A walker at the drop does not count as the drop.
    // Done and Lost stay as they are. A negative tick is treated as zero.
    inline FFare AdvanceFare(int Step, double OnFoot, bool bAtPickup, bool bCarAtDrop, bool bDriving, float Speed, double Dt)
    {
        FFare Result;
        Result.Step = Step;
        Result.OnFoot = OnFoot;
        if (Step != FareWait && Step != FareAboard) return Result;
        if (Dt < 0.) Dt = 0.;
        if (Step == FareWait)
        {
            if (!bAtPickup) return Result;
            Result.Step = FareAboard;
            Result.OnFoot = 0.;
            return Result;
        }
        if (bDriving)
        {
            Result.OnFoot = 0.;
            if (bCarAtDrop && std::fabs(static_cast<double>(Speed)) <= static_cast<double>(CarArrivalSpeed)) Result.Step = FareDone;
            return Result;
        }
        Result.OnFoot += Dt;
        if (Result.OnFoot > static_cast<double>(FareGraceSeconds)) Result.Step = FareLost;
        return Result;
    }

    // Whole seconds still left in the grace, rounded up. 0 once the grace is spent.
    inline int FareSecondsLeft(double OnFoot)
    {
        const double Left = static_cast<double>(FareGraceSeconds) - OnFoot;
        if (Left <= 0.) return 0;
        return static_cast<int>(std::ceil(Left));
    }

    inline int PosterBits(int Mask)
    {
        int Count = 0;
        for (int Board = 0; Board < PosterCount; ++Board)
            if ((Mask & (1 << Board)) != 0) ++Count;
        return Count;
    }

    // Pasting a corner twice leaves the mask as it was. A corner outside the tour does nothing.
    inline int PastePoster(int Mask, int Board)
    {
        if (Board < 0 || Board >= PosterCount) return Mask;
        return Mask | (1 << Board);
    }

    inline bool PostersDone(int Mask)
    {
        return PosterBits(Mask) >= PosterCount;
    }

    // Nearest corner that is not yet pasted, or -1 when the tour is done.
    inline int NextPoster(const FJobSpot& From, int Mask)
    {
        int Best = -1;
        double BestDistance = 1e300;
        for (int Board = 0; Board < PosterCount; ++Board)
        {
            if ((Mask & (1 << Board)) != 0) continue;
            const double Distance = Distance2D(From, PosterBoards[Board]);
            if (Distance < BestDistance) { BestDistance = Distance; Best = Board; }
        }
        return Best;
    }

    inline int GoonTotal()
    {
        int Total = 0;
        for (int Size : WaveSizes) Total += Size;
        return Total;
    }

    // Goons knocked out across all waves, as a 0..1 share.
    inline float WaveProgress(int Wave, int DownInWave)
    {
        int Done = 0;
        for (int Index = 0; Index < Wave && Index < WaveCount; ++Index) Done += WaveSizes[Index];
        return static_cast<float>(Done + DownInWave) / static_cast<float>(GoonTotal());
    }

    // Score of one road the thief can take at a junction: far from the players, mostly straight, never back.
    // FarEndDistance is the distance from that road's far end to the nearest player; TurnDot is the dot product of
    // the current and the new road direction; Jitter (0..1) breaks ties so the route is not always the same.
    inline double FleeScore(double FarEndDistance, double TurnDot, double Jitter)
    {
        if (TurnDot < -.7) return -1e9;
        return FarEndDistance + 1500. * TurnDot + 900. * Jitter;
    }

    // Index of the best road among Count options, or -1 when there is none.
    inline int ChooseFlee(const double* FarEndDistances, const double* TurnDots, const double* Jitters, int Count)
    {
        int Best = -1;
        double BestScore = -1e30;
        for (int Index = 0; Index < Count; ++Index)
        {
            const double Score = FleeScore(FarEndDistances[Index], TurnDots[Index], Jitters[Index]);
            if (Score > BestScore) { BestScore = Score; Best = Index; }
        }
        return Best;
    }

    // Thief cruising speed (cm/s): flees from a close car, waits for a distant chaser and slows for corners.
    inline float ThiefTargetSpeed(double NearestPlayer, float TurnDegrees)
    {
        float Speed = NearestPlayer < 3000. ? 1900.f : NearestPlayer > 12000. ? 900.f : 1500.f;
        const float Corner = std::fmin(std::fabs(TurnDegrees) / 45.f, 1.f);
        Speed += (700.f - Speed) * Corner;
        return Speed;
    }

    // Extra body damage when a player's car rams the thief (velocity change in cm/s). 0 below the threshold.
    inline float RamDamage(float VelocityChange)
    {
        return VelocityChange < 450.f ? 0.f : 10.f + VelocityChange / 50.f;
    }

    // The escape is won when the stars the job set drop to zero: the police lost the player, or the garage cleared
    // them, which it does only for a car that no unit sees. Without a police dispatcher the stars never show, and a
    // car in the garage bay wins instead.
    inline bool EscapeWon(bool bSawStars, int Stars, bool bCarAtGarage, float Elapsed)
    {
        if (Elapsed < 2.f) return false;
        return bSawStars ? Stars <= 0 : bCarAtGarage;
    }

    // Index of the nearest unfinished job. A finished job is chosen only when every listed job is finished.
    // Equal distances keep the earlier index. -1 when Count is 0.
    inline int NearestOpenJob(const FJobSpot& From, const FJobSpot* Spots, int Count, int CompletedMask)
    {
        int Open = -1;
        int Any = -1;
        double OpenDistance = 1e300;
        double AnyDistance = 1e300;
        for (int Index = 0; Index < Count; ++Index)
        {
            const double Distance = Distance2D(From, Spots[Index]);
            if (Distance < AnyDistance) { AnyDistance = Distance; Any = Index; }
            if ((CompletedMask & (1 << Index)) == 0 && Distance < OpenDistance)
            {
                OpenDistance = Distance;
                Open = Index;
            }
        }
        return Open >= 0 ? Open : Any;
    }

    // Which side job the free-roam mission card should name. The story card keeps its diamond until the
    // campaign is complete. A running job wins; otherwise the nearest unfinished marker.
    inline int FreeRoamGuide(bool bCampaignComplete, bool bJobRunning, int RunningJob,
        const FJobSpot& From, const FJobSpot* Spots, int Count, int CompletedMask)
    {
        if (!bCampaignComplete) return -1;
        if (bJobRunning) return RunningJob >= 0 && RunningJob < JobCount ? RunningJob : -1;
        return NearestOpenJob(From, Spots, Count, CompletedMask);
    }
}
