"""Actual source-plan and pre-mutation negative checks; no Unreal or asset writes."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

import import_tripo_cast as cast

root = Path(__file__).resolve().parents[1]
paths, hashes, scale = cast.source_plan(root, 'BlackCap')
assert len(paths) == 8 and set(paths) == set(hashes)
assert 1.85 < scale < 1.87 and abs(scale - 1.82) > .03


def rejects(function):
    try:
        function()
    except AssertionError:
        return
    raise AssertionError('Invalid import unexpectedly passed')


for character in ('CurlyMetalhead', 'Topknot', '../BlackCap'):
    rejects(lambda: cast.source_plan(root, character))

read_text = Path.read_text
black_provenance = root / 'Data/GraphicNovel/Crew/BlackCap/tripo-h31-rig-20261017/derived/natural-v1/Provenance.json'
memphis_provenance = root / 'Data/GraphicNovel/Crew/Memphis33/tripo-h31-rig-20261017/derived/natural-v1/Provenance.json'
other_bundle = json.loads(black_provenance.read_text())
other_bundle['character'] = 'Memphis33'
with patch.object(Path, 'read_text', lambda p, *a, **kw: json.dumps(other_bundle) if p == memphis_provenance else read_text(p, *a, **kw)):
    rejects(lambda: cast.source_plan(root, 'Memphis33'))

original_loads = json.loads
for field in ('failed_surface', 'failed_motion', 'not_approved', 'wrong_surface', 'wrong_scale'):
    def changed_receipt(text):
        value = original_loads(text)
        if field == 'failed_surface' and 'original_corner_normals' in value:
            value['passed'] = False
        elif field == 'failed_motion' and 'source_to_target' in value:
            value['passed'] = False
        elif field == 'not_approved' and 'native_import_trial_allowed' in value:
            value['native_import_trial_allowed'] = False
        elif field == 'wrong_surface' and 'own_static_body_surface' in value:
            value['own_static_body_surface']['sha256'] = '0' * 64
        elif field == 'wrong_scale' and 'provider_bounds_m' in value.get('correspondence', {}):
            value['correspondence']['provider_bounds_m']['min'][2] = .1
        return value
    with patch.object(cast.json, 'loads', changed_receipt):
        rejects(lambda: cast.source_plan(root, 'BlackCap'))

read_bytes = Path.read_bytes
with patch.object(Path, 'read_bytes', lambda p: b'tampered clip' if p == paths['Walk'] else read_bytes(p)):
    rejects(lambda: cast.source_plan(root, 'BlackCap'))
for flags, worlds in [('-vulkan', []), ('-nullrhiOther', []), ('-nullrhi=false', []), ('-nullrhi', [object()])]:
    fake = SimpleNamespace(Paths=SimpleNamespace(project_dir=lambda: str(root)),
                           SystemLibrary=SimpleNamespace(get_command_line=lambda: flags),
                           EditorLevelLibrary=SimpleNamespace(get_pie_worlds=lambda _: worlds))
    with patch.dict(sys.modules, {'unreal': fake}):
        rejects(cast.main)
print('PASS: actual eight-source cast plan/calibrated scale; pilot/bag/path/approval/proof/clip/scale/authoring negatives reject')
