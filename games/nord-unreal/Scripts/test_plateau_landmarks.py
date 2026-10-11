"""Check the closed illustrative shell against source windows, mass and traversal limits."""
import copy
import json
import math

from plateau_landmarks import STAGE_ID, build_landmarks
from plateau_streets import _distance, _inside
from prepare_plateau import geography


def cross(a, b, c):
    u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


def check():
    buildings, _ = geography()
    original = copy.deepcopy(buildings)
    stage = next(building for building in buildings if building['id'] == STAGE_ID)
    mesh, report = build_landmarks(buildings)
    second_mesh, second_report = build_landmarks(buildings)
    assert buildings == original and mesh.groups == second_mesh.groups and report == second_report
    assert report['source_mass']['footprint_cm'] == [list(p) for p in stage['points']]
    assert report['source_mass']['height_cm'] == stage['height']
    assert math.isclose(stage['height'], 960)
    assert report['source_mass']['original_collision_unchanged'] and not report['new_collision']
    assert not report['enterable']
    assert len(report['materials']) <= 20 and report['vertical_fins'] > 200
    assert all(not batch['collision'] and batch['material'] in ('Iron', 'Wood', 'Trim', 'Roof')
               for batch in report['materials'].values())
    triangles = sum(len(face) - 2 for faces in mesh.groups.values() for face in faces)
    assert triangles == report['triangles'] == sum(batch['triangles'] for batch in report['materials'].values())
    assert triangles < 5000
    # Legacy blue windows are 3cm outside each source wall. Every corner lies inside the
    # new opaque 18cm envelope, whose full-height faces are closed continuously at corners.
    backing = report['backing_ring_cm']
    for wall in report['walls']:
        a, b, n = wall['a'], wall['b'], wall['normal']
        tangent = [(b[i] - a[i]) / wall['length_cm'] for i in range(2)]
        for distance in range(100, int(wall['length_cm']) - 180, 300):
            for d in (distance, distance + 130):
                old_window_point = [a[i] + tangent[i] * d + n[i] * 3 for i in range(2)]
                assert _inside(old_window_point, backing), 'The old blue window grid must be completely covered'
        # Every outer backing edge is parallel to its source edge and exactly 18cm out.
        index = report['walls'].index(wall)
        for point in (backing[index], backing[(index + 1) % len(backing)]):
            assert math.isclose(sum((point[i] - a[i]) * n[i] for i in range(2)), 18, abs_tol=1e-6)
    assert all(_inside(point, backing) for point in stage['points'])
    # Root retains original footprint collision. Decoration stays in a narrow envelope,
    # adds no ground slab and never pretends the stage box is traversable.
    edges = list(zip(stage['points'], stage['points'][1:] + stage['points'][:1]))
    low, high = report['bounds_cm']
    for name, faces in mesh.groups.items():
        for face in faces:
            assert all(low[i] <= p[i] <= high[i] for p in face for i in range(3))
            for point in face:
                if not _inside(point[:2], stage['points']):
                    assert min(_distance(point[:2], a, b) for a, b in edges) <= 80
                    if point[2] < stage['height'] - 6:
                        assert min(_distance(point[:2], a, b) for a, b in edges) <= 60
            if report['materials'][name]['material'] == 'Roof':
                assert cross(*face[:3])[2] > 0
    for a, b in zip(report['roof_ring_cm'], report['roof_ring_cm'][1:] + report['roof_ring_cm'][:1]):
        expected = (b[1] - a[1], -(b[0] - a[0]))
        fascia = [(a[0], a[1], stage['height'] - 6), (b[0], b[1], stage['height'] - 6),
                  (b[0], b[1], stage['height'] + 14)]
        n = cross(*fascia)
        assert n[0] * expected[0] + n[1] * expected[1] > 0
    sign = report['signs'][0]
    assert sign['text'] == 'THÉÂTRE DE VERDURE' and sign['position'][2] == 340
    assert math.isclose(math.hypot(*sign['normal']), 1)
    assert min(_distance(sign['position'][:2], a, b) for a, b in edges) > 52
    return {'triangles': triangles, 'batches': len(report['materials']),
            'vertical_fins': report['vertical_fins'], 'new_collision': report['new_collision']}


if __name__ == '__main__':
    print(json.dumps(check()))
