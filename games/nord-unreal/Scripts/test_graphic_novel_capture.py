"""Check isolated capture routing and real graph-diagnostic sampling without Unreal."""
import ast
import copy
import json
import math
import hashlib
import tempfile
import traceback
from pathlib import Path
from types import SimpleNamespace

SOURCE = Path(__file__).with_name('capture_player_quality.py')
TREE = ast.parse(SOURCE.read_text())
ROOT = Path('/capture-fixture')


def selection(flags):
    nodes, active = [], False
    for node in TREE.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            if node.targets[0].id == 'NEUTRAL_CANDIDATE':
                active = True
            if node.targets[0].id == 'BUILD_EXPECTED':
                break
        if active and isinstance(node, (ast.Assign, ast.If, ast.Assert)):
            nodes.append(node)
    context = {'ROOT': ROOT, 'COMMAND_LINE': flags}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), 'exec'), context)
    return context


for flags, folder in (('', 'PlayerQuality'), ('-NordNeutralCandidate', 'NeutralCandidate')):
    result = selection(flags)
    assert result['OUT'] == ROOT / 'Preview' / (folder + '1280')
    assert result['VERIFY'] == ROOT / 'Verification' / folder
    assert len(result['STYLES']) == (1 if flags else 8)
for suffix in ('', ' -NordQuality1920', ' -NordGraphicNovelHeadless'):
    result = selection('-NordGraphicNovelCandidate' + suffix)
    assert result['OUT'].parent == ROOT / 'Saved/Tests/GraphicNovel/PilotCapture'
    assert result['VERIFY'] == result['OUT'].parent
    assert result['STYLES'] == (9,)
    assert result['CREW_PATH'] == '/Game/ParkComic/CrewGraphicNovel'
    assert len(result['BONES']) == 27
for suffix in ('', ' -NordQuality1920', ' -NordGraphicNovelHeadless'):
    result = selection('-NordGraphicNovelCandidate -NordGraphicNovelStandard' + suffix)
    assert result['OUT'].parent == ROOT / 'Saved/Tests/GraphicNovel/PilotCapture/Standard'
    assert result['VERIFY'] == result['OUT'].parent
    assert result['STYLES'] == (9,) and result['STANDARD']
for mode in ('', ' -NordGraphicNovelStandard'):
    result = selection('-NordGraphicNovelCandidate -NordGraphicNovelMotion -NordGraphicNovelHeadless' + mode)
    assert result['OUT'].parent == ROOT / 'Saved/Tests/GraphicNovel/PilotCapture/Motion' / ('Standard' if mode else 'Comic')
    assert result['VERIFY'] == result['OUT'].parent and result['MOTION'] and result['HEADLESS']
for mode in ('', ' -NordGraphicNovelStandard', ' -NordGraphicNovelMotion -NordGraphicNovelStandard'):
    result = selection('-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHeadless' + mode)
    expected = ROOT / 'Saved/Tests/GraphicNovel/GeneratedCapture'
    expected = expected / 'Motion/Standard' if result['MOTION'] else expected / 'Standard' if result['STANDARD'] else expected
    assert result['OUT'].parent == expected
    assert result['CREW_PATH'] == '/Game/ParkComic/CrewGraphicNovelGenerated'
    assert result['COMIC_PATH'] == '/Game/ParkComic/CrewGraphicNovel/Resident9/M_ComicInk.M_ComicInk'
    assert result['SOURCE'] == ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
    assert result['NAMES'][9] == 'generated-v1' and len(result['BONES']) == 7
for mode in ('', ' -NordGraphicNovelStandard', ' -NordGraphicNovelMotion -NordGraphicNovelStandard'):
    result = selection('-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail -NordGraphicNovelHeadless' + mode)
    expected = ROOT / 'Saved/Tests/GraphicNovel/HighDetailCapture'
    expected = expected / 'Motion/Standard' if result['MOTION'] else expected / 'Standard' if result['STANDARD'] else expected
    assert result['OUT'].parent == expected and result['GRAPHIC_NOVEL_HIGH_DETAIL']
    assert result['SOURCE'] == ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
    assert result['NAMES'][9] == 'generated-v2-high-detail' and len(result['BONES']) == 7
    assert result['CREW_PATH'] == '/Game/ParkComic/CrewGraphicNovelHighDetail'
    assert result['COMIC_PATH'] == '/Game/ParkComic/CrewGraphicNovel/Resident9/M_ComicInk.M_ComicInk'
assert not selection('-NordGraphicNovelHighDetailOther')['GRAPHIC_NOVEL_HIGH_DETAIL']
for flags in ('-NordNeutralCandidate -NordGraphicNovelCandidate', '-NordGraphicNovelHeadless', '-NordGraphicNovelStandard', '-NordGraphicNovelMotion', '-NordGraphicNovelGenerated',
              '-NordGraphicNovelHighDetail', '-NordGraphicNovelCandidate -NordGraphicNovelHighDetail', '-NordGraphicNovelGenerated -NordGraphicNovelHighDetail'):
    try:
        selection(flags)
    except AssertionError:
        pass
    else:
        raise AssertionError('Conflicting/unsafe fixture flags accepted')

bootstrap = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'restart_immersive_startup')
world = SimpleNamespace(get_path_name=lambda: '/Game/Maps/UEDPIE_0_LaFontaine.LaFontaine')
ended = []
bootstrap_context = {'MOTION': True, 'HEADLESS': False, 'COMMAND_LINE': '-immersive', 'STATE': {}, 'REPORT': {},
    'LEVELS': SimpleNamespace(editor_request_end_play=lambda: ended.append(True)),
    'u': SimpleNamespace(SystemLibrary=SimpleNamespace(is_standalone=lambda _: True),
        GameplayStatics=SimpleNamespace(get_current_level_name=lambda *_: 'LaFontaine',
            get_num_player_controllers=lambda _: 1, get_num_local_player_controllers=lambda _: 1), log=lambda _: None)}
exec(compile(ast.Module(body=[bootstrap], type_ignores=[]), str(SOURCE), 'exec'), bootstrap_context)
bootstrap_context['restart_immersive_startup']([world])
assert ended == [True] and bootstrap_context['STATE']['owns_pie']
for defect in ('second_restart', 'still', 'headless', 'missing_flag', 'multiple_worlds', 'networked', 'wrong_map', 'remote_player'):
    bootstrap_context.update(MOTION=True, HEADLESS=False, COMMAND_LINE='-immersive', STATE={})
    bootstrap_context['u'].SystemLibrary.is_standalone = lambda _: True
    gameplay = bootstrap_context['u'].GameplayStatics
    gameplay.get_current_level_name = lambda *_: 'LaFontaine'
    gameplay.get_num_player_controllers = lambda _: 1
    worlds = [world]
    if defect == 'second_restart': bootstrap_context['STATE']['immersive_restart_requested'] = True
    elif defect == 'still': bootstrap_context['MOTION'] = False
    elif defect == 'headless': bootstrap_context['HEADLESS'] = True
    elif defect == 'missing_flag': bootstrap_context['COMMAND_LINE'] = '-immersiveOther'
    elif defect == 'multiple_worlds': worlds *= 2
    elif defect == 'networked': bootstrap_context['u'].SystemLibrary.is_standalone = lambda _: False
    elif defect == 'wrong_map': gameplay.get_current_level_name = lambda *_: 'Other'
    elif defect == 'remote_player': gameplay.get_num_player_controllers = lambda _: 2
    try:
        bootstrap_context['restart_immersive_startup'](worlds)
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe immersive startup accepted: ' + defect)
assert ended == [True], 'A rejected session must never be ended'

calibrate = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'calibrate_motion_viewport')
rectangle_probe = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'native_viewport_rectangle')


def calibration_fixture():
    sample = {'now': 0., 'frame': 10, 'viewport': [1852, 960], 'origin': [34, 86],
              'extent': [1920, 1080], 'display': [2048, 1280]}
    commands, logs, moves = [], [], []

    def move_mouse(x, y):
        moves.append([x, y])
        sample['cursor'] = [sample['origin'][0] + x * sample['extent'][0] / 1920,
                            sample['origin'][1] + y * sample['extent'][1] / 1080]

    context = {'MOTION': True, 'HEADLESS': False, 'COMMAND_LINE': '-immersive',
        'WIDTH': 1920, 'HEIGHT': 1080, 'REPORT': {}, 'math': math, 'json': json,
        'STATE': {'owns_pie': True, 'world': world, 'pc': SimpleNamespace(get_viewport_size=lambda: sample['viewport'],
            get_mouse_position=lambda: (120, 80), set_mouse_location=move_mouse)},
        'time': SimpleNamespace(monotonic=lambda: sample['now']),
        'u': SimpleNamespace(SystemLibrary=SimpleNamespace(get_frame_count=lambda: sample['frame'],
                execute_console_command=lambda _, command, __: commands.append(command)),
            GameUserSettings=SimpleNamespace(get_game_user_settings=lambda: SimpleNamespace(
                get_desktop_resolution=lambda: SimpleNamespace(x=sample['display'][0], y=sample['display'][1]))),
            WidgetLayoutLibrary=SimpleNamespace(get_mouse_position_on_platform=lambda: SimpleNamespace(x=sample['cursor'][0], y=sample['cursor'][1])),
            log=logs.append)}
    context['mouse_moves'] = moves
    exec(compile(ast.Module(body=[rectangle_probe, calibrate], type_ignores=[]), str(SOURCE), 'exec'), context)
    return context, sample, commands, logs


context, sample, commands, logs = calibration_fixture()
assert not context['calibrate_motion_viewport']()
sample.update(now=.5, frame=12)
assert not context['calibrate_motion_viewport']() and len(commands) == 1
sample.update(now=1.1, frame=11)
assert not context['calibrate_motion_viewport']() and len(commands) == 1
sample['frame'] = 12
assert not context['calibrate_motion_viewport']()
assert commands == ['Editor.ResizeMainFrame 1920 1080', 'Editor.ResizeMainFrame 1988 1200']
sample.update(now=2.2, frame=14, viewport=[1920, 1080])
assert context['calibrate_motion_viewport']()
rectangle = json.loads(logs[0].split(' ', 1)[1])
assert rectangle == {'x': 34, 'y': 86, 'width': 1920, 'height': 1080, 'display_pixels': [2048, 1280]}
assert context['REPORT']['viewport_calibration']['passed'] and len(commands) == 2
assert context['mouse_moves'] == [[0, 0], [1919, 0], [0, 1079], [120, 80]]
assert len(context['REPORT']['viewport_calibration']['native_viewport_cursor_probes']) == 3
context, sample, commands, logs = calibration_fixture()
sample['viewport'] = [1920, 1080]
assert not context['calibrate_motion_viewport']()
sample.update(now=1.1, frame=12)
assert context['calibrate_motion_viewport']() and len(commands) == 1, 'Matching viewport needs no compensation'

for defect in ('still', 'headless', 'missing_flag', 'unowned', 'small_display', 'empty_viewport',
               'unfitting_chrome', 'wrong_final_size', 'negative_origin', 'offscreen', 'nan',
               'fractional_origin', 'scaled_native_geometry', 'empty_native_geometry', 'timeout'):
    context, sample, commands, logs = calibration_fixture()
    if defect == 'still': context['MOTION'] = False
    elif defect == 'headless': context['HEADLESS'] = True
    elif defect == 'missing_flag': context['COMMAND_LINE'] = '-immersiveOther'
    elif defect == 'unowned': context['STATE']['owns_pie'] = False
    elif defect == 'small_display': sample['display'] = [1280, 720]
    try:
        context['calibrate_motion_viewport']()
        sample.update(now=1.1, frame=12)
        if defect == 'empty_viewport': sample['viewport'] = [0, 0]
        elif defect == 'unfitting_chrome': sample['viewport'] = [1700, 800]
        elif defect == 'timeout': sample['now'] = 11
        context['calibrate_motion_viewport']()
        sample.update(now=2.2, frame=14, viewport=[1920, 1080])
        if defect == 'wrong_final_size': sample['viewport'] = [1852, 960]
        elif defect == 'negative_origin': sample['origin'] = [-1, 86]
        elif defect == 'offscreen': sample['origin'] = [129, 86]
        elif defect == 'nan': sample['origin'][0] = math.nan
        elif defect == 'fractional_origin': sample['origin'][0] = 34.5
        elif defect == 'scaled_native_geometry': sample['extent'] = [960, 540]
        elif defect == 'empty_native_geometry': sample['extent'] = [0, 0]
        context['calibrate_motion_viewport']()
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe recording geometry accepted: ' + defect)
    assert len(commands) <= 2 and not logs, 'Rejected geometry must not signal recording readiness'
    if context['mouse_moves']:
        assert context['mouse_moves'][-1] == [120, 80], 'Rejected probe must restore the private capture cursor'

functions = [node for node in TREE.body if isinstance(node, ast.FunctionDef)
             and node.name in ('animation_state', 'record_locomotion')]
asset = SimpleNamespace(get_name=lambda: 'A_Walk')
properties = {'observed_clip': asset, 'observed_clip_time': .37,
              **{'observed_' + kind + '_weight': 0. for kind in ('idle', 'walk', 'run', 'jump')}}
instance = SimpleNamespace(get_class=lambda: SimpleNamespace(get_path_name=lambda: '/Script/Quebec.QuebecCrewAnimInstance'),
                           get_editor_property=properties.__getitem__)
mesh = SimpleNamespace(get_anim_instance=lambda: instance,
    get_socket_transform=lambda *_: SimpleNamespace(translation=[1., 2., 3.]))
pawn = SimpleNamespace(get_velocity=lambda: SimpleNamespace(x=450., y=0.), get_actor_location=lambda: [4., 5., 6.])
state = {'pawn': pawn, 'mesh': mesh, 'character': {'locomotion_samples': {'Walk': [], 'Run': []}}}
context = {'math': __import__('math'), 'STATE': state, 'clock': lambda: 1., 'vec': lambda value: value,
           'u': SimpleNamespace(SystemLibrary=SimpleNamespace(get_frame_count=lambda: 42),
                                RelativeTransformSpace=SimpleNamespace(RTS_COMPONENT=0))}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(SOURCE), 'exec'), context)
for weight, count in ((.5, 0), (.99, 0), (.995, 1)):
    properties['observed_walk_weight'] = weight
    context['record_locomotion']('Walk')
    assert len(state['character']['locomotion_samples']['Walk']) == count
assert state['character']['locomotion_samples']['Walk'][0]['clip_time'] == .37
legacy = SimpleNamespace(get_anim_instance=lambda: SimpleNamespace(
    get_class=lambda: SimpleNamespace(get_path_name=lambda: '/Script/Engine.AnimSingleNodeInstance'),
    get_animation_asset=lambda: asset), get_position=lambda: .21)
assert context['animation_state'](legacy) == (asset, .21, None)

# An independent motion fixture must reject held real poses and altered world time.
motion = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'motion_tick')
motion_calls = {node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id
                for node in ast.walk(motion) if isinstance(node, ast.Call) and isinstance(node.func, (ast.Name, ast.Attribute))}
assert not motion_calls & {'freeze_and_capture', 'capture', 'aim', 'set_game_paused', 'set_global_time_dilation', 'execute_console_command'}
checks = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'transition_checks')
check_context = {'math': math, 'CREW_PATH': '/Game/ParkComic/CrewGraphicNovel', 'GRAPHIC_NOVEL_GENERATED': False}
exec(compile(ast.Module(body=[checks], type_ignores=[]), str(SOURCE), 'exec'), check_context)
rows = []
for index, name in enumerate(('idle', 'walk', 'sprint', 'turn', 'stop', 'jump', 'landing', 'recover')):
    kind = {'walk': 'Walk', 'sprint': 'Run', 'turn': 'Run', 'jump': 'Jump', 'landing': 'Jump'}.get(name, 'Idle')
    for step in (0, 1):
        rate = 2 if kind == 'Walk' else 800 / 600 if kind == 'Run' else 1
        rows.append({'phase': name, 'world_time': 1 + len(rows) * .1, 'wall_seconds': 2 + len(rows) * .1,
            'engine_frame': len(rows) + 10, 'paused': False, 'global_time_dilation': 1.,
            'clip': 'A_' + kind, 'clip_path': '/Game/ParkComic/CrewGraphicNovel/Resident9/A_' + kind,
            'clip_time': .1 + step * .1 * rate,
            'clip_weights': {key: float(key == kind) for key in ('Idle', 'Walk', 'Run', 'Jump')},
            'pilot_controls': {'finger_control_count': 20, 'finger_flex_degrees': 10 if kind == 'Run' else 4,
                               'eye_narrow_weight': .3 if kind == 'Run' else 0},
            'velocity_cm_s': [450 if name == 'walk' else 800 if name == 'sprint' else 0, 800 if name == 'turn' else 0, 0],
            'actor_yaw_degrees': 90 if name == 'turn' else 0, 'falling': name == 'jump',
            'location_cm': [0, 0, 180 if name == 'jump' else 0],
            'bones': {'LeftFoot': {'translation_cm': [step, 0, 0]},
                      'LeftLeg': {'rotation_xyzw': [math.sin(.4), 0, 0, math.cos(.4)] if name == 'jump' else [0, 0, 0, 1]}}})
lengths = {'Walk': 1., 'Run': 1.}
assert len(check_context['transition_checks'](rows, lengths)['phase_counts']) == 8
generated = copy.deepcopy(rows)
for row in generated:
    row['clip_path'] = row['clip_path'].replace('/CrewGraphicNovel/', '/CrewGraphicNovelGenerated/')
    row['pilot_controls'] = dict.fromkeys(('finger_control_count', 'finger_flex_degrees', 'eye_narrow_weight'), 0)
generated_context = {**check_context, 'CREW_PATH': '/Game/ParkComic/CrewGraphicNovelGenerated', 'GRAPHIC_NOVEL_GENERATED': True}
exec(compile(ast.Module(body=[checks], type_ignores=[]), str(SOURCE), 'exec'), generated_context)
assert len(generated_context['transition_checks'](generated, lengths)['phase_counts']) == 8
high_detail = copy.deepcopy(generated)
for row in high_detail:
    row['clip_path'] = row['clip_path'].replace('/CrewGraphicNovelGenerated/', '/CrewGraphicNovelHighDetail/')
high_context = {**generated_context, 'CREW_PATH': '/Game/ParkComic/CrewGraphicNovelHighDetail'}
exec(compile(ast.Module(body=[checks], type_ignores=[]), str(SOURCE), 'exec'), high_context)
assert len(high_context['transition_checks'](high_detail, lengths)['phase_counts']) == 8
for key in generated[0]['pilot_controls']:
    bad = copy.deepcopy(generated)
    bad[0]['pilot_controls'][key] = 1
    try:
        generated_context['transition_checks'](bad, lengths)
    except AssertionError:
        pass
    else:
        raise AssertionError('Body-only rig accepted nonexistent control: ' + key)
for defect in ('paused', 'slow', 'held_foot', 'held_clip', 'missing_turn', 'short_jump', 'wrong_clip'):
    bad = copy.deepcopy(rows)
    if defect == 'paused': bad[0]['paused'] = True
    elif defect == 'slow': bad[0]['global_time_dilation'] = .25
    elif defect == 'held_foot': bad[3]['bones']['LeftFoot'] = bad[2]['bones']['LeftFoot']
    elif defect == 'held_clip': bad[3]['clip_time'] = bad[2]['clip_time']
    elif defect == 'missing_turn': bad = [row for row in bad if row['phase'] != 'turn']
    elif defect == 'short_jump':
        for row in bad:
            if row['phase'] == 'jump': row['location_cm'][2] = 50
    elif defect == 'wrong_clip': bad[0]['clip_path'] = '/Game/ParkComic/Crew/Resident9/A_Idle'
    try:
        check_context['transition_checks'](bad, lengths)
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe motion observations accepted: ' + defect)
# Refined routing must validate the frozen paid source and preservation receipt.
provenance_node = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'generated_body_status')
game_root = SOURCE.parent.parent.resolve()
pilot_source = game_root / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
provenance = json.loads((pilot_source / 'refined-v1/body.json').read_text())
provenance_context = {'ROOT': game_root, 'SOURCE': pilot_source, 'json': json, 'hashlib': hashlib}
exec(compile(ast.Module(body=[provenance_node], type_ignores=[]), str(SOURCE), 'exec'), provenance_context)
imported = {'passed': True, 'body_source': provenance['output']}
status = provenance_context['generated_body_status'](imported)
assert status['body_sha256'] == provenance['output_sha256'] and not status['graphics_accepted']
for defect in ('native_failed', 'legacy_body', 'receipt_failed', 'body_hash', 'source_hash', 'source_path', 'mask_hash', 'preservation', 'fresh_reimport', 'uv_layers', 'corners'):
    receipt, native_receipt = copy.deepcopy(provenance), dict(imported)
    if defect == 'native_failed': native_receipt['passed'] = False
    elif defect == 'legacy_body': native_receipt['body_source'] = provenance['source']
    elif defect == 'receipt_failed': receipt['passed'] = False
    elif defect == 'body_hash': receipt['output_sha256'] = '0' * 64
    elif defect == 'source_hash': receipt['source_sha256'] = '0' * 64
    elif defect == 'source_path': receipt['source'] = receipt['output']
    elif defect == 'mask_hash': receipt['mask_sha256'] = '0' * 64
    elif defect == 'preservation': receipt['original_fbx_contents_identical_except_appended_uv1_layer'] = False
    elif defect == 'fresh_reimport': receipt['fresh_reimport_geometry_normals_uv0_weights_binds_identical'] = False
    elif defect == 'uv_layers': receipt['uv_layers'] = ['UVMap']
    elif defect == 'corners': receipt['changed_uv1_corners'] = 48
    provenance_context['json'] = SimpleNamespace(loads=lambda _, receipt=receipt: receipt)
    try:
        provenance_context['generated_body_status'](native_receipt)
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe refined provenance accepted: ' + defect)

# Raw high-detail provenance is independent of the refined UV1 source receipt.
high_node = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'high_detail_body_status')
high_manifest_node = next(node for node in TREE.body if isinstance(node, ast.Assign)
                          and any(isinstance(target, ast.Name) and target.id == 'MANIFEST' for target in node.targets))
high_folder = pilot_source / 'generated-v2-high-detail'
high_review = json.loads((high_folder / 'source-review.json').read_text())
high_jump = json.loads((high_folder / 'jump.json').read_text())
high_generation = json.loads((high_folder / 'generation.json').read_text())
for defect in (None, 'native_failed', 'wrong_native_body', 'generation_status', 'request_id',
               'source_changed', 'manifest_hash', 'body_hash', 'uv_channels', 'bones', 'controls',
               'clip_hierarchy', 'clip_bind', 'empty_clip', 'jump_roundtrip', 'jump_body',
               'jump_root_motion', 'source_file', 'missing_manifest_file', 'duplicate_manifest_file'):
    with tempfile.TemporaryDirectory(prefix='nord-high-detail-capture-') as directory:
        root = Path(directory)
        source = root / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
        folder = source / 'generated-v2-high-detail'
        folder.mkdir(parents=True)
        names = ('body.fbx', 'body.glb', 'idle.fbx', 'walk.fbx', 'run.fbx', 'jump.fbx',
                 'base_color.png', 'normal.png', 'roughness.png', 'metallic.png', 'reference.png')
        for name in names:
            (folder / name).write_bytes(('independent fixture: ' + name).encode())
        hashes = {name: hashlib.sha256((folder / name).read_bytes()).hexdigest() for name in names}
        jump, review, generation = copy.deepcopy(high_jump), copy.deepcopy(high_review), copy.deepcopy(high_generation)
        jump.update(body_sha256=hashes['body.fbx'], jump_sha256=hashes['jump.fbx'])
        review.update(body_sha256=hashes['body.fbx'], body_glb_sha256=hashes['body.glb'], uv_channels=1)
        generation['source_reference_sha256'] = hashes['reference.png']
        if defect == 'generation_status': generation['status'] = 'submitted'
        elif defect == 'request_id': generation['request_id'] = 'another-generation'
        elif defect == 'source_changed': review['source_unchanged'] = False
        elif defect == 'body_hash': review['body_sha256'] = '0' * 64
        elif defect == 'uv_channels': review['uv_channels'] = 2
        elif defect == 'bones': review['weighted_body_bones'] = 44
        elif defect == 'controls': review['finger_controls'] = True
        elif defect == 'clip_hierarchy': review['clips']['walk']['own_hierarchy_matches'] = False
        elif defect == 'clip_bind': review['clips']['run']['max_weighted_bind_error'] = .1
        elif defect == 'empty_clip': review['clips']['idle']['animation_curves'] = 0
        elif defect == 'jump_roundtrip': review['local_jump_round_trip_passed'] = False
        elif defect == 'jump_body': jump['body_sha256'] = '0' * 64
        elif defect == 'jump_root_motion': jump['actor_root_motion'] = True
        (folder / 'jump.json').write_text(json.dumps(jump))
        entries = [{'file': path.name, 'bytes': path.stat().st_size,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                   for path in sorted(folder.iterdir())]
        if defect == 'missing_manifest_file': entries = [row for row in entries if row['file'] != 'jump.fbx']
        elif defect == 'duplicate_manifest_file': entries.append(dict(entries[0]))
        (folder / 'files.json').write_text(json.dumps(entries))
        review['manifest_sha256'] = hashlib.sha256((folder / 'files.json').read_bytes()).hexdigest()
        if defect == 'manifest_hash': review['manifest_sha256'] = '0' * 64
        (folder / 'source-review.json').write_text(json.dumps(review))
        (folder / 'generation.json').write_text(json.dumps(generation))
        if defect == 'source_file': (folder / 'normal.png').write_bytes(b'changed')
        context = {'ROOT': root, 'SOURCE': source, 'Path': Path, 'json': json, 'hashlib': hashlib,
                   'GRAPHIC_NOVEL_HIGH_DETAIL': True, 'NAMES': {9: 'generated-v2-high-detail'}}
        exec(compile(ast.Module(body=[high_manifest_node, high_node], type_ignores=[]), str(SOURCE), 'exec'), context)
        assert context['MANIFEST']['generated-v2-high-detail/base_color.png'] == hashes['base_color.png']
        native = {'passed': defect != 'native_failed', 'body_source': str((folder / 'body.fbx').relative_to(root))}
        if defect == 'wrong_native_body': native['body_source'] = 'Data/GraphicNovel/Pilot/CurlyMetalhead/refined-v1/body.fbx'
        try:
            status = context['high_detail_body_status'](native)
        except AssertionError:
            assert defect is not None, 'Valid high-detail provenance rejected'
        else:
            assert defect is None, 'Unsafe high-detail provenance accepted: ' + str(defect)
            assert status['body_sha256'] == hashes['body.fbx'] and status['uv_channels'] == 1 and not status['graphics_accepted']

# The native resident Tick reverses the old one-time hide/collision request.
class FixtureComponent:
    def __init__(self, owner, path):
        self.owner, self.path, self.tick_enabled, self.ticks = owner, path, True, 0
    def get_owner(self): return self.owner
    def get_path_name(self): return self.path
    def set_component_tick_enabled(self, enabled): self.tick_enabled = enabled
    def is_component_tick_enabled(self): return self.tick_enabled
    def step(self): self.ticks += self.tick_enabled


class FixtureResident:
    def __init__(self, path):
        self.path, self.hidden, self.collision, self.tick_enabled = path, False, True, True
        self.components = [FixtureComponent(self, path + '.Mesh')]
    def get_path_name(self): return self.path
    def get_components_by_class(self, _): return self.components
    def get_editor_property(self, key):
        assert key == 'hidden'
        return self.hidden
    def set_actor_hidden_in_game(self, hidden): self.hidden = hidden
    def set_actor_enable_collision(self, enabled): self.collision = enabled
    def get_actor_enable_collision(self): return self.collision
    def set_actor_tick_enabled(self, enabled): self.tick_enabled = enabled
    def is_actor_tick_enabled(self): return self.tick_enabled
    def step(self):
        if self.tick_enabled: self.hidden, self.collision = False, True
        for component in self.components: component.step()


resident, car, foreign = (FixtureResident(path) for path in ('Resident0', 'Car0', 'Unrelated'))
resident.components.append(foreign.components[0])
actors = {'ParkResident': [resident], 'Car': [car]}
resident.set_actor_hidden_in_game(True)
resident.set_actor_enable_collision(False)
resident.step()
assert not resident.hidden and resident.collision and resident.components[0].ticks == 1
fixture_context = {'STATE': {'world': world}, 'REPORT': {}, 'u': SimpleNamespace(ActorComponent=object,
    load_class=lambda _, name: name.removeprefix('/Script/Quebec.Quebec'),
    GameplayStatics=SimpleNamespace(get_all_actors_of_class=lambda _, kind: actors[kind]))}
fixture_functions = [node for node in TREE.body if isinstance(node, ast.FunctionDef)
    and node.name in ('background_actors', 'owned_components', 'isolate_background_actors', 'verify_background_isolation')]
exec(compile(ast.Module(body=fixture_functions, type_ignores=[]), str(SOURCE), 'exec'), fixture_context)
fixture_context['isolate_background_actors'](world)
resident.step()
car.step()
assert resident.hidden and not resident.collision and resident.components[0].ticks == 1
assert not resident.tick_enabled and not resident.components[0].tick_enabled
assert foreign.tick_enabled and foreign.components[0].tick_enabled, 'Never disable foreign component ticks'
fixture_context['verify_background_isolation']('warm_up')
observed = fixture_context['REPORT']['fixture_isolation']['checkpoints'][-1]['observed']
assert observed['ParkResident'] == dict(actors=1, hidden=1, collision_disabled=1, actor_ticks_disabled=1, owned_components=1, component_ticks_disabled=1)
for defect in ('actor_tick', 'component_tick', 'unhidden', 'collision', 'new_component', 'new_actor'):
    fixture_context['isolate_background_actors'](world)
    if defect == 'actor_tick': resident.tick_enabled = True
    elif defect == 'component_tick': resident.components[0].tick_enabled = True
    elif defect == 'unhidden': resident.hidden = False
    elif defect == 'collision': resident.collision = True
    elif defect == 'new_component':
        component = FixtureComponent(resident, 'Resident0.New')
        component.tick_enabled = False
        resident.components.append(component)
    elif defect == 'new_actor': actors['ParkResident'].append(FixtureResident('Resident1'))
    try:
        fixture_context['verify_background_isolation']('completion')
    except AssertionError:
        assert not fixture_context['REPORT']['fixture_isolation']['checkpoints'][-1]['passed']
    else:
        raise AssertionError('Unsafe background isolation accepted: ' + defect)
    if defect == 'new_component': resident.components.pop()
    elif defect == 'new_actor': actors['ParkResident'].pop()
fixture_context['isolate_background_actors'](world)
fixture_context['verify_background_isolation']('completion')

# Completion isolation failures must fail the report and still end owned PIE/settings.
finish_node = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == 'finish')
cleanup = []
fixture_context['STATE'].update(finished=False, started=0, owns_pie=True, original_time_dilation=1., callback=123)
fixture_context['REPORT'].update(characters=[{}], screenshots=list(range(7)))
fixture_context.update(HEADLESS=False, MOTION=False, STYLES=(9,), WIDTH=1280,
    time=SimpleNamespace(monotonic=lambda: 1.), traceback=traceback, json=json,
    LEVELS=SimpleNamespace(editor_request_end_play=lambda: cleanup.append('end_pie')),
    ORIGINAL={'PlayNumberOfClients': 1}, ORIGINAL_MODE=0,
    SETTINGS=SimpleNamespace(set_editor_property=lambda *_: cleanup.append('setting')),
    SYSTEM=SimpleNamespace(call_method=lambda *_: cleanup.append('mode')),
    SCRIPT=SimpleNamespace(call_method=lambda *_: cleanup.append('keepalive')))
fixture_context['u'].GameplayStatics.set_game_paused = lambda *_: cleanup.append('unpause')
fixture_context['u'].GameplayStatics.set_global_time_dilation = lambda *_: cleanup.append('dilation')
fixture_context['u'].unregister_slate_post_tick_callback = lambda *_: cleanup.append('unregister')
fixture_context['u'].log_error = lambda *_: None
exec(compile(ast.Module(body=[finish_node], type_ignores=[]), str(SOURCE), 'exec'), fixture_context)
resident.components[0].tick_enabled = True
with tempfile.TemporaryDirectory() as directory:
    fixture_context['VERIFY'] = Path(directory)
    fixture_context['finish']()
    saved = json.loads((Path(directory) / 'PlayerQuality1280.json').read_text())
assert not saved['passed'] and saved['fixture_isolation']['completion_error']
assert cleanup == ['unpause', 'dilation', 'end_pie', 'setting', 'mode', 'unregister', 'keepalive']

# UV1 applies solely to the reviewed collar's base color; other maps retain UV0.
class TextureSample:
    def __init__(self, uv=None): self.uv, self.coordinate = uv, 0
    def get_editor_property(self, name):
        assert name == 'const_coordinate'
        return self.coordinate


class TextureCoordinate:
    def __init__(self, index): self.index = index
    def get_editor_property(self, name):
        assert name == 'coordinate_index'
        return self.index


base, normal_sample, rough, metal = TextureSample(TextureCoordinate(1)), TextureSample(), TextureSample(), TextureSample()
normal_values = {'const_alpha': 0.}
normal = SimpleNamespace(get_editor_property=normal_values.__getitem__)
normal_input = {'Alpha': None}
uv_context = {'u': SimpleNamespace(MaterialExpressionTextureSample=TextureSample, MaterialExpressionTextureCoordinate=TextureCoordinate,
    MaterialProperty=SimpleNamespace(MP_ROUGHNESS='rough', MP_METALLIC='metal'),
    MaterialEditingLibrary=SimpleNamespace(get_material_expression_input_names=lambda node: ['A', 'B', 'Alpha'] if node is normal else ['UVs'],
        get_inputs_for_material_expression=lambda _, node: [normal_sample, None, normal_input['Alpha']] if node is normal else [node.uv],
        get_material_property_input_node=lambda _, prop: {'rough': rough, 'metal': metal}[prop])),
    'GRAPHIC_NOVEL_HIGH_DETAIL': False}
uv_functions = [node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name in ('expression_inputs', 'generated_material_uvs')]
exec(compile(ast.Module(body=uv_functions, type_ignores=[]), str(SOURCE), 'exec'), uv_context)
assert uv_context['generated_material_uvs'](None, base, normal) == {'base_color': 1, 'normal': 0, 'roughness': 0, 'metallic': 0}
for sample in (base, normal_sample, rough, metal):
    previous = sample.uv
    sample.uv = None if sample is base else TextureCoordinate(1)
    try:
        uv_context['generated_material_uvs'](None, base, normal)
    except AssertionError:
        pass
    else:
        raise AssertionError('Wrong material UV channel accepted')
    sample.uv = previous

base.uv = None
uv_context['GRAPHIC_NOVEL_HIGH_DETAIL'] = True
assert uv_context['generated_material_uvs'](None, base, normal) == dict.fromkeys(('base_color', 'normal', 'roughness', 'metallic'), 0)
for sample in (base, normal_sample, rough, metal):
    sample.uv = TextureCoordinate(1)
    try:
        uv_context['generated_material_uvs'](None, base, normal)
    except AssertionError:
        pass
    else:
        raise AssertionError('High-detail accepted a UV1 texture map')
    sample.uv = None
for defect in ('attenuated_normal', 'connected_alpha'):
    normal_values['const_alpha'] = .35 if defect == 'attenuated_normal' else 0.
    normal_input['Alpha'] = object() if defect == 'connected_alpha' else None
    try:
        uv_context['generated_material_uvs'](None, base, normal)
    except AssertionError:
        pass
    else:
        raise AssertionError('High-detail accepted altered normal strength: ' + defect)

print('NORD_GRAPHIC_NOVEL_CAPTURE_CPU_OK isolated modes/motion, bounded viewport geometry, rejected flags, native transition failures, graph weights/times and legacy sampling')
