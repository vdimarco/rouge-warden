// Parc La Fontaine pond surface. Custom node inputs: WorldPos and CameraPos in world centimetres,
// Time in seconds, Shore = T_PondShore RGBA (R shore distance over 0-6 m, G over 0-30 m, B water),
// Wind, WindDirX, WindDirY and Rain from MPC_NordAtmosphere.
// Returns (slope x, slope y, foam, depth); the graph builds the world normal (-x, -y, 1).
// Waves: sum of eight sines as in GPU Gems 1 ch. 1 (Finch 2004), slope only, deep-water dispersion.
// Rain: ring layers switched on at rain quarters as in Lagarde 2013. Every time frequency is a
// whole number of cycles per 1200 s, so the time wrap below keeps sine arguments small and seamless.
float ShoreNear = Shore.x * 600.0;
float ShoreFar = Shore.y * 3000.0;
float2 P = float2(WorldPos.x, WorldPos.y);
float Seconds = Time - floor(Time / 1200.0) * 1200.0;
// Waves shorter than 1 m and the rings would shimmer under TSR beyond 25 m, so they fade out by 60 m.
float Detail = 1.0 - smoothstep(2500.0, 6000.0, length(WorldPos - CameraPos));
float RainAmount = saturate(Rain);
float2 WindDir = float2(WindDirX, WindDirY) + float2(0.94, 0.34) * 1.0e-4;
WindDir = WindDir / max(length(WindDir), 1.0e-6);
float2 Across = float2(-WindDir.y, WindDir.x);
float Gust = 0.775 + 0.225 * sin(dot(P, WindDir) * 0.0023 - Seconds * 0.408407) * cos(dot(P, Across) * 0.0017 + Seconds * 0.2303835);
float Strength = (0.2 + 0.8 * saturate(Wind)) * Gust;

const float Lengths[8] = { 400.0, 270.0, 190.0, 130.0, 90.0, 60.0, 40.0, 25.0 };
const float Angles[8] = { 0.0, 0.42, -0.37, 0.81, -0.66, 1.05, -0.95, 0.23 };
const float Slopes[8] = { 0.041, 0.036, 0.031, 0.028, 0.025, 0.022, 0.018, 0.015 };
const float Phases[8] = { 0.0, 0.27, 0.65, 0.41, 0.84, 0.14, 0.54, 0.95 };
float2 Slope = float2(0.0, 0.0);
for (int Wave = 0; Wave < 8; Wave++)
{
    // Deep water: omega = sqrt(g k) with g = 981 cm/s^2, rounded to whole cycles per 1200 s.
    float Cycles = round(sqrt(981.0 * 6.2831853 / Lengths[Wave]) / 6.2831853 * 1200.0) / 1200.0;
    float C = cos(Angles[Wave]);
    float S = sin(Angles[Wave]);
    float2 D = float2(C * WindDir.x - S * WindDir.y, S * WindDir.x + C * WindDir.y);
    float Crest = cos(6.2831853 * frac(dot(D, P) / Lengths[Wave] - Cycles * Seconds + Phases[Wave]));
    float Fade = Lengths[Wave] < 100.0 ? Detail : 1.0;
    Slope += D * (Slopes[Wave] * Strength * Fade * Crest);
}

// One drop per 40 cm cell per layer, centred so a ring never crosses its cell. Rings are damped
// within 1.5 m of the shore so the bank line stays clean. The cell hash is hash33 from Dave Hoskins,
// "Hash without Sine" (Shadertoy 4djSRW, MIT licence), which avoids sin() so every GPU agrees.
float RingDamp = smoothstep(0.0, 150.0, ShoreNear) * Detail;
for (int Layer = 0; Layer < 4; Layer++)
{
    float Weight = saturate(RainAmount * 4.0 - float(Layer)) * RingDamp;
    float2 Grid = P / 40.0 + float2(0.37, 0.61) * float(Layer);
    float2 Id = floor(Grid);
    float3 H = frac(float3(Id.x, Id.y, Id.x + 7.0 * float(Layer)) * float3(0.1031, 0.103, 0.0973));
    H += dot(H, float3(H.y, H.x, H.z) + 33.33);
    H = frac(float3((H.x + H.y) * H.z, (H.x + H.x) * H.y, (H.y + H.x) * H.x));
    float2 Delta = (Grid - Id - float2(0.3 + 0.4 * H.x, 0.3 + 0.4 * H.y)) * 40.0;
    float Age = frac(Seconds * 1.2 + H.z);
    float Distance = length(Delta);
    // Ring height sin(pi x)(1 - x^2)^2 across a 1.6 cm half width; Profile is its slope / pi.
    float X = (Distance - 10.0 * Age) / 1.6;
    float Window = saturate(1.0 - X * X);
    float Profile = cos(3.1415927 * X) * Window * Window - 1.2732395 * X * Window * sin(3.1415927 * X);
    float Envelope = (1.0 - Age) * (1.0 - Age) * saturate(Distance * 2.0);
    Slope += Delta * (0.03 * Weight * Envelope * Profile / max(Distance, 0.001));
}

// Normal z stays above .97, so the F2 comic filter keeps its smooth-reflection treatment.
Slope *= min(1.0, 0.24 / max(length(Slope), 1.0e-5));

float Broken = 0.5 + 0.25 * sin(dot(P, float2(0.031, 0.017)) + Seconds * 0.2094395) + 0.25 * sin(dot(P, float2(-0.022, 0.046)) - Seconds * 0.1361357);
float Foam = (1.0 - smoothstep(20.0, 60.0, ShoreNear)) * smoothstep(0.35, 0.65, Broken);
float Depth = smoothstep(0.0, 1200.0, ShoreFar);
return float4(Slope.x, Slope.y, Foam, Depth);
