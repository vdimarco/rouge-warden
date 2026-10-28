"""Verify checkpoint receipts/artifacts; does not run Blender, Unreal or services."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text())

for folder in ('CPU', 'Native', 'Headless', 'ReferenceHeadless'):
    base = HERE/folder
    manifest = read(base/'CurationManifest.json')
    for row in manifest['files']:
        path = (base/row['file']).resolve()
        assert path.is_relative_to(base.resolve()) and path.is_file(), row['file']
        assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256'], path

cpu = read(HERE/'CPU/results.json')
assert all(cpu[key] for key in ('passed', 'neutral_endpoints_passed', 'object_root_static', 'all_retained_source_files_unchanged'))
assert (cpu['sample_count_per_clip'], cpu['bone_count_per_clip'], cpu['fps'], cpu['seconds']) == (37, 24, 30, 1.2)
assert cpu['comparison_process_exit_code'] == 0 and cpu['authoring_process_exit_codes'] == {'control': 0, 'trial': 0}
for row in cpu['artifact_manifest']:
    path = (HERE/'CPU'/row['file']).resolve()
    assert path.is_relative_to((HERE/'CPU').resolve()) and sha(path) == row['sha256']
raw = read(HERE/'CPU/cpu-preflight.json')['source_baseline']
source = ROOT/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
assert len(raw) == 23 and {str(p.relative_to(ROOT)): sha(p) for p in source.rglob('*') if p.is_file()} == raw
semantic = read(HERE/'CPU/semantic-comparison.json')
assert semantic['passed'] and semantic['all_inputs_unchanged'] and semantic['inputs_before'] == semantic['inputs_after']
rotations = semantic['control_vs_trial']['allowed_rotation_max_radians']
assert set(rotations) == {'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'} and all(value > .01 for value in rotations.values())

for name in ('Author', 'FreshVerify', 'RestoredOriginal'):
    assert read(HERE/'Native'/f'{name}.json')['passed']
failure = read(HERE/'Native/FailedVulkanWindow.json')
assert not failure['passed'] and failure['restored'] and failure['preserved_units_unchanged']
for folder in ('Headless', 'ReferenceHeadless'):
    report = read(HERE/folder/'Gameplay.json')
    restore = read(HERE/folder/'Restoration.json')
    assert report['passed'] and report['headless'] and report['screenshots'] == []
    assert report['headless_compound']['seven_state_prop_readbacks_passed'] and report['headless_compound']['prop_restored']
    assert all(restore[key] for key in ('passed', 'content_restored', 'saves_unchanged', 'source_unchanged', 'services_unchanged', 'turn_unchanged', 'settings_restored'))
print('PASS: retained source, four-track CPU proof, native import, both headless checks, failed-render restoration and curated artifact hashes. No graphics acceptance.')
