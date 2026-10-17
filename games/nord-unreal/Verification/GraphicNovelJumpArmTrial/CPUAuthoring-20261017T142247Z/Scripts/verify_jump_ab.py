"""Fresh-import CPU comparison of the retained/control/trial jump FBXs; no render.

Run only after both recorded authoring jobs, with Blender --background
--factory-startup --python-exit-code 1 --python this_file. Writes one NEW JSON.
Local translations/rest-matrix translations use imported armature units. At the
expected 0.01 object scale, 1e-4 such units is 1 micrometre in world space.
No retargeting, rest-matrix normalization or tolerance widening is performed.
"""
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path('/tmp/nord-jump-arm-ab-20261017T1359')
GAME = Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
SOURCE = GAME / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
OUT = ROOT / 'semantic-comparison.json'
ARMS = {'LeftArm', 'RightArm'}
TOL = {'rest_matrix_abs': 1e-4, 'object_matrix_abs': 1e-6,
       'local_translation_abs': 1e-4, 'local_scale_abs': 1e-6,
       'local_rotation_radians': 1e-4, 'frame_abs': 1e-6,
       'hips_perpendicular_world_m': 1e-5, 'hips_axial_world_m': .111}
PINS = {
    GAME / 'Scripts/prepare_meshy_jump.py': 'ed50ad1d4a09a9d6b71ee45c108a4f0e404b222ebfe311df3302929a6602aebd',
    SOURCE / 'body.fbx': 'b7e7ca0d9c486412108cba85e1cd4a5512fecd4ad36b8cfdb4677259ff6f9244',
    SOURCE / 'jump.fbx': '36d74356ca903188a9b3956db69e51367260866972cda9215fab6a66d5362aa3',
    SOURCE / 'jump.json': '94deb47f51e5cbfd6e5694efb8dcb8052c2abf6c91df7ceee2a35def47838e3f',
    ROOT / 'control/CurlyMetalhead/jump.fbx': '8aa9a10943923715482188e4105d7e836891addbf96f936de26edefa7b38b8ed',
    ROOT / 'trial/CurlyMetalhead/jump.fbx': 'e35071099841d099eea5dda9de96a31b10cd07c4dfe73543bfee42f395c4833e',
}
CLIPS = {'retained': ROOT / 'retained-jump.fbx',
         'control': ROOT / 'control/CurlyMetalhead/jump.fbx',
         'trial': ROOT / 'trial/CurlyMetalhead/jump.fbx'}
BODY_COPIES = [ROOT / name / 'CurlyMetalhead/body.fbx' for name in ('control', 'trial')]
INPUTS = sorted(set(PINS) | set(CLIPS.values()) | set(BODY_COPIES) | {
    ROOT / 'preparation.json', ROOT / 'retained-jump.json',
    ROOT / 'Scripts/control_jump.py', ROOT / 'Scripts/trial_jump.py', Path(__file__)})


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot():
    return {str(path): {'bytes': path.stat().st_size, 'sha256': sha(path)} for path in INPUTS}


def matrix(value):
    return [[float(x) for x in row] for row in value]


def max_error(a, b):
    if isinstance(a, (list, tuple)):
        assert len(a) == len(b), 'Different array dimensions'
        return max((max_error(x, y) for x, y in zip(a, b)), default=0.)
    return abs(a - b)


def rotation_error(a, b):
    """Geodesic angle, invariant to quaternion sign; Python-double normalization."""
    normalized = []
    for q in (a, b):
        length = math.sqrt(sum(x*x for x in q))
        assert math.isfinite(length) and length > 1e-12, 'Invalid quaternion'
        normalized.append([x/length for x in q])
    a, b = normalized
    distance = min(math.sqrt(sum((x-y)**2 for x, y in zip(a, b))),
                   math.sqrt(sum((x+y)**2 for x, y in zip(a, b))))
    return 4 * math.asin(min(1., distance / 2))


def require_finite(value):
    if isinstance(value, dict):
        for item in value.values(): require_finite(item)
    elif isinstance(value, (list, tuple)):
        for item in value: require_finite(item)
    elif isinstance(value, (int, float)):
        assert math.isfinite(value), 'Nonfinite imported transform'


def collect(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True,
                            automatic_bone_orientation=False, use_image_search=False)
    rigs = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
    assert len(rigs) == 1, ('Expected one clip armature', path, len(rigs))
    assert not any(obj.type == 'MESH' for obj in bpy.context.scene.objects), 'Clip unexpectedly contains a mesh'
    rig = rigs[0]
    assert rig.animation_data and rig.animation_data.action, ('Missing own action', path)
    names = sorted(rig.data.bones.keys())
    assert len(names) == 24 and {'Hips', 'Head', 'LeftShoulder', 'RightShoulder'} | ARMS <= set(names)
    first, last = map(float, rig.animation_data.action.frame_range)
    frames = list(range(math.ceil(first), math.floor(last) + 1))
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    assert abs(first-round(first)) <= TOL['frame_abs'] and abs(last-round(last)) <= TOL['frame_abs']
    assert len(frames) == 37 and abs(last-first-36) <= TOL['frame_abs'] and abs(fps-30) <= TOL['frame_abs']
    row = {'path': str(path), 'armature': rig.name, 'bones': names,
           'parents': {b.name: b.parent.name if b.parent else None for b in rig.data.bones},
           'rest_matrices': {b.name: matrix(b.matrix_local) for b in rig.data.bones},
           'frame_range': [first, last], 'sample_frames': frames, 'fps': fps,
           'duration_seconds': (last-first)/fps, 'samples': []}
    up = rig.matrix_world.to_3x3() @ (rig.data.bones['Head'].matrix_local.translation - rig.data.bones['Hips'].matrix_local.translation)
    assert up.length > 1e-8
    up.normalize()
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        bones = {}
        for name in names:
            location, rotation, scale = rig.pose.bones[name].matrix_basis.decompose()
            bones[name] = {'translation': list(location), 'rotation_wxyz': list(rotation), 'scale': list(scale)}
        row['samples'].append({'frame': frame, 'object_matrix': matrix(rig.matrix_world),
                               'hips_world_m': list(rig.matrix_world @ rig.pose.bones['Hips'].matrix.translation),
                               'bones': bones})
    require_finite(row)
    row['object_matrix'] = row['samples'][0]['object_matrix']
    row['max_object_animation_error'] = max(max_error(s['object_matrix'], row['object_matrix']) for s in row['samples'])
    assert row['max_object_animation_error'] <= TOL['object_matrix_abs'], ('Animated armature object', path)
    origin = Vector(row['samples'][0]['hips_world_m'])
    axial, perpendicular = [], []
    for sample in row['samples']:
        delta = Vector(sample['hips_world_m']) - origin
        axial.append(float(delta.dot(up)))
        perpendicular.append(float((delta-up*delta.dot(up)).length))
    row['hips_motion'] = {'anatomical_up_world': list(up), 'axial_range_m': [min(axial), max(axial)],
                          'max_perpendicular_m': max(perpendicular),
                          'endpoint_return_m': float((Vector(row['samples'][-1]['hips_world_m'])-origin).length),
                          'scope': 'Static object and no Hips perpendicular drift; authored vertical anticipation/landing crouch remains allowed.'}
    assert max(perpendicular) <= TOL['hips_perpendicular_world_m'], ('Hips drift', path, row['hips_motion'])
    assert min(axial) >= -TOL['hips_axial_world_m'] and max(axial) <= TOL['hips_perpendicular_world_m']
    assert row['hips_motion']['endpoint_return_m'] <= TOL['hips_perpendicular_world_m']
    for sample in (row['samples'][0], row['samples'][-1]):
        for name, trs in sample['bones'].items():
            assert max_error(trs['translation'], [0., 0., 0.]) <= TOL['local_translation_abs'], ('Nonneutral endpoint translation', path, name)
            assert max_error(trs['scale'], [1., 1., 1.]) <= TOL['local_scale_abs'], ('Nonneutral endpoint scale', path, name)
            assert rotation_error(trs['rotation_wxyz'], [1., 0., 0., 0.]) <= TOL['local_rotation_radians'], ('Nonneutral endpoint rotation', path, name)
    return row


def compare(a, b, allowed_rotations=()):
    assert a['bones'] == b['bones'] and a['parents'] == b['parents'], 'Hierarchy differs'
    assert max_error(a['frame_range'], b['frame_range']) <= TOL['frame_abs'] and a['sample_frames'] == b['sample_frames'], 'Sampling differs'
    assert abs(a['fps']-b['fps']) <= TOL['frame_abs']
    result = {'rest_matrix_max_abs': max(max_error(a['rest_matrices'][name], b['rest_matrices'][name]) for name in a['bones']),
              'object_matrix_max_abs': 0., 'local_translation_max_abs': 0., 'local_scale_max_abs': 0.,
              'forbidden_rotation_max_radians': 0., 'allowed_rotation_max_radians': {name: 0. for name in allowed_rotations}}
    assert result['rest_matrix_max_abs'] <= TOL['rest_matrix_abs'], ('Rest representation differs', result)
    for first, second in zip(a['samples'], b['samples']):
        result['object_matrix_max_abs'] = max(result['object_matrix_max_abs'], max_error(first['object_matrix'], second['object_matrix']))
        for name in a['bones']:
            x, y = first['bones'][name], second['bones'][name]
            result['local_translation_max_abs'] = max(result['local_translation_max_abs'], max_error(x['translation'], y['translation']))
            result['local_scale_max_abs'] = max(result['local_scale_max_abs'], max_error(x['scale'], y['scale']))
            angle = rotation_error(x['rotation_wxyz'], y['rotation_wxyz'])
            if name in allowed_rotations: result['allowed_rotation_max_radians'][name] = max(result['allowed_rotation_max_radians'][name], angle)
            else: result['forbidden_rotation_max_radians'] = max(result['forbidden_rotation_max_radians'], angle)
    for key, tolerance in [('object_matrix_max_abs', 'object_matrix_abs'), ('local_translation_max_abs', 'local_translation_abs'),
                           ('local_scale_max_abs', 'local_scale_abs'), ('forbidden_rotation_max_radians', 'local_rotation_radians')]:
        assert result[key] <= TOL[tolerance], ('Unexpected semantic difference', key, result[key], TOL[tolerance])
    assert all(angle > .01 for angle in result['allowed_rotation_max_radians'].values()), 'Expected arm change absent'
    return result


assert Path(__file__).resolve() == ROOT / 'Scripts/verify_jump_ab.py'
assert not OUT.exists(), 'Preserve an existing comparison receipt'
before = snapshot()
report = {'passed': False, 'scope': 'CPU fresh FBX import/semantic comparison only; no native or appearance acceptance',
          'blender': bpy.app.version_string, 'tolerances': TOL, 'inputs_before': before, 'clips': {},
          'limitations': ['All 37 imported integer frames are sampled; no continuous interpolation/native compression or blended-pose claim.',
                         'Bind/object representation differences fail at the stated tolerances; no automatic correction.',
                         'Allowed upper-arm local changes naturally move descendant hands/forearms in world space.',
                         'Vertical Hips crouch is allowed; object animation and perpendicular Hips drift are rejected.']}
try:
    assert all(sha(path) == value for path, value in PINS.items()), 'Pinned retained/exported input changed'
    assert all(sha(path) == PINS[SOURCE / 'body.fbx'] for path in BODY_COPIES), 'Body copy differs'
    assert sha(CLIPS['retained']) == PINS[SOURCE / 'jump.fbx'] and sha(ROOT / 'retained-jump.json') == PINS[SOURCE / 'jump.json']
    assert sha(ROOT / 'Scripts/control_jump.py') == PINS[GAME / 'Scripts/prepare_meshy_jump.py']
    assert sha(ROOT / 'Scripts/trial_jump.py') == 'ae574ab5af000a38f6075926d8e1c3fb183d2fa287ed6813c422e38dc6e8165c'
    for name, path in CLIPS.items(): report['clips'][name] = collect(path)
    report['retained_vs_control'] = compare(report['clips']['retained'], report['clips']['control'])
    report['control_vs_trial'] = compare(report['clips']['control'], report['clips']['trial'], ARMS)
    report['passed'] = True
except Exception as error:
    report['error'] = repr(error)
    raise
finally:
    report['inputs_after'] = snapshot()
    report['all_inputs_unchanged'] = report['inputs_after'] == before
    if not report['all_inputs_unchanged']:
        report['passed'] = False
        report['preservation_error'] = 'An input changed during verification'
    with OUT.open('x') as stream: json.dump(report, stream, indent=2, allow_nan=False); stream.write('\n')
    assert report['all_inputs_unchanged'], 'An input changed during verification'
print('NORD_PRIVATE_JUMP_AB_SEMANTICS_OK', OUT)
