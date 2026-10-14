"""Add eight saved default-crew locomotion graphs; never reimport retained art.

Use a fresh -NullRHI /Engine/Maps/Entry editor. For a separate read-only process,
add -NordCrewLocomotionVerify -NordCrewLocomotionReceipt=/absolute/Author.json.
The existing native authoring function supplies the same graph as the pilot.
"""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shlex

STYLES = tuple(range(3, 11))
CREW = '/Game/ParkComic/Crew'
KINDS = ('Idle', 'Walk', 'Run', 'Jump')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def content_hashes(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted((root/'Content').rglob('*')) if p.is_file()}


def expected_files():
    return {f'Content/ParkComic/Crew/Resident{style}/BS_Locomotion.uasset' for style in STYLES}


def preserved(before, after):
    assert all(after.get(path) == digest for path, digest in before.items()), 'A retained Content file changed or disappeared'
    assert set(after)-set(before) == expected_files(), 'Only eight new default-crew BlendSpace packages are allowed'


def preflight(u, root, verify=False):
    flags = {a.lower().split('=', 1)[0] for a in shlex.split(u.SystemLibrary.get_command_line())}
    assert '-nullrhi' in flags, 'Use a fresh NullRHI authoring/verification process'
    assert not flags.intersection({'-nordgraphicnovelcandidate', '-nordgraphicnovelgenerated', '-nordgraphicnovelhighdetail', '-nordneutralcandidate'}), 'This route authors the eight default production styles only'
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'Do not attach to a running PIE session'
    world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    assert world.get_path_name() == '/Engine/Maps/Entry.Entry', 'Open the empty engine Entry map explicitly'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Preserve unsaved maps'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Preserve unsaved assets'
    assert all(getattr(u, name, None) for name in ('BlendSpace1D', 'BlendSpaceFactory1D', 'SkeletalMesh', 'AnimSequence', 'QuebecCrewAnimInstance'))
    assert callable(u.QuebecCrewAnimInstance.configure_crew_blend_space), 'Build the native crew authoring function first'
    tools = u.AssetToolsHelpers.get_asset_tools()
    assert tools, 'Missing asset tools'
    probe = u.BlendSpace1D()  # Transient reflection/API check, never a package.
    assert len(probe.get_editor_property('blend_parameters')) == len(probe.get_editor_property('interpolation_param')) == 3
    assert isinstance(probe.get_editor_property('interpolation_param')[0].get_editor_property('interpolation_type').value, int)
    probe.get_editor_property('scale_animation')
    probe.get_editor_property('sample_data')
    rows = []
    for style in STYLES:
        folder = f'{CREW}/Resident{style}'
        path = folder+'/BS_Locomotion'
        assert u.EditorAssetLibrary.does_asset_exist(path) == verify, ('Saved graph already exists' if not verify else 'Missing saved graph', style)
        mesh = u.load_asset(folder+'/SK_Body')
        assert isinstance(mesh, u.SkeletalMesh), ('Missing retained body', style)
        skeleton = mesh.get_editor_property('skeleton')
        assert skeleton and skeleton.get_path_name() == folder+'/SK_Body_Skeleton.SK_Body_Skeleton', ('Body must retain its own rig', style)
        clips = [u.load_asset(folder+'/A_'+kind) for kind in KINDS]
        for kind, clip in zip(KINDS, clips):
            assert isinstance(clip, u.AnimSequence) and clip.get_path_name() == folder+'/A_'+kind+'.A_'+kind, ('Missing own clip', style, kind)
            assert clip.get_editor_property('skeleton') == skeleton and clip.get_play_length() > .1, ('Wrong rig or empty own clip', style, kind)
            assert not clip.get_editor_property('enable_root_motion'), ('Own clip must disable root motion', style, kind)
        # Resolve factory properties for every character before the first create/save.
        factory = u.BlendSpaceFactory1D()
        factory.set_editor_property('target_skeleton', skeleton)
        rows.append({'style': style, 'folder': folder, 'path': path, 'skeleton': skeleton, 'clips': clips, 'factory': factory})
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages() and not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Prerequisite loads dirtied retained packages'
    assert len(rows) == 8
    return tools, rows


def graph_readback(u, space, row):
    assert isinstance(space, u.BlendSpace1D) and space.get_path_name() == row['path']+'.BS_Locomotion'
    assert space.get_editor_property('skeleton') == row['skeleton'], 'Saved graph must use the retained own rig'
    axes = space.get_editor_property('blend_parameters')
    filters = space.get_editor_property('interpolation_param')
    assert len(axes) == len(filters) == 3, 'Expected the native engine axis/filter arrays'
    axis, smoothing = axes[0], filters[0]
    axis_row = {name: axis.get_editor_property(name) for name in ('display_name', 'min', 'max', 'grid_num', 'snap_to_grid', 'wrap_input')}
    assert axis_row == {'display_name': 'Speed', 'min': 0., 'max': 800., 'grid_num': 16, 'snap_to_grid': False, 'wrap_input': False}, axis_row
    filter_time = smoothing.get_editor_property('interpolation_time')
    # EngineTypes.h: EFilterInterpolationType::BSIT_Linear == 1; Enum.value is the reflected numeric value.
    filter_type = smoothing.get_editor_property('interpolation_type').value
    assert math.isclose(filter_time, .12, abs_tol=1e-6) and filter_type == 1, 'Saved speed smoothing must be linear over .12 seconds'
    assert not space.get_editor_property('scale_animation'), 'Do not apply an additional speed-dependent cadence scale'
    assert space.get_editor_property('target_weight_interpolation_speed_per_sec') == 0., 'Do not add a second sample-weight filter'
    samples = space.get_editor_property('sample_data')
    assert len(samples) == 3, 'Exactly three own locomotion samples are required'
    result = []
    for sample, clip, speed, rate in zip(samples, row['clips'][:3], (0., 450., 800.), (1., 2., 800./600.)):
        point = sample.get_editor_property('sample_value')
        assert sample.get_editor_property('animation') == clip and (point.x, point.y, point.z) == (speed, 0., 0.), 'Own clip/sample order or speed differs'
        assert math.isclose(sample.get_editor_property('rate_scale'), rate, abs_tol=1e-6), 'Saved authored cadence differs'
        assert not sample.get_editor_property('mirror') and not sample.get_editor_property('use_single_frame_for_blending'), 'Use full unmirrored own clips'
        result.append({'clip': clip.get_path_name(), 'speed_cm_per_s': speed, 'rate_scale': rate})
    return {'style': row['style'], 'asset': space.get_path_name(), 'skeleton': row['skeleton'].get_path_name(),
            'axis': axis_row, 'smoothing_seconds': filter_time, 'smoothing_type': 'Linear', 'scale_animation': False, 'target_weight_interpolation_speed_per_sec': 0., 'samples': result,
            'own_jump': row['clips'][3].get_path_name()}


def run(u, root, verify=False, receipt_path=None):
    root = Path(root).resolve()
    tools, rows = preflight(u, root, verify)
    receipt = None
    if verify:
        assert receipt_path, 'Fresh verification requires the original author receipt'
        receipt_path = Path(receipt_path).resolve()
        assert receipt_path.is_relative_to(root/'Saved/Tests/CrewLocomotion'), 'Receipt must belong to this checkout QA directory'
        receipt = json.loads(receipt_path.read_text())
        assert receipt['passed'] and receipt['mode'] == 'author' and receipt['new_asset_count'] == 8
        baseline_path = receipt_path.with_name('original-content.json')
        assert sha(baseline_path) == receipt['original_content_sha256'], 'Original Content snapshot changed'
        before = json.loads(baseline_path.read_text())
        preserved(before, content_hashes(root))
        assert set(receipt['new_asset_sha256']) == expected_files(), 'Incomplete author graph hash inventory'
        assert all(sha(root/path) == digest for path, digest in receipt['new_asset_sha256'].items()), 'Saved authored graphs changed before fresh readback'
    else:
        before = content_hashes(root)
        assert not set(before).intersection(expected_files()), 'Never replace an existing graph package'
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    output = root/'Saved/Tests/CrewLocomotion'/stamp
    output.mkdir(parents=True, exist_ok=False)
    report = {'passed': False, 'mode': 'verify' if verify else 'author', 'map': '/Engine/Maps/Entry', 'characters': [],
              'limits': ['Native playback/pose and rendered/FPS acceptance are separate checks; this readback proves saved assets only.']}
    if not verify:
        baseline_path = output/'original-content.json'
        baseline_path.write_text(json.dumps(before, indent=2)+'\n')
        report['original_content_sha256'] = sha(baseline_path)
    else:
        report['author_receipt'] = str(receipt_path.relative_to(root))
    try:
        for row in rows:
            if verify:
                space = u.load_asset(row['path'])
            else:
                space = tools.create_asset('BS_Locomotion', row['folder'], u.BlendSpace1D, row['factory'])
                assert isinstance(space, u.BlendSpace1D), 'Native BlendSpace factory failed'
                assert u.QuebecCrewAnimInstance.configure_crew_blend_space(space, *row['clips'][:3]), 'Native graph authoring rejected own rig/clips'
                graph_readback(u, space, row)
                assert u.EditorAssetLibrary.save_loaded_asset(space, only_if_is_dirty=False), 'Failed to save the new graph'
            report['characters'].append(graph_readback(u, space, row))
        after = content_hashes(root)
        preserved(before, after)
        assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages() and not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Unexpected dirty package after bounded graph operation'
        report.update(passed=True, original_content_files_preserved=len(before), new_asset_count=8,
                      new_asset_sha256={path: after[path] for path in sorted(expected_files())},
                      fresh_process_readback=verify)
    except Exception as error:
        report['error'] = repr(error)
        raise
    finally:
        path = output/('Verify.json' if verify else 'Author.json')
        path.write_text(json.dumps(report, indent=2)+'\n')
        u.log('NORD_CREW_LOCOMOTION_'+('OK ' if report['passed'] else 'FAILED ')+str(path))
    return report


def main():
    import unreal as u
    args = shlex.split(u.SystemLibrary.get_command_line())
    verify = '-nordcrewlocomotionverify' in {a.lower() for a in args}
    receipts = [a.split('=', 1)[1] for a in args if a.lower().startswith('-nordcrewlocomotionreceipt=')]
    assert len(receipts) == int(verify), 'Pass one author receipt only for fresh verification'
    run(u, Path(u.Paths.project_dir()), verify, receipts[0] if receipts else None)


if __name__ == '__main__':
    main()
