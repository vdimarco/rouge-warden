// Estimated facade art: a three-metre window rhythm, independent of survey roof imagery.
float BrickTone = floor(saturate(dot(Brick, float3(0.299, 0.587, 0.114))) * 3.0) / 3.0;
float3 Paper = lerp(float3(0.28, 0.085, 0.055), float3(0.48, 0.24, 0.14), BrickTone);
if (abs(Normal.z) > 0.7) return Paper;
float2 P = abs(frac(UV) - 0.5);
float Outer = step(P.x, 0.245) * step(P.y, 0.3);
float Trim = step(P.x, 0.225) * step(P.y, 0.28);
float Glass = step(P.x, 0.195) * step(P.y, 0.25);
float3 Color = lerp(Paper, float3(0.035, 0.018, 0.055), Outer);
Color = lerp(Color, float3(0.7, 0.61, 0.42), Trim);
Color = lerp(Color, float3(0.045, 0.13, 0.2), Glass);
// Ink mullions and a small flat highlight make each window readable from the street.
float Mullion = Glass * max(step(P.x, 0.009), step(P.y, 0.009));
Color = lerp(Color, float3(0.035, 0.018, 0.055), Mullion);
float Highlight = Glass * step(frac(UV.x), 0.36) * step(0.56, frac(UV.y));
Color = lerp(Color, float3(0.25, 0.4, 0.46), Highlight * 0.55);
float StoreyLine = step(frac(UV.y), 0.018);
return lerp(Color, float3(0.14, 0.065, 0.09), StoreyLine);
