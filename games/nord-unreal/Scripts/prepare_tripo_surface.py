"""Restore original shading on the separate Tripo skin; Blender background, four threads.

Run with -- --output NEW_BODY_DIRECTORY --report NEW_DIRECTORY. No rescale, API or UE.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
from datetime import datetime, timezone

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
SOURCE = PILOT / 'generated-v2-high-detail/body.glb'
PROVIDER = PILOT / 'tripo-v3-rig-20261017/rig.fbx'
NORMAL = SOURCE.parent / 'normal.png'
EXPECTED = {
    SOURCE: '25041be9666422c30ba39449cb283a83928bb3de596fe063389707c070335613',
    PROVIDER: 'baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2',
    NORMAL: '7845864ce13d1e3ce10e8149ef2ef98a048b8be249a60749dfc70c4897e9e7ab',
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
OUT, REPORT = args.output.resolve(), args.report.resolve()
assert not any((OUT / name).exists() for name in ('body.fbx', 'base_color.jpg', 'metallic_roughness.jpg'))
assert not REPORT.exists(), 'Use fresh body outputs/report directory'
assert not any(p == OUT or p in OUT.parents for p in (SOURCE.parent,)), 'Do not write source'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


assert all(digest(p) == h for p, h in EXPECTED.items()), 'Pinned input mismatch'
OUT.mkdir(parents=True, exist_ok=True)
REPORT.mkdir(parents=True)


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.suffix == '.glb':
        bpy.ops.import_scene.gltf(filepath=str(path))
    else:
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=False,
                               automatic_bone_orientation=False, use_image_search=False)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(rigs) == 1
    rig = rigs[0]
    rig.animation_data_clear()
    rig.data.pose_position = 'REST'
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature() == rig]
    assert len(meshes) == 1
    bpy.context.view_layer.update()
    return rig, meshes[0]


def snapshot(rig, ob):
    mesh = ob.data
    mesh.calc_loop_triangles()
    loops = np.array([t.loops[:] for t in mesh.loop_triangles], dtype=np.int32)
    vertices = np.array([t.vertices[:] for t in mesh.loop_triangles], dtype=np.int32)
    uv = np.empty((len(mesh.loops), 2), np.float64)
    mesh.uv_layers.active.data.foreach_get('uv', uv.ravel())
    normals = np.empty((len(mesh.corner_normals), 3), np.float64)
    mesh.corner_normals.foreach_get('vector', normals.ravel())
    matrix = np.array(ob.matrix_world, np.float64)
    normals = normals @ np.linalg.inv(matrix[:3, :3])
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    points = np.empty((len(mesh.vertices), 3), np.float64)
    mesh.vertices.foreach_get('co', points.ravel())
    points = points @ matrix[:3, :3].T + matrix[:3, 3]
    quantized = np.rint(uv[loops] / 1e-6).astype(np.int64)
    order = np.lexsort((quantized[:, :, 1], quantized[:, :, 0]), axis=1)
    quantized = np.take_along_axis(quantized, order[:, :, None], axis=1)
    keys = np.ascontiguousarray(quantized.reshape(-1, 6)).view(np.dtype((np.void, 48))).ravel()
    assert len(np.unique(keys)) == len(keys), 'Ambiguous UV triangle correspondence'
    tri_order = np.argsort(keys)
    sorted_loops = np.take_along_axis(loops, order, axis=1)[tri_order]
    sorted_vertices = np.take_along_axis(vertices, order, axis=1)[tri_order]
    bones = sorted(rig.data.bones.keys())
    groups = {g.index: g.name for g in ob.vertex_groups}
    indices = {name: i for i, name in enumerate(bones)}
    weights = np.zeros((len(points), len(bones)), np.float32)
    for vertex in mesh.vertices:
        for group in vertex.groups:
            assert groups[group.group] in indices or group.weight == 0
            if groups[group.group] in indices:
                weights[vertex.index, indices[groups[group.group]]] = group.weight
    assert np.isfinite(weights).all() and (weights >= 0).all()
    assert np.max(np.abs(weights.sum(axis=1) - 1)) < 1e-4
    assert (weights > 1e-8).sum(axis=1).max() <= 4
    return {'keys': keys[tri_order], 'loops': sorted_loops,
            'points': points[sorted_vertices], 'normals': normals[sorted_loops],
            'uv': uv[sorted_loops], 'weights': weights, 'vertices': sorted_vertices,
            'bones': bones, 'bind': {b.name: np.array(b.matrix_local) for b in rig.data.bones},
            'parents': {b.name: b.parent.name if b.parent else None for b in rig.data.bones},
            'rig_matrix': np.array(rig.matrix_world), 'mesh_matrix': matrix,
            'height': float(np.ptp(points[:, 2]))}


def normal_error(a, b):
    angle = np.degrees(np.arccos(np.clip(np.sum(a * b, axis=2), -1, 1)))
    return {'mean_deg': float(angle.mean()), 'p99_deg': float(np.percentile(angle, 99)),
            'max_deg': float(angle.max()), 'corners_over_0_1deg': int((angle > .1).sum())}


source_rig, source_mesh = load(SOURCE)
original = snapshot(source_rig, source_mesh)
# Preserve the actual GLB graph and its exact packed images through the scene reset.
material = source_mesh.data.materials[0]
material.use_fake_user = True
material.name = 'TripoOriginalPBR'
for image in bpy.data.images:
    if image.packed_file:
        image.use_fake_user = True
material_copy = material.copy()
material_copy.use_fake_user = True
original_nodes = material_copy.node_tree
# A factory reset would destroy data-blocks, so append the provider alongside source.
# UE treats a nonstandard armature object name as an extra skeleton root.
source_rig.name = 'OriginalSourceRig'
previous = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(PROVIDER), use_anim=False,
                           automatic_bone_orientation=False, use_image_search=False)
objects = [o for o in bpy.data.objects if o not in previous]
rig = next(o for o in objects if o.type == 'ARMATURE')
assert rig.name == 'Armature', rig.name
mesh = next(o for o in objects if o.type == 'MESH' and o.find_armature() == rig)
rig.animation_data_clear()
rig.data.pose_position = 'REST'
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.context.view_layer.update()
provider = snapshot(rig, mesh)
assert len(provider['bones']) == 61 and len(provider['keys']) == 103544
assert np.array_equal(original['keys'], provider['keys'])
scale = 1.8200008461895905
residual = np.linalg.norm(provider['points'] * scale - original['points'], axis=2)
assert residual.max() < 2e-6, 'UV corners do not correspond to the same surface'
before_normals = normal_error(original['normals'], provider['normals'])
local_normals = np.zeros((len(mesh.data.loops), 3), np.float64)
local_normals[provider['loops']] = original['normals'] @ provider['mesh_matrix'][:3, :3]
local_normals /= np.linalg.norm(local_normals, axis=1)[:, None]
mesh.data.normals_split_custom_set(local_normals.tolist())
mesh.data.update()
after = snapshot(rig, mesh)
storage_error = normal_error(original['normals'], after['normals'])
# shortcut: Blender fan-space custom normals are finite precision; retain measured errors, native shading still needs review.
NORMAL_LIMITS = {'mean_deg': .02, 'p99_deg': .1, 'max_deg': 1.0}
assert all(storage_error[k] < bound for k, bound in NORMAL_LIMITS.items())
angles = np.degrees(np.arccos(np.clip(np.sum(original['normals'] * after['normals'], axis=2), -1, 1)))
normal_outliers = [{'uv_triangle_order': int(t), 'corner_order': int(c),
                    'degrees': float(angles[t, c]), 'provider_vertex': int(provider['vertices'][t, c]),
                    'original_normal': original['normals'][t, c].tolist(),
                    'restored_normal': after['normals'][t, c].tolist()}
                   for t, c in np.argwhere(angles > .1)]
mesh.data.materials.clear()
mesh.data.materials.append(material_copy)

# Extract only the two GLB JPEG payloads; normal.png already exists byte-identical.
raw = SOURCE.read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20 + json_size])
binary_offset = 20 + json_size + 8
gltf_material = gltf['materials'][0]
roles = {'base_color': gltf_material['pbrMetallicRoughness']['baseColorTexture']['index'],
         'metallic_roughness': gltf_material['pbrMetallicRoughness']['metallicRoughnessTexture']['index'],
         'normal': gltf_material['normalTexture']['index']}
textures = {}
for role, index in roles.items():
    info = gltf['images'][gltf['textures'][index]['source']]
    view = gltf['bufferViews'][info['bufferView']]
    start = binary_offset + view.get('byteOffset', 0)
    payload = raw[start:start + view['byteLength']]
    path = NORMAL if role == 'normal' else OUT / (role + '.jpg')
    if role == 'normal':
        assert payload == NORMAL.read_bytes()
    else:
        path.write_bytes(payload)
    image_nodes = [n for n in original_nodes.nodes if n.type == 'TEX_IMAGE'
                   and n.image and n.image.packed_file
                   and n.image.packed_file.data == payload]
    assert len(image_nodes) == 1, (role, len(image_nodes))
    image = image_nodes[0].image
    image.filepath_raw = str(path)
    image.unpack(method='REMOVE')
    textures[role] = {'path': str(path.relative_to(ROOT)), 'bytes': len(payload),
                      'sha256': digest(path), 'colorspace': image.colorspace_settings.name,
                      'channels': 'G=Roughness, B=Metallic' if role == 'metallic_roughness' else role}

bpy.ops.object.select_all(action='DESELECT')
for ob in (rig, mesh):
    ob.select_set(True)
bpy.context.view_layer.objects.active = rig
output = OUT / 'body.fbx'
bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True,
    object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False, bake_anim=False,
    use_mesh_modifiers=False, mesh_smooth_type='OFF', use_tspace=True,
    path_mode='RELATIVE', embed_textures=False, axis_forward='-Z', axis_up='Y')

restored_rig, restored_mesh = load(output)
assert restored_rig.name == 'Armature'
restored = snapshot(restored_rig, restored_mesh)
assert np.array_equal(provider['keys'], restored['keys'])
assert np.max(np.abs(provider['uv'] - restored['uv'])) < 1e-6
assert restored['bones'] == provider['bones'] and restored['parents'] == provider['parents']
bind_error = max(float(np.max(np.abs(restored['bind'][name] - provider['bind'][name])))
                 for name in provider['bones'])
geometry_error = float(np.linalg.norm(restored['points'] - provider['points'], axis=2).max())
# Compare weights per corresponding corner, independent of FBX vertex reindexing.
weight_error = max(float(np.max(np.abs(
    restored['weights'][restored['vertices'][:, corner]] -
    provider['weights'][provider['vertices'][:, corner]]))) for corner in range(3))
normals_error = normal_error(original['normals'], restored['normals'])
assert bind_error < 1e-5 and geometry_error < 2e-6 and weight_error < 1e-6
assert all(normals_error[k] < bound for k, bound in NORMAL_LIMITS.items())
assert max(abs(restored['height'] - provider['height']),
           np.max(np.abs(restored['rig_matrix'] - provider['rig_matrix']))) < 1e-5
assert all(digest(path) == expected for path, expected in EXPECTED.items()), 'Input modified'
restored_images = []
for node in restored_mesh.data.materials[0].node_tree.nodes:
    if node.type == 'TEX_IMAGE' and node.image:
        path = Path(bpy.path.abspath(node.image.filepath))
        restored_images.append({'image': node.image.name, 'path': str(path),
                                'sha256': digest(path) if path.is_file() else None})
assert textures['base_color']['sha256'] in [i['sha256'] for i in restored_images]
assert textures['normal']['sha256'] in [i['sha256'] for i in restored_images]
result = {'passed': True, 'created_utc': datetime.now(timezone.utc).isoformat(),
    'blender': bpy.app.version_string, 'threads': 4, 'rendered': False,
    'inputs': {str(p.relative_to(ROOT)): h for p, h in EXPECTED.items()},
    'output': {'path': str(output.relative_to(ROOT)), 'sha256': digest(output),
               'bytes': output.stat().st_size},
    'geometry': {'triangles': len(restored['keys']), 'corners': len(restored['keys']) * 3,
                 'height_m': restored['height'], 'residual_max_m': geometry_error,
                 'uv_quantization': 1e-6, 'provider_size_preserved': True},
    'rig': {'bones': len(restored['bones']), 'armature_object': restored_rig.name,
            'bind_max_abs_error': bind_error,
            'corner_weight_max_abs_error': weight_error, 'hierarchy_preserved': True},
    'original_corner_normals': {'provider_before': before_normals,
                               'after_blender_store': storage_error,
                               'fresh_fbx_reimport': normals_error,
                               'explicit_limits': NORMAL_LIMITS,
                               'after_store_corners_over_0_1deg': normal_outliers,
                               'exact_preservation_claimed': False},
    'textures': textures, 'fresh_import_images': restored_images,
    'material': {'source': 'Exact original GLB material graph before FBX export',
        'packed_MR_native_wiring_required': True, 'MR_channels': 'G=Roughness, B=Metallic',
        'normal_convention': 'Original GLB tangent normal unchanged; native convention must be explicit'},
    'native_import_scale_required': 1.82, 'rescale_applied': False,
    'limitations': ['FBX does not preserve the packed metallic/roughness node graph; native material must wire G/B explicitly.',
        'Native normal/tangent import and visual shading acceptance remain untested.',
        'No rig, animation, skin weights, geometry, provider/source file, Content, service or API changed.'],
    'research': ['https://docs.blender.org/api/5.0/bpy.types.Mesh.html#bpy.types.Mesh.normals_split_custom_set',
                 'https://docs.blender.org/api/5.0/bpy.ops.export_scene.html',
                 'https://docs.blender.org/manual/en/5.2/modeling/meshes/structure.html'],
    'recipe_sha256': digest(Path(__file__))}
(REPORT / 'Surface.json').write_text(json.dumps(result, indent=2) + '\n')
print('TRIPO_SURFACE_PASS', json.dumps(result['original_corner_normals']))
