"""Blender CPU regression: exported elbows flex forward on copied retained rigs.

blender -t 4 --background --factory-startup --python-exit-code 1 --python this_file
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[1]
AUTHOR = ROOT/'Scripts/prepare_meshy_jump.py'
PILOT = ROOT/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
NAMES = ('GreenCap51', 'Memphis33', 'BlackCap', 'WhiteCap', 'RedJersey', 'LimeJacket', 'CurlyMetalhead', 'Topknot')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = AUTHOR.read_text()
assert bpy.app.background
inputs = [ROOT/'Data/CharactersMeshy'/name/'body.fbx' for name in NAMES]
inputs += [p for p in PILOT.rglob('*') if p.is_file()]
before = {str(p): sha(p) for p in inputs}
old_argv = sys.argv

def author(directory, bodies, text=source):
    for name, body in bodies.items():
        destination = directory/name/'body.fbx'
        destination.parent.mkdir(parents=True)
        shutil.copy2(body, destination)
    report = directory/'result.json'
    sys.argv = [str(AUTHOR), '--', '--source-root', str(directory), '--names', *bodies, '--report', str(report)]
    exec(compile(text, str(AUTHOR), 'exec'), {'__file__': str(AUTHOR), '__name__': '__main__'})
    result = json.loads(report.read_text())
    assert result['passed'] and len(result['characters']) == len(bodies)
    for row in result['characters']:
        receipt = json.loads((directory/row['name']/'jump.json').read_text())
        assert receipt['exported_forward_elbow_flex_passed'] and receipt['fbx_round_trip_passed']
        assert receipt['body_sha256'] == sha(bodies[row['name']])
    return len(bodies)

try:
    with tempfile.TemporaryDirectory(prefix='nord-jump-elbows-') as temporary:
        work = Path(temporary)
        count = author(work/'crew', {name: ROOT/'Data/CharactersMeshy'/name/'body.fbx' for name in NAMES})
        count += author(work/'pilot', {'CurlyMetalhead': PILOT/'body.fbx'})
        marker = 'local_axes[forearm.name] = (forearm.bone.matrix_local.to_3x3().inverted() @ elbow_axis(armature, prefix)).normalized()'
        assert source.count(marker) == 1
        backwards = source.replace(marker, 'local_axes[forearm.name] = local_axes[forearm.name]')
        try:
            author(work/'backwards', {'CurlyMetalhead': PILOT/'body.fbx'}, backwards)
        except AssertionError as error:
            assert str(error) == 'Exported elbows bend backward', error
        else:
            raise AssertionError('Backward elbow export was accepted')
finally:
    sys.argv = old_argv
    assert before == {str(p): sha(p) for p in inputs}, 'Retained input changed'
print(f'NORD_JUMP_ELBOWS_CPU_OK {count} own-body exports; backward-sign negative control rejected; retained inputs unchanged')
