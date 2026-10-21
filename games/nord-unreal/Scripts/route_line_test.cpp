// Standalone test for Source/Quebec/QuebecRouteLine.h. Built by Scripts/test_route_line.py.

#ifdef QUEBEC_ROUTE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecRouteLine.h"

#include <cstdarg>
#include <cmath>
#include <cstdio>

using namespace QuebecRouteLine;

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

    bool Near(double A, double B)
    {
        return std::fabs(A - B) < 1e-6;
    }
}

int main()
{
    const FVec2 East{1., 0.}, North{0., 1.}, West{-1., 0.};
    Expect(Near(BearingFromPlayer(East, East), 0.), "east of an east facing is not ahead");
    Expect(std::fabs(BearingFromPlayer(North, East) - 1.5707963267948966) < 1e-9, "east of a north facing is not right");
    Expect(std::fabs(BearingFromPlayer(North, West) + 1.5707963267948966) < 1e-9, "west of a north facing is not left");
    Expect(std::fabs(std::fabs(BearingFromPlayer(East, West)) - 3.141592653589793) < 1e-9, "west of an east facing is not behind");
    Expect(Near(BearingFromPlayer({0., 0.}, East), BearingFromPlayer(North, East)), "a zero facing does not fall back to north");

    const FVec2 WalkEast = RouteFacing(false, 0., North);
    Expect(Near(WalkEast.X, 1.) && Near(WalkEast.Y, 0.), "yaw 0 does not face east, the forward walk");
    Expect(TurnFor(BearingFromPlayer(WalkEast, {100., 0.}), 400.) == ETurn::Ahead, "a stop along the camera yaw is not ahead on foot");
    const FVec2 WalkNorth = RouteFacing(false, 90., East);
    Expect(Near(WalkNorth.X, 0.) && Near(WalkNorth.Y, 1.), "yaw 90 does not face north");
    Expect(TurnFor(BearingFromPlayer(WalkNorth, {100., 0.}), 400.) == ETurn::Right, "east of a northward walk is not right");
    const FVec2 Nose = RouteFacing(true, 0., North);
    Expect(Near(Nose.X, North.X) && Near(Nose.Y, North.Y), "a car does not keep its nose when the camera yaws away");
    Expect(TurnFor(BearingFromPlayer(Nose, {0., 100.}), 400.) == ETurn::Ahead, "a stop along the nose is not ahead in a car");

    Expect(TurnFor(0., 100.) == ETurn::Here, "a stop under 1.5 m is not here");
    Expect(TurnFor(0., 150.) == ETurn::Ahead, "1.5 m dead ahead is not ahead");
    Expect(TurnFor(0.2, 400.) == ETurn::Ahead, "a small clockwise angle is not ahead");
    Expect(TurnFor(-0.2, 400.) == ETurn::Ahead, "a small counter-clockwise angle is not ahead");
    Expect(TurnFor(1.0, 400.) == ETurn::Right, "a right angle is not right");
    Expect(TurnFor(-1.0, 400.) == ETurn::Left, "a left angle is not left");
    Expect(TurnFor(3.0, 400.) == ETurn::Behind, "a clockwise about-face is not behind");
    Expect(TurnFor(-3.0, 400.) == ETurn::Behind, "a counter-clockwise about-face is not behind");

    FVec2 Start, Tip;
    CardNeedle(0., 100., Start, Tip);
    Expect(Near(Start.X, 50.) && Near(Start.Y, 50.), "the needle does not start in the card square");
    Expect(Near(Tip.X, 50.) && Near(Tip.Y, 12.), "ahead does not point up on the card");
    CardNeedle(1.5707963267948966, 100., Start, Tip);
    Expect(Near(Tip.X, 88.) && Near(Tip.Y, 50.), "right does not point right on the card");
    CardNeedle(-1.5707963267948966, 100., Start, Tip);
    Expect(Near(Tip.X, 12.) && Near(Tip.Y, 50.), "left does not point left on the card");
    CardNeedle(3.141592653589793, 100., Start, Tip);
    Expect(Near(Tip.X, 50.) && Near(Tip.Y, 88.), "behind does not point down on the card");

    FVec2 A, B;
    Expect(RadarStroke({0., 0.}, {100., 0.}, 12., 8., A, B), "a long radar stroke is rejected");
    Expect(Near(A.X, 12.) && Near(A.Y, 0.) && Near(B.X, 92.) && Near(B.Y, 0.), "the stroke does not clear the arrow and the diamond");
    Expect(!RadarStroke({0., 0.}, {10., 0.}, 12., 8., A, B), "a stroke shorter than its pads is drawn");
    Expect(RadarStroke({5., 5.}, {5., 45.}, 4., 6., A, B), "a northward stroke is rejected");
    Expect(Near(A.X, 5.) && Near(A.Y, 9.) && Near(B.X, 5.) && Near(B.Y, 39.), "the stroke does not follow the radar's up axis");

    double DirX = 0., DirY = 0.;
    ViewToScreen(4., 3., 0., DirX, DirY);
    Expect(DirX > 0. && Near(DirY, 0.), "a stop ahead and right does not point right");
    ViewToScreen(-6., 0., 0., DirX, DirY);
    Expect(Near(DirX, 0.) && DirY > 0., "a stop directly behind does not leave the bottom of the frame");
    ViewToScreen(2., 0., 5., DirX, DirY);
    Expect(Near(DirX, 0.) && DirY < 0., "a stop above the view does not point up");

    FVec2 Edge;
    Expect(EdgeArrow(1., 0., 0., 0., 100., 80., Edge), "a rightward arrow misses the frame");
    Expect(Near(Edge.X, 100.) && Near(Edge.Y, 40.), "a rightward arrow does not meet the right edge");
    Expect(EdgeArrow(0., -1., 10., 20., 110., 80., Edge), "an upward arrow misses the frame");
    Expect(Near(Edge.X, 60.) && Near(Edge.Y, 20.), "an upward arrow does not meet the top edge");
    Expect(EdgeArrow(1., 1., 0., 0., 100., 100., Edge), "a diagonal arrow misses the frame");
    Expect(Near(Edge.X, 100.) && Near(Edge.Y, 100.), "a diagonal arrow does not meet a corner");
    Expect(!EdgeArrow(0., 0., 0., 0., 100., 100., Edge), "a zero direction still draws an arrow");
    Expect(!EdgeArrow(1., 0., 40., 10., 40., 80., Edge), "a flat frame still draws an arrow");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
