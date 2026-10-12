"""Small geometry checks against the checked-in survey; does not require Unreal."""
import math
import struct
import hashlib

from plateau_mesh import Mesh
from plateau_batches import spatial_batches
from plateau_streets import (_bin_set, _car, _clothesline, _distance, _grass, _inside,
                             _leaf, _planter, _shrub, build_streets)
from prepare_plateau import ROUTE, geography


def _segment_distance(a, b, c, d):
    cross = lambda p, q, r: (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    overlap = all(max(min(a[i], b[i]), min(c[i], d[i])) <= min(max(a[i], b[i]), max(c[i], d[i])) for i in (0, 1))
    if overlap and cross(a, b, c) * cross(a, b, d) <= 0 and cross(c, d, a) * cross(c, d, b) <= 0:
        return 0
    return min(_distance(a, c, d), _distance(b, c, d), _distance(c, a, b), _distance(d, a, b))


def _route_clear(route, polygon, label):
    # A 42 cm character capsule receives another 10 cm of tolerance.
    for a, b in zip(route, route[1:]):
        if any(max(a[i], b[i]) + 52 < min(p[i] for p in polygon) or
               min(a[i], b[i]) - 52 > max(p[i] for p in polygon) for i in (0, 1)):
            continue
        assert not _inside(a, polygon) and not _inside(b, polygon), label
        assert all(_segment_distance(a, b, c, d) >= 52 for c, d in zip(polygon, polygon[1:] + polygon[:1])), label


def _overlap_area(polygon, clip):
    if any(max(p[i] for p in polygon) <= min(p[i] for p in clip) or
           min(p[i] for p in polygon) >= max(p[i] for p in clip) for i in (0, 1)):
        return 0
    for a, b in zip(clip, clip[1:] + clip[:1]):
        incoming, polygon = polygon, []
        if not incoming:
            return 0
        cross = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        previous = incoming[-1]
        for p in incoming:
            before, after = cross(previous), cross(p)
            if (before >= 0) != (after >= 0):
                f = before / (before - after)
                polygon.append(tuple(previous[i] + (p[i] - previous[i]) * f for i in (0, 1)))
            if after >= 0:
                polygon.append(p)
            previous = p
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(polygon, polygon[1:] + polygon[:1]))) / 2


def _closed_surface(faces):
    edges = {}
    volume = 0
    for face in faces:
        points = [tuple(round(v,6) for v in p) for p in face]
        a = points[0]
        for b,c in zip(points[1:-1],points[2:]):
            volume += a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0])
        for a,b in zip(points,points[1:]+points[:1]):
            key = tuple(sorted((a,b)))
            incidence,orientation = edges.get(key,(0,0))
            edges[key] = (incidence+1,orientation+(1 if a<b else -1))
    assert all(incidence==2 and orientation==0 for incidence,orientation in edges.values()), 'Open or reversed structural surface'
    assert volume>0, 'Structural normals face inward'


def _survives_import(mesh):
    """Small leaves, cloth thickness and stems must survive real OBJ/UE precision."""
    for faces in mesh.groups.values():
        for face in faces:
            p = [tuple(struct.unpack('f', struct.pack('f', round(v, 3)))[0] for v in point) for point in face]
            for b, c in zip(p[1:-1], p[2:]):
                u, v = [b[i]-p[0][i] for i in range(3)], [c[i]-p[0][i] for i in range(3)]
                cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
                assert sum(n*n for n in cross) > 1e-8, 'Microdetail triangle collapses on import'


def main():
    buildings, roads = geography()
    kinds = {'residential', 'tertiary', 'secondary', 'primary', 'service', 'unclassified', 'living_street'}
    alley = [r for r in roads if r['id'] == '347132484']
    assert len(alley) == 1 and len(alley[0]['points']) > 2, 'Clipping fragmented the planted alley'
    mesh = Mesh()
    result = build_streets(mesh, buildings, roads, ROUTE)
    counts = result['counts']
    assert counts['sidewalk_metres'] > 500 and counts['curb_ramps'] >= 4
    assert counts['parked_cars'] >= 8 and counts['bicycles'] >= 3
    assert counts['ruelles'] == 1 and counts['planters'] >= 3 and counts['bollards'] == 2
    assert len(result['detailed_trees']) == counts['tree_pits'] >= 5
    assert counts['garden_square_metres'] >= 10 and counts['climbing_vines'] >= 8
    assert counts['residential_bin_sets'] == counts['clotheslines'] == 1 and counts['fallen_leaves'] >= 100
    assert any(s['text'] == 'ARRÊT' for s in result['signs'])
    for text in ('RUE PANET', 'RUE SHERBROOKE EST', 'RUE DE LA VISITATION', 'RUELLE VERTE'):
        blades = [s for s in result['signs'] if s['text'] == text]
        assert len(blades) == 2 and abs(blades[0]['yaw'] - blades[1]['yaw']) == 180, 'Street blade lacks a readable back'
        assert math.dist(blades[0]['position'], blades[1]['position']) >= 6
    for building in buildings:
        _route_clear(result['route'], building['points'], 'Walking capsule touches building ' + building['id'])
    for detail in result['microdetails']:
        polygon = [tuple(p) for p in detail['footprint']]
        assert detail['source_way_id'] == '347132484' and detail['collision'] is False
        _route_clear(result['route'], polygon, 'Residential detail enters the walking route')
        for building in buildings:
            other = building['points']
            assert not any(_inside(p, other) for p in polygon) and not any(_inside(p, polygon) for p in other)
            assert all(_segment_distance(a, b, c, d) > 0 for a, b in zip(polygon, polygon[1:] + polygon[:1])
                       for c, d in zip(other, other[1:] + other[:1])), 'Residential detail crosses a building'
    for material, faces in mesh.groups.items():
        if not material.endswith('_Collision') or material.startswith(('Concrete', 'Limestone')):
            continue
        for face in faces:
            if max(p[2] for p in face) > 30:
                _route_clear(result['route'], [p[:2] for p in face], 'Walking capsule touches ' + material)
    concrete = mesh.groups['Concrete_Collision']
    assert min(p[2] for face in concrete for p in face if p[2] > 0) <= 8
    pavement = [[p[:2] for p in face] for face in concrete if min(p[2] for p in face) > 0]
    asphalt = [[p[:2] for p in face] for face in mesh.groups['Asphalt']]
    assert counts['road_fill_square_metres'] > 1000
    junction = result['junction_fills']
    assert len(junction) == 1 and junction[0]['crossing_way_ids'] == [
        '1206504053', '1206504054', '1206504055', '1206504056'], 'Junction fill escaped the mapped crossing loop'
    # These surveyed junction points projected into the tan yard-ground patch in
    # PlateauParkEntrance. They must be asphalt without changing either curb.
    assert all(any(_inside(p, face) for face in asphalt) for p in
               ((37504, -3963), (37542, -4036), (37490, -4129))), 'Yard ground shows through the mapped junction'
    fill = asphalt[-sum(item['faces'] for item in junction):]
    # The OBJ importer receives rounded centimetres and stores float32 vertices.
    # Its fan triangles must survive that conversion without count loss.
    for face in fill:
        points = [tuple(struct.unpack('f', struct.pack('f', round(v, 3)))[0] for v in p) for p in face]
        a = points[0]
        assert all((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]) > .001
                   for b, c in zip(points[1:-1], points[2:])), 'Junction triangle collapses on import'
    assert any(_inside((39470, -3030), face) for face in asphalt), 'Commercial corner gutter remains unpaved'
    paint = [face for face in mesh.groups['White'] if max(p[2] for p in face) < 10]
    assert len(paint) >= 100 and all(5.09 <= p[2] <= 7.11 for face in paint for p in face), 'Crosswalk paint floats above its road/path surface'
    assert {round(p[2], 1) for face in paint for p in face} == {5.1, 6.1, 7.1}, 'Crosswalk paint lost its mapped road/path elevations'
    assert all(len({p[2] for p in face}) == 1 for face in paint), 'Stripe slopes through a road/path layer step'
    # This art pass must retain every pre-pass collision face and all verified paving.
    protected = {k: hashlib.sha256(repr(f).encode()).hexdigest() for k, f in mesh.groups.items()
                 if k.endswith('_Collision') or k == 'Asphalt'}
    protected['paint'] = hashlib.sha256(repr(paint).encode()).hexdigest()
    assert hashlib.sha256(repr(sorted(protected.items())).encode()).hexdigest() == \
        '1079f29e85b45a8e56565d0f99fc9dc37be5a04ba1a1b6fc71192229000eb4ac', 'Street art changed protected geometry'
    road_polygons = []
    for road in roads:
        if road['tags'].get('highway') not in kinds:
            continue
        for a, b in zip(road['points'], road['points'][1:]):
            length = math.dist(a, b)
            nx, ny = -(b[1] - a[1]) / length * road['width'] / 2, (b[0] - a[0]) / length * road['width'] / 2
            road_polygons.append([(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny),(a[0]+nx,a[1]+ny)])
    for face in paint:
        probes = face + [tuple(sum(p[i] for p in face) / len(face) for i in (0, 1))]
        surface = max(7 if any(_inside(p, polygon) for polygon in asphalt)
                      else 6 if any(_inside(p, polygon) for polygon in road_polygons) else 5 for p in probes)
        assert abs(face[0][2] - surface - .1) < .001, 'Paint lacks 1 mm clearance over highest road/path sample'
    _, exported, _ = spatial_batches(mesh)
    assert all(not batch['collision'] for batch in exported.values() if batch['material'] in ('White', 'Asphalt')), 'Road paint/fill gained collision'
    assert all(_overlap_area(face, slab) < 2 for face in asphalt for slab in pavement), 'Asphalt covers pedestrian pavement'
    for face in mesh.groups['Gravel']:
        polygon = [p[:2] for p in face]
        nearby = [b['points'] for b in buildings if all(min(p[i] for p in polygon) <= max(p[i] for p in b['points']) and
                  max(p[i] for p in polygon) >= min(p[i] for p in b['points']) for i in (0,1))]
        for u in range(11):
            for v in range(8):
                p = tuple(polygon[0][i]+(polygon[1][i]-polygon[0][i])*u/10+
                          (polygon[3][i]-polygon[0][i])*v/7 for i in (0,1))
                assert not any(_inside(p,b) for b in nearby), 'Alley garden crosses a surveyed footprint'
    drive = [(r, a, b) for r in roads if r['tags'].get('highway') in kinds
             for a, b in zip(r['points'], r['points'][1:])]
    for face in concrete:
        if min(p[2] for p in face) == 0:
            continue
        center = tuple(sum(p[i] for p in face) / len(face) for i in range(2))
        assert all(_distance(center, a, b) >= r['width'] / 2 for r, a, b in drive), 'Sidewalk covers asphalt'
    car = Mesh()
    _car(car, (0, 0), 0, 1)
    assert sum(map(len, car.groups.values())) > 900
    assert any(min(p[2] for p in f) < 110 < max(p[2] for p in f) for f in car.groups['CarGlass'])
    body = car.groups['CarSilver_Collision']
    _closed_surface(body)
    assert len({round(p[2]) for f in body for p in f}) >= 12, 'Body lost formed hood/trunk sections'
    assert len(car.groups['Chrome']) > 100, 'Wheels lost curved rims and alloy spokes'
    tyre = [face for face in car.groups['Rubber'] if all(20-.001<=math.hypot(p[0]+455*.3,p[2]-38)<=31.001 and
            abs(p[1]+181*.48)<=12.501 for p in face)]
    assert len(tyre)==168
    _closed_surface(tyre)
    assert min(p[2] for f in car.groups['Rubber'] for p in f) >= 7, 'Tyres intersect ground'
    planter = Mesh()
    _planter(planter, (0, 245), 0, 0)
    assert min(p[1] for f in planter.groups['Wood_Collision'] for p in f) >= 190, 'Planted alley loses clear passage'
    leaf = Mesh()
    _leaf(leaf, (0, 0, 0), (1, 0, .2), 12, 5)
    _closed_surface(leaf.groups['Leaf'])
    shrub = Mesh()
    _shrub(shrub, (0, 0, 90), 18, 60, 31)
    assert all(len(face) == 3 and all(math.dist(a, b) < 15 for a, b in zip(face, face[1:] + face[:1]))
               for face in shrub.groups['Leaf']), 'Shrub foliage reverted to large faceted lobes'
    variation = Mesh()
    _shrub(variation, (0, 0, 90), 18, 60, 32)
    assert shrub.groups['Leaf'] != variation.groups['Leaf'], 'Plant silhouettes repeat identically'
    production_foliage = Mesh()
    production_foliage.groups['Leaf'] = mesh.groups['Leaf']
    _survives_import(production_foliage)
    for builder in (lambda m: _grass(m, (42160, -10332, 60), 9, 76, 41),
                    lambda m: _bin_set(m, (42078, -10693), -102.7, 1),
                    lambda m: _clothesline(m, (42143, -10769), -102.7, 317)):
        detail = Mesh()
        builder(detail)
        assert all(not material.endswith('_Collision') for material in detail.groups), 'New art acquired collision'
        _survives_import(detail)
        for material, faces in detail.groups.items():
            if material != 'White':
                _closed_surface(faces)
    cloth = Mesh()
    _clothesline(cloth, (0, 0), 0, 317)
    _closed_surface(cloth.groups['Trim'])
    assert all(math.isfinite(v) for faces in mesh.groups.values() for f in faces for p in f for v in p)
    print('Plateau street checks passed:', counts)


if __name__ == '__main__':
    main()
