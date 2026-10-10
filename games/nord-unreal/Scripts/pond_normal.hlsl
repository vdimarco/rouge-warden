// Quiet illustrated pond ripples. Unequal directions/speeds avoid an axis-aligned grid.
float2 D0 = normalize(float2(1.0, 0.37));
float2 D1 = normalize(float2(-0.42, 1.0));
float2 D2 = normalize(float2(0.62, -0.78));
float2 N = D0 * (0.016 * sin(dot(Position.xy, D0) * 0.035 + Seconds * 0.83));
N += D1 * (0.009 * sin(dot(Position.xy, D1) * 0.086 - Seconds * 1.17 + 1.3));
N += D2 * (0.004 * cos(dot(Position.xy, D2) * 0.161 + Seconds * 0.59 + 0.7));
return normalize(float3(N, 1.0));
