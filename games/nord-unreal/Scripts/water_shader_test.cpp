// Standalone test for the Custom node bodies pond_water.hlsl, rain_streak.hlsl and wet_puddles.hlsl.
// Built and run by Scripts/test_water_shader.py. Each body is included as a C++ function body through
// hlsl_shim.h; the Unreal macro names are poisoned first, so the bodies cannot use them.
#include "hlsl_shim.h"

#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <initializer_list>

#pragma GCC poison PI check checkf verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER

namespace Hlsl
{
    float4 PondWater(float3 WorldPos, float3 CameraPos, float Time, float4 Shore, float Wind, float WindDirX, float WindDirY, float Rain)
    {
#include "pond_water.hlsl"
    }

    float4 RainStreak(float3 Pivot, float3 WorldPos, float3 CameraPos, float Time, float Rand, float Rain, float Wind, float WindDirX, float WindDirY)
    {
#include "rain_streak.hlsl"
    }

    float WetPuddles(float3 WorldPos, float Puddles)
    {
#include "wet_puddles.hlsl"
    }
}

using namespace Hlsl;

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

    struct FPair
    {
        float A, B;
    };

    bool Finite(float4 V)
    {
        return std::isfinite(V.x) && std::isfinite(V.y) && std::isfinite(V.z) && std::isfinite(V.w);
    }

    // Fixed generator so every compiler sees the same samples.
    struct FSamples
    {
        uint32_t State = 0x9E3779B9u;
        float Next(float Low, float High)
        {
            State ^= State << 13;
            State ^= State >> 17;
            State ^= State << 5;
            return Low + (High - Low) * static_cast<float>(State >> 8) / 16777216.f;
        }
    };

    // Camera at the given horizontal distance and 1.7 m above the water, at 7.15 cm.
    float4 Pond(float X, float Y, float CameraDistance, float Time, float ShoreR, float ShoreG, float Wind, float DirX, float DirY, float Rain)
    {
        return PondWater(float3(X, Y, 7.15f), float3(X + CameraDistance, Y, 177.15f), Time, float4(ShoreR, ShoreG, 1.f, 1.f), Wind, DirX, DirY, Rain);
    }

    double SlopeSquared(float4 V)
    {
        return static_cast<double>(V.x) * V.x + static_cast<double>(V.y) * V.y;
    }

    void PondRangeTests()
    {
        const float Centres[4][2] = { { -12000.f, 8000.f }, { 5000.f, -9000.f }, { 19500.f, -21900.f }, { -100000.f, 100000.f } };
        bool AllFinite = true;
        bool InUnit = true;
        double Steepest = 0.0;
        long Count = 0;
        for (const auto& Centre : Centres)
        {
            for (int Row = 0; Row < 5; ++Row)
            {
                for (int Column = 0; Column < 5; ++Column)
                {
                    const float X = Centre[0] + 37.f * static_cast<float>(Column);
                    const float Y = Centre[1] + 41.f * static_cast<float>(Row);
                    for (float Time : { 0.f, .37f, 13.1f, 599.9f, 1199.99f, 86400.5f, 300000.f })
                    {
                        for (float Wind : { -.4f, 0.f, .25f, .55f, 1.f, 1.7f })
                        {
                            for (const FPair& Dir : { FPair{ .94f, .34f }, FPair{ 0.f, 0.f }, FPair{ -1.f, 0.f }, FPair{ 0.f, 3.f } })
                            {
                                for (float Rain : { -.5f, 0.f, .3f, .9f, 1.f, 1.4f })
                                {
                                    for (const FPair& Shore : { FPair{ 0.f, 0.f }, FPair{ .04f, .01f }, FPair{ .3f, .06f }, FPair{ 1.f, 1.f } })
                                    {
                                        for (float Camera : { 0.f, 4000.f, 9000.f })
                                        {
                                            const float4 V = Pond(X, Y, Camera, Time, Shore.A, Shore.B, Wind, Dir.A, Dir.B, Rain);
                                            AllFinite = AllFinite && Finite(V);
                                            InUnit = InUnit && V.z >= 0.f && V.z <= 1.f && V.w >= 0.f && V.w <= 1.f;
                                            Steepest = std::fmax(Steepest, std::sqrt(SlopeSquared(V)));
                                            ++Count;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Expect(AllFinite, "every pond output is finite over %ld samples", Count);
        Expect(InUnit, "foam and depth stay in [0, 1]");
        Expect(Steepest <= .24 + 1e-5, "total slope stays at or below .24, got %.6f", Steepest);
        Expect(1.0 / std::sqrt(1.0 + Steepest * Steepest) >= .97, "normal z stays at or above .97");
        std::printf("pond: %ld samples, steepest slope %.4f, lowest normal z %.4f\n", Count, Steepest, 1.0 / std::sqrt(1.0 + Steepest * Steepest));
    }

    void PondShoreTests()
    {
        bool FarClear = true;
        double NearFoam = 0.0;
        double NearMax = 0.0;
        int NearCount = 0;
        int Gaps = 0;
        int Solid = 0;
        for (int Step = 0; Step <= 300; ++Step)
        {
            const float Distance = 2.f * static_cast<float>(Step);
            for (int Sample = 0; Sample < 120; ++Sample)
            {
                const float X = -15000.f + 23.f * static_cast<float>(Sample);
                const float Y = 9000.f + 7.f * static_cast<float>(Sample % 13);
                const float4 V = Pond(X, Y, 300.f, 41.f + static_cast<float>(Sample % 5) * 97.f, Distance / 600.f, Distance / 3000.f, .5f, .94f, .34f, 0.f);
                if (Distance >= 60.f)
                {
                    FarClear = FarClear && V.z == 0.f;
                }
                else if (Distance < 20.f)
                {
                    NearFoam += V.z;
                    NearMax = std::fmax(NearMax, V.z);
                    ++NearCount;
                    Gaps += V.z < .05f;
                    Solid += V.z > .95f;
                }
            }
        }
        const double Mean = NearFoam / NearCount;
        Expect(FarClear, "no foam 60 cm or more from the shore");
        Expect(NearMax > .95, "foam reaches full strength at the bank, max %.3f", NearMax);
        Expect(Mean > .2 && Mean < .9, "foam inside 20 cm is broken, mean %.3f", Mean);
        Expect(Gaps > NearCount / 10 && Solid > NearCount / 10, "the foam line has gaps (%d) and solid runs (%d) of %d", Gaps, Solid, NearCount);

        float Previous = -1.f;
        bool Monotonic = true;
        for (int Step = 0; Step <= 255; ++Step)
        {
            const float G = static_cast<float>(Step) / 255.f;
            const float Depth = Pond(-9000.f, 7000.f, 500.f, 3.f, std::fmin(G * 5.f, 1.f), G, .3f, .94f, .34f, 0.f).w;
            Monotonic = Monotonic && Depth >= Previous;
            Previous = Depth;
            if (Step == 0)
            {
                Expect(Depth == 0.f, "depth is 0 at the shore, got %.6f", Depth);
            }
            if (G * 3000.f >= 1200.f)
            {
                Expect(Depth == 1.f, "depth is 1 from 12 m inward, got %.6f at %.0f cm", Depth, G * 3000.f);
            }
        }
        Expect(Monotonic, "depth never decreases away from the shore");
        std::printf("shore: foam inside 20 cm mean %.3f, gaps %d, solid %d of %d\n", Mean, Gaps, Solid, NearCount);
    }

    // Mean squared slope that rain adds over a 4 m patch at several times.
    double RingEnergy(float Rain, float ShoreR, float Camera)
    {
        double Sum = 0.0;
        int Count = 0;
        for (float Time : { 1.3f, 2.9f, 17.45f, 400.2f, 1100.7f, 50000.3f })
        {
            for (int Row = 0; Row < 100; ++Row)
            {
                for (int Column = 0; Column < 100; ++Column)
                {
                    const float X = -11000.f + 4.f * static_cast<float>(Column);
                    const float Y = 6000.f + 4.f * static_cast<float>(Row);
                    const float4 Dry = Pond(X, Y, Camera, Time, ShoreR, 1.f, 0.f, .94f, .34f, 0.f);
                    const float4 Wet = Pond(X, Y, Camera, Time, ShoreR, 1.f, 0.f, .94f, .34f, Rain);
                    const double DX = static_cast<double>(Wet.x) - Dry.x;
                    const double DY = static_cast<double>(Wet.y) - Dry.y;
                    Sum += DX * DX + DY * DY;
                    ++Count;
                }
            }
        }
        return Sum / Count;
    }

    void PondRainTests()
    {
        Expect(RingEnergy(0.f, 1.f, 300.f) == 0.0, "no rings without rain");
        Expect(RingEnergy(-.3f, 1.f, 300.f) == 0.0, "no rings for negative rain");
        double Previous = 0.0;
        for (float Rain : { .05f, .3f, .6f, .9f, 1.f })
        {
            const double Energy = RingEnergy(Rain, 1.f, 300.f);
            Expect(Energy > Previous, "rings grow with rain: %.3g at %.2f after %.3g", Energy, Rain, Previous);
            std::printf("rain %.2f: ring slope energy %.3g\n", Rain, Energy);
            Previous = Energy;
        }
        Expect(RingEnergy(1.4f, 1.f, 300.f) == RingEnergy(1.f, 1.f, 300.f), "rain above 1 saturates");
        Expect(RingEnergy(.9f, 0.f, 300.f) == 0.0, "no rings at the bank");
        const double Bank = RingEnergy(.9f, 75.f / 600.f, 300.f);
        const double Open = RingEnergy(.9f, 1.f, 300.f);
        Expect(Bank > 0.0 && Bank < Open * .9, "rings are damped 75 cm from the shore: %.3g of %.3g", Bank, Open);
        Expect(RingEnergy(.9f, 1.f, 7000.f) == 0.0, "rings are gone 70 m from the camera");
        Expect(RingEnergy(.9f, 1.f, 4000.f) < Open, "rings fade between 25 m and 60 m");
    }

    // Second difference along the wind at 5 cm steps measures the short-wave detail.
    double DetailEnergy(float Camera)
    {
        double Sum = 0.0;
        int Count = 0;
        for (float Time : { .5f, 9.7f, 123.4f, 777.7f })
        {
            for (int Step = 0; Step < 2000; ++Step)
            {
                const float X = -16000.f + 5.f * static_cast<float>(Step);
                const float4 A = Pond(X - 5.f, 4000.f, Camera, Time, 1.f, 1.f, 1.f, 1.f, 0.f, 0.f);
                const float4 B = Pond(X, 4000.f, Camera, Time, 1.f, 1.f, 1.f, 1.f, 0.f, 0.f);
                const float4 C = Pond(X + 5.f, 4000.f, Camera, Time, 1.f, 1.f, 1.f, 1.f, 0.f, 0.f);
                const double DX = static_cast<double>(A.x) - 2.0 * B.x + C.x;
                const double DY = static_cast<double>(A.y) - 2.0 * B.y + C.y;
                Sum += DX * DX + DY * DY;
                ++Count;
            }
        }
        return Sum / Count;
    }

    void PondDetailTests()
    {
        const double Close = DetailEnergy(0.f);
        const double Twenty = DetailEnergy(2000.f);
        const double Forty = DetailEnergy(4000.f);
        const double Seventy = DetailEnergy(7000.f);
        const double Far = DetailEnergy(20000.f);
        Expect(Twenty == Close, "full detail within 25 m");
        Expect(Forty < Twenty && Forty > Seventy, "detail fades between 25 m and 60 m");
        Expect(Far == Seventy, "only long waves remain beyond 60 m");
        Expect(Seventy < .25 * Close, "short waves carry most of the fine detail: %.3g of %.3g", Seventy, Close);
        std::printf("detail energy: 0 m %.3g, 20 m %.3g, 40 m %.3g, 70 m %.3g\n", Close, Twenty, Forty, Seventy);
    }

    void PondMotionTests()
    {
        double Largest = 0.0;
        double Seam = 0.0;
        for (int Sample = 0; Sample < 400; ++Sample)
        {
            const float X = -14000.f + 13.f * static_cast<float>(Sample);
            const float Y = 5000.f + 3.f * static_cast<float>(Sample % 17);
            for (float Time : { 3.25f, 100.5f, 640.125f })
            {
                const float4 A = Pond(X, Y, 500.f, Time, 1.f, 1.f, .8f, .94f, .34f, .9f);
                const float4 B = Pond(X, Y, 500.f, Time + 1200.f, 1.f, 1.f, .8f, .94f, .34f, .9f);
                Largest = std::fmax(Largest, std::sqrt(SlopeSquared(float4(A.x - B.x, A.y - B.y, 0.f, 0.f))));
            }
            const float4 Before = Pond(X, Y, 500.f, 1199.999f, 1.f, 1.f, .8f, .94f, .34f, 0.f);
            const float4 After = Pond(X, Y, 500.f, 1200.001f, 1.f, 1.f, .8f, .94f, .34f, 0.f);
            Seam = std::fmax(Seam, std::sqrt(SlopeSquared(float4(Before.x - After.x, Before.y - After.y, 0.f, 0.f))));
        }
        Expect(Largest < 2e-3, "the surface repeats after 1200 s, largest gap %.2g", Largest);
        Expect(Seam < 1e-2, "no jump where the time wraps, gap %.2g", Seam);

        // Ripples line up with the wind: the principal axis of the slope vectors follows it.
        for (const FPair& Dir : { FPair{ .94f, .34f }, FPair{ -.2f, .98f }, FPair{ -.7f, -.7f } })
        {
            double XX = 0.0, YY = 0.0, XY = 0.0;
            for (int Row = 0; Row < 80; ++Row)
            {
                for (int Column = 0; Column < 80; ++Column)
                {
                    for (float Time : { 2.f, 31.f, 250.f })
                    {
                        const float4 V = Pond(-13000.f + 7.f * static_cast<float>(Column), 7000.f + 7.f * static_cast<float>(Row), 500.f, Time, 1.f, 1.f, 1.f, Dir.A, Dir.B, 0.f);
                        XX += static_cast<double>(V.x) * V.x;
                        YY += static_cast<double>(V.y) * V.y;
                        XY += static_cast<double>(V.x) * V.y;
                    }
                }
            }
            const double Axis = .5 * std::atan2(2.0 * XY, XX - YY);
            double Gap = std::fmod(std::fabs(Axis - std::atan2(static_cast<double>(Dir.B), static_cast<double>(Dir.A))), 3.14159265358979);
            Gap = std::fmin(Gap, 3.14159265358979 - Gap);
            Expect(Gap < .44, "ripples follow wind (%.2f, %.2f): axis off by %.1f degrees", static_cast<double>(Dir.A), static_cast<double>(Dir.B), Gap * 57.2958);
        }

        double Calm = 0.0, Windy = 0.0;
        for (int Sample = 0; Sample < 3000; ++Sample)
        {
            const float X = 2000.f + 11.f * static_cast<float>(Sample);
            const float Y = -8000.f + 5.f * static_cast<float>(Sample % 31);
            Calm += SlopeSquared(Pond(X, Y, 500.f, 77.f, 1.f, 1.f, 0.f, .94f, .34f, 0.f));
            Windy += SlopeSquared(Pond(X, Y, 500.f, 77.f, 1.f, 1.f, 1.f, .94f, .34f, 0.f));
        }
        Calm = std::sqrt(Calm / 3000.0);
        Windy = std::sqrt(Windy / 3000.0);
        Expect(Calm > .005 && Calm < .5 * Windy, "calm water keeps faint ripples: rms %.4f calm, %.4f windy", Calm, Windy);
        Expect(Windy > .04, "wind roughens the pond, rms %.4f", Windy);
        std::printf("motion: repeat gap %.2g, wrap seam %.2g, rms slope calm %.4f windy %.4f\n", Largest, Seam, Calm, Windy);
    }

    const float3 Box(2000.f, 2000.f, 1200.f);

    void StreakTests()
    {
        FSamples Random;
        bool AllFinite = true;
        bool Inside = true;
        bool Rigid = true;
        bool Linear = true;
        bool Upright = true;
        bool Periodic = true;
        bool Falling = true;
        double WorstInside = 0.0;
        double WorstPeriod = 0.0;
        for (int Sample = 0; Sample < 200000; ++Sample)
        {
            const float3 Pivot(Random.Next(-2.0e5f, 2.0e5f), Random.Next(-2.0e5f, 2.0e5f), Random.Next(-500.f, 3000.f));
            const float3 Camera(Random.Next(-5.0e4f, 5.0e4f), Random.Next(-5.0e4f, 5.0e4f), Random.Next(100.f, 400.f));
            const float Time = Sample % 7 == 0 ? Random.Next(0.f, 3.0e5f) : Random.Next(0.f, 1200.f);
            const float Rand = Random.Next(0.f, 1.f);
            const float Rain = Random.Next(-.2f, 1.2f);
            const float Wind = Sample % 5 == 0 ? 0.f : Random.Next(-.2f, 1.4f);
            const float DirX = Random.Next(-1.f, 1.f);
            const float DirY = Random.Next(-1.f, 1.f);
            const float4 Centre = RainStreak(Pivot, Pivot, Camera, Time, Rand, Rain, Wind, DirX, DirY);
            AllFinite = AllFinite && Finite(Centre);
            for (double Gap : { std::fabs(Pivot.x + Centre.x - Camera.x) - 1000.0, std::fabs(Pivot.y + Centre.y - Camera.y) - 1000.0, std::fabs(Pivot.z + Centre.z - Camera.z) - 600.0 })
            {
                WorstInside = std::fmax(WorstInside, Gap);
                Inside = Inside && Gap <= .05;
            }
            // The quad corners of a 3 cm x 120 cm streak share the offset up to the slant.
            const float4 Top = RainStreak(Pivot, Pivot + float3(1.5f, -.4f, 60.f), Camera, Time, Rand, Rain, Wind, DirX, DirY);
            const float4 TopOther = RainStreak(Pivot, Pivot + float3(-1.5f, .4f, 60.f), Camera, Time, Rand, Rain, Wind, DirX, DirY);
            const float4 Bottom = RainStreak(Pivot, Pivot + float3(-1.5f, .4f, -60.f), Camera, Time, Rand, Rain, Wind, DirX, DirY);
            Rigid = Rigid && Top.z == Centre.z && Bottom.z == Centre.z && Top.w == Centre.w && Bottom.w == Centre.w;
            Rigid = Rigid && Top.x == TopOther.x && Top.y == TopOther.y;
            // Far pivots give offsets of several kilometres; allow a few float steps of that size.
            const float Step = 4.f * 1.2e-7f * std::fmax(std::fabs(Centre.x), std::fabs(Centre.y)) + 1e-4f;
            Linear = Linear && std::fabs((Top.x - Centre.x) + (Bottom.x - Centre.x)) < Step && std::fabs((Top.y - Centre.y) + (Bottom.y - Centre.y)) < Step;
            if (Wind <= 0.f)
            {
                Upright = Upright && Top.x == Centre.x && Top.y == Centre.y && Bottom.x == Centre.x && Bottom.y == Centre.y;
            }
            // Moving the component by whole boxes keeps every streak where it was.
            const float Steps[3] = { static_cast<float>(Sample % 3 - 1), static_cast<float>(Sample % 5 - 2), static_cast<float>(Sample % 2) };
            const float3 Moved = Pivot + float3(Steps[0] * Box.x, Steps[1] * Box.y, Steps[2] * Box.z);
            const float4 Shifted = RainStreak(Moved, Moved, Camera, Time, Rand, Rain, Wind, DirX, DirY);
            for (double Gap : { std::fabs((Moved.x + Shifted.x) - (Pivot.x + Centre.x)), std::fabs((Moved.y + Shifted.y) - (Pivot.y + Centre.y)), std::fabs((Moved.z + Shifted.z) - (Pivot.z + Centre.z)) })
            {
                // A wrap boundary may land on either face; both are the same streak position modulo the box.
                const double Wrapped = std::fmin(Gap, std::fabs(Gap - 2000.0));
                WorstPeriod = std::fmax(WorstPeriod, std::fmin(Wrapped, std::fabs(Gap - 1200.0)));
                Periodic = Periodic && std::fmin(Wrapped, std::fabs(Gap - 1200.0)) < .1;
            }
            Periodic = Periodic && std::fabs(Shifted.w - Centre.w) < 1e-3f;
            if (Time < 1199.f)
            {
                const float4 Later = RainStreak(Pivot, Pivot, Camera, Time + .01f, Rand, Rain, Wind, DirX, DirY);
                const float Drop = Later.z - Centre.z;
                if (std::fabs(Drop) < 100.f)
                {
                    Falling = Falling && Drop <= -6.75f * .99f && Drop >= -11.25f * 1.01f;
                }
            }
        }
        Expect(AllFinite, "every streak output is finite");
        Expect(Inside, "wrapped pivots stay in the box around the camera, worst %.4f cm outside", WorstInside);
        Expect(Rigid, "every vertex of a streak shares its offset and mask except for the slant");
        Expect(Linear, "the slant is linear in vertex height");
        Expect(Upright, "without wind the streaks stay upright");
        Expect(Periodic, "the wrap repeats every box, worst %.4f cm", WorstPeriod);
        Expect(Falling, "drops fall at 900 cm/s within 25%%");
        std::printf("streaks: worst box gap %.4f cm, worst period gap %.4f cm\n", WorstInside, WorstPeriod);

        int VisibleLight = 0, VisibleHeavy = 0, VisibleNone = 0;
        bool Unit = true;
        for (int Instance = 0; Instance < 2000; ++Instance)
        {
            const float Rand = (static_cast<float>(Instance) + .5f) / 2000.f;
            const float3 Camera(1234.f, -5678.f, 170.f);
            for (float Rain : { 0.f, .3f, .9f })
            {
                // A pivot that wraps to the middle of the box is clear of the face fade.
                const float4 V = RainStreak(Camera, Camera, Camera, 0.f, Rand, Rain, .5f, .94f, .34f);
                Unit = Unit && V.w >= 0.f && V.w <= 1.f;
                const bool Shown = V.w > .5f;
                VisibleNone += Rain == 0.f && V.w > 0.f;
                VisibleLight += Rain == .3f && Shown;
                VisibleHeavy += Rain == .9f && Shown;
            }
        }
        Expect(Unit, "the visible-instance mask stays in [0, 1]");
        Expect(VisibleNone == 0, "no streaks without rain");
        Expect(VisibleLight > 500 && VisibleLight < 700, "drizzle shows about 30%% of the streaks, got %d", VisibleLight);
        Expect(VisibleHeavy > 1600 && VisibleHeavy < 1800, "rain shows about 90%% of the streaks, got %d", VisibleHeavy);
        const float3 Camera(0.f, 0.f, 170.f);
        const float4 Edge = RainStreak(float3(999.9f, 0.f, 170.f), float3(999.9f, 0.f, 170.f), Camera, 0.f, .1f, 1.f, 0.f, 1.f, 0.f);
        Expect(Edge.w < .01f, "streaks fade at the box faces, mask %.3f", static_cast<double>(Edge.w));
    }

    void PuddleTests()
    {
        int Wet = 0;
        int Count = 0;
        bool Unit = true;
        bool Dry = true;
        bool Linear = true;
        double Jump = 0.0;
        for (int Row = 0; Row < 300; ++Row)
        {
            for (int Column = 0; Column < 300; ++Column)
            {
                const float3 Position(-15000.f + 100.f * static_cast<float>(Column), -15000.f + 100.f * static_cast<float>(Row), 0.f);
                const float Mask = WetPuddles(Position, 1.f);
                Unit = Unit && Mask >= 0.f && Mask <= 1.f;
                Dry = Dry && WetPuddles(Position, 0.f) == 0.f;
                Linear = Linear && std::fabs(WetPuddles(Position, .5f) - .5f * Mask) < 1e-6f;
                Jump = std::fmax(Jump, std::fabs(static_cast<double>(WetPuddles(Position + float3(1.f, 0.f, 0.f), 1.f)) - Mask));
                Wet += Mask > .5f;
                ++Count;
            }
        }
        const double Share = static_cast<double>(Wet) / Count;
        Expect(Unit, "the puddle mask stays in [0, 1]");
        Expect(Dry, "no puddles when Puddles is 0");
        Expect(Linear, "the mask scales with Puddles");
        Expect(Share > .05 && Share < .45, "puddles cover part of the ground, %.1f%%", 100.0 * Share);
        Expect(Jump < .1, "puddle edges are soft, largest 1 cm step %.3f", Jump);
        std::printf("puddles: %.1f%% of the ground at full puddles, largest 1 cm step %.3f\n", 100.0 * Share, Jump);
    }
}

int main()
{
    PondRangeTests();
    PondShoreTests();
    PondRainTests();
    PondDetailTests();
    PondMotionTests();
    StreakTests();
    PuddleTests();
    if (Failures)
    {
        std::fprintf(stderr, "%d of %d assertions failed\n", Failures, Assertions);
        return 1;
    }
    std::printf("NORD_WATER_SHADER_OK %d assertions\n", Assertions);
    return 0;
}
