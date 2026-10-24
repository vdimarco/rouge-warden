"""CPU checks for the Blender preview's replica materials, trees, props and loading (Scripts/blender/plateau_replica_preview.py).

Run from games/nord-unreal:  python3 Scripts/test_plateau_replica_preview.py
No Blender needed: a small fake `bpy` records the node graphs the preview builds. The checks follow the apply
step (apply_plateau_replica.material_row, textured_graph, add_macro and plan_trees):
- every key that takes a replica texture set (Stone, Slate, the shared keys with Brick_Buff_Even and the fourth pass's
  Concrete_Lane_Aged, Leaf_Cedar, Plant_Grass_Fountain, Plant_Pit_Flowers, Iron_Wrought and Cloth_Laundry, each from
  the layer manifest that uses it, the tree bark and leaf atlas) gets its three maps from its own folder, the row's
  tiling, the set's address modes (cards clamp V to the first and last texel rows, atlases clamp both axes), the row's
  tint (white for a set that owns its colour), the macro variation where the set has one, the DirectX normal map,
  roughness from R and the row's capped metallic; the masked sets are clipped at their opacity_mask_clip with the
  alpha read channel-packed; the foliage sets transmit base colour x FOLIAGE_SUBSURFACE; the opaque sets have no
  transparency;
- the yard trees stand on their species meshes (maple on norway_maple) at the apply step's positions, yaws and
  uniform scales, and each species OBJ, mature and young, splits into a bark and a leaves slot;
- every street and park tree of Streets/street_trees.json stands on its kind's species or young mesh with the apply
  step's transform, red, russet and other-fall trees on their group's tinted leaves, and the old summer tree appears
  only before the apply step, on the OSM tree nodes the saved map's stand-in holds;
- the OBJ index forgets removed OBJs and never caches tree positions;
- faces are kept when an edge crosses the view, so the ruelle_mentana lane asphalt (one 188 m quad) is loaded;
- Collision_Only batches are never drawn;
- shadows follow the apply step (casts_shadow for the layer batches, its PROP_SHADOW props), and the Leaf_Litter
  patches, which overlap at one height, are seen by camera rays only;
- every placement gets the colour variant the apply step gives it;
- the gallery_closeup and hlm_mentana cameras stand in the yard and on the far sidewalk.
"""
import json
import math
from pathlib import Path
import sys
import tempfile
import types

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'Scripts'))
sys.path.insert(0, str(ROOT / 'Scripts' / 'blender'))
import apply_plateau_replica as apply_replica  # noqa: E402

MASKED_KEYS = ('Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Creeper', 'Leaf_Cedar', 'Plant_Grass_Fountain',
               'Plant_Pit_Flowers', 'Iron_Wrought', 'Cloth_Laundry', 'Leaf_Litter')
# The fourth pass's keys (the shared contract), the layer whose manifest uses each, and how the set is addressed.
NEW_KEYS = {'Concrete_Lane_Aged': ('Streets', 'REPEAT'), 'Leaf_Cedar': ('Plex', 'clamp V'),
            'Plant_Grass_Fountain': ('Soul', 'clamp V'), 'Plant_Pit_Flowers': ('Streets', 'clamp V'),
            'Iron_Wrought': ('Streets', 'clamp V'), 'Cloth_Laundry': ('Soul', 'EXTEND')}
LAYERS = ('Plex', 'Streets', 'Soul')


# ------------------------------------------------------------------------------------------------
# A fake bpy: just enough of bpy.data, node trees and objects for the preview's material and tree code.

class Socket:
    def __init__(self, node, name, kind='RGBA', default=None):
        self.node, self.name, self.type, self.default_value = node, name, kind, default


class Sockets:
    def __init__(self, node, fixed=()):
        self.node, self.items = node, [Socket(node, n, k) for n, k in fixed]

    def __iter__(self):
        return iter(self.items)

    def __getitem__(self, key):
        if isinstance(key, int):
            while len(self.items) <= key:
                self.items.append(Socket(self.node, f'#{len(self.items)}'))
            return self.items[key]
        for s in self.items:
            if s.name == key:
                return s
        s = Socket(self.node, key)
        self.items.append(s)
        return s


# Sockets the preview selects by name and type (sock()) or by index, as Blender 5.1 lays them out.
FIXED = {
    'ShaderNodeMix': ([('Factor', 'VALUE'), ('A', 'RGBA'), ('B', 'RGBA')], [('Result', 'RGBA')]),
    'ShaderNodeMath': ([('Value', 'VALUE'), ('Value_001', 'VALUE')], [('Value', 'VALUE')]),
    'ShaderNodeMixShader': ([('Fac', 'VALUE'), ('Shader', 'SHADER'), ('Shader_001', 'SHADER')], [('Shader', 'SHADER')]),
    'ShaderNodeAddShader': ([('Shader', 'SHADER'), ('Shader_001', 'SHADER')], [('Shader', 'SHADER')]),
}


class Node:
    def __init__(self, kind):
        self.bl_idname = kind
        self.type = {'ShaderNodeOutputMaterial': 'OUTPUT_MATERIAL'}.get(kind, kind)
        fixed_in, fixed_out = FIXED.get(kind, ((), ()))
        self.inputs, self.outputs = Sockets(self, fixed_in), Sockets(self, fixed_out)
        self.image = None
        self.extension = 'REPEAT'  # Blender's default for an image texture node


class Nodes:
    def __init__(self):
        self.items = {'Principled BSDF': Node('ShaderNodeBsdfPrincipled'),
                      'Material Output': Node('ShaderNodeOutputMaterial')}

    def __getitem__(self, name):
        return self.items[name]

    def __iter__(self):
        return iter(list(self.items.values()))

    def new(self, kind):
        node = Node(kind)
        self.items[f'{kind}.{len(self.items)}'] = node
        return node


class Links:
    def __init__(self):
        self.items = []

    def new(self, a, b):
        self.items = [(x, y) for x, y in self.items if y is not b]  # one link per input, as Blender keeps it
        self.items.append((a, b))


class Material:
    def __init__(self, name):
        self.name = name
        self.node_tree = types.SimpleNamespace(nodes=Nodes(), links=Links())


class Image:
    def __init__(self, path):
        self.filepath, self.name = path, Path(path).name
        self.colorspace_settings = types.SimpleNamespace(name='sRGB')
        self.alpha_mode = 'STRAIGHT'


class Images(dict):
    def load(self, path):
        img = Image(path)
        self[img.name] = img
        return img

    def __setitem__(self, key, value):
        super().__setitem__(key, value)

    def __contains__(self, key):
        return dict.__contains__(self, key) or any(v.name == key for v in self.values())

    def __getitem__(self, key):
        for v in self.values():
            if v.name == key:
                return v
        return dict.__getitem__(self, key)


class Obj:
    def __init__(self, name, data):
        self.name, self.data = name, data
        self.instance_type, self.instance_collection = 'NONE', None
        self.location, self.rotation_euler, self.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)


class Collection:
    def __init__(self, name):
        self.name, self.linked = name, []
        self.objects = types.SimpleNamespace(link=self.linked.append)


def fake_modules():
    bpy = types.ModuleType('bpy')
    bpy.data = types.SimpleNamespace(
        materials=types.SimpleNamespace(new=Material), images=Images(),
        objects=types.SimpleNamespace(new=Obj), collections=types.SimpleNamespace(new=Collection))
    mathutils = types.ModuleType('mathutils')
    mathutils.Matrix = mathutils.Vector = object
    return {'bpy': bpy, 'mathutils': mathutils}


def load_preview():
    saved = {k: sys.modules.get(k) for k in ('bpy', 'mathutils')}
    sys.modules.update(fake_modules())
    try:
        import plateau_replica_preview as preview
    finally:
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v
    return preview


# ------------------------------------------------------------------------------------------------

def source(links, socket):
    """The output socket linked into an input socket, or None."""
    return next((a for a, b in links if b is socket), None)


def check_material(preview, layer, key, spec, sets, listed=True):
    """One replica-set material against the apply step's plan row for it; returns the row. listed: the key is one of
    the set's own keys (a fall's tinted leaves are not: they take the set through their spec's texture)."""
    row = apply_replica.material_row(layer, key, spec, sets, set())
    set_name = row['texture_set']
    entry = sets[set_name]
    mat = preview.replica_material(layer, key, spec)
    nodes, links = list(mat.node_tree.nodes), mat.node_tree.links.items
    maps = [entry['maps'][r]['file'] for r in ('diff', 'nor_dx', 'rough')]
    images = {Path(n.image.filepath).name: n for n in nodes if n.bl_idname == 'ShaderNodeTexImage'
              and Path(n.image.filepath).name in maps}
    assert sorted(images) == sorted(maps), (key, images)
    # Each map from its set's own folder: Textures, or Trees for the bark and the leaf atlas.
    for n in images.values():
        assert Path(n.image.filepath).parent.name == entry.get('directory', 'Textures'), (key, n.image.filepath)
    role = {r: images[entry['maps'][r]['file']] for r in ('diff', 'nor_dx', 'rough')}
    # The three maps share one lookup, addressed as the apply step addresses the set (address_modes): tiling sets
    # wrap, an atlas clamps both axes (EXTEND), a card wraps U and clamps V to its first and last texel rows.
    address = apply_replica.address_modes(entry)
    lookup = source(links, role['diff'].inputs['Vector'])
    for n in role.values():
        assert source(links, n.inputs['Vector']) is lookup, key + ' maps sampled at different UVs'
        assert n.extension == ('EXTEND' if address == ('TA_CLAMP', 'TA_CLAMP') else 'REPEAT'), (key, n.extension)
    if address == ('TA_WRAP', 'TA_CLAMP'):
        join = lookup.node
        assert join.bl_idname == 'ShaderNodeCombineXYZ', key + ': the card V is not clamped'
        clamp = source(links, join.inputs['Y']).node
        half = .5 / entry['size_px'][1]
        assert clamp.bl_idname == 'ShaderNodeClamp', key
        assert abs(clamp.inputs['Min'].default_value - half) < 1e-12, key
        assert abs(clamp.inputs['Max'].default_value - (1. - half)) < 1e-12, key
        y = source(links, clamp.inputs['Value'])
        split = y.node
        assert y.name == 'Y' and split.bl_idname == 'ShaderNodeSeparateXYZ', key
        assert source(links, join.inputs['X']) is split.outputs['X'], key + ': U must wrap as it tiles'
        assert source(links, join.inputs['Z']) is split.outputs['Z'], key
        mapping = source(links, split.inputs['Vector']).node
    else:
        assert address in (('TA_WRAP', 'TA_WRAP'), ('TA_CLAMP', 'TA_CLAMP')), (key, address)
        mapping = lookup.node
    assert mapping.bl_idname == 'ShaderNodeMapping', key
    assert tuple(mapping.inputs['Scale'].default_value[:2]) == tuple(row['tiling']), key
    row = dict(row, address=address)
    assert role['diff'].image.colorspace_settings.name == 'sRGB', key
    assert role['nor_dx'].image.colorspace_settings.name == role['rough'].image.colorspace_settings.name == 'Non-Color'
    # Base colour = diff x the row's tint (colour / mean_linear capped at TINT_LIMIT; white when the set owns its
    # colour), x the macro variation where the set has one.
    bsdf = mat.node_tree.nodes['Principled BSDF']
    base = source(links, bsdf.inputs['Base Color'])
    if row.get('macro'):
        vary = base.node
        assert vary.blend_type == 'MULTIPLY', key
        mul = source(links, preview.sock(vary.inputs, 'A')).node
        factor = source(links, preview.sock(vary.inputs, 'B'))
        # lerp(1 - s, 1 + s, mask channel) per macro tile, the two multiplied: (1 - s) + 2 s x channel.
        lerps = [factor.node] if factor.node.operation == 'MULTIPLY_ADD' else \
            [source(links, factor.node.inputs[i]).node for i in (0, 1)]
        assert len(lerps) == len(row['macro']['strength']), key
        for lerp, s, tiling, channel in zip(lerps, row['macro']['strength'], row['macro']['tiling'],
                                            row['macro']['channels']):
            assert lerp.operation == 'MULTIPLY_ADD', key
            assert abs(lerp.inputs[1].default_value - 2 * s) < 1e-9 and abs(lerp.inputs[2].default_value - (1 - s)) < 1e-9
            split = source(links, lerp.inputs[0])
            assert split.name == {'R': 'Red', 'G': 'Green'}[channel], key
            sample = source(links, split.node.inputs['Color']).node
            assert Path(sample.image.filepath).name == Path(row['macro']['texture']).name + '.png', key
            assert sample.image.colorspace_settings.name == 'Non-Color', key
            scale = source(links, sample.inputs['Vector']).node
            assert tuple(scale.inputs['Scale'].default_value[:2]) == tuple(tiling), key
        base_result = preview.sock(vary.outputs, 'Result')
    else:
        mul = base.node
        base_result = preview.sock(mul.outputs, 'Result')
    assert mul.blend_type == 'MULTIPLY' and source(links, preview.sock(mul.inputs, 'A')).node is role['diff'], key
    tint = row['tint']
    if row.get('own_colour'):
        assert tint == (1., 1., 1.), key
    else:
        colour = preview.srgb_to_linear(spec['base_color_srgb'])
        assert all(abs(t - min(apply_replica.TINT_LIMIT, c / m)) < 1e-9
                   for t, c, m in zip(tint, colour, entry['mean_linear'])), key
    assert all(abs(a - b) < 1e-9 for a, b in zip(preview.sock(mul.inputs, 'B').default_value[:3], tint)), key
    # Normal: the DirectX map through a DirectX normal-map node, as Unreal reads it. Roughness: R of rough.
    nmap = source(links, bsdf.inputs['Normal']).node
    assert nmap.convention == 'DIRECTX' and source(links, nmap.inputs['Color']).node is role['nor_dx'], key
    split = source(links, bsdf.inputs['Roughness'])
    assert split.name == 'Red' and source(links, split.node.inputs['Color']).node is role['rough'], key
    assert bsdf.inputs['Metallic'].default_value == row['metallic'], key
    # Surface: masked sets clip on the diffuse alpha; opaque sets go straight to the output.
    out = mat.node_tree.nodes['Material Output']
    surface = source(links, out.inputs['Surface'])
    if row['blend_mode'] == 'masked':
        assert role['diff'].image.alpha_mode == 'CHANNEL_PACKED', key + ' alpha must not be premultiplied'
        mix = surface.node
        assert mix.bl_idname == 'ShaderNodeMixShader', key
        assert source(links, mix.inputs[1]).node.bl_idname == 'ShaderNodeBsdfTransparent', key
        keep = source(links, mix.inputs['Fac']).node
        assert keep.operation == 'GREATER_THAN', key
        assert source(links, keep.inputs[0]) is role['diff'].outputs['Alpha'], key + ' mask is not the diff alpha'
        assert abs(keep.inputs[1].default_value - row['opacity_mask_clip']) < 2e-3, key
        lit = source(links, mix.inputs[2]).node
        assert (key in entry['keys'] or not listed) and preview.MASKED[mat.name][2] == row['opacity_mask_clip']
        assert preview.MASKED[mat.name][3] == address, key + ': --probe must address the mask as the material does'
        if row['shading_model'] == 'two_sided_foliage':
            assert lit.bl_idname == 'ShaderNodeAddShader', key + ' needs the foliage transmission'
            translucent = source(links, lit.inputs[1]).node
            assert translucent.bl_idname == 'ShaderNodeBsdfTranslucent', key
            scale = source(links, translucent.inputs['Color']).node
            assert source(links, preview.sock(scale.inputs, 'A')) is base_result, key
            assert preview.sock(scale.inputs, 'B').default_value[:3] == (apply_replica.FOLIAGE_SUBSURFACE,) * 3
        else:
            assert lit is bsdf, key
    else:
        assert row['blend_mode'] == 'opaque', key
        assert surface is bsdf.outputs['BSDF'], key + ' should be opaque'
        assert not any(n.bl_idname == 'ShaderNodeBsdfTransparent' for n in nodes), key
    return row


def check_set_materials(preview):
    sets = apply_replica.load_textures(ROOT)
    manifests = {layer: json.loads((ROOT / f'Data/Plateau/ReplicaGeometry/{layer}/manifest.json').read_text())['materials']
                 for layer in LAYERS}
    plex = manifests['Plex']
    keys = sorted(apply_replica.SHARED_TEXTURE_KEYS) + ['Stone', 'Slate']
    checked, rows = {}, {}
    for key in keys:
        # Each key from the layer manifest that uses it (the fourth pass's keys live in Streets and Soul too).
        layer = next((name for name in LAYERS if key in manifests[name]), 'Plex')
        spec = manifests[layer].get(key) or {'base_color_srgb': '#808080', 'roughness': .8, 'metallic': 0.}
        row = rows[key] = check_material(preview, layer, key, spec, sets)
        checked[key] = row['texture_set'] + (' +macro' if row.get('macro') else '')
    masked = sorted(k for k in checked if rows[k]['blend_mode'] == 'masked')
    assert masked == sorted(MASKED_KEYS), masked
    # The fourth pass's keys, each read from the manifest that uses it, addressed as the contract asks.
    for key, (layer, lookup) in NEW_KEYS.items():
        assert key in manifests[layer], f'{layer} does not use {key}'
        want = {'REPEAT': ('TA_WRAP', 'TA_WRAP'), 'clamp V': ('TA_WRAP', 'TA_CLAMP'),
                'EXTEND': ('TA_CLAMP', 'TA_CLAMP')}[lookup]
        assert rows[key]['address'] == want, (key, rows[key]['address'])
        assert (rows[key]['blend_mode'] == 'masked') == apply_replica.CONTRACT_KEYS[key]['masked'], key
        checked[key] += f' ({layer}, {lookup})'
    # Buff brick is the even buff set with its macro variation, never the red brick photo tinted up.
    assert checked['Brick_Buff_Even'] == 'buff_brick +macro', checked['Brick_Buff_Even']
    # The tar owns its colour; galvanised sheet keeps the set's metallic cap.
    assert apply_replica.material_row('Plex', 'Roof_Tar', plex['Roof_Tar'], sets, set())['tint'] == (1., 1., 1.)
    sheet = preview.replica_material('Capped', 'Sheet_Metal', dict(plex['Sheet_Metal'], metallic=.9))
    assert sheet.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value == .3
    # The species trees' bark and autumn leaf atlas, from the Trees folder.
    kinds = apply_replica.load_tree_kinds(ROOT)
    assert kinds, 'Trees/manifest.json is missing; run Scripts/blender/plateau_trees.py --no-render'
    for species, kind in sorted(kinds.items()):
        for slot in ('bark', 'leaves'):
            ref = kind['materials'][slot]
            row = check_material(preview, 'Trees', ref['key'], ref['spec'], sets)
            assert row['texture_set'] == {'bark': 'tree_bark', 'leaves': 'tree_leaves'}[slot], (species, slot)
            assert (row['blend_mode'], row['shading_model']) == \
                {'bark': ('opaque', 'default_lit'), 'leaves': ('masked', 'two_sided_foliage')}[slot], (species, slot)
            checked[ref['key']] = row['texture_set']
    return checked


def check_yard_trees(preview):
    """The yard trees on the species meshes, as apply_plateau_replica.plan_trees places them, and each species OBJ
    split into its bark and leaves slots with the OBJ's normals."""
    rows = apply_replica.load_yard_trees(ROOT)
    assert rows, 'Plex/yard_trees.json is missing; run python3 Scripts/plateau_plex.py'
    kinds = apply_replica.load_tree_kinds(ROOT)
    assert kinds, 'Trees/manifest.json is missing; run Scripts/blender/plateau_trees.py --no-render'
    made = {}
    saved = preview.species_collection, preview.tree_template
    preview.species_collection = lambda species, kind, variant=None, leaves=None: made.setdefault(
        species if variant is None and leaves is None else (species, variant, leaves), Collection('Tree_' + species))
    preview.tree_template = lambda: (_ for _ in ()).throw(AssertionError('yard trees fell back to tree_small_02'))
    try:
        world = Collection('World')
        everything = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(0., 0., 1e9))
        n = preview.place_yard_trees(everything, world)
        assert n == len(rows) == len(world.linked), (n, len(rows))
        groups = apply_replica.plan_trees(rows, kinds)
        expected = [(g['kind'], t) for g in groups for t in g['transforms']]
        counts = {}
        for ob, (species, ((x, y, z), yaw, scale)) in zip(world.linked, expected):
            assert ob.instance_type == 'COLLECTION' and ob.instance_collection is made[species], ob.name
            assert ob.location == (x / 100, -y / 100, z / 100), ob.name
            assert abs(ob.rotation_euler[2] + math.radians(yaw)) < 1e-12, ob.name
            assert tuple(ob.scale) == tuple(scale) and scale[0] == scale[1] == scale[2], ob.name
            assert ob.name[len('YardTree_'):].rsplit('_', 1)[0] == species, ob.name
            counts[species] = counts.get(species, 0) + 1
        # The old kinds stand on their species: maple on norway_maple, elm on linden.
        by_species = {}
        for r in rows:
            by_species[apply_replica.TREE_ALIASES.get(r['kind'], r['kind'])] = \
                by_species.get(apply_replica.TREE_ALIASES.get(r['kind'], r['kind']), 0) + 1
        assert counts == by_species, (counts, by_species)
        # Each tree stands at its row's height on its species mesh.
        for g in groups:
            for (p, yaw, scale), r in zip(g['transforms'], [r for r in rows if r['species'] == g['kind']]):
                assert abs(scale[2] * kinds[g['kind']]['height_cm'] - r['height_cm']) < 1e-6, g['kind']
        # The region filter keeps only trees inside the view.
        far = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(1e7, 1e7, 100.))
        assert preview.place_yard_trees(far, Collection('Empty')) == 0
    finally:
        preview.species_collection, preview.tree_template = saved
    # Each species OBJ, mature and young: a bark and a leaves group (the slots the apply step maps by name), every
    # corner with a UV and a normal, and the manifest's triangle counts.
    manifest = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Trees/manifest.json').read_text())['kinds']
    slots = {}
    for species, kind in sorted(kinds.items()):
        for variant in (None, apply_replica.YOUNG):
            mesh = kind.get(variant) if variant else kind
            if not mesh:
                continue
            spec = manifest[species][variant] if variant else manifest[species]
            groups = preview.read_obj_groups(str(ROOT / 'Data/Plateau/ReplicaGeometry' / mesh['obj']))
            found = {apply_replica.tree_slot(name): g for name, g in groups.items()}
            assert sorted(found) == ['bark', 'leaves'], (species, variant, sorted(groups))
            for slot, (verts, polys, uvs, normals) in found.items():
                corners = sum(len(q) for q in polys)
                assert len(uvs) == corners and normals and len(normals) == corners, (species, variant, slot)
                tris = sum(len(q) - 2 for q in polys)
                assert tris == spec['triangles'][slot], (species, variant, slot, tris)
            slots[species + (f'_{variant}' if variant else '')] = {k: len(v[1]) for k, v in found.items()}
    return {'trees': n, 'species': counts, 'species_faces': slots}


def check_street_trees(preview):
    """Every street and park tree of Streets/street_trees.json on its kind's species mesh (or the kind's young mesh) at
    the apply step's transform (plan_trees: position, yaw, height and trunk spread), with no old summer tree; and the
    old summer tree only in a --before image, at the current tree positions (plateau_rendering.tree_positions)."""
    rows = apply_replica.load_street_trees(ROOT)
    assert rows, 'Streets/street_trees.json is missing; run python3 Scripts/plateau_replica.py'
    kinds = apply_replica.load_tree_kinds(ROOT)
    doc = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Streets/street_trees.json').read_text())
    made, old_calls = {}, []
    saved = preview.species_collection, preview.tree_template, preview.place_trees
    # One collection per kind, mesh and leaves: the kind's own leaves (None), or the tinted leaves of another fall.
    preview.species_collection = lambda species, kind, variant=None, leaves=None: made.setdefault(
        (species, variant, leaves and leaves['key']), Collection(f'Tree_{species}_{variant}'))
    preview.tree_template = lambda: (_ for _ in ()).throw(AssertionError('a tree fell back to tree_small_02'))
    preview.place_trees = lambda trees, region, col: (old_calls.append(list(trees)), len(trees))[1]
    try:
        everything = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(0., 0., 1e9))
        world = Collection('World')
        street, old, yard = preview.place_all_trees(everything, world)
        assert street == len(rows) == doc['counts']['street_trees'], (street, len(rows))
        assert old == 0 and not old_calls, 'the old summer tree is drawn next to the species street trees'
        assert yard == len(apply_replica.load_yard_trees(ROOT)), yard
        street_groups = [g for g in apply_replica.plan_trees(rows, kinds) if g['group'] == 'street']
        planned = [((g['kind'], g['variant'], g['leaves'] and g['leaves']['key']), g['fall'], t)
                   for g in street_groups for t in g['transforms']]
        placed = [ob for ob in world.linked if ob.name.startswith('StreetTree_')]
        assert len(placed) == len(planned) == len(rows), (len(placed), len(planned))
        counts, falls = {}, {}
        for ob, (key, fall, ((x, y, z), yaw, scale)) in zip(placed, planned):
            assert ob.instance_type == 'COLLECTION' and ob.instance_collection is made[key], (ob.name, key)
            assert ob.location == (x / 100, -y / 100, z / 100), ob.name
            assert abs(ob.rotation_euler[2] + math.radians(yaw)) < 1e-12, ob.name
            assert tuple(ob.scale) == tuple(scale), ob.name
            counts[key[0]] = counts.get(key[0], 0) + 1
            falls[f'{key[0]} {fall}'] = falls.get(f'{key[0]} {fall}', 0) + 1
        assert counts == doc['kinds'], (counts, doc['kinds'])
        assert counts.get('elm'), 'no elm or hackberry on the vase mesh'
        # The fifth pass's kinds and colours: conifers and larches on their own meshes, and the red and russet trees on
        # their own tinted leaves, one collection per kind, mesh and fall, as the apply step makes one actor per group.
        assert counts.get('conifer') and counts.get('larch'), 'no conifer or larch on its own mesh'
        want = {}
        for r in rows:
            want[f'{r["kind"]} {r["fall"]}'] = want.get(f'{r["kind"]} {r["fall"]}', 0) + 1
        assert falls == want, (falls, want)
        assert not any(f.split()[1] == 'evergreen' and f.split()[0] != 'conifer' for f in falls), falls
        tinted = {(g['kind'], g['variant'], g['leaves']['key']) for g in street_groups if g['leaves']}
        assert tinted and {k for k in made if k[2]} == tinted, (sorted(k for k in made if k[2]), sorted(tinted))
        assert {g['fall'] for g in street_groups if g['leaves']} >= {'red', 'russet'}, 'no red or russet tree drawn'
        young = sum(1 for key, _, _ in planned if key[1])
        assert young and all(kinds[k].get(apply_replica.YOUNG) for (k, v, _) in made if v), young
        meshes = len(made)
        # Before the apply step: the old summer tree where the saved map's QuebecVegetation stand-in holds it, on the
        # 4,571 OSM tree nodes (plateau_rendering.osm_tree_positions), not at the inventory's street_trees.json rows;
        # no species or yard tree.
        made.clear()
        before = Collection('Before')
        street, old, yard = preview.place_all_trees(everything, before, before=True)
        from plateau_rendering import osm_tree_positions
        nodes = list(osm_tree_positions())
        assert street is None and yard == 0 and not made and not before.linked
        assert len(old_calls) == 1 and old_calls[0] == nodes and old == len(nodes) != len(rows), \
            'the --before trees are not on the OSM nodes the saved map holds'
    finally:
        preview.species_collection, preview.tree_template, preview.place_trees = saved
    # A young street tree reads its kind's young OBJ and wears the kind's bark and leaves.
    read, objects = [], []
    saved = preview.read_obj_groups, preview.make_object, preview.replica_material
    preview.read_obj_groups = lambda path: (read.append(Path(path).name),
                                            {'elm_young_bark': ([], [], [], None), 'elm_young_leaves': ([], [], [], None)})[1]
    preview.make_object = lambda name, verts, polys, uvs, material, collection, smooth=False: \
        objects.append((name, material)) or types.SimpleNamespace(data=None)
    preview.replica_material = lambda layer, key, spec: (layer, key)
    preview.SPECIES.clear()
    # A tree of another fall stands on its kind's own mesh, its bark the kind's, its leaves the plan's tinted leaves.
    group = next(g for g in street_groups if g['leaves'] and g['variant'] == apply_replica.YOUNG)
    tint = group['leaves']
    try:
        preview.species_collection('elm', kinds['elm'], apply_replica.YOUNG)
        preview.species_collection('elm', kinds['elm'])
        preview.species_collection(group['kind'], kinds[group['kind']], group['variant'], tint)
        preview.species_collection(group['kind'], kinds[group['kind']], group['variant'])
    finally:
        preview.read_obj_groups, preview.make_object, preview.replica_material = saved
        preview.SPECIES.clear()
    assert read[:2] == [Path(kinds['elm']['young']['obj']).name, Path(kinds['elm']['obj']).name], read
    assert dict(objects[:2]) == {'T_elm_young_bark': ('Trees', kinds['elm']['materials']['bark']['key']),
                                 'T_elm_young_leaves': ('Trees', kinds['elm']['materials']['leaves']['key'])}, objects
    own = kinds[group['kind']]['materials']
    assert read[2:] == [Path(kinds[group['kind']]['young']['obj']).name] * 2, read
    assert [m for _, m in objects[4:6]] == [('Trees', own['bark']['key']), ('Trees', tint['key'])], objects[4:6]
    assert [m for _, m in objects[6:8]] == [('Trees', own['bark']['key']), ('Trees', own['leaves']['key'])], objects[6:]
    assert len({name for name, _ in objects}) == len(objects), 'two tree collections share an object name'
    # The tinted leaves are built as the kind's leaves are (the apply step's material row for the tinted spec): the same
    # atlas, mask and foliage shading, with the tint that brings the kind's cells to the fall's colour.
    sets = apply_replica.load_textures(ROOT)
    fall_rows = {}
    for g in street_groups:
        if g['leaves'] and g['leaves']['key'] not in fall_rows:
            row = check_material(preview, 'Trees', g['leaves']['key'], g['leaves']['spec'], sets, listed=False)
            base = apply_replica.material_row('Trees', own['leaves']['key'], own['leaves']['spec'], sets, set())
            assert row['texture_set'] == base['texture_set'] and row['blend_mode'] == base['blend_mode'], g['label']
            fall_rows[g['leaves']['key']] = g['leaves']['spec']['base_color_srgb']
    return {'street_trees': len(rows), 'kinds': counts, 'falls': falls, 'fall_leaves': fall_rows, 'young': young,
            'meshes': meshes}


def check_index(preview):
    """The OBJ index forgets OBJs a generator removed and holds no tree positions (an older index kept the 4,571 OSM
    positions after Streets moved the trees into the inventory's pits)."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        data, cache = root / 'Data' / 'Plateau', root / 'Saved' / 'ReplicaPreview'
        (data / 'BaseGeometry').mkdir(parents=True)
        cache.mkdir(parents=True)
        (data / 'BaseGeometry' / 'Road.obj').write_text('v 0 0 0\nv 100 -200 5\nv 0 -200 0\nf 1 2 3\n')
        gone = 'Data/Plateau/BaseGeometry/Gone.obj'
        (cache / 'index.json').write_text(json.dumps({gone: {'mtime': 0, 'size': 1, 'b': [0] * 6},
                                                      '__trees__': [[35192.46, -26144.62, 4851822679]]}))
        saved = preview.ROOT, preview.DATA, preview.CACHE
        preview.ROOT, preview.DATA, preview.CACHE = str(root), str(data), str(cache)
        try:
            idx = preview.index()
        finally:
            preview.ROOT, preview.DATA, preview.CACHE = saved
        assert sorted(idx) == ['Data/Plateau/BaseGeometry/Road.obj'], sorted(idx)
        assert idx['Data/Plateau/BaseGeometry/Road.obj']['b'] == [0., 0., 0., 100., 200., 5.]
        assert json.loads((cache / 'index.json').read_text()) == idx
    return {'removed_obj': 'forgotten', 'tree_positions': 'not cached'}


def check_region(preview):
    """Faces reach the view when an edge crosses it (Region.crosses); the old any-corner rule dropped long quads."""
    region = preview.Region((0., 0., 170.), (1000., 0., 170.), 85., 9000.)
    # The ruelle case: one lane quad 4.3 m wide whose ends lie 65 m behind and 123 m ahead of the camera.
    lane = [(-6500., -215.), (12300., -215.), (12300., 215.), (-6500., 215.)]
    assert not any(region.keep(x, y) for x, y in lane), 'the fixture must have no corner in view'
    assert region.face(lane), 'a lane quad under the camera must be kept'
    # A wall run that crosses the wedge 60 m ahead, both ends outside it.
    across = [(6000., -9000.), (6000., 9000.), (6020., 9000.), (6020., -9000.)]
    assert not any(region.keep(x, y) for x, y in across) and region.face(across)
    # A face that holds the camera, all of it outside the region's reach otherwise.
    ground = [(-60000., -60000.), (60000., -60000.), (60000., 60000.), (-60000., 60000.)]
    assert region.face(ground)
    # Faces that stay outside: behind the camera past the near disc, beyond the far distance, beside the wedge.
    for out in ([(-8000., -100.), (-6000., -100.), (-6000., 100.), (-8000., 100.)],
                [(9500., -100.), (12000., -100.), (12000., 100.), (9500., 100.)],
                [(100., 8000.), (300., 8000.), (300., 8800.), (100., 8800.)]):
        assert not region.face(out), out
    # A batch box crossing the wedge sideways: no corner, no nearest point and no point of the view ray in view.
    side = [1000., 5000., 0., 8000., 5100., 100.]
    assert not any(region.keep(x, y) for x, y in ((side[0], side[1]), (side[3], side[1]), (side[0], side[4]),
                                                  (side[3], side[4]), (1000., 5000.)))
    assert region.box(side)
    assert not region.box([-9000., -100., 0., -7000., 100., 100.])
    circle = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(0., 0., 1000.))
    assert circle.face([(-5000., -10.), (5000., -10.), (5000., 10.), (-5000., 10.)])
    assert not circle.face([(2000., 2000.), (3000., 2000.), (3000., 3000.)])
    # read_obj keeps that lane quad (OBJ y is -y) and drops a far one.
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'lane.obj'
        far = [(x + 40000., y) for x, y in lane]
        path.write_text(''.join(f'v {x} {-y} 6.8\n' for x, y in lane + far) + 'f 1 2 3 4\nf 5 6 7 8\n')
        verts, polys, _ = preview.read_obj(str(path), region, want_uv=False)
        assert len(polys) == 1 and len(verts) == 4, polys
    # The real case: the ruelle_mentana camera stands on the lane asphalt of Streets, which is one long quad.
    view = preview.views()['ruelle_mentana']
    cam, target = view['camera']
    real = preview.Region(cam, target, view.get('fov', 85.), view['far'], view.get('circle'))
    streets = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Streets/manifest.json').read_text())
    ahead = (cam[0] + (target[0] - cam[0]) * 1500. / math.dist(cam[:2], target[:2]),
             cam[1] + (target[1] - cam[1]) * 1500. / math.dist(cam[:2], target[:2]))
    hit = None
    for batch in streets['batches']:
        if not batch['material'].startswith('alley') and 'Alley' not in batch['file']:
            continue
        path = ROOT / 'Data/Plateau/ReplicaGeometry/Streets' / batch['file']
        vs = [tuple(map(float, line.split()[1:4])) for line in path.read_text().splitlines() if line.startswith('v ')]
        for line in path.read_text().splitlines():
            if not line.startswith('f '):
                continue
            pts = [(vs[int(t.split('/')[0]) - 1][0], -vs[int(t.split('/')[0]) - 1][1]) for t in line.split()[1:]]
            if preview._inside(ahead[0], ahead[1], pts):
                hit = (batch['file'], pts)
                break
        if hit:
            break
    assert hit, 'no alley face under the ruelle_mentana view 15 m ahead'
    assert real.face(hit[1])
    return {'lane_quad': 'kept', 'ruelle_mentana_alley_face': hit[0],
            'corner_in_view': any(real.keep(x, y) for x, y in hit[1])}


def check_collision_only(preview):
    """Collision_Only batches (the gallery guards' invisible walls) are never drawn; every other batch is."""
    plex = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Plex/manifest.json').read_text())
    invisible = [b for b in plex['batches'] if b['material'] == apply_replica.COLLISION_ONLY]
    assert invisible, 'the Plex layer has no Collision_Only batches to leave out'
    drawn, read = [], []
    saved = preview.make_object, preview.read_obj, preview.replica_material
    preview.make_object = lambda name, verts, polys, uvs, material, collection, smooth=False: \
        drawn.append(name) or types.SimpleNamespace(name=name)
    preview.read_obj = lambda path, region, scale=.01, want_uv=True: (read.append(path), ([(0, 0, 0)] * 3, [[0, 1, 2]], []))[1]
    preview.replica_material = lambda layer, key, spec: key
    try:
        everything = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(0., 0., 1e9))
        preview.load_replica(everything, Collection('World'), layers=('Plex',))
    finally:
        preview.make_object, preview.read_obj, preview.replica_material = saved
    names = {f'Plex_{b["file"][:-4]}' for b in invisible}
    assert not names & set(drawn), sorted(names & set(drawn))[:3]
    assert not any(Path(p).name in {b['file'] for b in invisible} for p in read), 'a Collision_Only OBJ was read'
    assert len(drawn) == len(plex['batches']) - len(invisible), (len(drawn), len(plex['batches']), len(invisible))
    return {'collision_only_batches': len(invisible), 'drawn_batches': len(drawn)}


def check_shadows(preview):
    """Only what casts a shadow in game casts one here. A layer batch follows apply_plateau_replica.casts_shadow (the
    fifth pass's Leaf_Litter patches, the paint, joints and the gutter cast none). A prop casts one only when the apply
    step's prop instances do (PROP_SHADOW): the lamps, poles, BIXI docks, benches and, since the fifth pass, the
    hydrants, signs, bikes, bins, mailboxes, cones and the chantier fence."""
    shown = {}

    def make(name, verts, polys, uvs, material, collection, smooth=False):
        ob = types.SimpleNamespace(name=name, material=material, visible_camera=True, visible_shadow=True,
                                   visible_diffuse=True, visible_glossy=True, visible_transmission=True,
                                   visible_volume_scatter=True)
        assert name not in shown or not name.startswith(LAYERS), name
        shown[name] = ob
        collection.objects.link(ob)
        return ob

    saved = preview.make_object, preview.read_obj, preview.replica_material
    preview.make_object = make
    preview.read_obj = lambda path, region, scale=.01, want_uv=True: ([(0, 0, 0)] * 3, [[0, 1, 2]], [])
    preview.replica_material = lambda layer, key, spec: key
    try:
        everything = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(0., 0., 1e9))
        preview.load_replica(everything, Collection('World'))
        batches = {}
        for layer in LAYERS:
            man = json.loads((ROOT / f'Data/Plateau/ReplicaGeometry/{layer}/manifest.json').read_text())
            batches.update({f'{layer}_{b["file"][:-4]}': b['material'] for b in man['batches']})
        litter = [n for n in shown if batches[n] == 'Leaf_Litter']
        assert litter, 'no Leaf_Litter batch drawn'
        # The litter patches overlap at one height by design. A path tracer's bounce ray leaving one patch meets the
        # coplanar patch at once and reads it as cover, so overlaps render dark; Unreal rasterises both to the same
        # texel. The litter is seen by the camera and lets every other ray pass.
        for n in litter:
            ob = shown[n]
            assert ob.visible_camera and not (ob.visible_diffuse or ob.visible_glossy or ob.visible_transmission
                                              or ob.visible_volume_scatter or ob.visible_shadow), n
        rays = [n for n, ob in shown.items() if n not in litter and not ob.visible_diffuse]
        assert not rays, f'only the litter is hidden from bounce rays: {rays[:4]}'
        bad = [(n, batches[n]) for n, ob in shown.items() if ob.visible_shadow != apply_replica.casts_shadow(batches[n])]
        assert not bad, f'{len(bad)} layer batches cast shadows the game does not: {bad[:4]}'
        layer_objects = len(shown)
        shadowless = sum(1 for ob in shown.values() if not ob.visible_shadow)
        # Props: one collection per prop and colour variant; its parts cast a shadow only for the apply step's props.
        shown.clear()
        rows = []
        for layer in ('Furniture', 'Soul'):
            rows += json.loads((ROOT / f'Data/Plateau/ReplicaGeometry/{layer}/placements.json').read_text())['placements']
        colls, _ = preview.prop_collections(rows)
    finally:
        preview.make_object, preview.read_obj, preview.replica_material = saved
    text = (ROOT / 'Scripts/apply_plateau_replica.py').read_text()
    assert "comp.set_cast_shadow(row['shadow'])" in text and "'shadow': key in PROP_SHADOW" in text, \
        'the apply step\'s prop shadow rule moved; mirror it in the preview'
    casters = tuple(apply_replica.PROP_SHADOW)
    assert tuple(preview.PROP_SHADOW) == casters, (preview.PROP_SHADOW, casters)
    assert {'hydrant', 'sign_stop', 'sign_street', 'bike_locked', 'bin_recycling'} <= set(casters), casters
    by_prop = {}
    for (prop, _), c in colls.items():
        assert c.linked, prop
        for ob in c.linked:
            assert ob.visible_shadow == (prop in casters), (prop, ob.name)
            by_prop[prop] = prop in casters
    assert any(by_prop.values()) and not all(by_prop.values()), by_prop
    return {'layer_batches': layer_objects, 'layer_batches_without_shadow': shadowless, 'leaf_litter_batches': len(litter),
            'props_with_shadow': sorted(p for p, v in by_prop.items() if v)}


def check_prop_variants(preview):
    """Every placement's parts take the colour variant the apply step gives them (plan instances)."""
    the_plan = apply_replica.plan(ROOT)
    picked = {}
    for inst in the_plan['instances']:
        mesh = inst['mesh'].rsplit('/', 1)[1]
        for position, yaw, scale in inst['transforms']:
            picked[(inst['layer'], inst['prop'], mesh, tuple(position), yaw)] = inst['variant']
    props = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Props/manifest.json').read_text())
    parts = {}
    for batch in props['batches']:
        if batch.get('prop') and 'merged' not in batch.get('part', ''):
            parts.setdefault(batch['prop'], []).append(batch)
    checked = varied = left_out = 0
    for layer in ('Furniture', 'Soul'):
        rows = json.loads((ROOT / f'Data/Plateau/ReplicaGeometry/{layer}/placements.json').read_text())['placements']
        for r in rows:
            if r['prop'] not in parts:
                continue
            chosen = preview.prop_variants(parts[r['prop']], r.get('variant_seed', 0), r.get('without', ()))
            for batch, variant in zip(parts[r['prop']], chosen):
                key = (layer, r['prop'], batch['mesh'], tuple(r['position']), r['yaw'])
                if variant is None:
                    # a part the row leaves out (a sign's post on a city pole): the game has none there either
                    assert batch.get('part') in r['without'] and key not in picked, (key, r.get('without'))
                    left_out += 1
                    continue
                assert picked[key] == variant, (key, picked[key], variant)
                checked += 1
                varied += variant != batch['material']
    assert varied, 'no placement took a colour variant'
    return {'parts_checked': checked, 'parts_in_a_variant': varied, 'parts_left_out': left_out}


def check_views(preview):
    """The two new views: the gallery camera stands in its lot's yard at eye height and looks at the gallery stack;
    the HLM camera stands on the far sidewalk of Mentana and looks at the OMHM block."""
    v = preview.views()
    for name in ('ruelle', 'ruelle_mentana', 'aerial', 'corner', 'mentana', 'rachel', 'papineau', 'fabre',
                 'gallery_closeup', 'hlm_mentana'):
        assert name in v, name
    fronts = preview.plex_fronts()
    lot = fronts[preview.GALLERY_LOT]
    rear = lot['rear']
    (cx, cy, cz), (tx, ty, tz) = v['gallery_closeup']['camera']
    assert preview._inside(cx, cy, rear['yard']['rect']), 'the gallery camera is not in the yard'
    (f0, f1) = rear['fence']['line']
    assert preview._segment_distance(cx, cy, f0, f1) >= 100., 'the gallery camera stands in the fence'
    out = rear['decks'][0]['out']
    assert (tx - cx) * out[0] + (ty - cy) * out[1] < 0, 'the gallery camera looks away from the house'
    assert 150. <= cz <= 200. and len(rear['decks']) >= 4
    soul = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Soul/lane_life.json').read_text())
    assert any(line['lot'] == preview.GALLERY_LOT and line['garments'] for line in soul['laundry']['lines'])
    hlm = fronts[preview.HLM_LOT]
    assert hlm['kit'] == 'post-1945 apartment' and hlm['year'] == 1974, (hlm['kit'], hlm['year'])
    (cx, cy, cz), (tx, ty, tz) = v['hlm_mentana']['camera']
    a, b = hlm['front']['a'], hlm['front']['b']
    # On the far sidewalk: 15 to 20 m out from the front's line, past its first corner over the parking side, looking
    # back into the block (the target inside its walls) above the ground floor.
    n = math.dist(a, b)
    along = ((b[0] - a[0]) / n, (b[1] - a[1]) / n)
    d = abs((cx - a[0]) * along[1] - (cy - a[1]) * along[0])
    assert 1500. < d < 2000., d
    assert (cx - a[0]) * along[0] + (cy - a[1]) * along[1] < -500., 'the HLM camera is not past the end wall\'s corner'
    walls = [p for w in hlm['rear']['walls'] for p in (w['a'], w['b'])]
    assert preview._inside(tx, ty, walls) and tz > 600., (tx, ty, tz)
    assert cz == 188., cz
    # On the sidewalk: no Plex front of Mentana within 1 m of the camera, and outside every front yard.
    for f in fronts.values():
        if f['street'] == 'Rue de Mentana' and f['id'] != preview.HLM_LOT:
            assert preview._segment_distance(cx, cy, f['front']['a'], f['front']['b']) > 100. + f['front']['yard_cm'] \
                or preview._segment_distance(cx, cy, f['front']['a'], f['front']['b']) > 4000., f['id']
    # No street-level camera stands right behind a street tree: none of street_trees.json's trunks within 2.5 m ahead
    # of the lens inside the frame (the old mentana spot had a young elm's trunk 1.4 m ahead, filling the middle).
    rows = apply_replica.load_street_trees(ROOT)
    nearest = {}
    for name, spec in v.items():
        if spec.get('circle'):
            continue
        (cx, cy, cz), (tx, ty, tz) = spec['camera']
        n = math.dist((cx, cy), (tx, ty))
        fx, fy = (tx - cx) / n, (ty - cy) / n
        half = math.radians(spec.get('fov', 85.) / 2)
        ahead = [math.dist((cx, cy), r['position'][:2]) for r in rows
                 if (r['position'][0] - cx) * fx + (r['position'][1] - cy) * fy
                 > math.cos(half) * math.dist((cx, cy), r['position'][:2])]
        nearest[name] = round(min(ahead, default=1e9))
        assert nearest[name] > 250., f'{name}: a street tree stands {nearest[name]} cm in front of the camera'
    return {'gallery_closeup': v['gallery_closeup']['camera'], 'hlm_mentana': v['hlm_mentana']['camera'],
            'nearest_tree_ahead_cm': nearest}


def main():
    preview = load_preview()
    report = {'materials': check_set_materials(preview), 'yard_trees': check_yard_trees(preview),
              'street_trees': check_street_trees(preview), 'index': check_index(preview),
              'region': check_region(preview), 'collision_only': check_collision_only(preview),
              'shadows': check_shadows(preview), 'prop_variants': check_prop_variants(preview),
              'views': check_views(preview)}
    print(json.dumps(report, indent=1, sort_keys=True))
    print('Plateau replica preview checks passed')


if __name__ == '__main__':
    main()
