"""Focused CPU guards for the central high-detail garment-only UV1 derivative.

Python validates immutable source/mask/views and rejects skin-wall selections.
Blender additionally compares every protected binary element and fresh imports.
No source or derivative assets are written by this check.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import refine_high_detail_collar as refine

EXPECTED_FACES = {42641, 43264, 43598, 43872, 44357, 44718, 44858, 44969, 44970,
                  45657, 46198, 46569, 46688, 46848, 47672, 48379, 49255, 49807,
                  50109, 50503, 51022, 51224, 52111, 52113, 52125, 52163}
MASK_SHA256 = '88d3180bc539bf86298710077f7d1f0de7cadd00553f0e5a403f83c00f51614b'
before = refine.protected()
mask_path = refine.OUT / 'collar-uv1.json'
assert refine.sha(mask_path) == MASK_SHA256, 'Reviewed mask changed'
mask = json.loads(mask_path.read_text())
assert mask['source_sha256'] == refine.SOURCE_SHA256 == refine.sha(refine.SOURCE / 'body.fbx')
assert {r['id'] for r in mask['faces']} == EXPECTED_FACES and len(mask['faces']) == 26
assert mask['changed_uv1_corners'] == 78
loops = set()
for row in mask['faces']:
    refine.assert_garment_face(row['world_m'], row['geometric_normal_world'])
    assert row['loops'] == [3 * row['id'] + i for i in range(3)]
    assert not loops.intersection(row['loops']); loops.update(row['loops'])
    assert 0 < row['positive_scale'] <= 1
    def area(uv):
        a, b, c = uv
        return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    assert area(row['before_uv1']) * area(row['after_uv1']) > 0
    assert all(math.isfinite(c) and 0 <= c <= 1 for p in row['after_uv1'] for c in p)
# Explicit counterexamples: inward neck wall, steep skin wall, side neck,
# higher skin/face and invalid coordinates must never enter the garment mask.
for defect in ('inward_neck', 'steep_wall', 'side_neck', 'higher_skin', 'nan'):
    row = copy.deepcopy(mask['faces'][0])
    if defect == 'inward_neck': row['world_m'][0][1] = -.068
    elif defect == 'steep_wall': row['geometric_normal_world'] = [0, -1, 0]
    elif defect == 'side_neck': row['world_m'][0][0] = .08
    elif defect == 'higher_skin': row['world_m'][0][2] = 1.49
    else: row['world_m'][0][0] = float('nan')
    try:
        refine.assert_garment_face(row['world_m'], row['geometric_normal_world'])
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe garment selection accepted: ' + defect)
study = json.loads((refine.OUT / 'cpu-study.json').read_text())
assert study['passed'] and study['source_unchanged'] and study['source_hashes'] == before
assert study['mask_sha256'] == MASK_SHA256 and len(study['views']) == 6
assert {v['mode'] for v in study['views']} == {'original', 'refined', 'selection'}
assert all(v['sha256'] == refine.sha(refine.OUT / v['file']) and v['device'] == 'CPU' for v in study['views'])
report = json.loads((refine.OUT / 'body.json').read_text())
assert report['passed'] and report['source_unchanged'] and report['source_hashes'] == before
assert report['output_sha256'] == refine.sha(refine.OUT / 'body.fbx') and report['mask_sha256'] == MASK_SHA256
assert report['original_fbx_contents_identical_except_appended_uv1_layer']
assert report['fresh_reimport_geometry_normals_uv0_weights_binds_identical'] and report['bones'] == 24
assert report['graphics_accepted'] is False and report['native_imported'] is False
assert report['changed_uv1_corners'] == 78 and set(report['faces']) == EXPECTED_FACES
# The retained first-pilot derivative is a separate fixed artifact.
assert refine.sha(refine.SOURCE.parent / 'refined-v1/body.fbx') == 'e231d727117e76ac2fe0f44921517a0c6256ce9abc2f97dd36c92e1add05930b'
try:
    import bpy
except ImportError:
    print('NORD_HIGH_DETAIL_COLLAR_CPU_OK frozen source, 26 garment faces, 78 UV1 corners, six views, unsafe skin selections rejected')
else:
    from io_scene_fbx import parse_fbx
    source, version = parse_fbx.parse(str(refine.SOURCE / 'body.fbx'))
    target, got_version = parse_fbx.parse(str(refine.OUT / 'body.fbx'))
    assert version == got_version
    assert refine.binary.protected_fingerprint(source) == refine.binary.protected_fingerprint(target)
    a = refine.binary.snapshot(refine.SOURCE / 'body.fbx'); b = refine.binary.snapshot(refine.OUT / 'body.fbx')
    uv0 = a.pop('uv_layers')['UVMap']; uvs = b.pop('uv_layers')
    assert a == b and list(uvs) == ['UVMap', 'UV1'] and uvs['UVMap'] == uv0
    assert all(uvs['UV1'][i] == v for i, v in enumerate(uv0) if i not in loops)
    protected_outputs = {p.name: refine.sha(p) for p in refine.OUT.iterdir() if p.is_file() and p.suffix in ('.fbx', '.json', '.png')}
    try:
        refine.export('0' * 64)
    except AssertionError as error:
        assert 'explicitly reviewed mask' in str(error)
    else:
        raise AssertionError('Unreviewed derivative export allowed')
    assert protected_outputs == {p.name: refine.sha(p) for p in refine.OUT.iterdir() if p.is_file() and p.suffix in ('.fbx', '.json', '.png')}
    print('NORD_HIGH_DETAIL_COLLAR_BLENDER_OK binary protected content and fresh geometry/normals/UV0/weights/binds match; unreviewed export rejected')
assert refine.protected() == before, 'Frozen source changed during check'
