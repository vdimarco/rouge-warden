// Parc La Fontaine pond surface. Custom node inputs: WorldPos in world centimetres; WorldDX and
// WorldDY, the change of world position across one screen pixel (DDX and DDY of the camera-relative
// world position); Time in seconds; Shore = T_PondShore RGBA (R shore distance over 0-6 m, G over
// 0-30 m, B water); Wind, WindDirX, WindDirY and Rain from MPC_NordAtmosphere.
// Returns (slope x, slope y, foam, roughness); the graph builds the world normal (-x, -y, 1) and
// takes the depth tint from Shore G.
//
// Waves: sum of ten sines as in GPU Gems 1 ch. 1 (Finch 2004), slope only, deep-water dispersion,
// mostly along the wind plus two short cross and opposing waves, under a slow 18 m value-noise
// mask (cat's paws). Rain: ring layers switched on at rain quarters as in Lagarde 2013; rain also
// damps the short wind waves. Anti-aliasing: each wave and the rings fade by their own frequency
// on screen, from 1/4 to 1/2 cycle per pixel (frequency clamping: Norton, Rockwood and Skolmoski,
// "Clamping", SIGGRAPH 1982), and the slope variance they lose widens the GGX roughness (Toksvig,
// "Mipmapping Normal Maps", 2005; Olano and Baker, "LEAN Mapping", 2010), so far water turns
// glossy instead of sparkling. Every time frequency is a whole number of cycles per 1200 s, so the
// time wrap below keeps sine arguments small and seamless.
//
// The cell and corner hashes are hash33 and hash12 from "Hash without Sine" by Dave Hoskins,
// https://www.shadertoy.com/view/4djSRW, which avoid sin() so every GPU agrees. Their licence:
//
// Copyright (c) 2014 David Hoskins.
// SPDX-License-Identifier: MIT
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software
// and associated documentation files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
float ShoreNear = Shore.x * 600.0;
float2 P = float2(WorldPos.x, WorldPos.y);
float2 PixelX = float2(WorldDX.x, WorldDX.y);
float2 PixelY = float2(WorldDY.x, WorldDY.y);
// The longer side of this pixel on the water, in centimetres.
float Footprint = sqrt(max(dot(PixelX, PixelX), dot(PixelY, PixelY)));
float Seconds = Time - floor(Time / 1200.0) * 1200.0;
float RainAmount = saturate(Rain);
float2 WindDir = float2(WindDirX, WindDirY) + float2(0.94, 0.34) * 1.0e-4;
WindDir = WindDir / max(length(WindDir), 1.0e-6);
float2 Across = float2(-WindDir.y, WindDir.x);
float Gust = 0.775 + 0.225 * sin(dot(P, WindDir) * 0.0023 - Seconds * 0.408407) * cos(dot(P, Across) * 0.0017 + Seconds * 0.2303835);

// Cat's paws: value noise over 18 m cells that circles 6 m three times per 1200 s.
float PawTurn = Seconds * 0.015707963;
float2 PawGrid = P / 1800.0 + float2(cos(PawTurn), sin(PawTurn)) * 0.33;
float2 PawCell = floor(PawGrid);
float2 PawBlend = PawGrid - PawCell;
PawBlend = PawBlend * PawBlend * (3.0 - 2.0 * PawBlend);
float PawCorner[4] = { 0.0, 0.0, 0.0, 0.0 };
for (int PawIndex = 0; PawIndex < 4; PawIndex++)
{
    float2 Corner = PawCell + float2(float(PawIndex % 2), float(PawIndex / 2));
    float3 H = frac(float3(Corner.x, Corner.y, Corner.x) * 0.1031);
    H += dot(H, float3(H.y, H.z, H.x) + 33.33);
    PawCorner[PawIndex] = frac((H.x + H.y) * H.z);
}
float Paws = 0.6 + 0.8 * lerp(lerp(PawCorner[0], PawCorner[1], PawBlend.x), lerp(PawCorner[2], PawCorner[3], PawBlend.x), PawBlend.y);
float Strength = (0.2 + 0.8 * saturate(Wind)) * Gust * Paws;
// Rain beats down the short wind ripples, so its rings stand out.
float RainCalm = 1.0 - 0.6 * RainAmount;

const float Lengths[10] = { 400.0, 270.0, 190.0, 130.0, 90.0, 60.0, 47.0, 40.0, 33.0, 25.0 };
const float Angles[10] = { 0.0, 0.42, -0.37, 0.81, -0.66, 1.05, 1.75, -0.95, -2.3, 0.23 };
const float Slopes[10] = { 0.041, 0.036, 0.031, 0.028, 0.025, 0.022, 0.012, 0.018, 0.01, 0.015 };
const float Phases[10] = { 0.0, 0.27, 0.65, 0.41, 0.84, 0.14, 0.72, 0.54, 0.33, 0.95 };
float2 Slope = float2(0.0, 0.0);
// Slope variance removed by the screen-frequency fade; it goes into roughness below.
float Lost = 0.0;
for (int Wave = 0; Wave < 10; Wave++)
{
    // Deep water: omega = sqrt(g k) with g = 981 cm/s^2, rounded to whole cycles per 1200 s.
    float Cycles = round(sqrt(981.0 * 6.2831853 / Lengths[Wave]) / 6.2831853 * 1200.0) / 1200.0;
    float C = cos(Angles[Wave]);
    float S = sin(Angles[Wave]);
    float2 D = float2(C * WindDir.x - S * WindDir.y, S * WindDir.x + C * WindDir.y);
    float Crest = cos(6.2831853 * frac(dot(D, P) / Lengths[Wave] - Cycles * Seconds + Phases[Wave]));
    // Cycles of this wave per screen pixel: full below 1/4, gone at 1/2 (the Nyquist limit).
    float2 PerPixel = float2(dot(D, PixelX), dot(D, PixelY)) / Lengths[Wave];
    float Fade = 1.0 - smoothstep(0.25, 0.5, length(PerPixel));
    float Amplitude = Slopes[Wave] * Strength * (Lengths[Wave] < 100.0 ? RainCalm : 1.0);
    Slope += D * (Amplitude * Fade * Crest);
    Lost += 0.5 * Amplitude * Amplitude * (1.0 - Fade * Fade);
}

// One drop per 50 cm cell per layer, centred so a ring never crosses its cell. Rings are damped
// within 1.5 m of the shore so the bank line stays clean. The ring profile repeats over about 6 cm,
// so rings fade out as a pixel grows from 1.5 to 3 cm on the water.
float RingFade = 1.0 - smoothstep(0.25, 0.5, Footprint / 6.0);
float RingDamp = smoothstep(0.0, 150.0, ShoreNear);
for (int Layer = 0; Layer < 4; Layer++)
{
    float Weight = saturate(RainAmount * 4.0 - float(Layer)) * RingDamp;
    float2 Grid = P / 50.0 + float2(0.37, 0.61) * float(Layer);
    float2 Id = floor(Grid);
    float3 H = frac(float3(Id.x, Id.y, Id.x + 7.0 * float(Layer)) * float3(0.1031, 0.103, 0.0973));
    H += dot(H, float3(H.y, H.x, H.z) + 33.33);
    H = frac(float3((H.x + H.y) * H.z, (H.x + H.x) * H.y, (H.y + H.x) * H.x));
    float2 Delta = (Grid - Id - float2(0.36 + 0.28 * H.x, 0.36 + 0.28 * H.y)) * 50.0;
    float Age = frac(Seconds * 1.2 + H.z);
    float Distance = length(Delta);
    // Ring height sin(pi x)(1 - x^2)^2 across a 3 cm half width, out to 15 cm; Profile is its slope / pi.
    float X = (Distance - 15.0 * Age) / 3.0;
    float Window = saturate(1.0 - X * X);
    float Profile = cos(3.1415927 * X) * Window * Window - 1.2732395 * X * Window * sin(3.1415927 * X);
    float Envelope = (1.0 - Age) * (1.0 - Age) * saturate(Distance * 2.0);
    Slope += Delta * (0.12 * Weight * RingFade * Envelope * Profile / max(Distance, 0.001));
    // 3e-5 is the mean squared slope of one full ring layer over its cell and lifetime.
    Lost += 3.0e-5 * Weight * (1.0 - RingFade * RingFade);
}

// Normal z stays above .97, so the F2 comic filter keeps its smooth-reflection treatment.
Slope *= min(1.0, 0.24 / max(length(Slope), 1.0e-5));

// GGX alpha is roughness squared; the lost variance widens it. The comic filter fades its
// smooth-reflection treatment out from roughness .18, so open water stays at or below .17.
float Base = clamp(0.035 + 0.05 * Wind + 0.08 * Rain, 0.03, 0.17);
float Water = min(sqrt(sqrt(Base * Base * Base * Base + Lost)), 0.17);

// Foam: a 35 cm band at the bank, broken by value noise over 1.1 m cells that circles twenty
// times per 1200 s. As a pixel grows from a quarter to half a cell, the noise settles to its mean.
float FoamTurn = Seconds * 0.10471976;
float2 FoamGrid = P / 110.0 + float2(cos(FoamTurn), sin(FoamTurn)) * 0.4;
float2 FoamCell = floor(FoamGrid);
float2 FoamBlend = FoamGrid - FoamCell;
FoamBlend = FoamBlend * FoamBlend * (3.0 - 2.0 * FoamBlend);
float FoamCorner[4] = { 0.0, 0.0, 0.0, 0.0 };
for (int FoamIndex = 0; FoamIndex < 4; FoamIndex++)
{
    float2 Corner = FoamCell + float2(float(FoamIndex % 2), float(FoamIndex / 2));
    float3 H = frac(float3(Corner.x, Corner.y, Corner.x) * 0.1031);
    H += dot(H, float3(H.y, H.z, H.x) + 33.33);
    FoamCorner[FoamIndex] = frac((H.x + H.y) * H.z);
}
float FoamNoise = lerp(lerp(FoamCorner[0], FoamCorner[1], FoamBlend.x), lerp(FoamCorner[2], FoamCorner[3], FoamBlend.x), FoamBlend.y);
float Broken = lerp(smoothstep(0.4, 0.6, FoamNoise), 0.5, smoothstep(0.25, 0.5, Footprint / 110.0));
float Foam = (1.0 - smoothstep(10.0, 35.0, ShoreNear)) * Broken;
return float4(Slope.x, Slope.y, Foam, lerp(Water, 0.3, Foam));
