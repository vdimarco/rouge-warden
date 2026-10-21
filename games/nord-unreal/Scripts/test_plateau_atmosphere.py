"""CPU checks for the bounded sky and water authoring against the recording Unreal facade."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

import plateau_atmosphere as atmosphere
import plateau_water
from test_plateau_water import Actor, FakeUnreal, Material, MaterialParameterCollection, CollectionScalarParameter, evaluate, material_with

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = {}


def textured(node, link, connect):
    coordinates = node('TextureCoordinate')
    samples = {role: node('TextureSample') for role in ('diff', 'nor', 'rough')}
    for sample in samples.values():
        link(coordinates, '', sample, '')
    tint = node('Multiply')
    link(samples['diff'], 'RGB', tint, 'A')
    link(node('Constant3Vector', constant=(.8, .8, .8, 1)), '', tint, 'B')
    connect(tint, '', 'MP_BASE_COLOR')
    connect(samples['nor'], 'RGB', 'MP_NORMAL')
    connect(samples['rough'], 'R', 'MP_ROUGHNESS')
    connect(node('Constant', r=0.), '', 'MP_METALLIC')


def flat(emissive=False):
    def build(node, link, connect):
        tint = node('Constant3Vector', constant=(.7, .55, .3, 1))
        connect(tint, '', 'MP_BASE_COLOR')
        if emissive:
            connect(tint, '', 'MP_EMISSIVE_COLOR')
        connect(node('Constant', r=.8), '', 'MP_ROUGHNESS')
        connect(node('Constant', r=0.), '', 'MP_METALLIC')
    return build


def unlit(source):
    def build(node, link, connect):
        first = node(source)
        scale = node('Multiply', const_b=3500.)
        link(first, 'RGB' if source == 'TextureSample' else '', scale, 'A')
        connect(scale, '', 'MP_EMISSIVE_COLOR')
    return build


def scene(directory, output_names=True, collection=None):
    """A saved LaFontaine project in miniature: the map, the touched materials, the data and 15 pond actors."""
    root = Path(directory)
    u = FakeUnreal(root, output_names)
    (root / 'Content/Maps').mkdir(parents=True)
    (root / atmosphere.MAP).write_bytes(b'LaFontaine map bytes\n')
    for relative in ('Data/Plateau/WaterGeometry/pond_shore.png', 'Data/Plateau/WaterGeometry/water.json',
                     'Data/Plateau/ParkGeometry/park.json'):
        (root / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, root / relative)
    water = material_with(u, plateau_water.MATERIAL, flat())
    for path in atmosphere.WET:
        material_with(u, path, flat() if path.endswith('ConcreteDark') else textured)
    for path in atmosphere.WINDOWS:
        material_with(u, path, flat(emissive=True))
    material_with(u, '/Game/Materials/M_Glow', unlit('VectorParameter'))
    material_with(u, '/Game/ParkComic/M_Paper', unlit('Constant3Vector'))
    material_with(u, '/Game/ParkComic/M_Text', unlit('LinearInterpolate'))
    for name in ('Crew', 'Brawl'):
        material_with(u, '/Game/ParkComic/M_Illustration' + name, unlit('TextureSample'))
    for style in range(3, 11):
        material_with(u, f'/Game/ParkComic/Crew/Resident{style}/M_Crew', flat(emissive=True))
    material_with(u, '/Game/Plateau/Materials/M_ParkGrass', textured)
    (root / 'Content/Plateau/Materials/M_Asphalt.uexp').write_bytes(b'bulk asphalt\n')
    if collection:
        mpc = MaterialParameterCollection(plateau_water.COLLECTION)
        mpc.set_editor_property('scalar_parameters', collection)
        u.EditorAssetLibrary.store[plateau_water.COLLECTION] = mpc
        u.EditorAssetLibrary.save_loaded_asset(mpc)
    park = json.loads((root / 'Data/Plateau/ParkGeometry/park.json').read_text())
    for name in sorted(n for n, batch in park['materials'].items() if batch['material'] == 'PondWater'):
        u.actors.append(Actor('Plateau park ' + name, '/Game/Plateau/Park/SM_' + name, water, (0., 0., 0.)))
    u.actors.append(Actor('Plateau park Iron_0', '/Game/Plateau/Park/SM_Iron_0', None))
    u.EditorAssetLibrary.saves.clear()
    return root, u


def files(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted((root / 'Content').rglob('*')) if p.is_file() and not p.name.endswith('.umap')}


def parameters(u, path, properties=atmosphere.PROPERTIES):
    mat = u.EditorAssetLibrary.store[path]
    mpc = u.EditorAssetLibrary.store[plateau_water.COLLECTION]
    return atmosphere._parameters(u, mat, properties, mpc)


def marked(u, path):
    return sum(n.get_editor_property('desc') == 'NordSky' for n in u.EditorAssetLibrary.store[path].expressions)


def rejects(action, words):
    try:
        action()
    except AssertionError as error:
        assert words.lower() in ' '.join(map(str, error.args)).lower(), (words, error.args)
        return
    raise AssertionError('Accepted: ' + words)


def check_first_and_second_run():
    with tempfile.TemporaryDirectory() as temporary:
        root, u = scene(temporary)
        # Reproduce UE 5.8's skipped nodes when DeleteAll mutates its live expression array.
        def broken_delete_all(mat):
            for node in mat.expressions:
                u.MaterialEditingLibrary.delete_material_expression(mat, node)
        u.MaterialEditingLibrary.delete_all_material_expressions = broken_delete_all
        before = files(root)
        map_bytes = (root / atmosphere.MAP).read_bytes()
        report = atmosphere.apply(u, root)
        assert report['passed'] and report['verify']['passed'] and report['pond_actors_unchanged'] == 15
        assert any(text.startswith('NORD_SKY_WATER_AUTHORED ') for text in u.logs)
        assert json.loads((root / atmosphere.REPORT).read_text())['map_sha256'] == hashlib.sha256(map_bytes).hexdigest()
        assert (root / atmosphere.MAP).read_bytes() == map_bytes

        # Recovery: every touched file that existed is copied with its hash; new assets are listed as absent.
        backup = root / report['backup']
        assert backup.name.startswith('sky-water-') and backup.parent == root / 'Saved/Recovery'
        manifest = json.loads((backup / 'manifest.json').read_text())
        touched = {key: value for key, value in before.items() if any(
            key.startswith('Content/' + asset.removeprefix('/Game/') + '.') for asset in atmosphere.TOUCHED)}
        assert manifest['files'] == touched and len(touched) == 23, manifest['files']
        assert all(hashlib.sha256((backup / key).read_bytes()).hexdigest() == value for key, value in touched.items())
        assert manifest['absent_before'] == [atmosphere.COLLECTION, plateau_water.TEXTURE, atmosphere.RAIN]
        assert 'Content/Plateau/Materials/M_ParkGrass.uasset' not in manifest['files']

        assets = u.EditorAssetLibrary
        mpc = assets.store[atmosphere.COLLECTION]
        scalars = mpc.get_editor_property('scalar_parameters')
        assert [(s.get_editor_property('parameter_name'), s.get_editor_property('default_value')) for s in scalars] == list(atmosphere.PARAMETERS)
        guids = [s.guid for s in scalars]
        texture = assets.store[plateau_water.TEXTURE]
        assert (texture.get_editor_property('srgb'), texture.get_editor_property('compression_settings'),
                texture.get_editor_property('address_x'), texture.get_editor_property('address_y')) == (False, 'TC_BC7', 'TA_CLAMP', 'TA_CLAMP')
        assert texture.source == json.loads((root / 'Data/Plateau/WaterGeometry/water.json').read_text())['png_sha256']

        # Each wrapper lands on its own materials only.
        for path in atmosphere.WET:
            textured_input = not path.endswith('ConcreteDark')
            assert report['wrapped_this_run'][path] == ['MP_BASE_COLOR', 'MP_ROUGHNESS'] + ['MP_NORMAL'] * textured_input
            assert parameters(u, path) == ['Puddles', 'Wetness', 'Wetness'], (path, parameters(u, path))
        for path in atmosphere.WINDOWS:
            assert report['wrapped_this_run'][path] == ['MP_EMISSIVE_COLOR'] and parameters(u, path) == ['WindowGlow']
        for path in atmosphere.UNLIT:
            assert report['wrapped_this_run'][path] == ['MP_EMISSIVE_COLOR'] and parameters(u, path) == ['ExposureScale', 'NightFactor']
        assert parameters(u, plateau_water.MATERIAL) == ['RainIntensity', 'WindDirX', 'WindDirY', 'WindStrength']
        assert marked(u, plateau_water.MATERIAL) == 0 and marked(u, atmosphere.RAIN) == 0
        grass = assets.store['/Game/Plateau/Materials/M_ParkGrass']
        assert len(grass.expressions) == 7 and grass.compiles == 0 and '/Game/Plateau/Materials/M_ParkGrass' not in assets.saves

        # Defaults keep the daytime look; the parameters move it at night and in rain.
        library = u.MaterialEditingLibrary
        defaults = dict(atmosphere.PARAMETERS)
        glow = library.get_material_property_input_node(assets.store['/Game/Materials/M_Glow'], 'MP_EMISSIVE_COLOR')
        assert type(glow.links['A'][0]).KIND == 'Multiply' and glow.links['A'][0].get_editor_property('const_b') == 3500.
        factor = glow.links['B'][0]
        assert evaluate(factor, '', defaults) == 1.
        night = evaluate(factor, '', defaults | {'NightFactor': 1., 'ExposureScale': 2. ** -9})
        assert abs(night - 2.5 * 2. ** -9) < 1e-15
        for style in range(3, 11):
            mat = assets.store[f'/Game/ParkComic/Crew/Resident{style}/M_Crew']
            emission = library.get_material_property_input_node(mat, 'MP_EMISSIVE_COLOR')
            base = library.get_material_property_input_node(mat, 'MP_BASE_COLOR')
            assert emission.links['A'][0] is base, 'Crew base colour changed'
            assert evaluate(emission.links['B'][0], '', defaults) == 1.
            assert abs(evaluate(emission.links['B'][0], '', defaults | {'NightFactor': 1., 'ExposureScale': 2. ** -9}) - night) < 1e-15
        window = library.get_material_property_input_node(assets.store[atmosphere.WINDOWS[0]], 'MP_EMISSIVE_COLOR')
        assert evaluate(window, '', defaults | {'source': .7}) == .7 and evaluate(window, '', defaults | {'source': .7, 'WindowGlow': 12.}) == .7 * 12.
        asphalt = assets.store[atmosphere.WET[0]]
        base = library.get_material_property_input_node(asphalt, 'MP_BASE_COLOR')
        rough = library.get_material_property_input_node(asphalt, 'MP_ROUGHNESS')
        for wetness, puddles, colour, roughness in ((0., 0., 1., .8), (1., 0., .5, .36), (1., 1., .5, .03), (.5, 0., .75, .58)):
            values = defaults | {'source': 1., 'Wetness': wetness}
            assert abs(evaluate(base, '', values) - colour) < 1e-12
            puddle = next(n for n in asphalt.expressions if type(n).KIND == 'Custom')
            assert puddle.get_editor_property('code') == atmosphere.PUDDLE_HLSL.read_text() and puddle.pins() == ('WorldPos', 'Puddles')
            values = values | {'source': .8, 'custom': (puddles,)}
            assert abs(evaluate(rough, '', values) - roughness) < 1e-12, (wetness, puddles, evaluate(rough, '', values))
        glossy = next(n for n in asphalt.expressions if type(n).KIND == 'Multiply' and n.get_editor_property('const_b') == .45)
        assert glossy.links['A'][1] == 'R', 'Roughness must keep reading the texture R channel'
        normal = library.get_material_property_input_node(asphalt, 'MP_NORMAL')
        assert normal.links['A'][1] == 'RGB' and normal.links['B'][0].get_editor_property('constant') == (0, 0, 1, 1)

        rain = assets.store[atmosphere.RAIN]
        assert (rain.get_editor_property('blend_mode'), rain.get_editor_property('two_sided'),
                rain.get_editor_property('translucency_lighting_mode')) == ('BLEND_TRANSLUCENT', True, 'TLM_VOLUMETRIC_NON_DIRECTIONAL')
        # Streaks are drawn up to 1.5 boxes from their pivot; the WPO limit must cover that on each axis.
        assert rain.get_editor_property('max_world_position_offset_displacement') == atmosphere.RAIN_MAX_OFFSET >= 1.5 * 2000 + 25
        assert report['rain']['max_world_position_offset_displacement_cm'] == atmosphere.RAIN_MAX_OFFSET
        assert report['verify']['rain']['max_world_position_offset_displacement'] == atmosphere.RAIN_MAX_OFFSET
        assert 'MATUSAGE_INSTANCED_STATIC_MESHES' in rain.usages
        streak = next(n for n in rain.expressions if type(n).KIND == 'Custom')
        assert streak.get_editor_property('code') == (ROOT / 'Scripts/rain_streak.hlsl').read_text()
        assert streak.pins() == atmosphere.RAIN_INPUTS
        assert {pin: type(streak.links[pin][0]).KIND for pin in ('Pivot', 'WorldPos', 'CameraPos', 'Time', 'Rand')} == {
            'Pivot': 'ObjectPositionWS', 'WorldPos': 'WorldPosition', 'CameraPos': 'CameraPositionWS', 'Time': 'Time', 'Rand': 'PerInstanceRandom'}
        offset = library.get_material_property_input_node(rain, 'MP_WORLD_POSITION_OFFSET')
        assert offset.links['Input'][0] is streak and [offset.get_editor_property(c) for c in 'rgba'] == [True, True, True, False]
        opacity = library.get_material_property_input_node(rain, 'MP_OPACITY')
        interpolator = opacity.links['B'][0]
        assert type(interpolator).KIND == 'VertexInterpolator' and interpolator.links['VS'][0].get_editor_property('a')
        tint = library.get_material_property_input_node(rain, 'MP_BASE_COLOR')
        assert type(tint).KIND == 'LinearInterpolate'
        assert tint.links['A'][0].get_editor_property('constant') == (.55, .64, .74, 1)
        assert tint.links['B'][0].get_editor_property('constant') == (.96, .97, 1, 1)
        assert tint.links['Alpha'][0] is not None

        counts = {path: len(assets.store[path].expressions) for path in atmosphere.TOUCHED[2:]}
        saves = len(assets.saves)
        again = atmosphere.apply(u, root)
        assert again['passed'] and not any(again['wrapped_this_run'].values()), again['wrapped_this_run']
        assert {path: len(assets.store[path].expressions) for path in atmosphere.TOUCHED[2:]} == counts, 'A second run added nodes'
        assert [s.guid for s in mpc.get_editor_property('scalar_parameters')] == guids and not again['collection']['created']
        second = json.loads((root / again['backup'] / 'manifest.json').read_text())
        assert second['absent_before'] == [] and len(second['files']) == len(touched) + 3
        assert len(assets.saves) - saves == 5, assets.saves[saves:]
        assert atmosphere.verify(u, root)['passed'], 'verify() must read the map hash from the report'
        assert (root / atmosphere.MAP).read_bytes() == map_bytes
        return sum(counts.values()), len(touched)


def check_fallbacks():
    """Older editors without output names, an existing collection and the standalone water pass."""
    with tempfile.TemporaryDirectory() as temporary:
        existing = CollectionScalarParameter()
        existing.set_editor_property('parameter_name', 'WindStrength')
        existing.set_editor_property('default_value', .5)
        extra = CollectionScalarParameter()
        extra.set_editor_property('parameter_name', 'Foo')
        root, u = scene(temporary, output_names=False, collection=[existing, extra])
        assert not hasattr(u.MaterialEditingLibrary, 'get_material_property_input_node_output_name')
        report = atmosphere.apply(u, root)
        scalars = u.EditorAssetLibrary.store[atmosphere.COLLECTION].get_editor_property('scalar_parameters')
        names = [s.get_editor_property('parameter_name') for s in scalars]
        assert names[:2] == ['WindStrength', 'Foo'] and len(names) == 11
        assert scalars[0].guid == existing.guid and scalars[0].get_editor_property('default_value') == .25
        assert report['collection']['other_parameters'] == ['Foo'] and not report['collection']['created']
        asphalt = u.EditorAssetLibrary.store[atmosphere.WET[0]]
        glossy = next(n for n in asphalt.expressions if type(n).KIND == 'Multiply' and n.get_editor_property('const_b') == .45)
        assert glossy.links['A'][1] == 'R'

    with tempfile.TemporaryDirectory() as temporary:
        root, u = scene(temporary)
        report = plateau_water.apply(u, root)
        assert report['collection'] is None and report['shore_texture'] == plateau_water.TEXTURE + '.T_PondShore'
        manifest = json.loads((root / report['backup'] / 'manifest.json').read_text())
        assert list(manifest['files']) == ['Content/Plateau/Materials/M_PondWater.uasset']
        assert manifest['absent_before'] == [plateau_water.TEXTURE]
        assert not u.EditorAssetLibrary.does_asset_exist(atmosphere.COLLECTION)


def check_guards():
    with tempfile.TemporaryDirectory() as temporary:
        root, u = scene(temporary)
        u.pie = ['PIE world']
        rejects(lambda: atmosphere.apply(u, root), 'Stop PIE')
        u.pie, u.world = [], '/Game/Maps/Quebec.Quebec'
        rejects(lambda: atmosphere.apply(u, root), 'LaFontaine')
        assert not (root / 'Saved/Recovery').exists() and not u.EditorAssetLibrary.saves

        u.world = atmosphere.WORLD
        u.actors = u.actors[1:]
        rejects(lambda: atmosphere.apply(u, root), 'Missing pond actor')

    with tempfile.TemporaryDirectory() as temporary:
        root, u = scene(temporary)
        def write_map(asset):
            if asset.path == atmosphere.RAIN:
                (root / atmosphere.MAP).write_bytes(b'changed')
        u.EditorAssetLibrary.after_save = write_map
        rejects(lambda: atmosphere.apply(u, root), 'wrote the map')
        assert not (root / atmosphere.REPORT).exists()


def check_verify_rejects():
    """verify() must catch doubled, missing, stray and misplaced wrappers and a changed collection or pond."""
    def corrupt(change, words):
        with tempfile.TemporaryDirectory() as temporary:
            root, u = scene(temporary)
            atmosphere.apply(u, root)
            change(root, u)
            rejects(lambda: atmosphere.verify(u, root), words)

    def double(root, u):
        mat = u.EditorAssetLibrary.store[atmosphere.WINDOWS[0]]
        u.MaterialEditingLibrary.get_material_property_input_node(mat, 'MP_EMISSIVE_COLOR').set_editor_property('desc', '')
        atmosphere.night_window(u, mat, u.EditorAssetLibrary.store[atmosphere.COLLECTION])

    def unwrap(root, u):
        mat = u.EditorAssetLibrary.store[atmosphere.UNLIT[1]]
        node = u.MaterialEditingLibrary.get_material_property_input_node(mat, 'MP_EMISSIVE_COLOR')
        u.MaterialEditingLibrary.connect_material_property(node.links['A'][0], '', 'MP_EMISSIVE_COLOR')

    def stray(root, u):
        mat = u.EditorAssetLibrary.store[atmosphere.WET[2]]
        u.MaterialEditingLibrary.create_material_expression(mat, u.MaterialExpressionMultiply).set_editor_property('desc', 'NordSky')

    def misplaced(root, u):
        # A window wrapper on a wet-ground material must be reported even though each wet wrapper is intact.
        mat = u.EditorAssetLibrary.store[atmosphere.WET[2]]
        tint = next(n for n in mat.expressions if type(n).KIND == 'Constant3Vector' and n.get_editor_property('desc') == '')
        u.MaterialEditingLibrary.connect_material_property(tint, '', 'MP_EMISSIVE_COLOR')
        atmosphere.night_window(u, mat, u.EditorAssetLibrary.store[atmosphere.COLLECTION])

    def default(root, u):
        u.EditorAssetLibrary.store[atmosphere.COLLECTION].get_editor_property('scalar_parameters')[1].set_editor_property('default_value', 3.)

    def pond(root, u):
        water = u.EditorAssetLibrary.store[plateau_water.MATERIAL]
        next(n for n in water.expressions if type(n).KIND == 'Custom').set_editor_property('code', 'return 0;')

    def actor(root, u):
        u.actors[0].static_mesh_component.get_material = lambda index: Material('/Game/Plateau/Materials/M_Other')

    def culling(root, u):
        u.EditorAssetLibrary.store[atmosphere.RAIN].set_editor_property('max_world_position_offset_displacement', 0.)

    def roughness(root, u):
        # A pond whose roughness no longer comes from the shader would sparkle far away again.
        water = u.EditorAssetLibrary.store[plateau_water.MATERIAL]
        u.MaterialEditingLibrary.connect_material_property(
            u.MaterialEditingLibrary.create_material_expression(water, u.MaterialExpressionConstant), '', 'MP_ROUGHNESS')

    def derivatives(root, u):
        water = u.EditorAssetLibrary.store[plateau_water.MATERIAL]
        custom = next(n for n in water.expressions if type(n).KIND == 'Custom')
        u.MaterialEditingLibrary.connect_material_expressions(
            u.MaterialEditingLibrary.create_material_expression(water, u.MaterialExpressionConstant3Vector), '', custom, 'WorldDX')

    def map_file(root, u):
        (root / atmosphere.MAP).write_bytes(b'changed later')

    for change, words in ((double, 'doubled'), (unwrap, 'not wrapped'), (stray, 'orphaned'), (misplaced, 'unexpected wrapper'),
                          (default, 'Collection parameter'), (pond, 'Pond shader'), (actor, ''), (map_file, 'map changed'),
                          (culling, 'culling bounds'), (roughness, 'roughness'), (derivatives, 'derivatives')):
        corrupt(change, words)
    return 11


def check_regeneration():
    """A full Plateau regeneration rebuilds the wet-ground and window materials; plateau_surfaces rewraps them."""
    import ast
    import plateau_surfaces
    from types import SimpleNamespace
    from test_plateau_water import Object, regenerated
    with tempfile.TemporaryDirectory() as temporary:
        root, u = scene(temporary)
        atmosphere.apply(u, root)
        syntax = ast.parse((ROOT / 'Scripts/upgrade_plateau.py').read_text())
        helpers = [n for n in syntax.body if isinstance(n, ast.FunctionDef) and n.name in ('expression', 'material')]
        scope = {'M': u.MaterialEditingLibrary, 'assets': u.EditorAssetLibrary, 'tools': u.tools, 'u': u}
        exec(compile(ast.Module(body=helpers, type_ignores=[]), 'upgrade_plateau.py', 'exec'), scope)
        materials = {'Leaf': scope['material']('Leaf', (.12, .24, .075))}
        for name, (color, texture) in regenerated(syntax).items():
            materials[name] = scope['material'](name, color, texture, emissive=name in ('Glow', 'Tail', 'InteriorWarm'))
        # Before plateau_surfaces runs, the rebuilt materials have lost their wrappers and the read-backs say so.
        rejects(lambda: atmosphere.verify_assets(u, root), 'not wrapped')
        cloud = Object(material=None, layer_bottom_altitude=0., layer_height=0.)
        cloud.set_material = lambda mat: cloud.set_editor_property('material', mat)
        u.VolumetricCloud = type('VolumetricCloud', (), {})
        u.VolumetricCloudComponent = u.ExponentialHeightFog = u.SkyLight = type('Other', (), {})

        def spawn(cls, location):
            actor = cls()
            actor.set_actor_label = actor.set_folder_path = lambda value: None
            actor.get_component_by_class = lambda component_class: cloud
            return actor
        u.get_editor_subsystem = lambda cls: SimpleNamespace(get_all_level_actors=lambda: list(u.actors), spawn_actor_from_class=spawn)
        report = plateau_surfaces.apply(u, materials, scope['expression'], scope['material'])
        assert sorted(report['nord_sky_rewrapped']) == sorted(atmosphere.WET + atmosphere.WINDOWS)
        checked = atmosphere.verify_assets(u, root)
        assert checked['passed'] and checked['pond_actors'] == 15 and len(checked['wrappers']) == 21
        assert atmosphere.verify(u, root)['passed']
        # A second regeneration pass adds nothing.
        counts = {path: len(u.EditorAssetLibrary.store[path].expressions) for path in atmosphere.WET + atmosphere.WINDOWS}
        assert not any(plateau_surfaces.rewrap(u).values())
        assert counts == {path: len(u.EditorAssetLibrary.store[path].expressions) for path in counts}
        return len(report['nord_sky_rewrapped'])


def main():
    nodes, backed_up = check_first_and_second_run()
    check_fallbacks()
    check_guards()
    corruptions = check_verify_rejects()
    rewrapped = check_regeneration()
    print(f'Sky and water authoring checks passed: {backed_up} pre-existing files backed up with SHA-256, '
          f'{nodes} nodes stable on a second run, wrappers on 5 wet / 3 window / 13 emissive materials only; '
          f'PIE, wrong map, missing pond actors and a written map rejected; {corruptions} verify corruptions rejected; '
          f'a Plateau regeneration rewraps {rewrapped} rebuilt materials')


if __name__ == '__main__':
    main()
