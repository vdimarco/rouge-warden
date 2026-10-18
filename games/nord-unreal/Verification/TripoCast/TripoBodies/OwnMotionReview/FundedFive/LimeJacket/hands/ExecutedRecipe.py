"""Render passed own-body/rig CPU derivatives; no Unreal, GPU or provider writes.

blender -b -t 4 --python-exit-code 1 --python this_file --
--surface Surface.json --motion Motion.json --output NEW_SAVED_DIR [--sequence]
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--surface', type=Path, required=True)
parser.add_argument('--motion', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--sequence', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
resolve = lambda p: Path(p) if Path(p).is_absolute() else ROOT / p
surface_path, motion_path, output = args.surface.resolve(), args.motion.resolve(), args.output.resolve()
assert output.is_relative_to(ROOT / 'Saved/Tests') and not output.exists()
surface, motion = (json.loads(p.read_text()) for p in (surface_path, motion_path))
assert surface['passed'] and motion['passed'] and surface['retained_inputs_unchanged'] and motion['retained_inputs_unchanged']
assert motion['inputs']['surface_receipt']['sha256'] == sha(surface_path)
assert resolve(motion['inputs']['surface_receipt']['path']).resolve() == surface_path
assert motion['inputs']['provider_fbx']['sha256'] == surface['inputs']['provider_fbx']['sha256']
assert surface['rig']['bones'] == 61 and surface['source_geometry']['static_unrigged']
inputs = {'surface': surface_path, 'motion': motion_path, 'recipe': Path(__file__).resolve()}
rows = {'original': surface['inputs']['source_glb'], 'body': surface['output']}
rows.update({name: row['output'] for name, row in motion['clips'].items()})
assert set(rows) == {'original', 'body', 'idle', 'jump', 'walk', 'run'}
for name, row in rows.items():
    path = resolve(row['path']).resolve()
    assert path.is_relative_to(ROOT) and path.is_file() and not path.is_symlink() and sha(path) == row['sha256']
    inputs[name] = path
pins = {name: sha(path) for name, path in inputs.items()}
output.mkdir(parents=True)
working = output / 'input'; working.mkdir()
copies = {}
for name in rows:
    copies[name] = working / (name + inputs[name].suffix)
    shutil.copyfile(inputs[name], copies[name])
    assert sha(copies[name]) == pins[name]
shutil.copyfile(__file__, output / 'ExecutedRecipe.py')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(copies['original']))
originals = [o for o in bpy.data.objects if o.type == 'MESH']
assert len(originals) == 1 and len(originals[0].data.materials) == 1
material = originals[0].data.materials[0]
assert material.use_nodes and len([n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE']) == 3
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(copies['body']), use_anim=False, automatic_bone_orientation=False, use_image_search=False)
objects = [o for o in bpy.data.objects if o not in before]
rigs = [o for o in objects if o.type == 'ARMATURE']; assert len(rigs) == 1
rig = rigs[0]
meshes = [o for o in objects if o.type == 'MESH']; assert len(meshes) == 1 and meshes[0].find_armature() == rig
mesh = meshes[0]
assert len(rig.data.bones) == 61
mesh.data.materials.clear(); mesh.data.materials.append(material)
for o in originals: o.hide_render = True
rig.animation_data_clear()
for b in rig.pose.bones: b.matrix_basis.identity()
presentation = bpy.data.objects.new('CPUPreviewOnlyHeight', None)
bpy.context.scene.collection.objects.link(presentation)
for o in objects:
    if o.parent not in objects:
        matrix = o.matrix_world.copy(); o.parent = presentation; o.matrix_world = matrix
height_scale = 1.82 / surface['geometry']['height_m']
presentation.scale = (height_scale,) * 3
hierarchy = lambda r: {b.name: b.parent.name if b.parent else None for b in r.data.bones}
clips = {}
reference_errors = {}
for name in ('idle', 'walk', 'run', 'jump'):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(copies[name]), use_anim=True, automatic_bone_orientation=False, use_image_search=False)
    loaded = [o for o in bpy.data.objects if o not in before]
    assert len(loaded) == 1 and loaded[0].type == 'ARMATURE'
    clip = loaded[0]
    assert hierarchy(clip) == hierarchy(rig) and clip.animation_data.action
    error = max(abs(v) for b in clip.data.bones for row in b.matrix_local - rig.data.bones[b.name].matrix_local for v in row)
    assert error < 2e-5, (name, error)
    reference_errors[name] = error; clips[name] = clip
scene = bpy.context.scene
scene.render.fps, scene.render.fps_base = 30, 1.
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = 4 if args.sequence else 16
scene.cycles.use_denoising = True
if hasattr(scene.cycles, 'denoising_use_gpu'): scene.cycles.denoising_use_gpu = False
scene.render.threads_mode, scene.render.threads = 'FIXED', 4
scene.render.resolution_x, scene.render.resolution_y = (384, 480) if args.sequence else (512, 640)
scene.render.resolution_percentage = 100; scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('CPUStudio'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.12, .14, .18, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .4
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
floor = bpy.context.object; fm = bpy.data.materials.new('Floor'); fm.diffuse_color = (.18, .19, .21, 1)
floor.data.materials.append(fm)
for location, energy, size in [((4, -3, 5), 450, 4), ((1, 3, 3), 230, 3), ((-3, 0, 4), 350, 3)]:
    data = bpy.data.lights.new('CPUStudio', 'AREA'); data.energy, data.shape, data.size = energy, 'DISK', size
    light = bpy.data.objects.new('CPUStudio', data); scene.collection.objects.link(light); light.location = location
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.objects.new('CPUCamera', bpy.data.cameras.new('CPUCamera')); scene.collection.objects.link(camera)
scene.camera = camera; camera.data.type = 'ORTHO'
font = bpy.data.curves.new('CPUOnlyLabel', 'FONT'); label = bpy.data.objects.new('CPUOnlyLabel', font)
scene.collection.objects.link(label)
label_material = bpy.data.materials.new('Label'); label_material.use_nodes = True
nodes = label_material.node_tree.nodes; nodes.clear(); emission = nodes.new('ShaderNodeEmission')
emission.inputs['Color'].default_value = (.85, .9, .95, 1)
label_material.node_tree.links.new(emission.outputs[0], nodes.new('ShaderNodeOutputMaterial').inputs[0]); font.materials.append(label_material)

def pose_error(clip):
    return max(abs(v) for b in rig.pose.bones for row in b.matrix - clip.pose.bones[b.name].matrix for v in row)

def pose(name, seconds):
    clip = clips[name]; rig.animation_data_create()
    rig.animation_data.action = clip.animation_data.action
    rig.animation_data.action_slot = clip.animation_data.action_slot
    frame = clip.animation_data.action.frame_range[0] + seconds * 30
    scene.frame_set(math.floor(frame), subframe=frame % 1); bpy.context.view_layer.update()
    error = pose_error(clip); assert error < 2e-5, (name, seconds, error)
    return error

pose('jump', .47)
rig.animation_data_clear()
for b in rig.pose.bones: b.matrix_basis.identity()
bpy.context.view_layer.update()
negative_error = pose_error(clips['jump']); assert negative_error > 1e-3, 'Unanimated body must fail the actual pose comparison'
pose('jump', .47)
frames = []

def render(name, clip, seconds, location, aim=(0, 0, .93), scale=2.16):
    error = pose(clip, seconds)
    camera.location = location; camera.rotation_euler = (Vector(aim) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale; bpy.context.view_layer.update()
    font.body = clip.upper() + ' / OWN TRIPO BODY + RIG\nCPU preview - not gameplay'
    font.size = scale * .016; label.rotation_euler = camera.rotation_euler
    width = scale * scene.render.resolution_x / scene.render.resolution_y
    label.location = camera.matrix_world @ Vector((-width * .44, scale * .45, -3))
    file = output / (name + '.png'); scene.render.filepath = str(file)
    bpy.ops.render.render(write_still=True)
    frames.append({'file': file.name, 'clip': clip, 'seconds': seconds,
                   'frame': scene.frame_current + scene.frame_subframe, 'body_vs_clip_pose_error': error, 'sha256': sha(file),
                   'camera_location': list(camera.location), 'camera_aim': list(aim), 'ortho_scale': scale})
    print('OWN_TRIPO_VIEW', name, flush=True)

if args.sequence:
    index = 0
    for clip, intervals in [('idle', 120), ('walk', 31), ('run', 19), ('jump', 36)]:
        for i in range(intervals + 1):
            render(f'{index:03}', clip, i / 30, (3.6, -3.6, 1.1), scale=2.6); index += 1
    assert index == 210
else:
    hand_view_bases = {}
    for side in ('l', 'r'):
        pose('idle', 0)
        world = lambda name, endpoint: rig.matrix_world @ getattr(rig.pose.bones[name + '_' + side], endpoint)
        start, tip = world('hand', 'head'), world('middle_03', 'tail')
        center = (start + tip) * .5
        longitudinal = (tip - start).normalized()
        radial = world('index_01', 'head') - world('pinky_01', 'head')
        radial = (radial - longitudinal * radial.dot(longitudinal)).normalized()
        normal = longitudinal.cross(radial).normalized()
        assert min(longitudinal.length, radial.length, normal.length) > .99
        hand_view_bases[side] = {'center_world_m': list(center), 'longitudinal': list(longitudinal),
            'radial': list(radial), 'plane_normal': list(normal),
            'scope': 'Camera framing from actual evaluated own hand bones; no geometry, pose, weight or skeleton edits.'}
        for view, direction in [('plane-positive', normal), ('plane-negative', -normal),
                                ('radial-profile', (radial * .94 + normal * .34).normalized())]:
            render('hand-' + side + '-' + view, 'idle', 0, center + direction * 2, center, .38)
assert pins == {name: sha(path) for name, path in inputs.items()}, 'Retained inputs changed'
assert all(sha(copies[name]) == pins[name] for name in copies)
report = {'passed': True, 'inputs': {name: {'path': str(path), 'sha256': pins[name]} for name, path in inputs.items()},
          'reference_matrix_errors': reference_errors, 'unanimated_body_negative_control_error': negative_error,
          'device': 'CPU', 'threads': 4, 'gpu_denoising': False, 'samples': scene.cycles.samples,
          'dimensions': [scene.render.resolution_x, scene.render.resolution_y], 'fps': 30, 'frames': frames,
          'preview_only_uniform_height_scale': height_scale, 'original_GLB_material_graph': True,
          'retained_inputs_unchanged': True, 'native_or_final_art_acceptance': False,
          'limitations': ['In-place clips with hard cuts, no native transitions/actor flight/prop grip.',
                         'Inclusive endpoints add four duplicate endpoint frames to the encoded timeline.']}
report.update({'additional_hand_views_only': True, 'hand_view_bases': hand_view_bases,
               'frozen_shared_recipe': {'path': str(ROOT / 'Scripts/review_tripo_cast_motion.py'),
                                        'sha256': '62bb0b2824744baf47ef806605b3de2f89653784d03a4e0d64844bc6f94f5926'}})
assert sha(ROOT / 'Scripts/review_tripo_cast_motion.py') == report['frozen_shared_recipe']['sha256']
(output / 'Readback.json').write_text(json.dumps(report, indent=2) + '\n')
print('OWN_TRIPO_RENDER_COMPLETE', output, flush=True)
