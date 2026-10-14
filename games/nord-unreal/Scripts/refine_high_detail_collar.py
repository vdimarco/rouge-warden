"""CPU-only high-detail front collar study and reviewed albedo-UV1 derivative.

Blender -t 4 --background --factory-startup --python-exit-code 1 --python
Scripts/refine_high_detail_collar.py -- study
Then inspect all six views. Export requires their reviewed mask SHA256:
... -- export --reviewed-mask-sha256 <sha256>

Frozen generated source, maps, own clips, refined-v1 and Content are never edited.
No native import is implied. Adapted from refine_generated_pilot.py and Epic's
TextureCoordinate channel example; UV1 is intended ONLY for garment albedo.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refine_generated_pilot as binary

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
OUT = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/refined-v2-high-detail'
SOURCE_SHA256 = 'b7e7ca0d9c486412108cba85e1cd4a5512fecd4ad36b8cfdb4677259ff6f9244'
TECHNIQUE = 'https://dev.epicgames.com/documentation/en-us/unreal-engine/coordinates-material-expressions-in-unreal-engine'
# Cross-section-reviewed front ledge. The actual front neck wall begins inward
# near Y=-.069m. Do not extend this mask onto that wall or the side neck.
BOUNDS = ((-.025, .025), (-.081, -.070), (1.4704, 1.4746))
MIN_UP_NORMAL = .72


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def protected():
    return {str(p.relative_to(SOURCE)): sha(p) for p in sorted(SOURCE.rglob('*')) if p.is_file()}


def assert_garment_face(points, normal):
    assert len(points) == 3 and len(normal) == 3
    assert all(math.isfinite(c) for p in points for c in p) and all(math.isfinite(c) for c in normal)
    assert normal[2] >= MIN_UP_NORMAL, 'Actual steep neck wall is outside the ledge mask'
    assert all(lo <= p[axis] <= hi for p in points for axis, (lo, hi) in enumerate(BOUNDS)), 'Face extends outside the reviewed front garment ledge'


def load_body():
    import bpy
    assert sha(SOURCE / 'body.fbx') == SOURCE_SHA256, 'Frozen high-detail body changed'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(SOURCE / 'body.fbx'), use_anim=False,
                            automatic_bone_orientation=False, use_image_search=False)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(meshes) == len(rigs) == 1 and meshes[0].name == 'char1'
    rigs[0].data.pose_position = 'REST'
    bpy.context.view_layer.update()
    assert len(meshes[0].data.polygons) == 103544 and len(meshes[0].data.vertices) == 130901
    assert list(meshes[0].data.uv_layers.keys()) == ['UVMap'] and len(rigs[0].data.bones) == 24
    return meshes[0], rigs[0]


def select_faces(body):
    from mathutils import Vector
    world = [body.matrix_world @ v.co for v in body.data.vertices]
    rows = []
    for f in body.data.polygons:
        points = [world[v] for v in f.vertices]
        normal = (points[1] - points[0]).cross(points[2] - points[0]).normalized()
        try:
            assert_garment_face(points, normal)
        except AssertionError:
            continue
        rows.append({'id': f.index, 'loops': list(f.loop_indices),
                     'world_m': [list(p) for p in points], 'geometric_normal_world': list(normal)})
    assert 5 <= len(rows) <= 100, ('Unexpected front ledge mask', len(rows))
    return rows


def dark_patch():
    import bpy
    import numpy as np
    image = bpy.data.images.load(str(SOURCE / 'base_color.png'), check_existing=False)
    image.colorspace_settings.name = 'Non-Color'
    assert tuple(image.size) == (2048, 2048)
    a = np.empty(2048 * 2048 * 4, np.float32)
    image.pixels.foreach_get(a)
    pixels = a.reshape(2048, 2048, 4)[:, :, :3].copy()
    dark = (pixels.max(axis=2) < .18) & (np.ptp(pixels, axis=2) < .035)
    # Complete 64px neutral-dark patch, not one good sample with bright neighbours.
    integral = np.pad(dark.astype(np.int32), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    size = 64
    counts = integral[size:, size:] - integral[:-size, size:] - integral[size:, :-size] + integral[:-size, :-size]
    ys, xs = np.nonzero(counts == size * size)
    assert len(xs), 'No padded neutral shirt-colour patch found'
    # Closest to atlas centre, deterministic for the frozen source.
    index = int(np.argmin((xs + size / 2 - 1024) ** 2 + (ys + size / 2 - 1024) ** 2))
    x, y = int(xs[index]), int(ys[index])
    patch = pixels[y:y + size, x:x + size]
    return pixels, {'lower_left_px': [x, y], 'size_px': size,
                    'center_uv': [(x + size / 2) / 2048, (y + size / 2) / 2048],
                    'rgb_min': float(patch.min()), 'rgb_max': float(patch.max()),
                    'maximum_channel_difference': float(np.ptp(patch, axis=2).max()),
                    'radius_px': 10, 'minimum_dark_padding_px': 22}


def make_mask(body):
    from mathutils import Vector
    from io_scene_fbx import parse_fbx
    pixels, patch = dark_patch()
    rows = select_faces(body)
    tree, version = parse_fbx.parse(str(SOURCE / 'body.fbx'))
    geometry = binary.geometry(tree)
    before = binary.expanded_uv(binary.child(geometry, b'LayerElementUV'))
    assert len(before) == 310632
    assert before == [tuple(d.uv) for d in body.data.uv_layers[0].data], 'Imported/raw loop order differs'
    center = Vector(patch['center_uv'])
    for row in rows:
        assert row['loops'] == [3 * row['id'] + i for i in range(3)]
        corners = [Vector(before[i]) for i in row['loops']]
        centroid = sum(corners, Vector((0, 0))) / 3
        radius = max((c - centroid).length * 2048 for c in corners)
        scale = min(1., patch['radius_px'] / radius)
        row.update(before_uv1=[list(v) for v in corners],
                   after_uv1=[list(center + scale * (v - centroid)) for v in corners], positive_scale=scale)
        uv = sum(corners, Vector((0, 0))) / 3
        row['source_centroid_rgb'] = pixels[min(2047, max(0, int(uv.y * 2048))), min(2047, max(0, int(uv.x * 2048)))].astype(float).tolist()
    return {'source': str((SOURCE / 'body.fbx').relative_to(ROOT)), 'source_sha256': SOURCE_SHA256,
            'source_geometry_id': int(geometry.props[0]), 'fbx_version': version,
            'scope': 'Only the proven central upward garment ledge; actual steep neck wall, side collar and silhouette excluded',
            'selection': {'world_vertex_bounds_m': BOUNDS, 'minimum_geometric_up_normal': MIN_UP_NORMAL,
                          'evidence': 'collar-sections.png and collar-sections.json; eight raw source cross sections'},
            'technique_source': TECHNIQUE, 'patch': patch, 'faces': rows,
            'changed_uv1_corners': 3 * len(rows), 'uv1_outside_mask_exact_uv0_copy': True,
            'geometry_uv0_normals_weights_binds_maps_own_clips_unchanged': True,
            'graphics_accepted': False, 'native_imported': False}


def make_material(body, refined):
    import bpy
    mesh = body.data
    mat = bpy.data.materials.new('CPU_CollarStudy_RetainedMaps')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    uv0, uv1 = nodes.new('ShaderNodeUVMap'), nodes.new('ShaderNodeUVMap')
    uv0.uv_map, uv1.uv_map = 'UVMap', 'UV1'
    for name, port in (('base_color', 'Base Color'), ('normal', 'Normal'), ('roughness', 'Roughness'), ('metallic', 'Metallic')):
        sample = nodes.new('ShaderNodeTexImage')
        sample.image = bpy.data.images.load(str(SOURCE / (name + '.png')), check_existing=False)
        sample.image.colorspace_settings.name = 'sRGB' if name == 'base_color' else 'Non-Color'
        links.new((uv1 if refined and name == 'base_color' else uv0).outputs['UV'], sample.inputs['Vector'])
        if name == 'normal':
            normal = nodes.new('ShaderNodeNormalMap'); normal.uv_map = 'UVMap'
            links.new(sample.outputs['Color'], normal.inputs['Color']); links.new(normal.outputs['Normal'], bsdf.inputs[port])
        else:
            links.new(sample.outputs['Color'], bsdf.inputs[port])
    mesh.materials.clear(); mesh.materials.append(mat)
    return mat


def render_views(body, mask):
    import bpy
    from mathutils import Vector
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 16
    scene.cycles.use_denoising = True; scene.cycles.seed = 7
    if hasattr(scene.cycles, 'denoising_use_gpu'): scene.cycles.denoising_use_gpu = False
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
    scene.render.resolution_x = scene.render.resolution_y = 768; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('CPU_CollarStudyWorld'); scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.22, .22, .22, 1)
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .35
    focus = Vector((0, -.025, 1.52))
    for label, loc, power, size in [('Key', (1.5, -2, 3), 450, 1.2), ('Fill', (-1.8, -1.2, 1.9), 220, 1.5), ('Rim', (-.6, 1.2, 2.6), 320, 1)]:
        data = bpy.data.lights.new('CPU_' + label, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = size
        light = bpy.data.objects.new(data.name, data); scene.collection.objects.link(light); light.location = loc
        light.rotation_euler = (focus - light.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data = bpy.data.cameras.new('CPU_CollarCamera'); camera_data.type = 'ORTHO'; camera_data.ortho_scale = .31
    camera = bpy.data.objects.new(camera_data.name, camera_data); scene.collection.objects.link(camera); scene.camera = camera
    uv1 = body.data.uv_layers.new(name='UV1', do_init=True)
    for row in mask['faces']:
        for loop, uv in zip(row['loops'], row['after_uv1']): uv1.data[loop].uv = uv
    body.data.uv_layers.active_index = 0; body.data.uv_layers[0].active_render = True
    views = []
    for mode in ('original', 'refined', 'selection'):
        mat = make_material(body, mode != 'original')
        if mode == 'selection':
            debug = bpy.data.materials.new('CPU_Only_GarmentSelection'); debug.use_nodes = True
            bsdf = debug.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = (1, .075, .005, 1); bsdf.inputs['Roughness'].default_value = .8
            body.data.materials.append(debug)
            for row in mask['faces']: body.data.polygons[row['id']].material_index = 1
        for view, degrees in [('front', 0), ('three-quarter', 35)]:
            direction = Vector((math.sin(math.radians(degrees)), -math.cos(math.radians(degrees)), .12)).normalized()
            camera.location = focus + direction * 1.2; camera.rotation_euler = (focus - camera.location).to_track_quat('-Z', 'Y').to_euler()
            path = OUT / ('CPU-' + mode + '-' + view + '.png')
            assert not path.exists(), 'Retain prior CPU image'
            scene.render.filepath = str(path); bpy.ops.render.render(write_still=True)
            views.append({'file': path.name, 'sha256': sha(path), 'device': 'CPU', 'mode': mode, 'view': view})
        for row in mask['faces']: body.data.polygons[row['id']].material_index = 0
    return views


def study(no_render=False):
    before = protected(); OUT.mkdir(parents=True, exist_ok=True)
    assert not (OUT / 'collar-uv1.json').exists(), 'Never overwrite a prior study'
    body, _ = load_body(); mask = make_mask(body)
    (OUT / 'collar-uv1.json').write_text(json.dumps(mask, indent=2) + '\n')
    views = [] if no_render else render_views(body, mask)
    assert protected() == before, 'Raw source changed'
    report = {'passed': True, 'scope': 'CPU collar-mask study only; no FBX export or native acceptance',
              'source_hashes': before, 'source_unchanged': True, 'mask_sha256': sha(OUT / 'collar-uv1.json'),
              'faces': len(mask['faces']), 'corners': mask['changed_uv1_corners'], 'views': views,
              'device': 'CPU', 'threads': 4, 'graphics_accepted': False, 'native_imported': False,
              'limitations': ['Partial central collar repair: side/rear garment rim remains unchanged.',
                              'Geometry/normal and silhouette defects cannot be closed by UV remapping.',
                              'No motion, shader routing, mip behaviour or native appearance acceptance.']}
    (OUT / 'cpu-study.json').write_text(json.dumps(report, indent=2) + '\n')
    print('NORD_HIGH_DETAIL_COLLAR_STUDY', report['mask_sha256'], report['faces'], flush=True)


def export(reviewed_sha):
    from io_scene_fbx import parse_fbx, encode_bin
    before_files = protected(); mask_path = OUT / 'collar-uv1.json'
    assert len(reviewed_sha) == 64 and sha(mask_path) == reviewed_sha, 'Only an explicitly reviewed mask may export'
    target, pending = OUT / 'body.fbx', OUT / 'body.unverified.fbx'
    assert not any(p.exists() for p in (target, pending, OUT / 'body.json')), 'Never replace a prior derivative'
    mask = json.loads(mask_path.read_text()); body, _ = load_body(); actual = make_mask(body)
    assert mask == json.loads(json.dumps(actual)), 'Mask differs from actual frozen garment geometry/UVs'
    baseline = binary.snapshot(SOURCE / 'body.fbx')
    tree, version = parse_fbx.parse(str(SOURCE / 'body.fbx'))
    patched, overrides = binary.append_uv1(tree, mask['faces'])
    assert binary.protected_fingerprint(patched) == binary.protected_fingerprint(tree)
    encode_bin.write(str(pending), binary.encode(patched, encode_bin), version)
    reread, got_version = parse_fbx.parse(str(pending))
    assert got_version == version and binary.protected_fingerprint(reread) == binary.protected_fingerprint(tree)
    restored = binary.snapshot(pending); uv = restored.pop('uv_layers'); original_uv = baseline.pop('uv_layers')['UVMap']
    assert list(uv) == ['UVMap', 'UV1'] and uv['UVMap'] == original_uv
    expected = [overrides.get(i, v) for i, v in enumerate(original_uv)]
    import struct
    expected = [tuple(struct.unpack('<f', struct.pack('<f', v))[0] for v in row) for row in expected]
    assert uv['UV1'] == expected and baseline == restored, 'Fresh FBX reimport changed protected contents'
    assert protected() == before_files, 'Raw source changed'
    pending.rename(target)
    report = {'passed': True, 'source': str((SOURCE / 'body.fbx').relative_to(ROOT)), 'source_sha256': SOURCE_SHA256,
              'output': str(target.relative_to(ROOT)), 'output_sha256': sha(target),
              'mask': str(mask_path.relative_to(ROOT)), 'mask_sha256': reviewed_sha,
              'faces': [r['id'] for r in mask['faces']], 'changed_uv1_corners': len(overrides),
              'original_fbx_contents_identical_except_appended_uv1_layer': True,
              'fresh_reimport_geometry_normals_uv0_weights_binds_identical': True,
              'uv_layers': ['UVMap', 'UV1'], 'bones': len(baseline['bones']),
              'source_hashes': before_files, 'source_unchanged': True,
              'file_metadata_changes': ['FileId', 'CreationTime'], 'graphics_accepted': False, 'native_imported': False,
              'limits': ['Central garment ledge only; no native import, material routing or final graphics/motion acceptance.',
                         'Normal/roughness/metallic must remain UV0 at native integration; only albedo/emission may use UV1.']}
    (OUT / 'body.json').write_text(json.dumps(report, indent=2) + '\n')
    print('NORD_HIGH_DETAIL_COLLAR_EXPORT_OK', sha(target), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['study', 'export']); parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--reviewed-mask-sha256', default='')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.action == 'study': study(args.no_render)
    else: export(args.reviewed_mask_sha256)


if __name__ == '__main__': main()
