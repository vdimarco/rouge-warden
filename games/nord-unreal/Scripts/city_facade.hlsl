// Estimated Montreal masonry; surveyed roof imagery is a separate material section.
float Seed = frac(sin(dot(Center.xy, float2(0.00113, 0.00197))) * 43758.5453);
float Stone = step(0.72, Seed);
float Tone = floor(saturate(dot(Brick, float3(0.299, 0.587, 0.114))) * 4.0) / 4.0;
// Brick and stone were one maroon-brown. Brick goes toward burnt orange, stone toward a cool grey.
float3 Paper = lerp(float3(0.36, 0.14, 0.08), float3(0.62, 0.30, 0.14), Tone);
Paper *= lerp(0.86, 1.10, frac(Seed * 7.13));
Paper = lerp(Paper, lerp(float3(0.40, 0.44, 0.47), float3(0.62, 0.66, 0.68), Tone), Stone);
if (abs(Normal.z) > 0.7) return Paper;
float Height = max(200.0, Center.z + Bounds.z);
float Z = Position.z;
float2 Cell = float2(frac(UV.x + Seed * 0.3), frac((Z - 100.0) / 320.0));
float2 P = abs(Cell - 0.5);
float Wall = step(110.0, Z) * step(Z, Height - 90.0);
float WindowWidth = lerp(0.18, 0.225, step(0.46, frac(Seed * 11.7)));
float Outer = step(P.x, WindowWidth) * step(P.y, 0.32) * Wall;
float Trim = step(P.x, WindowWidth - 0.016) * step(P.y, 0.30) * Wall;
float Glass = step(P.x, WindowWidth - 0.039) * step(P.y, 0.275) * Wall;
float Along = frac(Z / 28.0);
float Across = frac(UV.x * 4.0 + floor(Z / 28.0) * 0.5);
float Course = max(step(Along, 0.07), step(Across, 0.045));
float3 Color = Paper;
// Each brick or stone unit shifts so a wall is not one flat paper colour.
float BrickNoise = frac(sin(dot(floor(float2(UV.x * 8.0 + floor(Z / 28.0) * 0.5, Z / 28.0)), float2(12.9898, 78.233))) * 43758.5453);
Color *= lerp(0.86, 1.12, BrickNoise);
float Grain = frac(sin(dot(floor(float2(UV.x * 32.0, Z / 6.0)), float2(12.9898, 78.233))) * 43758.5453);
Color *= lerp(0.93, 1.06, Grain);
// The joint is its own pale bed. The top of each course catches the afternoon sun.
float3 Mortar = lerp(float3(0.50, 0.46, 0.40), float3(0.64, 0.60, 0.52), Stone);
float Arris = step(0.86, Along) * step(0.045, Across);
Color = lerp(Color, Color * float3(1.14, 1.08, 0.96), Arris);
Color = lerp(Color, Mortar * lerp(0.78, 1.0, saturate(Along / 0.07)), Course);
// Quiet limestone courses and unequal bay widths break up the long window grid.
float Belt = step(abs(frac((Z - 100.0) / 320.0) - 0.015), 0.013) * Wall;
float Pier = step(frac((UV.x + Seed * 0.3) / 3.0), 0.018) * Wall;
Color = lerp(Color, float3(0.39, 0.365, 0.30), max(Belt * 0.48, Pier * 0.30));
Color = lerp(Color, float3(0.31, 0.315, 0.28), step(Z, 110.0));
Color = lerp(Color, float3(0.025, 0.035, 0.035), Outer);
Color = lerp(Color, float3(0.50, 0.475, 0.405), Trim);
float3 GlassTint = lerp(float3(0.048, 0.082, 0.095), float3(0.095, 0.13, 0.14), frac(Seed * 13.1));
Color = lerp(Color, GlassTint, Glass);
float Recess = Glass * max(step(Cell.x, 0.5 - WindowWidth + 0.063), step(0.735, Cell.y));
Color *= 1.0 - Recess * 0.26;
float Sash = Glass * max(step(P.x, 0.006), step(abs(Cell.y - 0.56), 0.008));
Color = lerp(Color, float3(0.36, 0.355, 0.315), Sash);
// Some rooms are lit. The pane is the lamp colour. The brick under it takes the spill.
float FloorId = floor((Z - 100.0) / 320.0);
float Room = frac(sin(dot(floor(float2(UV.x + Seed, FloorId)), float2(19.13, 78.233))) * 43758.5453);
float Lamp = Glass * (1.0 - Sash) * step(0.55, Room) * step(P.x, WindowWidth - 0.07) * step(P.y, 0.20);
Color = lerp(Color, float3(0.78, 0.46, 0.18), Lamp);
float Lintel = step(P.x, WindowWidth + 0.018) * step(abs(Cell.y - 0.83), 0.025) * Wall;
float Sill = step(P.x, WindowWidth + 0.018) * step(abs(Cell.y - 0.18), 0.018) * Wall;
Color = lerp(Color, float3(0.44, 0.425, 0.36), max(Lintel, Sill));
float Basement = step(Z, 82.0) * step(28.0, Z) * step(P.x, 0.15);
Color = lerp(Color, float3(0.045, 0.055, 0.05), Basement);
float Dirt = clamp((160.0 - Z) / 160.0, 0.0, 1.0) * (1.0 - Glass);
Color = lerp(Color, Color * float3(0.62, 0.56, 0.46), Dirt * 0.55);
// Every fourth ground-floor bay is an entrance: the window becomes a door, and steps rise from the street.
float Bay = UV.x + Seed * 0.3;
float DoorSpan = frac(Bay / 4.0);
float Ground = step(100.0, Z) * step(Z, 420.0);
float DoorU = DoorSpan / 0.20;
float Opening = step(DoorSpan, 0.20) * Ground * step(abs(Cell.y - 0.52), 0.30);
float DoorLeaf = Opening * step(0.10, DoorU) * step(DoorU, 0.90) * step(Cell.y, 0.70);
float Transom = Opening * step(0.10, DoorU) * step(DoorU, 0.90) * step(0.72, Cell.y);
float Sill = 100.0 + 0.22 * 320.0;
float Stoop = step(DoorSpan, 0.26) * step(6.0, Z) * step(Z, Sill);
float Tread = step(frac((Sill - Z) / 26.0), 0.72);
float Panel = DoorLeaf * step(0.22, DoorU) * step(DoorU, 0.78) * step(abs(Cell.y - 0.46), 0.14);
float Knob = DoorLeaf * step(abs(DoorU - 0.78), 0.04) * step(abs(Cell.y - 0.42), 0.025);
Color = lerp(Color, lerp(float3(0.30, 0.28, 0.25), float3(0.44, 0.42, 0.38), Tread), Stoop);
Color = lerp(Color, float3(0.24, 0.22, 0.19), Opening * (1.0 - DoorLeaf) * (1.0 - Transom));
Color = lerp(Color, lerp(float3(0.11, 0.075, 0.05), float3(0.18, 0.16, 0.14), Stone), DoorLeaf);
Color = lerp(Color, float3(0.22, 0.13, 0.08), Panel);
Color = lerp(Color, GlassTint, Transom);
Color = lerp(Color, float3(0.62, 0.55, 0.32), Knob);
// A gallery rail in front of the floor above each entrance, and a downspout between bay groups.
float Gallery = step(DoorSpan, 0.22) * step(430.0, Z) * step(Z, 505.0);
float Iron = Gallery * max(step(frac(DoorU * 7.0), 0.16), step(abs(Z - 498.0), 5.0));
float Spout = step(abs(frac(Bay / 4.0) - 0.50), 0.008) * step(40.0, Z) * step(Z, Height - 70.0);
Color = lerp(Color, float3(0.16, 0.17, 0.18), max(Iron, Spout));
// A lit room throws a warm apron on the brick under the pane. The pane itself stays the lamp colour.
float Lit = step(0.55, Room) * Wall * (1.0 - Glass);
float Under = saturate((0.26 - Cell.y) / 0.22);
float Reach = saturate(1.0 - max(P.x - WindowWidth, 0.0) / 0.28);
float Spill = Lit * Under * Reach;
Color = lerp(Color, Color * float3(1.55, 1.22, 0.70) + float3(0.06, 0.02, 0.0), Spill);
// An iron trough under each window. The door opening stays clear. The lip is lighter so the trough reads at street scale.
float Trough = Wall * step(P.x, WindowWidth + 0.02) * step(abs(Cell.y - 0.105), 0.042) * (1.0 - Opening);
float Lip = Wall * step(P.x, WindowWidth + 0.02) * step(abs(Cell.y - 0.142), 0.008) * (1.0 - Opening);
Color = lerp(Color, float3(0.16, 0.17, 0.18), Trough);
Color = lerp(Color, float3(0.34, 0.36, 0.34), Lip);
float Cornice = step(Height - 65.0, Z);
return lerp(Color, float3(0.19, 0.21, 0.195), Cornice);
