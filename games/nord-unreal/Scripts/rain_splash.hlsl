// Splash rings where a drop meets the ground. Custom node inputs: WorldPos in centimetres,
// Time in seconds, Rain from MPC_NordAtmosphere (RainIntensity).
//
// Sarah Tariq, "Rain" (NVIDIA SDK 10, 2007), draws each impact as a ring that grows and fades.
// Cells are 70 cm. About a quarter of them are live, so the street is not a solid field of rings.
// The ring is 3.5 cm thick so it still reads from the walking camera. rain_streak.hlsl is not this.
float2 Cell = floor(float2(WorldPos.x, WorldPos.y) / 70.0);
float3 H = frac(float3(Cell.x, Cell.y, Cell.x) * 0.1031);
H += dot(H, float3(H.y, H.z, H.x) + 33.33);
float Hash = frac((H.x + H.y) * H.z);
float2 Jitter = float2(frac(Hash * 17.0), frac(Hash * 53.0)) - 0.5;
float2 Local = float2(WorldPos.x, WorldPos.y) - (Cell * 70.0 + 35.0) - Jitter * 24.0;
float Age = frac(Time * 0.45 + Hash);
float Radius = 3.0 + Age * 24.0;
float Dist = length(Local);
float Ring = saturate(1.0 - abs(Dist - Radius) / 3.5);
float Fade = 1.0 - Age;
float Core = saturate(1.0 - Dist / 5.0) * saturate(1.0 - Age / 0.15);
float Splash = saturate(Ring * Fade + Core) * step(0.72, Hash);
return Splash * saturate(Rain);
