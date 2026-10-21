"""Bounded nord-sky-water material authoring in the saved LaFontaine level.

Run in a fresh NullRHI editor process with /Game/Maps/LaFontaine open and PIE stopped. apply()
backs up every touched asset to Saved/Recovery/sky-water-<UTC>/, edits in place, saves, checks
that the map file did not change and verifies the read-backs. Pass `verify` as a script argument
in a later process to repeat only the read-backs after a fresh load.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plateau_water

ROOT = Path(__file__).resolve().parents[1]
WORLD = '/Game/Maps/LaFontaine.LaFontaine'
MAP = 'Content/Maps/LaFontaine.umap'
REPORT = 'Saved/Tests/SkyWater/authoring.json'
COLLECTION = plateau_water.COLLECTION
# Defaults equal the pinned afternoon, so every wrapped material looks as before until the sky runs.
PARAMETERS = (('NightFactor', 0.), ('ExposureScale', 1.), ('WindowGlow', 1.), ('Wetness', 0.), ('Puddles', 0.),
              ('RainIntensity', 0.), ('WindStrength', .25), ('WindDirX', .94), ('WindDirY', .34), ('Gloom', 0.))
RAIN = '/Game/Art/Atmosphere/M_NordRain'
RAIN_HLSL = ROOT / 'Scripts/rain_streak.hlsl'
# rain_streak.hlsl draws a streak up to 1.5 boxes (3000 cm) from its pivot on X and Y, plus about 24 cm of
# wind slant and the camera's movement since QuebecSky last snapped the component. The material clamps the
# offset on each axis to this value and pads each instance's culling bounds by it; 0 would cull streaks
# whose pivot is off screen. Scripts/water_shader_test.cpp checks that the offset stays inside it.
RAIN_MAX_OFFSET = 3200.
PUDDLE_HLSL = ROOT / 'Scripts/wet_puddles.hlsl'
RAIN_INPUTS = ('Pivot', 'WorldPos', 'CameraPos', 'Time', 'Rand', 'Rain', 'Wind', 'WindDirX', 'WindDirY')
WET = tuple('/Game/Plateau/Materials/M_' + name for name in ('Asphalt', 'Concrete', 'ConcreteDark', 'Gravel', 'ParkEarth'))
WINDOWS = tuple('/Game/Plateau/Materials/M_' + name for name in ('Glow', 'InteriorWarm', 'Tail'))
UNLIT = ('/Game/Materials/M_Glow', '/Game/ParkComic/M_Paper', '/Game/ParkComic/M_Text',
         '/Game/ParkComic/M_IllustrationCrew', '/Game/ParkComic/M_IllustrationBrawl') + tuple(
             f'/Game/ParkComic/Crew/Resident{style}/M_Crew' for style in range(3, 11))
TOUCHED = (COLLECTION, plateau_water.TEXTURE, plateau_water.MATERIAL, RAIN) + WET + WINDOWS + UNLIT
MARKER = 'NordSky'
# Collection parameters each wrapper adds, by property name; verify() expects exactly one of each.
WRAPPERS = {'wet': {'MP_BASE_COLOR': ('Wetness',), 'MP_ROUGHNESS': ('Wetness', 'Puddles'), 'MP_NORMAL': ('Puddles',)},
            'window': {'MP_EMISSIVE_COLOR': ('WindowGlow',)},
            'exposure': {'MP_EMISSIVE_COLOR': ('ExposureScale', 'NightFactor')}}
PROPERTIES = ('MP_BASE_COLOR', 'MP_NORMAL', 'MP_ROUGHNESS', 'MP_EMISSIVE_COLOR', 'MP_OPACITY',
              'MP_WORLD_POSITION_OFFSET', 'MP_SPECULAR', 'MP_METALLIC')


def _sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def asset_files(root, asset):
    """Package files of a /Game asset that exist on disk."""
    base = Path(root) / 'Content' / asset.removeprefix('/Game/')
    return [base.with_name(base.name + suffix) for suffix in ('.uasset', '.uexp', '.ubulk')
            if base.with_name(base.name + suffix).exists()]


def begin(u, root, assets):
    """Guard the open level, hash the map and back up every asset this pass may write."""
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'Stop PIE before authoring sky and water'
    assert u.EditorLevelLibrary.get_editor_world().get_path_name() == WORLD, 'Open /Game/Maps/LaFontaine first'
    root = Path(root)
    map_path = root / MAP
    map_hash = _sha256(map_path)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = root / 'Saved/Recovery' / ('sky-water-' + stamp)
    assert not backup.exists()
    backup.mkdir(parents=True)
    files, absent = {}, []
    for asset in assets:
        found = asset_files(root, asset)
        if not found:
            absent.append(asset)
        for file in found:
            relative = file.relative_to(root)
            target = backup / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, target)
            digest = _sha256(file)
            assert _sha256(target) == digest, relative
            files[str(relative)] = digest
    manifest = {'created_utc': stamp, 'map': MAP, 'map_sha256': map_hash, 'files': files, 'absent_before': absent}
    (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return {'map_path': map_path, 'map_sha256': map_hash, 'backup': str(backup.relative_to(root)), 'manifest': manifest}


def finish(session):
    assert _sha256(session['map_path']) == session['map_sha256'], 'Sky and water authoring wrote the map'


class Graph:
    """Node helpers for one material; wrapper nodes carry the NordSky marker."""

    def __init__(self, u, mat, mpc, marker=True):
        self.u, self.mat, self.mpc, self.marker = u, mat, mpc, marker
        self.library = u.MaterialEditingLibrary

    def node(self, cls, **properties):
        n = self.library.create_material_expression(self.mat, cls)
        if self.marker:
            n.set_editor_property('desc', MARKER)
        for name, value in properties.items():
            n.set_editor_property(name, value)
        return n

    def link(self, source, output, target, name):
        assert self.library.connect_material_expressions(source, output, target, name), (self.mat.get_path_name(), name)

    def connect(self, source, output, prop):
        assert self.library.connect_material_property(source, output, prop), prop
        assert self.library.get_material_property_input_node(self.mat, prop) == source, ('Reconnection failed', prop)

    def parameter(self, name):
        assert name in dict(PARAMETERS), name
        return self.node(self.u.MaterialExpressionCollectionParameter, collection=self.mpc, parameter_name=name)

    def custom(self, path, inputs, output_type, description):
        n = self.node(self.u.MaterialExpressionCustom, code=Path(path).read_text(), output_type=output_type, description=description)
        entries = []
        for name in inputs:
            entry = self.u.CustomInput()
            entry.set_editor_property('input_name', name)
            entries.append(entry)
        n.set_editor_property('inputs', entries)
        return n

    def mask(self, source, *channels):
        n = self.node(self.u.MaterialExpressionComponentMask, **{c: c in channels for c in 'rgba'})
        self.link(source, '', n, '')
        return n

    def current(self, prop):
        """The node and output now feeding prop, and whether a NordSky wrapper already feeds it."""
        source = self.library.get_material_property_input_node(self.mat, prop)
        if source is None:
            return None, '', False
        if hasattr(self.library, 'get_material_property_input_node_output_name'):
            output = str(self.library.get_material_property_input_node_output_name(self.mat, prop))
        else:
            # The authored graphs feed roughness from a texture's R channel and everything else from a first output.
            output = 'R' if prop == self.u.MaterialProperty.MP_ROUGHNESS and isinstance(source, self.u.MaterialExpressionTextureSample) else ''
        return source, '' if output == 'None' else output, str(source.get_editor_property('desc')) == MARKER


def collection(u):
    """Create or update the collection. Parameters are matched by name, so existing GUIDs survive."""
    assets = u.EditorAssetLibrary
    folder, name = COLLECTION.rsplit('/', 1)
    created = not assets.does_asset_exist(COLLECTION)
    mpc = (u.AssetToolsHelpers.get_asset_tools().create_asset(name, folder, u.MaterialParameterCollection,
                                                              u.MaterialParameterCollectionFactoryNew())
           if created else assets.load_asset(COLLECTION))
    assert isinstance(mpc, u.MaterialParameterCollection), COLLECTION
    scalars = list(mpc.get_editor_property('scalar_parameters'))
    names = [str(entry.get_editor_property('parameter_name')) for entry in scalars]
    assert len(set(names)) == len(names), 'Duplicate collection parameter names'
    for parameter, default in PARAMETERS:
        if parameter in names:
            entry = scalars[names.index(parameter)]
        else:
            entry = u.CollectionScalarParameter()
            entry.set_editor_property('parameter_name', parameter)
            scalars.append(entry)
        entry.set_editor_property('default_value', default)
    mpc.set_editor_property('scalar_parameters', scalars)
    assert assets.save_loaded_asset(mpc)
    return mpc, {'asset': COLLECTION, 'created': created, 'kept': [n for n in names if n in dict(PARAMETERS)],
                 'other_parameters': [n for n in names if n not in dict(PARAMETERS)]}


def rain_material(u, mpc):
    """Translucent streaks; rain_streak.hlsl places each instance and passes its visibility to the pixels."""
    assets = u.EditorAssetLibrary
    folder, name = RAIN.rsplit('/', 1)
    mat = (assets.load_asset(RAIN) if assets.does_asset_exist(RAIN) else
           u.AssetToolsHelpers.get_asset_tools().create_asset(name, folder, u.Material, u.MaterialFactoryNew()))
    assert isinstance(mat, u.Material), RAIN
    g = Graph(u, mat, mpc, marker=False)
    plateau_water.clear_material(u, mat)
    mat.set_editor_property('blend_mode', u.BlendMode.BLEND_TRANSLUCENT)
    mat.set_editor_property('shading_model', u.MaterialShadingModel.MSM_DEFAULT_LIT)
    mat.set_editor_property('two_sided', True)
    mat.set_editor_property('translucency_lighting_mode', u.TranslucencyLightingMode.TLM_VOLUMETRIC_NON_DIRECTIONAL)
    mat.set_editor_property('max_world_position_offset_displacement', RAIN_MAX_OFFSET)
    streak = g.custom(RAIN_HLSL, RAIN_INPUTS, u.CustomMaterialOutputType.CMOT_FLOAT4, 'NordSky rain streak')
    for name, source in (('Pivot', g.node(u.MaterialExpressionObjectPositionWS)),
                         ('WorldPos', g.node(u.MaterialExpressionWorldPosition)),
                         ('CameraPos', g.node(u.MaterialExpressionCameraPositionWS)),
                         ('Time', g.node(u.MaterialExpressionTime)),
                         ('Rand', g.node(u.MaterialExpressionPerInstanceRandom)),
                         ('Rain', g.parameter('RainIntensity')), ('Wind', g.parameter('WindStrength')),
                         ('WindDirX', g.parameter('WindDirX')), ('WindDirY', g.parameter('WindDirY'))):
        g.link(source, '', streak, name)
    g.connect(g.mask(streak, 'r', 'g', 'b'), '', u.MaterialProperty.MP_WORLD_POSITION_OFFSET)
    visible = g.node(u.MaterialExpressionVertexInterpolator)
    g.link(g.mask(streak, 'a'), '', visible, '')
    # Streak mask: a soft line across U, rounded ends along V (sin(pi v) with a period of 2).
    uv = g.node(u.MaterialExpressionTextureCoordinate)
    across = g.node(u.MaterialExpressionMultiply, const_b=2.)
    g.link(g.mask(uv, 'r'), '', across, 'A')
    centred = g.node(u.MaterialExpressionSubtract, const_b=1.)
    g.link(across, '', centred, 'A')
    distance = g.node(u.MaterialExpressionAbs)
    g.link(centred, '', distance, '')
    line = g.node(u.MaterialExpressionOneMinus)
    g.link(distance, '', line, '')
    along = g.node(u.MaterialExpressionSine, period=2.)
    g.link(g.mask(uv, 'g'), '', along, '')
    shape = g.node(u.MaterialExpressionMultiply)
    g.link(line, '', shape, 'A')
    g.link(along, '', shape, 'B')
    # A tight core, a soft skirt, and a bright knot at the leading end. The displacement shader is unchanged.
    square = g.node(u.MaterialExpressionMultiply)
    g.link(line, '', square, 'A')
    g.link(line, '', square, 'B')
    cube = g.node(u.MaterialExpressionMultiply)
    g.link(square, '', cube, 'A')
    g.link(line, '', cube, 'B')
    core = g.node(u.MaterialExpressionMultiply)
    g.link(cube, '', core, 'A')
    g.link(along, '', core, 'B')
    core_gain = g.node(u.MaterialExpressionMultiply, const_b=.85)
    g.link(core, '', core_gain, 'A')
    halo = g.node(u.MaterialExpressionMultiply, const_b=.18)
    g.link(shape, '', halo, 'A')
    lead = g.node(u.MaterialExpressionSubtract, const_b=.12)
    g.link(g.mask(uv, 'g'), '', lead, 'A')
    lead_abs = g.node(u.MaterialExpressionAbs)
    g.link(lead, '', lead_abs, '')
    lead_scale = g.node(u.MaterialExpressionMultiply, const_b=10.)
    g.link(lead_abs, '', lead_scale, 'A')
    lead_inv = g.node(u.MaterialExpressionOneMinus)
    g.link(lead_scale, '', lead_inv, '')
    lead_span = g.node(u.MaterialExpressionClamp, min_default=0., max_default=1.)
    g.link(lead_inv, '', lead_span, '')
    head = g.node(u.MaterialExpressionMultiply)
    g.link(lead_span, '', head, 'A')
    g.link(line, '', head, 'B')
    head_gain = g.node(u.MaterialExpressionMultiply, const_b=.7)
    g.link(head, '', head_gain, 'A')
    # A round head on the 10 cm card. In UV the card is much longer than it is wide, so the
    # circle is flat in v: 4 cm is 0.4 of the width and about 0.065 of a 62 cm streak.
    u_off = g.node(u.MaterialExpressionSubtract, const_b=.5)
    g.link(g.mask(uv, 'r'), '', u_off, 'A')
    v_off = g.node(u.MaterialExpressionSubtract, const_b=.18)
    g.link(g.mask(uv, 'g'), '', v_off, 'A')
    u_n = g.node(u.MaterialExpressionMultiply, const_b=2.5)
    g.link(u_off, '', u_n, 'A')
    v_n = g.node(u.MaterialExpressionMultiply, const_b=15.4)
    g.link(v_off, '', v_n, 'A')
    u2 = g.node(u.MaterialExpressionMultiply)
    g.link(u_n, '', u2, 'A')
    g.link(u_n, '', u2, 'B')
    v2 = g.node(u.MaterialExpressionMultiply)
    g.link(v_n, '', v2, 'A')
    g.link(v_n, '', v2, 'B')
    rad = g.node(u.MaterialExpressionAdd)
    g.link(u2, '', rad, 'A')
    g.link(v2, '', rad, 'B')
    rad_inv = g.node(u.MaterialExpressionOneMinus)
    g.link(rad, '', rad_inv, '')
    disc = g.node(u.MaterialExpressionClamp, min_default=0., max_default=1.)
    g.link(rad_inv, '', disc, '')
    disc_gain = g.node(u.MaterialExpressionMultiply, const_b=.95)
    g.link(disc, '', disc_gain, 'A')
    skirt = g.node(u.MaterialExpressionAdd)
    g.link(core_gain, '', skirt, 'A')
    g.link(halo, '', skirt, 'B')
    body = g.node(u.MaterialExpressionAdd)
    g.link(skirt, '', body, 'A')
    g.link(head_gain, '', body, 'B')
    with_head = g.node(u.MaterialExpressionAdd)
    g.link(body, '', with_head, 'A')
    g.link(disc_gain, '', with_head, 'B')
    opacity = g.node(u.MaterialExpressionMultiply)
    g.link(with_head, '', opacity, 'A')
    g.link(visible, '', opacity, 'B')
    g.connect(opacity, '', u.MaterialProperty.MP_OPACITY)
    mist = g.node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(.55, .64, .74, 1))
    hot = g.node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(.96, .97, 1, 1))
    bright = g.node(u.MaterialExpressionAdd)
    g.link(core, '', bright, 'A')
    g.link(disc, '', bright, 'B')
    bright_span = g.node(u.MaterialExpressionClamp, min_default=0., max_default=1.)
    g.link(bright, '', bright_span, '')
    tint = g.node(u.MaterialExpressionLinearInterpolate)
    g.link(mist, '', tint, 'A')
    g.link(hot, '', tint, 'B')
    g.link(bright_span, '', tint, 'Alpha')
    g.connect(tint, '', u.MaterialProperty.MP_BASE_COLOR)
    g.library.set_base_material_usage(mat, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES, True)
    assert g.library.has_material_usage(mat, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    g.library.recompile_material(mat)
    assert assets.save_loaded_asset(mat)
    return mat, {'asset': RAIN, 'blend_mode': 'translucent', 'two_sided': True,
                 'translucency_lighting_mode': 'volumetric non-directional',
                 'max_world_position_offset_displacement_cm': RAIN_MAX_OFFSET, 'custom_inputs': list(RAIN_INPUTS),
                 'hlsl_sha256': _sha256(RAIN_HLSL), 'base_color': 'lerp mist (.55, .64, .74) to white by the streak core and the round head',
                 'opacity': 'bright core plus soft skirt plus leading knot plus a round head, times the visible-instance mask'}


def wet_ground(u, mat, mpc):
    """Base colour x lerp(1, .5, Wetness); roughness to x.45 when wet and .03 in puddles; flat normal in puddles."""
    g, P, added = Graph(u, mat, mpc), u.MaterialProperty, []
    puddles = []

    def puddle_mask():
        if not puddles:
            mask = g.custom(PUDDLE_HLSL, ('WorldPos', 'Puddles'), u.CustomMaterialOutputType.CMOT_FLOAT1, 'NordSky puddles')
            g.link(g.node(u.MaterialExpressionWorldPosition), '', mask, 'WorldPos')
            g.link(g.parameter('Puddles'), '', mask, 'Puddles')
            puddles.append(mask)
        return puddles[0]

    source, output, wrapped = g.current(P.MP_BASE_COLOR)
    assert source is not None, mat.get_path_name()
    if not wrapped:
        darken = g.node(u.MaterialExpressionLinearInterpolate, const_a=1., const_b=.5)
        g.link(g.parameter('Wetness'), '', darken, 'Alpha')
        root = g.node(u.MaterialExpressionMultiply)
        g.link(source, output, root, 'A')
        g.link(darken, '', root, 'B')
        g.connect(root, '', P.MP_BASE_COLOR)
        added.append('MP_BASE_COLOR')
    source, output, wrapped = g.current(P.MP_ROUGHNESS)
    assert source is not None, mat.get_path_name()
    if not wrapped:
        glossy = g.node(u.MaterialExpressionMultiply, const_b=.45)
        g.link(source, output, glossy, 'A')
        wet = g.node(u.MaterialExpressionLinearInterpolate)
        g.link(source, output, wet, 'A')
        g.link(glossy, '', wet, 'B')
        g.link(g.parameter('Wetness'), '', wet, 'Alpha')
        root = g.node(u.MaterialExpressionLinearInterpolate, const_b=.03)
        g.link(wet, '', root, 'A')
        g.link(puddle_mask(), '', root, 'Alpha')
        g.connect(root, '', P.MP_ROUGHNESS)
        added.append('MP_ROUGHNESS')
    # Materials without a normal input are already flat, so puddles need no normal wrapper there.
    source, output, wrapped = g.current(P.MP_NORMAL)
    if source is not None and not wrapped:
        root = g.node(u.MaterialExpressionLinearInterpolate)
        g.link(source, output, root, 'A')
        g.link(g.node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(0, 0, 1, 1)), '', root, 'B')
        g.link(puddle_mask(), '', root, 'Alpha')
        g.connect(root, '', P.MP_NORMAL)
        added.append('MP_NORMAL')
    return added


def night_window(u, mat, mpc):
    """Emissive x WindowGlow, so lit windows and tail lights read at night and in gloom."""
    g = Graph(u, mat, mpc)
    source, output, wrapped = g.current(u.MaterialProperty.MP_EMISSIVE_COLOR)
    assert source is not None, mat.get_path_name()
    if wrapped:
        return []
    root = g.node(u.MaterialExpressionMultiply)
    g.link(source, output, root, 'A')
    g.link(g.parameter('WindowGlow'), '', root, 'B')
    g.connect(root, '', u.MaterialProperty.MP_EMISSIVE_COLOR)
    return ['MP_EMISSIVE_COLOR']


def exposure(u, mat, mpc):
    """Daylight-calibrated emission, including lit crew fill, follows the exposure."""
    g = Graph(u, mat, mpc)
    source, output, wrapped = g.current(u.MaterialProperty.MP_EMISSIVE_COLOR)
    assert source is not None, mat.get_path_name()
    if wrapped:
        return []
    night = g.node(u.MaterialExpressionMultiply, const_b=1.5)
    g.link(g.parameter('NightFactor'), '', night, 'A')
    lift = g.node(u.MaterialExpressionAdd, const_b=1.)
    g.link(night, '', lift, 'A')
    scale = g.node(u.MaterialExpressionMultiply)
    g.link(lift, '', scale, 'A')
    g.link(g.parameter('ExposureScale'), '', scale, 'B')
    root = g.node(u.MaterialExpressionMultiply)
    g.link(source, output, root, 'A')
    g.link(scale, '', root, 'B')
    g.connect(root, '', u.MaterialProperty.MP_EMISSIVE_COLOR)
    return ['MP_EMISSIVE_COLOR']


def pond_state(u, root):
    """Label, mesh, material and location of every surveyed pond actor; authoring must not change them."""
    park = json.loads((Path(root) / 'Data/Plateau/ParkGeometry/park.json').read_text())
    names = sorted(name for name, batch in park['materials'].items() if batch['material'] == 'PondWater')
    assert len(names) == 15, 'Expected the 15 surveyed pond batches'
    actors = {actor.get_actor_label(): actor for actor in
              u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()}
    state = {}
    for name in names:
        actor = actors.get('Plateau park ' + name)
        assert actor, 'Missing pond actor ' + name
        component, location = actor.static_mesh_component, actor.get_actor_location()
        state[name] = {'mesh': component.static_mesh.get_path_name(), 'material': component.get_material(0).get_path_name(),
                       'location': [location.x, location.y, location.z]}
        assert state[name]['mesh'] == '/Game/Plateau/Park/SM_' + name + '.SM_' + name, name
        assert state[name]['material'] == plateau_water.MATERIAL + '.M_PondWater', name
    return state


def _reachable(u, mat, properties):
    """Every expression feeding the given properties, following inputs to the leaves."""
    library = u.MaterialEditingLibrary
    pending = [library.get_material_property_input_node(mat, getattr(u.MaterialProperty, prop)) for prop in properties]
    seen = []
    while pending:
        node = pending.pop()
        if node is None or node in seen:
            continue
        seen.append(node)
        pending.extend(library.get_inputs_for_material_expression(mat, node))
    return seen


def _parameters(u, mat, properties, mpc):
    """Names of the distinct MPC_NordAtmosphere parameter nodes feeding the properties."""
    return sorted(str(node.get_editor_property('parameter_name')) for node in _reachable(u, mat, properties)
                  if isinstance(node, u.MaterialExpressionCollectionParameter) and node.get_editor_property('collection') == mpc)


def _readback(u, mat):
    library = u.MaterialEditingLibrary
    result = {name: str(mat.get_editor_property(name)) for name in ('blend_mode', 'shading_model')}
    for prop in ('MP_BASE_COLOR', 'MP_NORMAL', 'MP_ROUGHNESS', 'MP_EMISSIVE_COLOR'):
        node = library.get_material_property_input_node(mat, getattr(u.MaterialProperty, prop))
        result[prop] = node.get_class().get_name() if node else None
    return result


def verify(u, root=ROOT, map_sha256=None):
    """Fresh-load read-backs of everything apply() writes, and the map bytes it must not change."""
    root = Path(root)
    if map_sha256 is None:
        map_sha256 = json.loads((root / REPORT).read_text())['map_sha256']
    assert _sha256(root / MAP) == map_sha256, 'The map changed after sky and water authoring'
    return {'passed': True, 'map_sha256': map_sha256} | verify_assets(u, root)


def verify_assets(u, root=ROOT):
    """The asset read-backs alone. verify_plateau.py runs them after a full Plateau regeneration, which
    saves the map and rebuilds the wet-ground and window materials (plateau_surfaces rewraps them)."""
    root = Path(root)
    assets, library, P = u.EditorAssetLibrary, u.MaterialEditingLibrary, u.MaterialProperty
    mpc = assets.load_asset(COLLECTION)
    assert isinstance(mpc, u.MaterialParameterCollection), COLLECTION
    scalars = {str(entry.get_editor_property('parameter_name')): entry.get_editor_property('default_value')
               for entry in mpc.get_editor_property('scalar_parameters')}
    for name, default in PARAMETERS:
        assert name in scalars and abs(scalars[name] - default) < 1e-6, ('Collection parameter', name, scalars.get(name))

    texture = assets.load_asset(plateau_water.TEXTURE)
    assert isinstance(texture, u.Texture2D), plateau_water.TEXTURE
    assert not texture.get_editor_property('srgb')
    assert texture.get_editor_property('compression_settings') == u.TextureCompressionSettings.TC_BC7
    assert texture.get_editor_property('address_x') == u.TextureAddress.TA_CLAMP
    assert texture.get_editor_property('address_y') == u.TextureAddress.TA_CLAMP

    water = assets.load_asset(plateau_water.MATERIAL)
    assert isinstance(water, u.Material), plateau_water.MATERIAL
    assert water.get_editor_property('blend_mode') == u.BlendMode.BLEND_OPAQUE
    assert water.get_editor_property('shading_model') == u.MaterialShadingModel.MSM_DEFAULT_LIT
    assert not water.get_editor_property('tangent_space_normal')
    customs = [n for n in library.get_material_expressions(water) if isinstance(n, u.MaterialExpressionCustom)]
    assert len(customs) == 1 and customs[0].get_editor_property('code') == plateau_water.HLSL.read_text(), 'Pond shader body differs'
    assert [str(e.get_editor_property('input_name')) for e in customs[0].get_editor_property('inputs')] == list(plateau_water.INPUTS)
    feeding = _reachable(u, water, ('MP_BASE_COLOR', 'MP_NORMAL', 'MP_ROUGHNESS'))
    assert customs[0] in feeding, 'Pond shader is not connected'
    assert any(isinstance(n, u.MaterialExpressionTextureSample) and n.get_editor_property('texture') == texture for n in feeding)
    assert _parameters(u, water, ('MP_BASE_COLOR', 'MP_NORMAL', 'MP_ROUGHNESS'), mpc) == sorted(
        parameter for _, parameter, _ in plateau_water.WEATHER), 'Pond weather inputs'
    for prop, value in (('MP_SPECULAR', .25), ('MP_METALLIC', 0.)):
        node = library.get_material_property_input_node(water, getattr(P, prop))
        assert isinstance(node, u.MaterialExpressionConstant) and abs(node.get_editor_property('r') - value) < 1e-6, prop
    assert isinstance(library.get_material_property_input_node(water, P.MP_NORMAL), u.MaterialExpressionNormalize)
    # The shader fades waves by their size on screen, from the pixel derivatives, and owns the roughness.
    pins = library.get_inputs_for_material_expression(water, customs[0])
    assert all(any(isinstance(n, cls) for n in pins) for cls in (u.MaterialExpressionDDX, u.MaterialExpressionDDY)), \
        'Pond shader has no pixel derivatives'
    rough = library.get_material_property_input_node(water, P.MP_ROUGHNESS)
    assert (isinstance(rough, u.MaterialExpressionComponentMask) and list(library.get_inputs_for_material_expression(water, rough)) == [customs[0]]
            and [rough.get_editor_property(c) for c in 'rgba'] == [False, False, False, True]), 'Pond roughness must come from the shader'
    ponds = pond_state(u, root)

    rain = assets.load_asset(RAIN)
    assert isinstance(rain, u.Material), RAIN
    assert rain.get_editor_property('blend_mode') == u.BlendMode.BLEND_TRANSLUCENT and rain.get_editor_property('two_sided')
    assert rain.get_editor_property('translucency_lighting_mode') == u.TranslucencyLightingMode.TLM_VOLUMETRIC_NON_DIRECTIONAL
    displacement = rain.get_editor_property('max_world_position_offset_displacement')
    assert abs(displacement - RAIN_MAX_OFFSET) < 1e-3, ('Rain offset culling bounds', displacement)
    assert library.has_material_usage(rain, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    offset = _reachable(u, rain, ('MP_WORLD_POSITION_OFFSET',))
    assert any(isinstance(n, u.MaterialExpressionCustom) and n.get_editor_property('code') == RAIN_HLSL.read_text() for n in offset)
    assert library.get_material_property_input_node(rain, P.MP_OPACITY) is not None
    assert _parameters(u, rain, ('MP_WORLD_POSITION_OFFSET', 'MP_OPACITY'), mpc) == sorted(
        ['RainIntensity', 'WindStrength', 'WindDirX', 'WindDirY'])

    wrapped = {}
    for kind, paths in (('wet', WET), ('window', WINDOWS), ('exposure', UNLIT)):
        for path in paths:
            mat = assets.load_asset(path)
            assert isinstance(mat, u.Material), path
            expected = []
            for prop, names in WRAPPERS[kind].items():
                node = library.get_material_property_input_node(mat, getattr(P, prop))
                if prop == 'MP_NORMAL' and (node is None or str(node.get_editor_property('desc')) != MARKER):
                    # A flat material has no normal input; a normal input must be wrapped.
                    assert node is None, (path, 'unwrapped normal')
                    continue
                assert node is not None and str(node.get_editor_property('desc')) == MARKER, (path, prop, 'not wrapped')
                assert _parameters(u, mat, (prop,), mpc) == sorted(names), (path, prop, 'wrapper missing or doubled')
                expected += names
            # The wrapper kinds stay on their own materials, and no stray marked node remains.
            assert set(_parameters(u, mat, PROPERTIES, mpc)) == set(expected), (path, 'unexpected wrapper')
            used = _reachable(u, mat, PROPERTIES)
            assert all(n in used for n in library.get_material_expressions(mat)
                       if str(n.get_editor_property('desc')) == MARKER), (path, 'orphaned NordSky node')
            wrapped[path] = {'readback': _readback(u, mat), 'parameters': sorted(set(expected))}
    return {'passed': True, 'collection': scalars, 'pond_actors': len(ponds), 'pond': _readback(u, water),
            'rain': _readback(u, rain) | {'max_world_position_offset_displacement': displacement}, 'wrappers': wrapped}


def apply(u, root=ROOT):
    root = Path(root)
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    session = begin(u, root, TOUCHED)
    ponds = pond_state(u, root)
    mpc, collection_report = collection(u)
    texture, manifest = plateau_water.import_texture(u, root / 'Data/Plateau/WaterGeometry')
    water = assets.load_asset(plateau_water.MATERIAL)
    assert isinstance(water, u.Material), plateau_water.MATERIAL
    water_report = plateau_water.author(u, water, texture, manifest, mpc)
    assert assets.save_loaded_asset(water)
    _, rain_report = rain_material(u, mpc)
    wrappers = {}
    for build, paths in ((wet_ground, WET), (night_window, WINDOWS), (exposure, UNLIT)):
        for path in paths:
            mat = assets.load_asset(path)
            assert isinstance(mat, u.Material), path
            wrappers[path] = build(u, mat, mpc)
            if wrappers[path]:
                library.recompile_material(mat)
                assert assets.save_loaded_asset(mat), path
    assert pond_state(u, root) == ponds, 'Pond actors changed'
    finish(session)
    checked = verify(u, root, session['map_sha256'])
    report = {'passed': True, 'rendered_acceptance_pending': True, 'backup': session['backup'],
              'map_sha256': session['map_sha256'], 'backed_up_files': len(session['manifest']['files']),
              'created_assets': session['manifest']['absent_before'], 'collection': collection_report,
              'shore_texture': {'asset': plateau_water.TEXTURE, 'png_sha256': manifest['png_sha256'],
                                'bounds_cm': manifest['bounds_cm']},
              'pond_water': water_report, 'pond_actors_unchanged': len(ponds), 'rain': rain_report,
              'wrapped_this_run': wrappers, 'verify': checked}
    output = root / REPORT
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    u.log('NORD_SKY_WATER_AUTHORED ' + json.dumps({'backup': session['backup'], 'map_sha256': session['map_sha256'],
                                                   'wrapped_this_run': sum(map(len, wrappers.values()))}))
    return report


if __name__ == '__main__':
    import unreal
    if 'verify' in sys.argv[1:]:
        unreal.log('NORD_SKY_WATER_VERIFIED ' + json.dumps(verify(unreal)))
    else:
        apply(unreal)
