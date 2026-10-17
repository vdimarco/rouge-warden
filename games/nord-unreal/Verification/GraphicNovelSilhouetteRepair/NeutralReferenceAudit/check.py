"""Reproduce the native reference audit from three retained JSONs; stdlib only.
Run: python3 -B Verification/GraphicNovelSilhouetteRepair/NeutralReferenceAudit/check.py
Reads only; no Unreal, NumPy, Blender or installed engine required.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PINS = {
    'Native/TrialReceipt.json': '6ad9d969b8d48f73b4475aee8be5a1a9f169ed7db853c2585dd334655d9bb2ba',
    'Headless/Gameplay.json': '68f1aacc1869bc91ce576527604b385df4e2c157a95b8d2c71fbe0c1657d4094',
    'CPU/semantic-comparison.json': '94e329b3b677808e1872ca10d3c1e59cbf1fcae50c9b3ee3481e79d6ef8867c3',
}
CHAIN = ['Armature', 'Hips', 'Spine02', 'Spine01', 'Spine',
         'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']


def multiply(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return [aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx,
            aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz]


def normalize(q):
    size = math.sqrt(sum(x*x for x in q))
    assert math.isfinite(size) and size > 1e-12
    return [x/size for x in q]


def inverse(q):
    size = sum(x*x for x in q)
    return [-q[0]/size, -q[1]/size, -q[2]/size, q[3]/size]


def rotate(q, v): return multiply(multiply(q, [*v, 0.]), inverse(q))[:3]


def angle(a, b):
    a, b = normalize(a), normalize(b)
    distance = min(math.dist(a, b), math.dist(a, [-x for x in b]))
    return math.degrees(4*math.asin(min(1., distance/2)))


def slerp(a, b, fraction):
    a, b = normalize(a), normalize(b)
    dot = sum(x*y for x, y in zip(a, b))
    if dot < 0: b, dot = [-x for x in b], -dot
    if dot > .9995: return normalize([x+(y-x)*fraction for x, y in zip(a, b)])
    theta = math.acos(max(-1., min(1., dot)))
    return [(math.sin((1-fraction)*theta)*x+math.sin(fraction*theta)*y)/math.sin(theta)
            for x, y in zip(a, b)]


def component_rotation(rows):
    result = [0., 0., 0., 1.]
    for name in CHAIN: result = normalize(multiply(result, rows[name]['rotation']))
    return result


def run():
    data = {}
    for relative, expected in PINS.items():
        raw = (ROOT/relative).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == expected, ('Changed evidence', relative)
        data[relative] = json.loads(raw)
    native, headless, cpu = (data[name] for name in PINS)
    assert native['passed'] and native['native_pose_gate']['passed']
    assert headless['passed'] and headless['headless'] and cpu['passed']
    parents = {**cpu['clips']['retained']['parents'], 'Armature': None}
    assert parents['Hips'] is None
    parents['Hips'] = 'Armature'  # Actual extra static native import root, explicitly retained.
    assert [parents[name] for name in CHAIN] == [None, *CHAIN[:-1]]
    poses = native['trial_poses']; refs = poses['reference_pose']; samples = poses['samples']
    assert len(refs) == 25 and len(samples) == 37 and poses['import_root'] == 'Armature'
    for name in CHAIN:
        scale = refs[name]['scale']
        assert min(scale) > 0. and max(scale)-min(scale) < .00001
    reference = component_rotation(refs)
    assert angle(reference, component_rotation(samples[0]['bones'])) < 1e-10
    assert angle(reference, component_rotation(samples[-1]['bones'])) < 1e-10
    prop = headless['compound_prop']
    initial = prop['initial_hand_world']['rotation_xyzw']
    target = prop['initial_target_world_quat']
    recorded = prop['initial_readback']['prop_relative']['rotation_xyzw']
    ideal = normalize(multiply(inverse(reference), target))
    offset = [-x for x in rotate(ideal, [0., 0., -12.])]
    assert math.dist(ideal, [.0746121380784118, .224637684893198,
                             -.9553328060518326, .17694679725364926]) < 1e-12
    assert math.dist(offset, [-.7567321044396016, -5.467347089357475, 10.655302545052614]) < 1e-10
    mismatch = angle(initial, reference)
    assert 17.35 < mismatch < 17.36
    formula_error = angle(recorded, multiply(inverse(initial), target))
    assert formula_error < 1e-10
    neutral_axis = rotate(multiply(reference, recorded), [0., 0., 1.])
    target_axis = rotate(target, [0., 0., 1.])
    axis_error = math.degrees(math.acos(max(-1., min(1., sum(x*y for x, y in zip(neutral_axis, target_axis))))))
    assert 7.05 < axis_error < 7.06
    errors = []
    for observed in headless['characters'][0]['jump_samples']:
        if observed['clip_weights']['Jump'] != 1.: continue
        time = observed['clip_time']*30.; frame = int(time); fraction = time-frame
        rows = {name: {'rotation': slerp(samples[frame]['bones'][name]['rotation'],
                    samples[min(frame+1, 36)]['bones'][name]['rotation'], fraction)} for name in CHAIN}
        errors.append(angle(component_rotation(rows), observed['compound_prop']['hand_world']['rotation_xyzw']))
    assert len(errors) == 42 and max(errors) < .003, ('Component/world crosscheck failed', errors)
    return {'passed': True, 'quaternion_order': 'xyzw; componentQ = parentQ * localQ',
            'native_chain': CHAIN, 'reference_hand_component_quaternion_xyzw': reference,
            'jump_endpoint_reference_error_degrees': [0., 0.],
            'initial_hand_reference_error_degrees': mismatch,
            'recorded_relative_formula_error_degrees': formula_error,
            'ideal_neutral_relative_quaternion_xyzw': ideal, 'ideal_offset_cm': offset,
            'recorded_bake_neutral_cup_axis_error_degrees': axis_error,
            'pure_jump_crosscheck_samples': len(errors),
            'pure_jump_hand_rotation_error_degrees_min_max': [min(errors), max(errors)]}


if __name__ == '__main__': print(json.dumps(run(), indent=2, allow_nan=False))
