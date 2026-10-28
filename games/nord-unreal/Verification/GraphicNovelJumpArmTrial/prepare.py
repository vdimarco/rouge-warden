"""Preparation only: write a pinned, isolated jump A/B under a NEW /tmp directory.

Does not import Blender, execute commands, touch retained sources or author UE assets.
Run with --check for a read-only static check; otherwise supply a new /tmp output path.
"""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path
import shutil

GAME = Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
SOURCE = GAME / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
HELPER = GAME / 'Scripts/prepare_meshy_jump.py'
BLENDER = '/home/von/.local/opt/blender-5.2.2-linux-x64/blender'
PINS = {
    'Scripts/prepare_meshy_jump.py': 'ed50ad1d4a09a9d6b71ee45c108a4f0e404b222ebfe311df3302929a6602aebd',
    'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.fbx': 'b7e7ca0d9c486412108cba85e1cd4a5512fecd4ad36b8cfdb4677259ff6f9244',
    'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/jump.fbx': '36d74356ca903188a9b3956db69e51367260866972cda9215fab6a66d5362aa3',
    'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/jump.json': '94deb47f51e5cbfd6e5694efb8dcb8052c2abf6c91df7ceee2a35def47838e3f',
}
EDITS = (
    ('(0.23, 0, -8, 16, -8, -95, 35, -5)', '(0.23, 0, -8, 16, -8, -60, 35, -5)'),
    ('(0.47, 0, -58, 100, -30, -110, 65, 10)', '(0.47, 0, -58, 100, -30, -70, 65, 10)'),
)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def poses(tree):
    return next(node for node in tree.body if isinstance(node, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == 'POSES' for t in node.targets))

def interpolate(rows, seconds):
    a, b = next((a, b) for a, b in zip(rows, rows[1:]) if a[0] <= seconds <= b[0])
    f = (seconds - a[0]) / (b[0] - a[0]); s = f * f * (3 - 2 * f)
    return [x + (y - x) * s for x, y in zip(a[1:], b[1:])]

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path, nargs='?')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
assert args.check != (args.output is not None), 'Choose --check OR a fresh /tmp output path'
before = {rel: sha(GAME / rel) for rel in PINS}
assert before == PINS, 'Retained source/helper changed: review pins before proceeding'
original = HELPER.read_text()
trial = original
for old, new in EDITS:
    assert trial.count(old) == 1 and new not in trial, old
    trial = trial.replace(old, new)
old_tree, new_tree = ast.parse(original), ast.parse(trial)
old_poses, new_poses = ast.literal_eval(poses(old_tree).value), ast.literal_eval(poses(new_tree).value)
expected_tree = copy.deepcopy(old_tree)
expected = poses(expected_tree).value
for row, angle in ((2, -60), (3, -70)):
    expected.elts[row].elts[5] = ast.UnaryOp(op=ast.USub(), operand=ast.Constant(value=-angle))
assert ast.dump(expected_tree) == ast.dump(new_tree), 'Non-arm source change'
assert [(i, j) for i, (a, b) in enumerate(zip(old_poses, new_poses))
        for j, (x, y) in enumerate(zip(a, b)) if x != y] == [(2, 5), (3, 5)]
for frame in range(37):
    a, b = interpolate(old_poses, frame / 30), interpolate(new_poses, frame / 30)
    assert a[:4] == b[:4] and a[5:] == b[5:], 'Non-arm interpolated channel change'
assert old_poses[0] == new_poses[0] and old_poses[-1] == new_poses[-1]
receipt = {
    'scope': 'preparation only; no Blender/UE run or art acceptance',
    'source_pins': PINS, 'only_changed_pose_fields': [[2, 5], [3, 5]],
    'arm_key_degrees': [{'seconds': .23, 'before': -95, 'trial': -60},
                        {'seconds': .47, 'before': -110, 'trial': -70}],
    'at_native_airborne_clip_time_0_42189': {
        'before_arm_degrees': interpolate(old_poses, .42189)[4],
        'trial_arm_degrees': interpolate(new_poses, .42189)[4],
        'unchanged_elbow_degrees': interpolate(old_poses, .42189)[5]},
    'static_checks_passed': True, 'authored_fbx': False, 'native_validated': False,
    'graphics_accepted': False,
}
if args.output:
    out = args.output.absolute()
    assert out.parent.resolve() == Path('/tmp') and out.name.startswith('nord-jump-arm-'), out
    assert not out.exists() and not out.is_symlink(), 'Output must be a NEW direct /tmp child'
    out.mkdir()
    (out / 'Scripts').mkdir()
    (out / 'Scripts/control_jump.py').write_text(original)
    (out / 'Scripts/trial_jump.py').write_text(trial)
    commands = {}
    for name in ('control', 'trial'):
        folder = out / name / 'CurlyMetalhead'; folder.mkdir(parents=True)
        shutil.copyfile(SOURCE / 'body.fbx', folder / 'body.fbx')
        assert sha(folder / 'body.fbx') == PINS[str((SOURCE / 'body.fbx').relative_to(GAME))]
        commands[name] = [BLENDER, '-t', '4', '--background', '--factory-startup',
            '--python-exit-code', '1', '--python', str(out / f'Scripts/{name}_jump.py'),
            '--', '--source-root', str(folder.parent), '--names', 'CurlyMetalhead',
            '--report', str(out / f'{name}-authoring.json')]
    shutil.copyfile(SOURCE / 'jump.fbx', out / 'retained-jump.fbx')
    shutil.copyfile(SOURCE / 'jump.json', out / 'retained-jump.json')
    receipt['commands_not_executed'] = commands
    receipt['trial_helper_sha256'] = sha(out / 'Scripts/trial_jump.py')
    (out / 'preparation.json').write_text(json.dumps(receipt, indent=2) + '\n')
assert {rel: sha(GAME / rel) for rel in PINS} == before, 'Retained input changed'
print(json.dumps(receipt, indent=2))
