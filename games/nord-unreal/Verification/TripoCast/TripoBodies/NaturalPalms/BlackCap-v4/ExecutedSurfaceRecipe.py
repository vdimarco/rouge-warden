"""Restore each own Tripo skin from pinned source PBR/normals, without changing geometry.

Blender -b -t 4 --python-exit-code 1 --python this_file --
  --manifest JSON --output NEW_DIR --report NEW_DIR
Manifest: source_glb/provider_fbx each contain path and sha256; normal_png is optional.
The original source may be static/unrigged; the provider must retain its own61 skin.
The pinned GLB's indexed material payloads are authoritative; normal_png is an
external provider receipt whose bytes may differ. No texture conversion occurs.
Relative input paths resolve against the game root. No API, rendering or Unreal.
Adapts prepare_tripo_surface.py's UV/corner-normal algorithm and normal gates.
New-cast source/provider geometry uses a calibrated10micron bound; provider
before/after export retains2microns. Positive scale is measured, never applied.
Static originals permit measured correspondence-only translation for rig recentering;
legacy skinned sources remain origin-only. No rotation is fitted or transform applied.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import itertools
import json
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import traceback

ROOT = Path(__file__).resolve().parents[1]
NORMAL_LIMITS = {'mean_deg': .02, 'p99_deg': .1, 'max_deg': 1.0}
SOURCE_PROVIDER_GEOMETRY_LIMIT_M = 1e-5
PROVIDER_ROUND_TRIP_GEOMETRY_LIMIT_M = 2e-6


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_plan(manifest, output, report):
    """Validate the complete trust boundary before creating any output directory."""
    manifest, output, report = Path(manifest).resolve(), Path(output).resolve(), Path(report).resolve()
    assert manifest.is_file() and not output.exists() and not report.exists(), 'Use fresh output/report directories'
    assert not output.is_relative_to(report) and not report.is_relative_to(output), 'Output and report must be separate'
    document = json.loads(manifest.read_text())
    assert {'source_glb', 'provider_fbx'} <= set(document) <= {'source_glb', 'provider_fbx', 'normal_png'}, 'Pinned GLB/FBX required; external normal PNG optional'
    paths, hashes = {}, {}
    for role, suffix in (('source_glb', '.glb'), ('provider_fbx', '.fbx'), ('normal_png', '.png')):
        if role not in document:
            continue
        row = document[role]
        assert set(row) == {'path', 'sha256'} and isinstance(row['path'], str)
        path = Path(row['path'])
        path = path if path.is_absolute() else ROOT / path
        assert path.is_file() and not path.is_symlink() and path.suffix.lower() == suffix, role
        path = path.resolve()
        assert path.is_relative_to(ROOT / 'Data'), 'Inputs must be retained project Data files'
        expected = row['sha256']
        assert isinstance(expected, str) and len(expected) == 64 and all(c in '0123456789abcdef' for c in expected)
        assert digest(path) == expected, ('Pinned input mismatch', role)
        paths[role], hashes[role] = path, expected
    for source in {paths[role].parent for role in ('source_glb', 'normal_png') if role in paths}:
        assert not output.is_relative_to(source) and not report.is_relative_to(source), 'Do not write inside protected source'
    return paths, hashes


def align_surface(source, target, scale=None, residual_limit_m=SOURCE_PROVIDER_GEOMETRY_LIMIT_M, allow_translation=False):
    """Resolve UV ties by a unique triangle/corner geometry bijection, never by first match."""
    import numpy as np
    keys = target['keys']
    assert np.array_equal(source['keys'], keys), 'Source/provider UV triangle multisets differ'
    starts = np.r_[0, np.flatnonzero(keys[1:] != keys[:-1])+1]
    ends = np.r_[starts[1:], len(keys)]
    counts = ends-starts
    def corner_ties(row):
        return np.any(np.all(row[:, 1:] == row[:, :-1], axis=2), axis=1)
    ties = corner_ties(source['uv_key_corners']) | corner_ties(target['uv_key_corners'])
    singles = starts[(counts == 1) & ~ties[starts]]
    assert len(singles), 'Unambiguous UV triangles required to measure scale'
    a, b = source['points'][singles], target['points'][singles]
    translation = np.zeros(3, np.float64)
    if allow_translation:
        assert scale is None, 'Translation fit is restricted to original static-source correspondence'
        mean_a, mean_b = a.mean(axis=(0, 1)), b.mean(axis=(0, 1))
        centered_a, centered_b = a-mean_a, b-mean_b
        scale = float(np.sum(centered_a*centered_b)/np.sum(centered_b*centered_b))
        translation = mean_a-scale*mean_b
    elif scale is None:
        scale = float(np.sum(a*b)/np.sum(b*b))
    assert np.isfinite(scale) and scale > 0
    triangle = np.arange(len(keys))[:, None].repeat(3, axis=1)
    corner = np.tile(np.arange(3), (len(keys), 1))
    resolved = []
    for start, end in zip(starts, ends):
        if end-start == 1 and not ties[start]:
            continue
        candidates = {}
        for t in range(start, end):
            candidates[t] = []
            for s in range(start, end):
                for permutation in itertools.permutations(range(3)):
                    perm = list(permutation)
                    if not np.array_equal(source['uv_key_corners'][s, perm], target['uv_key_corners'][t]):
                        continue
                    residual = np.linalg.norm(source['points'][s, perm]-(target['points'][t]*scale+translation), axis=1)
                    if residual.max() < residual_limit_m:
                        candidates[t].append((s, perm))
            assert candidates[t], ('No UV/geometry corner correspondence', int(t))
        order = sorted(candidates, key=lambda t: len(candidates[t]))
        solutions = []
        def search(index, used, assignment):
            if len(solutions) > 1:
                return
            if index == len(order):
                solutions.append(assignment.copy()); return
            t = order[index]
            for s, perm in candidates[t]:
                if s not in used:
                    assignment[t] = (s, perm)
                    search(index+1, used | {s}, assignment)
        search(0, set(), {})
        assert len(solutions) == 1, ('Ambiguous UV/geometry bijection; normals may differ', int(start), int(end))
        for t, (s, perm) in solutions[0].items():
            triangle[t], corner[t] = s, perm
        resolved.append({'target_sorted_triangle_range': [int(start), int(end)],
                         'triangles': int(end-start), 'unique_geometry_bijection': True,
                         'mapping': [{'target_triangle': int(t), 'source_triangle': int(s), 'source_corner_order': perm,
                                      'candidate_count': len(candidates[t]),
                                      'geometry_residual_max_m': float(np.linalg.norm(source['points'][s, perm]-(target['points'][t]*scale+translation), axis=1).max())}
                                     for t, (s, perm) in solutions[0].items()]})
    aligned = source.copy()
    for field in ('points', 'normals', 'uv', 'loops', 'vertices', 'uv_key_corners'):
        if field in source:
            aligned[field] = source[field][triangle, corner]
    deltas = aligned['points']-(target['points']*scale+translation)
    residuals = np.linalg.norm(deltas, axis=2)
    proof = {'triangles': len(keys), 'corners': len(keys)*3,
        'provider_to_source_uniform_scale': scale, 'source_residual_max_m': float(residuals.max()),
        'source_residual_mean_m': float(residuals.mean()), 'corners_over_2micron': int((residuals >= 2e-6).sum()),
        'source_residual_p99_m': float(np.percentile(residuals, 99)),
        'source_residual_abs_axis_m': {axis: {'max': float(np.abs(deltas[:, :, i]).max()),
            'p99': float(np.percentile(np.abs(deltas[:, :, i]), 99)), 'mean': float(np.abs(deltas[:, :, i]).mean())} for i, axis in enumerate('xyz')},
        'residual_limit_m': residual_limit_m, 'exact_source_positions_claimed': False,
        'translation_or_rotation_fit': allow_translation, 'rotation_fit': False,
        'translation_fit': allow_translation, 'provider_to_source_translation_m': translation.tolist(),
        'transform_policy': 'Positive uniform scale and translation, correspondence only' if allow_translation else 'Positive uniform scale through origin, correspondence only',
        'geometry_bind_or_object_transform_correction_applied': False,
        'source_bounds_m': {'min': source['points'].min(axis=(0, 1)).tolist(), 'max': source['points'].max(axis=(0, 1)).tolist()},
        'provider_bounds_m': {'min': target['points'].min(axis=(0, 1)).tolist(), 'max': target['points'].max(axis=(0, 1)).tolist()},
        'provider_feet_z_m': float(target['points'][:, :, 2].min()), 'uv_quantization': 1e-6,
        'scale_fit_unambiguous_triangles': len(singles), 'uv_duplicate_triangle_groups': int((counts > 1).sum()),
        'uv_duplicate_triangles': int(counts[counts > 1].sum()), 'uv_corner_tie_triangles': int(ties.sum()),
        'geometry_resolved_groups': resolved, 'geometry_mapping_unique': True}
    if residuals.max() >= residual_limit_m:
        error = AssertionError('UV-matched geometry exceeds the explicit residual gate')
        error.correspondence = proof
        raise error
    return aligned, proof


def load_mesh(path, allow_static=False):
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.threads_mode, bpy.context.scene.render.threads = 'FIXED', 4
    if path.suffix.lower() == '.glb':
        bpy.ops.import_scene.gltf(filepath=str(path))
    else:
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=False, automatic_bone_orientation=False, use_image_search=False)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(rigs) in ((0, 1) if allow_static else (1,))
    rig = rigs[0] if rigs else None
    if rig is not None:
        rig.animation_data_clear()
        rig.data.pose_position = 'REST'
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and (rig is None or o.find_armature() == rig)]
    assert len(meshes) == 1 and len(meshes[0].data.materials) == 1
    bpy.context.view_layer.update()
    return rig, meshes[0]


def snapshot_mesh(rig, ob):
    import numpy as np
    mesh = ob.data
    mesh.calc_loop_triangles()
    assert len(mesh.loop_triangles) > 0 and len(mesh.uv_layers) == 1
    loops = np.array([t.loops[:] for t in mesh.loop_triangles], np.int32)
    vertices = np.array([t.vertices[:] for t in mesh.loop_triangles], np.int32)
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
    assert all(np.isfinite(a).all() for a in (points, uv, normals, matrix))
    quantized = np.rint(uv[loops] / 1e-6).astype(np.int64)
    order = np.lexsort((quantized[:, :, 1], quantized[:, :, 0]), axis=1)
    quantized = np.take_along_axis(quantized, order[:, :, None], axis=1)
    keys = np.ascontiguousarray(quantized.reshape(-1, 6)).view(np.dtype((np.void, 48))).ravel()
    tri_order = np.argsort(keys)
    loops = np.take_along_axis(loops, order, axis=1)[tri_order]
    vertices = np.take_along_axis(vertices, order, axis=1)[tri_order]
    bones = sorted(rig.data.bones.keys()) if rig else []
    indices = {name: i for i, name in enumerate(bones)}
    groups = {g.index: g.name for g in ob.vertex_groups}
    weights = None
    if rig is not None:
        weights = np.zeros((len(points), len(bones)), np.float32)
        for vertex in mesh.vertices:
            for group in vertex.groups:
                assert groups[group.group] in indices or group.weight == 0
                if groups[group.group] in indices:
                    weights[vertex.index, indices[groups[group.group]]] = group.weight
        assert np.isfinite(weights).all() and (weights >= 0).all()
        assert np.max(np.abs(weights.sum(axis=1) - 1)) < 1e-4 and (weights > 1e-8).sum(axis=1).max() <= 4
    else:
        assert not groups, 'Static source cannot carry unexplained skin groups'
        assert not ob.animation_data and not mesh.shape_keys, 'Static source cannot carry animation or morph data'
    return {'keys': keys[tri_order], 'uv_key_corners': quantized[tri_order], 'loops': loops, 'vertices': vertices, 'points': points[vertices],
            'normals': normals[loops], 'uv': uv[loops], 'weights': weights, 'bones': bones,
            'bind': {b.name: np.array(b.matrix_local) for b in rig.data.bones} if rig else {},
            'parents': {b.name: b.parent.name if b.parent else None for b in rig.data.bones} if rig else {},
            'rig_matrix': np.array(rig.matrix_world) if rig else None, 'mesh_matrix': matrix, 'height': float(np.ptp(points[:, 2]))}


def prepare(manifest, output, report):
    paths, hashes = source_plan(manifest, output, report)
    import bpy
    import numpy as np
    assert bpy.app.background and bpy.context.scene.render.threads == 4, 'Run background Blender with -t 4'
    manifest_hash = digest(manifest)
    output.mkdir(parents=True)
    report.mkdir(parents=True)
    work_parent = ROOT / 'Saved/Tests'
    work_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix='TripoCastSurface-', dir=work_parent))
    working = {}
    for role in ('source_glb', 'provider_fbx'):
        working[role] = work / (role + paths[role].suffix)
        shutil.copyfile(paths[role], working[role])
        assert digest(working[role]) == hashes[role]
    result = {'passed': False, 'started_utc': datetime.now(timezone.utc).isoformat(), 'blender': bpy.app.version_string,
              'threads': 4, 'rendered': False, 'recipe_sha256': digest(Path(__file__)),
              'manifest': {'path': str(manifest), 'sha256': manifest_hash},
              'inputs': {role: {'path': str(path.relative_to(ROOT)), 'sha256': hashes[role]} for role, path in paths.items()},
              'working_input_copies': {role: str(path.relative_to(ROOT)) for role, path in working.items()},
              'rescale_applied': False, 'errors': []}

    def normal_error(a, b):
        angles = np.degrees(np.arccos(np.clip(np.sum(a * b, axis=2), -1, 1)))
        return {'mean_deg': float(angles.mean()), 'p99_deg': float(np.percentile(angles, 99)),
                'max_deg': float(angles.max()), 'corners_over_0_1deg': int((angles > .1).sum())}, angles

    def outliers(angles, source, restored, provider):
        return [{'uv_triangle_order': int(t), 'corner_order': int(c), 'degrees': float(angles[t, c]),
                 'provider_vertex': int(provider['vertices'][t, c]), 'original_normal': source[t, c].tolist(),
                 'restored_normal': restored[t, c].tolist()} for t, c in np.argwhere(angles > .1)]

    try:
        source_rig, source_mesh = load_mesh(working['source_glb'], allow_static=True)
        original = snapshot_mesh(source_rig, source_mesh)
        assert not original['bones'] or len(original['bones']) == 24 and {'Hips', 'Head'} <= set(original['bones'])
        result['source_geometry'] = {'bones': len(original['bones']), 'static_unrigged': source_rig is None,
            'triangles': len(original['keys']), 'height_m': original['height'], 'mesh_matrix_world': original['mesh_matrix'].tolist()}
        material = source_mesh.data.materials[0].copy()
        material.name, material.use_fake_user = 'TripoOriginalPBR', True
        for image in bpy.data.images:
            if image.packed_file:
                image.use_fake_user = True
        if source_rig is not None:
            source_rig.name = 'OriginalSourceRig'
        for source_object in bpy.context.scene.objects:
            if source_object.name == 'Armature':
                source_object.name = 'OriginalSourceArmatureNode'
        old = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=str(working['provider_fbx']), use_anim=False,
                                 automatic_bone_orientation=False, use_image_search=False)
        objects = [o for o in bpy.data.objects if o not in old]
        rigs = [o for o in objects if o.type == 'ARMATURE']
        assert len(rigs) == 1 and rigs[0].name == 'Armature'
        rig = rigs[0]
        meshes = [o for o in objects if o.type == 'MESH' and o.find_armature() == rig]
        assert len(meshes) == 1
        mesh = meshes[0]
        rig.animation_data_clear()
        rig.data.pose_position = 'REST'
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
        bpy.context.view_layer.update()
        provider = snapshot_mesh(rig, mesh)
        assert len(provider['bones']) == 61 and np.array_equal(original['keys'], provider['keys'])
        fingers = {f'{d}_{j:02}_{s}' for d in ('thumb', 'index', 'middle', 'ring', 'pinky') for j in (1, 2, 3) for s in ('l', 'r')}
        assert fingers <= set(provider['bones'])
        for name in fingers:
            digit, joint, side = name.split('_')
            parent = 'hand_' + side if joint == '01' else f'{digit}_{int(joint) - 1:02}_{side}'
            assert provider['parents'][name] == parent
            assert provider['weights'][:, provider['bones'].index(name)].sum() > 1e-8, ('Unweighted finger', name)
        original, correspondence = align_surface(original, provider, allow_translation=source_rig is None)
        scale = correspondence['provider_to_source_uniform_scale']
        result['correspondence'] = correspondence
        before_normals, _ = normal_error(original['normals'], provider['normals'])
        local_normals = np.zeros((len(mesh.data.loops), 3), np.float64)
        local_normals[provider['loops']] = original['normals'] @ provider['mesh_matrix'][:3, :3]
        local_normals /= np.linalg.norm(local_normals, axis=1)[:, None]
        mesh.data.normals_split_custom_set(local_normals.tolist())
        mesh.data.update()
        after, _ = align_surface(snapshot_mesh(rig, mesh), provider, scale=1., residual_limit_m=PROVIDER_ROUND_TRIP_GEOMETRY_LIMIT_M)
        stored_error, stored_angles = normal_error(original['normals'], after['normals'])
        result['original_corner_normals'] = {'provider_before': before_normals, 'after_blender_store': stored_error,
            'explicit_limits': NORMAL_LIMITS, 'after_store_corners_over_0_1deg': outliers(stored_angles, original['normals'], after['normals'], provider),
            'exact_preservation_claimed': False}
        # shortcut: Blender fan-space normal storage is finite precision; retain outliers and require native shading review.
        assert all(stored_error[k] < bound for k, bound in NORMAL_LIMITS.items())
        mesh.data.materials.clear()
        mesh.data.materials.append(material)
        raw = paths['source_glb'].read_bytes()
        assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
        json_size = struct.unpack_from('<I', raw, 12)[0]
        gltf = json.loads(raw[20:20 + json_size])
        binary_offset = 20 + json_size + 8
        assert len(gltf['materials']) == 1 and len(gltf['buffers']) == 1 and 'uri' not in gltf['buffers'][0]
        source_material = gltf['materials'][0]
        roles = {'base_color': source_material['pbrMetallicRoughness']['baseColorTexture']['index'],
                 'metallic_roughness': source_material['pbrMetallicRoughness']['metallicRoughnessTexture']['index'],
                 'normal': source_material['normalTexture']['index']}
        textures = {}
        for role, index in roles.items():
            info = gltf['images'][gltf['textures'][index]['source']]
            assert 'bufferView' in info and 'uri' not in info
            view = gltf['bufferViews'][info['bufferView']]
            assert view.get('buffer', 0) == 0
            start = binary_offset + view.get('byteOffset', 0)
            payload = raw[start:start + view['byteLength']]
            assert len(payload) == view['byteLength']
            suffix = {'image/jpeg': '.jpg', 'image/png': '.png'}[info['mimeType']]
            path = output / (role + suffix)
            if role == 'normal':
                result['normal_payload_selection'] = {'source': 'Pinned GLB material.normalTexture index',
                    'texture_index': index, 'image_index': gltf['textures'][index]['source'], 'buffer_view': info['bufferView'],
                    'mime_type': info['mimeType'], 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(),
                    'external_provider_normal_png': {'path': str(paths['normal_png'].relative_to(ROOT)), 'sha256': hashes['normal_png']} if 'normal_png' in paths else None,
                    'external_png_bytes_equal_embedded_payload': payload == paths['normal_png'].read_bytes() if 'normal_png' in paths else None,
                    'external_normal_receipt_available': 'normal_png' in paths,
                    'conversion_or_rebake_applied': False}
            path.write_bytes(payload)
            nodes = [n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.packed_file
                     and bytes(n.image.packed_file.data) == payload]
            assert len(nodes) == 1, (role, len(nodes))
            image = nodes[0].image
            assert image.colorspace_settings.name == ('sRGB' if role == 'base_color' else 'Non-Color')
            image.filepath_raw = str(path)
            image.unpack(method='REMOVE')
            textures[role] = {'path': str(path), 'bytes': len(payload), 'sha256': digest(path),
                              'mime_type': info['mimeType'], 'source_texture_index': index,
                              'source_image_index': gltf['textures'][index]['source'],
                              'colorspace': image.colorspace_settings.name, 'source': 'Unmodified original GLB embedded payload',
                              'channels': 'G=Roughness, B=Metallic' if role == 'metallic_roughness' else role}
        assert textures['normal']['sha256'] == result['normal_payload_selection']['sha256'] != textures['base_color']['sha256']
        bpy.ops.object.select_all(action='DESELECT')
        for ob in (rig, mesh):
            ob.select_set(True)
        bpy.context.view_layer.objects.active = rig
        body = output / 'body.fbx'
        bpy.ops.export_scene.fbx(filepath=str(body), use_selection=True, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False,
                                 bake_anim=False, use_mesh_modifiers=False, mesh_smooth_type='OFF', use_tspace=True,
                                 path_mode='RELATIVE', embed_textures=False, axis_forward='-Z', axis_up='Y')
        restored_rig, restored_mesh = load_mesh(body)
        restored, fresh_correspondence = align_surface(snapshot_mesh(restored_rig, restored_mesh), provider, scale=1., residual_limit_m=PROVIDER_ROUND_TRIP_GEOMETRY_LIMIT_M)
        result['fresh_correspondence'] = fresh_correspondence
        assert restored_rig.name == 'Armature' and restored['bones'] == provider['bones'] and restored['parents'] == provider['parents']
        fresh_finger_weights = {n: float(restored['weights'][:, restored['bones'].index(n)].sum()) for n in fingers}
        assert all(w > 1e-8 for w in fresh_finger_weights.values()), 'Export lost weighted finger controls'
        assert np.array_equal(provider['keys'], restored['keys']) and np.max(np.abs(provider['uv'] - restored['uv'])) < 1e-6
        bind_error = max(float(np.max(np.abs(restored['bind'][n] - provider['bind'][n]))) for n in provider['bones'])
        geometry_error = float(np.linalg.norm(restored['points'] - provider['points'], axis=2).max())
        weight_error = max(float(np.max(np.abs(restored['weights'][restored['vertices'][:, c]] -
                                              provider['weights'][provider['vertices'][:, c]]))) for c in range(3))
        fresh_error, fresh_angles = normal_error(original['normals'], restored['normals'])
        result['original_corner_normals'].update({'fresh_fbx_reimport': fresh_error,
            'fresh_corners_over_0_1deg': outliers(fresh_angles, original['normals'], restored['normals'], provider)})
        assert bind_error < 1e-5 and geometry_error < 2e-6 and weight_error < 1e-6
        assert all(fresh_error[k] < bound for k, bound in NORMAL_LIMITS.items())
        assert max(abs(restored['height'] - provider['height']), np.max(np.abs(restored['rig_matrix'] - provider['rig_matrix'])),
                   np.max(np.abs(restored['mesh_matrix'] - provider['mesh_matrix']))) < 1e-5
        shader = next(n for n in restored_mesh.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        base = shader.inputs['Base Color'].links[0].from_node
        normal_map = shader.inputs['Normal'].links[0].from_node
        assert base.type == 'TEX_IMAGE' and normal_map.type == 'NORMAL_MAP'
        normal = normal_map.inputs['Color'].links[0].from_node
        assert normal.type == 'TEX_IMAGE' and normal.image != base.image
        fresh_images = {}
        for role, node in (('base_color', base), ('normal', normal)):
            path = Path(bpy.path.abspath(node.image.filepath)).resolve()
            assert digest(path) == textures[role]['sha256']
            assert node.image.colorspace_settings.name == ('sRGB' if role == 'base_color' else 'Non-Color')
            fresh_images[role] = {'path': str(path), 'sha256': digest(path)}
        result.update({'output': {'path': str(body), 'sha256': digest(body), 'bytes': body.stat().st_size},
            'geometry': {'triangles': len(restored['keys']), 'height_m': restored['height'], 'residual_max_m': geometry_error,
                         'provider_size_preserved': True, 'uv_quantization': 1e-6},
            'rig': {'bones': 61, 'armature_object': restored_rig.name, 'weighted_finger_bones': sorted(fingers),
                    'fresh_finger_weight_sums': fresh_finger_weights,
                    'bind_max_abs_error': bind_error, 'corner_weight_max_abs_error': weight_error, 'hierarchy_preserved': True},
            'textures': textures, 'fresh_import_images': fresh_images, 'native_import_scale_required': None if source_rig is None else scale,
            'native_scale_policy': 'Static original has no gameplay height; native target height must be calibrated separately' if source_rig is None else 'Restore the legacy source size',
            'material': {'source': 'Exact original GLB graph; provider material discarded',
                         'base_color_and_normal_distinct': True, 'packed_MR_native_wiring_required': True,
                         'MR_channels': 'G=Roughness, B=Metallic', 'normal_convention': 'Original tangent payload unchanged; native convention must be explicit'},
            'limitations': ['No source/provider geometry, rig, weight, animation or transform redesign.',
                            'Source/provider geometry uses the separately calibrated 10micron bound; exact source positions are not claimed. Provider-before/after export retains the strict 2micron bound.',
                            'Native packed MR wiring, normal/tangent convention and rendered shading still require acceptance.']})
        assert all(digest(path) == hashes[role] for role, path in paths.items()) and digest(manifest) == manifest_hash
        result['passed'] = True
    except Exception as error:
        if hasattr(error, 'correspondence'):
            result['rejected_correspondence'] = error.correspondence
        result['errors'].append(traceback.format_exc())
        raise
    finally:
        result['retained_inputs_unchanged'] = all(digest(path) == hashes[role] for role, path in paths.items()) and digest(manifest) == manifest_hash
        result['finished_utc'] = datetime.now(timezone.utc).isoformat()
        (report / 'Surface.json').write_text(json.dumps(result, indent=2) + '\n')
        assert result['retained_inputs_unchanged'], 'Pinned input changed'
    print('TRIPO_CAST_SURFACE_PASS', str(report / 'Surface.json'), flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    prepare(args.manifest.resolve(), args.output.resolve(), args.report.resolve())


if __name__ == '__main__':
    main()
