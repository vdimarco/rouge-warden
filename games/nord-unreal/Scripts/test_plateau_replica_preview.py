"""CPU checks for the Blender preview's replica materials and yard trees (Scripts/blender/plateau_replica_preview.py).

Run from games/nord-unreal:  python3 Scripts/test_plateau_replica_preview.py
No Blender needed: a small fake `bpy` records the node graphs the preview builds. The checks follow the apply
step (apply_plateau_replica.textured_graph and plan_trees): every key that takes a replica texture set gets its
three maps, the textures.json tiling, the capped tint, the DirectX normal map and roughness from R; the masked
sets (Rail_Baluster, Rail_Lattice, Fence_Boards, Leaf_Creeper) are clipped at their opacity_mask_clip with the
alpha read channel-packed; the foliage set transmits base colour x FOLIAGE_SUBSURFACE; the opaque sets have no
transparency; and the yard trees take the apply step's positions, yaws and per-kind crown scales.
"""
import json
import math
from pathlib import Path
import sys
import types

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'Scripts'))
sys.path.insert(0, str(ROOT / 'Scripts' / 'blender'))
import apply_plateau_replica as apply_replica  # noqa: E402

MASKED_KEYS = ('Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Creeper')


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


def check_set_materials(preview):
    textures = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Textures/textures.json').read_text())['sets']
    plex = json.loads((ROOT / 'Data/Plateau/ReplicaGeometry/Plex/manifest.json').read_text())['materials']
    keys = sorted(apply_replica.SHARED_TEXTURE_KEYS) + ['Stone', 'Slate']
    checked = {}
    for key in keys:
        spec = plex.get(key) or {'base_color_srgb': '#808080', 'roughness': .8, 'metallic': 0.}
        mat = preview.replica_material('Plex', key, spec)
        set_name = apply_replica.base_material(key, spec)[1][len('replica_'):]
        entry = textures[set_name]
        nodes, links = list(mat.node_tree.nodes), mat.node_tree.links.items
        images = {Path(n.image.filepath).name: n for n in nodes if n.bl_idname == 'ShaderNodeTexImage'}
        assert sorted(images) == sorted(entry['maps'][r]['file'] for r in ('diff', 'nor_dx', 'rough')), (key, images)
        mapping = next(n for n in nodes if n.bl_idname == 'ShaderNodeMapping')
        assert tuple(mapping.inputs['Scale'].default_value[:2]) == tuple(entry['tiling']), key
        for n in images.values():
            assert source(links, n.inputs['Vector']) is mapping.outputs['Vector'], key + ' map not tiled'
        role = {r: images[entry['maps'][r]['file']] for r in ('diff', 'nor_dx', 'rough')}
        assert role['diff'].image.colorspace_settings.name == 'sRGB', key
        assert role['nor_dx'].image.colorspace_settings.name == role['rough'].image.colorspace_settings.name == 'Non-Color'
        # Base colour = diff x tint, tint = colour / mean_linear capped at the apply step's limit.
        bsdf = mat.node_tree.nodes['Principled BSDF']
        mul = source(links, bsdf.inputs['Base Color']).node
        assert mul.blend_type == 'MULTIPLY' and source(links, preview.sock(mul.inputs, 'A')).node is role['diff'], key
        colour = preview.srgb_to_linear(spec['base_color_srgb'])
        tint = tuple(min(apply_replica.TINT_LIMIT, c / m) for c, m in zip(colour, entry['mean_linear']))
        assert all(abs(a - b) < 1e-9 for a, b in zip(preview.sock(mul.inputs, 'B').default_value[:3], tint)), key
        # Normal: the DirectX map through a DirectX normal-map node, as Unreal reads it. Roughness: R of rough.
        nmap = source(links, bsdf.inputs['Normal']).node
        assert nmap.convention == 'DIRECTX' and source(links, nmap.inputs['Color']).node is role['nor_dx'], key
        split = source(links, bsdf.inputs['Roughness'])
        assert split.name == 'Red' and source(links, split.node.inputs['Color']).node is role['rough'], key
        assert bsdf.inputs['Metallic'].default_value == spec.get('metallic', 0.), key
        # Surface: masked sets clip on the diffuse alpha; opaque sets go straight to the output.
        out = mat.node_tree.nodes['Material Output']
        surface = source(links, out.inputs['Surface'])
        mode = entry.get('material') or {}
        if key in MASKED_KEYS:
            assert mode.get('blend_mode') == 'masked', key
            assert role['diff'].image.alpha_mode == 'CHANNEL_PACKED', key + ' alpha must not be premultiplied'
            mix = surface.node
            assert mix.bl_idname == 'ShaderNodeMixShader', key
            assert source(links, mix.inputs[1]).node.bl_idname == 'ShaderNodeBsdfTransparent', key
            keep = source(links, mix.inputs['Fac']).node
            assert keep.operation == 'GREATER_THAN', key
            assert source(links, keep.inputs[0]) is role['diff'].outputs['Alpha'], key + ' mask is not the diff alpha'
            assert abs(keep.inputs[1].default_value - mode['opacity_mask_clip']) < 2e-3, key
            lit = source(links, mix.inputs[2]).node
            assert key in [k for k in entry['keys']] and preview.MASKED[mat.name][2] == mode['opacity_mask_clip']
            if mode.get('shading_model') == 'two_sided_foliage':
                assert lit.bl_idname == 'ShaderNodeAddShader', key + ' needs the foliage transmission'
                translucent = source(links, lit.inputs[1]).node
                assert translucent.bl_idname == 'ShaderNodeBsdfTranslucent', key
                scale = source(links, translucent.inputs['Color']).node
                assert source(links, preview.sock(scale.inputs, 'A')) is preview.sock(mul.outputs, 'Result'), key
                assert preview.sock(scale.inputs, 'B').default_value[:3] == (apply_replica.FOLIAGE_SUBSURFACE,) * 3
            else:
                assert lit is bsdf, key
        else:
            assert mode.get('blend_mode', 'opaque') == 'opaque', key
            assert surface is bsdf.outputs['BSDF'], key + ' should be opaque'
            assert not any(n.bl_idname == 'ShaderNodeBsdfTransparent' for n in nodes), key
        checked[key] = set_name
    masked = sorted(k for k in checked if k in MASKED_KEYS)
    assert masked == sorted(MASKED_KEYS), masked
    return checked


def check_yard_trees(preview):
    rows = apply_replica.load_yard_trees(ROOT)
    assert rows, 'Plex/yard_trees.json is missing; run python3 Scripts/plateau_plex.py'
    template = Collection('TreeTemplate')
    preview.tree_template = lambda: (template, 4.55)
    world = Collection('World')
    everything = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(0., 0., 1e9))
    n = preview.place_yard_trees(everything, world)
    assert n == len(rows) == len(world.linked), (n, len(rows))
    expected = [t for group in apply_replica.plan_trees(rows) for t in group['transforms']]
    kinds = {}
    for ob, ((x, y, z), yaw, scale) in zip(world.linked, expected):
        assert ob.instance_type == 'COLLECTION' and ob.instance_collection is template, ob.name
        assert ob.location == (x / 100, -y / 100, z / 100), ob.name
        assert abs(ob.rotation_euler[2] + math.radians(yaw)) < 1e-12, ob.name
        assert tuple(ob.scale) == tuple(scale), ob.name
        kind = ob.name.split('_')[1]
        kinds[kind] = kinds.get(kind, 0) + 1
        assert abs(scale[0] / scale[2] - apply_replica.TREE_KINDS[kind]) < 1e-9, ob.name
    # The region filter keeps only trees inside the view.
    far = preview.Region((0., 0., 0.), (1., 0., 0.), 85., 1e9, circle=(1e7, 1e7, 100.))
    assert preview.place_yard_trees(far, Collection('Empty')) == 0
    return {'trees': n, 'kinds': kinds}


def main():
    preview = load_preview()
    report = {'materials': check_set_materials(preview), 'yard_trees': check_yard_trees(preview)}
    print(json.dumps(report, indent=1, sort_keys=True))
    print('Plateau replica preview checks passed')


if __name__ == '__main__':
    main()
