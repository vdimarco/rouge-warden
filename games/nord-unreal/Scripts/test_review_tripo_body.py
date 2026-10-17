"""Source-pin/crop/output boundary checks; no Blender, rendering or source writes."""
from pathlib import Path
from tempfile import TemporaryDirectory
import copy
import json

import review_tripo_body as review


def rejects(function, exception):
    try:
        function()
    except exception:
        return
    raise AssertionError('Invalid static body review plan accepted')


game = Path(__file__).resolve().parents[1]
source = game / 'Data/GraphicNovel/Crew/BlackCap/tripo-h31-body-20261017/body.glb'
anchors = game / 'Verification/TripoCast/TripoBodies/BodyReview/BlackCap/Anchors.json'
before = review.digest(source)
original_plan = json.loads(anchors.read_text())
with TemporaryDirectory(prefix='nord-tripo-body-review-test-') as directory:
    root = Path(directory)
    fresh = root / 'new-output'
    result = review.load_plan(source, anchors, fresh)
    assert result[2] == before and not fresh.exists() and result[4].get('skins', []) == []
    rejects(lambda: review.load_plan(source, anchors, root), FileExistsError)
    rejects(lambda: review.load_plan(source, anchors, source), FileExistsError)
    rejects(lambda: review.load_plan(root / 'missing.glb', anchors, fresh), ValueError)
    malformed = root / 'malformed.glb'
    malformed.write_bytes(b'not a GLB')
    rejects(lambda: review.load_plan(malformed, anchors, fresh), ValueError)
    tampered = root / 'changed.glb'
    raw = bytearray(source.read_bytes())
    raw[-16] ^= 1
    tampered.write_bytes(raw)
    rejects(lambda: review.load_plan(tampered, anchors, fresh), ValueError)
    for mutation in ('pin', 'nonunit', 'nonorthogonal', 'nan', 'wrongup', 'emptycrop', 'meshcount'):
        plan = copy.deepcopy(original_plan)
        if mutation == 'pin':
            plan['source_sha256'] = '0' * 64
        elif mutation == 'nonunit':
            plan['basis_world']['left'] = [2, 0, 0]
        elif mutation == 'nonorthogonal':
            plan['basis_world']['left'] = plan['basis_world']['forward']
        elif mutation == 'nan':
            plan['crops_basis_left_forward_up']['face'][0][0] = float('nan')
        elif mutation == 'wrongup':
            plan['basis_world'] = {'left': [1, 0, 0], 'forward': [0, 0, 1], 'up': [0, 1, 0]}
        elif mutation == 'emptycrop':
            plan['crops_basis_left_forward_up']['hand-left'][1] = plan['crops_basis_left_forward_up']['hand-left'][0]
        else:
            plan['expected_meshes'] = 2
        invalid = root / (mutation + '.json')
        invalid.write_text(json.dumps(plan))
        rejects(lambda: review.load_plan(source, invalid, fresh), ValueError)
    assert not fresh.exists()
assert review.digest(source) == before
print('PASS: pinned static source; existing outputs, missing/malformed/tampered source, wrong pin/basis/crops/mesh count rejected before writes')
