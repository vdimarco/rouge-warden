"""Eight CPU views of an actual unrigged Tripo body, with source-pinned measured crops.

Adapted from review_graphic_novel_cast.py. Run Blender background with -t 4;
-- --source BODY.glb --anchors SOURCE_PINNED.json --output NEW_SAVED_DIRECTORY.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from review_graphic_novel_cast import digest, input_plan


def load_plan(source, anchors, output):
    source, output, source_sha = input_plan(source, output)
    plan = json.loads(anchors.read_text())
    if plan.get('source_sha256') != source_sha:
        raise ValueError('Measured anchors do not match the actual source bytes')
    basis = plan['basis_world']
    vectors = [basis[name] for name in ('left', 'forward', 'up')]
    for vector in vectors:
        if len(vector) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in vector):
            raise ValueError('Expected finite three-component measured basis')
        if abs(sum(v * v for v in vector) - 1) > 1e-5:
            raise ValueError('Measured basis must be unit length')
    if any(abs(sum(a * b for a, b in zip(vectors[i], vectors[j]))) > 1e-5
           for i, j in ((0, 1), (0, 2), (1, 2))):
        raise ValueError('Measured basis must be orthogonal')
    if max(abs(v - expected) for v, expected in zip(basis['up'], [0, 0, 1])) > 1e-6:
        raise ValueError('This bounded studio requires actual world-Z up')
    for name in ('face', 'hand-left', 'hand-right'):
        bounds = plan['crops_basis_left_forward_up'][name]
        if len(bounds) != 2 or any(len(bound) != 3 for bound in bounds):
            raise ValueError('Expected explicit three-dimensional crop bounds')
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for bound in bounds for v in bound):
            raise ValueError('Crop bounds must be finite')
        if any(lo >= hi for lo, hi in zip(*bounds)):
            raise ValueError('Crop bounds must have positive extent')
    raw = source.read_bytes()
    if struct.unpack_from('<I', raw, 8)[0] != len(raw):
        raise ValueError('GLB length does not match source bytes')
    size = struct.unpack_from('<I', raw, 12)[0]
    model = json.loads(raw[20:20 + size])
    if model.get('skins') or model.get('animations') or model.get('extensionsRequired'):
        raise ValueError('This review is for the actual static, uncompressed source body')
    if len(model.get('meshes', [])) != plan['expected_meshes']:
        raise ValueError('Source mesh inventory differs from measured plan')
    return source, output, source_sha, plan, model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--anchors', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source, output, source_sha, plan, model = load_plan(args.source, args.anchors, args.output)
    output.mkdir(parents=True)
    (output / 'input').mkdir()
    copied = output / 'input/body.glb'
    shutil.copyfile(source, copied)
    shutil.copyfile(args.anchors, output / 'Anchors.json')
    shutil.copyfile(__file__, output / 'ExecutedRecipe.py')
    assert digest(copied) == source_sha
    os.chdir(output)

    import bpy
    import numpy as np
    from mathutils import Vector

    assert bpy.app.background and bpy.context.scene.render.threads == 4, 'Run background with -t 4'
    started = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(copied))
    assert not [ob for ob in bpy.context.scene.objects if ob.type == 'ARMATURE']
    meshes = sorted([ob for ob in bpy.context.scene.objects if ob.type == 'MESH'], key=lambda ob: ob.name)
    assert len(meshes) == plan['expected_meshes'], 'Do not silently omit a source mesh/accessory'
    assert all(not ob.hide_render for ob in meshes)
    bpy.context.view_layer.update()

    def evaluated():
        records, all_points = [], []
        for mesh in meshes:
            ob = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            points = np.array([ob.matrix_world @ vertex.co for vertex in ob.data.vertices], np.float64)
            ob.data.calc_loop_triangles()
            triangles = np.array([tri.vertices[:] for tri in ob.data.loop_triangles], np.int32)
            normals = np.array([normal.vector[:] for normal in ob.data.corner_normals], np.float32)
            uvs = {layer.name: hashlib.sha256(np.array([uv.uv[:] for uv in layer.data], np.float32).tobytes()).hexdigest()
                   for layer in ob.data.uv_layers}
            assert np.isfinite(points).all() and np.isfinite(normals).all() and len(triangles) > 100
            record = {'object': mesh.name, 'vertices': len(points), 'triangles': len(triangles),
                      'matrix_world': [list(row) for row in ob.matrix_world],
                      'bounds_world_source_units': [points.min(axis=0).tolist(), points.max(axis=0).tolist()],
                      'positions_triangles_sha256': hashlib.sha256(points.tobytes() + triangles.tobytes()).hexdigest(),
                      'corner_normals_sha256': hashlib.sha256(normals.tobytes()).hexdigest(),
                      'uv_layers_sha256': uvs,
                      'polygon_material_indices_sha256': hashlib.sha256(np.array([p.material_index for p in ob.data.polygons], np.int32).tobytes()).hexdigest(),
                      'material_slots': [m.name if m else None for m in mesh.data.materials]}
            records.append(record)
            all_points.append(points)
        return np.concatenate(all_points), records, hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest()

    points, geometry, geometry_sha = evaluated()
    bounds = points.min(axis=0), points.max(axis=0)
    height = float(bounds[1][2] - bounds[0][2])
    assert math.isfinite(height) and height > 0
    assert sum(record['triangles'] for record in geometry) == plan['expected_triangles']
    left, forward, up = (Vector(plan['basis_world'][name]) for name in ('left', 'forward', 'up'))
    basis_points = points @ np.array([left, forward, up], np.float64).T
    center = Vector((bounds[0] + bounds[1]) * .5)

    def material_state():
        materials, images = [], {}
        for material in sorted({m for mesh in meshes for m in mesh.data.materials}, key=lambda m: m.name):
            assert material and material.use_nodes
            nodes = []
            for node in material.node_tree.nodes:
                record = {'name': node.name, 'type': node.type}
                if node.type == 'TEX_IMAGE' and node.image:
                    image = node.image
                    pixels = np.empty(len(image.pixels), np.float32)
                    image.pixels.foreach_get(pixels)
                    assert image.packed_file, 'Do not substitute or extract source maps'
                    images[image.name] = {'size': list(image.size), 'colorspace': image.colorspace_settings.name,
                        'packed_sha256': hashlib.sha256(image.packed_file.data).hexdigest(),
                        'pixel_float32_sha256': hashlib.sha256(pixels.tobytes()).hexdigest()}
                    record['image'] = image.name
                record['defaults'] = {socket.name: list(socket.default_value)
                    if hasattr(socket.default_value, '__len__') else socket.default_value
                    for socket in node.inputs if hasattr(socket, 'default_value')}
                nodes.append(record)
            materials.append({'name': material.name, 'use_backface_culling': material.use_backface_culling,
                'surface_render_method': material.surface_render_method, 'nodes': nodes,
                'links': [[link.from_node.name, link.from_socket.name, link.to_node.name, link.to_socket.name]
                          for link in material.node_tree.links]})
        record = {'materials': materials, 'images': images}
        return record, hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()

    materials, material_sha = material_state()
    raw = copied.read_bytes()
    json_size = struct.unpack_from('<I', raw, 12)[0]
    binary = raw[28 + json_size:]
    embedded = []
    for image in model.get('images', []):
        view = model['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        payload = binary[offset:offset + view['byteLength']]
        embedded.append({'name': image.get('name'), 'mime_type': image['mimeType'], 'bytes': len(payload),
                         'sha256': hashlib.sha256(payload).hexdigest()})
    assert {item['sha256'] for item in embedded} == {item['packed_sha256'] for item in materials['images'].values()}
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples = 'CPU', 16
    scene.cycles.use_denoising = False
    if hasattr(scene.cycles, 'denoising_use_gpu'):
        scene.cycles.denoising_use_gpu = False
    scene.render.threads_mode, scene.render.threads = 'FIXED', 4
    scene.render.resolution_x, scene.render.resolution_y = 512, 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('CPUStudioWorld')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.12, .14, .18, 1)
    background.inputs['Strength'].default_value = .4
    bpy.ops.mesh.primitive_plane_add(size=height * 20, location=(center.x, center.y, bounds[0][2] - height * .001))
    floor = bpy.context.object
    floor_material = bpy.data.materials.new('CPUStudioFloor')
    floor_material.diffuse_color = (.18, .19, .21, 1)
    floor.data.materials.append(floor_material)
    for x, y, z, energy, size in [(-1.65, 2.2, 2.75, 450, 2.2), (1.65, .55, 1.65, 230, 1.65), (0, -1.65, 2.2, 350, 1.65)]:
        light = bpy.data.lights.new('CPUStudio', 'AREA')
        light.energy, light.shape, light.size = energy * (height / 1.82) ** 2, 'DISK', size * height
        ob = bpy.data.objects.new('CPUStudio', light)
        scene.collection.objects.link(ob)
        ob.location = center + height * (left * x + forward * y + up * z)
        ob.rotation_euler = (center - ob.location).to_track_quat('-Z', 'Y').to_euler()
    camera = bpy.data.objects.new('CPUCamera', bpy.data.cameras.new('CPUCamera'))
    scene.collection.objects.link(camera)
    scene.camera, camera.data.type = camera, 'ORTHO'
    font = bpy.data.curves.new('CPUOnlyLabel', 'FONT')
    label = bpy.data.objects.new('CPUOnlyLabel', font)
    scene.collection.objects.link(label)
    ink = bpy.data.materials.new('CPULabel')
    ink.use_nodes = True
    ink.node_tree.nodes.clear()
    emission = ink.node_tree.nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (.85, .9, .95, 1)
    ink.node_tree.links.new(emission.outputs[0], ink.node_tree.nodes.new('ShaderNodeOutputMaterial').inputs[0])
    font.materials.append(ink)
    views = []

    def render(name, direction, selection):
        target = Vector((selection.min(axis=0) + selection.max(axis=0)) * .5)
        assert len(selection) > 20 and abs(direction.z) < 1e-6
        camera.location = target + direction.normalized() * height * 3
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        camera_points = np.array([camera.matrix_world.inverted() @ Vector(point) for point in selection])
        half = np.max(np.abs(camera_points[:, :2]), axis=0)
        scale = max(float(half[1]) * 2, float(half[0]) * 2 / .8) * 1.2
        camera.data.ortho_scale = scale
        assert half[0] < scale * .8 * .45 and half[1] < scale * .45
        font.body, font.size = name.upper() + '\nCPU source pose / original PBR', scale * .014
        label.rotation_euler = camera.rotation_euler
        label.location = camera.matrix_world @ Vector((-scale * .8 * .45, scale * .46, -height))
        bpy.context.view_layer.update()
        assert evaluated()[2] == geometry_sha
        path = output / (name + '.png')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        assert list(struct.unpack_from('>II', path.read_bytes(), 16)) == [512, 640]
        assert evaluated()[2] == geometry_sha and material_state()[1] == material_sha
        views.append({'file': path.name, 'sha256': digest(path), 'camera_world': list(camera.location),
                      'target_world': list(target), 'ortho_scale_source_units': scale, 'crop_vertices': len(selection),
                      'crop_bounds_world_source_units': [selection.min(axis=0).tolist(), selection.max(axis=0).tolist()],
                      'evaluated_geometry_sha256': geometry_sha, 'original_material_sha256': material_sha})
        print('TRIPO_BODY_VIEW', name, flush=True)

    for name, direction in [('front', forward), ('threequarter', forward - left), ('side', -left), ('back', -forward)]:
        render(name, direction, points)
    crops = {}
    for name, (lo, hi) in plan['crops_basis_left_forward_up'].items():
        crops[name] = points[np.all((basis_points >= np.array(lo)) & (basis_points <= np.array(hi)), axis=1)]
        assert len(crops[name]) > 20, 'Empty measured crop: ' + name
    for name, direction in [('face-front', forward), ('face-threequarter', forward - left)]:
        render(name, direction, crops['face'])
    for name, direction in [('hand-left', forward + left * .45), ('hand-right', forward - left * .45)]:
        render(name, direction, crops[name])
    assert len(views) == 8 and digest(source) == digest(copied) == source_sha
    assert material_state()[1] == material_sha and evaluated()[2] == geometry_sha
    report = {'passed': True, 'created_utc': datetime.now(timezone.utc).isoformat(),
        'source': {'path': str(source), 'sha256': source_sha, 'copied_input': str(copied)},
        'recipe_sha256': digest(Path(__file__)), 'input_helper_sha256': digest(Path(__file__).with_name('review_graphic_novel_cast.py')),
        'anchors_sha256': digest(output / 'Anchors.json'), 'blender': bpy.app.version_string,
        'render': {'engine': scene.render.engine, 'device': scene.cycles.device, 'threads': scene.render.threads,
                   'samples': scene.cycles.samples, 'denoising': False, 'gpu_denoising': False, 'dimensions': [512, 640]},
        'source_glb_inventory': {key: model.get(key, []) for key in ('asset', 'nodes', 'meshes', 'materials', 'images', 'textures', 'skins', 'animations')},
        'body': {'height_source_units': height, 'vertices': sum(item['vertices'] for item in geometry),
                 'triangles': sum(item['triangles'] for item in geometry), 'armatures': 0,
                 'bounds_world_source_units': [bound.tolist() for bound in bounds],
                 'evaluated_geometry_sha256': geometry_sha, 'original_material_sha256': material_sha},
        'parts': geometry, 'anchors': plan, 'embedded_images': embedded, 'materials': materials,
        'views': views, 'duration_seconds': time.monotonic() - started,
        'raw_source_unchanged': True, 'original_material_geometry_normals_uvs_unchanged': True,
        'scope': 'Actual unrigged original Tripo GLB source-pose morphology/identity/material review only.',
        'limits': ['Source units are measured, not a meter or production-height claim.',
                   'No rig, animation, skinning, native appearance, prop grip, final-art or performance acceptance.',
                   'No geometry/bitmap/material edits, scale normalization, provider, GPU, Unreal or service operation.']}
    (output / 'Review.json').write_text(json.dumps(report, indent=2) + '\n')
    print('TRIPO_BODY_REVIEW_COMPLETE', output, flush=True)


if __name__ == '__main__':
    main()
