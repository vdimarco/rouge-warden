// Rain streak world-position offset. Custom node inputs: Pivot (instance position), WorldPos
// (this vertex), CameraPos, Time, Rand (per-instance random), Rain, Wind, WindDirX, WindDirY.
// Returns (offset xyz, visible-instance mask). Camera-centred rain volume after Tariq,
// "Rain" (NVIDIA SDK 10, 2007): world-fixed pivots fall, drift with the wind and wrap into a
// 2000 x 2000 x 1200 cm box around the camera. The offset is the same for every vertex of an
// instance except the slant along the fall direction; moving the pivot by one box changes nothing.
float3 Box = float3(2000.0, 2000.0, 1200.0);
float Seconds = Time - floor(Time / 1200.0) * 1200.0;
float2 WindDir = float2(WindDirX, WindDirY) + float2(0.94, 0.34) * 1.0e-4;
WindDir = WindDir / max(length(WindDir), 1.0e-6);
float Speed = 900.0 * (0.75 + 0.5 * Rand);
float2 Drift = WindDir * (saturate(Wind) * 350.0 * (0.85 + 0.3 * frac(Rand * 7.31)));
// Travel is reduced modulo the box before it is added, so large times keep centimetre precision.
float3 Travel = float3(frac(Seconds * Drift.x / Box.x) * Box.x, frac(Seconds * Drift.y / Box.y) * Box.y, -frac(Seconds * Speed / Box.z) * Box.z);
float3 Local = Pivot + Travel - CameraPos + Box * 0.5;
float3 Wrapped = Local - floor(Local / Box) * Box;
float3 Offset = CameraPos - Box * 0.5 + Wrapped - Pivot;
// The top of a streak is where the drop was a moment ago, so it trails against the drift.
float2 Slant = Drift * (-(WorldPos.z - Pivot.z) / Speed);
float Visible = saturate((saturate(Rain) - Rand) * 20.0);
float3 Edge = min(Wrapped, Box - Wrapped);
float FaceFade = saturate(Edge.x / 150.0) * saturate(Edge.y / 150.0) * saturate(Edge.z / 100.0);
return float4(Offset.x + Slant.x, Offset.y + Slant.y, Offset.z, Visible * FaceFade);
