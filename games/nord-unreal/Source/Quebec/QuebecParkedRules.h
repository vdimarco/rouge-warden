#pragma once

// Engine-independent rules for the parked cars on the Plateau curbs (AQuebecParkedCars, QuebecParkedCars.cpp).
// No Unreal includes, so Scripts/test_plateau_parking.py builds and runs them with the system compiler.
// Units are AQuebecCar's: centimetres, cm/s, degrees. A slot is one row of LaFontaineParking.h.

namespace QuebecParkedRules
{
    // ---- The car each slot draws ------------------------------------------------------------------------------
    // AQuebecCar settles 0.5 cm over its wheel feet, 100 cm under the pivot (WheelSupport).
    inline constexpr float PivotHeight = 100.5f;
    // AQuebecCar::ApplyPaint's Car70 layout: body, cabin and roof at the pivot; tyres and rims at the wheel centres.
    inline constexpr float WheelX = 155.f;
    inline constexpr float TireY = 95.f;
    inline constexpr float RimY = 106.5f;
    inline constexpr float WheelZ = -64.f;
    inline constexpr float WheelRoll = 90.f;
    // One collision box per car, inside the 466 cm body and the 220 cm over the mirrors (half extents, centre z).
    inline constexpr float BoxHalfX = 230.f;
    inline constexpr float BoxHalfY = 100.f;
    inline constexpr float BoxHalfZ = 70.f;
    inline constexpr float BoxCentreZ = 6.f;
    inline constexpr int Paints = 4;   // AQuebecCar::PaintStyle 0..3
    inline constexpr int Bodies = 3;   // AQuebecCar::BodyProfile 0..2

    // ---- Instances ----------------------------------------------------------------------------------------------
    // One instanced component per map tile, part mesh and paint: 12 bodies and 12 roofs (they carry the paint), 3
    // cabins, the tyres and the rims, and one more for the hidden collision boxes. A promotion moves instances of its
    // own tile only, so it rebuilds the cluster trees and render state of a few components 190 m across, not of
    // components that span the district (the replica's layers use the same 190 m tiles).
    inline constexpr int BodyGroups = Bodies * Paints;
    inline constexpr int RoofGroups = Bodies * Paints;
    inline constexpr int CabinGroups = Bodies;
    inline constexpr int FirstRoofGroup = BodyGroups;
    inline constexpr int FirstCabinGroup = FirstRoofGroup + RoofGroups;
    inline constexpr int TireGroup = FirstCabinGroup + CabinGroups;
    inline constexpr int RimGroup = TireGroup + 1;
    inline constexpr int VisibleGroups = RimGroup + 1;
    inline constexpr int WheelsPerCar = 4;

    inline constexpr float TileSize = 19000.f;
    // The tile a space's pivot lies in, as one key: column and row offset by 512 (the district spans a few tiles).
    inline int TileIndex(float Coordinate)
    {
        const float Cells = Coordinate / TileSize;
        const int Index = static_cast<int>(Cells);
        return static_cast<float>(Index) > Cells ? Index - 1 : Index;
    }
    inline int TileKey(float X, float Y) { return (TileIndex(X) + 512) * 1024 + (TileIndex(Y) + 512); }

    inline int ClampStyle(int Value, int Count) { return Value < 0 ? 0 : (Value >= Count ? Count - 1 : Value); }
    inline int BodyGroup(int Body, int Paint) { return ClampStyle(Body, Bodies) * Paints + ClampStyle(Paint, Paints); }
    inline int RoofGroup(int Body, int Paint) { return FirstRoofGroup + BodyGroup(Body, Paint); }
    inline int CabinGroup(int Body) { return FirstCabinGroup + ClampStyle(Body, Bodies); }

    // Cull distances (cm). Bodies, cabins and roofs go at 90 m, tyres at 60 m and rims at 35 m: a far car keeps its
    // shape and loses the small parts first. test_plateau_parking.py counts the cars within each distance.
    inline constexpr int BodyCullStart = 8000;
    inline constexpr int BodyCullEnd = 9000;
    inline constexpr int TireCullEnd = 6000;
    inline constexpr int RimCullEnd = 3500;
    inline int CullEnd(int Group) { return Group == RimGroup ? RimCullEnd : Group == TireGroup ? TireCullEnd : BodyCullEnd; }
    inline int CullStart(int Group) { return CullEnd(Group) - (BodyCullEnd - BodyCullStart); }
    // Only the body, the cabin and the roof cast shadows; the tyres and rims sit in the body's shadow.
    inline bool CastsShadow(int Group) { return Group < TireGroup; }

    // ---- The hidden box ---------------------------------------------------------------------------------------
    // The boxes block cars and people but ignore the Visibility channel, as a real car's hull does: the floor probes
    // (getting out of a car, spawning an officer, moving a car or a person) must land on the road, never on a roof.
    // A shot finds a parked car on its own line instead: SegmentEntry, in the space's frame (pivot at the origin, X
    // along the car), gives the share of the segment from A to B where it enters the box, or a negative value.
    inline float SegmentEntry(float AX, float AY, float AZ, float BX, float BY, float BZ)
    {
        const float Low[3] = {-BoxHalfX, -BoxHalfY, BoxCentreZ - BoxHalfZ};
        const float High[3] = {BoxHalfX, BoxHalfY, BoxCentreZ + BoxHalfZ};
        const float Start[3] = {AX, AY, AZ};
        const float Step[3] = {BX - AX, BY - AY, BZ - AZ};
        float Enter = 0.f, Leave = 1.f;
        for (int Axis = 0; Axis < 3; ++Axis)
        {
            if (Step[Axis] > -1e-6f && Step[Axis] < 1e-6f)
            {
                if (Start[Axis] < Low[Axis] || Start[Axis] > High[Axis]) return -1.f;
                continue;
            }
            float Near = (Low[Axis] - Start[Axis]) / Step[Axis];
            float Far = (High[Axis] - Start[Axis]) / Step[Axis];
            if (Near > Far) { const float Swap = Near; Near = Far; Far = Swap; }
            if (Near > Enter) Enter = Near;
            if (Far < Leave) Leave = Far;
            if (Enter > Leave) return -1.f;
        }
        return Enter;
    }
    // A street prop (a cone, a barricade, a bin) whose home lies in a space's footprint, widened by its own strike
    // radius, takes the space: the props have no collision, so the overlap test cannot see them.
    inline bool PropInSpace(float LocalX, float LocalY, float Radius)
    {
        return LocalX >= -BoxHalfX - Radius && LocalX <= BoxHalfX + Radius && LocalY >= -BoxHalfY - Radius && LocalY <= BoxHalfY + Radius;
    }

    // ---- Turning a parked car into a real one -------------------------------------------------------------------
    inline constexpr float CarImpactSpeed = 300.f;    // closing speed of a deliberate bump, about 11 km/h
    inline constexpr float PawnImpactSpeed = 900.f;   // a person thrown into a car, never one walking into it
    inline constexpr float PawnMassShare = .06f;      // 85 kg against a 1,400 kg car
    inline constexpr float EnterRadius = 300.f;       // at its door; a real car answers from 450 cm
    inline bool StrongImpact(float ClosingSpeed, bool bCar)
    {
        return ClosingSpeed >= (bCar ? CarImpactSpeed : PawnImpactSpeed);
    }
    // E takes a parked car after the real cars, the missions, the jobs and the stands, and before a resident unless
    // the resident stands nearer (squared distances; a negative one means no resident).
    inline bool SlotBeatsResident(float SlotDistanceSquared, float ResidentDistanceSquared)
    {
        return SlotDistanceSquared <= EnterRadius * EnterRadius &&
            (ResidentDistanceSquared < 0.f || SlotDistanceSquared < ResidentDistanceSquared);
    }

    // ---- Keeping the actor count low --------------------------------------------------------------------------
    // At most this many promoted cars live at once; past it the oldest one nobody uses goes first.
    inline constexpr int LivePromotedCap = 24;
    // A promoted car and its slot return to the instance when no player is this near either (beyond the 90 m cull,
    // so no one sees the swap) and nobody drives it.
    inline constexpr float RecycleDistance = 10000.f;
    inline constexpr float RecycleSeconds = 5.f;
    inline bool MayRecycle(bool bOccupied, bool bControlled, bool bPolice, float NearestPlayerToCar, float NearestPlayerToSlot)
    {
        return !bOccupied && !bControlled && !bPolice && NearestPlayerToCar >= RecycleDistance && NearestPlayerToSlot >= RecycleDistance;
    }
    // An empty space fills again once no player is near it and nothing stands in it (the car was driven off or
    // removed above).
    inline bool MayRefill(float NearestPlayer, bool bSpaceBlocked)
    {
        return NearestPlayer >= RecycleDistance && !bSpaceBlocked;
    }
    // A client hides a promoted slot once the real car has arrived within this distance, or after the wait.
    inline constexpr float ArrivalReach = 150.f;
    inline constexpr float ArrivalWait = 1.f;
    inline bool HideNow(float NearestCarDistance, float Waited)
    {
        return (NearestCarDistance >= 0.f && NearestCarDistance <= ArrivalReach) || Waited >= ArrivalWait;
    }
}
