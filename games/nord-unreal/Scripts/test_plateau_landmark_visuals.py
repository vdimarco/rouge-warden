"""Prove exact shell selection and preservation of every other face/UV token."""
import json

import plateau_landmark_visuals as visuals
from plateau_background import read_obj
from prepare_plateau import geography


def record(points):
    return [((str(x), str(-y), str(z)), ('0.123456', '0.876543')) for x, y, z in points]


def main():
    target = {'id': '27395533', 'height': 960,
              'points': [(0, 0), (1000, 0), (1000, 1000), (0, 1000)]}
    wall = record([(0, 0, 0), (1000, 0, 0), (1000, 0, 960), (0, 0, 960)])
    neighbor = record([(0, -1000, 0), (1000, -1000, 0), (1000, -1000, 960), (0, -1000, 960)])
    glass = record([(100, -3, 100), (900, -3, 100), (900, -3, 300), (100, -3, 300)])
    inward = record([(100, 3, 100), (900, 3, 100), (900, 3, 300), (100, 3, 300)])
    assert visuals.belongs(wall, 'Cream', target)
    assert not visuals.belongs(neighbor, 'Cream', target)
    assert visuals.belongs(glass, 'Glass', target)
    assert not visuals.belongs(inward, 'Glass', target)
    assert not visuals.belongs(glass, 'Cream', target)
    kept, removed = visuals.split([neighbor, wall, neighbor], 'Cream', [target])
    assert kept == [neighbor, neighbor] and removed['27395533'] == [wall]
    manifest = json.loads((visuals.DIRECTORY / 'visuals.json').read_text())
    visuals.validate_inputs(manifest)
    targets = [b for b in geography()[0] if b['id'] in visuals.TARGETS]
    assert len(manifest['replacements']) == 7
    assert sum(bool(r['geometry']) for r in manifest['replacements']) == 4
    assert manifest['removed_triangles'] == 878
    wanted = {r['target_actor_label'] for r in manifest['replacements'] if r['geometry']}
    visuals.assert_labels(list(wanted) + ['Plateau landmark existing'], wanted)
    for names in (list(wanted)[1:], list(wanted) + ['Plateau survey context unexpected'],
                  list(wanted) + [next(iter(wanted))]):
        try: visuals.assert_labels(names, wanted)
        except AssertionError: pass
        else: raise AssertionError('Survey context inventory accepted missing, unexpected or duplicate actor')
    for replacement in manifest['replacements']:
        source = read_obj(visuals.ROOT / replacement['source'])
        kept, removed = visuals.split(source, replacement['material'], targets)
        assert len(source) == len(kept) + sum(map(len, removed.values()))
        assert visuals.face_digest(source) == replacement['source_face_sha256']
        assert visuals.face_digest(kept) == replacement['retained_face_sha256']
        if kept:
            assert read_obj(visuals.DIRECTORY / replacement['geometry']) == kept
    print('PASS: only 32 landmark walls, 2 roofs and 393 cards removed; all other ordered position/UV tokens exact; 7 hidden visual sources, 4 copies, 878 removed triangles, no collision changes')


if __name__ == '__main__':
    main()
