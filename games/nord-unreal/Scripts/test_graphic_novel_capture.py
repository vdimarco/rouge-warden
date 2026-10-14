"""Check isolated capture routing and real graph-diagnostic sampling without Unreal."""
import ast
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
for flags in ('-NordNeutralCandidate -NordGraphicNovelCandidate', '-NordGraphicNovelHeadless'):
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
print('NORD_GRAPHIC_NOVEL_CAPTURE_CPU_OK isolated routes, rejected flags, graph weights/times and legacy sampling')
