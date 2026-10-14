"""Check isolated capture routing and real graph-diagnostic sampling without Unreal."""
import ast
import copy
import math
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
for flags in ('-NordNeutralCandidate -NordGraphicNovelCandidate', '-NordGraphicNovelHeadless', '-NordGraphicNovelStandard', '-NordGraphicNovelMotion'):
    try:
        selection(flags)
    except AssertionError:
        pass
    else:
        raise AssertionError('Conflicting/unsafe fixture flags accepted')

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
check_context = {'math': math, 'CREW_PATH': '/Game/ParkComic/CrewGraphicNovel'}
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
print('NORD_GRAPHIC_NOVEL_CAPTURE_CPU_OK isolated modes/motion, rejected flags, native transition failures, graph weights/times and legacy sampling')
