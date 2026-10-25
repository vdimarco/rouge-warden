// Standalone test for Source/Quebec/QuebecParkedRules.h and the generated LaFontaineParking.h. Built and run by
// Scripts/test_plateau_parking.py. With QUEBEC_PARKED_STRICT the Unreal macro names are poisoned before the headers
// are read, so the headers cannot use them.

#ifdef QUEBEC_PARKED_STRICT
#pragma GCC poison PI HALF_PI TWO_PI UE_PI check checkf verify ensure TEXT FORCEINLINE UE_LOG INDEX_NONE int32 uint8 float32
#endif
#include "../Source/Quebec/QuebecParkedRules.h"
#include "../Source/Quebec/LaFontaineParking.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <map>
#include <set>

using namespace QuebecParkedRules;

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

    void Groups()
    {
        std::set<int> Seen;
        for (int Body = 0; Body < Bodies; ++Body)
        {
            for (int Paint = 0; Paint < Paints; ++Paint)
            {
                Expect(BodyGroup(Body, Paint) >= 0 && BodyGroup(Body, Paint) < FirstRoofGroup, "body group %d %d in range", Body, Paint);
                Expect(RoofGroup(Body, Paint) >= FirstRoofGroup && RoofGroup(Body, Paint) < FirstCabinGroup, "roof group %d %d", Body, Paint);
                Seen.insert(BodyGroup(Body, Paint));
                Seen.insert(RoofGroup(Body, Paint));
            }
            Seen.insert(CabinGroup(Body));
        }
        Seen.insert(TireGroup);
        Seen.insert(RimGroup);
        Expect(int(Seen.size()) == VisibleGroups, "every group distinct: %d of %d", int(Seen.size()), VisibleGroups);
        Expect(VisibleGroups == 29, "29 visible components (12 bodies, 12 roofs, 3 cabins, tyres, rims): %d", VisibleGroups);
        Expect(BodyGroup(7, -2) == BodyGroup(2, 0), "a style out of range clamps");
    }

    void Culling()
    {
        Expect(CullEnd(BodyGroup(1, 2)) == 9000 && CullEnd(CabinGroup(0)) == 9000, "bodies and cabins cull at 90 m");
        Expect(CullEnd(TireGroup) == 6000 && CullEnd(RimGroup) == 3500, "tyres at 60 m, rims at 35 m");
        for (int Group = 0; Group < VisibleGroups; ++Group)
            Expect(CullStart(Group) > 0 && CullStart(Group) < CullEnd(Group), "group %d fades before it culls", Group);
        Expect(CastsShadow(BodyGroup(0, 0)) && CastsShadow(RoofGroup(2, 3)) && CastsShadow(CabinGroup(1)), "the shell casts shadows");
        Expect(!CastsShadow(TireGroup) && !CastsShadow(RimGroup), "tyres and rims do not");
        Expect(AffectsDistanceFields(BodyGroup(2, 1)) && AffectsDistanceFields(RoofGroup(0, 3)) && AffectsDistanceFields(CabinGroup(2)),
            "the shell lights the distance fields");
        Expect(!AffectsDistanceFields(TireGroup) && !AffectsDistanceFields(RimGroup), "the tyres and rims stay out of them");
        Expect(RecycleDistance > float(BodyCullEnd), "a swap happens beyond the cull distance, where nobody sees it");
    }

    void Body()
    {
        Expect(BoxHalfX * 2.f <= 466.f && BoxHalfY * 2.f <= 220.f, "the box stays inside the 466 x 220 cm car");
        Expect(PivotHeight + BoxCentreZ - BoxHalfZ > 25.f, "the box clears a 25 cm curb top: %.1f", double(PivotHeight + BoxCentreZ - BoxHalfZ));
        Expect(std::fabs(PivotHeight + WheelZ - 36.f) < 1.f, "the tyre centre sits a tyre radius (36 cm) over the road");
    }

    void Promotion()
    {
        Expect(!StrongImpact(299.f, true) && StrongImpact(300.f, true), "a car promotes from 300 cm/s");
        Expect(!StrongImpact(600.f, false), "a walker or a runner never promotes");
        Expect(!StrongImpact(899.f, false) && StrongImpact(900.f, false), "a person thrown at 900 cm/s does");
        Expect(SlotBeatsResident(250.f * 250.f, -1.f), "at the door, with nobody to talk to, E takes the car");
        Expect(!SlotBeatsResident(320.f * 320.f, -1.f), "beyond 300 cm it does not");
        Expect(!SlotBeatsResident(250.f * 250.f, 200.f * 200.f), "a nearer resident wins");
        Expect(SlotBeatsResident(200.f * 200.f, 250.f * 250.f), "a nearer car wins");
    }

    void Throws()
    {
        // A resident 3 m from a car's centre line, thrown square at it: the line enters the box 2 m out.
        const float Reach = 1000.f;
        const float Entry = SegmentEntry(0.f, -300.f, 10.f, 0.f, 700.f, 10.f);
        Expect(std::fabs(Entry * Reach - 200.f) < .01f, "the throw's line enters the car 2 m out: %.2f", double(Entry * Reach));
        const float Share = ThrowShare(Entry, Reach);
        Expect(std::fabs(Share * Reach - 125.f) < .01f, "the person stops 75 cm before the car's side: %.2f", double(Share * Reach));
        Expect(ThrowShare(-1.f, Reach) == 1.f && ThrowShare(.5f, 0.f) == 1.f, "a throw that meets no car keeps its reach");
        Expect(ThrowShare(.05f, Reach) == 0.f, "a person against the car drops where they stand");
        Expect(StrongImpact(1200.f, false) && !StrongImpact(600.f, false), "a 12 m/s throw promotes the car, a 6 m/s push does not");
    }

    void Recycling()
    {
        Expect(MayRecycle(false, false, false, 12000.f, 12000.f), "an empty car far from everyone goes");
        Expect(!MayRecycle(true, false, false, 12000.f, 12000.f), "an occupied car stays");
        Expect(!MayRecycle(false, true, false, 12000.f, 12000.f), "a driven car stays");
        Expect(!MayRecycle(false, false, true, 12000.f, 12000.f), "a police car stays");
        Expect(!MayRecycle(false, false, false, 5000.f, 12000.f) && !MayRecycle(false, false, false, 12000.f, 5000.f),
            "a player near the car or its space keeps it");
        Expect(MayRefill(12000.f, false) && !MayRefill(12000.f, true) && !MayRefill(5000.f, false), "a space refills empty and unseen");
        Expect(HideNow(100.f, 0.f) && !HideNow(300.f, .5f) && HideNow(300.f, 1.f) && !HideNow(-1.f, .2f), "a client waits for the real car");
        // Two spaces promoted 0.9 s apart, with no real car in reach yet: each waits its own second.
        const FPendingHide First = StartPending(3, 10.f), Second = StartPending(4, 10.9f);
        Expect(First.Slot == 3 && Second.Slot == 4, "a pending space keeps its slot");
        Expect(PendingHideNow(First, -1.f, 11.f) && !PendingHideNow(Second, -1.f, 11.f),
            "at 11 s the first space hides and the second, promoted at 10.9 s, still waits");
        Expect(PendingHideNow(Second, -1.f, 11.9f), "the second hides a second after its own promotion");
        Expect(PendingHideNow(Second, 100.f, 11.f), "or as soon as its real car has arrived");
        Expect(LivePromotedCap >= 16 && LivePromotedCap <= 32, "the promoted-car cap stays within the old 32 parked actors");
    }

    void Tiles()
    {
        Expect(TileIndex(0.f) == 0 && TileIndex(18999.f) == 0 && TileIndex(19000.f) == 1, "tiles start at 0");
        Expect(TileIndex(-1.f) == -1 && TileIndex(-19000.f) == -1 && TileIndex(-19001.f) == -2, "and run below 0");
        Expect(TileKey(100.f, -100.f) != TileKey(100.f, 100.f) && TileKey(5.f, 5.f) == TileKey(18000.f, 18000.f), "one key per tile");
        // No instanced component spans more than 200 m: the spaces of one tile, with their cars round them.
        struct FBounds { float MinX = 1e9f, MinY = 1e9f, MaxX = -1e9f, MaxY = -1e9f; };
        std::map<int, FBounds> Bounds;
        for (int Slot = 0; Slot < LaFontaineParking::SlotCount; ++Slot)
        {
            const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[Slot];
            FBounds& Box = Bounds[TileKey(Row.X, Row.Y)];
            Box.MinX = std::fmin(Box.MinX, Row.X - 250.f);
            Box.MinY = std::fmin(Box.MinY, Row.Y - 250.f);
            Box.MaxX = std::fmax(Box.MaxX, Row.X + 250.f);
            Box.MaxY = std::fmax(Box.MaxY, Row.Y + 250.f);
        }
        float Widest = 0.f;
        for (const auto& Entry : Bounds)
            Widest = std::fmax(Widest, std::fmax(Entry.second.MaxX - Entry.second.MinX, Entry.second.MaxY - Entry.second.MinY));
        Expect(Widest <= 20000.f, "no instanced component spans more than 200 m: %.0f cm", double(Widest));
        Expect(Bounds.size() > 4 && Bounds.size() < 200, "the fill covers a few tiles: %d", int(Bounds.size()));
    }

    void Lines()
    {
        // A shot at chest height across a parked car enters its box at the near side.
        const float Across = SegmentEntry(0.f, -500.f, 40.f, 0.f, 500.f, 40.f);
        Expect(std::fabs(Across - .4f) < 1e-4f, "a shot across the car enters at its side: %.4f", double(Across));
        Expect(SegmentEntry(-1000.f, 0.f, 0.f, 1000.f, 0.f, 0.f) > 0.f, "a shot along the car enters at its bumper");
        Expect(SegmentEntry(0.f, -500.f, 120.f, 0.f, 500.f, 120.f) < 0.f, "a shot over the roof misses");
        Expect(SegmentEntry(-1000.f, 300.f, 0.f, 1000.f, 300.f, 0.f) < 0.f, "a shot beside the car misses");
        Expect(SegmentEntry(0.f, 0.f, 0.f, 0.f, 500.f, 0.f) == 0.f, "a line from inside the box starts in it");
        Expect(SegmentEntry(0.f, -500.f, 40.f, 0.f, -200.f, 40.f) < 0.f, "a shot that stops short misses");
        Expect(PropInSpace(0.f, 0.f, 0.f) && PropInSpace(240.f, 0.f, 20.f) && !PropInSpace(0.f, 160.f, 30.f),
            "a cone in the space, or at its end within its strike radius, takes it");
    }

    void Header()
    {
        Expect(LaFontaineParking::SlotCount > 1000, "the curbs hold over 1000 cars: %d", LaFontaineParking::SlotCount);
        int Classes[Bodies] = {};
        for (int Slot = 0; Slot < LaFontaineParking::SlotCount; ++Slot)
        {
            const LaFontaineParking::FSlot& Row = LaFontaineParking::Slots[Slot];
            if (Row.Paint >= Paints || Row.Body >= Bodies || Row.Length != Row.Body || !(Row.Yaw >= 0.f && Row.Yaw < 360.f) ||
                std::fabs(Row.Z - 7.f) > .01f)
            {
                Expect(false, "slot %d is out of range", Slot);
                break;
            }
            ++Classes[Row.Body];
        }
        for (int Body = 0; Body < Bodies; ++Body) Expect(Classes[Body] > LaFontaineParking::SlotCount / 5, "every body parks: %d", Body);
    }
}

int main()
{
    Groups();
    Culling();
    Body();
    Promotion();
    Throws();
    Recycling();
    Tiles();
    Lines();
    Header();
    std::printf("parked rules: %d assertions, %d failures\n", Assertions, Failures);
    return Failures ? 1 : 0;
}
