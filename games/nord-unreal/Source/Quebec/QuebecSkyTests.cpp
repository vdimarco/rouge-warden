#include "CoreMinimal.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "LaFontaineLamps.h"
#include "Misc/AutomationTest.h"
#include "QuebecSkyModel.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecSkyClockTest, "Quebec.Sky.Clock", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecSkyClockTest::RunTest(const FString& Parameters)
{
    const QuebecSky::FClock Clock;
    for (double Wanted : {0., 4.5, 5., 12.67, 15., 20.99, 21., 23.75})
        TestEqual(*FString::Printf(TEXT("Hour %.2f survives the cycle round trip"), Wanted), QuebecSky::HourAtCycle(QuebecSky::CycleForHour(Wanted)), Wanted, 1e-9);
    const double Offset = QuebecSky::CycleForHour(15.);
    TestEqual(TEXT("The offset starts the clock at 15:00"), QuebecSky::HourAtTime(0., Offset, Clock), 15., 1e-9);
    TestEqual(TEXT("A full day takes 40 real minutes"), QuebecSky::HourAtTime(Clock.CycleSeconds, Offset, Clock), 15., 1e-6);
    // Night (21:00 to 05:00) passes twice as fast as day: 8 hours in a fifth of the cycle.
    const double NightSeconds = (QuebecSky::CycleForHour(5.) + 1. - QuebecSky::CycleForHour(21.)) * Clock.CycleSeconds;
    const double DaySeconds = (QuebecSky::CycleForHour(21.) - QuebecSky::CycleForHour(5.)) * Clock.CycleSeconds;
    TestEqual(TEXT("Night lasts 480 real seconds"), NightSeconds, 480., 1e-6);
    TestEqual(TEXT("Day lasts 1920 real seconds"), DaySeconds, 1920., 1e-6);
    TestEqual(TEXT("A night hour is twice as fast as a day hour"), (DaySeconds / 16.) / (NightSeconds / 8.), 2., 1e-9);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecSkyWeatherChainTest, "Quebec.Sky.WeatherChain", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecSkyWeatherChainTest::RunTest(const FString& Parameters)
{
    QuebecSky::EWeather Parsed = QuebecSky::EWeather::Clear;
    TestTrue(TEXT("Weather names parse without case"), QuebecSky::ParseWeather("rAiN", Parsed) && Parsed == QuebecSky::EWeather::Rain);
    TestFalse(TEXT("Unknown weather is refused"), QuebecSky::ParseWeather("snow", Parsed));

    QuebecSky::FRandom Random(2026);
    QuebecSky::FSegment Segment;
    Segment.Hold = QuebecSky::HoldSeconds(Segment.To, Random);
    double Now = 0., Gloomy = 0.;
    int32 Changes = 0;
    bool bAlwaysChanged = true, bBlendInRange = true;
    // Six simulated hours in one-second steps.
    for (int32 Second = 0; Second < 6 * 3600; ++Second, Now += 1.)
    {
        const QuebecSky::EWeather Before = Segment.To;
        if (QuebecSky::Advance(Segment, Now, Random))
        {
            ++Changes;
            bAlwaysChanged &= Segment.To != Before;
            bBlendInRange &= Segment.Blend >= 60. && Segment.Blend <= 120.;
        }
        Gloomy += Segment.To >= QuebecSky::EWeather::Overcast ? 1. : 0.;
    }
    TestTrue(TEXT("The weather changes several times in six hours"), Changes >= 20);
    TestTrue(TEXT("A new segment never repeats the weather"), bAlwaysChanged);
    TestTrue(TEXT("Blends last one to two minutes"), bBlendInRange);
    TestTrue(TEXT("Overcast, fog, drizzle or rain hold at least half of the time"), Gloomy / Now >= .5);

    QuebecSky::FSegment Blend;
    Blend.From = QuebecSky::EWeather::Clear;
    Blend.To = QuebecSky::EWeather::Rain;
    Blend.Start = 100.;
    Blend.Blend = 80.;
    Blend.Hold = 400.;
    TestEqual(TEXT("A blend starts at the old look"), QuebecSky::Sample(Blend, 100.).Rain, 0.f, 1e-6f);
    TestEqual(TEXT("A blend ends at the new look"), QuebecSky::Sample(Blend, 180.).Rain, QuebecSky::LookFor(QuebecSky::EWeather::Rain).Rain, 1e-6f);
    TestFalse(TEXT("The weather holds until its hold time"), QuebecSky::Advance(Blend, 499., Random));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecSkyAuthoredDayTest, "Quebec.Sky.AuthoredDay", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecSkyAuthoredDayTest::RunTest(const FString& Parameters)
{
    // The clear afternoon keeps the saved light levels: every multiplier 1 and no exposure offset. The sun's direction
    // follows the clock (south-west at 15:00), not the saved north-west sun, so lit facades and shadows differ.
    const QuebecSky::FSun Sun = QuebecSky::SunAt(15.);
    const QuebecSky::FLighting Light = QuebecSky::LightingFor(Sun, QuebecSky::FWeatherLook());
    TestTrue(TEXT("The 15:00 sun is high in the south-west"), Sun.Elevation > 20.f && Sun.Azimuth > 180.f && Sun.Azimuth < 270.f);
    TestEqual(TEXT("Sun scale"), Light.SunScale, 1.f, 1e-6f);
    TestEqual(TEXT("Sky light scale"), Light.SkyLightScale, 1.f, 1e-6f);
    TestEqual(TEXT("Sky luminance factor"), Light.SkyLuminanceFactor, 1.f, 1e-6f);
    TestEqual(TEXT("Exposure offset"), Light.ExposureOffset, 0.f, 1e-5f);
    TestEqual(TEXT("Window glow"), Light.WindowGlow, 1.f, 1e-6f);
    TestEqual(TEXT("Saturation"), Light.Saturation, 1.f, 1e-6f);
    TestEqual(TEXT("Contrast"), Light.Contrast, 1.f, 1e-6f);
    TestEqual(TEXT("White temperature"), Light.WhiteTemp, 6500.f, 1e-3f);
    TestFalse(TEXT("Street lamps stay off"), Light.bStreetLamps);
    TestFalse(TEXT("Headlights stay off"), Light.bHeadlights);
    TestFalse(TEXT("The moon is dark"), Light.bMoonActive);
    // Overcast dims the sun and the exposure but keeps a bright grey sky.
    const QuebecSky::FLighting Grey = QuebecSky::LightingFor(Sun, QuebecSky::LookFor(QuebecSky::EWeather::Overcast));
    TestTrue(TEXT("Overcast is darker and muted"), Grey.SunScale < .2f && Grey.ExposureOffset < -1.f && Grey.Saturation < 1.f);
    TestTrue(TEXT("Overcast sky stays bright"), Grey.SkyLuminanceFactor > 4.f);
    TestFalse(TEXT("Overcast alone leaves headlights off"), Grey.bHeadlights);
    const QuebecSky::FLighting Wet = QuebecSky::LightingFor(Sun, QuebecSky::LookFor(QuebecSky::EWeather::Rain));
    TestTrue(TEXT("Rain turns headlights on by day, not street lamps"), Wet.bHeadlights && !Wet.bStreetLamps);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecSkyNightTest, "Quebec.Sky.Night", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecSkyNightTest::RunTest(const FString& Parameters)
{
    TestTrue(TEXT("Montreal sunrise is near 07:10"), QuebecSky::SunAt(7.).Elevation < -.833f && QuebecSky::SunAt(7.25).Elevation > -.833f);
    TestTrue(TEXT("Montreal sunset is near 18:10"), QuebecSky::SunAt(18.).Elevation > -.833f && QuebecSky::SunAt(18.25).Elevation < -.833f);
    const QuebecSky::FLighting Clear = QuebecSky::LightingFor(QuebecSky::SunAt(0.), QuebecSky::FWeatherLook());
    TestFalse(TEXT("No sun at midnight"), Clear.bSunActive);
    TestTrue(TEXT("The moon lights a clear midnight"), Clear.bMoonActive && Clear.MoonLux > 10.f);
    TestEqual(TEXT("Night exposure is EV100 3.5"), Clear.ExposureOffset, -9.f, 1e-4f);
    TestTrue(TEXT("Street lamps and windows are on"), Clear.bStreetLamps && Clear.WindowGlow > 11.f);
    const QuebecSky::FLighting Wet = QuebecSky::LightingFor(QuebecSky::SunAt(0.), QuebecSky::LookFor(QuebecSky::EWeather::Rain));
    TestTrue(TEXT("Rain hides most of the moonlight"), Wet.MoonLux < Clear.MoonLux * .5f && Wet.MoonLux > 0.f);
    TestTrue(TEXT("A rainy night sky is darker than a clear one"), Wet.SkyLuminanceFactor * Wet.MoonLux < Clear.SkyLuminanceFactor * Clear.MoonLux);
    TestTrue(TEXT("The moonlit night sky is dimmed"), Clear.SkyLuminanceFactor < .5f);
    // Toronto keeps its own solar noon, about 23 minutes after Montreal's.
    const double TorontoNoon = QuebecSky::SolarNoonForMap("/Game/Maps/CollegeBathurst");
    const double TorontoLatitude = QuebecSky::LatitudeForMap("/Game/Maps/CollegeBathurst");
    TestTrue(TEXT("Toronto sunset is near 18:36"), QuebecSky::SunAt(18.5, 288, TorontoLatitude, TorontoNoon).Elevation > -.833f
        && QuebecSky::SunAt(18.75, 288, TorontoLatitude, TorontoNoon).Elevation < -.833f);
    // The worklight scale used by AQuebecSky::LightScale: full by day, never below 3% at night.
    TestEqual(TEXT("Night worklight scale"), FMath::Clamp(8.f * Clear.ExposureScale, .03f, 1.f), .03f, 1e-6f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecSkyLampDataTest, "Quebec.Sky.LampData", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecSkyLampDataTest::RunTest(const FString& Parameters)
{
    TestTrue(TEXT("The OSM street lamps are generated"), UE_ARRAY_COUNT(LaFontaine::StreetLamps) > 200);
    bool bUnderHeads = true;
    for (const FVector& Lamp : LaFontaine::StreetLamps) bUnderHeads &= Lamp.Z == 440.;
    TestTrue(TEXT("Every lamp light sits at 440 cm, under its head and below the comic globe"), bUnderHeads);
    return true;
}
#endif
