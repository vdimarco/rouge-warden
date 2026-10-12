"""CPU checks for the pond shore texture and the M_PondWater graph against a recording Unreal facade."""
import ast
import hashlib
import json
import math
from pathlib import Path
import random
import tempfile
from types import SimpleNamespace

import numpy as np
from PIL import Image
import shapely
from shapely.geometry import Point, Polygon
from shapely.ops import polylabel, unary_union

import plateau_water
from plateau_park import park_survey

ROOT = Path(__file__).resolve().parents[1]


class Names:
    """Enum stand-in: every member is its own name."""
    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError(name)
        return name


class Vector:
    def __init__(self, x=0., y=0., z=0.): self.x, self.y, self.z = x, y, z


class Object:
    DEFAULTS = {}

    def __init__(self, path='', **properties):
        self.path = path
        self.properties = dict(self.DEFAULTS) | properties

    def set_editor_property(self, name, value):
        assert name in self.properties, (type(self).__name__, 'has no property', name)
        self.properties[name] = value

    def get_editor_property(self, name):
        assert name in self.properties, (type(self).__name__, 'has no property', name)
        return self.properties[name]

    def get_path_name(self):
        return self.path + '.' + self.path.rsplit('/', 1)[-1] if self.path else ''

    def get_name(self):
        return self.path.rsplit('/', 1)[-1]

    def get_class(self):
        return SimpleNamespace(get_name=lambda: type(self).__name__)


class Material(Object):
    DEFAULTS = {'blend_mode': 'BLEND_OPAQUE', 'shading_model': 'MSM_DEFAULT_LIT', 'two_sided': False,
                'tangent_space_normal': True, 'translucency_lighting_mode': 'TLM_VOLUMETRIC_DIRECTIONAL'}

    def __init__(self, path=''):
        super().__init__(path)
        self.expressions, self.inputs, self.usages, self.compiles = [], {}, set(), 0


class Texture2D(Object):
    DEFAULTS = {'srgb': True, 'compression_settings': 'TC_DEFAULT', 'address_x': 'TA_WRAP', 'address_y': 'TA_WRAP'}


class MaterialParameterCollection(Object):
    DEFAULTS = {'scalar_parameters': ()}


class CollectionScalarParameter(Object):
    """parameter_name/default_value are editable; the GUID is not, as in FCollectionParameterBase."""
    DEFAULTS = {'parameter_name': 'None', 'default_value': 0.}
    created = 0

    def __init__(self):
        super().__init__()
        CollectionScalarParameter.created += 1
        self.guid = 'guid-%d' % CollectionScalarParameter.created


class CustomInput(Object):
    DEFAULTS = {'input_name': 'None'}


class Expression(Object):
    KIND = ''
    PINS = {'Multiply': ('A', 'B'), 'Add': ('A', 'B'), 'Subtract': ('A', 'B'), 'Divide': ('A', 'B'),
            'LinearInterpolate': ('A', 'B', 'Alpha'), 'AppendVector': ('A', 'B'), 'TextureSample': ('UVs',),
            'ComponentMask': ('Input',), 'Normalize': ('VectorInput',), 'Clamp': ('Input', 'Min', 'Max'),
            'Abs': ('Input',), 'OneMinus': ('Input',), 'Sine': ('Input',), 'VertexInterpolator': ('VS',)}
    OUTPUTS = {'TextureSample': ('RGB', 'R', 'G', 'B', 'A', 'RGBA'), 'VertexInterpolator': ('PS',)}
    VALUES = {'Multiply': {'const_a': 0., 'const_b': 1.}, 'Add': {'const_a': 0., 'const_b': 1.},
              'Subtract': {'const_a': 1., 'const_b': 1.}, 'LinearInterpolate': {'const_a': 0., 'const_b': 1., 'const_alpha': .5},
              'Clamp': {'min_default': 0., 'max_default': 1.}, 'Constant': {'r': 0.}, 'Constant2Vector': {'r': 0., 'g': 0.},
              'Constant3Vector': {'constant': (0, 0, 0, 1)}, 'Constant4Vector': {'constant': (0, 0, 0, 0)},
              'ComponentMask': dict.fromkeys('rgba', False), 'Custom': {'code': '', 'inputs': [], 'output_type': 'CMOT_FLOAT3', 'description': 'Custom'},
              'CollectionParameter': {'collection': None, 'parameter_name': 'None'}, 'Sine': {'period': 1.},
              'TextureSample': {'texture': None, 'sampler_type': 'SAMPLERTYPE_COLOR'}, 'VectorParameter': {'parameter_name': 'None'},
              'TextureCoordinate': {'u_tiling': 1., 'v_tiling': 1., 'coordinate_index': 0}}

    def __init__(self, material):
        super().__init__('', desc='', **self.VALUES.get(self.KIND, {}))
        self.material, self.links = material, {}

    def pins(self):
        if self.KIND == 'Custom':
            return tuple(str(entry.get_editor_property('input_name')) for entry in self.properties['inputs'])
        return self.PINS.get(self.KIND, ())

    def outputs(self):
        return self.OUTPUTS.get(self.KIND, ('',))


class Library:
    """MaterialEditingLibrary facade that records the graph like the editor does."""

    def __init__(self, output_names=True):
        self.output_names = output_names

    def __getattribute__(self, name):
        # Older editors lack this call; the scripts must then fall back to the authored output names.
        if name == 'get_material_property_input_node_output_name' and not object.__getattribute__(self, 'output_names'):
            raise AttributeError(name)
        return object.__getattribute__(self, name)

    def create_material_expression(self, mat, cls):
        node = cls(mat)
        mat.expressions.append(node)
        return node

    def connect_material_expressions(self, source, output, target, name):
        if source.material is not target.material or (output and output not in source.outputs()):
            return False
        pins = target.pins()
        pin = (pins[0] if pins else None) if name == '' else (name if name in pins else None)
        if pin is None:
            return False
        target.links[pin] = (source, output)
        return True

    def connect_material_property(self, node, output, prop):
        if output and output not in node.outputs():
            return False
        node.material.inputs[prop] = (node, output)
        return True

    def get_material_property_input_node(self, mat, prop):
        return mat.inputs.get(prop, (None, ''))[0]

    def get_material_property_input_node_output_name(self, mat, prop):
        return mat.inputs.get(prop, (None, ''))[1] or 'None'

    def get_inputs_for_material_expression(self, mat, node):
        return [node.links.get(pin, (None, ''))[0] for pin in node.pins()]

    def get_material_expressions(self, mat):
        return list(mat.expressions)

    def delete_all_material_expressions(self, mat):
        mat.expressions.clear()
        mat.inputs.clear()

    def recompile_material(self, mat):
        mat.compiles += 1

    def set_base_material_usage(self, mat, usage, flag):
        (mat.usages.add if flag else mat.usages.discard)(usage)
        return True

    def has_material_usage(self, mat, usage):
        return usage in mat.usages


class Assets:
    """EditorAssetLibrary facade; saving writes a small package file under root/Content."""

    def __init__(self, root):
        self.root, self.store, self.saves, self.after_save = Path(root), {}, [], None

    def file(self, path):
        return self.root / 'Content' / (path.removeprefix('/Game/') + '.uasset')

    def does_asset_exist(self, path):
        return path in self.store

    def load_asset(self, path):
        if path.startswith('/Game/Art/Textures/') or path.startswith('/Engine/'):
            return self.store.setdefault(path, Texture2D(path))
        return self.store.get(path)

    def save_loaded_asset(self, asset):
        assert self.store.get(asset.path) is asset, asset.path
        self.saves.append(asset.path)
        file = self.file(asset.path)
        file.parent.mkdir(parents=True, exist_ok=True)
        size = len(getattr(asset, 'expressions', ()))
        file.write_text(f'{type(asset).__name__} {size} {self.saves.count(asset.path)}\n')
        if self.after_save:
            self.after_save(asset)
        return True


class Tools:
    def __init__(self, assets): self.assets = assets

    def create_asset(self, name, folder, cls, factory):
        path = folder + '/' + name
        assert path not in self.assets.store, path
        self.assets.store[path] = cls(path)
        return self.assets.store[path]

    def import_asset_tasks(self, tasks):
        for task in tasks:
            assert Path(task.filename).is_file() and task.automated and task.replace_existing
            path = task.destination_path + '/' + task.destination_name
            texture = self.assets.store.get(path) or Texture2D(path)
            self.assets.store[path] = texture
            texture.source = hashlib.sha256(Path(task.filename).read_bytes()).hexdigest()
            if task.save:
                self.assets.save_loaded_asset(texture)
            task.imported_object_paths = [texture.get_path_name()]


class Actor:
    def __init__(self, label, mesh, material, location=(0., 0., 0.)):
        self.label, self.location = label, Vector(*location)
        self.static_mesh_component = SimpleNamespace(static_mesh=Object(mesh), get_material=lambda index: material)

    def get_actor_label(self): return self.label
    def get_actor_location(self): return self.location


class FakeUnreal:
    """Just the unreal module surface the water and atmosphere scripts use."""

    def __init__(self, root, output_names=True):
        self.EditorAssetLibrary = Assets(root)
        self.MaterialEditingLibrary = Library(output_names)
        self.tools = Tools(self.EditorAssetLibrary)
        self.AssetToolsHelpers = SimpleNamespace(get_asset_tools=lambda: self.tools)
        self.actors, self.logs, self.pie, self.world = [], [], [], '/Game/Maps/LaFontaine.LaFontaine'
        self.EditorLevelLibrary = SimpleNamespace(get_pie_worlds=lambda dedicated: self.pie,
                                                  get_editor_world=lambda: SimpleNamespace(get_path_name=lambda: self.world))
        self.EditorActorSubsystem = type('EditorActorSubsystem', (), {})
        self.Material, self.Texture2D = Material, Texture2D
        self.MaterialParameterCollection, self.CollectionScalarParameter = MaterialParameterCollection, CollectionScalarParameter
        self.CustomInput, self.Vector = CustomInput, Vector
        self.MaterialFactoryNew = self.MaterialParameterCollectionFactoryNew = object
        self.LinearColor = lambda r, g, b, a: (r, g, b, a)
        self.AssetImportTask = lambda: SimpleNamespace(imported_object_paths=[], automated=False, replace_existing=False, save=False)
        for enum in ('MaterialProperty', 'BlendMode', 'MaterialShadingModel', 'CustomMaterialOutputType', 'MaterialSamplerType',
                     'TextureCompressionSettings', 'TextureAddress', 'TranslucencyLightingMode', 'MaterialUsage'):
            setattr(self, enum, Names())
        self.classes = {}

    def __getattr__(self, name):
        if name.startswith('MaterialExpression'):
            return self.classes.setdefault(name, type(name, (Expression,), {'KIND': name[len('MaterialExpression'):]}))
        raise AttributeError(name)

    def get_editor_subsystem(self, cls):
        return SimpleNamespace(get_all_level_actors=lambda: list(self.actors))

    def log(self, text):
        self.logs.append(text)


def evaluate(node, output, values):
    """Scalar value of a recorded graph; values maps parameter names, 'custom' channels and 'source'."""
    kind = type(node).KIND

    def pin(name, fallback):
        link = node.links.get(name)
        return evaluate(link[0], link[1], values) if link else node.get_editor_property(fallback)
    if kind == 'CollectionParameter':
        return values[node.get_editor_property('parameter_name')]
    if kind == 'Constant':
        return node.get_editor_property('r')
    if kind == 'Multiply':
        return pin('A', 'const_a') * pin('B', 'const_b')
    if kind == 'Add':
        return pin('A', 'const_a') + pin('B', 'const_b')
    if kind == 'LinearInterpolate':
        a, b = pin('A', 'const_a'), pin('B', 'const_b')
        return a + (b - a) * pin('Alpha', 'const_alpha')
    if kind == 'Clamp':
        return min(max(evaluate(*node.links['Input'], values), node.get_editor_property('min_default')), node.get_editor_property('max_default'))
    if kind == 'Custom':
        return values['custom'][0]
    if kind == 'ComponentMask':
        source = node.links['Input'][0]
        assert type(source).KIND == 'Custom'
        channels = [c for c in 'rgba' if node.get_editor_property(c)]
        assert len(channels) == 1
        return values['custom']['rgba'.index(channels[0])]
    return values['source']


def material_with(u, path, build):
    """Register a saved material whose graph build(node, link, connect) makes."""
    mat = Material(path)
    u.EditorAssetLibrary.store[path] = mat
    library = u.MaterialEditingLibrary

    def node(kind, **properties):
        n = library.create_material_expression(mat, getattr(u, 'MaterialExpression' + kind))
        for name, value in properties.items():
            n.set_editor_property(name, value)
        return n

    def link(source, output, target, name):
        assert library.connect_material_expressions(source, output, target, name)

    def connect(source, output, prop):
        assert library.connect_material_property(source, output, getattr(u.MaterialProperty, prop))
    build(node, link, connect)
    u.EditorAssetLibrary.save_loaded_asset(mat)
    return mat


def check_prepare():
    manifest = plateau_water.load_manifest()
    assert manifest['size'] == [2048, 2048] and manifest['png'] == 'pond_shore.png'
    assert manifest['png_sha256'] == hashlib.sha256((plateau_water.DIRECTORY / 'pond_shore.png').read_bytes()).hexdigest()
    assert manifest['osm_sha256'] == hashlib.sha256((ROOT / 'Data/LaFontaine/osm.xml').read_bytes()).hexdigest()
    ponds, _, _ = park_survey()
    assert [s['relation'] for s in manifest['sources']] == [p['source'] for p in ponds] == ['relation/14474534', 'relation/14482536']
    rings = [ring for pond in ponds for ring in pond['outer'] + pond['inner']]
    points = np.array([p for ring in rings for p in ring])
    low, high = manifest['bounds_cm']['min'], manifest['bounds_cm']['max']
    assert np.allclose(low, points.min(0) - 200) and np.allclose(high, points.max(0) + 200), 'Bounds must pad both ponds by 200 cm'
    assert np.allclose(manifest['texel_cm'], (np.array(high) - np.array(low)) / 2048)

    image = Image.open(plateau_water.DIRECTORY / 'pond_shore.png')
    assert image.mode == 'RGBA' and image.size == (2048, 2048)
    rgba = np.asarray(image)
    assert (rgba[..., 3] == 255).all() and set(np.unique(rgba[..., 2])) == {0, 255}
    water = unary_union([unary_union([Polygon(r) for r in p['outer']]).difference(unary_union([Polygon(r) for r in p['inner']]))
                         for p in ponds])
    shore = unary_union([water.boundary])
    texel = np.array(manifest['texel_cm'])

    def centre(column, row):
        return low[0] + (column + .5) * texel[0], low[1] + (row + .5) * texel[1]

    def texel_at(x, y):
        return int((x - low[0]) / texel[0]), int((y - low[1]) / texel[1])

    # Independent exact distances at random texels: the channels are the documented encoding of them.
    rng = random.Random(7)
    rows = []
    while len(rows) < 6000:
        column, row = rng.randrange(2048), rng.randrange(2048)
        x, y = centre(column, row)
        inside = water.contains(Point(x, y))
        if not inside and rng.random() < .8:
            continue
        distance = shore.distance(Point(x, y)) if inside else 0.
        r, g, b, _ = (int(v) for v in rgba[row, column])
        assert b == (255 if inside else 0), (column, row)
        for value, scale in ((r, 600.), (g, 3000.)):
            exact = min(distance / scale, 1) * 255
            if abs(exact - math.floor(exact) - .5) > 1e-6:
                assert value == round(exact), (column, row, value, exact)
        rows.append((distance, r, g))
    rows.sort()
    for (_, r1, g1), (_, r2, g2) in zip(rows, rows[1:]):
        assert r2 >= r1 and g2 >= g1, 'Distance channels must grow away from the shore'

    # The island in the north pond is shore: water beside it is near shore even far from the outer bank.
    north = next(p for p in ponds if p['source'] == 'relation/14474534')
    island = Polygon(north['inner'][0])
    outer = Polygon(north['outer'][0]).exterior
    beside = 0
    c = island.representative_point()
    for angle in range(0, 360, 5):
        for step in (150., 250.):
            ray = shapely.LineString([c, (c.x + 1e5 * math.cos(math.radians(angle)), c.y + 1e5 * math.sin(math.radians(angle)))])
            hit = ray.intersection(island.exterior)
            hit = min(getattr(hit, 'geoms', [hit]), key=lambda p: c.distance(p))
            x = hit.x + step * math.cos(math.radians(angle))
            y = hit.y + step * math.sin(math.radians(angle))
            if not water.contains(Point(x, y)) or outer.distance(Point(x, y)) < 1500:
                continue
            column, row = texel_at(x, y)
            assert rgba[row, column, 0] < 255 * (step + 60) / 600, ('Island edge is not shore', angle, step)
            beside += 1
    assert beside > 20, beside
    c = island.representative_point()
    column, row = texel_at(c.x, c.y)
    assert rgba[row, column, 2] == 0 and rgba[row, column, 0] == 0, 'Island interior must not be water'

    # Both pond centres are deep: 12 m or more from any shore, so the material's depth factor is 1.
    for pond in ponds:
        polygon = unary_union([Polygon(r) for r in pond['outer']]).difference(unary_union([Polygon(r) for r in pond['inner']]))
        centre_point = polylabel(polygon, tolerance=10)
        column, row = texel_at(centre_point.x, centre_point.y)
        assert rgba[row, column, 1] / 255 * 3000 >= 1200, (pond['source'], rgba[row, column])
        assert rgba[row, column, 0] == 255

    # A small regeneration exercises the writer and the manifest without touching Data.
    with tempfile.TemporaryDirectory() as temporary:
        small = plateau_water.prepare(temporary, size=96)
        again = Path(temporary) / 'pond_shore.png'
        first = again.read_bytes()
        assert plateau_water.prepare(temporary, size=96) == small and again.read_bytes() == first, 'prepare() must be deterministic'
        assert plateau_water.load_manifest(temporary)['png_sha256'] == hashlib.sha256(first).hexdigest()
        decoded = np.asarray(Image.open(again))
        assert decoded.shape == (96, 96, 4) and small['water_texels'] == int((decoded[..., 2] == 255).sum())
        (Path(temporary) / 'pond_shore.png').write_bytes(first[:-1] + b'\0')
        try:
            plateau_water.load_manifest(temporary)
        except AssertionError:
            pass
        else:
            raise AssertionError('A stale shore texture was accepted')
    return {'water_texels': manifest['water_texels'], 'island_samples': beside, 'exact_samples': len(rows),
            'channels': {c: [int(rgba[..., i].min()), int(rgba[..., i].max()), round(float(rgba[..., i].mean()), 2)]
                         for i, c in enumerate('RGBA')}}


def input_of(node, pin):
    return node.links[pin][0]


def check_author():
    with tempfile.TemporaryDirectory() as temporary:
        u = FakeUnreal(temporary)
        mpc = MaterialParameterCollection(plateau_water.COLLECTION)
        texture = Texture2D(plateau_water.TEXTURE)
        manifest = plateau_water.load_manifest()
        water = material_with(u, plateau_water.MATERIAL, lambda node, link, connect: connect(node('Constant'), '', 'MP_BASE_COLOR'))
        report = plateau_water.author(u, water, texture, manifest, mpc)
        library = u.MaterialEditingLibrary
        assert water.get_editor_property('blend_mode') == 'BLEND_OPAQUE'
        assert water.get_editor_property('shading_model') == 'MSM_DEFAULT_LIT'
        assert water.get_editor_property('tangent_space_normal') is False and water.compiles == 1
        customs = [n for n in water.expressions if isinstance(n, u.MaterialExpressionCustom)]
        assert len(customs) == 1
        custom = customs[0]
        assert custom.get_editor_property('code') == (ROOT / 'Scripts/pond_water.hlsl').read_text()
        assert custom.get_editor_property('output_type') == 'CMOT_FLOAT4'
        assert custom.pins() == ('WorldPos', 'CameraPos', 'Time', 'Shore', 'Wind', 'WindDirX', 'WindDirY', 'Rain')
        assert isinstance(input_of(custom, 'WorldPos'), u.MaterialExpressionWorldPosition)
        assert isinstance(input_of(custom, 'CameraPos'), u.MaterialExpressionCameraPositionWS)
        assert isinstance(input_of(custom, 'Time'), u.MaterialExpressionTime)
        shore, output = custom.links['Shore']
        assert isinstance(shore, u.MaterialExpressionTextureSample) and output == 'RGBA'
        assert shore.get_editor_property('texture') is texture and shore.get_editor_property('sampler_type') == 'SAMPLERTYPE_LINEAR_COLOR'
        # UV = xy * scale + offset puts the bounds' corners at (0, 0) and (1, 1).
        uv = input_of(shore, 'UVs')
        scale, offset = input_of(uv, 'A'), input_of(uv, 'B')
        xy = input_of(scale, 'A')
        assert [xy.get_editor_property(c) for c in 'rgba'] == [True, True, False, False]
        assert isinstance(input_of(xy, 'Input'), u.MaterialExpressionWorldPosition)
        factor = input_of(scale, 'B')
        low, high = manifest['bounds_cm']['min'], manifest['bounds_cm']['max']
        for corner, expected in ((low, 0.), (high, 1.)):
            for axis, channel in ((0, 'r'), (1, 'g')):
                value = corner[axis] * factor.get_editor_property(channel) + offset.get_editor_property(channel)
                assert abs(value - expected) < 1e-9, (corner, axis, value)
        parameters = {pin: input_of(custom, pin) for pin in ('Wind', 'WindDirX', 'WindDirY', 'Rain')}
        assert {pin: (n.get_editor_property('collection'), n.get_editor_property('parameter_name')) for pin, n in parameters.items()} == {
            'Wind': (mpc, 'WindStrength'), 'WindDirX': (mpc, 'WindDirX'), 'WindDirY': (mpc, 'WindDirY'), 'Rain': (mpc, 'RainIntensity')}

        normal = library.get_material_property_input_node(water, 'MP_NORMAL')
        assert isinstance(normal, u.MaterialExpressionNormalize)
        append = input_of(normal, 'VectorInput')
        downhill, up = input_of(append, 'A'), input_of(append, 'B')
        assert downhill.get_editor_property('const_b') == -1. and up.get_editor_property('r') == 1.
        slope = input_of(downhill, 'A')
        assert input_of(slope, 'Input') is custom and [slope.get_editor_property(c) for c in 'rgba'] == [True, True, False, False]
        base = library.get_material_property_input_node(water, 'MP_BASE_COLOR')
        depth_lerp, foam_color, foam = input_of(base, 'A'), input_of(base, 'B'), input_of(base, 'Alpha')
        assert foam_color.get_editor_property('constant') == (.35, .36, .33, 1) and foam.get_editor_property('b')
        assert input_of(depth_lerp, 'A').get_editor_property('constant') == (.045, .05, .03, 1)
        assert input_of(depth_lerp, 'B').get_editor_property('constant') == (.008, .022, .02, 1)
        assert input_of(depth_lerp, 'Alpha').get_editor_property('a')
        specular = library.get_material_property_input_node(water, 'MP_SPECULAR')
        metallic = library.get_material_property_input_node(water, 'MP_METALLIC')
        assert specular.get_editor_property('r') == .25 and metallic.get_editor_property('r') == 0.
        rough = library.get_material_property_input_node(water, 'MP_ROUGHNESS')
        for wind in (0., .25, .55, 1., 1.6):
            for rain in (0., .3, .9, 1.):
                for foam_amount in (0., .5, 1.):
                    values = {'WindStrength': wind, 'RainIntensity': rain, 'WindDirX': .94, 'WindDirY': .34,
                              'custom': (0, 0, foam_amount, 1)}
                    expected = min(max(.035 + .05 * wind + .08 * rain, .03), .17)
                    expected += (.45 - expected) * foam_amount
                    assert abs(evaluate(rough, '', values) - expected) < 1e-9, (wind, rain, foam_amount)
        assert report['shore_texture'] == texture.get_path_name() and report['collection'] == mpc.get_path_name()
        assert report['wave_normals'] == 8 and report['specular'] == .25 and report['tangent_space_normal'] is False
        count = len(water.expressions)
        plateau_water.author(u, water, texture, manifest, mpc)
        assert len(water.expressions) == count, 'Rebuilding the pond must not accumulate nodes'

        # Without the texture and collection the old full pipeline still builds a complete pond.
        fallback = plateau_water.author(u, water)
        custom = next(n for n in water.expressions if isinstance(n, u.MaterialExpressionCustom))
        shore = input_of(custom, 'Shore')
        assert isinstance(shore, u.MaterialExpressionConstant4Vector) and shore.get_editor_property('constant') == (1, 1, 1, 1)
        assert {pin: input_of(custom, pin).get_editor_property('r') for pin in ('Wind', 'WindDirX', 'WindDirY', 'Rain')} == {
            'Wind': .25, 'WindDirX': .94, 'WindDirY': .34, 'Rain': 0.}
        assert not any(isinstance(n, (u.MaterialExpressionTextureSample, u.MaterialExpressionCollectionParameter)) for n in water.expressions)
        rough = library.get_material_property_input_node(water, 'MP_ROUGHNESS')
        assert abs(evaluate(rough, '', {'custom': (0, 0, 0, 1)}) - .0475) < 1e-12
        assert fallback['shore_texture'] is None and fallback['collection'] is None
        try:
            plateau_water.author(u, water, texture, None, mpc)
        except AssertionError:
            pass
        else:
            raise AssertionError('A shore texture without its manifest was accepted')
        return count


def check_surfaces():
    """Run plateau_surfaces.apply with upgrade_plateau's own material helpers against the facade."""
    import plateau_surfaces
    syntax = ast.parse((ROOT / 'Scripts/upgrade_plateau.py').read_text())
    helpers = [n for n in syntax.body if isinstance(n, ast.FunctionDef) and n.name in ('expression', 'material')]
    results = {}
    for ready in (False, True):
        with tempfile.TemporaryDirectory() as temporary:
            u = FakeUnreal(temporary)
            assets = u.EditorAssetLibrary
            if ready:
                assets.store[plateau_water.TEXTURE] = Texture2D(plateau_water.TEXTURE)
                assets.store[plateau_water.COLLECTION] = MaterialParameterCollection(plateau_water.COLLECTION)
            spawned = []
            cloud_component = Object(material=None, layer_bottom_altitude=0., layer_height=0.)
            cloud_component.set_material = lambda mat: cloud_component.set_editor_property('material', mat)
            u.VolumetricCloud = type('VolumetricCloud', (), {})
            u.VolumetricCloudComponent = u.ExponentialHeightFog = u.SkyLight = type('Other', (), {})

            def spawn(cls, location):
                actor = cls()
                actor.set_actor_label = actor.set_folder_path = lambda value: None
                actor.get_component_by_class = lambda component_class: cloud_component
                spawned.append(actor)
                return actor
            editor = SimpleNamespace(get_all_level_actors=lambda: [], spawn_actor_from_class=spawn)
            u.get_editor_subsystem = lambda cls: editor
            scope = {'M': u.MaterialEditingLibrary, 'assets': assets, 'tools': u.tools, 'u': u}
            exec(compile(ast.Module(body=helpers, type_ignores=[]), 'upgrade_plateau.py', 'exec'), scope)
            materials = {'Leaf': scope['material']('Leaf', (.12, .24, .075))}
            report = plateau_surfaces.apply(u, materials, scope['expression'], scope['material'])
            water = materials['PondWater']
            assert water is assets.store[plateau_water.MATERIAL] and plateau_water.MATERIAL in assets.saves
            custom = [n for n in water.expressions if isinstance(n, u.MaterialExpressionCustom)]
            assert len(custom) == 1 and custom[0].get_editor_property('code') == plateau_water.HLSL.read_text()
            assert water.get_editor_property('tangent_space_normal') is False
            assert report['pond_normal_waves'] == 8 and len(spawned) == 1
            assert (report['pond_shore_texture'] is not None) == ready and (report['pond_collection'] is not None) == ready
            assert ready == any(isinstance(n, u.MaterialExpressionTextureSample) for n in water.expressions)
            results[ready] = len(water.expressions)
    return results


def main():
    shore = check_prepare()
    nodes = check_author()
    surfaces = check_surfaces()
    print('Shore texture channels min/max/mean:', json.dumps(shore['channels']))
    print(f"Pond water checks passed: {shore['water_texels']} water texels, {shore['exact_samples']} exact distance samples, "
          f"{shore['island_samples']} island-shore samples; pond graph {nodes} nodes, rebuilt in place; "
          f"plateau_surfaces graph {surfaces[False]} nodes without and {surfaces[True]} with the shore texture and collection")


if __name__ == '__main__':
    main()
