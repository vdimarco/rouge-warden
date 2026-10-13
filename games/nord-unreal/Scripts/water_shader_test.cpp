// Standalone test for the Custom node bodies pond_water.hlsl, rain_streak.hlsl and wet_puddles.hlsl.
// Built and run by Scripts/test_water_shader.py. Each body is included as a C++ function body through
// hlsl_shim.h; the Unreal macro names are poisoned first, so the bodies cannot use them.
#include "hlsl_shim.h"

#include <algorithm>
#include <cmath>
#include <complex>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <initializer_list>
#include <vector>

#pragma GCC poison PI check checkf verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER

// test_water_shader.py passes plateau_atmosphere.RAIN_MAX_OFFSET, the authored M_NordRain value.
#ifndef NORD_RAIN_MAX_OFFSET
#error "Build with -DNORD_RAIN_MAX_OFFSET=<plateau_atmosphere.RAIN_MAX_OFFSET>"
#endif

namespace Hlsl
{
    float4 PondWater(float3 WorldPos, float3 WorldDX, float3 WorldDY, float Time, float4 Shore, float Wind, float WindDirX, float WindDirY, float Rain)
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

    const float3 Still(0.f, 0.f, 0.f);

    // Pond sample with the given screen-pixel footprint on the water (DDX and DDY of world position).
    float4 Pond(float X, float Y, float3 PixelX, float3 PixelY, float Time, float ShoreR, float ShoreG, float Wind, float DirX, float DirY, float Rain)
    {
        return PondWater(float3(X, Y, 7.15f), PixelX, PixelY, Time, float4(ShoreR, ShoreG, 1.f, 1.f), Wind, DirX, DirY, Rain);
    }

    // A square pixel of the given size on the water.
    float4 PondSquare(float X, float Y, float Pixel, float Time, float ShoreR, float Wind, float DirX, float DirY, float Rain)
    {
        return Pond(X, Y, float3(Pixel, 0.f, 0.f), float3(0.f, Pixel, 0.f), Time, ShoreR, 1.f, Wind, DirX, DirY, Rain);
    }

    double SlopeSquared(float4 V)
    {
        return static_cast<double>(V.x) * V.x + static_cast<double>(V.y) * V.y;
    }

    double Smooth(double A, double B, double V)
    {
        const double T = std::fmin(std::fmax((V - A) / (B - A), 0.0), 1.0);
        return T * T * (3.0 - 2.0 * T);
    }

    // The documented roughness of open water before any wave fades: clamp(.035 + .05 Wind + .08 Rain, .03, .17).
    double BaseRoughness(double Wind, double Rain)
    {
        return std::fmin(std::fmax(.035 + .05 * Wind + .08 * Rain, .03), .17);
    }

    // Pixel footprint of a pinhole camera at Eye looking straight at a point on the water: the world
    // positions under the neighbouring pixels to the right and below, as DDX and DDY would give them.
    struct FPixel
    {
        float3 X, Y;
    };

    FPixel PixelAt(double EyeX, double EyeY, double EyeZ, double X, double Y, double Z, double Width, double FovDegrees)
    {
        const double Step = 2.0 * std::tan(FovDegrees * 3.14159265358979 / 360.0) / Width;
        double F[3] = { X - EyeX, Y - EyeY, Z - EyeZ };
        const double Length = std::sqrt(F[0] * F[0] + F[1] * F[1] + F[2] * F[2]);
        for (double& C : F) C /= Length;
        double R[3] = { F[1], -F[0], 0.0 };
        const double RL = std::sqrt(R[0] * R[0] + R[1] * R[1]);
        R[0] /= RL;
        R[1] /= RL;
        const double U[3] = { R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0] };
        auto Hit = [&](const double* D, double Scale) {
            const double Ray[3] = { F[0] + Scale * D[0], F[1] + Scale * D[1], F[2] + Scale * D[2] };
            const double T = (Z - EyeZ) / Ray[2];
            return float3(static_cast<float>(EyeX + T * Ray[0] - X), static_cast<float>(EyeY + T * Ray[1] - Y), static_cast<float>(EyeZ + T * Ray[2] - Z));
        };
        return { Hit(R, Step), Hit(U, -Step) };
    }

    void PondRangeTests()
    {
        const float Centres[4][2] = { { -12000.f, 8000.f }, { 5000.f, -9000.f }, { 19500.f, -21900.f }, { -100000.f, 100000.f } };
        const FPixel Pixels[4] = { { Still, Still }, { float3(3.f, 0.f, 0.f), float3(0.f, 1.f, 0.f) },
                                   { float3(30.f, 10.f, 0.f), float3(-5.f, 40.f, 0.f) }, { float3(300.f, 0.f, 0.f), float3(0.f, 300.f, 0.f) } };
        bool AllFinite = true;
        bool InUnit = true;
        bool RoughRange = true;
        bool Capped = true;
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
                                        for (const FPixel& Pixel : Pixels)
                                        {
                                            const float4 V = Pond(X, Y, Pixel.X, Pixel.Y, Time, Shore.A, Shore.B, Wind, Dir.A, Dir.B, Rain);
                                            AllFinite = AllFinite && Finite(V);
                                            InUnit = InUnit && V.z >= 0.f && V.z <= 1.f;
                                            RoughRange = RoughRange && V.w >= .03f - 1e-6f && V.w <= .3f + 1e-6f;
                                            // Open water stays at or below .17 for the comic filter's reflection treatment.
                                            Capped = Capped && (V.z > 0.f || V.w <= .17f + 1e-6f);
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
        Expect(InUnit, "foam stays in [0, 1]");
        Expect(RoughRange, "roughness stays in [.03, .3]");
        Expect(Capped, "open water roughness stays at or below .17");
        Expect(Steepest <= .24 + 1e-5, "total slope stays at or below .24, got %.6f", Steepest);
        Expect(1.0 / std::sqrt(1.0 + Steepest * Steepest) >= .97, "normal z stays at or above .97");
        std::printf("pond: %ld samples, steepest slope %.4f, lowest normal z %.4f\n", Count, Steepest, 1.0 / std::sqrt(1.0 + Steepest * Steepest));
    }

    void PondShoreTests()
    {
        bool FarClear = true;
        bool Even = true;
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
                const float Time = 41.f + static_cast<float>(Sample % 5) * 97.f;
                const float4 V = PondSquare(X, Y, .5f, Time, Distance / 600.f, .5f, .94f, .34f, 0.f);
                if (Distance >= 35.f)
                {
                    FarClear = FarClear && V.z == 0.f;
                }
                else if (Distance < 10.f)
                {
                    NearFoam += V.z;
                    NearMax = std::fmax(NearMax, V.z);
                    ++NearCount;
                    Gaps += V.z < .05f;
                    Solid += V.z > .95f;
                }
                // Seen from far away, the broken line settles to an even half-strength band instead of shimmering.
                const float4 Far = PondSquare(X, Y, 60.f, Time, Distance / 600.f, .5f, .94f, .34f, 0.f);
                Even = Even && std::fabs(Far.z - .5 * (1.0 - Smooth(10.0, 35.0, Distance))) < 1e-4;
            }
        }
        const double Mean = NearFoam / NearCount;
        Expect(FarClear, "no foam 35 cm or more from the shore");
        Expect(NearMax > .95, "foam reaches full strength at the bank, max %.3f", NearMax);
        Expect(Mean > .2 && Mean < .9, "foam inside 10 cm is broken, mean %.3f", Mean);
        Expect(Gaps > NearCount / 10 && Solid > NearCount / 10, "the foam line has gaps (%d) and solid runs (%d) of %d", Gaps, Solid, NearCount);
        Expect(Even, "far away the foam is an even half-strength band");

        // Roughness: the documented open-water value up close, rising to .3 in foam.
        bool Documented = true;
        bool FoamRough = true;
        for (float Wind : { -.4f, 0.f, .25f, .55f, 1.f, 1.6f })
        {
            for (float Rain : { -.5f, 0.f, .3f, .9f, 1.f })
            {
                for (int Sample = 0; Sample < 40; ++Sample)
                {
                    const float X = 3000.f + 31.f * static_cast<float>(Sample);
                    const float4 Open = PondSquare(X, 2000.f, .2f, 9.f + static_cast<float>(Sample), 1.f, Wind, .94f, .34f, Rain);
                    Documented = Documented && Open.z == 0.f && std::fabs(Open.w - BaseRoughness(Wind, Rain)) < 1e-6;
                    const float4 Bank = PondSquare(X, 2000.f, .2f, 9.f + static_cast<float>(Sample), 0.f, Wind, .94f, .34f, Rain);
                    FoamRough = FoamRough && std::fabs(Bank.w - (BaseRoughness(Wind, Rain) + (.3 - BaseRoughness(Wind, Rain)) * Bank.z)) < 1e-6;
                }
            }
        }
        Expect(Documented, "up close, open water has roughness clamp(.035 + .05 Wind + .08 Rain, .03, .17)");
        Expect(FoamRough, "foam blends roughness toward .3");
        std::printf("shore: foam inside 10 cm mean %.3f, gaps %d, solid %d of %d\n", Mean, Gaps, Solid, NearCount);
    }

    // Slope that the rings add: the same point with and without the 1.5 m shore damping, which only rings use.
    float2 Rings(float X, float Y, float Pixel, float Time, float ShoreR, float Wind, float Rain)
    {
        const float4 Wet = PondSquare(X, Y, Pixel, Time, ShoreR, Wind, .94f, .34f, Rain);
        const float4 Bank = PondSquare(X, Y, Pixel, Time, 0.f, Wind, .94f, .34f, Rain);
        return float2(Wet.x - Bank.x, Wet.y - Bank.y);
    }

    // Mean squared slope that rings add over a 4 m patch at several times.
    double RingEnergy(float Rain, float ShoreR, float Pixel)
    {
        double Sum = 0.0;
        int Count = 0;
        for (float Time : { 1.3f, 2.9f, 17.45f, 400.2f, 1100.7f, 50000.3f })
        {
            for (int Row = 0; Row < 100; ++Row)
            {
                for (int Column = 0; Column < 100; ++Column)
                {
                    const float2 Ring = Rings(-11000.f + 4.f * static_cast<float>(Column), 6000.f + 4.f * static_cast<float>(Row), Pixel, Time, ShoreR, 0.f, Rain);
                    Sum += static_cast<double>(Ring.x) * Ring.x + static_cast<double>(Ring.y) * Ring.y;
                    ++Count;
                }
            }
        }
        return Sum / Count;
    }

    void PondRainTests()
    {
        Expect(RingEnergy(0.f, 1.f, 0.f) == 0.0, "no rings without rain");
        Expect(RingEnergy(-.3f, 1.f, 0.f) == 0.0, "no rings for negative rain");
        double Previous = 0.0;
        for (float Rain : { .05f, .3f, .6f, .9f, 1.f })
        {
            const double Energy = RingEnergy(Rain, 1.f, 0.f);
            Expect(Energy > Previous, "rings grow with rain: %.3g at %.2f after %.3g", Energy, Rain, Previous);
            std::printf("rain %.2f: ring slope energy %.3g\n", Rain, Energy);
            Previous = Energy;
        }
        const double Open = RingEnergy(.9f, 1.f, 0.f);
        Expect(RingEnergy(1.4f, 1.f, 0.f) == RingEnergy(1.f, 1.f, 0.f), "rain above 1 saturates");
        Expect(RingEnergy(.9f, 1.f / 600.f, 0.f) < 1e-3 * Open, "rings vanish at the bank");
        const double Bank = RingEnergy(.9f, 75.f / 600.f, 0.f);
        Expect(Bank > 0.0 && Bank < Open * .9, "rings are damped 75 cm from the shore: %.3g of %.3g", Bank, Open);
        // The ring profile repeats over about 6 cm: full while a pixel covers 1.5 cm of water, gone at 3 cm.
        Expect(RingEnergy(.9f, 1.f, 1.45f) == Open, "rings keep full strength while a pixel covers 1.45 cm");
        const double Blurred = RingEnergy(.9f, 1.f, 2.2f);
        Expect(Blurred > 0.0 && Blurred < .9 * Open, "rings fade as a pixel grows past 1.5 cm: %.3g of %.3g", Blurred, Open);
        Expect(RingEnergy(.9f, 1.f, 3.f) == 0.0, "rings are gone once a pixel covers 3 cm");

        // In the rain look (wind .8, rain .9) rings stand out against the wind ripples, which rain damps.
        // Rings read where their slope beats the ripples' slope change over a ring's width (6 cm).
        double RingPeak = 0.0, Ripples = 0.0, DryRipples = 0.0;
        std::vector<double> RingSlopes;
        int Count = 0;
        for (float Time : { 1.3f, 2.9f, 17.45f, 400.2f })
        {
            for (int Row = 0; Row < 100; ++Row)
            {
                for (int Column = 0; Column < 100; ++Column)
                {
                    const float X = -11000.f + 4.f * static_cast<float>(Column);
                    const float Y = 6000.f + 4.f * static_cast<float>(Row);
                    const float2 Ring = Rings(X, Y, 0.f, Time, 1.f, .8f, .9f);
                    const double Size = std::sqrt(static_cast<double>(Ring.x) * Ring.x + static_cast<double>(Ring.y) * Ring.y);
                    RingPeak = std::fmax(RingPeak, Size);
                    if (Size > 1e-6)
                    {
                        RingSlopes.push_back(Size);
                    }
                    const float Angle = .7f * static_cast<float>(Row * 100 + Column);
                    const float StepX = 6.f * std::cos(Angle), StepY = 6.f * std::sin(Angle);
                    for (float Rain : { .9f, 0.f })
                    {
                        const float4 A = PondSquare(X, Y, 0.f, Time, 0.f, .8f, .94f, .34f, Rain);
                        const float4 B = PondSquare(X + StepX, Y + StepY, 0.f, Time, 0.f, .8f, .94f, .34f, Rain);
                        (Rain > 0.f ? Ripples : DryRipples) += SlopeSquared(float4(A.x - B.x, A.y - B.y, 0.f, 0.f));
                    }
                    ++Count;
                }
            }
        }
        Ripples = std::sqrt(Ripples / Count);
        DryRipples = std::sqrt(DryRipples / Count);
        std::sort(RingSlopes.begin(), RingSlopes.end());
        const double RingCrest = RingSlopes[RingSlopes.size() * 9 / 10];
        Expect(Ripples < .75 * DryRipples, "rain damps the short wind ripples: 6 cm slope change %.4f in rain, %.4f dry", Ripples, DryRipples);
        Expect(RingPeak > .09, "ring crests reach a slope of .09 or more, got %.4f", RingPeak);
        Expect(RingCrest > 2.0 * Ripples, "the steepest tenth of ring slopes (%.4f) is over twice the ripples' 6 cm slope change (%.4f)", RingCrest, Ripples);
        std::printf("rain look: ring peak %.4f, 90th percentile %.4f; ripple 6 cm slope change %.4f in rain, %.4f dry\n", RingPeak, RingCrest, Ripples, DryRipples);
    }

    // In-place radix-2 FFT; the size must be a power of two.
    void Fft(std::vector<std::complex<double>>& A)
    {
        const size_t N = A.size();
        for (size_t I = 1, J = 0; I < N; ++I)
        {
            size_t Bit = N >> 1;
            for (; J & Bit; Bit >>= 1)
            {
                J ^= Bit;
            }
            J ^= Bit;
            if (I < J)
            {
                std::swap(A[I], A[J]);
            }
        }
        for (size_t Length = 2; Length <= N; Length <<= 1)
        {
            const double Angle = -2.0 * 3.14159265358979 / static_cast<double>(Length);
            const std::complex<double> Turn(std::cos(Angle), std::sin(Angle));
            for (size_t I = 0; I < N; I += Length)
            {
                std::complex<double> W(1.0, 0.0);
                for (size_t K = 0; K < Length / 2; ++K)
                {
                    const std::complex<double> U = A[I + K], V = A[I + K + Length / 2] * W;
                    A[I + K] = U + V;
                    A[I + K + Length / 2] = U - V;
                    W *= Turn;
                }
            }
        }
    }

    // Share of slope power above half a cycle per pixel along a 1 cm sampled line, for a pixel that
    // covers Pixel centimetres along the line. Waves above that limit alias; a Hann window keeps
    // leakage out, and 16 bins of margin cover the slow gust and cat's-paw modulation.
    double AboveNyquist(float Pixel, float SampledPixel, float LineX, float LineY, float Wind)
    {
        const size_t N = 8192;
        std::vector<std::complex<double>> A(N), B(N);
        for (size_t I = 0; I < N; ++I)
        {
            const float Along = static_cast<float>(I);
            const float4 V = Pond(-14000.f + Along * LineX, 5000.f + Along * LineY, float3(LineX * SampledPixel, LineY * SampledPixel, 0.f),
                                  float3(-LineY * SampledPixel * .2f, LineX * SampledPixel * .2f, 0.f), 37.f, 1.f, 1.f, Wind, .94f, .34f, 0.f);
            const double Hann = .5 - .5 * std::cos(2.0 * 3.14159265358979 * static_cast<double>(I) / static_cast<double>(N));
            A[I] = Hann * V.x;
            B[I] = Hann * V.y;
        }
        Fft(A);
        Fft(B);
        const size_t Cutoff = static_cast<size_t>(std::ceil(static_cast<double>(N) * .5 / Pixel)) + 16;
        double Total = 0.0, Above = 0.0;
        for (size_t K = 1; K <= N / 2; ++K)
        {
            const double Power = std::norm(A[K]) + std::norm(B[K]);
            Total += Power;
            Above += K > Cutoff ? Power : 0.0;
        }
        return Above / Total;
    }

    void PondDetailTests()
    {
        // Along the wind, across it and diagonally, for pixels from 4 cm to 1.5 m on the water.
        const FPair Lines[3] = { FPair{ .94f, .34f }, FPair{ -.34f, .94f }, FPair{ .9055f, -.4243f } };
        double Worst = 0.0;
        for (const FPair& Line : Lines)
        {
            for (float Pixel : { 4.f, 10.f, 25.f, 60.f, 150.f })
            {
                const double Share = AboveNyquist(Pixel, Pixel, Line.A, Line.B, .55f);
                Worst = std::fmax(Worst, Share);
                Expect(Share < 1e-5, "no slope power above half a cycle per pixel: %.2g for %.0f cm pixels along (%.2f, %.2f)", Share, static_cast<double>(Pixel), static_cast<double>(Line.A), static_cast<double>(Line.B));
            }
        }
        // Without the fade the same lines carry plenty of aliasing power, so the check can fail.
        const double Unfaded = AboveNyquist(25.f, 0.f, .94f, .34f, .55f);
        Expect(Unfaded > .01, "unfaded waves put %.3f of their power above the limit for 25 cm pixels", Unfaded);
        std::printf("detail: worst share above Nyquist %.2g (unfaded %.3f)\n", Worst, Unfaded);

        // The slope variance that faded waves lose widens the GGX roughness: alpha^2 + lost = alpha'^2.
        for (float Wind : { 0.f, .2f })
        {
            const double Base4 = std::pow(BaseRoughness(Wind, 0.0), 4.0);
            for (float Pixel : { 10.f, 30.f, 80.f, 200.f })
            {
                double Near = 0.0, Far = 0.0, Widened = 0.0;
                int Count = 0;
                for (int Sample = 0; Sample < 20000; ++Sample)
                {
                    const float X = -16000.f + 7.31f * static_cast<float>(Sample % 4001);
                    const float Y = -3000.f + 11.7f * static_cast<float>(Sample % 997);
                    const float Time = 5.f + 1.37f * static_cast<float>(Sample % 613);
                    Near += SlopeSquared(PondSquare(X, Y, 0.f, Time, 1.f, Wind, .94f, .34f, 0.f));
                    const float4 V = PondSquare(X, Y, Pixel, Time, 1.f, Wind, .94f, .34f, 0.f);
                    Far += SlopeSquared(V);
                    Widened += std::pow(static_cast<double>(V.w), 4.0) - Base4;
                    ++Count;
                }
                const double Lost = (Near - Far) / Count;
                Widened /= Count;
                Expect(Lost > 0.0 && std::fabs(Widened - Lost) < .08 * Lost, "roughness keeps the lost slope variance at wind %.1f, %.0f cm pixels: %.3g widened, %.3g lost", static_cast<double>(Wind), static_cast<double>(Pixel), Widened, Lost);
            }
        }

        // From eye height (1.65 m) at 960, 1280 and 1920 pixels across with the 85 and 97 degree views:
        // the near water keeps every detail; far water in wind turns rougher instead of sparkling.
        for (double Width : { 960.0, 1280.0, 1920.0 })
        {
            for (double Fov : { 85.0, 97.0 })
            {
                bool Same = true;
                double NearRough = 0.0, FarRough = 0.0;
                for (int Sample = 0; Sample < 200; ++Sample)
                {
                    const float X = 4000.f + 17.f * static_cast<float>(Sample);
                    const float Time = 3.f + static_cast<float>(Sample);
                    for (double Distance : { 120.0, 200.0 })
                    {
                        const FPixel Pixel = PixelAt(X - Distance, 1000.0, 172.15, X, 1000.0, 7.15, Width, Fov);
                        const float4 Seen = Pond(X, 1000.f, Pixel.X, Pixel.Y, Time, 1.f, 1.f, 1.f, .94f, .34f, .9f);
                        const float4 Exact = Pond(X, 1000.f, Still, Still, Time, 1.f, 1.f, 1.f, .94f, .34f, .9f);
                        Same = Same && Seen.x == Exact.x && Seen.y == Exact.y && Seen.z == Exact.z && Seen.w == Exact.w;
                        NearRough += Pond(X, 1000.f, Pixel.X, Pixel.Y, Time, 1.f, 1.f, 1.f, .94f, .34f, 0.f).w / 2.0;
                    }
                    const FPixel Pixel = PixelAt(X - 4000.0, 1000.0, 172.15, X, 1000.0, 7.15, Width, Fov);
                    FarRough += Pond(X, 1000.f, Pixel.X, Pixel.Y, Time, 1.f, 1.f, 1.f, .94f, .34f, 0.f).w;
                }
                Expect(Same, "within 2 m of a %.0f-pixel, %.0f-degree view the water keeps all waves and rings", Width, Fov);
                Expect(FarRough / 200.0 > NearRough / 200.0 + .05, "40 m away windy water turns rougher (%.3f) than within 2 m (%.3f) at %.0f pixels",
                       FarRough / 200.0, NearRough / 200.0, Width);
            }
        }
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
                const float4 A = PondSquare(X, Y, .5f, Time, 1.f, .8f, .94f, .34f, .9f);
                const float4 B = PondSquare(X, Y, .5f, Time + 1200.f, 1.f, .8f, .94f, .34f, .9f);
                Largest = std::fmax(Largest, std::sqrt(SlopeSquared(float4(A.x - B.x, A.y - B.y, 0.f, 0.f))));
            }
            const float4 Before = PondSquare(X, Y, .5f, 1199.999f, 1.f, .8f, .94f, .34f, 0.f);
            const float4 After = PondSquare(X, Y, .5f, 1200.001f, 1.f, .8f, .94f, .34f, 0.f);
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
                        const float4 V = PondSquare(-13000.f + 7.f * static_cast<float>(Column), 7000.f + 7.f * static_cast<float>(Row), .5f, Time, 1.f, 1.f, Dir.A, Dir.B, 0.f);
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
        double PatchLow = 1e9, PatchHigh = 0.0;
        for (int Patch = 0; Patch < 40; ++Patch)
        {
            double Energy = 0.0;
            for (int Sample = 0; Sample < 300; ++Sample)
            {
                const float X = 2000.f + 450.f * static_cast<float>(Patch) + 11.f * static_cast<float>(Sample % 37);
                const float Y = -8000.f + 5.f * static_cast<float>(Sample % 31);
                Calm += SlopeSquared(PondSquare(X, Y, .5f, 77.f, 1.f, 0.f, .94f, .34f, 0.f));
                const double Slope = SlopeSquared(PondSquare(X, Y, .5f, 77.f, 1.f, 1.f, .94f, .34f, 0.f));
                Windy += Slope;
                Energy += Slope;
            }
            PatchLow = std::fmin(PatchLow, Energy);
            PatchHigh = std::fmax(PatchHigh, Energy);
        }
        Calm = std::sqrt(Calm / 12000.0);
        Windy = std::sqrt(Windy / 12000.0);
        Expect(Calm > .005 && Calm < .5 * Windy, "calm water keeps faint ripples: rms %.4f calm, %.4f windy", Calm, Windy);
        Expect(Windy > .04, "wind roughens the pond, rms %.4f", Windy);
        // Cat's paws: over 18 m along the pond, some 4 m patches are much rougher than others.
        Expect(PatchHigh > 2.0 * PatchLow, "gusty patches vary: roughest 4 m patch %.2f times the calmest", PatchHigh / PatchLow);
        std::printf("motion: repeat gap %.2g, wrap seam %.2g, rms slope calm %.4f windy %.4f, patch contrast %.2f\n", Largest, Seam, Calm, Windy, PatchHigh / PatchLow);
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

    // M_NordRain's Max World Position Offset Displacement clamps the offset on each axis and pads each
    // instance's culling bounds by it. It must cover the largest offset, or the clamp breaks the wrap and
    // streaks whose pivot is off screen are culled while they are in view. QuebecSky snaps the component
    // to the box grid around last frame's view, so the camera may also have moved since then.
    void StreakBoundsTests()
    {
        FSamples Random;
        double Largest[3] = { 0.0, 0.0, 0.0 };
        auto Snap = [](float Value, float Grid) { return std::floor((Value + .5f * Grid) / Grid) * Grid; };
        for (int Sample = 0; Sample < 400000; ++Sample)
        {
            const float3 Camera(Random.Next(-3.0e4f, 3.0e4f), Random.Next(-3.0e4f, 3.0e4f), Random.Next(-200.f, 3000.f));
            // A car at 40 m/s and 25 frames per second moves 160 cm a frame.
            const float3 Last = Camera - float3(Random.Next(-160.f, 160.f), Random.Next(-160.f, 160.f), Random.Next(-160.f, 160.f));
            const float3 Component(Snap(Last.x, Box.x), Snap(Last.y, Box.y), Snap(Last.z, Box.z));
            const float3 Pivot = Component + float3(Random.Next(-.5f, .5f) * Box.x, Random.Next(-.5f, .5f) * Box.y, Random.Next(-.5f, .5f) * Box.z);
            // Upright quads up to 1.2 cm wide and 80 cm long.
            const float3 Vertex = Pivot + float3(Random.Next(-.6f, .6f), Random.Next(-.6f, .6f), Random.Next(-40.f, 40.f));
            const float Time = Sample % 7 == 0 ? Random.Next(0.f, 3.0e5f) : Random.Next(0.f, 1200.f);
            const float4 V = RainStreak(Pivot, Vertex, Camera, Time, Random.Next(0.f, 1.f), 1.f, Random.Next(0.f, 1.f), Random.Next(-1.f, 1.f), Random.Next(-1.f, 1.f));
            Largest[0] = std::fmax(Largest[0], std::fabs(V.x));
            Largest[1] = std::fmax(Largest[1], std::fabs(V.y));
            Largest[2] = std::fmax(Largest[2], std::fabs(V.z));
        }
        const double Limit = NORD_RAIN_MAX_OFFSET;
        Expect(Largest[0] <= Limit && Largest[1] <= Limit && Largest[2] <= Limit, "streak offsets stay within the material's %.0f cm displacement limit: %.0f, %.0f, %.0f",
               Limit, Largest[0], Largest[1], Largest[2]);
        Expect(Largest[0] > 2900.0 && Largest[1] > 2900.0, "the check reaches the far wrap (1.5 boxes), largest %.0f, %.0f", Largest[0], Largest[1]);
        std::printf("streak bounds: largest offset %.0f, %.0f, %.0f cm within %.0f\n", Largest[0], Largest[1], Largest[2], Limit);
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
    StreakBoundsTests();
    PuddleTests();
    if (Failures)
    {
        std::fprintf(stderr, "%d of %d assertions failed\n", Failures, Assertions);
        return 1;
    }
    std::printf("NORD_WATER_SHADER_OK %d assertions\n", Assertions);
    return 0;
}
