"""Pure geometry checks for inhabited windows without changing existing traversal."""
import copy
import hashlib
import json
import math

from plateau_facades import _wall_rectangles, build_facades, self_check
from plateau_mesh import Mesh


class RecordedMesh(Mesh):
    def __init__(self):
        super().__init__()
        self.sequence = []

    def face(self, material, points):
        points = [tuple(point) for point in points]
        self.sequence.append((material, points))
        super().face(material, points)


def fixture():
    buildings = [{'id': str(i), 'height': 960, 'tags': {},
                  'points': [[i * 1100, 0], [i * 1100 + 850, 0],
                             [i * 1100 + 850, 1800], [i * 1100, 1800]]} for i in range(4)]
    roads = [{'points': [[-1000, -1400], [6000, -1400]], 'width': 620,
              'name': 'Rue Sherbrooke Est', 'tags': {'highway': 'residential'}},
             {'points': [[-1000, 2300], [6000, 2300]], 'width': 380,
              'name': '', 'tags': {'highway': 'service', 'service': 'alley'}}]
    return buildings, roads, [[0, -1100], [5000, -1100]]


def normal(points):
    a, b, c = points[:3]
    ab, ac = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    return (ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0])


def check():
    buildings, roads, focus = fixture()
    original = copy.deepcopy((buildings, roads, focus))
    mesh = RecordedMesh()
    result = build_facades(mesh, buildings, roads, focus)
    assert original == (buildings, roads, focus)
    second = RecordedMesh()
    assert result == build_facades(second, buildings, roads, focus)
    assert mesh.sequence == second.sequence, 'Window variation must remain stable across regeneration'

    # This pre-polish snapshot includes every stoop, curved stair and rear gallery collider.
    # Changing a visual treatment must not silently change the verified playable route.
    collision_faces = [(name, [[round(v, 6) for v in point] for point in face])
                       for name, group in sorted(mesh.groups.items()) if name.endswith('_Collision')
                       for face in group]
    digest = hashlib.sha256(json.dumps(collision_faces, separators=(',', ':')).encode()).hexdigest()
    assert digest == 'b34c0b19ee0e0b140d68a2f8295f62b9657a656907b10071fea0c67a0cf0d4c1'
    for key, expected in {'fronts': 4, 'windows': 222, 'balconies': 6, 'exterior_stairs': 2,
                          'raised_entrances': 3, 'storefronts': 1, 'corner_returns': 12,
                          'cafe_tables': 1, 'rear_galleries': 4, 'rear_doors': 3,
                          'garage_doors': 1, 'chimneys': 3}.items():
        assert result['counts'][key] == expected, key
    for material in ('InteriorDark', 'InteriorWarm', 'CurtainIvory', 'CurtainSage', 'Leaf', 'Soil'):
        assert material in mesh.groups
    assert result['counts']['recessed_windows'] == 220
    assert result['counts']['curtained_windows'] > 50 and result['counts']['blind_windows'] > 30
    assert 0 < result['counts']['warm_windows'] < result['counts']['recessed_windows'] / 6

    surfaces = result['fronts'] + [surface for front in result['fronts']
                                 for surface in front.get('corner_returns', [])]
    starts = []
    for surface in surfaces:
        a, b, outward = surface['a'], surface['b'], surface['normal']
        depth_scale = min(1, max(.43, surface['setback'] / 70))
        first = (a[0] + outward[0] * 8 * depth_scale, a[1] + outward[1] * 8 * depth_scale, 0)
        next_point = (b[0] + outward[0] * 8 * depth_scale, b[1] + outward[1] * 8 * depth_scale, 0)
        starts.append(next(index for index, (_, points) in enumerate(mesh.sequence)
                           if points[0] == first and points[1] == next_point and max(p[2] for p in points) == 960))
        assert surface['a'] in buildings[int(surface['id'])]['points']
        assert surface['b'] in buildings[int(surface['id'])]['points'] and surface['height'] == 960
    assert starts == sorted(starts)
    starts.append(len(mesh.sequence))
    dark_fields = reflection_area = dark_area = 0
    for surface, start, end in zip(surfaces, starts, starts[1:]):
        outward = surface['normal']
        a, b = surface['a'], surface['b']
        tangent = ((b[0] - a[0]) / surface['width'], (b[1] - a[1]) / surface['width'])
        depth_scale = min(1, max(.43, surface['setback'] / 70))
        lower, upper = surface['detail_bounds_cm']
        wall_rects = []
        inner_rects = []
        for material, points in mesh.sequence[start:end]:
            assert all(lower[axis] - .001 <= p[axis] <= upper[axis] + .001
                       for p in points for axis in range(3)), 'Metadata must contain the actual surface geometry'
            depths = [sum((p[i] - a[i]) * outward[i] for i in range(2)) / depth_scale for p in points]
            if material == 'InteriorDark':
                dark_fields += 1
                assert all(abs(depth - 25) < 1e-7 for depth in depths)
                assert sum(normal(points)[i] * outward[i] for i in range(2)) > 0
                dark_area += math.dist(points[0], points[1]) * math.dist(points[1], points[2])
                xs = [sum((p[i] - a[i]) * tangent[i] for i in range(2)) for p in points]
                inner_rects.append((min(xs), max(xs), min(p[2] for p in points), max(p[2] for p in points)))
            if material == 'Glass' and all(abs(depth - 31) < 1e-7 for depth in depths):
                reflection_area += math.dist(points[0], points[1]) * math.dist(points[1], points[2])
                assert sum(normal(points)[i] * outward[i] for i in range(2)) > 0
            if material in ('CurtainIvory', 'CurtainSage') and len(points) == 4:
                # Exclude book-box horizontal/side faces from the curtain-panel check.
                if min(depths) >= 26 - 1e-7 and max(depths) <= 29 + 1e-7 and max(p[2] for p in points) - min(p[2] for p in points) > 30:
                    assert sum(normal(points)[i] * outward[i] for i in range(2)) > 0
            if material in ('BrickRed', 'BrickBrown', 'BrickOchre', 'Limestone') and len(points) == 4:
                if max(depths) - min(depths) < 1e-7 and abs(depths[0] - 42) < 1e-7:
                    assert sum(normal(points)[i] * outward[i] for i in range(2)) > 0
                    xs = [sum((p[i] - a[i]) * tangent[i] for i in range(2)) for p in points]
                    wall_rects.append((min(xs), max(xs), min(p[2] for p in points), max(p[2] for p in points)))
                elif abs(min(depths) - 22) < 1e-7 and abs(max(depths) - 42) < 1e-7:
                    # Recess returns must face into the opening, never into the solid wall.
                    n = normal(points)
                    local_x = [sum((p[i] - a[i]) * tangent[i] for i in range(2)) for p in points]
                    facing = 1 if abs(depths[0] - 42) < 1e-7 else -1
                    if max(local_x) - min(local_x) < 1e-7:
                        assert sum(n[i] * tangent[i] for i in range(2)) * facing > 0
                    else:
                        assert n[2] * facing > 0
            if material == 'Soil':
                assert normal(points)[2] > 0, 'Planter soil must face the sky'
        assert all(wr <= left or wl >= right or wt <= bottom or wb >= top
                   for left, right, bottom, top in inner_rects
                   for wl, wr, wb, wt in wall_rects), 'The masonry mask must never cover the window treatment'
    assert dark_fields == result['counts']['recessed_windows']
    assert .08 < reflection_area / dark_area < .25, 'Opaque sky reflections must leave the room treatment visible'
    assert sum(len(face) - 2 for group in mesh.groups.values() for face in group) < 60000

    # Analytic union area exercises overlapping and clipped wall openings.
    apertures = [(100, 300, 100, 300), (200, 400, 200, 400),
                 (-20, 80, -50, 100), (900, 1100, 700, 900)]
    rectangles = list(_wall_rectangles(1000, 800, apertures))
    assert sum((right - left) * (top - bottom) for left, right, bottom, top in rectangles) == 712000
    for left, right, bottom, top in rectangles:
        assert 0 <= left < right <= 1000 and 0 <= bottom < top <= 800
        assert all(right <= x0 or left >= x1 or top <= z0 or bottom >= z1 for x0, x1, z0, z1 in apertures)
    self_check()
    return {'triangles': sum(len(f) - 2 for group in mesh.groups.values() for f in group),
            'counts': result['counts'], 'collision_sha256': digest}


if __name__ == '__main__':
    print(json.dumps(check(), indent=2))
