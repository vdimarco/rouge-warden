"""Append reviewed collar UV1 to the frozen paid FBX without a Blender export.

Run in Blender background mode. Fixed source and reviewed-mask hashes bind this
derivative art output to the retained paid body and the internal collar review.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v1/body.fbx'
OUT = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/refined-v1'
SOURCE_SHA256 = 'a9f1a81f16986a17a50571b7ed536b1e4137778a8024979576cd427365c3a62e'
REVIEWED_MASK_SHA256 = 'bba92f3782f8056f08b0f41160940c561688f7c07d80de9565a7177aa7746ba8'


def child(element, name):
    matches = [e for e in element.elems if e.id == name]
    assert len(matches) == 1, (element.id, name, len(matches))
    return matches[0]


def fingerprint(element):
    # Same content fingerprint as consolidate_graphic_novel_bind_pose.py.
    digest = hashlib.sha256()
    def add(value):
        digest.update(struct.pack('<Q', len(value)))
        digest.update(value)
    def visit(e):
        add(e.id)
        add(bytes(e.props_type))
        for value in e.props:
            if isinstance(value, bytes): add(value)
            elif isinstance(value, bool): add(bytes([value]))
            elif isinstance(value, int): add(struct.pack('<q', value))
            elif isinstance(value, float): add(struct.pack('<d', value))
            else: add(value.tobytes())
        for nested in e.elems:
            visit(nested)
    visit(element)
    return digest.hexdigest()


def geometry(tree):
    mesh = child(child(tree, b'Objects'), b'Geometry')
    assert mesh.props[1] == b'char1\x00\x01Geometry' and mesh.props[2] == b'Mesh'
    return mesh


def expanded_uv(layer):
    assert child(layer, b'MappingInformationType').props == [b'ByPolygonVertex']
    assert child(layer, b'ReferenceInformationType').props == [b'IndexToDirect']
    values = child(layer, b'UV').props[0]
    indices = child(layer, b'UVIndex').props[0]
    assert len(values) % 2 == 0 and all(0 <= i < len(values) // 2 for i in indices)
    return [tuple(values[2 * i:2 * i + 2]) for i in indices]


def append_uv1(tree, faces):
    mesh = geometry(tree)
    uv0, layer0 = child(mesh, b'LayerElementUV'), child(mesh, b'Layer')
    assert uv0.props == layer0.props == [0], 'Source must have only its original layer'
    before = expanded_uv(uv0)
    polygons = child(mesh, b'PolygonVertexIndex').props[0]
    assert len(before) == len(polygons) and all((v < 0) == (i % 3 == 2) for i, v in enumerate(polygons)), 'Expected original triangle-loop ordering'
    values = array(child(uv0, b'UV').props[0].typecode, child(uv0, b'UV').props[0])
    indices = array(child(uv0, b'UVIndex').props[0].typecode, child(uv0, b'UVIndex').props[0])
    overrides = {}
    assert faces, 'Reviewed collar mask is empty'
    for face in faces:
        loops = face['loops']
        assert loops == [3 * face['id'] + i for i in range(3)] and 0 <= loops[0] < len(before) - 2
        original, target = face['before_uv1'], face['after_uv1']
        assert len(original) == len(target) == 3
        assert [tuple(uv) for uv in original] == [before[i] for i in loops], 'Mask does not match frozen UV0'
        assert all(len(uv) == 2 and all(math.isfinite(v) and 0 <= v <= 1 for v in uv) for uv in target), 'Invalid target UV'
        def area(uv):
            a, b, c = uv
            return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        assert area(original) * area(target) > 0, 'UV remap collapses or reverses a face'
        for loop, uv in zip(loops, target):
            assert loop not in overrides, 'Duplicate reviewed corner'
            assert tuple(uv) != before[loop], 'Reviewed corner did not change'
            indices[loop] = len(values) // 2
            values.extend(uv)
            overrides[loop] = tuple(uv)
    uv1 = uv0._replace(props=[1], elems=[
        e._replace(props=[b'UV1']) if e.id == b'Name' else
        e._replace(props=[values]) if e.id == b'UV' else
        e._replace(props=[indices]) if e.id == b'UVIndex' else e for e in uv0.elems])
    uv_refs = [e for e in layer0.elems if e.id == b'LayerElement' and child(e, b'Type').props == [b'LayerElementUV']]
    assert len(uv_refs) == 1 and child(uv_refs[0], b'TypedIndex').props == [0]
    reference = uv_refs[0]._replace(elems=[e._replace(props=[1]) if e.id == b'TypedIndex' else e for e in uv_refs[0].elems])
    layer1 = layer0._replace(props=[1], elems=[child(layer0, b'Version'), reference])
    updated = mesh._replace(elems=mesh.elems + [uv1, layer1])
    objects = child(tree, b'Objects')
    result = tree._replace(elems=[objects._replace(elems=[updated if e is mesh else e for e in objects.elems]) if e is objects else e for e in tree.elems])
    assert expanded_uv(uv1) == [overrides.get(i, uv) for i, uv in enumerate(before)]
    return result, overrides


def protected_fingerprint(tree):
    mesh, objects = geometry(tree), child(tree, b'Objects')
    original = mesh._replace(elems=[e for e in mesh.elems if not (e.id in (b'LayerElementUV', b'Layer') and e.props == [1])])
    restored = objects._replace(elems=[original if e is mesh else e for e in objects.elems])
    # Blender's binary writer normalizes exactly these two file metadata fields.
    return fingerprint(tree._replace(elems=[restored if e is objects else e for e in tree.elems if e.id not in (b'FileId', b'CreationTime')]))


def encode(element, encode_bin):
    methods = {'B': 'add_bool', 'C': 'add_char', 'Z': 'add_int8', 'Y': 'add_int16', 'I': 'add_int32', 'L': 'add_int64',
        'F': 'add_float32', 'D': 'add_float64', 'R': 'add_bytes', 'S': 'add_string', 'i': 'add_int32_array',
        'l': 'add_int64_array', 'f': 'add_float32_array', 'd': 'add_float64_array', 'b': 'add_bool_array', 'c': 'add_byte_array'}
    output = encode_bin.FBXElem(element.id)
    for kind, value in zip(element.props_type, element.props):
        getattr(output, methods[chr(kind)])(value)
    output.elems = [encode(nested, encode_bin) for nested in element.elems]
    return output


def snapshot(path):
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=False, automatic_bone_orientation=False, use_image_search=False)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(rigs) == len(meshes) == 1 and meshes[0].name == 'char1'
    rig, body = rigs[0], meshes[0]
    return {'bones': {b.name: [b.parent.name if b.parent else None, [list(row) for row in b.matrix_local]] for b in rig.data.bones},
        'rig_matrix': [list(row) for row in rig.matrix_world], 'body_matrix': [list(row) for row in body.matrix_world],
        'positions': [list(v.co) for v in body.data.vertices],
        'faces': [list(p.vertices) for p in body.data.polygons], 'normals': [list(n.vector) for n in body.data.corner_normals],
        'weights': [[(body.vertex_groups[g.group].name, g.weight) for g in v.groups] for v in body.data.vertices],
        'uv_layers': {layer.name: [tuple(uv.uv) for uv in layer.data] for layer in body.data.uv_layers}}


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA256, 'Frozen paid body changed'
    assert REVIEWED_MASK_SHA256, 'Final complete collar mask has not been verified; no FBX is written'
    mask_path = OUT / 'collar-uv1.json'
    assert hashlib.sha256(mask_path.read_bytes()).hexdigest() == REVIEWED_MASK_SHA256, 'Unreviewed collar mask'
    target, pending = OUT / 'body.fbx', OUT / 'body.unverified.fbx'
    provenance = OUT / 'body.json'
    assert not any(p.exists() for p in (target, pending, provenance)), 'Never replace a prior refinement'
    from io_scene_fbx import encode_bin, parse_fbx
    tree, version = parse_fbx.parse(str(SOURCE))
    assert geometry(tree).props[0] == 1000000052
    assert len(child(geometry(tree), b'PolygonVertexIndex').props[0]) == 93078
    before = snapshot(SOURCE)
    uv0 = expanded_uv(child(geometry(tree), b'LayerElementUV'))
    assert before['uv_layers'] == {'UVMap': uv0}, 'Raw and imported loop ordering differ'
    assert [v for face in before['faces'] for v in face] == [v if v >= 0 else -v - 1 for v in child(geometry(tree), b'PolygonVertexIndex').props[0]]
    mask = json.loads(mask_path.read_text())
    assert mask['source_sha256'] == SOURCE_SHA256 and mask['source_geometry_id'] == 1000000052
    assert len(mask['faces']) == 113 and sum(len(face['loops']) for face in mask['faces']) == 339
    refined, overrides = append_uv1(tree, mask['faces'])
    assert protected_fingerprint(refined) == protected_fingerprint(tree), 'Original FBX contents changed'
    encode_bin.write(str(pending), encode(refined, encode_bin), version)
    reread, reread_version = parse_fbx.parse(str(pending))
    assert reread_version == version and protected_fingerprint(reread) == protected_fingerprint(tree)
    after = snapshot(pending)
    layers = after.pop('uv_layers')
    assert list(layers) == ['UVMap', 'UV1'] and layers['UVMap'] == uv0
    # Blender UV storage is float32; the FBX UV1 array retains the reviewed doubles.
    expected = [overrides.get(i, uv) for i, uv in enumerate(uv0)]
    expected = [tuple(struct.unpack('<f', struct.pack('<f', value))[0] for value in uv) for uv in expected]
    assert layers['UV1'] == expected, 'Reimported UV1 differs from reviewed corners'
    before.pop('uv_layers')
    assert before == after and len(before['bones']) == 24, 'Reimport changed geometry/normals/weights/binds'
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA256
    pending.rename(target)
    report = {'passed': True, 'source': str(SOURCE.relative_to(ROOT)), 'source_sha256': SOURCE_SHA256,
        'output': str(target.relative_to(ROOT)), 'output_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'mask_sha256': REVIEWED_MASK_SHA256, 'faces': [f['id'] for f in mask['faces']], 'changed_uv1_corners': len(overrides),
        'original_fbx_contents_identical_except_appended_uv1_layer': True, 'fresh_reimport_geometry_normals_uv0_weights_binds_identical': True,
        'uv_layers': ['UVMap', 'UV1'], 'file_metadata_changes': ['FileId', 'CreationTime'],
        'limits': ['CPU FBX validation only; isolated Unreal import, shader UV routing and rendered acceptance remain required.']}
    provenance.write_text(json.dumps(report, indent=2) + '\n')
    print('NORD_GENERATED_PILOT_UV1_REFINEMENT_OK', json.dumps(report))


if __name__ == '__main__':
    main()
