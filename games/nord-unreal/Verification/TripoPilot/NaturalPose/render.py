"""Actual fresh-imported clips, unchanged own skin; bounded Cycles CPU views and motion."""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

P = Path(__file__).resolve().parent
R = P.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--motion', action='store_true', help='Render the bounded review timeline after still review.')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
O = args.output.resolve()
V = O / ('Motion' if args.motion else 'Views')
V.mkdir()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
provider = R / 'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/rig.fbx'
original = R / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.glb'
inputs = {p: sha(p) for p in [provider, original, O / 'relaxed-idle.fbx', O / 'natural-jump.fbx']}
assert inputs[provider] == 'baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2'
verification = json.loads((O / 'IndependentVerification-semantic.json').read_text())
assert verification['passed'] and verification['all_retained_inputs_unchanged']
assert all(sha(O / (name + '.fbx')) == verification['input_sha256'][str(O / (name + '.fbx'))]
           for name in ('relaxed-idle', 'natural-jump'))
fit = json.loads((P.parent / 'CPU/Audit.json').read_text())['comparison']['uv_correspondence_similarity_fit']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(original))
original_mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
material = original_mesh.data.materials[0]
old = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(provider), use_anim=False, automatic_bone_orientation=False, use_image_search=False)
objs = [o for o in bpy.data.objects if o not in old]
rig = next(o for o in objs if o.type == 'ARMATURE')
mesh = next(o for o in objs if o.type == 'MESH' and o.find_armature() == rig)
rig.animation_data_clear()
for b in rig.pose.bones:
    b.matrix_basis.identity()
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.hide_render = o != mesh
mesh.data.materials.clear()
mesh.data.materials.append(material)
root = bpy.data.objects.new('PreviewOnlySourceScale', None)
bpy.context.scene.collection.objects.link(root)
for o in objs:
    if o.parent not in objs:
        m = o.matrix_world.copy()
        o.parent = root
        o.matrix_world = m
normalization = Matrix.Identity(4)
rot = Matrix(fit['rotation_row_vector']).transposed()
for i in range(3):
    for j in range(3):
        normalization[i][j] = rot[i][j] * fit['returned_to_source_scale']
normalization.translation = Vector(fit['offset_m'])
root.matrix_world = normalization
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4 if args.motion else 16
scene.cycles.use_denoising = True
if hasattr(scene.cycles, 'denoising_use_gpu'):
    scene.cycles.denoising_use_gpu = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.fps = 30
scene.render.resolution_x = 512 if args.motion else 720
scene.render.resolution_y = 640 if args.motion else 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('CPUStudioWorld')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.12, .14, .18, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .4
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
floor = bpy.context.object
fm = bpy.data.materials.new('StudioFloor')
fm.diffuse_color = (.18, .19, .21, 1)
floor.data.materials.append(fm)
for loc, energy, size in [((-3, -4, 5), 450, 4), ((3, -1, 3), 230, 3), ((0, 3, 4), 350, 3)]:
    light = bpy.data.lights.new('CPUStudio', 'AREA')
    light.energy, light.shape, light.size = energy, 'DISK', size
    obj = bpy.data.objects.new('CPUStudio', light)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
cam = bpy.data.objects.new('CPUCamera', bpy.data.cameras.new('CPUCamera'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
font = bpy.data.curves.new('CPUOnlyLabel', 'FONT')
label = bpy.data.objects.new('CPUOnlyLabel', font)
scene.collection.objects.link(label)
lm = bpy.data.materials.new('Label')
lm.use_nodes = True
nodes = lm.node_tree.nodes
nodes.clear()
emission = nodes.new('ShaderNodeEmission')
emission.inputs['Color'].default_value = (.85, .9, .95, 1)
lm.node_tree.links.new(emission.outputs[0], nodes.new('ShaderNodeOutputMaterial').inputs[0])
font.materials.append(lm)
hier = lambda r: {b.name: b.parent.name if b.parent else None for b in r.data.bones}
clips = {}
for name in ('relaxed-idle', 'natural-jump'):
    old = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(O / (name + '.fbx')), use_anim=True, automatic_bone_orientation=False, use_image_search=False)
    loaded = [o for o in bpy.data.objects if o not in old]
    assert len(loaded) == 1 and loaded[0].type == 'ARMATURE'
    clip = loaded[0]
    assert hier(clip) == hier(rig) and len(clip.data.bones) == 61
    # The measured raw3x3 FBX rest round-trip error is1.082e-5; semantic bind checks remain separate.
    assert max(abs(v) for b in clip.data.bones for row in b.matrix_local - rig.data.bones[b.name].matrix_local for v in row) < 2e-5
    clips[name] = clip
base_world = root.matrix_world.copy()
readback = []

def pose(name, seconds):
    clip = clips[name]
    rig.animation_data_create()
    rig.animation_data.action = clip.animation_data.action
    rig.animation_data.action_slot = clip.animation_data.action_slot
    # Clips are authored at30Hz, irrespective of the24Hz preview sampling.
    frame = clip.animation_data.action.frame_range[0] + 30 * seconds
    scene.frame_set(math.floor(frame), subframe=frame % 1)
    bpy.context.view_layer.update()
    error = max(abs(v) for b in rig.pose.bones for row in b.matrix - clip.pose.bones[b.name].matrix for v in row)
    assert error < 2e-5, error
    return error

def render(file, title, camera, aim, scale, name, seconds):
    error = pose(name, seconds)
    cam.location = camera
    cam.rotation_euler = (Vector(aim) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = scale
    bpy.context.view_layer.update()
    font.body = title + '\nCPU pose preview - not gameplay'
    font.size = scale * .016
    label.rotation_euler = cam.rotation_euler
    width = scale * scene.render.resolution_x / scene.render.resolution_y
    label.location = cam.matrix_world @ Vector((-width * .44, scale * .45, -3))
    scene.render.filepath = str(V / (file + '.png'))
    bpy.ops.render.render(write_still=True)
    readback.append({'file': file + '.png', 'clip': name, 'clip_seconds': seconds,
                     'actual_frame': scene.frame_current + scene.frame_subframe, 'pose_error': error,
                     'sha256': sha(V / (file + '.png'))})
    print('RELAXED_POSE_VIEW', file, flush=True)

if not args.motion:
    for view, loc in [('threequarter', (-3.6, -3.6, 1.1)), ('front', (0, -5, 1.1)), ('side', (-5, 0, 1.1))]:
        render('idle-' + view, 'RELAXED IDLE / OWN TRIPO RIG', loc, (0, 0, .93), 2.12, 'relaxed-idle', 0)
    for view, loc in [('threequarter', (-3.6, -3.6, 1.1)), ('side', (-5, 0, 1.1))]:
        render('jump-' + view, 'RELAXED JUMP / APEX', loc, (0, 0, .93), 2.12, 'natural-jump', 14 / 30)
    pose('relaxed-idle', 0)
    center = rig.matrix_world @ ((rig.pose.bones['hand_l'].head + rig.pose.bones['middle_03_l'].tail) * .5)
    render('hand-left', 'LOOSE FINGERS / IDLE', center + Vector((1.4, -1.9, .35)), center, .4, 'relaxed-idle', 0)
else:
    # One complete4s idle loop, then one complete1.2s authored jump. No invented actor flight.
    for i in range(127):
        if i <= 96:
            clip, t, title = 'relaxed-idle', i / 24, 'RELAXED IDLE'
        else:
            clip, t, title = 'natural-jump', min((i - 97) / 24, 1.2), 'AUTHORED JUMP / ROOT IN PLACE'
        render(f'{i:03}', title, (-3.6, -3.6, 1.1), (0, 0, .93), 2.8, clip, t)
report = {'clips_sha256': {str(p): digest for p, digest in inputs.items()}, 'device': scene.cycles.device,
          'threads': scene.render.threads, 'gpu_denoising': False, 'samples': scene.cycles.samples,
          'dimensions': [scene.render.resolution_x, scene.render.resolution_y], 'scene_import_fps': 30,
          'preview_fps': 24 if args.motion else 30,
          'frames': readback, 'preview_only_height_and_original_GLB_material': True,
          'independent_verification_passed_at_render': verification['passed'],
          'corner_normals_unchanged_from_provider': True, 'native_or_final_art_acceptance': False,
          'no_prop_or_grip': True, 'no_actor_flight_or_native_blends': True}
assert inputs == {p: sha(p) for p in inputs}
assert max(abs(v) for row in root.matrix_world - base_world for v in row) < 1e-9
(V / 'Readback.json').write_text(json.dumps(report, indent=2) + '\n')
print('NATURAL_POSE_RENDER_COMPLETE', V, flush=True)
