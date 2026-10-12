"""College and Bathurst layout, header and traffic graph checks against the checked-in sources (no Unreal required)."""
import ast
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
import prepare_college_bathurst as cb
import prepare_lafontaine as lf

SNAP = 40.0  # QuebecGameplay.cpp joins road endpoints within FMath::Square(40.f).


def traffic_road_links(segments):
    """Port of TrafficRoadLinks: segment I side A links to every segment J with an endpoint within 40 cm."""
    count = len(segments); links = [[] for _ in range(count*2)]
    for i in range(count):
        for j in range(i + 1, count):
            for a in range(2):
                for b in range(2):
                    p, q = segments[i][a], segments[j][b]
                    if (q[0] - p[0])**2 + (q[1] - p[1])**2 <= SNAP**2:
                        if j not in links[i*2 + a]: links[i*2 + a].append(j)
                        if i not in links[j*2 + b]: links[j*2 + b].append(i)
    return links


def prune_traffic_branches(roads, links):
    """Port of PruneTrafficBranches: drop segments until every retained endpoint has an onward street."""
    changed = True
    while changed:
        changed = False
        for i in range(len(roads)):
            if roads[i]:
                for side in range(2):
                    if not any(roads[n] for n in links[i*2 + side]):
                        roads[i] = False; changed = True; break
    return roads


def components(roads, links):
    parent = list(range(len(roads)))
    def find(i):
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i, keep in enumerate(roads):
        if keep:
            for n in links[i*2] + links[i*2 + 1]:
                if roads[n]: parent[find(i)] = find(n)
    return {find(i) for i, keep in enumerate(roads) if keep}, find


def header_vectors(text, name):
    body = re.search(r'const FVector ' + re.escape(name) + r'(?:\[\])?(?:\[2\])? ?= ?\{?\n?(.*?)\n?\}?;', text, re.S).group(1)
    return [tuple(map(float, v.split(','))) for v in re.findall(r'FVector\(([^)]+)\)', body)]


def main():
    data = json.loads((cb.DATA/'layout.json').read_text())
    header = cb.HEADER.read_text()
    root = ET.parse(cb.DATA/'osm.xml').getroot()
    nodes = {e.get('id'): (float(e.get('lat')), float(e.get('lon'))) for e in root.findall('node')}
    x0, y0, x1, y1 = cb.box()

    # Projection: the Montreal formula at a shared origin, and College x Bathurst at (0, 0).
    saved = lf.ORIGIN
    try:
        lf.ORIGIN = cb.ORIGIN
        for lat, lon in [(43.6530, -79.4135), (43.6595, -79.4015), (43.6564664, -79.4077041), (43.657, -79.41)]:
            assert cb.xy(lat, lon) == lf.xy(lat, lon), (lat, lon)
    finally:
        lf.ORIGIN = saved
    assert math.hypot(*cb.xy(*nodes[cb.INTERSECTION])) < 1e-6 and data['landmarks']['intersection']['position'] == [0, 0]
    assert data['origin'] == list(cb.ORIGIN) and data['bounds'] == list(cb.BOUNDS)
    assert 95000 < x1 - x0 < 98000 and 72000 < y1 - y0 < 73000

    # College and Bathurst exist and reach the district edges they cross.
    roads, names = data['roads'], data['road_names']
    assert len(roads) == len(names) == len(data['road_widths']) == len(data['road_oneway']) == len(data['road_ways']) == data['counts']['roads']
    ends = lambda name: [p for r, n in zip(roads, names) if n == name for p in (r[0], r[-1])]
    college, bathurst = ends('College Street'), ends('Bathurst Street')
    assert college and bathurst
    assert min(abs(p[0] - x0) for p in college) < 1 and min(abs(p[0] - x1) for p in college) < 1, 'College Street does not reach west and east'
    assert min(abs(p[1] - y0) for p in bathurst) < 1 and min(abs(p[1] - y1) for p in bathurst) < 1, 'Bathurst Street does not reach south and north'

    # Sneaky Dee's: OSM footprint, massing height between 6 and 15 m.
    dees = data['landmarks']['sneaky_dees']
    way = next(w for w in root.findall('way') if w.get('id') == cb.SNEAKY_DEES)
    assert lf.tags(way).get('name') == "Sneaky Dee's" and lf.tags(way).get('addr:housenumber') == '431'
    source = Polygon([cb.xy(*nodes[n.get('ref')]) for n in way.findall('nd')])
    footprint = Polygon(dees['footprint'])
    assert footprint.contains(source.centroid) and abs(footprint.area - source.area) < 1e4
    massing = json.loads((cb.DATA/'massing.geojson').read_text())['features']
    heights = [f['properties']['MAX_HEIGHT']*100 for f in massing
               if (shape := Polygon([cb.xy(lat, lon) for lon, lat in f['geometry']['coordinates'][0]]).buffer(0)).intersects(source)
               and shape.intersection(source).area >= .5*min(shape.area, source.area)]
    assert dees['height_source'] == 'massing' and any(abs(dees['height'] - h) < .1 for h in heights), (dees['height'], heights)
    assert 600 <= dees['height'] <= 1500
    # No measured massing footprint in the bounds is lost: kept footprints cover at least half of each.
    kept_area = unary_union([Polygon(b['footprint']) for b in data['buildings']]); frame = box(x0, y0, x1, y1)
    for f in massing:
        shape = Polygon([cb.xy(lat, lon) for lon, lat in f['geometry']['coordinates'][0]]).buffer(0)
        if f['properties']['MAX_HEIGHT'] > 0 and shape.area >= 40000 and frame.contains(shape.centroid):
            assert shape.intersection(kept_area).area >= .5*shape.area, f['properties']
    sources = {b['height_source'] for b in data['buildings']}
    assert sources <= {'massing', 'osm_height', 'osm_levels', 'fallback'} and all(250 <= b['height'] <= 10000 for b in data['buildings'])
    building = next(b for b in data['buildings'] if b['id'] == cb.SNEAKY_DEES)
    assert building['height'] == dees['height'] and building['footprint'] == dees['footprint']

    # Spawn on the College sidewalk in front of Sneaky Dee's; the car on College facing along it.
    spawn = Point(data['spawn'][:2])
    college_lines = [LineString(r) for r, n in zip(roads, names) if n == 'College Street']
    to_college = lambda p: min(line.distance(p) for line in college_lines)
    assert data['spawn'][2] == cb.SPAWN_Z and footprint.distance(spawn) <= 2500, footprint.distance(spawn)
    assert to_college(spawn) < to_college(footprint.centroid) and to_college(spawn) < to_college(Point(dees['entrance']))
    nearest = min(range(len(roads)), key=lambda i: LineString(roads[i]).distance(spawn))
    assert names[nearest] == 'College Street' and not footprint.contains(spawn)
    assert not any(Polygon(b['footprint']).contains(spawn) for b in data['buildings'])
    car = Point(data['car'][:2]); line = min(college_lines, key=lambda l: l.distance(car))
    assert line.distance(car) < .01 and data['car'][2] == cb.CAR_Z
    yaw = math.radians(data['car_yaw'])
    assert any(abs(math.sin(math.atan2(b[1] - a[1], b[0] - a[0]) - yaw)) < 1e-3 and LineString([a, b]).distance(car) < .01
               for a, b in zip(line.coords, line.coords[1:]))

    # Road segments: finite, non-degenerate and inside the gameplay bounds.
    segments = [(a, b) for r in roads for a, b in zip(r, r[1:])]
    assert len(segments) == data['counts']['road_segments']
    for a, b in segments:
        assert all(math.isfinite(v) for v in (*a, *b)) and math.dist(a, b) >= .5
        assert all(x0 - .01 <= p[0] <= x1 + .01 and y0 - .01 <= p[1] <= y1 + .01 for p in (a, b)), (a, b)
    for track in data['tram_lines']:
        assert all(x0 - .01 <= p[0] <= x1 + .01 and y0 - .01 <= p[1] <= y1 + .01 for p in track['points'])
    routes = {r for track in data['tram_lines'] for r in track['routes']}
    assert {'506', '511'} <= routes, routes

    # Header arrays match the layout exactly, in the game's segment order.
    assert cb.ATTRIBUTION[0] in header.split('#pragma')[0] and cb.ATTRIBUTION[1] in header.split('#pragma')[0]
    assert lf.road_segments_text(roads) in header and lf.road_widths_text(roads, data['road_widths']) in header
    assert header_vectors(header, 'Spawn') == [tuple(data['spawn'])]
    assert header_vectors(header, 'CarSpawn') == [tuple(data['car'])]
    assert header_vectors(header, 'SneakyDees') == [(*dees['centroid'], 0.)]
    assert header_vectors(header, 'StreetLamps') == [tuple(p) for p in data['lamps']]
    rows = header_vectors(header, 'RoadSegments')
    widths = re.search(r'const float RoadSegmentWidths\[\] = \{\n(.*?)\n\};', header, re.S).group(1).split(',')
    assert len(rows) == 2*len(segments) == 2*len(widths)
    assert [p[:2] for p in rows] == [tuple(p) for a, b in segments for p in (a, b)]
    assert header == cb.header_text(data)

    # The port itself: a spur is pruned back to its junction, and a detached loop stays a second network.
    square = [((0, 0, 0), (1000, 0, 0)), ((1000, 30, 0), (1000, 1000, 0)), ((1000, 1000, 0), (0, 1000, 0)), ((0, 1000, 0), (0, 0, 0)),
              ((1000, 0, 0), (2000, 0, 0)), ((5000, 0, 0), (6000, 0, 0)), ((6000, 0, 0), (5000, 0, 0))]
    toy = traffic_road_links(square)
    assert toy[0] == [3] and toy[1] == [1, 4] and toy[2] == [0, 4]
    toy_kept = prune_traffic_branches([True]*len(square), toy)
    assert toy_kept == [True, True, True, True, False, True, True] and len(components(toy_kept, toy)[0]) == 2

    # Traffic graph: the game's 40 cm snap and dead-end pruning leave one network with both streets.
    segments3 = [(rows[i], rows[i + 1]) for i in range(0, len(rows), 2)]
    links = traffic_road_links(segments3)
    kept = prune_traffic_branches([True]*len(segments3), links)
    roots, find = components(kept, links)
    owner = [n for r, n in zip(roads, names) for _ in r[1:]]
    assert len(roots) == 1, f'{len(roots)} traffic components after pruning'
    assert any(k and owner[i] == 'College Street' for i, k in enumerate(kept)) and any(k and owner[i] == 'Bathurst Street' for i, k in enumerate(kept))

    # Lamps: every OSM street lamp node in bounds, at the lamp-head height.
    lamps = [i for e in root.findall('node') for i in [e.get('id')]
             if lf.tags(e).get('highway') == 'street_lamp' and cb.inside(nodes[i])]
    assert len(lamps) == len(data['lamps']) == data['counts']['lamps'] > 0 and all(p[2] == cb.LAMP_Z for p in data['lamps'])

    # Licence lines travel with the data.
    readme = (cb.DATA/'README.md').read_text()
    assert all(line in readme for line in cb.ATTRIBUTION) and data['attribution'] == cb.ATTRIBUTION

    # The editor script maps every generated OBJ group to an existing Plateau material and blocks only buildings.
    script = (ROOT/'Scripts/create_college_bathurst.py').read_text()
    materials = ast.literal_eval(re.search(r'^MATERIALS=(\{.*?\})$', script, re.M | re.S).group(1))
    groups = {p.stem for p in (cb.DATA/'Geometry').glob('*.obj')}
    assert groups == set(materials), (groups, set(materials))
    assert all((ROOT/'Content/Plateau/Materials'/f'M_{m}.uasset').exists() for m in materials.values())
    assert set(ast.literal_eval(re.search(r'^BLOCKING=(\(.*?\))$', script, re.M).group(1))) == {'Brick', 'Cream', 'Sage', 'Roof', 'Landmark'}
    assert "MAP='/Game/Maps/CollegeBathurst'" in script and 'load_level' not in script and "'/Game/Maps/LaFontaine'" not in script

    # The generated header is plain C++ with a one-line FVector stub.
    compiler = shutil.which('clang++') or shutil.which('g++')
    if compiler:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'map.cpp'
            source.write_text('struct FVector { double X, Y, Z; constexpr FVector(double InX, double InY, double InZ) : X(InX), Y(InY), Z(InZ) {} };\n'
                              f'#include "{cb.HEADER}"\nint main() {{ return int(sizeof(CollegeBathurst::RoadSegments) / sizeof(CollegeBathurst::RoadSegments[0])) == {len(segments)} ? 0 : 1; }}\n')
            subprocess.run([compiler, '-std=c++20', '-Wall', '-Wextra', '-Werror', '-o', str(Path(tmp)/'map'), str(source)], check=True)
            subprocess.run([str(Path(tmp)/'map')], check=True)
    else:
        print('NORD_COLLEGE_BATHURST_TEST compile skipped: no C++ compiler on PATH')
    print('NORD_COLLEGE_BATHURST_TEST_OK', json.dumps({'segments': len(segments), 'traffic_segments': sum(kept), 'components': len(roots),
                                                       'lamps': len(lamps), 'sneaky_dees_m': dees['height']/100, 'compiler': compiler or ''}))


if __name__ == '__main__':
    main()
