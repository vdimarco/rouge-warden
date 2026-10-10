"""Check retained source IDs, clear placement and finite shared furniture geometry."""
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from collections import Counter

from shapely import affinity
from shapely.geometry import LineString, MultiPoint, Point, Polygon
from shapely.ops import unary_union
from prepare_lafontaine import xy

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'Data/NeighbourhoodDetails/layout.json').read_text())
for source, digest in data['source_sha256'].items():
    assert hashlib.sha256((root / source).read_bytes()).hexdigest() == digest, source
osm = ET.parse(root / 'Data/LaFontaine/osm.xml').getroot()
nodes = {e.get('id'): e for e in osm.findall('node')}
park = json.loads((root / 'Data/ParkComic/layout.json').read_text())
city = json.loads((root / 'Data/CityBuildings/manifest.json').read_text())
layout = json.loads((root / 'Data/LaFontaine/layout.json').read_text())
shells = unary_union([Polygon(p).buffer(0) for b in city['buildings'] for p in b['footprints']])
water = unary_union([Polygon(p).buffer(0) for p in park['shorelines'] if len(p) > 3])
asphalt = unary_union([LineString(p).buffer(w / 2 + 60) for p, w in zip(layout['roads'], layout['road_widths'])])
# Preserve the existing 60 cm center margin; full hulls must clear actual asphalt.
footprint_asphalt = unary_union([LineString(p).buffer(w / 2) for p, w in zip(layout['roads'], layout['road_widths'])])
paths = unary_union([LineString(p).buffer(235) for p in park['paths'] if len(p) > 1])
counts = Counter(row['kind'] for row in data['instances'])
assert counts['bus_stop'] >= 30 and counts['parked_bicycle'] >= 60
assert counts['street_names'] >= 30 and counts['chalet_terrace'] >= 4
assert len(data['instances']) < 500 and len(data['models']) == 6
for row in data['instances']:
    p = Point(row['position'][:2])
    assert all(math.isfinite(v) for v in (*row['position'], row['yaw']))
    assert not any(geometry.covers(p) for geometry in (shells, water, asphalt)), row
    assert row['osm'] in nodes or row['osm'] == '27395538'
    if row['kind'] == 'bus_stop':
        n = nodes[row['osm']]
        assert math.dist(row['position'][:2], xy(float(n.get('lat')), float(n.get('lon')))) < .01
    if row['kind'] == 'chalet_terrace':
        assert not paths.covers(p) and water.distance(p) >= 180
        assert all(math.dist(row['position'][:2], t['xy']) >= 180 for t in park['trees'])
for row in data['signs']:
    assert row['osm'] in nodes and row['text'] and '\n' not in row['text']
    assert len(row['text']) * row['size'] * .6 <= row['width_cm'], row
footprints = {}
for model in data['models']:
    vertices, triangles = [], 0
    for line in (root / 'Data/NeighbourhoodDetails/Geometry' / model['file']).read_text().splitlines():
        if line.startswith('v '): vertices.append(tuple(map(float, line.split()[1:])))
        if line.startswith('f '):
            ids = [int(p.split('/')[0]) - 1 for p in line.split()[1:]]
            assert len(ids) == 3 and all(0 <= i < len(vertices) for i in ids)
            a, b, c = [vertices[i] for i in ids]
            u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
            cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            assert sum(n * n for n in cross) > 1.e-7, model['file']
            triangles += 1
    assert triangles == model['triangles'] and 20 < triangles < 5000
    assert all(math.isfinite(v) for p in vertices for v in p)
    # Mesh.save negates OBJ Y; restore Unreal XY before applying actor yaw.
    footprints[Path(model['file']).stem] = MultiPoint([(x, -y) for x, y, z in vertices]).convex_hull
for row in data['instances']:
    footprint = affinity.rotate(footprints[row['model']], row['yaw'], origin=(0, 0))
    footprint = affinity.translate(footprint, *row['position'][:2])
    for name, geometry in (('building', shells), ('water', water), ('asphalt', footprint_asphalt)):
        overlap = footprint.intersection(geometry).area
        assert overlap <= 10, (row, name, 'footprint overlap cm²', overlap)
print('NORD_NEIGHBOURHOOD_SOURCE_OK', dict(counts), 'source IDs, clear centers/full footprints, readable sign bounds and finite meshes')
