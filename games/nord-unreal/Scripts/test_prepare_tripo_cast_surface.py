"""Bounded CPU regression on the frozen pilot; no source/native/API/GPU writes."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess

import prepare_tripo_cast_surface as surface

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--output', type=Path)
args = p.parse_args()
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
output = (args.output or ROOT / 'Saved/Tests/TripoCastSurfaceRegression' / stamp).resolve()
assert not output.exists(), 'Use a fresh test directory'
output.mkdir(parents=True)
pilot = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
sources = {'source_glb': pilot / 'generated-v2-high-detail/body.glb',
           'provider_fbx': pilot / 'tripo-v3-rig-20261017/rig.fbx',
           'normal_png': pilot / 'generated-v2-high-detail/normal.png'}
manifest = {role: {'path': str(path.relative_to(ROOT)), 'sha256': surface.digest(path)} for role, path in sources.items()}
assert manifest['source_glb']['sha256'] == '25041be9666422c30ba39449cb283a83928bb3de596fe063389707c070335613'
assert manifest['provider_fbx']['sha256'] == 'baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2'
assert manifest['normal_png']['sha256'] == '7845864ce13d1e3ce10e8149ef2ef98a048b8be249a60749dfc70c4897e9e7ab'
protected = sorted(p for root in (pilot / 'generated-v2-high-detail', ROOT / 'Verification/TripoNative/Surface',
                                  ROOT / 'Content/ParkComic/CrewGraphicNovelTripo/Resident9')
                   for p in root.rglob('*') if p.is_file() and '.fbm' not in str(p))
protected += [sources['provider_fbx'], ROOT / 'Scripts/prepare_tripo_surface.py']
before = {str(path): surface.digest(path) for path in protected}
valid = output / 'manifest.json'
valid.write_text(json.dumps(manifest, indent=2) + '\n')


def rejects(manifest_path, target, report):
    try:
        surface.source_plan(manifest_path, target, report)
    except AssertionError:
        return
    raise AssertionError('Invalid or overwriting surface plan was accepted')


tampered = output / 'tampered.json'
bad = json.loads(valid.read_text())
bad['provider_fbx']['sha256'] = '0' * 64
tampered.write_text(json.dumps(bad) + '\n')
rejects(tampered, output / 'tampered-body', output / 'tampered-report')
assert not (output / 'tampered-body').exists() and not (output / 'tampered-report').exists()
existing = output / 'existing-output'
existing.mkdir()
sentinel = existing / 'preserve.txt'
sentinel.write_text('existing output must remain unchanged\n')
sentinel_hash = surface.digest(sentinel)
rejects(valid, existing, output / 'must-not-create-report')
rejects(valid, output / 'must-not-create-body', existing)
assert surface.digest(sentinel) == sentinel_hash
assert not (output / 'must-not-create-report').exists() and not (output / 'must-not-create-body').exists()
correspondence_command = [shutil.which('blender') or 'blender', '-b', '-t', '4', '--python-exit-code', '1', '--python',
                          str(ROOT / 'Scripts/test_tripo_surface_correspondence.py')]
with (output / 'correspondence.log').open('w') as log:
    control = subprocess.run(correspondence_command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=30)
assert control.returncode == 0, output / 'correspondence.log'
body, report = output / 'body', output / 'report'
command = [shutil.which('blender') or 'blender', '-b', '-t', '4', '--python-exit-code', '1', '--python',
           str(ROOT / 'Scripts/prepare_tripo_cast_surface.py'), '--', '--manifest', str(valid), '--output', str(body), '--report', str(report)]
with (output / 'blender.log').open('w') as log:
    process = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=120)
assert process.returncode == 0, output / 'blender.log'
result = json.loads((report / 'Surface.json').read_text())
assert result['passed'] and result['retained_inputs_unchanged'] and not result['rescale_applied']
assert result['geometry']['triangles'] == 103544 and result['rig']['bones'] == 61
assert len(result['rig']['weighted_finger_bones']) == 30 and result['rig']['armature_object'] == 'Armature'
assert abs(result['native_import_scale_required'] - 1.82000084619) < 1e-5
assert result['correspondence']['provider_to_source_uniform_scale'] == result['native_import_scale_required']
assert result['correspondence']['source_residual_max_m'] < 2e-6 and not result['correspondence']['translation_or_rotation_fit']
assert result['correspondence']['residual_limit_m'] == 1e-5 and result['fresh_correspondence']['residual_limit_m'] == 2e-6
assert result['original_corner_normals']['explicit_limits'] == surface.NORMAL_LIMITS
for stage in ('after_blender_store', 'fresh_fbx_reimport'):
    assert all(result['original_corner_normals'][stage][key] < limit for key, limit in surface.NORMAL_LIMITS.items())
for role, row in result['textures'].items():
    assert surface.digest(Path(row['path'])) == row['sha256']
assert result['textures']['normal']['sha256'] == manifest['normal_png']['sha256']
assert result['normal_payload_selection']['external_png_bytes_equal_embedded_payload'] and not result['normal_payload_selection']['conversion_or_rebake_applied']
assert result['material']['base_color_and_normal_distinct'] and result['material']['packed_MR_native_wiring_required']
assert result['fresh_import_images']['normal']['sha256'] != result['fresh_import_images']['base_color']['sha256']
assert before == {path: surface.digest(Path(path)) for path in before}, 'Frozen pilot changed'
receipt = {'passed': True, 'finished_utc': datetime.now(timezone.utc).isoformat(), 'recipe_sha256': surface.digest(Path(__file__)),
           'command': command, 'process_exit_code': process.returncode,
           'source_recipe_sha256': surface.digest(ROOT / 'Scripts/prepare_tripo_cast_surface.py'),
           'correspondence_control': {'command': correspondence_command, 'exit_code': control.returncode,
               'recipe_sha256': surface.digest(ROOT / 'Scripts/test_tripo_surface_correspondence.py'),
               'log_sha256': surface.digest(output / 'correspondence.log')},
           'surface_receipt': {'path': str(report / 'Surface.json'), 'sha256': surface.digest(report / 'Surface.json')},
           'negative_controls': ['Tampered provider SHA rejected before writes', 'Existing output directory preserved', 'Existing report directory preserved',
                                 'Ambiguous coincident faces with differing normals rejected', 'Changed geometry rejected',
                                 '9.999micron residual accepted; 10.001micron and 20micron source geometry rejected'],
           'frozen_pilot_files_unchanged': before, 'no_api_render_native_gpu_service_operations': True}
(output / 'Test.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('TRIPO_CAST_SURFACE_REGRESSION_PASS', output, flush=True)
