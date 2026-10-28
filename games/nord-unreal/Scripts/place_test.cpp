// Standalone test for Source/Quebec/QuebecPlace.h.

#ifdef QUEBEC_PLACE_STRICT
#include <cmath>
#include <cstring>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecPlace.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

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
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    double RoadDistance(double X, double Y, double AX, double AY, double BX, double BY)
    {
        const double DX = BX - AX;
        const double DY = BY - AY;
        const double LengthSquared = DX * DX + DY * DY;
        double Along = ((X - AX) * DX + (Y - AY) * DY) / LengthSquared;
        if (Along < 0.) Along = 0.;
        if (Along > 1.) Along = 1.;
        const double ClosestX = AX + Along * DX;
        const double ClosestY = AY + Along * DY;
        return std::hypot(X - ClosestX, Y - ClosestY);
    }
}

int main()
{
    using namespace QuebecPlace;
    const FPlace Home = PlaceAt(0);
    const FPlace Rachel = PlaceAt(1);
    Expect(Count == 2, "two starts");
    Expect(std::strcmp(Home.Name, "Sherbrooke") == 0 && std::strcmp(Rachel.Name, "Rachel") == 0, "the places are named");
    Expect(!Home.bOwnYaw && Rachel.bOwnYaw, "only Rachel brings its own aim");
    Expect(std::fabs(Home.X - 38793.017) < 1e-6 && std::fabs(Home.Y - -7522.815) < 1e-6, "Sherbrooke is the opening spawn");
    Expect(Separation() > 70000., "Rachel is more than 700 m from the opening, got %.0f", Separation());

    // Road segment 389, Rue Rachel Est, from LaFontaineMap.h. Width 620 cm.
    const double Off = RoadDistance(Rachel.X, Rachel.Y, -38335.484, 4799.005, -40017.74, 2217.494);
    Expect(Off > 400. && Off < 560., "Rachel stands on the sidewalk, %.0f cm off the centre", Off);
    Expect(Rachel.Yaw < -100.f && Rachel.Yaw > -160.f, "the look runs down Rachel, yaw %.1f", static_cast<double>(Rachel.Yaw));
    Expect(IndexFor("rachel") == 1 && IndexFor("Rachel") == 1 && IndexFor("1") == 1, "Rachel can be asked for by name");
    Expect(IndexFor(nullptr) == 0 && IndexFor("") == 0 && IndexFor("sherbrooke") == 0 && IndexFor("0") == 0, "the opening stays the default");
    Expect(IndexFor("toronto") == 0 && IndexFor("park") == 0, "an unknown name does not move the start");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
