"""Parc La Fontaine pond water: the shore-distance texture and the M_PondWater graph.

prepare() needs numpy and shapely (the geo Python) and writes Data/Plateau/WaterGeometry.
import_texture(), author() and apply() run in the editor and only read those files.
Wave and rain-ring sources are named in pond_water.hlsl and the nord-sky-water design.
"""
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'Data/Plateau/WaterGeometry'
HLSL = ROOT / 'Scripts/pond_water.hlsl'
MATERIAL = '/Game/Plateau/Materials/M_PondWater'
TEXTURE = '/Game/Plateau/Water/T_PondShore'
COLLECTION = '/Game/Art/Atmosphere/MPC_NordAtmosphere'
SIZE = 2048
PAD_CM = 200.
NEAR_CM, FAR_CM = 600., 3000.
SHALLOW, DEEP, FOAM = (.045, .05, .03), (.008, .022, .02), (.35, .36, .33)
# The depth tint ramps over 0-12 m from the shore, which is 0-.4 of the G channel's 0-30 m.
DEPTH_RAMP = 1200. / FAR_CM
# Custom input, collection parameter and the pinned-afternoon value used when no collection exists.
WEATHER = (('Wind', 'WindStrength', .25), ('WindDirX', 'WindDirX', .94),
           ('WindDirY', 'WindDirY', .34), ('Rain', 'RainIntensity', 0.))
# WorldDX and WorldDY are the screen-pixel derivatives the shader uses to fade waves before they alias.
INPUTS = ('WorldPos', 'WorldDX', 'WorldDY', 'Time', 'Shore') + tuple(name for name, _, _ in WEATHER)


def _sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_png(path, rgba):
    """Deterministic RGBA8 PNG with the Up filter, which suits smooth distance rows."""
    import numpy as np
    height, width, channels = rgba.shape
    assert channels == 4 and rgba.dtype == np.uint8
    rows = np.empty((height, 1 + width * 4), np.uint8)
    rows[:, 0] = 2
    rows[:, 1:] = (rgba - np.vstack([np.zeros((1, width, 4), np.uint8), rgba[:-1]])).reshape(height, -1)

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    Path(path).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(rows.tobytes(), 9)) + chunk(b'IEND', b''))


def shore_distances(points, starts, ends, chunk=4096):
    """Distance from each point to the nearest shore edge, in chunks to bound memory."""
    import numpy as np
    edges = ends - starts
    lengths = np.maximum((edges * edges).sum(1), 1e-12)
    result = np.empty(len(points))
    for first in range(0, len(points), chunk):
        p = points[first:first + chunk, None, :]
        t = np.clip(((p - starts) * edges).sum(2) / lengths, 0, 1)
        nearest = starts + t[..., None] * edges
        result[first:first + chunk] = np.sqrt(((p - nearest) ** 2).sum(2).min(1))
    return result


def prepare(directory=None, size=SIZE):
    """R = shore distance over 0-6 m, G over 0-30 m, both 0 outside water; B = 255 in water; A = 255.

    Row 0 is the minimum y and column 0 the minimum x; texel centres sit at min + (index + .5) * texel.
    Island rings count as shore. The two relations share an edge where the ponds meet; that edge is
    open water, so the shore is the boundary of their union. The bounds pad the ponds by 200 cm.
    """
    import numpy as np
    import shapely
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    from plateau_park import park_survey
    directory = Path(directory or DIRECTORY)
    directory.mkdir(parents=True, exist_ok=True)
    ponds, _, _ = park_survey()
    water = unary_union([unary_union([Polygon(ring) for ring in pond['outer']]).difference(
        unary_union([Polygon(ring) for ring in pond['inner']])) for pond in ponds])
    assert water.is_valid and not water.is_empty
    points = np.array([point for pond in ponds for ring in pond['outer'] + pond['inner'] for point in ring])
    low, high = points.min(0) - PAD_CM, points.max(0) + PAD_CM
    texel = (high - low) / size
    rings = [list(ring.coords)[:-1] for polygon in getattr(water, 'geoms', [water])
             for ring in (polygon.exterior, *polygon.interiors)]
    starts = np.array([a for ring in rings for a in ring])
    ends = np.array([b for ring in rings for b in ring[1:] + ring[:1]])
    xs = low[0] + (np.arange(size) + .5) * texel[0]
    ys = low[1] + (np.arange(size) + .5) * texel[1]
    grid_x, grid_y = np.meshgrid(xs, ys)
    shapely.prepare(water)
    inside = shapely.contains_xy(water, grid_x, grid_y)
    distance = np.zeros((size, size))
    distance[inside] = shore_distances(np.column_stack([grid_x[inside], grid_y[inside]]), starts, ends)
    rgba = np.zeros((size, size, 4), np.uint8)
    rgba[..., 0] = np.rint(np.clip(distance / NEAR_CM, 0, 1) * 255)
    rgba[..., 1] = np.rint(np.clip(distance / FAR_CM, 0, 1) * 255)
    rgba[..., 2] = np.where(inside, 255, 0)
    rgba[..., 3] = 255
    png = directory / 'pond_shore.png'
    write_png(png, rgba)
    osm = ROOT / 'Data/LaFontaine/osm.xml'
    manifest = {
        'version': 1, 'png': png.name, 'png_sha256': _sha256(png),
        'size': [size, size], 'format': 'RGBA8 PNG, linear: import with sRGB off, clamp addressing',
        'bounds_cm': {'min': low.tolist(), 'max': high.tolist()}, 'padding_cm': PAD_CM,
        'texel_cm': texel.tolist(),
        'layout': 'row 0 = minimum y, column 0 = minimum x, texel centre = min + (index + .5) * texel_cm',
        'uv': 'u = (x - min x) / (max x - min x), v = (y - min y) / (max y - min y)',
        'encoding': {'R': 'distance to the nearest shore or island edge, 0-600 cm as 0-255, clamped; 0 outside water',
                     'G': 'distance to the nearest shore or island edge, 0-3000 cm as 0-255, clamped; 0 outside water',
                     'B': '255 inside water, 0 outside (islands are outside)', 'A': '255'},
        'near_range_cm': NEAR_CM, 'far_range_cm': FAR_CM,
        'shore': 'boundary of the union of both ponds, island included; the edge the two relations share is open water',
        'shore_rings': len(rings), 'shore_edges': len(starts),
        'sources': [{'relation': pond['source'], 'outer_rings': len(pond['outer']), 'inner_rings': len(pond['inner']),
                     'vertices': sum(len(ring) for ring in pond['outer'] + pond['inner'])} for pond in ponds],
        'osm': str(osm.relative_to(ROOT)), 'osm_sha256': _sha256(osm),
        'attribution': '© OpenStreetMap contributors, ODbL 1.0',
        'water_area_square_metres': water.area / 10000, 'water_texels': int(inside.sum()),
        'largest_distance_cm': float(distance.max()), 'texture_asset': TEXTURE,
    }
    (directory / 'water.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def load_manifest(directory=DIRECTORY):
    """Reject a missing, stale or reshaped shore texture before any asset is touched."""
    directory = Path(directory)
    manifest = json.loads((directory / 'water.json').read_text())
    png = directory / manifest['png']
    assert _sha256(png) == manifest['png_sha256'], 'Shore texture differs from water.json; rerun prepare()'
    header = png.read_bytes()[:26]
    assert header[:8] == b'\x89PNG\r\n\x1a\n' and header[12:16] == b'IHDR'
    width, height, depth, colour = struct.unpack('>IIBB', header[16:26])
    assert [width, height] == manifest['size'] and depth == 8 and colour == 6, 'Shore texture must be RGBA8'
    return manifest


def import_texture(u, directory=DIRECTORY):
    """Import the checked shore field as linear, clamped BC7 at T_PondShore."""
    manifest = load_manifest(directory)
    task = u.AssetImportTask()
    task.filename = str(Path(directory) / manifest['png'])
    task.destination_path, task.destination_name = TEXTURE.rsplit('/', 1)
    task.automated = True
    task.replace_existing = True
    task.save = True
    u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    assert task.imported_object_paths, task.filename
    texture = u.EditorAssetLibrary.load_asset(TEXTURE)
    assert isinstance(texture, u.Texture2D), TEXTURE
    texture.set_editor_property('srgb', False)
    texture.set_editor_property('compression_settings', u.TextureCompressionSettings.TC_BC7)
    texture.set_editor_property('address_x', u.TextureAddress.TA_CLAMP)
    texture.set_editor_property('address_y', u.TextureAddress.TA_CLAMP)
    assert u.EditorAssetLibrary.save_loaded_asset(texture)
    return texture, manifest


def existing(u, directory=DIRECTORY):
    """Shore texture, manifest and collection when bounded authoring already made them."""
    assets = u.EditorAssetLibrary
    texture = assets.load_asset(TEXTURE) if assets.does_asset_exist(TEXTURE) else None
    mpc = assets.load_asset(COLLECTION) if assets.does_asset_exist(COLLECTION) else None
    return texture, load_manifest(directory) if texture else None, mpc


def author(u, mat, texture=None, manifest=None, mpc=None):
    """Rebuild the pond graph in place: opaque Default Lit with a world-space normal.

    pond_water.hlsl returns the slope, foam and roughness; the depth tint comes from the shore
    texture's G channel. Without the shore texture the pond reads as open water (no foam, deep
    colour); without the collection the weather inputs are the pinned-afternoon constants.
    """
    assert (texture is None) == (manifest is None), 'The shore texture needs its manifest'
    library = u.MaterialEditingLibrary

    def node(cls, **properties):
        n = library.create_material_expression(mat, cls)
        for name, value in properties.items():
            n.set_editor_property(name, value)
        return n

    def link(source, output, target, name):
        assert library.connect_material_expressions(source, output, target, name), name

    def connect(source, output, prop):
        assert library.connect_material_property(source, output, prop), prop

    def mask(source, *channels):
        n = node(u.MaterialExpressionComponentMask, **{c: c in channels for c in 'rgba'})
        link(source, '', n, '')
        return n

    def color(value):
        return node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(*value, 1))

    library.delete_all_material_expressions(mat)
    mat.set_editor_property('blend_mode', u.BlendMode.BLEND_OPAQUE)
    mat.set_editor_property('shading_model', u.MaterialShadingModel.MSM_DEFAULT_LIT)
    mat.set_editor_property('tangent_space_normal', False)
    custom = node(u.MaterialExpressionCustom, code=HLSL.read_text(),
                  output_type=u.CustomMaterialOutputType.CMOT_FLOAT4, description='NordSky pond water')
    entries = []
    for name in INPUTS:
        entry = u.CustomInput()
        entry.set_editor_property('input_name', name)
        entries.append(entry)
    custom.set_editor_property('inputs', entries)
    world = node(u.MaterialExpressionWorldPosition)
    link(world, '', custom, 'WorldPos')
    # Camera-relative position has the same screen derivatives as the world position, without large-world types.
    relative = node(u.MaterialExpressionWorldPosition,
                    world_position_shader_offset=u.WorldPositionIncludedOffsets.WPT_CAMERA_RELATIVE)
    for name, cls in (('WorldDX', u.MaterialExpressionDDX), ('WorldDY', u.MaterialExpressionDDY)):
        derivative = node(cls)
        link(relative, '', derivative, '')
        link(derivative, '', custom, name)
    link(node(u.MaterialExpressionTime), '', custom, 'Time')
    # Open water without the shore texture is deep everywhere.
    depth = node(u.MaterialExpressionSmoothStep, const_min=0., const_max=DEPTH_RAMP, const_value=1.)
    if texture:
        low, high = manifest['bounds_cm']['min'], manifest['bounds_cm']['max']
        width, height = high[0] - low[0], high[1] - low[1]
        scale = node(u.MaterialExpressionMultiply)
        link(mask(world, 'r', 'g'), '', scale, 'A')
        link(node(u.MaterialExpressionConstant2Vector, r=1 / width, g=1 / height), '', scale, 'B')
        uv = node(u.MaterialExpressionAdd)
        link(scale, '', uv, 'A')
        link(node(u.MaterialExpressionConstant2Vector, r=-low[0] / width, g=-low[1] / height), '', uv, 'B')
        shore = node(u.MaterialExpressionTextureSample, texture=texture,
                     sampler_type=u.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
        link(uv, '', shore, '')
        link(shore, 'RGBA', custom, 'Shore')
        link(shore, 'G', depth, 'Value')
    else:
        link(node(u.MaterialExpressionConstant4Vector, constant=u.LinearColor(1, 1, 1, 1)), '', custom, 'Shore')
    weather = {}
    for name, parameter, default in WEATHER:
        weather[name] = (node(u.MaterialExpressionCollectionParameter, collection=mpc, parameter_name=parameter)
                         if mpc else node(u.MaterialExpressionConstant, r=default))
        link(weather[name], '', custom, name)

    downhill = node(u.MaterialExpressionMultiply, const_b=-1.)
    link(mask(custom, 'r', 'g'), '', downhill, 'A')
    normal = node(u.MaterialExpressionAppendVector)
    link(downhill, '', normal, 'A')
    link(node(u.MaterialExpressionConstant, r=1.), '', normal, 'B')
    unit = node(u.MaterialExpressionNormalize)
    link(normal, '', unit, '')
    connect(unit, '', u.MaterialProperty.MP_NORMAL)
    foam = mask(custom, 'b')
    water = node(u.MaterialExpressionLinearInterpolate)
    link(color(SHALLOW), '', water, 'A')
    link(color(DEEP), '', water, 'B')
    link(depth, '', water, 'Alpha')
    base = node(u.MaterialExpressionLinearInterpolate)
    link(water, '', base, 'A')
    link(color(FOAM), '', base, 'B')
    link(foam, '', base, 'Alpha')
    connect(base, '', u.MaterialProperty.MP_BASE_COLOR)
    # The shader widens clamp(.035 + .05 Wind + .08 Rain, .03, .17) by the slope variance of the waves
    # it fades with distance, at most .17, and blends the foam band toward .3.
    connect(mask(custom, 'a'), '', u.MaterialProperty.MP_ROUGHNESS)
    connect(node(u.MaterialExpressionConstant, r=.25), '', u.MaterialProperty.MP_SPECULAR)
    connect(node(u.MaterialExpressionConstant, r=0.), '', u.MaterialProperty.MP_METALLIC)
    library.recompile_material(mat)
    return {'material': mat.get_path_name(), 'custom_inputs': list(INPUTS),
            'hlsl_sha256': hashlib.sha256(HLSL.read_bytes()).hexdigest(),
            'shore_texture': texture.get_path_name() if texture else None,
            'collection': mpc.get_path_name() if mpc else None,
            'blend_mode': 'opaque', 'shading_model': 'default lit', 'tangent_space_normal': False,
            'wave_normals': 10, 'ring_layers': 4, 'slope_limit': .24, 'specular': .25, 'metallic': 0.,
            'screen_frequency_fade': 'each wave and the rings, 1/4 to 1/2 cycle per pixel',
            'depth_tint': f'smoothstep(0, {DEPTH_RAMP}, shore G)',
            'roughness': 'clamp(.035 + .05 Wind + .08 Rain, .03, .17) widened by the faded slope variance, '
                         'at most .17; foam .3'}


def apply(u, root=ROOT):
    """Standalone pond refresh with recovery; plateau_atmosphere.apply runs the full pass."""
    import plateau_atmosphere
    assets = u.EditorAssetLibrary
    session = plateau_atmosphere.begin(u, root, (MATERIAL, TEXTURE))
    texture, manifest = import_texture(u, Path(root) / 'Data/Plateau/WaterGeometry')
    mpc = assets.load_asset(COLLECTION) if assets.does_asset_exist(COLLECTION) else None
    mat = assets.load_asset(MATERIAL)
    assert isinstance(mat, u.Material), MATERIAL
    report = author(u, mat, texture, manifest, mpc)
    assert assets.save_loaded_asset(mat)
    plateau_atmosphere.finish(session)
    return report | {'backup': session['backup']}


if __name__ == '__main__':
    manifest = prepare()
    print(json.dumps({k: v for k, v in manifest.items() if k != 'encoding'}, ensure_ascii=False, indent=2))
