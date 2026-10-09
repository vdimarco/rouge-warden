"""Create the animated comic-book post-process material used by the player cameras."""
import unreal as u

assets = u.EditorAssetLibrary
tools = u.AssetToolsHelpers.get_asset_tools()
M = u.MaterialEditingLibrary
PATH = '/Game/Art/Comic/M_ComicInk'

# Scene texture ids: SceneDepth=1, WorldNormal=8, PostProcessInput0=14 (MaterialSceneTextureId.h).
HLSL = r'''
float2 Texel = View.BufferSizeAndInvSize.zw;
float2 Pixel = Parameters.SvPosition.xy;
// Post-process inputs and geometry buffers can have different viewport extents.
float2 ColorUV = GetDefaultSceneTextureUV(Parameters, 14);
float2 GeometryUV = GetDefaultSceneTextureUV(Parameters, 1);
float DepthC = SceneTextureLookup(GeometryUV, 1, false).r;
bool Sky = DepthC > 1.0e6;

// Offset print plates: red and blue drift apart with distance instead of depth of field.
float Far = saturate((DepthC - 1500.0) / 25000.0);
float2 Shift = Texel * Misregistration * (0.35 + 2.65 * Far) * float2(1.0, 0.3);
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
    DepthEdge += abs(A + B - 2.0 * DepthC) / max(DepthC, 1.0);
    float3 NA = normalize(SceneTextureLookup(GeometryUV + Offset, 8, false).rgb + 1.0e-4);
    float3 NB = normalize(SceneTextureLookup(GeometryUV - Offset, 8, false).rgb + 1.0e-4);
    NormalEdge += 2.0 - saturate(dot(NA, NormalC)) - saturate(dot(NB, NormalC));
}
float Fade = 1.0 - saturate((DepthC - 12000.0) / 30000.0);
float Ink = max(smoothstep(0.025, 0.09, DepthEdge), smoothstep(0.5, 1.2, NormalEdge) * Fade);
Ink *= lerp(0.45, 1.0, Fade);

// Flat light bands with punchier colour.
float Lum = dot(Color, float3(0.299, 0.587, 0.114));
float Banded = (floor(Lum * Bands) + 0.5) / Bands;
float Light = pow(lerp(Lum, Banded, 0.65), 0.82);
float3 Chroma = Color / max(Lum, 1.0e-3);
Color = saturate(Chroma * Light);
float L2 = dot(Color, float3(0.299, 0.587, 0.114));
Color = saturate(lerp(L2.xxx, Color, Saturation));
// Shadows read as violet ink wash, never as black.
float ShadowAmount = 1.0 - smoothstep(0.04, 0.32, L2);
Color += float3(0.10, 0.05, 0.19) * ShadowAmount * (Sky ? 0.0 : 1.0);
// Warm magenta glow along the horizon.
Color = Sky ? lerp(Color, Color * float3(1.25, 0.8, 1.15) + float3(0.08, 0.0, 0.04), saturate(UV.y * 2.0 - 0.5)) : Color;
L2 = dot(Color, float3(0.299, 0.587, 0.114));

// Ben-Day dots on a 45 degree screen: bigger in shade, a fixed graded field in the sky.
float2 P = Pixel / DotSize;
float2 R = float2(P.x + P.y, P.y - P.x) * 0.70710678;
float Dist = length(frac(R) - 0.5);
float Shade = Sky ? lerp(0.62, 0.15, saturate(UV.y * 1.6)) : saturate((0.55 - L2) / 0.55);
float Radius = sqrt(Shade) * 0.6;
float Dot = 1.0 - smoothstep(Radius - 0.05, Radius + 0.05, Dist);
float3 DotInk = Sky ? Color * float3(0.72, 0.62, 1.05) : Color * float3(0.45, 0.32, 0.62) + float3(0.05, 0.0, 0.1);
Color = lerp(Color, saturate(DotInk), Dot * (Sky ? 0.55 : 0.7));

// Hatching in the deepest shadow.
float Hatch = step(frac((Pixel.x - Pixel.y) / (DotSize * 0.9)), 0.25) * (1.0 - smoothstep(0.1, 0.17, L2));
Color = lerp(Color, float3(0.05, 0.02, 0.1), Hatch * (Sky ? 0.0 : 0.6));

Color = lerp(Color, float3(0.025, 0.015, 0.05), saturate(Ink) * (Sky ? 0.0 : 1.0));
return Color;
'''


def link(source, output, target, input_name):
    assert M.connect_material_expressions(source, output, target, input_name), (source.get_name(), target.get_name(), input_name)


def node(mat, cls, **properties):
    n = M.create_material_expression(mat, cls)
    for k, v in properties.items():
        n.set_editor_property(k, v)
    return n


mat = assets.load_asset(PATH) if assets.does_asset_exist(PATH) else tools.create_asset('M_ComicInk', '/Game/Art/Comic', u.Material, u.MaterialFactoryNew())
M.delete_all_material_expressions(mat)
mat.set_editor_property('material_domain', u.MaterialDomain.MD_POST_PROCESS)
mat.set_editor_property('blendable_location', u.BlendableLocation.BL_SCENE_COLOR_AFTER_TONEMAPPING)

custom = node(mat, u.MaterialExpressionCustom, code=HLSL, output_type=u.CustomMaterialOutputType.CMOT_FLOAT3, description='ComicInk')
names = ['UV', 'Center', 'Depth', 'Normal', 'InkWidth', 'Misregistration', 'Bands', 'Saturation', 'DotSize']
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
for name, value in [('InkWidth', 1.6), ('Misregistration', 0.35), ('Bands', 5.0), ('Saturation', 1.3), ('DotSize', 8.0)]:
    link(node(mat, u.MaterialExpressionScalarParameter, parameter_name=name, default_value=value), '', custom, name)
M.connect_material_property(custom, '', u.MaterialProperty.MP_EMISSIVE_COLOR)
M.recompile_material(mat)
assets.save_loaded_asset(mat)
u.log('NORD_COMIC_MATERIAL_OK ' + PATH)
