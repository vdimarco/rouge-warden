"""Private A_Jump-only diagnostic; root alone runs fresh NullRHI author/readback.

Load /Engine/Maps/Entry, pass the three existing graphic-novel opt-in flags and
-NordPrivateJumpTrialBackup=<fresh Saved/Recovery path>. A separate process adds
-NordPrivateJumpTrialVerify. No historical source/import receipt is rewritten.
The original full Content copy is retained for root-owned restoration after QA.
"""
import hashlib
import json
import math
from pathlib import Path
import shlex
import shutil

PLAN = Path(__file__).resolve().parent
CPU = PLAN/'CPUAuthoring-20261017T142247Z'
TRIAL = CPU/'trial/CurlyMetalhead/jump.fbx'
SOURCE = Path('Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail')
FOLDER = '/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9'
TARGET = 'Content/ParkComic/CrewGraphicNovelHighDetail/Resident9/A_Jump.uasset'
ENTRY = '/Engine/Maps/Entry.Entry'
TRIAL_SHA = 'e35071099841d099eea5dda9de96a31b10cd07c4dfe73543bfee42f395c4833e'
ORIGINAL_SHA = '1e62a9debd7aec41beac0466ac6a5114741ce79de6bce102f6cdbe5d3cd52f26'
RAW_JUMP_SHA = '36d74356ca903188a9b3956db69e51367260866972cda9215fab6a66d5362aa3'
CPU_SHA = '15bf5c7fb878fcd2b792482ff24535cd684d718bb79d09ce4e35cc50d8333c8f'
SEMANTIC_SHA = '5c3616f84bd814d2fae3ec1208131383285cdccb4c70ec53866fe9cef84cf006'
IMPORT_RECEIPT = Path('Verification/GraphicNovelHighDetailPilot/NativeImport.json')
IMPORT_RECEIPT_SHA = '90374db5083e6115513032f74c6f8c7b31a45c5226bf1800bf91fae6ab3c88ca'
PROPS = ('enable_root_motion', 'force_root_lock', 'root_motion_root_lock',
         'use_normalized_root_motion_scale', 'rate_scale', 'interpolation')
TOL = {'translation_cm': .001, 'scale': .00001, 'rotation_radians': .0001}
ARMS = {'LeftArm', 'RightArm'}


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def ref(obj): return obj.get_path_name() if obj else None
def write(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2, allow_nan=False); stream.write('\n')


def content(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted((root/'Content').rglob('*')) if p.is_file()}


def cpu_gate(root):
    assert sha(CPU/'results.json') == CPU_SHA and sha(CPU/'semantic-comparison.json') == SEMANTIC_SHA, 'CPU gate receipt changed'
    gate = json.loads((CPU/'results.json').read_text())
    assert gate['passed'] and gate['comparison_process_exit_code'] == 0 and gate['authoring_process_exit_codes'] == {'control': 0, 'trial': 0}
    assert gate['all_retained_source_files_unchanged'] and gate['neutral_endpoints_passed'] and gate['object_root_static']
    assert gate['sample_count_per_clip'] == 37 and gate['bone_count_per_clip'] == 24 and gate['fps'] == 30 and gate['seconds'] == 1.2
    for row in gate['artifact_manifest']:
        path = (CPU/row['file']).resolve()
        assert path.is_relative_to(CPU.resolve()) and path.stat().st_size == row['bytes'] and sha(path) == row['sha256'], 'CPU artifact changed'
    old = json.loads((CPU/'cpu-preflight.json').read_text())['source_baseline']
    actual = {str(p.relative_to(root)): sha(p) for p in sorted((root/SOURCE).rglob('*')) if p.is_file()}
    assert len(actual) == 23 and actual == old, 'Retained source changed'
    assert sha(TRIAL) == TRIAL_SHA and sha(root/IMPORT_RECEIPT) == IMPORT_RECEIPT_SHA
    semantic = json.loads((CPU/'semantic-comparison.json').read_text())
    assert semantic['passed'] and semantic['all_inputs_unchanged'] and semantic['inputs_before'] == semantic['inputs_after']
    names = semantic['clips']['retained']['bones']
    assert len(names) == len(set(names)) == 24 and ARMS <= set(names)
    pins = {**actual, str(IMPORT_RECEIPT): IMPORT_RECEIPT_SHA,
            'Scripts/import_meshy_crew.py': sha(root/'Scripts/import_meshy_crew.py'),
            str(Path(__file__).resolve()): sha(__file__), str(CPU/'results.json'): CPU_SHA,
            str(CPU/'semantic-comparison.json'): SEMANTIC_SHA, str(TRIAL): TRIAL_SHA}
    return names, pins


def private_route(u, root):
    assert Path(u.Paths.project_dir()).resolve() == root, 'Wrong project'
    args = set(shlex.split(u.SystemLibrary.get_command_line()))
    assert {'-NordGraphicNovelCandidate', '-NordGraphicNovelGenerated', '-NordGraphicNovelHighDetail'} <= args, 'Three private opt-in flags required'


def offline(u, root):
    private_route(u, root)
    assert '-nullrhi' in {a.lower() for a in shlex.split(u.SystemLibrary.get_command_line())}, 'Use a fresh NullRHI process'
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'PIE must be stopped'
    assert u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world().get_path_name() == ENTRY, 'Use only the Entry world'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages() and not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Fresh clean packages required'


def transform(t):
    value = {'translation': [t.translation.x, t.translation.y, t.translation.z],
             'scale': [t.scale3d.x, t.scale3d.y, t.scale3d.z],
             'rotation': [t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w]}
    assert all(math.isfinite(x) for row in value.values() for x in row), 'Nonfinite native bone pose'
    return value


def angle(a, b):
    def normalize(q):
        size = math.sqrt(sum(v*v for v in q)); assert math.isfinite(size) and size > 1e-12
        return [v/size for v in q]
    a, b = normalize(a), normalize(b)
    distance = min(math.dist(a, b), math.dist(a, [-v for v in b]))
    return 4*math.asin(min(1., distance/2))


def difference(a, b):
    return {'translation_cm': max(abs(x-y) for x, y in zip(a['translation'], b['translation'])),
            'scale': max(abs(x-y) for x, y in zip(a['scale'], b['scale'])),
            'rotation_radians': angle(a['rotation'], b['rotation'])}


def pose_snapshot(u, clip, body, names):
    assert sorted(map(str, u.AnimationLibrary.get_animation_track_names(clip))) == sorted(names), 'Native clip tracks changed'
    api = u.AnimPoseExtensions
    options = u.AnimPoseEvaluationOptions()
    options.set_editor_property('evaluation_type', u.AnimDataEvalType.RAW)
    options.set_editor_property('should_retarget', False)
    options.set_editor_property('extract_root_motion', False)
    options.set_editor_property('optional_skeletal_mesh', body)
    reference = api.get_reference_pose(body.get_editor_property('skeleton'))
    assert api.is_valid(reference) and set(names) <= set(map(str, api.get_bone_names(reference)))
    refs = {name: transform(api.get_bone_pose(reference, name, u.AnimPoseSpaces.LOCAL)) for name in names}
    samples = []
    for frame in range(37):
        pose = api.get_anim_pose_at_time(clip, frame/30., options)
        assert api.is_valid(pose) and set(names) <= set(map(str, api.get_bone_names(pose)))
        samples.append({'seconds': frame/30., 'bones': {name: transform(api.get_bone_pose(pose, name, u.AnimPoseSpaces.LOCAL)) for name in names}})
    for sample in (samples[0], samples[-1]):
        for name in names:
            assert all(v <= TOL[k] for k, v in difference(sample['bones'][name], refs[name]).items()), ('Nonneutral native endpoint', name)
    return {'evaluation': 'RAW local, no retarget/root extraction, actual own body', 'names': names, 'reference_pose': refs, 'samples': samples}


def compare_poses(before, after, allow_arms=True):
    assert before['names'] == after['names'] and len(before['samples']) == len(after['samples']) == 37
    maxima = {key: 0. for key in TOL}; arms = {name: 0. for name in ARMS}
    for name in before['names']:
        assert all(v <= TOL[k] for k, v in difference(before['reference_pose'][name], after['reference_pose'][name]).items()), 'Native reference pose changed'
    for a, b in zip(before['samples'], after['samples']):
        assert a['seconds'] == b['seconds']
        for name in before['names']:
            delta = difference(a['bones'][name], b['bones'][name])
            for key, value in delta.items():
                if allow_arms and name in ARMS and key == 'rotation_radians':
                    arms[name] = max(arms[name], value)
                else:
                    assert value <= TOL[key], ('Unexpected native local pose change', name, key, value)
                    maxima[key] = max(maxima[key], value)
    if allow_arms: assert all(value > .01 for value in arms.values()), 'Expected upper-arm change absent'
    return {'passed': True, 'sample_frames': 37, 'bones': len(before['names']), 'tolerances': TOL,
            'unchanged_field_maxima': maxima, 'allowed_arm_rotation_max_radians': arms}


def metadata(u, clip, body):
    assert isinstance(body, u.SkeletalMesh) and ref(body) == FOLDER+'/SK_Body.SK_Body'
    assert isinstance(clip, u.AnimSequence) and ref(clip) == FOLDER+'/A_Jump.A_Jump'
    assert ref(clip.get_editor_property('skeleton')) == ref(body.get_editor_property('skeleton')), 'Wrong own skeleton'
    frames, keys = u.AnimationLibrary.get_num_frames(clip), u.AnimationLibrary.get_num_keys(clip)
    rate = clip.get_editor_property('platform_target_frame_rate').get_editor_property('default')
    numerator, denominator = rate.get_editor_property('numerator'), rate.get_editor_property('denominator')
    seconds = clip.get_play_length()
    assert frames == 36 and keys == 37 and numerator == 30 and denominator == 1 and abs(seconds-1.2) < .000001
    flags = {key: clip.get_editor_property(key) for key in PROPS}
    assert flags['enable_root_motion'] is False and flags['force_root_lock'] is False and flags['rate_scale'] == 1.
    data = clip.get_editor_property('asset_import_data'); assert data
    paths = [Path(p).resolve() for p in data.extract_filenames()]
    assert len(paths) == 1 and paths[0].is_file(), 'Missing native saved import source'
    return {'asset': ref(clip), 'class': clip.get_class().get_path_name(), 'skeleton': ref(body.get_editor_property('skeleton')),
            'seconds': seconds, 'frames': frames, 'keys': keys, 'sample_rate': [numerator, denominator],
            'flags': {k: v if isinstance(v, (bool, int, float)) else str(v) for k, v in flags.items()},
            'source': str(paths[0]), 'source_sha256': sha(paths[0])}, flags


def delta(before, after):
    assert set(after) == set(before), 'Content inventory changed'
    changed = sorted(p for p in before if before[p] != after[p])
    allowed = {str(Path(TARGET).with_suffix(s)) for s in ('.uasset', '.uexp', '.ubulk')}
    assert TARGET in changed and set(changed) <= allowed, 'Only the existing private A_Jump package may change'
    return changed


def preflight(u, root, backup):
    offline(u, root)
    assert (root/'Saved/Recovery').resolve() in backup.parents and not backup.exists(), 'Fresh recovery directory required'
    names, sources = cpu_gate(root)
    assert sha(root/TARGET) == ORIGINAL_SHA, 'Private baseline A_Jump changed'
    required = ('AnimSequence', 'SkeletalMesh', 'AssetImportTask', 'FbxImportUI', 'FbxFactory', 'FBXImportType',
                'AssetToolsHelpers', 'AnimationLibrary', 'AnimPoseExtensions', 'AnimPoseEvaluationOptions', 'AnimDataEvalType', 'AnimPoseSpaces')
    assert all(getattr(u, name, None) is not None for name in required), 'Missing native API'
    for obj, methods in ((u.AnimationLibrary, ('get_num_frames','get_num_keys','get_animation_track_names')),
                         (u.AnimPoseExtensions, ('get_anim_pose_at_time','get_reference_pose','get_bone_names','get_bone_pose','is_valid'))):
        assert all(callable(getattr(obj, method, None)) for method in methods), 'Missing native pose/readback API'
    assert u.AssetToolsHelpers.get_asset_tools()
    body, clip = u.load_asset(FOLDER+'/SK_Body'), u.load_asset(FOLDER+'/A_Jump')
    meta, flags = metadata(u, clip, body)
    assert meta['source_sha256'] == RAW_JUMP_SHA, 'Native baseline source is not retained original jump'
    poses = pose_snapshot(u, clip, body, names)
    baseline = content(root)
    assert baseline[TARGET] == ORIGINAL_SHA
    return body, clip, meta, flags, poses, baseline, sources


def seal(backup):
    manifest = json.loads((backup/'backup-manifest.json').read_text())
    assert all(sha(backup/p) == digest for p, digest in manifest.items()), 'Sealed backup changed'
    return sha(backup/'backup-manifest.json')


def readback(u, root, backup):
    """Read-only guard reusable once by an explicitly private rendered wrapper."""
    private_route(u, root)
    assert (root/'Saved/Recovery').resolve() in backup.parents
    receipt = json.loads((backup/'trial-receipt.json').read_text()); assert receipt['passed']
    assert seal(backup) == receipt['backup_manifest_sha256']
    names, sources = cpu_gate(root); assert sources == receipt['source_pins'], 'Trial source/helper pins changed'
    before = json.loads((backup/'original-content.json').read_text()); after = content(root)
    changed = delta(before, after)
    assert {p: after[p] for p in changed} == receipt['changed_content_sha256'], 'Native trial bytes changed'
    body, clip = u.load_asset(FOLDER+'/SK_Body'), u.load_asset(FOLDER+'/A_Jump')
    meta, _ = metadata(u, clip, body); assert meta == receipt['trial_metadata'], 'Native trial metadata changed'
    assert meta['source'] == str(TRIAL.resolve()) and meta['source_sha256'] == TRIAL_SHA
    poses = pose_snapshot(u, clip, body, names)
    original = json.loads((backup/'original-native.json').read_text())
    gate = compare_poses(original['poses'], poses)
    compare_poses(receipt['trial_poses'], poses, allow_arms=False)
    return {'passed': True, 'trial_receipt_sha256': sha(backup/'trial-receipt.json'), 'changed_content': changed,
            'metadata': meta, 'native_pose_gate': gate, 'cpu_gate_sha256': CPU_SHA,
            'graphics_accepted': False, 'adopted': False, 'restore_required': True}


def verify(u, root, backup):
    offline(u, root)
    return readback(u, root, backup)


def author(u, root, backup):
    body, clip, meta, flags, poses, baseline, sources = preflight(u, root, backup)
    backup.mkdir(parents=True, exist_ok=False)
    # Full byte copy, not just a hash table: root can restore the exact original
    # target package after the private A/B. No authoring starts until all seals pass.
    for relative in baseline:
        target = backup/relative; target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root/relative, target); assert sha(target) == baseline[relative]
    write(backup/'original-content.json', baseline)
    write(backup/'original-native.json', {'metadata': meta, 'poses': poses})
    manifest = {p: sha(backup/p) for p in [*baseline, 'original-content.json', 'original-native.json']}
    write(backup/'backup-manifest.json', manifest)
    receipt = {'passed': False, 'scope': 'Private jump-only native arm diagnostic; no adoption/graphics acceptance',
               'backup_manifest_sha256': seal(backup), 'source_pins': sources,
               'baseline_metadata': meta, 'graphics_accepted': False, 'adopted': False, 'restore_required': True}
    assert content(root) == baseline and cpu_gate(root)[1] == sources, 'Inputs changed during backup'
    try:
        u.SystemLibrary.execute_console_command(None, 'Interchange.FeatureFlags.Import.FBX 0')
        options = u.FbxImportUI(); options.automated_import_should_detect_type = False
        options.mesh_type_to_import = u.FBXImportType.FBXIT_ANIMATION
        options.import_as_skeletal, options.import_mesh, options.import_animations = True, False, True
        options.import_materials, options.import_textures = False, False
        options.skeleton = body.get_editor_property('skeleton')
        options.anim_sequence_import_data.force_front_x_axis = True
        options.anim_sequence_import_data.convert_scene = True; options.anim_sequence_import_data.convert_scene_unit = True
        options.anim_sequence_import_data.set_editor_property('use_default_sample_rate', True)
        task = u.AssetImportTask(); task.filename = str(TRIAL.resolve()); task.destination_path = FOLDER; task.destination_name = 'A_Jump'
        task.automated, task.replace_existing, task.save = True, True, False
        task.options, task.factory = options, u.FbxFactory()
        u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        assert list(task.imported_object_paths) == [FOLDER+'/A_Jump.A_Jump'], 'Unexpected imported objects'
        trial = u.load_asset(FOLDER+'/A_Jump')
        for key, value in flags.items(): trial.set_editor_property(key, value)
        trial_meta, _ = metadata(u, trial, body)
        assert trial_meta['source'] == str(TRIAL.resolve()) and trial_meta['source_sha256'] == TRIAL_SHA
        assert all(trial_meta[k] == meta[k] for k in ('asset','class','skeleton','seconds','frames','keys','sample_rate','flags'))
        trial_poses = pose_snapshot(u, trial, body, poses['names'])
        receipt['native_pose_gate'] = compare_poses(poses, trial_poses)
        assert u.EditorAssetLibrary.save_loaded_asset(trial, only_if_is_dirty=False)
        after = content(root); changed = delta(baseline, after)
        assert cpu_gate(root)[1] == sources, 'Source/helper changed during authoring'
        receipt.update(passed=True, trial_metadata=trial_meta, trial_poses=trial_poses,
                       changed_content_sha256={p: after[p] for p in changed}, original_content_count=len(baseline))
    except Exception as error:
        receipt['error'] = repr(error); raise
    finally:
        write(backup/'trial-receipt.json', receipt)
    return receipt


def main():
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    args = shlex.split(u.SystemLibrary.get_command_line())
    values = [a.split('=', 1)[1] for a in args if a.startswith('-NordPrivateJumpTrialBackup=')]
    assert len(values) == 1
    backup = Path(values[0]).resolve()
    if '-NordPrivateJumpTrialVerify' in args:
        result = verify(u, root, backup); write(backup/'fresh-verify.json', result)
    else:
        result = author(u, root, backup)
    u.log('NORD_PRIVATE_JUMP_NATIVE_OK '+json.dumps({'passed': result['passed'], 'backup': str(backup),
        'native_pose_gate': result['native_pose_gate'], 'graphics_accepted': False, 'restore_required': True}))


if __name__ == '__main__': main()
