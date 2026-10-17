"""Independent actual source-to-FBX checks; Blender -b -t 4 --python this_file -- --clips DIR --receipt NEW_JSON."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import traceback

import bpy
from io_scene_fbx.parse_fbx import parse
from mathutils import Quaternion, Vector

R = Path(__file__).resolve().parents[3]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--clips', required=True, type=Path)
p.add_argument('--receipt', required=True, type=Path)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
assert bpy.app.background and bpy.context.scene.render.threads == 4
assert args.clips.is_dir() and not args.receipt.exists()
base = R / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
provider = base / 'tripo-v3-rig-20261017/rig.fbx'
idle = provider.parent / 'derived/natural-pose-20261017/relaxed-idle.fbx'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
paths = [provider, idle] + [base / 'generated-v2-high-detail' / (k + '.fbx') for k in ('walk', 'run')]
before = {str(path): sha(path) for path in paths}
M = {'Hips': 'pelvis', 'Spine02': 'spine_01', 'Spine01': 'spine_02', 'Spine': 'spine_03', 'neck': 'neck_01', 'Head': 'head'}
for prefix, side in (('Left', 'l'), ('Right', 'r')):
    for source, target in (('Shoulder', 'clavicle'), ('Arm', 'upperarm'), ('ForeArm', 'lowerarm'), ('Hand', 'hand'),
                           ('UpLeg', 'thigh'), ('Leg', 'calf'), ('Foot', 'foot'), ('ToeBase', 'ball')):
        M[prefix + source] = target + '_' + side
fingers = {f'{d}_{j:02}_{s}' for d in ('thumb', 'index', 'middle', 'ring', 'pinky') for j in (1, 2, 3) for s in ('l', 'r')}
report = {'passed': False, 'started_utc': datetime.now(timezone.utc).isoformat(), 'recipe_sha256': sha(Path(__file__)),
          'input_sha256': before, 'scope': 'Independent CPU gait retarget checks; no art/contact/native acceptance', 'clips': {}, 'errors': []}


def qerror(a, b):
    d = a.normalized().rotation_difference(b.normalized())
    return 2 * math.atan2(Vector((d.x, d.y, d.z)).length, abs(d.w))


def merror(a, b):
    return max(abs(v) for row in a - b for v in row)


def load(path, animated):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.fps, s.render.threads_mode, s.render.threads = 30, 'FIXED', 4
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=animated, automatic_bone_orientation=False, use_image_search=False)
    return next(o for o in bpy.data.objects if o.type == 'ARMATURE')


def frame(value):
    bpy.context.scene.frame_set(math.floor(value), subframe=value - math.floor(value))
    bpy.context.view_layer.update()


try:
    rig = load(provider, False)
    bind = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    hierarchy = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
    local = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy() for b in rig.data.bones}
    assert len(bind) == 61
    relaxed = load(idle, True)
    frame(relaxed.animation_data.action.frame_range[0])
    relaxed_q = {n: relaxed.pose.bones[n].matrix_basis.to_quaternion().normalized() for n in fingers}
    # A bind-straight finger substitute and a wrongly mapped calf must fail the fidelity checks.
    assert min(qerror(q, Quaternion()) for q in relaxed_q.values()) > math.radians(1)
    wrong_finger_error = max(qerror(q, Quaternion()) for q in relaxed_q.values())
    report['negative_controls'] = {'bind_straight_fingers_rejected_max_error_rad': wrong_finger_error}
    for kind, count in (('walk', 32), ('run', 20)):
        src = load(base / 'generated-v2-high-detail' / (kind + '.fbx'), True)
        first, last = src.animation_data.action.frame_range
        assert last - first == count - 1 and len(src.data.bones) == 24
        source_bind = {b.name: b.matrix_local.copy() for b in src.data.bones}
        factor = src.matrix_world.to_scale().z / 1.82000084619
        expected = []
        for i in range(count):
            frame(first + i)
            expected.append({'delta': {t: src.pose.bones[s].matrix.to_quaternion() @ source_bind[s].to_quaternion().inverted()
                                       for s, t in M.items()},
                             'hip': (src.pose.bones['Hips'].matrix.translation - source_bind['Hips'].translation) * factor})
        wrong_calf = max(qerror(row['delta']['calf_l'], row['delta']['calf_r']) for row in expected)
        assert wrong_calf > math.radians(10), 'Negative limb-map control must be discriminating'
        clip = args.clips / (kind + '.fbx')
        tree, version = parse(str(clip))
        settings = next(e for e in tree.elems if e.id == b'GlobalSettings')
        settings = next(e for e in settings.elems if e.id == b'Properties70')
        settings = {e.props[0].decode(): e.props[4] for e in settings.elems if e.id == b'P'}
        assert settings['TimeMode'] == 6 and settings['CustomFrameRate'] == 30.0, settings
        objects = next(e for e in tree.elems if e.id == b'Objects')
        stacks = [e for e in objects.elems if e.id == b'AnimationStack']
        assert len(stacks) == 1
        stack = next(e for e in stacks[0].elems if e.id == b'Properties70')
        stack = {e.props[0].decode(): e.props[4] for e in stack.elems if e.id == b'P'}
        ticks_per_second, ticks_per_frame = 46186158000, 1539538600
        assert stack['LocalStart'] % ticks_per_frame == 0 and stack['LocalStop'] % ticks_per_frame == 0
        declared_seconds = (stack['LocalStop'] - stack['LocalStart']) / ticks_per_second
        assert abs(declared_seconds - (count - 1) / 30) < 1e-12, declared_seconds
        key_time_arrays = [next(k for k in e.elems if k.id == b'KeyTime').props[0]
                           for e in objects.elems if e.id == b'AnimationCurve']
        # Blender's float-to-FBX integer conversion can truncate a key by one 21.65ps tick.
        key_tick_error = max(abs(int(t) - round(int(t) / ticks_per_frame) * ticks_per_frame)
                             for times in key_time_arrays for t in times)
        assert key_time_arrays and key_tick_error <= 1, key_tick_error
        null_models = [e.props[1].decode() for e in objects.elems if e.id == b'Model' and e.props[2] == b'Null']
        assert null_models == ['Armature\x00\x01Model'], null_models
        rig = load(clip, True)
        assert rig.name == 'Armature', rig.name
        assert bpy.context.scene.render.fps == 30 and bpy.context.scene.render.fps_base == 1.0
        assert len(rig.data.bones) == 61 and not any(o.type == 'MESH' for o in bpy.context.scene.objects)
        assert hierarchy == {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
        assert max(merror(b.matrix_local, bind[b.name]) for b in rig.data.bones) < 2e-5
        cf, cl = rig.animation_data.action.frame_range
        assert cl - cf == count - 1
        rotation = hip = finger = unmapped = root = obj = norm = seam = 0.
        foot_positions = {'l': [], 'r': []}
        for i in range((count - 1) * 2 + 1):
            frame(cf + i / 2)
            if i == 0:
                initial = {b.name: b.matrix.copy() for b in rig.pose.bones}
                object0 = rig.matrix_world.copy()
            for b in rig.pose.bones:
                assert all(math.isfinite(v) for row in b.matrix for v in row)
                norm = max(norm, abs(b.matrix.to_quaternion().magnitude - 1))
                actual_local = b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix
                if b.name in fingers:
                    finger = max(finger, qerror(actual_local.to_quaternion(), local[b.name].to_quaternion() @ relaxed_q[b.name]))
                elif b.name not in M.values():
                    unmapped = max(unmapped, qerror(actual_local.to_quaternion(), local[b.name].to_quaternion()))
            root = max(root, merror(rig.pose.bones['root'].matrix, bind['root']))
            obj = max(obj, merror(rig.matrix_world, object0))
            if i % 2 == 0:
                row = expected[i // 2]
                rotation = max(rotation, max(qerror(rig.pose.bones[n].matrix.to_quaternion() @ bind[n].to_quaternion().inverted(), q)
                                             for n, q in row['delta'].items()))
                hip = max(hip, (rig.pose.bones['pelvis'].matrix.translation - bind['pelvis'].translation - row['hip']).length)
            for s in ('l', 'r'):
                foot_positions[s].append(rig.pose.bones['foot_' + s].head.copy())
        seam = max(merror(b.matrix, initial[b.name]) for b in rig.pose.bones)
        foot_excursion = {s: max((v - foot_positions[s][0]).length for v in foot_positions[s]) for s in ('l', 'r')}
        assert rotation < 1e-4 and hip < 1e-5 and finger < 1e-4 and unmapped < 1e-4
        assert root < 1e-5 and obj < 1e-7 and norm < 1e-4 and seam < 1e-5
        assert all(v > .1 for v in foot_excursion.values()), 'Both feet must retain actual stride'
        report['clips'][kind] = {'sha256': sha(clip), 'source_range': [first, last], 'fresh_range': [cf, cl],
                                 'fbx_version': version, 'binary_null_models': null_models, 'fresh_armature_object': rig.name,
                                 'binary_time_mode': settings['TimeMode'], 'binary_custom_frame_rate': settings['CustomFrameRate'],
                                 'binary_stack_time_ticks': stack, 'binary_declared_seconds': declared_seconds,
                                 'binary_curve_time_arrays_on_30Hz_grid': len(key_time_arrays),
                                 'binary_curve_max_30Hz_grid_error_ktime_ticks': key_tick_error,
                                 'samples': count, 'half_frame_samples': (count - 1) * 2 + 1, 'fps': 30,
                                 'mapped_component_delta_error_rad': rotation, 'hip_xyz_error_target_units': hip,
                                 'finger_baseline_error_rad': finger, 'unmapped_root_twist_rotation_error_rad': unmapped,
                                 'root_matrix_error': root, 'object_matrix_error': obj, 'evaluated_quaternion_norm_error': norm,
                                 'loop_matrix_error': seam, 'foot_excursion_target_units': foot_excursion,
                                 'wrong_calf_mapping_rejected_max_error_rad': wrong_calf}
    report['passed'] = True
except Exception:
    report['errors'].append(traceback.format_exc())
    raise
finally:
    report['retained_inputs_unchanged'] = before == {p: sha(Path(p)) for p in before}
    report['finished_utc'] = datetime.now(timezone.utc).isoformat()
    args.receipt.write_text(json.dumps(report, indent=2) + '\n')
    assert report['retained_inputs_unchanged']
print('NORD_TRIPO_LOCOMOTION_INDEPENDENT_OK', args.receipt, flush=True)
