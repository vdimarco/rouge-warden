"""Retarget the two retained gait loops; Blender -b -t 4 --python this_file -- --output NEW_DIR."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import traceback

import bpy
from mathutils import Quaternion, Vector

R = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
O = args.output.resolve()
O.mkdir(parents=True, exist_ok=True)
assert not any(O.iterdir()), 'Use a fresh output directory'
assert bpy.app.background and bpy.context.scene.render.threads == 4, 'Run background with -t 4'
base = R / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
provider = base / 'tripo-v3-rig-20261017/rig.fbx'
idle = provider.parent / 'derived/natural-pose-20261017/relaxed-idle.fbx'
inputs = {'provider': provider, 'idle': idle, **{k: base / 'generated-v2-high-detail' / (k + '.fbx') for k in ('walk', 'run')}}
pins = {'provider': 'baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2',
        'idle': 'f5cf127b897cd54b52676932ff89461033becf1a19e8cf109a33d30c8958dfbc',
        'walk': '0fe2b4d83846f826e3d448c870fcb77816c25fe6d106c873d755cd7a3d871d9e',
        'run': 'b0f8e4c359d21ca3a51dde5c94b45b4d9f4a3d27dedb2d44f671b69e41f6e8ae'}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
raw = sorted(p for p in (base / 'generated-v2-high-detail').rglob('*') if p.is_file())
assert len(raw) == 23 and not any(p.is_symlink() for p in raw)
before = {str(p): sha(p) for p in raw + [provider, idle]}
assert all(sha(p) == pins[k] for k, p in inputs.items())
mapping = {'Hips': 'pelvis', 'Spine02': 'spine_01', 'Spine01': 'spine_02', 'Spine': 'spine_03', 'neck': 'neck_01', 'Head': 'head'}
for prefix, side in (('Left', 'l'), ('Right', 'r')):
    for source, target in (('Shoulder', 'clavicle'), ('Arm', 'upperarm'), ('ForeArm', 'lowerarm'), ('Hand', 'hand'),
                           ('UpLeg', 'thigh'), ('Leg', 'calf'), ('Foot', 'foot'), ('ToeBase', 'ball')):
        mapping[prefix + source] = target + '_' + side
inverse = {target: source for source, target in mapping.items()}
fingers = {f'{digit}_{joint:02}_{side}' for digit in ('thumb', 'index', 'middle', 'ring', 'pinky')
           for joint in (1, 2, 3) for side in ('l', 'r')}
report = {'passed': False, 'started_utc': datetime.now(timezone.utc).isoformat(), 'recipe_sha256': sha(Path(__file__)),
          'scope': 'CPU animation-only 61-bone gait derivatives; no mesh, rendering, Unreal, provider or service writes',
          'input_sha256': before, 'source_to_target': mapping,
          'policy': 'Preserve mapped component rotation deltas, all source hip XYZ bob/sway and source gait timing; '
                    'static actor/root; all 30 finger locals from relaxed idle entry; remaining locals at bind. '
                    'No new arm acting is added to the source gait.',
          'limits': {'reference_matrix': 2e-5, 'reference_head_and_scale': 1e-5, 'angle_rad': 1e-4,
                     'translation_and_scale': 1e-5, 'static_object': 1e-7}, 'clips': {}, 'errors': []}


def qerror(a, b):
    d = a.normalized().rotation_difference(b.normalized())
    return 2 * math.atan2(Vector((d.x, d.y, d.z)).length, abs(d.w))


def merror(a, b):
    return max(abs(v) for row in a - b for v in row)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    return scene


def load(path, animated):
    old = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=animated, automatic_bone_orientation=False, use_image_search=False)
    return next(o for o in bpy.data.objects if o not in old and o.type == 'ARMATURE')


def frame(scene, value):
    scene.frame_set(math.floor(value), subframe=value - math.floor(value))
    bpy.context.view_layer.update()


def elbow(rig, side, bind, forward):
    u, l, h = (rig.pose.bones[n + '_' + side] for n in ('upperarm', 'lowerarm', 'hand'))
    upper, lower = (l.head - u.head).normalized(), (h.head - l.head).normalized()
    hinge = (bind[h.name].translation - bind[l.name].translation).normalized().cross(forward).normalized()
    axis = (l.matrix.to_quaternion() @ bind[l.name].to_quaternion().inverted()) @ hinge
    return math.degrees(math.atan2(axis.dot(upper.cross(lower)), upper.dot(lower)))


try:
    scene = reset()
    relaxed = load(idle, True)
    frame(scene, relaxed.animation_data.action.frame_range[0])
    finger_q = {n: relaxed.pose.bones[n].matrix_basis.to_quaternion().normalized() for n in fingers}
    assert all(math.degrees(qerror(q, Quaternion())) > 1 for q in finger_q.values()), 'Relaxed finger baseline required'
    # Independent anatomical sign control; opposite rotation must point a hanging forearm backward.
    down, forward_test = Vector((0, 0, -1)), Vector((0, 1, 0))
    axis = down.cross(forward_test).normalized()
    assert axis.dot(down.cross(Quaternion(axis, .2) @ down)) > 0
    assert axis.dot(down.cross(Quaternion(axis, -.2) @ down)) < 0
    for kind, count in (('walk', 32), ('run', 20)):
        scene = reset()
        source = load(inputs[kind], True)
        # UE otherwise sees Blender's collision-suffixed object as a different skeleton root.
        source.name = 'OriginalSourceGait'
        target = load(provider, False)
        target.name = 'Armature'
        assert target.name == 'Armature'
        # FBX import applies the provider's 24Hz GlobalSettings to the scene.
        scene.render.fps, scene.render.fps_base = 30, 1.0
        assert len(source.data.bones) == 24 and len(target.data.bones) == 61
        assert set(mapping) <= set(source.data.bones.keys()) and set(inverse) | fingers <= set(target.data.bones.keys())
        first, last = source.animation_data.action.frame_range
        assert abs(last - first - (count - 1)) < 1e-5
        sb = {b.name: b.matrix_local.copy() for b in source.data.bones}
        tb = {b.name: b.matrix_local.copy() for b in target.data.bones}
        local_bind = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy()
                      for b in target.data.bones}
        hierarchy = {b.name: b.parent.name if b.parent else None for b in target.data.bones}
        source_object = source.matrix_world.copy()
        assert qerror(source_object.to_quaternion(), target.matrix_world.to_quaternion()) < 1e-5
        ss, ts = source_object.to_scale(), target.matrix_world.to_scale()
        assert max(ss) - min(ss) < 1e-6 and max(ts) - min(ts) < 1e-6
        factor = ss.z / (1.82000084619 * ts.z)
        source_samples = []
        for i in range(count):
            frame(scene, first + i)
            source_samples.append({'delta': {t: (source.pose.bones[s].matrix.to_quaternion().normalized() @
                                                       sb[s].to_quaternion().normalized().inverted()).normalized()
                                              for s, t in mapping.items()},
                                   'hip': (source.pose.bones['Hips'].matrix.translation - sb['Hips'].translation) * factor})
            assert merror(source.matrix_world, source_object) < 1e-7
        target.animation_data_clear()
        scene.frame_start, scene.frame_end = 1, count
        expected, previous = [], {}
        for i, row in enumerate(source_samples):
            frame(scene, i + 1)
            desired = {}
            for b in target.data.bones:
                parent = hierarchy[b.name]
                local = local_bind[b.name].to_quaternion()
                if b.name in fingers:
                    local = local @ finger_q[b.name]
                desired[b.name] = ((row['delta'][b.name] @ tb[b.name].to_quaternion()).normalized() if b.name in inverse
                                  else (desired[parent] @ local).normalized() if parent else local.normalized())
            for b in target.pose.bones:
                local = desired[b.parent.name].inverted() @ desired[b.name] if b.parent else desired[b.name]
                q = (local_bind[b.name].to_quaternion().inverted() @ local).normalized()
                if b.name in previous and q.dot(previous[b.name]) < 0:
                    q.negate()
                previous[b.name] = q.copy()
                b.rotation_mode, b.rotation_quaternion, b.location, b.scale = 'QUATERNION', q, (0, 0, 0), (1, 1, 1)
                if b.name == 'pelvis':
                    b.location = tb['pelvis'].to_3x3().inverted() @ row['hip']
                for channel in ('rotation_quaternion', 'location', 'scale'):
                    b.keyframe_insert(channel, frame=i + 1)
            bpy.context.view_layer.update()
            assert max(qerror(b.matrix.to_quaternion(), desired[b.name]) for b in target.pose.bones) < 1e-4
            expected.append({b.name: b.matrix.copy() for b in target.pose.bones})
        action = target.animation_data.action
        action.name = 'tripo-' + kind
        # Frame 0 keeps animation-only FBX Model defaults in the unchanged bind pose.
        for b in target.pose.bones:
            b.location, b.rotation_quaternion, b.scale = (0, 0, 0), Quaternion(), (1, 1, 1)
            for channel in ('rotation_quaternion', 'location', 'scale'):
                b.keyframe_insert(channel, frame=0)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = 'LINEAR'
        frame(scene, 0)
        assert max(merror(b.matrix, tb[b.name]) for b in target.pose.bones) < 1e-5
        bpy.ops.object.select_all(action='DESELECT')
        target.select_set(True)
        bpy.context.view_layer.objects.active = target
        output = O / (kind + '.fbx')
        assert scene.render.fps == 30 and scene.render.fps_base == 1.0
        bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                                 bake_anim=True, bake_anim_use_all_bones=True, bake_anim_use_nla_strips=False,
                                 bake_anim_use_all_actions=False, bake_anim_simplify_factor=0, axis_forward='-Z', axis_up='Y')
        scene = reset()
        rig = load(output, True)
        assert rig.name == 'Armature', 'Match the own body/idle/jump FBX object root'
        assert not any(o.type == 'MESH' for o in scene.objects)
        assert hierarchy == {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
        reference = {'matrix': max(merror(b.matrix_local, tb[b.name]) for b in rig.data.bones),
                     'angle_rad': max(qerror(b.matrix_local.to_quaternion(), tb[b.name].to_quaternion()) for b in rig.data.bones),
                     'head': max((b.matrix_local.translation - tb[b.name].translation).length for b in rig.data.bones),
                     'scale': max(max(abs(x - y) for x, y in zip(b.matrix_local.to_scale(), tb[b.name].to_scale())) for b in rig.data.bones)}
        assert reference['matrix'] < 2e-5 and reference['angle_rad'] < 1e-4 and reference['head'] < 1e-5 and reference['scale'] < 1e-5, reference
        cf, cl = rig.animation_data.action.frame_range
        assert abs(cl - cf - count + 1) < 1e-5
        up = (tb['head'].translation - tb['pelvis'].translation).normalized()
        side_axis = (tb['thigh_l'].translation - tb['thigh_r'].translation).normalized()
        forward = sum((tb['ball_' + s].translation - tb['foot_' + s].translation for s in ('l', 'r')), Vector())
        forward -= up * forward.dot(up) + side_axis * forward.dot(side_axis)
        forward.normalize()
        max_pose = max_angle = max_hip = max_scale = max_translation = max_finger = max_root = max_object = max_norm = 0.
        samples = []
        for index in range((count - 1) * 2 + 1):
            frame(scene, cf + index / 2)
            matrices = {b.name: b.matrix.copy() for b in rig.pose.bones}
            if index == 0:
                pose0, object0 = matrices, rig.matrix_world.copy()
            for b in rig.pose.bones:
                assert all(math.isfinite(v) for row in b.matrix for v in row)
                assert all(math.isfinite(v) for v in b.rotation_quaternion) and b.rotation_quaternion.magnitude > 1e-8
                local = b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix
                loc, rot, scale = local.decompose()
                rloc, rrot, rscale = local_bind[b.name].decompose()
                if b.name != 'pelvis':
                    max_translation = max(max_translation, (loc - rloc).length)
                max_scale = max(max_scale, max(abs(x - y) for x, y in zip(scale, rscale)))
                if b.name in fingers:
                    max_finger = max(max_finger, qerror(rot, rrot @ finger_q[b.name]))
                if index % 2 == 0:
                    max_norm = max(max_norm, abs(b.rotation_quaternion.magnitude - 1))
                    max_pose = max(max_pose, merror(b.matrix, expected[index // 2][b.name]))
                    max_angle = max(max_angle, qerror(b.matrix.to_quaternion(), expected[index // 2][b.name].to_quaternion()))
            if index % 2 == 0:
                max_hip = max(max_hip, (matrices['pelvis'].translation - tb['pelvis'].translation - source_samples[index // 2]['hip']).length)
            max_root = max(max_root, merror(matrices['root'], tb['root']))
            max_object = max(max_object, merror(rig.matrix_world, object0))
            samples.append({'time_s': index / 60, 'elbow_signed_deg': {s: elbow(rig, s, tb, forward) for s in ('l', 'r')},
                            'hip_delta_target_units': list(matrices['pelvis'].translation - tb['pelvis'].translation)})
        seam_matrix = max(merror(matrices[n], pose0[n]) for n in hierarchy)
        seam_angle = max(qerror(matrices[n].to_quaternion(), pose0[n].to_quaternion()) for n in hierarchy)
        metrics = {'reference': reference, 'component_matrix_error': max_pose, 'component_angle_error_rad': max_angle,
                   'hip_xyz_error_target_units': max_hip, 'local_translation_error': max_translation, 'local_scale_error': max_scale,
                   'finger_baseline_rotation_error_rad': max_finger, 'root_matrix_error': max_root,
                   'object_matrix_error': max_object, 'key_quaternion_norm_error': max_norm,
                   'loop_matrix_error': seam_matrix, 'loop_angle_error_rad': seam_angle,
                   'minimum_elbow_signed_deg': min(v for row in samples for v in row['elbow_signed_deg'].values())}
        report['clips'][kind] = {'output': {'file': str(output), 'sha256': sha(output), 'bytes': output.stat().st_size},
                                 'fresh_armature_object': rig.name,
                                 'bones': 61, 'samples': count, 'half_frame_samples': len(samples), 'fps': 30,
                                 'seconds': (count - 1) / 30, 'source_range': [first, last], 'fresh_range': [cf, cl],
                                 'source_xyz_to_target_factor': factor, 'metrics': metrics, 'samples_readback': samples}
        assert max_pose < 2e-5 and max_angle < 1e-4 and max_hip < 1e-5, metrics
        assert max_translation < 1e-5 and max_scale < 1e-5 and max_finger < 1e-4, metrics
        assert max_root < 1e-5 and max_object < 1e-7 and max_norm < 1e-4, metrics
        assert seam_matrix < 1e-5 and seam_angle < 1e-4, metrics
        assert metrics['minimum_elbow_signed_deg'] > -.5, metrics
    report['passed'] = True
except Exception:
    report['errors'].append(traceback.format_exc())
    raise
finally:
    report['retained_inputs_unchanged'] = before == {p: sha(Path(p)) for p in before}
    report['finished_utc'] = datetime.now(timezone.utc).isoformat()
    (O / 'Locomotion.json').write_text(json.dumps(report, indent=2) + '\n')
    assert report['retained_inputs_unchanged'], 'Retained source changed'
print('NORD_TRIPO_LOCOMOTION_OK', str(O), flush=True)
