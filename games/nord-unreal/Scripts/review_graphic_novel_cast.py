"""Original-body bind review, not animation acceptance; run Blender background with -t 4.

Use -- --source ACTUAL_BODY.glb --output NEW_DIRECTORY under ignored Saved/Tests.
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


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def input_plan(source, output):
    source, output = source.resolve(), output.resolve()
    if output.exists():
        raise FileExistsError('Use a fresh review directory: ' + str(output))
    if source.suffix.lower() != '.glb' or not source.is_file():
        raise ValueError('Expected an actual source-body GLB')
    raw = source.read_bytes()
    if len(raw) < 20 or raw[:4] != b'glTF' or struct.unpack_from('<I', raw, 4)[0] != 2:
        raise ValueError('Expected a GLB version2 source')
    size = struct.unpack_from('<I', raw, 12)[0]
    model = json.loads(raw[20:20 + size])
    if any('uri' in item for item in model.get('images', []) + model.get('buffers', [])):
        raise ValueError('Review requires a self-contained GLB; do not resolve external source files')
    return source, output, hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source, output, source_sha = input_plan(args.source, args.output)
    output.mkdir(parents=True)
    (output / 'input').mkdir()
    copied = output / 'input/body.glb'
    shutil.copyfile(source, copied)
    assert digest(copied) == source_sha
    os.chdir(output)

    import bpy
    import numpy as np
    from mathutils import Vector

    assert bpy.app.background and bpy.context.scene.render.threads == 4, 'Run background with -t 4'
    started = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(copied))
    rigs = [ob for ob in bpy.data.objects if ob.type == 'ARMATURE']
    assert len(rigs) == 1, 'Expected one actual humanoid source rig'
    rig = rigs[0]
    rig.animation_data_clear()
    rig.data.pose_position = 'REST'
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    meshes = [ob for ob in bpy.context.scene.objects if ob.type == 'MESH' and ob.find_armature() == rig]
    assert len(meshes) == 1, 'Expected one skinned body; do not silently omit separate accessory meshes'
    mesh = meshes[0]
    widgets = {bone.custom_shape for bone in rig.pose.bones if bone.custom_shape}
    hidden_widgets = []
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH' and ob != mesh:
            assert ob in widgets, 'Unexpected unskinned source geometry: ' + ob.name
            ob.hide_render = True
            hidden_widgets.append(ob.name)
    bpy.context.view_layer.update()

    def evaluated():
        ob = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        points = np.array([ob.matrix_world @ vertex.co for vertex in ob.data.vertices], np.float64)
        ob.data.calc_loop_triangles()
        triangles = np.array([tri.vertices[:] for tri in ob.data.loop_triangles], np.int32)
        assert np.isfinite(points).all() and len(triangles) > 100
        return points, triangles, hashlib.sha256(points.tobytes() + triangles.tobytes()).hexdigest()

    points, triangles, geometry_sha = evaluated()
    assert len(points) == len(mesh.data.vertices)
    bounds = points.min(axis=0), points.max(axis=0)
    height = float(bounds[1][2] - bounds[0][2])
    assert .5 < height < 3, 'Unexpected world-space body height'
    bones = rig.data.bones
    assert {'Hips', 'Head', 'headfront', 'LeftHand', 'RightHand'} <= set(bones.keys())
    anchor = lambda name: rig.matrix_world @ bones[name].head_local
    up = (anchor('Head') - anchor('Hips')).normalized()
    forward = anchor('headfront') - anchor('Head')
    forward = (forward - up * forward.dot(up)).normalized()
    left = (anchor('LeftHand') - anchor('RightHand')).normalized()
    assert abs(up.dot(forward)) < 1e-5 and abs(left.dot(forward)) < .2
    center = Vector((bounds[0] + bounds[1]) * .5)
    face = anchor('Head') + up * ((bounds[1][2] - anchor('Head').z) * .48)

    def material_state():
        materials, images = [], {}
        for material in mesh.data.materials:
            assert material and material.use_nodes
            nodes = []
            for node in material.node_tree.nodes:
                record = {'name': node.name, 'type': node.type}
                if node.type == 'TEX_IMAGE' and node.image:
                    image = node.image
                    pixels = np.empty(len(image.pixels), np.float32)
                    image.pixels.foreach_get(pixels)
                    assert image.packed_file, 'Source images must remain embedded/original'
                    images[image.name] = {'size': list(image.size),
                        'colorspace': image.colorspace_settings.name,
                        'packed_sha256': hashlib.sha256(image.packed_file.data).hexdigest(),
                        'pixel_float32_sha256': hashlib.sha256(pixels.tobytes()).hexdigest()}
                    record['image'] = image.name
                record['defaults'] = {socket.name: list(socket.default_value)
                    if hasattr(socket.default_value, '__len__') else socket.default_value
                    for socket in node.inputs if hasattr(socket, 'default_value')}
                nodes.append(record)
            materials.append({'name': material.name, 'nodes': nodes,
                'links': [[link.from_node.name, link.from_socket.name, link.to_node.name, link.to_socket.name]
                          for link in material.node_tree.links]})
        record = {'materials': materials, 'images': images}
        return record, hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()

    materials, material_sha = material_state()
    assert len(materials['images']) >= 3, 'Expected actual original PBR images'
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
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

    def render(name, direction, target, cropped=None):
        selection = points if cropped is None else cropped
        # Horizontal orthographic rays keep the studio floor from masking lower-body geometry.
        direction = Vector((direction.x, direction.y, 0))
        assert direction.length > .5
        camera.location = target + direction.normalized() * height * 3
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        camera_points = np.array([camera.matrix_world.inverted() @ Vector(point) for point in selection])
        half = np.max(np.abs(camera_points[:, :2]), axis=0)
        scale = max(float(half[1]) * 2, float(half[0]) * 2 / .8) * 1.2
        camera.data.ortho_scale = scale
        assert (half[0] < scale * .8 * .45 and half[1] < scale * .45), 'Review crop clips its target geometry'
        font.body = name.upper() + '\nCPU source bind / original PBR'
        font.size = scale * .014
        label.rotation_euler = camera.rotation_euler
        label.location = camera.matrix_world @ Vector((-scale * .8 * .45, scale * .46, -height))
        bpy.context.view_layer.update()
        assert evaluated()[2] == geometry_sha
        path = output / (name + '.png')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        assert list(struct.unpack_from('>II', path.read_bytes(), 16)) == [512, 640]
        assert evaluated()[2] == geometry_sha
        views.append({'file': path.name, 'sha256': digest(path), 'camera': list(camera.location),
                      'target': list(target), 'ortho_scale_m': scale, 'crop_vertices': len(selection),
                      'evaluated_geometry_sha256': geometry_sha})
        print('CPU_BODY_REVIEW_VIEW', name, flush=True)

    for name, direction in [('front', forward), ('threequarter', forward - left),
                            ('side', -left), ('back', -forward)]:
        render(name, direction, center)
    face_points = points[points[:, 2] > anchor('Head').z - height * .025]
    assert len(face_points) > 100
    for name, direction in [('face-front', forward), ('face-threequarter', forward - left)]:
        render(name, direction, face, face_points)
    for side in ('Left', 'Right'):
        group = mesh.vertex_groups.get(side + 'Hand')
        assert group is not None
        indices = [vertex.index for vertex in mesh.data.vertices
                   if any(weight.group == group.index and weight.weight > .2 for weight in vertex.groups)]
        assert len(indices) > 20
        hand_points = points[indices]
        hand_center = Vector((hand_points.min(axis=0) + hand_points.max(axis=0)) * .5)
        render('hand-' + side.lower(), forward + left * (.45 if side == 'Left' else -.45), hand_center, hand_points)
    assert len(views) == 8 and digest(source) == digest(copied) == source_sha
    assert material_state()[1] == material_sha and evaluated()[2] == geometry_sha
    report = {'passed': True, 'created_utc': datetime.now(timezone.utc).isoformat(),
        'source': {'path': str(source), 'sha256': source_sha, 'copied_input': str(copied)},
        'recipe_sha256': digest(Path(__file__)), 'blender': bpy.app.version_string,
        'render': {'engine': scene.render.engine, 'device': scene.cycles.device,
                   'threads': scene.render.threads, 'samples': scene.cycles.samples,
                   'denoising': False, 'gpu_denoising': False, 'dimensions': [512, 640]},
        'body': {'height_m': height, 'vertices': len(points), 'triangles': len(triangles),
                 'bones': len(bones), 'bounds_world_m': [bound.tolist() for bound in bounds],
                 'evaluated_geometry_sha256': geometry_sha, 'original_material_sha256': material_sha},
        'anchors': {'up': list(up), 'forward': list(forward), 'left': list(left),
                    'camera_direction_projected_to_world_ground': True,
                    'head': list(anchor('Head')), 'headfront': list(anchor('headfront'))},
        'materials': materials, 'hidden_importer_bone_widgets': hidden_widgets,
        'views': views, 'duration_seconds': time.monotonic() - started,
        'raw_source_unchanged': True, 'original_material_and_geometry_unchanged': True,
        'scope': 'Actual original GLB neutral bind morphology/identity/material review only.',
        'limits': ['No Tripo rig, animation, native appearance, prop grip or final art acceptance.',
                   'Crops derive from source head/hand anchors and weighted vertices; fingers may remain fused.',
                   'No source bitmap/geometry edits, scale normalization, provider request, GPU, UE or service operation.']}
    (output / 'Review.json').write_text(json.dumps(report, indent=2) + '\n')
    print('CPU_BODY_REVIEW_COMPLETE', output, flush=True)


if __name__ == '__main__':
    main()
