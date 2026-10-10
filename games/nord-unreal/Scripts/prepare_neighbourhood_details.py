"""Original, instanced street furniture from retained OSM points and chalet context."""
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from prepare_lafontaine import inside, nearest, tags, xy, ROAD_HIGHWAYS
from prepare_park_comic import Mesh

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/NeighbourhoodDetails'
PALETTE = {'Metal': (.035, .065, .075), 'Blue': (.025, .16, .32),
           'White': (.78, .78, .68), 'Glass': (.12, .24, .25),
           'Wood': (.31, .20, .10), 'Green': (.025, .12, .075)}


def models(directory):
    result = []
    mesh = Mesh()
    for y in (-36, 36):
        mesh.rod((0, y, 0), (0, y, 68), 3, 'Metal', 8)
    mesh.rod((0, -36, 68), (0, 36, 68), 3, 'Metal', 8)
    result.append(mesh.save('BikeRack', directory))
    mesh = Mesh()
    for x in (-56, 56):
        center = (x, 0, 36)
        for i in range(24):
            a, b = i * math.tau / 24, (i + 1) * math.tau / 24
            p = (x + 34 * math.cos(a), 0, 36 + 34 * math.sin(a))
            q = (x + 34 * math.cos(b), 0, 36 + 34 * math.sin(b))
            mesh.rod(p, q, 2.6, 'Metal', 6)
            if i % 4 == 0: mesh.rod(center, p, .7, 'White', 5)
    for a, b in (((-56, 0, 36), (-20, 0, 88)), ((-20, 0, 88), (4, 0, 36)),
                 ((4, 0, 36), (-56, 0, 36)), ((-20, 0, 88), (40, 0, 86)),
                 ((40, 0, 86), (4, 0, 36)), ((40, 0, 86), (56, 0, 36)),
                 ((40, 0, 86), (35, 0, 108)), ((-20, 0, 88), (-22, 0, 99))):
        mesh.rod(a, b, 2.4, 'Blue', 7)
    mesh.box((-24, 0, 101), (24, 18, 5), 'Metal')
    mesh.rod((35, -23, 108), (35, 23, 108), 2.5, 'Metal', 8)
    mesh.rod((4, -14, 36), (4, 14, 36), 1.8, 'White', 6)
    for y in (-17, 17): mesh.box((4, y, 36), (11, 8, 3), 'Metal')
    mesh.box((-54, 0, 79), (33, 26, 4), 'Metal')
    result.append(mesh.save('CityBicycle', directory))
    mesh = Mesh()
    mesh.rod((0, 0, 0), (0, 0, 285), 3.5, 'Metal', 8)
    mesh.box((0, 0, 265), (5, 43, 57), 'Blue')
    mesh.box((3, 0, 247), (1.5, 36, 13), 'White')
    result.append(mesh.save('BusStop', directory))
    mesh = Mesh()
    for x in (-66, 66):
        for y in (-145, 145): mesh.rod((x, y, 0), (x, y, 248), 4.5, 'Metal', 8)
    mesh.box((0, 0, 251), (155, 316, 12), 'Blue')
    mesh.box((-67, 0, 130), (3, 285, 224), 'Glass')
    for y in (-144, 144): mesh.box((0, y, 130), (131, 3, 224), 'Glass')
    for y in (-90, 90): mesh.rod((-30, y, 0), (-30, y, 45), 4, 'Metal', 7)
    mesh.box((-30, 0, 47), (52, 225, 6), 'Wood')
    mesh.box((-57, 0, 74), (5, 225, 46), 'Wood')
    result.append(mesh.save('BusShelter', directory))
    mesh = Mesh()
    mesh.rod((0, 0, 0), (0, 0, 318), 3.5, 'Metal', 8)
    for z in (280, 312): mesh.box((0, 0, z), (5, 160, 27), 'Green')
    result.append(mesh.save('StreetNames', directory))
    mesh = Mesh()
    ring = [(58 * math.cos(i * math.tau / 24), 58 * math.sin(i * math.tau / 24), 76) for i in range(24)]
    mesh.face(ring, 'Wood', (0, 0, 1))
    mesh.face([(x, y, 71) for x, y, z in reversed(ring)], 'Wood', (0, 0, -1))
    for a, b in zip(ring, ring[1:] + ring[:1]): mesh.face([a, b, (b[0], b[1], 71), (a[0], a[1], 71)], 'Wood')
    mesh.rod((0, 0, 5), (0, 0, 73), 7, 'Metal', 10)
    for angle in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
        c, s = math.cos(angle), math.sin(angle)
        p = lambda x, y, z: (c * x - s * y, s * x + c * y, z)
        for x in (91, 129):
            for y in (-19, 19): mesh.rod(p(x, y, 0), p(x, y, 45), 2.2, 'Metal', 6)
        mesh.face([p(88, -25, 46), p(132, -25, 46), p(132, 25, 46), p(88, 25, 46)], 'Wood', (0, 0, 1))
        for y in (-24, 24): mesh.rod(p(130, y, 44), p(137, y, 88), 2.2, 'Metal', 6)
        mesh.face([p(134, -24, 69), p(134, 24, 69), p(137, 24, 88), p(137, -24, 88)], 'Wood')
        mesh.rod((0, 0, 7), p(39, 0, 7), 3, 'Metal', 6)
    for x, y in ((-18, 16), (25, -20)):
        mesh.box((x, y, 78), (15, 15, 3), 'White')
        mesh.rod((x, y, 80), (x, y, 91), 5, 'White', 10)
    result.append(mesh.save('TerraceTable', directory))
    return result


def main():
    geometry = OUT / 'Geometry'
    geometry.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'Data/LaFontaine/osm.xml'
    park_path = ROOT / 'Data/ParkComic/layout.json'
    city_path = ROOT / 'Data/CityBuildings/manifest.json'
    osm = ET.parse(source).getroot()
    nodes = {e.get('id'): e for e in osm.findall('node')}
    ways = {e.get('id'): e for e in osm.findall('way')}
    coordinates = lambda way: [xy(float(nodes[n.get('ref')].get('lat')), float(nodes[n.get('ref')].get('lon'))) for n in way.findall('nd')]
    layout = json.loads((ROOT / 'Data/LaFontaine/layout.json').read_text())
    park = json.loads(park_path.read_text())
    city = json.loads(city_path.read_text())
    shells = unary_union([Polygon(r).buffer(0) for b in city['buildings'] for r in b['footprints']])
    water = unary_union([Polygon(r).buffer(0) for r in park['shorelines'] if len(r) > 3])
    paths = unary_union([LineString(p).buffer(235) for p in park['paths'] if len(p) > 1])
    asphalt = unary_union([LineString(p).buffer(w / 2 + 60) for p, w in zip(layout['roads'], layout['road_widths'])])
    instances, signs, places = [], [], []
    def add(model, p, yaw, osm_id, kind):
        assert all(math.isfinite(v) for v in (*p, yaw))
        if asphalt.covers(Point(p)) or shells.covers(Point(p)) or water.covers(Point(p)): return False
        instances.append({'model': model, 'position': [p[0], p[1], 7], 'yaw': yaw, 'osm': osm_id, 'kind': kind})
        return True
    for ident, node in nodes.items():
        latlon = (float(node.get('lat')), float(node.get('lon')))
        if not inside(latlon): continue
        t, p = tags(node), xy(*latlon)
        if t.get('highway') != 'bus_stop' and t.get('amenity') not in ('bicycle_parking', 'bicycle_rental'): continue
        if shells.covers(Point(p)) or water.covers(Point(p)): continue
        road_point, yaw = nearest(p, layout['roads'])
        angle = math.radians(yaw)
        if t.get('highway') == 'bus_stop':
            if not add('BusStop', p, yaw, ident, 'bus_stop'): continue
            normal = (-math.sin(angle), math.cos(angle))
            side = 1 if sum((p[i] - road_point[i]) * normal[i] for i in range(2)) >= 0 else -1
            if t.get('shelter') == 'yes': add('BusShelter', (p[0] + side * 180 * normal[0], p[1] + side * 180 * normal[1]), yaw - 90, ident, 'shelter')
            signs.append({'text': 'BUS', 'position': [p[0] + 4 * math.cos(angle), p[1] + 4 * math.sin(angle), 272], 'yaw': yaw, 'size': 13, 'width_cm': 43, 'osm': ident})
        else:
            rental = t.get('amenity') == 'bicycle_rental'
            count = 6 if rental else 1
            along = (math.cos(math.radians(yaw)), math.sin(math.radians(yaw)))
            for i in range(count):
                q = (p[0] + along[0] * i * 85, p[1] + along[1] * i * 85)
                if shells.distance(Point(q)) < 90 or water.distance(Point(q)) < 90: continue
                if not add('BikeRack', q, yaw, ident, 'rental_dock' if rental else 'bike_rack'): continue
                if (int(ident) + i) % 3 != 0:
                    add('CityBicycle', (q[0] + 12 * along[1], q[1] - 12 * along[0]), yaw, ident, 'parked_bicycle')
        places.append({'osm': ident, 'kind': t.get('highway', t.get('amenity')), 'xy': list(p), 'name': t.get('name'), 'orientation_estimated': True})
    # Named intersections provide local orientation without inventing storefront identities.
    junctions = {}
    for way in ways.values():
        t = tags(way)
        if t.get('highway') not in ROAD_HIGHWAYS or not t.get('name'): continue
        for n in way.findall('nd'): junctions.setdefault(n.get('ref'), set()).add(t['name'])
    selected = []
    for ident, names in junctions.items():
        if len(names) < 2: continue
        node = nodes[ident];latlon = (float(node.get('lat')), float(node.get('lon')))
        if not inside(latlon): continue
        p = xy(*latlon)
        if any(math.dist(p, q) < 4200 for q in selected): continue
        road_point, yaw = nearest(p, layout['roads'])
        angle = math.radians(yaw)
        candidates = [(p[0] + x * math.cos(angle) - y * math.sin(angle), p[1] + x * math.sin(angle) + y * math.cos(angle)) for x, y in ((800, 850), (-800, 850), (800, -850), (-800, -850))]
        q = next((q for q in candidates if shells.distance(Point(q)) > 90 and water.distance(Point(q)) > 90 and not asphalt.covers(Point(q))), None)
        if q is None: continue
        add('StreetNames', q, yaw, ident, 'street_names');selected.append(p)
        for i, name in enumerate(sorted(names)[:2]):
            for prefix in ('Rue ', 'Avenue ', 'Boulevard '): name = name.removeprefix(prefix)
            signs.append({'text': name[:26], 'position': [q[0] + 4 * math.cos(angle), q[1] + 4 * math.sin(angle), 308 - 32 * i], 'yaw': yaw, 'size': 10, 'width_cm': 160, 'osm': ident})
    # Terrace furniture follows the long pond-facing chalet wall; every table has walking clearance.
    chalet = Polygon(coordinates(ways['27395538'])).buffer(0)
    park_polygon = Polygon(park['park_outline']).buffer(0)
    a, b = (3208.5319473436293, 4609.761200004641), (5158.296135015912, 1020.8043999854794)
    length = math.dist(a, b);along = ((b[0] - a[0]) / length, (b[1] - a[1]) / length);normal = (-along[1], along[0])
    tables = []
    for distance in range(350, int(length) - 200, 500):
        for outward in (240, 590):
            p = (a[0] + along[0] * distance + normal[0] * outward, a[1] + along[1] * distance + normal[1] * outward)
            point = Point(p)
            if not park_polygon.covers(point.buffer(160)) or chalet.distance(point) < 155 or water.distance(point) < 180 or paths.covers(point): continue
            if any(math.dist(p, tree['xy']) < 180 for tree in park['trees']): continue
            if any(math.dist(p, q) < 320 for q in tables): continue
            add('TerraceTable', p, math.degrees(math.atan2(along[1], along[0])), '27395538', 'chalet_terrace');tables.append(p)
    result = {'models': models(geometry), 'palette': PALETTE, 'instances': instances, 'signs': signs, 'places': places,
              'source_sha256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in (source, park_path, city_path)},
              'references': ['https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng', 'https://montreal.ca/en/places/parc-la-fontaine'],
              'limits': 'Retained OSM point locations and named junctions; furniture dimensions, corner offsets, bicycle occupancy and chalet terrace arrangement are original estimates. Decorative NoCollision meshes, without current stop-service or exact Street View claims.'}
    assert len(tables) >= 4, 'Missing clear chalet terrace seating'
    assert 30 <= len(places) <= 200 and len(instances) < 500
    (OUT / 'layout.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('NORD_NEIGHBOURHOOD_PREPARED', len(instances), 'instances;', len(signs), 'signs;', len(tables), 'terrace tables')


if __name__ == '__main__': main()
