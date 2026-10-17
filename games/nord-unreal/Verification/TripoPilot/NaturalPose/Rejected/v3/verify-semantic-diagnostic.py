"""Independent fresh-import CPU checks; Blender --background -t 4 --python this_file -- --output DIR."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import traceback

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--diagnostic', action='store_true', help='Collect every fixed-bound failure; never promotes a failed clip')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
output = args.output.resolve()
assert output.is_dir() and bpy.app.background
assert bpy.context.scene.render.threads == 4, 'Run with -t 4'
receipt = output / ('IndependentDiagnostic-semantic.json' if args.diagnostic else 'IndependentVerification-semantic.json')
assert not receipt.exists(), 'Preserve previous verification receipts'
source = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
provider = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/rig.fbx'
old_jump = provider.parent / 'derived/compact-jump.fbx'
clips = {name: output / (name + '.fbx') for name in ('relaxed-idle', 'natural-jump')}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
raw = sorted(p for p in source.rglob('*') if p.is_file())
assert len(raw) == 23 and all(not p.is_symlink() for p in raw)
before = {str(p): sha(p) for p in raw + [provider, old_jump] + list(clips.values())}
assert before[str(provider)] == 'baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2'
assert before[str(old_jump)] == '402d2c768e405badf5c1efab6a8841e5ff7523720e45d0e27babbc27cf6319b6'
assert before[str(source / 'body.fbx')] == 'b7e7ca0d9c486412108cba85e1cd4a5512fecd4ad36b8cfdb4677259ff6f9244'
assert before[str(source / 'body.glb')] == '25041be9666422c30ba39449cb283a83928bb3de596fe063389707c070335613'
fingers = {f'{digit}_{joint:02}_{side}' for digit in ('thumb', 'index', 'middle', 'ring', 'pinky')
           for joint in (1, 2, 3) for side in ('l', 'r')}
arms = {f'{bone}_{side}' for bone in ('clavicle', 'upperarm', 'lowerarm', 'hand') for side in ('l', 'r')}
report = {'passed': False, 'started_utc': datetime.now(timezone.utc).isoformat(),
          'verification_recipe_sha256': sha(Path(__file__)), 'diagnostic_collect_all': args.diagnostic,
          'scope': 'Independent actual FBX CPU sampling; no rendering, Unreal, native or art acceptance',
          'input_sha256': before, 'explicitly_allowed_finger_bones': sorted(fingers),
          'fixed_limits': {'reference_matrix_round_trip_precision': 2e-5,
                           'reference_head_translation_and_scale': 1e-5, 'reference_angle_rad': 1e-4,
                           'local_translation_and_scale': 1e-5, 'endpoint_rotation_rad': 1e-4,
                           'elbow_forward_delta_min_deg': -.5, 'knee_backward_delta_min_deg': -1.,
                           'idle_rotation_step_deg_per_30Hz_frame': 3., 'jump_rotation_step_deg_per_30Hz_frame': 20.},
          'clips': {}, 'errors': [], 'fixed_bound_violations': []}


def gate(condition, name, details):
    if not condition:
        report['fixed_bound_violations'].append({'check': name, 'details': details})
        assert args.diagnostic, (name, details)


def qerror(a, b):
    q = a.normalized().rotation_difference(b.normalized())
    return 2 * math.atan2(Vector((q.x, q.y, q.z)).length, abs(q.w))


def matrix_error(a, b):
    return max(abs(v) for row in a - b for v in row)


def load(path, animated):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=animated, automatic_bone_orientation=False,
                             use_image_search=False)
    rigs = [o for o in scene.objects if o.type == 'ARMATURE']
    assert len(rigs) == 1, 'Exactly one armature required'
    if animated:
        assert not any(o.type == 'MESH' for o in scene.objects), 'Clips must remain animation-only'
    return rigs[0]


def bend(rig, upper_name, lower_name, end_name, direction):
    upper = (rig.pose.bones[lower_name].head - rig.pose.bones[upper_name].head).normalized()
    lower = (rig.pose.bones[end_name].head - rig.pose.bones[lower_name].head).normalized()
    bind_lower = (bind[end_name].translation - bind[lower_name].translation).normalized()
    hinge = bind_lower.cross(direction).normalized()
    assert hinge.length > .99, 'Undefined anatomical hinge'
    transported = (rig.pose.bones[lower_name].matrix.to_quaternion() @
                   bind[lower_name].to_quaternion().inverted()) @ hinge
    return math.degrees(math.atan2(transported.dot(upper.cross(lower)), upper.dot(lower)))


try:
    rig = load(provider, False)
    hierarchy = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
    assert len(hierarchy) == 61 and fingers <= set(hierarchy)
    bind = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    local_bind = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy()
                  for b in rig.data.bones}
    unchanged_rotations = {'root'} | {n for n in hierarchy if '_twist_' in n}
    up = (bind['head'].translation - bind['pelvis'].translation).normalized()
    side = (bind['thigh_l'].translation - bind['thigh_r'].translation).normalized()
    forward = sum((bind[f'ball_{s}'].translation - bind[f'foot_{s}'].translation for s in ('l', 'r')), Vector())
    forward -= up * forward.dot(up)
    forward -= side * forward.dot(side)
    forward.normalize()
    assert abs(forward.dot(up)) < 1e-5 and forward.length > .99
    for b in rig.pose.bones:
        b.matrix_basis.identity()
    bpy.context.view_layer.update()
    neutral = {s: bend(rig, 'upperarm_' + s, 'lowerarm_' + s, 'hand_' + s, forward) for s in ('l', 'r')}
    neutral_knee = {s: bend(rig, 'thigh_' + s, 'calf_' + s, 'foot_' + s, -forward) for s in ('l', 'r')}
    # Independent sign sanity: the intended bend points a hanging lower limb toward its anatomical direction.
    down = -up
    hinge = down.cross(forward).normalized()
    from mathutils import Quaternion
    assert hinge.dot(down.cross(Quaternion(hinge, .2) @ down)) > 0
    assert hinge.dot(down.cross(Quaternion(hinge, -.2) @ down)) < 0
    assert qerror(Quaternion(), -Quaternion()) < 1e-10
    lower_body = {'pelvis'} | {n for n in hierarchy if n.startswith(('thigh_', 'calf_', 'foot_', 'ball_'))}
    authored = set(hierarchy) - lower_body - unchanged_rotations
    previous_jump = load(old_jump, True)
    old_first, old_last = previous_jump.animation_data.action.frame_range
    assert abs(old_last - old_first - 36) < 1e-5
    old_leg_samples = []
    old_previous = None
    old_step_maxima = {'whole_body': 0., 'authored_upper_body': 0., 'inherited_lower_body': 0.}
    old_step_details = {}
    for index in range(73):
        frame = old_first + index / 2
        bpy.context.scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
        bpy.context.view_layer.update()
        old_leg_samples.append({n: previous_jump.pose.bones[n].matrix.copy() for n in lower_body})
        current = {}
        for b in previous_jump.pose.bones:
            local = b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix
            current[b.name] = (local.to_quaternion(), b.matrix.to_quaternion())
            if old_previous:
                for space, q, old_q in zip(('local', 'component'), current[b.name], old_previous[b.name]):
                    step = math.degrees(qerror(q, old_q)) * 2
                    for group in ('whole_body', 'authored_upper_body' if b.name in authored else 'inherited_lower_body'):
                        if step > old_step_maxima[group]:
                            old_step_maxima[group] = step
                            old_step_details[group] = {'bone': b.name, 'space': space, 'frame': frame}
        old_previous = current
    report['previous_compact_jump_step_deg_per_30Hz_frame'] = old_step_maxima
    report['previous_compact_jump_step_details'] = old_step_details
    starts = {}
    for label, path in clips.items():
        rig = load(path, True)
        assert hierarchy == {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
        bind_error = max(matrix_error(b.matrix_local, bind[b.name]) for b in rig.data.bones)
        reference_angular = max(qerror(b.matrix_local.to_quaternion(), bind[b.name].to_quaternion()) for b in rig.data.bones)
        reference_head = max((b.matrix_local.translation - bind[b.name].translation).length for b in rig.data.bones)
        reference_scale = max(max(abs(a - c) for a, c in zip(b.matrix_local.to_scale(), bind[b.name].to_scale())) for b in rig.data.bones)
        # Raw float32 FBX 3x3 matrices carry tiny scale/shear drift; preserve angle, heads and scale separately.
        gate(bind_error < 2e-5 and reference_angular < 1e-4 and reference_head < 1e-5 and reference_scale < 1e-5,
             label + ': semantic reference preservation', {'matrix': bind_error, 'angle_rad': reference_angular,
                                                           'head_target_units': reference_head, 'scale': reference_scale})
        assert rig.animation_data and rig.animation_data.action
        action = rig.animation_data.action
        first, last = action.frame_range
        expected_frames = 120 if label == 'relaxed-idle' else 36
        assert abs(last - first - expected_frames) < 1e-5, (label, action.frame_range)
        assert abs(first - round(first)) < 1e-5
        samples = []
        first_pose = None
        first_local = None
        previous = None
        max_rotation_step = max_translation = max_scale = max_root = max_object = max_unmapped = 0.
        max_arm_step = 0.
        max_authored_step = 0.
        authored_step_details = {}
        step_details = {}
        temporal = {n: 0. for n in arms | fingers}
        max_pelvis_vertical = 0.
        max_inherited_leg_error = 0.
        max_raw_quat_norm = max_key_quat_norm = max_component_quat_norm = 0.
        min_elbow = min_knee = float('inf')
        for index in range(expected_frames * 2 + 1):
            frame = first + index / 2
            bpy.context.scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
            bpy.context.view_layer.update()
            poses = {b.name: b.matrix.copy() for b in rig.pose.bones}
            if label == 'natural-jump':
                max_inherited_leg_error = max(max_inherited_leg_error,
                    max(matrix_error(poses[n], old_leg_samples[index][n]) for n in lower_body))
            locals_now = {b.name: b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix.copy()
                          for b in rig.pose.bones}
            if first_pose is None:
                first_pose = {n: m.copy() for n, m in poses.items()}
                first_local = {n: m.copy() for n, m in locals_now.items()}
                object0 = rig.matrix_world.copy()
            for b in rig.pose.bones:
                assert all(math.isfinite(v) for row in b.matrix for v in row), (label, frame, b.name)
                assert all(math.isfinite(v) for v in b.rotation_quaternion)
                assert b.rotation_quaternion.magnitude > 1e-8, (label, frame, b.name, 'Degenerate quaternion')
                norm_error = abs(b.rotation_quaternion.magnitude - 1)
                max_raw_quat_norm = max(max_raw_quat_norm, norm_error)
                if index % 2 == 0:
                    max_key_quat_norm = max(max_key_quat_norm, norm_error)
                max_component_quat_norm = max(max_component_quat_norm, abs(b.matrix.to_quaternion().magnitude - 1))
                loc, rot, scale = locals_now[b.name].decompose()
                bind_loc, bind_rot, bind_scale = local_bind[b.name].decompose()
                if b.name != 'pelvis':
                    max_translation = max(max_translation, (loc - bind_loc).length)
                max_scale = max(max_scale, max(abs(a - c) for a, c in zip(scale, bind_scale)))
                if b.name in unchanged_rotations:
                    max_unmapped = max(max_unmapped, qerror(rot, bind_rot))
                if b.name in temporal:
                    temporal[b.name] = max(temporal[b.name], math.degrees(qerror(rot, first_local[b.name].to_quaternion())))
                if previous:
                    # Half-frame measurements are converted to equivalent one-frame steps.
                    for space, q, old_q in (('local', rot, previous[b.name][0]),
                                             ('component', b.matrix.to_quaternion(), previous[b.name][1])):
                        step = math.degrees(qerror(q, old_q)) * 2
                        if step > max_rotation_step:
                            max_rotation_step = step
                            step_details = {'bone': b.name, 'space': space, 'frame': frame}
                        if b.name in arms | fingers:
                            max_arm_step = max(max_arm_step, step)
                        if b.name in authored and step > max_authored_step:
                            max_authored_step = step
                            authored_step_details = {'bone': b.name, 'space': space, 'frame': frame}
            previous = {n: (m.to_quaternion(), poses[n].to_quaternion()) for n, m in locals_now.items()}
            pelvis_delta = poses['pelvis'].translation - bind['pelvis'].translation
            vertical = pelvis_delta.z
            gate(math.hypot(pelvis_delta.x, pelvis_delta.y) < 1e-5, label + ': horizontal pelvis', {'frame': frame, 'delta': list(pelvis_delta)})
            max_pelvis_vertical = max(max_pelvis_vertical, abs(vertical))
            max_root = max(max_root, matrix_error(poses['root'], bind['root']))
            max_object = max(max_object, matrix_error(rig.matrix_world, object0))
            elbows = {s: bend(rig, 'upperarm_' + s, 'lowerarm_' + s, 'hand_' + s, forward) - neutral[s] for s in ('l', 'r')}
            knees = {s: bend(rig, 'thigh_' + s, 'calf_' + s, 'foot_' + s, -forward) - neutral_knee[s] for s in ('l', 'r')}
            min_elbow = min(min_elbow, *elbows.values())
            min_knee = min(min_knee, *knees.values())
            samples.append({'time_s': index / 60, 'elbow_forward_delta_deg': elbows,
                            'knee_backward_delta_deg': knees, 'pelvis_vertical_target_units': vertical})
        step_limit = 3 if label == 'relaxed-idle' else 20
        seam_rotation = max(qerror(poses[n].to_quaternion(), first_pose[n].to_quaternion()) for n in hierarchy)
        seam_matrix = max(matrix_error(poses[n], first_pose[n]) for n in hierarchy)
        starts[label] = first_pose
        metrics = {'reference_matrix_error': bind_error, 'reference_angular_error_rad': reference_angular,
                   'reference_head_translation_target_units': reference_head, 'reference_scale_error': reference_scale,
                   'raw_quaternion_channel_norm_error_half_frames': max_raw_quat_norm,
                   'raw_quaternion_channel_norm_error_integer_keyframes': max_key_quat_norm,
                   'evaluated_component_quaternion_norm_error': max_component_quat_norm,
                   'local_translation_error': max_translation,
                   'local_scale_error': max_scale, 'unchanged_root_and_twist_rotation_error_rad': max_unmapped,
                   'root_matrix_error': max_root, 'object_matrix_error': max_object,
                   'maximum_rotation_step_deg_per_30Hz_frame': max_rotation_step,
                   'maximum_rotation_step_details': step_details,
                   'maximum_arm_and_finger_rotation_step_deg_per_30Hz_frame': max_arm_step,
                   'maximum_authored_rotation_step_deg_per_30Hz_frame': max_authored_step,
                   'maximum_authored_rotation_step_details': authored_step_details,
                   'seam_rotation_error_rad': seam_rotation, 'seam_matrix_error': seam_matrix,
                   'minimum_elbow_forward_delta_deg': min_elbow, 'minimum_knee_backward_delta_deg': min_knee,
                   'maximum_pelvis_vertical_target_units': max_pelvis_vertical}
        if label == 'natural-jump':
            metrics['inherited_compact_jump_pelvis_and_leg_matrix_error'] = max_inherited_leg_error
        report['clips'][label] = {'sha256': sha(path), 'bones': 61, 'frame_range': [first, last],
                                 'fps': 30, 'half_frame_samples': len(samples), 'metrics': metrics,
                                 'local_motion_from_first_pose_deg': temporal, 'samples': samples}
        # Linear quaternion channels need normalization between keys; Blender evaluates that rotation.
        gate(max_key_quat_norm < 1e-4 and max_component_quat_norm < 1e-4, label + ': key/evaluated quaternion norm', metrics)
        gate(max_translation < 1e-5 and max_scale < 1e-5 and max_unmapped < 1e-4, label + ': local transforms', metrics)
        gate(max_root < 1e-5 and max_object < 1e-7, label + ': static root/object', metrics)
        gate(max_authored_step < step_limit and seam_rotation < 1e-4 and seam_matrix < 1e-5, label + ': authored step and seam', metrics)
        gate(min_elbow >= -.5 and min_knee >= -1., label + ': anatomical bend', metrics)
        if label == 'relaxed-idle':
            gate(max_pelvis_vertical < 1e-5, label + ': pelvis at bind', metrics)
            gate(all(temporal[f'upperarm_{s}'] > .25 for s in ('l', 'r')), label + ': actual arm motion', temporal)
            gate(sum(temporal[n] > .1 for n in fingers) >= 10, label + ': actual finger motion', temporal)
            finger_relax = {n: math.degrees(qerror(first_local[n].to_quaternion(), local_bind[n].to_quaternion())) for n in fingers}
            report['idle_finger_local_deviation_from_bind_deg'] = finger_relax
            gate(all(sum(finger_relax[n] > 1 for n in fingers if n.endswith('_' + s)) >= 10 for s in ('l', 'r')), label + ': relaxed fingers', finger_relax)
            gate(all(samples[0]['elbow_forward_delta_deg'][s] > 2 for s in ('l', 'r')), label + ': relaxed elbows', samples[0])
        else:
            gate(max_pelvis_vertical < .15 and max(max(x['knee_backward_delta_deg'].values()) for x in samples) > 20, label + ': retained jump flex', metrics)
            gate(max_inherited_leg_error < 1e-5, label + ': inherited jump legs', metrics)
    endpoint_match = max(matrix_error(starts['relaxed-idle'][n], starts['natural-jump'][n]) for n in hierarchy)
    report['idle_jump_relaxed_endpoint_matrix_error'] = endpoint_match
    gate(endpoint_match < 1e-5, 'idle/jump endpoint', endpoint_match)
    report['passed'] = not report['fixed_bound_violations']
except Exception:
    report['errors'].append(traceback.format_exc())
    raise
finally:
    report['all_retained_inputs_unchanged'] = before == {p: sha(Path(p)) for p in before}
    report['finished_utc'] = datetime.now(timezone.utc).isoformat()
    receipt.write_text(json.dumps(report, indent=2) + '\n')
    assert report['all_retained_inputs_unchanged'], 'An input changed during read-only verification'
assert report['passed'], 'Fixed-bound failures retained in ' + str(receipt)
print('NORD_NATURAL_POSE_INDEPENDENT_OK', str(receipt))
