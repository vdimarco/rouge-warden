"""Prepare existing own-rig idle/jump at declared 30Hz; Blender -b -t 4 --python-exit-code 1 --python this_file -- --output NEW_DIR."""
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
from mathutils import Vector

R = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--output', required=True, type=Path)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
O = args.output.resolve()
O.mkdir(parents=True, exist_ok=True)
assert not any(O.iterdir()), 'Use a fresh output directory'
assert bpy.app.background and bpy.context.scene.render.threads == 4
base = R / 'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017'
inputs = {'idle': base / 'derived/natural-pose-20261017/relaxed-idle.fbx',
          'jump': base / 'derived/natural-pose-20261017/natural-jump.fbx'}
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
before = {k: sha(v) for k, v in inputs.items()}
assert before == {'idle': 'f5cf127b897cd54b52676932ff89461033becf1a19e8cf109a33d30c8958dfbc',
                  'jump': '11b1f85e5d84f38ab6aa4e17ff951116a43cd16b08bfa02938ad0e781010ace1'}
report = {'passed': False, 'started_utc': datetime.now(timezone.utc).isoformat(), 'recipe_sha256': sha(Path(__file__)),
          'scope': 'Timing-only own-rig derivatives. Original clips/acting remain frozen; no rendering, Unreal, provider or service actions.',
          'inputs': {k: {'path': str(v), 'sha256': before[k]} for k, v in inputs.items()},
          'precision': {'matrix': 2e-5, 'reference_head_scale_and_root': 1e-5, 'rotation_rad': 1e-4,
                        'curve_time_grid_error_ktime_ticks': 1, 'declared_duration_seconds': 1e-12},
          'clips': {}, 'errors': []}


def merror(a, b):
    return max(abs(v) for row in a - b for v in row)


def qerror(a, b):
    d = a.normalized().rotation_difference(b.normalized())
    return 2 * math.atan2(Vector((d.x, d.y, d.z)).length, abs(d.w))


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.threads_mode, s.render.threads = 'FIXED', 4
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True, automatic_bone_orientation=False, use_image_search=False)
    assert not any(o.type == 'MESH' for o in s.objects)
    rig = next(o for o in s.objects if o.type == 'ARMATURE')
    assert rig.name == 'Armature' and len(rig.data.bones) == 61
    source_rate = [s.render.fps, s.render.fps_base]
    # FBX imports change scene rate. Apply the intended clock after every import.
    s.render.fps, s.render.fps_base = 30, 1.0
    return rig, source_rate


def frame(value):
    bpy.context.scene.frame_set(math.floor(value), subframe=value - math.floor(value))
    bpy.context.view_layer.update()


def timing(path, intervals):
    tree, version = parse(str(path))
    settings = next(e for e in tree.elems if e.id == b'GlobalSettings')
    settings = next(e for e in settings.elems if e.id == b'Properties70')
    settings = {e.props[0].decode(): e.props[4] for e in settings.elems if e.id == b'P'}
    assert settings['TimeMode'] == 6 and settings['CustomFrameRate'] == 30.0
    objects = next(e for e in tree.elems if e.id == b'Objects')
    nulls = [e.props[1].decode() for e in objects.elems if e.id == b'Model' and e.props[2] == b'Null']
    assert nulls == ['Armature\x00\x01Model']
    stacks = [e for e in objects.elems if e.id == b'AnimationStack']
    assert len(stacks) == 1
    stack = next(e for e in stacks[0].elems if e.id == b'Properties70')
    stack = {e.props[0].decode(): e.props[4] for e in stack.elems if e.id == b'P'}
    tick = 1539538600
    assert stack['LocalStart'] % tick == 0 and stack['LocalStop'] % tick == 0
    seconds = (stack['LocalStop'] - stack['LocalStart']) / 46186158000
    assert abs(seconds - intervals / 30) < 1e-12
    arrays = [next(k for k in e.elems if k.id == b'KeyTime').props[0]
              for e in objects.elems if e.id == b'AnimationCurve']
    # Integer KTime conversion may truncate a key by one 21.65ps tick.
    error = max(abs(int(t) - round(int(t) / tick) * tick) for a in arrays for t in a)
    assert arrays and error <= 1
    return {'version': version, 'time_mode': settings['TimeMode'], 'custom_frame_rate': settings['CustomFrameRate'],
            'stack_time_ticks': stack, 'declared_seconds': seconds, 'curve_arrays': len(arrays),
            'curve_max_grid_error_ktime_ticks': error, 'null_models': nulls}


try:
    for kind, count in (('idle', 121), ('jump', 37)):
        rig, input_rate = load(inputs[kind])
        scene = bpy.context.scene
        first, last = rig.animation_data.action.frame_range
        assert last - first == count - 1
        bind = {b.name: b.matrix_local.copy() for b in rig.data.bones}
        hierarchy = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
        expected = []
        for i in range((count - 1) * 2 + 1):
            frame(first + i / 2)
            if i == 0:
                object0 = rig.matrix_world.copy()
            assert merror(object0, rig.matrix_world) < 1e-7
            expected.append({b.name: b.matrix.copy() for b in rig.pose.bones})
        scene.frame_start, scene.frame_end = int(first), int(last)
        # Keep the existing dense action. Only its unexported reference pose is added at frame 0.
        for b in rig.pose.bones:
            b.matrix_basis.identity()
            for channel in ('rotation_quaternion', 'location', 'scale'):
                b.keyframe_insert(channel, frame=0)
        frame(0)
        assert max(merror(b.matrix, bind[b.name]) for b in rig.pose.bones) < 1e-5
        bpy.ops.object.select_all(action='DESELECT')
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        path = O / (kind + '.fbx')
        assert scene.render.fps == 30 and scene.render.fps_base == 1.0
        bpy.ops.export_scene.fbx(filepath=str(path), use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                                 bake_anim=True, bake_anim_use_all_bones=True, bake_anim_use_nla_strips=False,
                                 bake_anim_use_all_actions=False, bake_anim_simplify_factor=0, axis_forward='-Z', axis_up='Y')
        actual_timing = timing(path, count - 1)
        rig, exported_rate = load(path)
        assert exported_rate == [30, 1.0]
        assert hierarchy == {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
        reference = {'matrix': max(merror(b.matrix_local, bind[b.name]) for b in rig.data.bones),
                     'head': max((b.matrix_local.translation - bind[b.name].translation).length for b in rig.data.bones),
                     'scale': max(max(abs(a - c) for a, c in zip(b.matrix_local.to_scale(), bind[b.name].to_scale())) for b in rig.data.bones),
                     'rotation_rad': max(qerror(b.matrix_local.to_quaternion(), bind[b.name].to_quaternion()) for b in rig.data.bones)}
        cf, cl = rig.animation_data.action.frame_range
        assert cl - cf == count - 1
        matrix = rotation = root = obj = norm = 0.
        for i, original in enumerate(expected):
            frame(cf + i / 2)
            if i == 0:
                object1 = rig.matrix_world.copy()
            for b in rig.pose.bones:
                assert all(math.isfinite(v) for row in b.matrix for v in row)
                matrix = max(matrix, merror(b.matrix, original[b.name]))
                rotation = max(rotation, qerror(b.matrix.to_quaternion(), original[b.name].to_quaternion()))
                norm = max(norm, abs(b.matrix.to_quaternion().magnitude - 1))
            root = max(root, merror(rig.pose.bones['root'].matrix, bind['root']))
            obj = max(obj, merror(rig.matrix_world, object1))
        report['clips'][kind] = {'output': {'path': str(path), 'bytes': path.stat().st_size, 'sha256': sha(path)},
                                 'bones': 61, 'samples': count, 'half_frame_comparisons': len(expected),
                                 'source_range': [first, last], 'fresh_range': [cf, cl], 'source_declared_scene_rate': input_rate,
                                 'fps': 30, 'seconds': (count - 1) / 30, 'binary_fbx': actual_timing,
                                 'reference_error': reference, 'pose_matrix_error': matrix, 'pose_rotation_error_rad': rotation,
                                 'root_matrix_error': root, 'object_matrix_error': obj, 'evaluated_quaternion_norm_error': norm,
                                 'reference_frame_outside_exported_range': 0}
        assert reference['matrix'] < 2e-5 and reference['head'] < 1e-5 and reference['scale'] < 1e-5 and reference['rotation_rad'] < 1e-4
        assert matrix < 2e-5 and rotation < 1e-4 and root < 1e-5 and obj < 1e-7 and norm < 1e-4
    report['passed'] = True
except Exception:
    report['errors'].append(traceback.format_exc())
    raise
finally:
    report['retained_inputs_unchanged'] = before == {k: sha(v) for k, v in inputs.items()}
    report['finished_utc'] = datetime.now(timezone.utc).isoformat()
    (O / 'Timing.json').write_text(json.dumps(report, indent=2) + '\n')
    assert report['retained_inputs_unchanged']
print('NORD_TRIPO_NATIVE_TIMING_OK', O, flush=True)
