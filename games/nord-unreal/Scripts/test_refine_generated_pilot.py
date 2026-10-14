"""Check the surgical UV1 patch without writing a paid-body derivative.

Python checks immutable element contents and rejected masks. Blender additionally
round-trips an isolated synthetic two-triangle FBX with two real UV channels.
"""
from array import array
from collections import namedtuple
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refine_generated_pilot as refine

Element = namedtuple('Element', 'id props props_type elems')


def element(name, props=(), kinds=b'', children=()):
    return Element(name, list(props), bytearray(kinds), list(children))


def reference(kind, index):
    return element(b'LayerElement', children=[element(b'Type', [kind], b'S'), element(b'TypedIndex', [index], b'I')])


uv0 = element(b'LayerElementUV', [0], b'I', [element(b'Version', [101], b'I'), element(b'Name', [b'UVMap'], b'S'),
    element(b'MappingInformationType', [b'ByPolygonVertex'], b'S'), element(b'ReferenceInformationType', [b'IndexToDirect'], b'S'),
    element(b'UV', [array('d', [0, 0, 1, 0, 1, 1, 0, 1])], b'd'), element(b'UVIndex', [array('i', [0, 1, 2, 0, 2, 3])], b'i')])
mesh = element(b'Geometry', [1000000052, b'char1\x00\x01Geometry', b'Mesh'], b'LSS', [
    element(b'Vertices', [array('d', [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])], b'd'),
    element(b'PolygonVertexIndex', [array('i', [0, 1, -3, 0, 2, -4])], b'i'),
    element(b'LayerElementNormal', [0], b'I', [element(b'Normals', [array('d', [0, 0, 1] * 4)], b'd')]), uv0,
    element(b'Layer', [0], b'I', [element(b'Version', [100], b'I'), reference(b'LayerElementNormal', 0), reference(b'LayerElementUV', 0)])])
tree = element(b'', children=[element(b'Objects', children=[mesh, element(b'Deformer', [3, b'unchanged'], b'LS')]),
    element(b'Connections', children=[element(b'C', [b'OO', 3, 1000000052], b'SLL')]),
    element(b'FileId', [b'frozen'], b'R'), element(b'CreationTime', [b'frozen'], b'S')])
face = {'id': 0, 'loops': [0, 1, 2], 'before_uv1': [[0, 0], [1, 0], [1, 1]],
        'after_uv1': [[.2, .3], [.4, .3], [.4, .5]]}
source_hash = refine.fingerprint(tree)
patched, overrides = refine.append_uv1(tree, [face])
assert refine.fingerprint(tree) == source_hash, 'Input elements were mutated'
assert refine.protected_fingerprint(patched) == refine.protected_fingerprint(tree)
layers = [e for e in refine.geometry(patched).elems if e.id == b'LayerElementUV']
assert [e.props for e in layers] == [[0], [1]] and refine.fingerprint(layers[0]) == refine.fingerprint(uv0)
assert refine.expanded_uv(layers[1]) == [overrides.get(i, uv) for i, uv in enumerate(refine.expanded_uv(uv0))]
assert list(refine.child(layers[1], b'UVIndex').props[0][3:]) == [0, 2, 3], 'Shared UV0 entries leaked into unreviewed corners'
for protected in (b'Vertices', b'LayerElementNormal', b'LayerElementUV'):
    corrupted = copy.deepcopy(patched)
    changed = next(e for e in refine.geometry(corrupted).elems if e.id == protected)
    if protected == b'LayerElementUV': changed = refine.child(changed, b'UV')
    elif protected == b'LayerElementNormal': changed = refine.child(changed, b'Normals')
    changed.props[0][0] += .25
    assert refine.protected_fingerprint(corrupted) != refine.protected_fingerprint(tree), 'Protected edit was hidden: ' + str(protected)
for defect in ('empty', 'duplicate', 'wrong_loop', 'wrong_uv0', 'nan', 'outside', 'collapsed', 'reversed'):
    row = copy.deepcopy(face)
    rows = [row]
    if defect == 'empty': rows = []
    elif defect == 'duplicate': rows *= 2
    elif defect == 'wrong_loop': row['loops'] = [1, 2, 3]
    elif defect == 'wrong_uv0': row['before_uv1'][0][0] = .1
    elif defect == 'nan': row['after_uv1'][0][0] = float('nan')
    elif defect == 'outside': row['after_uv1'][0][0] = 2
    elif defect == 'collapsed': row['after_uv1'] = [[.2, .3]] * 3
    elif defect == 'reversed': row['after_uv1'].reverse()
    try:
        refine.append_uv1(tree, rows)
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe UV mask accepted: ' + defect)
    assert refine.fingerprint(tree) == source_hash
reviewed = refine.REVIEWED_MASK_SHA256
try:
    refine.REVIEWED_MASK_SHA256 = ''
    try:
        refine.main()
    except AssertionError as error:
        assert 'has not been verified' in str(error)
    else:
        raise AssertionError('Unreviewed derivative art output was not blocked')
finally:
    refine.REVIEWED_MASK_SHA256 = reviewed

mask_path = refine.OUT / 'collar-uv1.json'
assert hashlib.sha256(mask_path.read_bytes()).hexdigest() == refine.REVIEWED_MASK_SHA256
mask = json.loads(mask_path.read_text())
assert mask['source_sha256'] == refine.SOURCE_SHA256 and mask['source_geometry_id'] == 1000000052
assert len(mask['faces']) == 113 and sum(len(f['loops']) for f in mask['faces']) == 339

try:
    import bpy
except ImportError:
    print('NORD_GENERATED_UV1_CPU_OK protected contents, shared UVs and rejected masks; binary import requires Blender')
else:
    from io_scene_fbx import encode_bin, parse_fbx
    paid_tree, _ = parse_fbx.parse(str(refine.SOURCE))
    in_memory, paid_overrides = refine.append_uv1(paid_tree, mask['faces'])
    assert len(paid_overrides) == 339
    assert refine.protected_fingerprint(in_memory) == refine.protected_fingerprint(paid_tree)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    data = bpy.data.meshes.new('char1')
    data.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [], [(0, 1, 2), (0, 2, 3)])
    body = bpy.data.objects.new('char1', data)
    bpy.context.scene.collection.objects.link(body)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    uv = data.uv_layers.new(name='UVMap')
    for loop, value in zip(uv.data, refine.expanded_uv(uv0)):
        loop.uv = value
    with tempfile.TemporaryDirectory(prefix='nord-uv1-schema-') as temporary:
        source, target = Path(temporary) / 'source.fbx', Path(temporary) / 'patched.fbx'
        bpy.ops.export_scene.fbx(filepath=str(source), use_selection=True, object_types={'MESH'}, bake_anim=False, add_leaf_bones=False)
        binary, version = parse_fbx.parse(str(source))
        modified, expected = refine.append_uv1(binary, [face])
        encode_bin.write(str(target), refine.encode(modified, encode_bin), version)
        reread, actual_version = parse_fbx.parse(str(target))
        assert actual_version == version and refine.protected_fingerprint(binary) == refine.protected_fingerprint(reread)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=str(target), use_anim=False, use_image_search=False)
        imported = next(o.data for o in bpy.context.scene.objects if o.type == 'MESH')
        assert list(imported.uv_layers.keys()) == ['UVMap', 'UV1']
        assert [tuple(v.uv) for v in imported.uv_layers[0].data] == refine.expanded_uv(uv0)
        for index, value in enumerate(imported.uv_layers[1].data):
            assert max(abs(a - b) for a, b in zip(value.uv, expected.get(index, refine.expanded_uv(uv0)[index]))) < 1e-7
        assert [tuple(v.co) for v in imported.vertices] == [(0., 0., 0.), (1., 0., 0.), (1., 1., 0.), (0., 1., 0.)]
    print('NORD_GENERATED_UV1_BLENDER_OK synthetic binary roundtrip and fresh two-channel import; paid source derivative not written')
