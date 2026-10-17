"""Validate source/authoring trust boundaries without loading Unreal or writing assets."""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import json
import sys

import import_tripo_pilot as pilot

root = Path(__file__).resolve().parents[1]
paths, hashes = pilot.source_plan(root)
assert len(paths) == 8 and set(paths) == set(hashes)


def rejects(function):
    try:
        function()
    except AssertionError:
        return
    raise AssertionError('Invalid import unexpectedly passed')


original_loads = json.loads
def failed_receipt(text):
    value = original_loads(text)
    if value.get('rig', {}).get('armature_object') == 'Armature':
        value['passed'] = False
    return value

with patch.object(pilot.json, 'loads', failed_receipt):
    rejects(lambda: pilot.source_plan(root))
read_bytes = Path.read_bytes
with patch.object(Path, 'read_bytes', lambda path: b'tampered clip' if path == paths['Walk'] else read_bytes(path)):
    rejects(lambda: pilot.source_plan(root))
for flags, worlds in [('-vulkan', []), ('-nullrhiOther', []), ('-nullrhi=false', []), ('-nullrhi', [object()])]:
    fake = SimpleNamespace(Paths=SimpleNamespace(project_dir=lambda: str(root)),
                           SystemLibrary=SimpleNamespace(get_command_line=lambda: flags),
                           EditorLevelLibrary=SimpleNamespace(get_pie_worlds=lambda _: worlds))
    with patch.dict(sys.modules, {'unreal': fake}):
        rejects(pilot.main)
print('PASS: actual eight-source plan, rejected failed receipt/tampered clip, rendered/prefix flags and active PIE before mutation')
