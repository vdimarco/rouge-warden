"""Actual BlackCap Tripo-body/own-rig CPU motion check; no provider/native/render writes."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess

import prepare_tripo_cast_motion as motion

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--surface-receipt', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
output, surface = args.output.resolve(), args.surface_receipt.resolve()
assert not output.exists(); output.mkdir(parents=True)
base = ROOT/'Data/GraphicNovel/Crew/BlackCap'
inputs = {'provider_fbx': base/'tripo-h31-rig-20261017/rig.fbx',
          'source_body_fbx': base/'generated-v1-high-detail/body.fbx',
          'walk_fbx': base/'generated-v1-high-detail/walk.fbx',
          'run_fbx': base/'generated-v1-high-detail/run.fbx', 'surface_receipt': surface}
pins = {'provider_fbx': '54db95e20649c34c1d6dd2f28e1a1ec44a91250b0f73f6041774ac722764848b',
        'source_body_fbx': '54b9a95853e8a069a607bf2fd32733d3333ce82015e88e78b9621ee1341b631e',
        'walk_fbx': 'bb72d020d690b65be4cd4135ee718b622d296d5605697508fd1d9ffecb411510',
        'run_fbx': '07e3ffede13b8fea3b216a04495573ba2d979c2e1ac34267fbd37a97468ee1e1',
        'surface_receipt': motion.digest(surface)}
assert {k: motion.digest(p) for k, p in inputs.items()} == pins
pilot = ROOT/'Data/GraphicNovel/Pilot/CurlyMetalhead'
protected = [p for root in (pilot, ROOT/'Verification/TripoPilot', ROOT/'Verification/TripoNative',
                            ROOT/'Content/ParkComic/CrewGraphicNovelTripo/Resident9',
                            base/'generated-v1-high-detail', base/'tripo-h31-body-20261017', base/'tripo-h31-rig-20261017')
             for p in root.rglob('*') if p.is_file() and '.fbm' not in str(p)]
protected += [ROOT/'Scripts'/n for n in ('prepare_meshy_jump.py', 'prepare_tripo_locomotion.py', 'prepare_tripo_native_timing.py', 'prepare_tripo_surface.py')]
before = {str(p): motion.digest(p) for p in protected}
manifest = output/'manifest.json'
document = {k: {'path': str(p.relative_to(ROOT)), 'sha256': pins[k]} for k, p in inputs.items()}
manifest.write_text(json.dumps(document, indent=2)+'\n')


def rejects(path, target, report):
    try:
        motion.source_plan(path, target, report)
    except AssertionError:
        return
    raise AssertionError('Invalid or overwriting plan accepted')


bad = json.loads(manifest.read_text()); bad['provider_fbx']['sha256'] = '0'*64
tampered = output/'tampered.json'; tampered.write_text(json.dumps(bad)+'\n')
rejects(tampered, output/'bad-clips', output/'bad-report')
assert not (output/'bad-clips').exists() and not (output/'bad-report').exists()
existing = output/'existing'; existing.mkdir(); sentinel = existing/'preserve.txt'; sentinel.write_text('preserve\n')
rejects(manifest, existing, output/'must-not-create-report'); rejects(manifest, output/'must-not-create-clips', existing)
assert sentinel.read_text() == 'preserve\n' and not (output/'must-not-create-report').exists() and not (output/'must-not-create-clips').exists()
for label, change in (
        ('mismatched-rig', lambda d: d['inputs']['provider_fbx'].update(sha256='0'*64)),
        ('failed-surface', lambda d: d.update(passed=False)),
        ('rotated-surface', lambda d: d['correspondence'].update(rotation_fit=True)),
        ('applied-transform', lambda d: d['correspondence'].update(geometry_bind_or_object_transform_correction_applied=True))):
    receipt = json.loads(surface.read_text()); change(receipt)
    path = output/(label+'.json'); path.write_text(json.dumps(receipt)+'\n')
    bad = json.loads(manifest.read_text()); bad['surface_receipt'] = {'path': str(path), 'sha256': motion.digest(path)}
    altered = output/(label+'-manifest.json'); altered.write_text(json.dumps(bad)+'\n')
    rejects(altered, output/(label+'-clips'), output/(label+'-report'))
    assert not (output/(label+'-clips')).exists() and not (output/(label+'-report')).exists()
command = [shutil.which('blender') or 'blender', '-b', '-t', '4', '--python-exit-code', '1', '--python',
           str(ROOT/'Scripts/prepare_tripo_cast_motion.py'), '--', '--manifest', str(manifest),
           '--output', str(output/'clips'), '--report', str(output/'report')]
for name in ('prepare_tripo_cast_motion.py', 'test_tripo_h31_motion.py', 'prepare_tripo_cast_surface.py'):
    shutil.copyfile(ROOT/'Scripts'/name, output/('executed-'+name))
with (output/'blender.log').open('w') as log:
    process = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=240)
assert process.returncode == 0, output/'blender.log'
result = json.loads((output/'report/Motion.json').read_text())
assert result['passed'] and result['retained_inputs_unchanged'] and len(result['source_to_target']) == 22
assert result['rig']['bones'] == 61 and len(result['rig']['weighted_finger_sums']) == 30
assert result['motion_reference_frames']['world_gravity_preserved'] and result['motion_reference_frames']['source_and_provider_A_pose']
q = result['motion_reference_frames']['source_to_provider_quaternion_wxyz']
assert abs(abs(q[0])-2**-.5) < 1e-5 and abs(abs(q[3])-2**-.5) < 1e-5 and max(abs(q[1]), abs(q[2])) < 1e-5
assert .0053 < result['scaling']['source_xyz_to_target_factor'] < .0055
assert not result['scaling']['surface_translation_applied_to_motion_deltas']
for row in result['rig']['actual_rig_backward_axis_negative_control'].values():
    assert row['forward20_delta_deg'] > 19.5 and row['backward_negative20_delta_deg'] < -19.5
for kind, seconds in (('idle', 4.), ('jump', 1.2), ('walk', 31/30), ('run', 19/30)):
    clip = result['clips'][kind]
    assert motion.digest(Path(clip['output']['path'])) == clip['output']['sha256']
    assert clip['bones'] == 61 and clip['fps'] == 30 and clip['seconds'] == seconds
    assert clip['binary_fbx']['strict_export_clock'] and abs(clip['binary_fbx']['declared_seconds']-seconds) < 1e-12
    assert clip['binary_fbx']['curve_max_grid_error_ktime_ticks'] <= 1
    assert clip['neutral_reference_frame_outside_exported_range'] == 0
    if kind in ('idle', 'jump'):
        assert clip['metrics']['minimum_elbow_forward_delta_deg'] >= 14-1e-4
        assert clip['metrics']['maximum_upper_body_step_deg_per_30Hz_frame'] < (3 if kind == 'idle' else 20)
assert result['clips']['jump']['metrics']['jump_inherited_lower_body_matrix_error_half_frames'] < 1e-5
assert result['idle_jump_endpoint_matrix_error'] < 1e-5
assert before == {p: motion.digest(Path(p)) for p in before}, 'Originals or frozen pilot changed'
receipt = {'passed': True, 'finished_utc': datetime.now(timezone.utc).isoformat(), 'command': command,
    'process_exit_code': process.returncode, 'recipes': {n: motion.digest(ROOT/'Scripts'/n) for n in
        ('prepare_tripo_cast_motion.py', 'test_tripo_h31_motion.py', 'prepare_tripo_cast_surface.py')},
    'motion_receipt': {'path': str(output/'report/Motion.json'), 'sha256': motion.digest(output/'report/Motion.json')},
    'negative_controls': ['Tampered SHA', 'Existing output/report', 'Mismatched own rig proof', 'Failed proof', 'Rotation fit', 'Applied provider transform', 'Actual backward elbow axis'],
    'protected_files_unchanged': before, 'no_api_render_unreal_gpu_service_operations': True,
    'limitations': ['CPU pose and timing proof only; continuous visible deformation and native acceptance pending.']}
(output/'Test.json').write_text(json.dumps(receipt, indent=2)+'\n')
print('TRIPO_H31_MOTION_PASS', output)
