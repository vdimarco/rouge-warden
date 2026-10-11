"""Check pond holes, furniture collision clearance and bounded park meshes."""
import math

from plateau_ground import signed_area, triangulate, district_bounds
from plateau_park import build_park, park_survey
from plateau_streets import _inside, _local, _distance, _road_rectangle
from prepare_plateau import geography


def main():
    ponds, _, mapped = park_survey()
    assert {p['source'] for p in ponds} == {'relation/14474534', 'relation/14482536'}
    assert len(mapped) == 262 and len({b['source'] for b in mapped}) == len(mapped)
    for pond in ponds:
        triangles = triangulate(pond['outer'] + pond['inner'], district_bounds())
        expected = sum(abs(signed_area(r)) for r in pond['outer']) - sum(abs(signed_area(r)) for r in pond['inner'])
        assert math.isclose(sum(signed_area(t) for t in triangles), expected, abs_tol=.02)
        assert all(signed_area(t) > 0 for t in triangles)
        for triangle in triangles:
            center = tuple(sum(p[i] for p in triangle) / 3 for i in (0, 1))
            assert any(_inside(center, r) for r in pond['outer'])
            assert not any(_inside(center, r) for r in pond['inner']), 'Pond island filled with water'
    mesh, report = build_park()
    assert report['new_collision'] == 'mapped benches only'
    assert all(b['collision'] == (b['material'] in ('Iron', 'ParkWood')) for b in report['materials'].values())
    assert len(report['benches']) >= 220
    assert len(report['benches']) + len(report['benches_omitted_for_path_clearance']) == len(mapped)
    by_source = {b['source']: b['position'] for b in mapped}
    assert all(b['position'] == by_source[b['source']] and b['path_clearance_cm'] >= 0 for b in report['benches'])
    def overlaps(first, second):
        for polygon in (first, second):
            for a, b in zip(polygon, polygon[1:] + polygon[:1]):
                axis = (b[1]-a[1], a[0]-b[0])
                one = [sum(p[i]*axis[i] for i in (0, 1)) for p in first]
                two = [sum(p[i]*axis[i] for i in (0, 1)) for p in second]
                if min(max(one), max(two)) - max(min(one), min(two)) <= 1e-5:
                    return False
        return True
    _, roads = geography()
    paths = [(a, b, road['width']) for road in roads if road['tags'].get('highway') in ('path', 'footway', 'pedestrian')
             for a, b in zip(road['points'], road['points'][1:]) if math.dist(a, b) > 1]
    for bench in report['benches']:
        q = _local(bench['position'], bench['yaw'])
        footprint = [q(x, y, 0)[:2] for x, y in ((-89,-36),(89,-36),(89,36),(-89,36))]
        for a, b, width in paths:
            if _distance(bench['position'], a, b) < 100 + width/2:
                assert not overlaps(footprint, _road_rectangle(a, b, width)), bench['source']
    assert 500 < report['fallen_leaves'] <= 2880 and report['leaf_cluster_trees'] <= 90
    assert len(mesh.groups) <= 350 and report['tile_size_cm'] == 7500
    assert any(p['source'] == 'way/107910630' and p['material'] == 'ParkEarth' for p in report['path_surfaces'])
    assert any(p['source'] == 'way/143353659' and p['material'] == 'Asphalt' for p in report['path_surfaces'])
    assert all(not name.endswith('_Collision') for name in mesh.groups)
    assert sum(b['triangles'] for b in report['materials'].values()) == sum(len(f) - 2 for faces in mesh.groups.values() for f in faces)
    water = [b for b in report['materials'].values() if b['material'] == 'PondWater']
    assert sum(b['triangles'] for b in water) == sum(p['triangles'] for p in report['ponds'])
    for faces in mesh.groups.values():
        for face in faces:
            for a, b, c in ((face[0], face[i], face[i+1]) for i in range(1, len(face)-1)):
                cross = ((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
                         (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
                         (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))
                assert sum(v*v for v in cross) > 1e-10, 'Degenerate park triangle'
    print('Plateau park checks passed:', len(report['benches']), 'mapped benches,', report['fallen_leaves'], 'leaves, exact ponds/island holes')


if __name__ == '__main__':
    main()
