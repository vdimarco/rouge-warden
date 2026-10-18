"""Check the actual seven-source plan and reject tampering before any output writes."""
from hashlib import sha256
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
from unittest.mock import patch

import prepare_graphic_novel_cast as planner


def rejects(function, exception=ValueError):
    try:
        function()
    except exception:
        return
    raise AssertionError('Invalid cast plan unexpectedly passed')


requests, report = planner.source_plan()
assert len(requests) == len(report['characters']) == 7
assert len({row['character'] for row in report['characters']}) == 7
assert {row['style'] for row in report['characters']} == {3, 4, 5, 6, 7, 8, 10}
assert report['network_requests'] == report['provider_jobs_submitted'] == report['spent_usd'] == 0
assert report['public_reference_http_hashes_verified'] is False
assert report['live_schema_verified_by_this_planner'] is False
assert report['provider_schema_snapshot_validated'] is True and report['face_animation_promised'] is False
schema = json.loads((planner.ROOT / planner.SCHEMA).read_text())
for row in report['characters']:
    request = json.loads(requests[row['request_file']])
    assert set(request) == {'endpoint_id', 'input'} and request['endpoint_id'] == planner.ENDPOINT
    inputs = request['input']
    assert set(inputs) == set(planner.SETTINGS) | {'image_url', 'texture_prompt'}
    assert all(type(inputs[k]) is type(v) and inputs[k] == v for k, v in planner.SETTINGS.items())
    assert 0 < len(inputs['texture_prompt']) <= 600
    assert row['identity_constraints']['identity'] in inputs['texture_prompt']
    assert row['identity_constraints']['outfit'] in inputs['texture_prompt']
    assert row['identity_constraints']['new_wardrobe'] is False
    assert inputs['image_url'] == row['reference']['url']
    assert f'/{planner.COMMIT}/' in inputs['image_url'] and inputs['image_url'].endswith('/reference.png')
    assert row['request_sha256'] == sha256(requests[row['request_file']]).hexdigest()
    planner.validate_input(inputs, schema)

valid_input = json.loads(next(iter(requests.values())))['input']
for key, invalid in [('target_polycount', True), ('target_polycount', 300001), ('target_polycount', 99),
                     ('geometry_resolution', '8k'), ('rigging_height_meters', 0),
                     ('texture_prompt', 'a' * 601), ('animation_action_id', 697), ('enable_pbr', 'true')]:
    rejects(lambda: planner.validate_input(dict(valid_input, **{key: invalid}), schema))
rejects(lambda: planner.validate_input({k: v for k, v in valid_input.items() if k != 'image_url'}, schema))
rejects(lambda: planner.validate_input(dict(valid_input, unexpected_field=True), schema))

with TemporaryDirectory(prefix='nord-cast-plan-') as directory:
    scratch = Path(directory)
    root = scratch / 'fixture/games/nord-unreal'
    paths = [planner.ROOT / planner.TEMPLATE, planner.ROOT.parents[1] / planner.STYLE,
             planner.ROOT / planner.SCHEMA]
    paths += [planner.ROOT / 'Data/GraphicNovel/Crew' / name / file
              for name in planner.CAST for file in ('source-review.json', 'reference.png', 'prompt.txt')]
    for original in paths:
        target = scratch / 'fixture' / original.relative_to(planner.ROOT.parents[1])
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
    output = scratch / 'valid-plan'
    written = planner.write_plan(output, root)
    assert written == report
    assert sorted(path.name for path in output.iterdir()) == sorted([*requests, 'SourceReadiness.json'])
    assert all((output / name).read_bytes() == raw for name, raw in requests.items())
    assert json.loads((output / 'SourceReadiness.json').read_text()) == report
    # Reject even an empty pre-existing directory before reading sources or writing anything.
    existing = scratch / 'existing'
    existing.mkdir()
    with patch.object(planner, 'source_plan', side_effect=AssertionError('Read sources before destination check')):
        rejects(lambda: planner.write_plan(existing, root), FileExistsError)
    assert list(existing.iterdir()) == []
    sentinel = existing / 'keep.txt'
    sentinel.write_text('existing work')
    rejects(lambda: planner.write_plan(existing, root), FileExistsError)
    assert sentinel.read_text() == 'existing work'
    reference = root / 'Data/GraphicNovel/Crew/GreenCap51/reference.png'
    original_bytes = reference.read_bytes()
    reference.unlink()
    rejects(lambda: planner.write_plan(scratch / 'missing-reference', root))
    assert not (scratch / 'missing-reference').exists()
    reference.write_bytes(original_bytes + b'tampered')
    rejects(lambda: planner.write_plan(scratch / 'tampered-reference', root))
    assert not (scratch / 'tampered-reference').exists()
    reference.write_bytes(original_bytes)
    review = root / 'Data/GraphicNovel/Crew/Topknot/source-review.json'
    review.write_text(review.read_text().replace('black crossbody', 'red futuristic'))
    rejects(lambda: planner.write_plan(scratch / 'tampered-review', root))
    assert not (scratch / 'tampered-review').exists()
    rejects(lambda: planner.write_plan(reference, root), FileExistsError)
    assert reference.read_bytes() == original_bytes
print('PASS: seven pinned requests, styles/settings/prompts/hashes; existing output, missing/tampered reference and review rejected before writes')
