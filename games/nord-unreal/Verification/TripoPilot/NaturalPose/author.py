"""Bounded own-rig pose correction. Blender CPU only; -- --output NEW_DIRECTORY."""
import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

P = Path(__file__).resolve().parent
R = P.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
O = args.output.resolve()
O.mkdir(parents=True, exist_ok=True)
assert not any(O.iterdir()), 'Use a fresh output directory'
provider = R / 'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/rig.fbx'
previous = provider.parent / 'derived/compact-jump.fbx'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
pins = json.loads((P.parent / 'CPU/inputs.json').read_text())
pins[str(provider)] = {'sha256': 'baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2'}
pins[str(previous)] = {'sha256': '402d2c768e405badf5c1efab6a8841e5ff7523720e45d0e27babbc27cf6319b6'}
assert all(sha(Path(p)) == v['sha256'] for p, v in pins.items())
assert bpy.app.background
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4

def imported(path, animated):
    old = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=animated, automatic_bone_orientation=False, use_image_search=False)
    return next(o for o in bpy.data.objects if o not in old and o.type == 'ARMATURE')

source = imported(previous, True)
first, last = source.animation_data.action.frame_range
assert last - first == 36
base = []
for i in range(37):
    scene.frame_set(int(first + i))
    bpy.context.view_layer.update()
    base.append({b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in source.pose.bones})
target = imported(provider, False)
assert set(target.data.bones.keys()) == set(source.data.bones.keys()) and len(target.data.bones) == 61
target.animation_data_clear()
rest = {b.name: b.matrix_local.copy() for b in target.data.bones}
local_rest = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy() for b in target.data.bones}
up = (rest['head'].translation - rest['pelvis'].translation).normalized()
side = (rest['thigh_l'].translation - rest['thigh_r'].translation).normalized()
forward = sum((rest['ball_' + s].translation - rest['foot_' + s].translation for s in ('l', 'r')), Vector())
forward -= up * forward.dot(up) + side * forward.dot(side)
forward.normalize()

def about(name, axis, degrees):
    local = (rest[name].to_3x3().inverted() @ axis).normalized()
    return Quaternion(local, math.radians(degrees))

def add(name, axis, degrees):
    b = target.pose.bones[name]
    b.rotation_quaternion = b.rotation_quaternion @ about(name, axis, degrees)

times = (0, .10, .23, .47, .73, .93, 1.20)
keys = {
    'swing_l': (0, -6, 8, 12, 4, -4, 0), 'swing_r': (0, -3, 0, -12, -8, -2, 0),
    'elbow_l': (14, 22, 34, 50, 36, 23, 14), 'elbow_r': (18, 22, 30, 35, 30, 24, 18),
    'out_l': (8, 10, 12, 10, 8, 9, 8), 'out_r': (6, 8, 10, 8, 7, 8, 6),
}

def at(values, t):
    i = next(i for i in range(len(times) - 1) if times[i] <= t <= times[i + 1])
    f = (t - times[i]) / (times[i + 1] - times[i])
    f = f * f * (3 - 2 * f)
    return values[i] * (1 - f) + values[i + 1] * f

finger_axes = {}
thumb_adduction = {}
hinges = {}
palms = {}
for suffix, sign in (('l', 1), ('r', -1)):
    along = rest['middle_01_' + suffix].translation - rest['hand_' + suffix].translation
    across = rest['pinky_01_' + suffix].translation - rest['index_01_' + suffix].translation
    palm = across.cross(along).normalized()
    if palm.dot(-sign * side) < 0:
        palm.negate()
    palms[suffix] = palm
    thumb_direction = rest['thumb_02_' + suffix].translation - rest['thumb_01_' + suffix].translation
    thumb_adduction[suffix] = thumb_direction.normalized().cross(along.normalized()).normalized()
    lower = rest['hand_' + suffix].translation - rest['lowerarm_' + suffix].translation
    hinges[suffix] = lower.normalized().cross(forward).normalized()
    for digit in ('thumb', 'index', 'middle', 'ring', 'pinky'):
        for joint in range(1, 4):
            name = f'{digit}_{joint:02}_{suffix}'
            b = target.data.bones[name]
            finger_axes[name] = (b.tail_local - b.head_local).normalized().cross(palm).normalized()

report = {'started_utc': datetime.now(timezone.utc).isoformat(), 'provider_unchanged': True,
          'author_sha256': sha(Path(__file__)), 'joint_key_degrees': keys, 'joint_key_seconds': times,
          'scope': 'Animation-only relaxed idle and jump acting; no mesh/material/native/provider operations', 'clips': {}}
for kind, count in (('relaxed-idle', 121), ('natural-jump', 37)):
    target.animation_data_clear()
    scene.frame_start = 1
    scene.frame_end = count
    snapshots = []
    for i in range(count):
        t = i / 30
        scene.frame_set(i + 1)
        for b in target.pose.bones:
            b.rotation_mode = 'QUATERNION'
            b.location, b.rotation_quaternion, b.scale = base[i][b.name] if kind == 'natural-jump' else ((0, 0, 0), Quaternion(), (1, 1, 1))
        breath = (1 - math.cos(2 * math.pi * t / 4)) / 2 if kind == 'relaxed-idle' else 0
        sway = math.sin(2 * math.pi * t / 4) if kind == 'relaxed-idle' else 0
        add('spine_01', side, 1 + .4 * breath)
        add('spine_02', forward, -1.2 + .3 * sway)
        add('spine_03', up, 2 + .3 * sway)
        add('neck_01', up, -1.5 - .2 * sway)
        add('neck_01', forward, .7)
        for suffix, sign in (('l', 1), ('r', -1)):
            upper, lower, hand, clavicle = (n + '_' + suffix for n in ('upperarm', 'lowerarm', 'hand', 'clavicle'))
            # Arm motion starts from the own bind, not the old retarget's offered-palm orientation.
            for name in (clavicle, upper, lower, hand):
                target.pose.bones[name].rotation_quaternion = Quaternion()
            clavicle_dir = rest[upper].translation - rest[clavicle].translation
            add(clavicle, clavicle_dir.cross(-up).normalized(), 1.5 + (.4 * breath if sign == 1 else -.2 * breath))
            bpy.context.view_layer.update()
            swing = at(keys['swing_' + suffix], t) if kind == 'natural-jump' else sign * .4 * sway
            spread = at(keys['out_' + suffix], t) if kind == 'natural-jump' else (8 if sign == 1 else 6) + .25 * breath
            a, f = math.radians(spread), math.radians(swing)
            desired_dir = -up * (math.cos(a) * math.cos(f)) + sign * side * math.sin(a) + forward * (math.cos(a) * math.sin(f))
            u = (rest[lower].translation - rest[upper].translation).normalized()
            swing_q = u.rotation_difference(desired_dir.normalized())
            b = target.pose.bones[upper]
            parent_delta = b.parent.matrix.to_quaternion() @ rest[b.parent.name].to_quaternion().inverted()
            component = parent_delta @ swing_q @ rest[upper].to_quaternion()
            b.rotation_quaternion = local_rest[upper].to_quaternion().inverted() @ b.parent.matrix.to_quaternion().inverted() @ component
            flex = at(keys['elbow_' + suffix], t) if kind == 'natural-jump' else (14 if sign == 1 else 18) + 1.2 * breath
            add(lower, hinges[suffix], flex)
            hand_along = (rest['middle_01_' + suffix].translation - rest[hand].translation).normalized()
            add(hand, hand_along.cross(palms[suffix]).normalized(), 3 + .4 * breath)
            for d, digit in enumerate(('index', 'middle', 'ring', 'pinky', 'thumb')):
                values = ((12 + 4 * d, 18 + 5 * d, 4 + d) if digit != 'thumb' else (8, 10, 3))
                for joint, angle in enumerate(values, 1):
                    name = f'{digit}_{joint:02}_{suffix}'
                    target.pose.bones[name].rotation_quaternion = about(name, finger_axes[name], angle + (.8 if sign == -1 else 0) + breath * .8)
            thumb = 'thumb_01_' + suffix
            target.pose.bones[thumb].rotation_quaternion = about(thumb, thumb_adduction[suffix], 14) @ target.pose.bones[thumb].rotation_quaternion
        bpy.context.view_layer.update()
        for b in target.pose.bones:
            assert all(math.isfinite(v) for row in b.matrix for v in row)
            if snapshots and b.rotation_quaternion.dot(Quaternion(snapshots[-1][b.name]['q'])) < 0:
                b.rotation_quaternion.negate()
            for channel in ('rotation_quaternion', 'location', 'scale'):
                b.keyframe_insert(channel, frame=i + 1)
        snapshots.append({b.name: {'q': list(b.rotation_quaternion), 'location': list(b.location), 'scale': list(b.scale)} for b in target.pose.bones})
    action = target.animation_data.action
    action.name = kind
    # FBX animation-only Model defaults use the current pose. Frame0 supplies the unchanged bind;
    # the explicitly exported scene range starts at1, so the relaxed entry remains the first sample.
    for b in target.pose.bones:
        b.location, b.rotation_quaternion, b.scale = (0, 0, 0), Quaternion(), (1, 1, 1)
        for channel in ('rotation_quaternion', 'location', 'scale'):
            b.keyframe_insert(channel, frame=0)
    # Dense samples use linear quaternion channels, avoiding Bezier overshoot between frames.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    scene.frame_set(0)
    bpy.context.view_layer.update()
    assert max(abs(v) for b in target.pose.bones for row in b.matrix - rest[b.name] for v in row) < 1e-5
    output = O / (kind + '.fbx')
    bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                             bake_anim=True, bake_anim_use_all_bones=True, bake_anim_use_nla_strips=False,
                             bake_anim_use_all_actions=False, bake_anim_simplify_factor=0, axis_forward='-Z', axis_up='Y')
    assert output.stat().st_size > 10000
    report['clips'][kind] = {'sha256': sha(output), 'bytes': output.stat().st_size, 'samples': count, 'fps': 30,
                             'seconds': (count - 1) / 30, 'bind_reference_frame_not_exported': 0,
                             'exported_scene_frame_range': [1, count], 'authored_local_samples': snapshots}
assert all(sha(Path(p)) == v['sha256'] for p, v in pins.items())
report['finished_utc'] = datetime.now(timezone.utc).isoformat()
(O / 'Authoring.json').write_text(json.dumps(report, indent=2) + '\n')
print('RELAXED_POSE_AUTHOR_COMPLETE', O, flush=True)
