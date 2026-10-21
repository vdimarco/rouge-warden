"""Create the animated comic-book post-process material used by the player cameras."""
import unreal as u

assets = u.EditorAssetLibrary
tools = u.AssetToolsHelpers.get_asset_tools()
M = u.MaterialEditingLibrary
PATH = '/Game/Art/Comic/M_ComicInk'
if '-NordGraphicNovelCandidate' in u.SystemLibrary.get_command_line():
    assert '-nullrhi' in u.SystemLibrary.get_command_line().lower(), 'Author materials offline before rendering'
    PATH = '/Game/ParkComic/CrewGraphicNovel/Resident9/M_ComicInk'

# Scene texture ids follow MaterialSceneTextureId.h; foliage uses the visible GBuffer, not custom depth.
HLSL = r'''
float2 Texel = View.BufferSizeAndInvSize.zw;
float2 Pixel = Parameters.SvPosition.xy;
// Post-process inputs and geometry buffers can have different viewport extents.
float2 ColorUV = GetDefaultSceneTextureUV(Parameters, 14);
float2 GeometryUV = GetDefaultSceneTextureUV(Parameters, 1);
float DepthC = SceneTextureLookup(GeometryUV, 1, false).r;
bool Sky = DepthC > 1.0e6;
float2 StencilUV = GetDefaultSceneTextureUV(Parameters, 25);
float Stencil = SceneTextureLookup(StencilUV, 25, false).r;
float CrewDepth = SceneTextureLookup(GetDefaultSceneTextureUV(Parameters, 13), 13, false).r;
float Crew = (Stencil > 254.0 && abs(CrewDepth - DepthC) < max(2.0, DepthC * 0.002)) ? 1.0 : 0.0;
float NovelCrew = (Stencil > 253.0 && Stencil <= 254.0 && abs(CrewDepth - DepthC) < max(2.0, DepthC * 0.002)) ? 1.0 : 0.0;
float PrintedCrew = max(Crew, NovelCrew);
float ShadingModel = SceneTextureLookup(GetDefaultSceneTextureUV(Parameters, 23), 23, false).r;
float Foliage = abs(ShadingModel - 6.0) < 0.5 ? 1.0 : 0.0;

// Offset print plates: red and blue drift apart with distance instead of depth of field.
float Far = saturate((DepthC - 1500.0) / 25000.0);
float2 Shift = (1.0 - max(PrintedCrew, Foliage)) * Texel * Misregistration * (0.35 + 2.65 * Far) * float2(1.0, 0.3);
float3 Color = float3(SceneTextureLookup(ColorUV + Shift, 14, false).r, SceneTextureLookup(ColorUV, 14, false).g, SceneTextureLookup(ColorUV - Shift, 14, false).b);

// Ink: the depth second derivative finds silhouettes but ignores flat ground at grazing angles;
// normal jumps find creases.
float DepthEdge = 0.0;
float NormalEdge = 0.0;
float3 NormalC = normalize(SceneTextureLookup(GeometryUV, 8, false).rgb + 1.0e-4);
const float2 Axes[2] = { float2(1, 0), float2(0, 1) };
for (int i = 0; i < 2; i++)
{
    float2 Offset = Axes[i] * Texel * InkWidth;
    float A = SceneTextureLookup(GeometryUV + Offset, 1, false).r;
    float B = SceneTextureLookup(GeometryUV - Offset, 1, false).r;
    float FoliageA = abs(SceneTextureLookup(GeometryUV + Offset, 23, false).r - 6.0) < 0.5 ? 1.0 : 0.0;
    float FoliageB = abs(SceneTextureLookup(GeometryUV - Offset, 23, false).r - 6.0) < 0.5 ? 1.0 : 0.0;
    float LeafBoundary = max(Foliage, max(FoliageA, FoliageB));
    // Millions of tiny leaf edges should read as a canopy, not a solid black ink mass.
    DepthEdge += abs(A + B - 2.0 * DepthC) / max(DepthC, 1.0) * lerp(1.0, 0.18, LeafBoundary);
    float3 NA = normalize(SceneTextureLookup(GeometryUV + Offset, 8, false).rgb + 1.0e-4);
    float3 NB = normalize(SceneTextureLookup(GeometryUV - Offset, 8, false).rgb + 1.0e-4);
    NormalEdge += (2.0 - saturate(dot(NA, NormalC)) - saturate(dot(NB, NormalC))) * (1.0 - LeafBoundary);
}
float Fade = 1.0 - saturate((DepthC - 12000.0) / 30000.0);
float Ink = max(smoothstep(0.025, 0.09, DepthEdge), smoothstep(0.5, 1.2, NormalEdge) * Fade * (1.0 - Crew) * lerp(1.0, 0.18, NovelCrew));
Ink *= lerp(0.45, 1.0, Fade);
Ink *= lerp(1.0, 0.18, Foliage);

// Flat light bands with punchier colour; sky and smooth pond reflections need continuous gradients.
// PondWater is opaque Default Lit (ID 1), roughness .17, with a nearly upward wave normal.
// Restrict the reflection exception so vertical glazing, rough pavements and foliage keep their ink style.
float Roughness = SceneTextureLookup(GetDefaultSceneTextureUV(Parameters, 11), 11, false).r;
float SmoothReflection = (1.0 - step(0.5, abs(ShadingModel - 1.0))) * (1.0 - smoothstep(0.18, 0.30, Roughness)) * smoothstep(0.90, 0.97, NormalC.z);
float GradientMask = Sky ? 1.0 : SmoothReflection;
float Lum = dot(Color, float3(0.299, 0.587, 0.114));
float Banded = (floor(Lum * Bands) + 0.5) / Bands;
float BandMix = lerp(lerp(0.35, 0.12, Foliage), 0.0, Crew) * (1.0 - GradientMask);
BandMix = lerp(BandMix, 0.22, NovelCrew);
float Light = pow(lerp(Lum, Banded, BandMix), 0.82);
float3 Chroma = Color / max(Lum, 1.0e-3);
Color = saturate(Chroma * Light);
float L2 = dot(Color, float3(0.299, 0.587, 0.114));
Color = saturate(lerp(L2.xxx, Color, Saturation));
// Shadows on the city read as a cool sky wash, never as black and never as violet.
// Printed crew skips that wash. It was repainting dark cloth before the key.
float ShadowAmount = 1.0 - smoothstep(0.04, 0.32, L2);
Color += float3(0.05, 0.07, 0.11) * ShadowAmount * (Sky ? 0.0 : 1.0) * (1.0 - PrintedCrew);
L2 = dot(Color, float3(0.299, 0.587, 0.114));

// Ben-Day dots on a 45 degree screen: bigger in shade, absent from the sky.
float2 P = Pixel / DotSize;
float2 R = float2(P.x + P.y, P.y - P.x) * 0.70710678;
float Dist = length(frac(R) - 0.5);
float Shade = Sky ? 0.0 : saturate((0.28 - L2) / 0.28);
float Radius = sqrt(Shade) * 0.6;
float Dot = 1.0 - smoothstep(Radius - 0.05, Radius + 0.05, Dist);
float3 DotInk = Sky ? Color * float3(0.78, 0.86, 1.05) : Color * float3(0.55, 0.62, 0.78) + float3(0.02, 0.03, 0.05);
Color = lerp(Color, saturate(DotInk), Dot * 0.18 * (1.0 - max(PrintedCrew, Foliage)));

// Hatching in the deepest shadow.
float Hatch = step(frac((Pixel.x - Pixel.y) / (DotSize * 0.9)), 0.25) * (1.0 - smoothstep(0.1, 0.17, L2));
Color = lerp(Color, float3(0.03, 0.04, 0.07), Hatch * (Sky ? 0.0 : 0.12) * (1.0 - max(PrintedCrew, Foliage)));

// The crew material is an emissive fill, so the body has no directional shade. Half-lambert
// (Mitchell, Francke, Eng, Team Fortress 2, 2007) gives a lit side from the afternoon sun.
// The value range matches the old key's luminance. The multiply stays a scalar so a warm-dark
// tee does not pick up the blue shadow colour. The city is left alone: PrintedCrew is 0 there.
float3 ToSun = normalize(float3(-0.62, -0.48, 0.62));
float Half = saturate(dot(NormalC, ToSun) * 0.5 + 0.5);
Half *= Half;
float CrewShade = lerp(0.70, 1.08, Half);
Color = lerp(Color, saturate(Color * CrewShade), PrintedCrew);
// Broad grazing rim from the same paper. The upward-only term sat inside the key
// and did not separate the figure, so the edge follows (1 - n·v)^4 around the silhouette.
float3 ToEye = -normalize(View.ViewForward);
float Grazing = saturate(1.0 - dot(NormalC, ToEye));
float Fresnel = Grazing * Grazing;
Fresnel *= Fresnel;
float3 Rim = float3(0.90, 0.94, 1.0) * Fresnel;
Color = lerp(Color, saturate(Color + Rim), PrintedCrew);

Color = lerp(Color, float3(0.025, 0.015, 0.05), saturate(Ink) * (Sky ? 0.0 : 1.0));

// Contact where an upright surface meets the street. Eight taps, the same idea as
// Mittring's SSAO (SIGGRAPH 2007) cut down to the ground: a nearer sample is the
// silhouette, which the ink already draws, so the tap has to sit near this depth.
float GroundHere = smoothstep(0.82, 0.94, NormalC.z) * (Sky ? 0.0 : 1.0);
float Contact = 0.0;
const float2 ContactTap[8] = {
    float2(6, 0), float2(-6, 0), float2(0, 6), float2(0, -6),
    float2(12, 0), float2(-12, 0), float2(0, 12), float2(0, -12)
};
for (int Tap = 0; Tap < 8; Tap++)
{
    float2 Offset = ContactTap[Tap] * Texel;
    float NeighborDepth = SceneTextureLookup(GeometryUV + Offset, 1, false).r;
    float3 NeighborN = normalize(SceneTextureLookup(GeometryUV + Offset, 8, false).rgb + 1.0e-4);
    float Upright = 1.0 - smoothstep(0.35, 0.55, NeighborN.z);
    float Close = 1.0 - smoothstep(40.0, 70.0, abs(NeighborDepth - DepthC));
    Contact += Upright * Close;
}
Color *= lerp(1.0, 0.38, saturate(Contact / 3.0) * GroundHere);

// Aerial perspective: distant surfaces take the afternoon sky. Near the camera the street stays.
// Hoffman and Preetham, "Rendering Outdoor Light Scattering in Real-Time" (2002). A horizontal
// ray spends more of its path in the haze than a steep ray at the same depth. The clear-day fog
// multipliers stay at 1, and this node still has no fog volume, so the extra path is the ray's
// elevation. ColorUV is the post-process viewport, origin at the top left.
float2 Ndc = ColorUV * float2(2.0, -2.0) + float2(-1.0, 1.0);
float2 TanHalf = View.TanAndInvTanHalfFOV.xy;
float3 Ray = normalize(View.ViewForward + View.ViewRight * Ndc.x * TanHalf.x + View.ViewUp * Ndc.y * TanHalf.y);
float Elevation = abs(Ray.z);
float Horizon = pow(saturate(1.0 - Elevation), 3.0);
float Aerial = smoothstep(2500.0, 14000.0, DepthC);
float Haze = Aerial * lerp(0.25, 1.0, Horizon);
Color = lerp(Color, float3(0.62, 0.70, 0.80), Haze * 0.85 * (Sky ? 0.0 : 1.0));

// Afternoon cumulus on sky pixels. Schneider, "The Real-Time Volumetric Cloudscapes
// of Horizon: Zero Dawn" (SIGGRAPH 2015), marches a cloud layer. This node has no
// volume, so only the layer remains: the view ray projects onto a plane above the
// camera, two octaves of value noise set the coverage, and the afternoon sun tints
// the thinner edge. The weather cover scalar stays 0.15. The haze mix above is unchanged,
// and a street pixel multiplies the paint by zero.
float2 CloudUv = Ray.xy / max(Ray.z, 0.07);
float WarpN = 0.0;
float LowN = 0.0;
float HighN = 0.0;
float SlopeN = 0.0;
for (int Octave = 0; Octave < 4; Octave++)
{
    float2 CloudP = CloudUv * 0.28 + float2(2.0, 7.0);
    if (Octave > 0)
    {
        float2 Uv2 = CloudUv * 0.55 + float2(WarpN, WarpN * 0.65) * 1.6;
        if (Octave == 1) CloudP = Uv2;
        if (Octave == 2) CloudP = CloudUv * 1.265 + float2(3.2, 8.4);
        if (Octave == 3) CloudP = Uv2 + float2(0.18, 0.0);
    }
    float2 Pi = floor(CloudP);
    float2 Pf = frac(CloudP);
    Pf = Pf * Pf * (float2(3.0, 3.0) - Pf * 2.0);
    float N = 0.0;
    for (int Corner = 0; Corner < 4; Corner++)
    {
        float SX = (Corner == 1 || Corner == 3) ? 1.0 : 0.0;
        float SY = (Corner >= 2) ? 1.0 : 0.0;
        float WX = (SX > 0.5) ? Pf.x : (1.0 - Pf.x);
        float WY = (SY > 0.5) ? Pf.y : (1.0 - Pf.y);
        N += WX * WY * frac(sin((Pi.x + SX) * 127.1 + (Pi.y + SY) * 311.7) * 43758.5453);
    }
    if (Octave == 0) WarpN = N;
    if (Octave == 1) LowN = N;
    if (Octave == 2) HighN = N;
    if (Octave == 3) SlopeN = N;
}
float Field = LowN * 0.75 + HighN * 0.25;
float Cover = smoothstep(0.52, 0.68, Field);
float Skirt = smoothstep(0.45, 0.54, Field) * 0.50;
float Body = max(Cover, Skirt);
float Lift = smoothstep(0.04, 0.13, Ray.z);
float Thick = saturate((Field - 0.48) / 0.24);
float SunX = normalize(float2(-0.62, -0.48)).x;
float Face = saturate((SlopeN - LowN) / 0.18 * SunX * 4.0 + 0.5);
float CloudShade = (1.0 - Thick) * Face;
float3 CloudCol = lerp(float3(0.48, 0.54, 0.64), float3(0.98, 0.98, 0.96), Thick);
CloudCol = lerp(CloudCol, float3(0.96, 0.82, 0.64), CloudShade);
float CloudMask = saturate(Body * Lift);
Color = lerp(Color, CloudCol, CloudMask * (Sky ? 1.0 : 0.0));

// Clearcoat on the glossy bodywork. Schlick, "An Inexpensive BRDF Model for
// Physically-based Rendering" (1994), approximates Fresnel as (1 - n·v)^5.
// A full clearcoat lobe does not fit this node, so the sky colour along the
// reflected view ray is weighted by that Fresnel. Paint .30, glass .18 and
// chrome .23 pick it up. Rubber, the pond's smooth-reflection case, printed
// crew and foliage stay matte. The weather scalars and the haze mix stay.
float3 Refl = reflect(Ray, NormalC);
float2 ReflUv = Refl.xy / max(Refl.z, 0.07);
float2 ReflPi = floor(ReflUv * 0.55);
float2 ReflPf = frac(ReflUv * 0.55);
ReflPf = ReflPf * ReflPf * (float2(3.0, 3.0) - ReflPf * 2.0);
float ReflN = 0.0;
for (int ReflCorner = 0; ReflCorner < 4; ReflCorner++)
{
    float CoatSX = (ReflCorner == 1 || ReflCorner == 3) ? 1.0 : 0.0;
    float CoatSY = (ReflCorner >= 2) ? 1.0 : 0.0;
    float CoatWX = (CoatSX > 0.5) ? ReflPf.x : (1.0 - ReflPf.x);
    float CoatWY = (CoatSY > 0.5) ? ReflPf.y : (1.0 - ReflPf.y);
    ReflN += CoatWX * CoatWY * frac(sin((ReflPi.x + CoatSX) * 127.1 + (ReflPi.y + CoatSY) * 311.7) * 43758.5453);
}
float ReflCloud = smoothstep(0.52, 0.72, ReflN) * smoothstep(0.04, 0.13, Refl.z);
float3 SkyRefl = lerp(float3(0.64, 0.76, 0.90), float3(0.30, 0.50, 0.84), saturate(Refl.z / 0.40));
SkyRefl = lerp(SkyRefl, float3(0.97, 0.97, 0.95), ReflCloud);
float SkyHit = smoothstep(0.0, 0.08, Refl.z);
float Clear = (1.0 - smoothstep(0.20, 0.42, Roughness)) * (1.0 - SmoothReflection) * (1.0 - PrintedCrew) * (1.0 - Foliage) * (Sky ? 0.0 : 1.0);
float CoatNdV = saturate(dot(NormalC, -Ray));
float CoatEdge = pow(1.0 - CoatNdV, 5.0);
float Coat = Clear * (0.62 + 0.38 * CoatEdge) * SkyHit;
Color = lerp(Color, SkyRefl, Coat);
return Color;
'''


def link(source, output, target, input_name):
    assert M.connect_material_expressions(source, output, target, input_name), (source.get_name(), target.get_name(), input_name)


def node(mat, cls, **properties):
    n = M.create_material_expression(mat, cls)
    for k, v in properties.items():
        n.set_editor_property(k, v)
    return n


folder, name = PATH.rsplit('/', 1)
assets.make_directory(folder)
mat = assets.load_asset(PATH) if assets.does_asset_exist(PATH) else tools.create_asset(name, folder, u.Material, u.MaterialFactoryNew())
assert mat and mat.get_path_name() == PATH + '.' + name, 'Wrong comic material destination'
# UE 5.8's bulk delete mutates the array it iterates.
for expression in M.get_material_expressions(mat):
    M.delete_material_expression(mat, expression)
mat.set_editor_property('material_domain', u.MaterialDomain.MD_POST_PROCESS)
mat.set_editor_property('blendable_location', u.BlendableLocation.BL_SCENE_COLOR_AFTER_TONEMAPPING)

custom = node(mat, u.MaterialExpressionCustom, code=HLSL, output_type=u.CustomMaterialOutputType.CMOT_FLOAT3, description='ComicInk')
names = ['UV', 'Center', 'Depth', 'Normal', 'StencilInput', 'CrewDepthInput', 'FoliageInput', 'RoughnessInput', 'InkWidth', 'Misregistration', 'Bands', 'Saturation', 'DotSize']
inputs = []
for name in names:
    entry = u.CustomInput()
    entry.set_editor_property('input_name', name)
    inputs.append(entry)
custom.set_editor_property('inputs', inputs)

scene = lambda index: node(mat, u.MaterialExpressionSceneTexture, scene_texture_id=index)
link(node(mat, u.MaterialExpressionTextureCoordinate), '', custom, 'UV')
link(scene(u.SceneTextureId.PPI_POST_PROCESS_INPUT0), 'Color', custom, 'Center')
link(scene(u.SceneTextureId.PPI_SCENE_DEPTH), 'Color', custom, 'Depth')
link(scene(u.SceneTextureId.PPI_WORLD_NORMAL), 'Color', custom, 'Normal')
link(scene(u.SceneTextureId.PPI_CUSTOM_STENCIL), 'Color', custom, 'StencilInput')
link(scene(u.SceneTextureId.PPI_CUSTOM_DEPTH), 'Color', custom, 'CrewDepthInput')
link(scene(u.SceneTextureId.PPI_SHADING_MODEL_ID), 'Color', custom, 'FoliageInput')
link(scene(u.SceneTextureId.PPI_ROUGHNESS), 'Color', custom, 'RoughnessInput')
for name, value in [('InkWidth', 1.0), ('Misregistration', 0.10), ('Bands', 5.0), ('Saturation', 1.05), ('DotSize', 5.0)]:
    link(node(mat, u.MaterialExpressionScalarParameter, parameter_name=name, default_value=value), '', custom, name)
M.connect_material_property(custom, '', u.MaterialProperty.MP_EMISSIVE_COLOR)
M.recompile_material(mat)
assets.save_loaded_asset(mat)
u.log('NORD_COMIC_MATERIAL_OK ' + PATH)
