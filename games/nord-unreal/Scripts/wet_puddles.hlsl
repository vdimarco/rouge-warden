// Puddle mask for wet ground. Custom node inputs: WorldPos in centimetres, Puddles from
// MPC_NordAtmosphere. Two octaves of value noise at a 3 m scale; smoothstep(.55, .7) keeps the
// puddles in the low patches, as in Lagarde 2013. The corner hash is hash12 from Dave Hoskins,
// "Hash without Sine" (Shadertoy 4djSRW, MIT licence), which avoids sin() so every GPU agrees.
float2 P = float2(WorldPos.x, WorldPos.y) / 300.0;
float Noise = 0.0;
float Amplitude = 0.65;
for (int Octave = 0; Octave < 2; Octave++)
{
    float2 Id = floor(P);
    float2 F = P - Id;
    float2 W = F * F * (3.0 - 2.0 * F);
    float Corner[4] = { 0.0, 0.0, 0.0, 0.0 };
    for (int Index = 0; Index < 4; Index++)
    {
        float2 Cell = Id + float2(float(Index % 2), float(Index / 2));
        float3 H = frac(float3(Cell.x, Cell.y, Cell.x) * 0.1031);
        H += dot(H, float3(H.y, H.z, H.x) + 33.33);
        Corner[Index] = frac((H.x + H.y) * H.z);
    }
    Noise += Amplitude * lerp(lerp(Corner[0], Corner[1], W.x), lerp(Corner[2], Corner[3], W.x), W.y);
    P = P * 2.03 + float2(17.3, 5.9);
    Amplitude = 0.35;
}
return smoothstep(0.55, 0.7, Noise) * saturate(Puddles);
