#pragma once

// Engine-independent Montréal sky: clock, sun and moon, weather chain, wetness and lighting.
// No Unreal includes, so Scripts/test_sky_model.py can build and run it with the system compiler.
// Directions are (east, north, up), the map frame. Angles are degrees unless a name says otherwise.

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace QuebecSky
{
    enum class EWeather : uint8_t { Clear, Breezy, Overcast, Fog, Drizzle, Rain };
    inline constexpr int WeatherCount = 6;

    // The values the saved map was lit with; lighting outputs are multipliers on these.
    inline constexpr float AuthoredSunLux = 26000.f;
    inline constexpr float AuthoredEV100 = 12.5f;
    inline constexpr float AuthoredSkyLight = 1.9f;

    struct FVec3
    {
        float X = 0.f;
        float Y = 0.f;
        float Z = 0.f;
    };

    namespace Detail
    {
        inline constexpr double RadiansPerDegree = 3.14159265358979323846 / 180.0;
        inline constexpr double FullTurn = 2.0 * 3.14159265358979323846;

        inline double Wrap(double Value, double Period)
        {
            const double Wrapped = Value - Period * std::floor(Value / Period);
            return Wrapped < Period ? Wrapped : 0.0;
        }

        // A corrupt replicated byte reads as clear weather instead of indexing past a table.
        inline int Index(EWeather Weather)
        {
            const int Value = static_cast<int>(Weather);
            return Value < WeatherCount ? Value : 0;
        }

        inline float Lerp(float From, float To, float Alpha)
        {
            return From + (To - From) * Alpha;
        }

        inline char Upper(char Letter)
        {
            return Letter >= 'a' && Letter <= 'z' ? static_cast<char>(Letter - 'a' + 'A') : Letter;
        }

        // Moves wet values quickly up and slowly down without overshooting the target.
        inline float Approach(float Value, float Target, float Rise, float Fall)
        {
            const float Moved = Value < Target ? std::min(Target, Value + Rise) : std::max(Target, Value - Fall);
            return std::clamp(Moved, 0.f, 1.f);
        }
    }

    inline float Smoothstep(float Edge0, float Edge1, float Value)
    {
        const float T = std::clamp((Value - Edge0) / (Edge1 - Edge0), 0.f, 1.f);
        return T * T * (3.f - 2.f * T);
    }

    inline const char* WeatherName(EWeather Weather)
    {
        static constexpr const char* Names[WeatherCount] = { "CLEAR", "BREEZY", "OVERCAST", "FOG", "DRIZZLE", "RAIN" };
        return Names[Detail::Index(Weather)];
    }

    inline bool ParseWeather(const char* Name, EWeather& OutWeather)
    {
        if (!Name)
        {
            return false;
        }
        for (int Candidate = 0; Candidate < WeatherCount; ++Candidate)
        {
            const char* Expected = WeatherName(static_cast<EWeather>(Candidate));
            int Letter = 0;
            while (Expected[Letter] && Detail::Upper(Name[Letter]) == Expected[Letter])
            {
                ++Letter;
            }
            if (!Expected[Letter] && !Name[Letter])
            {
                OutWeather = static_cast<EWeather>(Candidate);
                return true;
            }
        }
        return false;
    }

    // 40 real minutes per day. Night (21:00 to 05:00) gets a fifth of the cycle, so it passes twice as fast.
    struct FClock
    {
        double CycleSeconds = 2400.0;
        double DayStartHour = 5.0;
        double NightStartHour = 21.0;
        double NightShare = 0.2;
    };

    inline double HourAtCycle(double Fraction, const FClock& Clock = FClock())
    {
        const double Cycle = Detail::Wrap(Fraction, 1.0);
        const double DayShare = 1.0 - Clock.NightShare;
        const double DayHours = Clock.NightStartHour - Clock.DayStartHour;
        const double Hour = Cycle < DayShare
            ? Clock.DayStartHour + Cycle / DayShare * DayHours
            : Clock.NightStartHour + (Cycle - DayShare) / Clock.NightShare * (24.0 - DayHours);
        return Detail::Wrap(Hour, 24.0);
    }

    inline double CycleForHour(double Hour, const FClock& Clock = FClock())
    {
        const double SinceDayStart = Detail::Wrap(Hour - Clock.DayStartHour, 24.0);
        const double DayShare = 1.0 - Clock.NightShare;
        const double DayHours = Clock.NightStartHour - Clock.DayStartHour;
        const double Cycle = SinceDayStart < DayHours
            ? SinceDayStart / DayHours * DayShare
            : DayShare + (SinceDayStart - DayHours) / (24.0 - DayHours) * Clock.NightShare;
        return Detail::Wrap(Cycle, 1.0);
    }

    inline double HourAtTime(double ServerSeconds, double CycleOffset, const FClock& Clock = FClock())
    {
        const double Elapsed = Clock.CycleSeconds > 0.0 ? ServerSeconds / Clock.CycleSeconds : 0.0;
        return HourAtCycle(Elapsed + CycleOffset, Clock);
    }

    struct FSun
    {
        FVec3 ToSun;
        float Elevation = 0.f;
        float Azimuth = 0.f;
        FVec3 ToMoon;
        float MoonElevation = 0.f;
        float MoonAzimuth = 0.f;
    };

    namespace Detail
    {
        // The NOAA zenith and azimuth formulas written as one (east, north, up) vector, so the
        // azimuth quadrant comes from atan2 instead of a sign test.
        inline FVec3 SkyDirection(double DeclinationRadians, double HourAngleRadians, double LatitudeRadians, float& OutElevation, float& OutAzimuth)
        {
            const double East = -std::cos(DeclinationRadians) * std::sin(HourAngleRadians);
            const double North = std::cos(LatitudeRadians) * std::sin(DeclinationRadians) - std::sin(LatitudeRadians) * std::cos(DeclinationRadians) * std::cos(HourAngleRadians);
            const double Up = std::sin(LatitudeRadians) * std::sin(DeclinationRadians) + std::cos(LatitudeRadians) * std::cos(DeclinationRadians) * std::cos(HourAngleRadians);
            OutElevation = static_cast<float>(std::asin(std::clamp(Up, -1.0, 1.0)) / RadiansPerDegree);
            OutAzimuth = static_cast<float>(Wrap(std::atan2(East, North) / RadiansPerDegree, 360.0));
            return FVec3{ static_cast<float>(East), static_cast<float>(North), static_cast<float>(Up) };
        }
    }

    // Day 288 is mid-October. Solar noon 12.67 is Montréal daylight time with the October equation of time.
    inline FSun SunAt(double Hour, int DayOfYear = 288, double LatitudeDeg = 45.525, double SolarNoonHour = 12.67)
    {
        const double Year = Detail::FullTurn / 365.0 * (DayOfYear - 1);
        const double Declination = 0.006918 - 0.399912 * std::cos(Year) + 0.070257 * std::sin(Year)
            - 0.006758 * std::cos(2.0 * Year) + 0.000907 * std::sin(2.0 * Year)
            - 0.002697 * std::cos(3.0 * Year) + 0.00148 * std::sin(3.0 * Year);
        const double HourAngle = 15.0 * (Hour - SolarNoonHour) * Detail::RadiansPerDegree;
        const double Latitude = LatitudeDeg * Detail::RadiansPerDegree;
        FSun Sun;
        Sun.ToSun = Detail::SkyDirection(Declination, HourAngle, Latitude, Sun.Elevation, Sun.Azimuth);
        // A waxing gibbous moon: opposite declination, 25 degrees short of opposition. It is already up
        // at sunset and sets before dawn, so the first evening after the 15:00 start has moonlight.
        Sun.ToMoon = Detail::SkyDirection(-Declination, HourAngle - (180.0 - 25.0) * Detail::RadiansPerDegree, Latitude, Sun.MoonElevation, Sun.MoonAzimuth);
        return Sun;
    }

    // Multipliers on the authored scene, plus absolute rain, wind and gloom. The defaults are the clear look.
    struct FWeatherLook
    {
        float CloudCover = .15f;
        float SunVisibility = 1.f;
        float FogDensityScale = 1.f;
        float FogStartScale = 1.f;
        float MieScale = 1.f;
        float RayleighScale = 1.f;
        float SkyLuminance = 1.f;
        float Rain = 0.f;
        float Wind = .2f;
        float Gloom = 0.f;
        float ExposureOffset = 0.f;
    };

    inline FWeatherLook LookFor(EWeather Weather)
    {
        switch (Weather)
        {
        case EWeather::Breezy: return { .4f, .85f, 1.3f, 1.f, 1.5f, .95f, 1.f, 0.f, .55f, .1f, -.15f };
        case EWeather::Overcast: return { .9f, .12f, 3.f, .4f, 6.f, .55f, .75f, 0.f, .35f, .5f, -1.2f };
        case EWeather::Fog: return { .8f, .2f, 12.f, .02f, 9.f, .5f, .6f, 0.f, .1f, .75f, -1.5f };
        case EWeather::Drizzle: return { .95f, .08f, 5.f, .2f, 8.f, .5f, .55f, .3f, .45f, .7f, -1.6f };
        case EWeather::Rain: return { 1.f, .05f, 7.f, .1f, 10.f, .45f, .45f, .9f, .8f, .85f, -1.9f };
        case EWeather::Clear: break;
        }
        return FWeatherLook();
    }

    inline FWeatherLook Mix(const FWeatherLook& A, const FWeatherLook& B, float Alpha)
    {
        const float T = std::clamp(Alpha, 0.f, 1.f);
        return {
            Detail::Lerp(A.CloudCover, B.CloudCover, T), Detail::Lerp(A.SunVisibility, B.SunVisibility, T),
            Detail::Lerp(A.FogDensityScale, B.FogDensityScale, T), Detail::Lerp(A.FogStartScale, B.FogStartScale, T),
            Detail::Lerp(A.MieScale, B.MieScale, T), Detail::Lerp(A.RayleighScale, B.RayleighScale, T),
            Detail::Lerp(A.SkyLuminance, B.SkyLuminance, T), Detail::Lerp(A.Rain, B.Rain, T),
            Detail::Lerp(A.Wind, B.Wind, T), Detail::Lerp(A.Gloom, B.Gloom, T),
            Detail::Lerp(A.ExposureOffset, B.ExposureOffset, T) };
    }

    // xorshift32 (Marsaglia 2003). Only 32-bit unsigned arithmetic, so every compiler and peer gets the same chain.
    struct FRandom
    {
        static constexpr uint32_t FallbackState = 0x9E3779B9u;
        uint32_t State = FallbackState;

        FRandom() = default;
        explicit FRandom(uint32_t Seed)
        {
            // murmur3 finaliser: small seeds still start far apart. It maps only 0 to 0.
            uint32_t Mixed = Seed;
            Mixed ^= Mixed >> 16;
            Mixed *= 0x85EBCA6Bu;
            Mixed ^= Mixed >> 13;
            Mixed *= 0xC2B2AE35u;
            Mixed ^= Mixed >> 16;
            State = Mixed ? Mixed : FallbackState;
        }

        uint32_t Next()
        {
            if (!State)
            {
                State = FallbackState;
            }
            State ^= State << 13;
            State ^= State >> 17;
            State ^= State << 5;
            return State;
        }

        // Uniform in [0, 1) from the top 24 bits.
        double Unit()
        {
            return static_cast<double>(Next() >> 8) / 16777216.0;
        }

        double Range(double Low, double High)
        {
            return Low + (High - Low) * Unit();
        }
    };

    inline EWeather NextWeather(EWeather Current, FRandom& Random)
    {
        // Rows are the current state. The zero diagonal means the weather always changes.
        static constexpr uint32_t Weights[WeatherCount][WeatherCount] = {
            { 0, 5, 4, 1, 0, 0 },
            { 3, 0, 5, 0, 2, 0 },
            { 1, 2, 0, 2, 3, 2 },
            { 1, 0, 5, 0, 4, 0 },
            { 0, 1, 4, 2, 0, 3 },
            { 0, 1, 4, 0, 5, 0 } };
        const uint32_t* Row = Weights[Detail::Index(Current)];
        uint32_t Total = 0;
        for (int Target = 0; Target < WeatherCount; ++Target)
        {
            Total += Row[Target];
        }
        uint32_t Pick = Random.Next() % Total;
        for (int Target = 0; Target < WeatherCount; ++Target)
        {
            if (Pick < Row[Target])
            {
                return static_cast<EWeather>(Target);
            }
            Pick -= Row[Target];
        }
        return Current == EWeather::Overcast ? EWeather::Drizzle : EWeather::Overcast;
    }

    inline double HoldSeconds(EWeather State, FRandom& Random)
    {
        switch (State)
        {
        case EWeather::Breezy: return Random.Range(240.0, 480.0);
        case EWeather::Overcast: return Random.Range(300.0, 600.0);
        case EWeather::Fog: return Random.Range(180.0, 360.0);
        case EWeather::Drizzle: return Random.Range(180.0, 360.0);
        case EWeather::Rain: return Random.Range(150.0, 300.0);
        case EWeather::Clear: break;
        }
        return Random.Range(360.0, 720.0);
    }

    inline double BlendSeconds(EWeather /*From*/, EWeather /*To*/, FRandom& Random)
    {
        return Random.Range(60.0, 120.0);
    }

    // Lagarde's "wet fast, dry slow": the surface follows rain within a minute, puddles lag behind both ways.
    struct FWetness
    {
        float Surface = 0.f;
        float Puddles = 0.f;

        void Step(float Rain, float DeltaSeconds)
        {
            const float Falling = std::clamp(Rain, 0.f, 1.f);
            const float Seconds = std::max(DeltaSeconds, 0.f);
            const float SurfaceTarget = Falling > .02f ? std::min(1.f, .4f + Falling) : 0.f;
            Surface = Detail::Approach(Surface, SurfaceTarget, Seconds / 45.f, Seconds / 240.f);
            Puddles = Detail::Approach(Puddles, Falling, Seconds / 120.f, Seconds / 420.f);
        }
    };

    struct FLighting
    {
        float DayFactor = 1.f;
        float NightFactor = 0.f;
        float SunScale = 1.f;
        bool bSunActive = true;
        float MoonLux = 0.f;
        bool bMoonActive = false;
        FVec3 MoonColor{ .62f, .72f, 1.f };
        float SkyLightScale = 1.f;
        float SkyLuminanceFactor = 1.f;
        float ExposureOffset = 0.f;
        float ExposureScale = 1.f;
        float WindowGlow = 1.f;
        bool bStreetLamps = false;
        float LampCandela = 1500.f;
        float HeadlightCandela = 3500.f;
        float Saturation = 1.f;
        float Contrast = 1.f;
        float WhiteTemp = 6500.f;
        float FogBrightness = .75f;
    };

    // Clear weather with the sun above 8 degrees returns the authored scene: every multiplier 1, exposure offset 0.
    inline FLighting LightingFor(const FSun& Sun, const FWeatherLook& Look)
    {
        FLighting Light;
        Light.DayFactor = Smoothstep(-6.f, 8.f, Sun.Elevation);
        Light.NightFactor = 1.f - Smoothstep(-8.f, 2.f, Sun.Elevation);
        Light.SunScale = Look.SunVisibility * Smoothstep(-12.f, -2.f, Sun.Elevation);
        Light.bSunActive = Light.SunScale > .001f;
        Light.MoonLux = 12.f * std::sqrt(std::max(Look.SunVisibility, 0.f)) * Smoothstep(-2.f, 6.f, Sun.MoonElevation) * Light.NightFactor;
        Light.bMoonActive = Light.MoonLux > .01f;
        Light.SkyLightScale = 1.f;
        // A dim overcast sun still leaves a bright grey sky and soft ambient light.
        Light.SkyLuminanceFactor = std::clamp(Look.SkyLuminance / std::max(Look.SunVisibility, .05f), .5f, 16.f);
        const float NightOffset = -9.f;
        Light.ExposureOffset = NightOffset + (Look.ExposureOffset - NightOffset) * std::pow(Light.DayFactor, .6f);
        Light.ExposureScale = std::exp2(Light.ExposureOffset);
        Light.WindowGlow = 1.f + 11.f * std::max(Light.NightFactor, .3f * Look.Gloom);
        Light.bStreetLamps = Light.NightFactor + .25f * Look.Gloom > .5f;
        Light.Saturation = 1.f - .3f * Look.Gloom - .15f * Light.NightFactor;
        Light.Contrast = 1.f - .08f * Look.Gloom;
        Light.WhiteTemp = 6500.f - 600.f * Look.Gloom;
        Light.FogBrightness = (.35f + .4f * Light.DayFactor) * (1.f - .3f * Look.Gloom);
        return Light;
    }

    // The replicated weather segment. Every peer samples it from the server clock.
    struct FSegment
    {
        EWeather From = EWeather::Clear;
        EWeather To = EWeather::Clear;
        double Start = 0.0;
        double Blend = 0.0;
        double Hold = 0.0;
    };

    inline FWeatherLook Sample(const FSegment& Segment, double Now)
    {
        const float Alpha = Segment.Blend > 0.0 ? Smoothstep(0.f, 1.f, static_cast<float>((Now - Segment.Start) / Segment.Blend)) : 1.f;
        return Mix(LookFor(Segment.From), LookFor(Segment.To), Alpha);
    }

    // Host only. Returns true when a new segment started.
    inline bool Advance(FSegment& Segment, double Now, FRandom& Random)
    {
        if (Now < Segment.Start + Segment.Hold)
        {
            return false;
        }
        Segment.From = Segment.To;
        Segment.To = NextWeather(Segment.From, Random);
        Segment.Start = Now;
        Segment.Blend = BlendSeconds(Segment.From, Segment.To, Random);
        Segment.Hold = Segment.Blend + HoldSeconds(Segment.To, Random);
        return true;
    }

    // Unit (east, north) wind direction with Z = 0. It swings slowly around the authored (.94, .34).
    inline FVec3 WindDirection(double ServerSeconds)
    {
        const double Base = std::atan2(.34, .94);
        const double Angle = Base
            + .35 * std::sin(Detail::FullTurn * Detail::Wrap(ServerSeconds, 420.0) / 420.0)
            + .1 * std::sin(Detail::FullTurn * Detail::Wrap(ServerSeconds, 251.0) / 251.0);
        return FVec3{ static_cast<float>(std::cos(Angle)), static_cast<float>(std::sin(Angle)), 0.f };
    }

    // College and Bathurst is Toronto; every other map is Montréal.
    inline double LatitudeForMap(const char* MapName)
    {
        return MapName && std::strstr(MapName, "CollegeBathurst") ? 43.656 : 45.525;
    }
}
