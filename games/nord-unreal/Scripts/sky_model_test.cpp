// Standalone test for Source/Quebec/QuebecSkyModel.h. Built and run by Scripts/test_sky_model.py.
// With QUEBEC_SKY_STRICT the Unreal macro names are poisoned before the header is read, so the
// header cannot use them. Pass --table to print a sanity table and the cross-compiler chain fingerprint.

#ifdef QUEBEC_SKY_STRICT
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG
#endif
#include "../Source/Quebec/QuebecSkyModel.h"

#include <array>
#include <initializer_list>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>

using namespace QuebecSky;

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition)
        {
            return;
        }
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    template <typename Left, typename Right>
    bool Near(Left A, Right B, double Tolerance)
    {
        return std::fabs(static_cast<double>(A) - static_cast<double>(B)) <= Tolerance;
    }

    double CircularGap(double A, double B, double Period)
    {
        const double Gap = std::fmod(std::fabs(A - B), Period);
        return std::min(Gap, Period - Gap);
    }

    double Length(const FVec3& V)
    {
        const double X = static_cast<double>(V.X);
        const double Y = static_cast<double>(V.Y);
        const double Z = static_cast<double>(V.Z);
        return std::sqrt(X * X + Y * Y + Z * Z);
    }

    std::array<float, 11> Fields(const FWeatherLook& L)
    {
        return { L.CloudCover, L.SunVisibility, L.FogDensityScale, L.FogStartScale, L.MieScale, L.RayleighScale, L.SkyLuminance, L.Rain, L.Wind, L.Gloom, L.ExposureOffset };
    }

    bool SameLook(const FWeatherLook& A, const FWeatherLook& B, double Tolerance = 1e-6)
    {
        const auto Left = Fields(A);
        const auto Right = Fields(B);
        for (size_t Field = 0; Field < Left.size(); ++Field)
        {
            if (!Near(Left[Field], Right[Field], Tolerance))
            {
                return false;
            }
        }
        return true;
    }

    bool Gloomy(EWeather Weather)
    {
        return Weather == EWeather::Overcast || Weather == EWeather::Fog || Weather == EWeather::Drizzle || Weather == EWeather::Rain;
    }

    FSun SkyWith(float Elevation, float MoonElevation)
    {
        FSun Sun;
        Sun.Elevation = Elevation;
        Sun.MoonElevation = MoonElevation;
        return Sun;
    }

    const char* ClockText(double Hour, char* Buffer)
    {
        const int Minutes = static_cast<int>(std::lround(Hour * 60.0)) % (24 * 60);
        std::snprintf(Buffer, 16, "%02d:%02d", Minutes / 60, Minutes % 60);
        return Buffer;
    }

    void ClockTests()
    {
        Expect(Near(HourAtCycle(0.0), 5.0, 1e-12), "fraction 0 is 05:00, got %.9f", HourAtCycle(0.0));
        Expect(Near(HourAtCycle(.8), 21.0, 1e-9), "fraction .8 is 21:00, got %.9f", HourAtCycle(.8));
        Expect(Near(HourAtCycle(.5), 15.0, 1e-9), "fraction .5 is 15:00, got %.9f", HourAtCycle(.5));
        Expect(Near(CycleForHour(21.0), .8, 1e-12) && Near(CycleForHour(5.0), 0.0, 1e-12), "21:00 and 05:00 map back to .8 and 0");
        double Previous = -1.0;
        bool Monotonic = true;
        bool InRange = true;
        for (int Step = 0; Step < 100000; ++Step)
        {
            const double Fraction = Step / 100000.0;
            const double Hour = HourAtCycle(Fraction);
            const double Unwrapped = Hour < 5.0 ? Hour + 24.0 : Hour;
            Monotonic = Monotonic && Unwrapped > Previous;
            InRange = InRange && Hour >= 0.0 && Hour < 24.0;
            Previous = Unwrapped;
            const double Back = CycleForHour(Hour);
            if (CircularGap(Back, Fraction, 1.0) > 1e-9)
            {
                Expect(false, "CycleForHour(HourAtCycle(%.6f)) = %.12f", Fraction, Back);
            }
        }
        Expect(Monotonic, "clock is strictly increasing across one cycle");
        Expect(InRange, "clock stays in [0, 24)");
        for (int Step = 0; Step < 24000; ++Step)
        {
            const double Hour = Step / 1000.0;
            const double Back = HourAtCycle(CycleForHour(Hour));
            const double Fraction = CycleForHour(Hour);
            if (CircularGap(Back, Hour, 24.0) > 1e-9 || Fraction < 0.0 || Fraction >= 1.0)
            {
                Expect(false, "HourAtCycle(CycleForHour(%.3f)) = %.12f, fraction %.12f", Hour, Back, Fraction);
            }
        }
        Expect(Near(HourAtCycle(-.25), HourAtCycle(.75), 1e-9), "negative fractions wrap");
        Expect(Near(HourAtCycle(1.3), HourAtCycle(.3), 1e-9), "fractions above 1 wrap");
        Expect(Near(HourAtCycle(-3.2), 21.0, 1e-9), "fraction -3.2 wraps to 21:00, got %.9f", HourAtCycle(-3.2));
        Expect(Near(HourAtCycle(17.875), 0.0, 1e-9) || Near(HourAtCycle(17.875), 24.0, 1e-9), "fraction .875 is midnight");
        Expect(Near(CycleForHour(-1.0), CycleForHour(23.0), 1e-12) && Near(CycleForHour(29.0), 0.0, 1e-12), "hours wrap");
        const double Day = (HourAtCycle(.3001) - HourAtCycle(.3)) / .0001;
        const double Night = (HourAtCycle(.8501) - HourAtCycle(.85)) / .0001;
        Expect(Near(Day, 20.0, 1e-6) && Near(Night, 40.0, 1e-6), "day runs at 20 h and night at 40 h per cycle, got %.6f and %.6f", Day, Night);
        Expect(Near(Night / Day, 2.0, 1e-6), "night passes twice as fast");
        const FClock Default;
        Expect(Near(Default.CycleSeconds * (1.0 - Default.NightShare) / 16.0, 120.0, 1e-9), "a day hour lasts 120 real seconds");

        Expect(Near(HourAtTime(0.0, 0.0), 5.0, 1e-12), "server time 0 with no offset is 05:00");
        Expect(Near(HourAtTime(1200.0, 0.0), 15.0, 1e-9), "half a cycle later is 15:00");
        Expect(Near(HourAtTime(0.0, CycleForHour(15.0)), 15.0, 1e-9), "offset for 15:00 starts at 15:00");
        Expect(Near(HourAtTime(2400.0 * 3 + 600.0, .1), HourAtCycle(.35), 1e-9), "whole cycles wrap and the offset adds");
        Expect(Near(HourAtTime(86400.0 * 30 + 1200.0, 0.0), 15.0, 1e-7), "a month of server time stays precise");
        FClock Fast;
        Fast.CycleSeconds = 120.0;
        Expect(Near(HourAtTime(60.0, 0.0, Fast), 15.0, 1e-9), "a shorter cycle scales the clock");
        FClock Broken;
        Broken.CycleSeconds = 0.0;
        Expect(Near(HourAtTime(500.0, CycleForHour(9.0), Broken), 9.0, 1e-9), "a zero-length cycle holds at the offset");
    }

    void SunTests()
    {
        double Sunrise = -1.0;
        double Sunset = -1.0;
        float Previous = SunAt(3.0).Elevation;
        for (int Second = 1; Second <= 20 * 3600; ++Second)
        {
            const double Hour = 3.0 + Second / 3600.0;
            const float Elevation = SunAt(Hour).Elevation;
            if (Previous < -.833f && Elevation >= -.833f)
            {
                Sunrise = Hour;
            }
            if (Previous >= -.833f && Elevation < -.833f)
            {
                Sunset = Hour;
            }
            Previous = Elevation;
        }
        char RiseText[16];
        char SetText[16];
        Expect(Sunrise >= 6.0 + 55.0 / 60.0 && Sunrise <= 7.0 + 25.0 / 60.0, "Montréal sunrise %s is between 06:55 and 07:25", ClockText(Sunrise, RiseText));
        Expect(Sunset >= 17.0 + 55.0 / 60.0 && Sunset <= 18.0 + 25.0 / 60.0, "Montréal sunset %s is between 17:55 and 18:25", ClockText(Sunset, SetText));
        std::printf("Montreal day 288: sunrise %s, sunset %s\n", ClockText(Sunrise, RiseText), ClockText(Sunset, SetText));

        const FSun Noon = SunAt(12.67);
        Expect(Noon.Elevation >= 34.f && Noon.Elevation <= 37.f, "solar noon elevation %.3f is 34-37 degrees", static_cast<double>(Noon.Elevation));
        Expect(Near(Noon.Azimuth, 180.0, .5), "solar noon azimuth %.3f is south", static_cast<double>(Noon.Azimuth));
        Expect(SunAt(9.0).ToSun.X > 0.f && SunAt(9.0).Azimuth < 180.f, "morning sun is east");
        Expect(SunAt(16.0).ToSun.X < 0.f && SunAt(16.0).Azimuth > 180.f, "evening sun is west");
        Expect(SunAt(12.67).ToSun.Y < 0.f, "noon sun is south of the zenith");
        bool Unit = true;
        bool Consistent = true;
        for (int Step = 0; Step < 96; ++Step)
        {
            const FSun Sun = SunAt(Step / 4.0);
            Unit = Unit && Near(Length(Sun.ToSun), 1.0, 1e-5) && Near(Length(Sun.ToMoon), 1.0, 1e-5);
            Consistent = Consistent && Near(std::asin(static_cast<double>(Sun.ToSun.Z)) * 57.29577951308232, Sun.Elevation, 1e-3)
                && Near(std::asin(static_cast<double>(Sun.ToMoon.Z)) * 57.29577951308232, Sun.MoonElevation, 1e-3)
                && Sun.Azimuth >= 0.f && Sun.Azimuth < 360.f && Sun.MoonAzimuth >= 0.f && Sun.MoonAzimuth < 360.f;
        }
        Expect(Unit, "sun and moon directions are unit vectors");
        Expect(Consistent, "elevations match the direction vectors and azimuth is in [0, 360)");
        for (double Hour : { 22.0, 23.5, 0.0, 1.0, 2.5 })
        {
            Expect(SunAt(Hour).MoonElevation > 10.f, "moon is up at %.1f h (%.2f deg)", Hour, static_cast<double>(SunAt(Hour).MoonElevation));
        }
        for (double Hour : { 11.0, 12.67, 14.0 })
        {
            Expect(SunAt(Hour).MoonElevation < 0.f, "moon is down at %.2f h (%.2f deg)", Hour, static_cast<double>(SunAt(Hour).MoonElevation));
        }
        int NightSteps = 0;
        int MoonSteps = 0;
        for (int Minute = 0; Minute < 24 * 60; ++Minute)
        {
            const FSun Sun = SunAt(Minute / 60.0);
            NightSteps += Sun.Elevation < -.833f ? 1 : 0;
            MoonSteps += Sun.Elevation < -.833f && Sun.MoonElevation > 0.f ? 1 : 0;
        }
        Expect(MoonSteps > NightSteps * 3 / 4, "moon is up for %d of %d night minutes", MoonSteps, NightSteps);
        Expect(SunAt(Sunset).MoonElevation > 10.f && SunAt(Sunrise).MoonElevation < 0.f, "the waxing moon is up at sunset and down at sunrise");
        Expect(SunAt(0.5).Elevation < -12.f, "sun is below -12 degrees after midnight");
        Expect(LatitudeForMap("/Game/Maps/CollegeBathurst") == 43.656 && LatitudeForMap("CollegeBathurst") == 43.656, "College and Bathurst uses Toronto latitude");
        Expect(LatitudeForMap("/Game/Maps/LaFontaine") == 45.525 && LatitudeForMap("") == 45.525 && LatitudeForMap(nullptr) == 45.525, "other maps use Montréal latitude");
        const float TorontoNoon = SunAt(12.67, 288, LatitudeForMap("CollegeBathurst")).Elevation;
        Expect(Near(TorontoNoon - Noon.Elevation, 45.525 - 43.656, 1e-3), "Toronto noon is %.3f degrees higher", static_cast<double>(TorontoNoon - Noon.Elevation));
    }

    void WeatherTests()
    {
        const char* Expected[WeatherCount] = { "CLEAR", "BREEZY", "OVERCAST", "FOG", "DRIZZLE", "RAIN" };
        for (int Index = 0; Index < WeatherCount; ++Index)
        {
            const EWeather Weather = static_cast<EWeather>(Index);
            EWeather Parsed = EWeather::Clear;
            Expect(std::strcmp(WeatherName(Weather), Expected[Index]) == 0, "weather %d is named %s", Index, Expected[Index]);
            Expect(ParseWeather(WeatherName(Weather), Parsed) && Parsed == Weather, "%s round trips", Expected[Index]);
        }
        EWeather Parsed = EWeather::Clear;
        Expect(ParseWeather("rain", Parsed) && Parsed == EWeather::Rain, "lower case parses");
        Expect(ParseWeather("Overcast", Parsed) && Parsed == EWeather::Overcast, "title case parses");
        Expect(ParseWeather("dRiZzLe", Parsed) && Parsed == EWeather::Drizzle, "mixed case parses");
        Parsed = EWeather::Fog;
        for (const char* Bad : { "", "storm", "RAINY", "RAI", " rain", "clear ", "fog\n" })
        {
            Expect(!ParseWeather(Bad, Parsed), "'%s' does not parse", Bad);
        }
        Expect(!ParseWeather(nullptr, Parsed) && Parsed == EWeather::Fog, "null does not parse and leaves the output alone");
        Expect(std::strcmp(WeatherName(static_cast<EWeather>(9)), "CLEAR") == 0, "an out-of-range byte reads as CLEAR");

        // Golden values lock the generator: the same seed gives the same chain on every compiler and peer.
        FRandom Golden(1);
        const uint32_t First = Golden.Next();
        const uint32_t Second = Golden.Next();
        Expect(First == 0x1F48D1FBu && Second == 0xAB81DB40u, "FRandom(1) golden values, got 0x%08X 0x%08X", First, Second);
        FRandom Zero(0);
        Expect(Zero.State != 0, "seed 0 gets a nonzero state");
        FRandom Cleared;
        Cleared.State = 0;
        Expect(Cleared.Next() != 0 && Cleared.State != 0, "a zeroed state recovers");
        bool NeverZero = true;
        double Lowest = 1.0;
        double Highest = 0.0;
        for (int Draw = 0; Draw < 200000; ++Draw)
        {
            const double Unit = Zero.Unit();
            NeverZero = NeverZero && Zero.State != 0;
            Lowest = std::min(Lowest, Unit);
            Highest = std::max(Highest, Unit);
        }
        Expect(NeverZero, "state never becomes 0");
        Expect(Lowest >= 0.0 && Lowest < .001 && Highest < 1.0 && Highest > .999, "Unit covers [0, 1), got %.6f to %.6f", Lowest, Highest);

        const int Weights[WeatherCount][WeatherCount] = {
            { 0, 5, 4, 1, 0, 0 }, { 3, 0, 5, 0, 2, 0 }, { 1, 2, 0, 2, 3, 2 },
            { 1, 0, 5, 0, 4, 0 }, { 0, 1, 4, 2, 0, 3 }, { 0, 1, 4, 0, 5, 0 } };
        bool Reach[WeatherCount][WeatherCount] = {};
        FRandom Random(77);
        const int Draws = 40000;
        for (int From = 0; From < WeatherCount; ++From)
        {
            int Counts[WeatherCount] = {};
            for (int Draw = 0; Draw < Draws; ++Draw)
            {
                ++Counts[static_cast<int>(NextWeather(static_cast<EWeather>(From), Random))];
            }
            Expect(Counts[From] == 0, "%s never follows itself", Expected[From]);
            for (int To = 0; To < WeatherCount; ++To)
            {
                const double Share = static_cast<double>(Counts[To]) / Draws;
                Expect(Near(Share, Weights[From][To] / 10.0, .015), "%s -> %s share %.3f matches weight %d/10", Expected[From], Expected[To], Share, Weights[From][To]);
                Expect((Counts[To] > 0) == (Weights[From][To] > 0), "%s -> %s happens only with a nonzero weight", Expected[From], Expected[To]);
                Reach[From][To] = Counts[To] > 0 || From == To;
            }
        }
        for (int Via = 0; Via < WeatherCount; ++Via)
        {
            for (int From = 0; From < WeatherCount; ++From)
            {
                for (int To = 0; To < WeatherCount; ++To)
                {
                    Reach[From][To] = Reach[From][To] || (Reach[From][Via] && Reach[Via][To]);
                }
            }
        }
        for (int From = 0; From < WeatherCount; ++From)
        {
            for (int To = 0; To < WeatherCount; ++To)
            {
                Expect(Reach[From][To], "%s can reach %s", Expected[From], Expected[To]);
            }
        }
        Expect(NextWeather(static_cast<EWeather>(9), Random) != static_cast<EWeather>(9), "an out-of-range state still moves to a real state");

        const double Holds[WeatherCount][2] = { { 360, 720 }, { 240, 480 }, { 300, 600 }, { 180, 360 }, { 180, 360 }, { 150, 300 } };
        for (int Index = 0; Index < WeatherCount; ++Index)
        {
            double Low = 1e9;
            double High = 0.0;
            for (int Draw = 0; Draw < 5000; ++Draw)
            {
                const double Hold = HoldSeconds(static_cast<EWeather>(Index), Random);
                Low = std::min(Low, Hold);
                High = std::max(High, Hold);
            }
            const double Span = Holds[Index][1] - Holds[Index][0];
            Expect(Low >= Holds[Index][0] && High <= Holds[Index][1] && Low < Holds[Index][0] + .02 * Span && High > Holds[Index][1] - .02 * Span,
                "%s hold %.1f-%.1f fills %.0f-%.0f", Expected[Index], Low, High, Holds[Index][0], Holds[Index][1]);
        }
        double BlendLow = 1e9;
        double BlendHigh = 0.0;
        for (int Draw = 0; Draw < 5000; ++Draw)
        {
            const double Blend = BlendSeconds(EWeather::Clear, EWeather::Rain, Random);
            BlendLow = std::min(BlendLow, Blend);
            BlendHigh = std::max(BlendHigh, Blend);
        }
        Expect(BlendLow >= 60.0 && BlendHigh <= 120.0 && BlendLow < 62.0 && BlendHigh > 118.0, "blend %.1f-%.1f fills 60-120", BlendLow, BlendHigh);

        for (uint32_t Seed : { 1u, 2u, 2026u, 31337u, 0xDEADBEEFu })
        {
            FRandom Left(Seed);
            FRandom Right(Seed);
            FSegment A;
            FSegment B;
            bool Same = true;
            double Gloom = 0.0;
            double Total = 0.0;
            double Now = 0.0;
            for (int Segment = 0; Segment < 2000; ++Segment)
            {
                Now = A.Start + A.Hold;
                Advance(A, Now, Left);
                Advance(B, Now, Right);
                Same = Same && A.From == B.From && A.To == B.To && A.Blend == B.Blend && A.Hold == B.Hold;
                Total += A.Hold;
                Gloom += Gloomy(A.To) ? A.Hold : 0.0;
            }
            Expect(Same, "seed %u gives the same chain twice", Seed);
            Expect(Gloom / Total >= .5, "seed %u: gloomy weather holds %.1f%% of 2000 segments", Seed, 100.0 * Gloom / Total);
            std::printf("seed %u: gloomy share %.1f%% over %.1f hours\n", Seed, 100.0 * Gloom / Total, Total / 3600.0);
        }
        FRandom One(1);
        FRandom Two(2);
        int Differences = 0;
        for (int Draw = 0; Draw < 100; ++Draw)
        {
            Differences += NextWeather(EWeather::Overcast, One) != NextWeather(EWeather::Overcast, Two) ? 1 : 0;
        }
        Expect(Differences > 20, "different seeds give different chains");
    }

    void LookTests()
    {
        const FWeatherLook Clear = LookFor(EWeather::Clear);
        const FWeatherLook Rain = LookFor(EWeather::Rain);
        Expect(SameLook(Clear, FWeatherLook(), 0.0), "the default look is clear");
        Expect(Near(Rain.Rain, .9, 1e-6) && Near(Rain.ExposureOffset, -1.9, 1e-6) && Near(LookFor(EWeather::Fog).FogDensityScale, 12.0, 1e-6)
            && Near(LookFor(EWeather::Overcast).SunVisibility, .12, 1e-6) && Near(LookFor(EWeather::Drizzle).Gloom, .7, 1e-6)
            && Near(LookFor(EWeather::Breezy).Wind, .55, 1e-6), "looks follow the design table");
        Expect(SameLook(Mix(Clear, Rain, 0.f), Clear, 0.0) && SameLook(Mix(Clear, Rain, 1.f), Rain, 1e-6), "Mix endpoints");
        Expect(SameLook(Mix(Clear, Rain, -1.f), Clear, 0.0) && SameLook(Mix(Clear, Rain, 7.f), Rain, 1e-6), "Mix clamps alpha");
        const FWeatherLook Half = Mix(Clear, Rain, .5f);
        Expect(Near(Half.Rain, .45, 1e-6) && Near(Half.ExposureOffset, -.95, 1e-6) && Near(Half.FogDensityScale, 4.0, 1e-6), "Mix is linear");
        float Gloom = 0.f;
        bool Monotonic = true;
        for (int Step = 0; Step <= 100; ++Step)
        {
            const FWeatherLook Mixed = Mix(Clear, Rain, static_cast<float>(Step) / 100.f);
            Monotonic = Monotonic && Mixed.Gloom >= Gloom;
            Gloom = Mixed.Gloom;
        }
        Expect(Monotonic, "Mix moves gloom steadily");
        bool Gloomier = true;
        for (EWeather Weather : { EWeather::Overcast, EWeather::Fog, EWeather::Drizzle, EWeather::Rain })
        {
            const FWeatherLook Look = LookFor(Weather);
            Gloomier = Gloomier && Look.Gloom >= .5f && Look.SunVisibility <= .2f && Look.ExposureOffset <= -1.2f;
        }
        Expect(Gloomier, "gloomy states are dark and grey");
    }

    void WetnessTests()
    {
        FWetness Wet;
        double Seconds = 0.0;
        while (Wet.Surface < 1.f && Seconds < 600.0)
        {
            Wet.Step(1.f, .1f);
            Seconds += .1;
        }
        Expect(Seconds <= 60.0 && Seconds >= 40.0, "full rain wets the surface in %.1f s", Seconds);
        Expect(Wet.Puddles < .5f, "puddles lag the surface (%.3f)", static_cast<double>(Wet.Puddles));
        for (int Step = 0; Step < 900; ++Step)
        {
            Wet.Step(1.f, .1f);
        }
        Expect(Wet.Surface == 1.f && Wet.Puddles == 1.f, "two minutes of rain fills the puddles");
        for (int Step = 0; Step < 600; ++Step)
        {
            Wet.Step(0.f, .1f);
        }
        Expect(Wet.Surface > .7f && Wet.Puddles > .8f, "one dry minute leaves the ground wet (%.3f, %.3f)", static_cast<double>(Wet.Surface), static_cast<double>(Wet.Puddles));
        for (int Step = 0; Step < 1900; ++Step)
        {
            Wet.Step(0.f, .1f);
        }
        Expect(Wet.Surface == 0.f && Wet.Puddles > 0.f, "the surface dries in four minutes, puddles take longer");
        Wet.Step(0.f, 300.f);
        Expect(Wet.Puddles == 0.f, "puddles dry in seven minutes");
        FWetness Drizzle;
        Drizzle.Step(.3f, 100.f);
        Expect(Near(Drizzle.Surface, .7, 1e-6) && Near(Drizzle.Puddles, .3, 1e-6), "drizzle settles at .7 surface and .3 puddles");
        FWetness Trace;
        Trace.Step(.01f, 100.f);
        Expect(Trace.Surface == 0.f, "a trace of rain does not wet the surface");
        FWetness Wild;
        FRandom Random(5);
        bool Bounded = true;
        for (int Step = 0; Step < 20000; ++Step)
        {
            Wild.Step(static_cast<float>(Random.Range(-.5, 1.5)), static_cast<float>(Random.Range(-1.0, 50.0)));
            Bounded = Bounded && Wild.Surface >= 0.f && Wild.Surface <= 1.f && Wild.Puddles >= 0.f && Wild.Puddles <= 1.f;
        }
        Expect(Bounded, "wetness stays in [0, 1] for any rain and step");
    }

    void LightingTests()
    {
        const FWeatherLook Clear = LookFor(EWeather::Clear);
        for (float Elevation : { 8.f, 20.f, 45.f, 90.f })
        {
            const FLighting Light = LightingFor(SkyWith(Elevation, -40.f), Clear);
            Expect(Light.SunScale == 1.f && Light.ExposureOffset == 0.f && Light.ExposureScale == 1.f && Light.SkyLuminanceFactor == 1.f
                && Light.SkyLightScale == 1.f && Light.WindowGlow == 1.f && !Light.bStreetLamps && Light.bSunActive && !Light.bMoonActive
                && Light.Saturation == 1.f && Light.Contrast == 1.f && Light.WhiteTemp == 6500.f && Light.DayFactor == 1.f && Light.NightFactor == 0.f,
                "clear sky at %.0f degrees reproduces the authored scene", static_cast<double>(Elevation));
        }
        const FLighting Afternoon = LightingFor(SunAt(15.0), Clear);
        Expect(Afternoon.SunScale == 1.f && Afternoon.ExposureOffset == 0.f && !Afternoon.bStreetLamps, "15:00 clear is the authored afternoon");
        Expect(Afternoon.LampCandela == 1500.f && Afternoon.HeadlightCandela == 3500.f && Near(Afternoon.MoonColor.Y, .72, 1e-6), "lamp, headlight and moon constants");

        const FLighting Night = LightingFor(SkyWith(-15.f, 30.f), Clear);
        Expect(Night.ExposureOffset == -9.f && Near(Night.ExposureScale, 1.0 / 512.0, 1e-9), "night exposure offset %.3f is -9", static_cast<double>(Night.ExposureOffset));
        Expect(Night.bStreetLamps && Night.bMoonActive && Near(Night.MoonLux, 12.0, 1e-5) && !Night.bSunActive && Night.SunScale == 0.f, "night has lamps and moon, no sun");
        Expect(Near(Night.WindowGlow, 12.0, 1e-5) && Near(Night.Saturation, .85, 1e-6), "night windows glow 12x");
        const FLighting Moonless = LightingFor(SkyWith(-15.f, -10.f), Clear);
        Expect(!Moonless.bMoonActive && Moonless.MoonLux == 0.f && Moonless.bStreetLamps, "no moonlight when the moon is down");
        const FLighting RealNight = LightingFor(SunAt(0.5), Clear);
        Expect(RealNight.ExposureOffset == -9.f && RealNight.bStreetLamps && RealNight.bMoonActive && !RealNight.bSunActive, "00:30 is night with the moon up");
        const FLighting RainyNight = LightingFor(SkyWith(-15.f, 30.f), LookFor(EWeather::Rain));
        Expect(RainyNight.bMoonActive && RainyNight.MoonLux < 3.f, "rain dims the moon to %.2f lux", static_cast<double>(RainyNight.MoonLux));

        // Every design formula at one point between day and night, against hand-computed values.
        const FLighting Mid = LightingFor(SkyWith(1.f, 3.f), LookFor(EWeather::Overcast));
        Expect(Near(Mid.DayFactor, .5, 1e-6) && Near(Mid.NightFactor, .028, 1e-6) && Near(Mid.SunScale, .12, 1e-6) && Near(Mid.MoonLux, .0795661, 1e-5)
            && Near(Mid.ExposureOffset, -3.853919, 1e-4) && Near(Mid.ExposureScale, std::exp2(-3.853919), 1e-5) && Near(Mid.WindowGlow, 2.65, 1e-5)
            && !Mid.bStreetLamps && Near(Mid.Saturation, .8458, 1e-5) && Near(Mid.Contrast, .96, 1e-6) && Near(Mid.WhiteTemp, 6200.0, 1e-3)
            && Near(Mid.FogBrightness, .4675, 1e-5) && Near(Mid.SkyLuminanceFactor, 6.25, 1e-4) && Mid.bSunActive && Mid.bMoonActive,
            "mid-dusk overcast lighting matches the design formulas (EV %.4f, moon %.5f)", static_cast<double>(Mid.ExposureOffset), static_cast<double>(Mid.MoonLux));
        const FLighting RainNoon = LightingFor(SunAt(12.67), LookFor(EWeather::Rain));
        Expect(RainNoon.ExposureOffset < 0.f && Near(RainNoon.ExposureOffset, -1.9, 1e-5), "rain at noon lowers exposure (%.3f)", static_cast<double>(RainNoon.ExposureOffset));
        Expect(Near(RainNoon.SunScale, .05, 1e-6) && Near(RainNoon.SkyLuminanceFactor, 9.0, 1e-4) && RainNoon.Saturation < .8f, "rain at noon has a hidden sun and a bright grey sky");
        const FLighting OvercastNoon = LightingFor(SunAt(12.67), LookFor(EWeather::Overcast));
        Expect(Near(OvercastNoon.SkyLuminanceFactor, .75 / .12, 1e-4), "overcast sky luminance factor %.3f", static_cast<double>(OvercastNoon.SkyLuminanceFactor));
        const FSun Dusk = SkyWith(-2.f, -20.f);
        Expect(!LightingFor(Dusk, Clear).bStreetLamps && LightingFor(Dusk, LookFor(EWeather::Rain)).bStreetLamps, "gloom turns the lamps on earlier");

        bool Monotonic = true;
        bool Finite = true;
        for (int Index = 0; Index < WeatherCount; ++Index)
        {
            const FWeatherLook Look = LookFor(static_cast<EWeather>(Index));
            float Previous = -100.f;
            for (int Step = 0; Step <= 900; ++Step)
            {
                const FLighting Light = LightingFor(SkyWith(-30.f + .1f * static_cast<float>(Step), 0.f), Look);
                Monotonic = Monotonic && Light.ExposureOffset >= Previous;
                Previous = Light.ExposureOffset;
            }
            for (int Step = 0; Step < 96; ++Step)
            {
                const FLighting Light = LightingFor(SunAt(Step / 4.0), Mix(Look, LookFor(EWeather::Fog), .37f));
                for (float Value : { Light.DayFactor, Light.NightFactor, Light.SunScale, Light.MoonLux, Light.SkyLightScale, Light.SkyLuminanceFactor,
                    Light.ExposureOffset, Light.ExposureScale, Light.WindowGlow, Light.Saturation, Light.Contrast, Light.WhiteTemp, Light.FogBrightness })
                {
                    Finite = Finite && std::isfinite(Value);
                }
                Finite = Finite && Light.ExposureOffset >= -9.f && Light.ExposureOffset <= 0.f && Light.SkyLuminanceFactor >= .5f && Light.SkyLuminanceFactor <= 16.f;
            }
        }
        Expect(Monotonic, "exposure never drops as the sun rises");
        Expect(Finite, "every lighting output is finite and in range for all hours and weathers");
    }

    void SegmentTests()
    {
        FSegment Segment{ EWeather::Clear, EWeather::Rain, 100.0, 80.0, 300.0 };
        Expect(SameLook(Sample(Segment, 100.0), LookFor(EWeather::Clear)), "alpha is 0 at the segment start");
        Expect(SameLook(Sample(Segment, 40.0), LookFor(EWeather::Clear)), "before the start the old weather holds");
        Expect(SameLook(Sample(Segment, 140.0), Mix(LookFor(EWeather::Clear), LookFor(EWeather::Rain), .5f)), "halfway through the blend is the midpoint");
        Expect(Sample(Segment, 120.0).Rain < .25f * .9f, "the blend eases in (smoothstep)");
        Expect(SameLook(Sample(Segment, 180.0), LookFor(EWeather::Rain)) && SameLook(Sample(Segment, 399.0), LookFor(EWeather::Rain)), "alpha is 1 after the blend");
        FRandom Random(9);
        Expect(!Advance(Segment, 399.999, Random) && Segment.To == EWeather::Rain && Segment.Start == 100.0, "Advance waits for Start + Hold");
        Expect(Advance(Segment, 400.0, Random), "Advance starts the next segment at Start + Hold");
        Expect(Segment.From == EWeather::Rain && Segment.To != EWeather::Rain && Segment.Start == 400.0, "the next segment starts from the old target");
        const double Held = Segment.Hold - Segment.Blend;
        Expect(Segment.Blend >= 60.0 && Segment.Blend <= 120.0 && Held >= 150.0 && Held <= 720.0, "the next segment holds for its blend plus a hold time");
        Expect(SameLook(Sample(Segment, 400.0), LookFor(EWeather::Rain)), "a new segment starts where the last one ended");
        const FSegment Copy = Segment;
        Expect(!Advance(Segment, 400.0 + Segment.Hold - .001, Random) && Segment.To == Copy.To, "no change before the new hold ends");

        FSegment Fixed{ EWeather::Fog, EWeather::Fog, 0.0, 90.0, 1e12 };
        bool Steady = true;
        for (double Now : { -5.0, 0.0, 30.0, 45.0, 89.0, 5000.0 })
        {
            Steady = Steady && SameLook(Sample(Fixed, Now), LookFor(EWeather::Fog), 0.0);
        }
        Expect(Steady, "a held weather (From == To) never blends");
        Expect(!Advance(Fixed, 1e6, Random) && Fixed.From == Fixed.To, "a held weather with a long hold does not advance");
        FSegment Instant{ EWeather::Clear, EWeather::Drizzle, 50.0, 0.0, 10.0 };
        Expect(SameLook(Sample(Instant, 50.0), LookFor(EWeather::Drizzle)), "a zero blend jumps to the target");
        FSegment Fresh;
        Expect(Advance(Fresh, 0.0, Random) && Fresh.From == EWeather::Clear && Fresh.To != EWeather::Clear, "a default segment advances at once");
    }

    void WindTests()
    {
        const FVec3 Start = WindDirection(0.0);
        Expect(Near(Start.X, .94, .005) && Near(Start.Y, .34, .005) && Start.Z == 0.f, "wind starts at the authored (.94, .34)");
        const double Base = std::atan2(.34, .94);
        double Lowest = 10.0;
        double Highest = -10.0;
        double Fastest = 0.0;
        double Previous = Base;
        bool Unit = true;
        for (int Second = 0; Second <= 3600; ++Second)
        {
            const FVec3 Wind = WindDirection(1e6 + Second);
            Unit = Unit && Near(Length(Wind), 1.0, 1e-5) && Wind.Z == 0.f;
            const double Angle = std::atan2(static_cast<double>(Wind.Y), static_cast<double>(Wind.X));
            Lowest = std::min(Lowest, Angle - Base);
            Highest = std::max(Highest, Angle - Base);
            if (Second > 0)
            {
                Fastest = std::max(Fastest, std::fabs(Angle - Previous));
            }
            Previous = Angle;
        }
        Expect(Unit, "wind direction is a unit horizontal vector");
        Expect(Highest - Lowest > .5 && Lowest > -.6 && Highest < .6, "wind swings %.2f to %.2f rad around the base", Lowest, Highest);
        Expect(Fastest < .01, "wind turns slowly (%.4f rad per second at most)", Fastest);
    }

    void PrintTable()
    {
        std::printf("%-6s %-9s %7s %7s %8s %8s %6s %5s %5s\n", "hour", "weather", "elev", "sun", "ev", "skylum", "glow", "lamps", "moon");
        for (double Hour : { 6.0, 7.5, 9.0, 12.67, 15.0, 17.5, 18.5, 19.5, 21.0, 0.0, 3.0 })
        {
            for (EWeather Weather : { EWeather::Clear, EWeather::Overcast, EWeather::Fog, EWeather::Rain })
            {
                const FSun Sun = SunAt(Hour);
                const FLighting Light = LightingFor(Sun, LookFor(Weather));
                char Text[16];
                std::printf("%-6s %-9s %7.2f %7.3f %8.2f %8.2f %6.2f %5s %5.2f\n", ClockText(Hour, Text), WeatherName(Weather), static_cast<double>(Sun.Elevation),
                    static_cast<double>(Light.SunScale), static_cast<double>(Light.ExposureOffset), static_cast<double>(Light.SkyLuminanceFactor),
                    static_cast<double>(Light.WindowGlow), Light.bStreetLamps ? "on" : "off", static_cast<double>(Light.MoonLux));
            }
        }
        FRandom Random(2026);
        FSegment Segment;
        std::printf("chain 2026:");
        for (int Step = 0; Step < 24; ++Step)
        {
            Advance(Segment, Segment.Start + Segment.Hold, Random);
            std::printf(" %s/%.0f", WeatherName(Segment.To), Segment.Hold);
        }
        std::printf("\n");
    }
}

int main(int Count, char** Arguments)
{
    if (Count > 1 && std::strcmp(Arguments[1], "--table") == 0)
    {
        PrintTable();
        return 0;
    }
    ClockTests();
    SunTests();
    WeatherTests();
    LookTests();
    WetnessTests();
    LightingTests();
    SegmentTests();
    WindTests();
    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures ? EXIT_FAILURE : EXIT_SUCCESS;
}
