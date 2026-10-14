"""CPU plan for the retained 200 m east context; no old district regeneration.

Only new closure OBJ batches, metadata and a separate radar header are written.
Existing surveyed context roads/building shells remain their original assets.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

from plateau_batches import spatial_batches
from plateau_context import DRIVE
from plateau_edges import _barricade, PREFIX as OLD_PREFIX
from plateau_mesh import Mesh
from plateau_streets import _distance, WALK_ROUTE
from prepare_lafontaine import ROOT, clip_segment, road_width, tags, xy

DATA = Path('Data/Plateau/EastExtension')
HEADER = Path('Source/Quebec/LaFontaineExtensionMap.h')
PREFIX = 'Plateau east extension '
ASSETS = '/Game/Plateau/EastExtension'
EXPANSION_CM = 20000.
FLOOR_OVERLAP_CM = 50.
WALL_OVERLAP_CM = 35.
BOUNDARY_HEIGHT_CM = 400.
ORIGINAL_WALL_HEIGHT_CM = 200.
SOURCE_HASHES = {
    'Data/LaFontaine/osm.xml': 'fe4410d45007a627bf6d9b9ddeeae329fa9cdd7492dfb5fa6beff851e7cf8f86',
    'Data/LaFontaine/layout.json': '4238d6ed45d5fb890e0f8dbcb672de0803c6dc7079b0b6a86b386d82ebbb4250',
    'Data/Plateau/ContextGeometry/context.json': '74764fd01528c320439692fdc6eefd3394770e547f425b886ceabbd73fc9392a',
    'Data/Plateau/EdgesGeometry/edges.json': '9b2adcc383903d64014e5a09851cea786aea5af4307242f5a37dc83362323a35',
    'Source/Quebec/LaFontaineMap.h': '80a96e858c315584598acd8d87dfb758ba45f64a58ccd4b6f5222ddb56ff1700',
}


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def sources(root=ROOT):
    got = {p: sha(Path(root) / p) for p in SOURCE_HASHES}
    assert got == SOURCE_HASHES, 'Retained district/context source changed; review before authoring'
    return got


def inside(p, b, epsilon=1e-7):
    return b[0]-epsilon <= p[0] <= b[2]+epsilon and b[1]-epsilon <= p[1] <= b[3]+epsilon


def _roads(root, context, bounds):
    doc = ET.parse(root / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {n.get('id'): xy(float(n.get('lat')), float(n.get('lon'))) for n in doc.findall('node')}
    retained = {(r['source'], tuple(s['node_ids'])): s['centerline_xy'] for r in context['roads'] for s in r['segments']}
    roads, exits = [], []
    for way in sorted(doc.findall('way'), key=lambda w: int(w.get('id'))):
        properties, refs = tags(way), [n.get('ref') for n in way.findall('nd')]
        if properties.get('highway') not in DRIVE: continue
        source, width = 'way/' + way.get('id'), road_width(properties)
        for a, b in zip(refs, refs[1:]):
            if a not in nodes or b not in nodes: continue
            line = clip_segment(nodes[a], nodes[b], bounds)
            if not line or math.dist(*line) < .01: continue
            key = (source, (a, b))
            assert key in retained, ('Road is absent from existing context visuals', key)
            actual = clip_segment(*retained[key], bounds)
            assert actual and all(math.dist(x, y) < 1e-6 for x, y in zip(line, actual))
            road = {'source': source, 'node_ids': [a, b], 'name': properties.get('name', ''),
                    'highway': properties['highway'], 'width_cm': width,
                    'centerline_xy': [list(p) for p in line]}
            roads.append(road)
            for i, point in enumerate(line):
                for edge, axis, limit in [('east', 0, bounds[2]), ('south', 1, bounds[1]), ('north', 1, bounds[3])]:
                    if abs(point[axis]-limit) > .001 or abs(line[1-i][axis]-limit) <= .001: continue
                    length = math.dist(point, line[1-i])
                    outward = [(point[j]-line[1-i][j])/length for j in (0, 1)]
                    tangent = 1-axis
                    half = width / (2*abs(outward[axis]))
                    exits.append({'source': source, 'street': road['name'], 'edge': edge, 'axis': axis,
                                  'mapped_exit_xy': list(point), 'interior_reference_xy': list(line[1-i]),
                                  'outward_direction': outward, 'road_width_cm': width,
                                  'perimeter_interval_cm': [point[tangent]-half, point[tangent]+half]})
    return roads, exits


def _closures(exits, bounds):
    # Merge touching roadway footprints along a perimeter edge. Three north-edge
    # source ways describe one overlapping corridor, not three stacked barricades.
    groups = []
    for side in ('east', 'south', 'north'):
        active = None
        for exit in sorted([e for e in exits if e['edge'] == side], key=lambda e: e['perimeter_interval_cm'][0]):
            lo, hi = exit['perimeter_interval_cm']
            if active is not None and lo <= active['interval'][1]:
                active['members'].append(exit); active['interval'][1] = max(active['interval'][1], hi)
            else:
                active = {'members': [exit], 'interval': [lo, hi]}; groups.append(active)
    result = []
    for group in groups:
        members = group['members']; first = members[0]
        if len(members) == 1:
            point, outward, width = first['mapped_exit_xy'], first['outward_direction'], first['road_width_cm']
        else:
            point = list(first['mapped_exit_xy']); point[1-first['axis']] = sum(group['interval'])/2
            outward = {'east': [1., 0.], 'north': [0., 1.], 'south': [0., -1.]}[first['edge']]
            width = group['interval'][1]-group['interval'][0]
        across = [-outward[1], outward[0]]
        record = {'source': '+'.join(sorted({e['source'] for e in members})),
                  'sources': sorted({e['source'] for e in members}), 'edge': first['edge'],
                  'street': ' / '.join(sorted({e['street'] for e in members if e['street']})),
                  'mapped_exit_xy': list(point), 'source_exits': members,
                  'outward_direction': outward, 'across_road_direction': across,
                  'road_width_cm': width, 'perimeter_interval_cm': group['interval'],
                  'yaw': math.degrees(math.atan2(across[1], across[0])), 'illustrative': True,
                  'composite_perimeter_alignment': len(members) > 1}
        for inset in range(350, 2001, 50):
            record['inset_cm'] = float(inset)
            record['closure_center_xy'] = [point[i]-outward[i]*inset for i in (0, 1)]
            candidate = Mesh(); _barricade(candidate, record)
            if all(inside(p, bounds) for faces in candidate.groups.values() for f in faces for p in f): break
        else: raise AssertionError(('Closure cannot fit the retained strip', record['sources']))
        center = record['closure_center_xy']; q = math.radians(record['yaw'])
        record['route_clearance_cm'] = min(_distance(center, a, b) for a, b in zip(WALK_ROUTE, WALK_ROUTE[1:]))
        record['sign'] = {'text': 'RUE BARRÉE', 'position': [center[0]-math.sin(q)*5.3, center[1]+math.cos(q)*5.3, 145.],
                          'yaw': math.degrees(math.atan2(-outward[1], -outward[0])), 'size': 19.}
        result.append(record)
    return result


def original_radar_prefix(root=ROOT):
    """Retain the complete original initializer bytes; do not reformat roads."""
    path = Path(root)/'Source/Quebec/LaFontaineMap.h'
    assert sha(path) == SOURCE_HASHES['Source/Quebec/LaFontaineMap.h'], 'Original road header changed'
    text = path.read_bytes().decode('ascii')
    marker = 'const FVector RoadSegments[][2] = {\n'
    assert text.count(marker) == 1
    body = text.split(marker, 1)[1].split('};', 1)[0]
    assert body and body.endswith('}\n'), 'Expected frozen prefix without a trailing comma'
    rows = []
    for line in body.splitlines():
        match = re.fullmatch(r'\{FVector\(([^()]+)\),FVector\(([^()]+)\)\},?', line)
        assert match, 'Unexpected original road initializer'
        points = [[float(v) for v in group.split(',')] for group in match.groups()]
        assert all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in points)
        rows.append(points)
    assert rows, 'Combined radar requires the unchanged nonempty original roads'
    return body, rows


def build(root=ROOT):
    root = Path(root); before = sources(root)
    radar_prefix, original_radar = original_radar_prefix(root)
    context = json.loads((root / 'Data/Plateau/ContextGeometry/context.json').read_text())
    original = context['bounds_xy']; outer = context['outer_bounds_xy']
    assert abs(outer[2]-original[2]-EXPANSION_CM) < 1e-6 and context['buffer_cm'] == EXPANSION_CM
    bounds = [original[2], original[1], outer[2], original[3]]
    roads, exits = _roads(root, context, bounds); closures = _closures(exits, bounds)
    assert len(roads) == 143 and len(exits) == 12 and len(closures) == 10, 'Unexpected surveyed extension extent'
    mesh = Mesh()
    for record in closures: _barricade(mesh, record)
    mesh, batches, tile = spatial_batches(mesh, tile_size_cm=10000, max_batches=80)
    for name, metadata in batches.items():
        points = [p for face in mesh.groups[name] for p in face]
        metadata['bounds_cm'] = [[op(p[i] for p in points) for i in range(3)] for op in (min, max)]
        assert all(inside(p, bounds) for p in points) and not metadata['collision']
    edges = json.loads((root / 'Data/Plateau/EdgesGeometry/edges.json').read_text())
    old_labels = sorted([OLD_PREFIX+n for n in edges['materials']] + [OLD_PREFIX+'sign '+e['source'] for e in edges['closures']])
    assert len(old_labels) == 10 and len(edges['materials']) == 8
    x0, y0, x1, y1 = bounds; cy = (y0+y1)/2
    hidden = {'floor': {'label': PREFIX+'collision floor', 'location_cm': [(x0-FLOOR_OVERLAP_CM+x1)/2, cy, -100.],
                        'size_cm': [x1-x0+FLOOR_OVERLAP_CM, y1-y0, 200.], 'top_z_cm': 0., 'join_overlap_cm': FLOOR_OVERLAP_CM},
              'bounds': [{'label': PREFIX+side+' boundary', 'location_cm': [(x0-WALL_OVERLAP_CM+x1)/2, y, BOUNDARY_HEIGHT_CM/2],
                          'size_cm': [x1-x0+WALL_OVERLAP_CM, 70., BOUNDARY_HEIGHT_CM], 'join_overlap_cm': WALL_OVERLAP_CM,
                          'outward_normal': [0., normal, 0.], 'bottom_z_cm': 0., 'top_z_cm': BOUNDARY_HEIGHT_CM}
                         for side, y, normal in [('south', y0, -1.), ('north', y1, 1.)]]}
    # Preserve the original east actor's exact scale, collision and hidden state.
    # Its 0–200cm span proved jumpable; a separate cap closes only the new outer edge.
    hidden['bounds'].append({'label': PREFIX+'east boundary cap',
                             'location_cm': [x1, cy, (ORIGINAL_WALL_HEIGHT_CM+BOUNDARY_HEIGHT_CM)/2],
                             'size_cm': [70., y1-y0, BOUNDARY_HEIGHT_CM-ORIGINAL_WALL_HEIGHT_CM],
                             'outward_normal': [1., 0., 0.], 'bottom_z_cm': ORIGINAL_WALL_HEIGHT_CM,
                             'top_z_cm': BOUNDARY_HEIGHT_CM})
    report = {'version': 1, 'generator_sha256': sha(Path(__file__)), 'source_hashes': before, 'source': 'Data/LaFontaine/osm.xml',
              'attribution': '(c) OpenStreetMap contributors, ODbL 1.0', 'closures_fictional': True,
              'original_bounds_xy': original, 'extension_bounds_xy': bounds,
              'expanded_bounds_xy': [original[0], original[1], x1, original[3]],
              'east_wall_delta_cm': [EXPANSION_CM, 0., 0.], 'hidden_collision': hidden,
              'old_closure_labels_to_hide': old_labels, 'roads': roads, 'road_segments': len(roads),
              'source_road_exit_count': len(exits), 'closures': closures, 'materials': batches,
              'triangles': sum(m['triangles'] for m in batches.values()), 'tile_size_cm': tile,
              'reuse_context_actor_count': len(context['materials']), 'reuse_context_source': 'Data/Plateau/ContextGeometry/context.json',
              'radar_original_segments': len(original_radar), 'radar_total_segments': len(original_radar)+len(roads),
              'radar_original_prefix_sha256': hashlib.sha256(radar_prefix.encode('ascii')).hexdigest(),
              'traffic_expanded': False, 'spawn_missions_residents_modified': False,
              'limits': ['Original east boundary retains its 200cm height and all other properties; a separate 200–400cm cap and new 400cm north/south strips address the observed running-jump escape. Native containment remains unverified for this repair.',
                         'Context uses flat road/apron visuals and estimated building heights, without newly detailed sidewalks/facades.',
                         'Radar roads only; old traffic graph and every mission/spawn/resident placement remain unchanged.',
                         'CPU preparation does not prove saved-map collision, visual appearance or playable traversal.']}
    assert sources(root) == before
    return mesh, report


def header(report, root=ROOT):
    vec = lambda p: 'FVector('+','.join(f'{v:.3f}' for v in (*p, 0.))+')'
    lines = ['// Generated by Scripts/montreal_east_extension.py. (c) OpenStreetMap contributors, ODbL 1.0.',
             '// Additive radar geometry only. Original LaFontaineMap.h and traffic graph are unchanged.', '#pragma once',
             'namespace LaFontaineExtension {', 'const FVector BoundsMin='+vec(report['expanded_bounds_xy'][:2])+';',
             'const FVector BoundsMax='+vec(report['expanded_bounds_xy'][2:])+';', 'const FVector RoadSegments[][2] = {']
    lines += ['{'+','.join(vec(p) for p in r['centerline_xy'])+'},' for r in report['roads']]
    lines += ['};', 'const float RoadSegmentWidths[] = {', ','.join(f"{r['width_cm']:.3f}f" for r in report['roads']), '};']
    prefix, original = original_radar_prefix(root)
    assert report['radar_original_segments'] == len(original) and report['radar_total_segments'] == len(original)+len(report['roads'])
    assert report['radar_original_prefix_sha256'] == hashlib.sha256(prefix.encode('ascii')).hexdigest()
    extension = '\n'.join('{'+','.join(vec(p) for p in r['centerline_xy'])+'},' for r in report['roads'])+'\n'
    # A separate comma preserves the old final initializer line byte-for-byte.
    return '\n'.join(lines)+'\n// Radar only: exact original prefix, then surveyed extension. Never use for traffic.\nconst FVector RadarRoadSegments[][2] = {\n'+prefix+',\n'+extension+'};\n}\n'


def prepare(root=ROOT):
    root = Path(root); mesh, report = build(root); out = root / DATA; directory = out / 'Geometry'
    out.mkdir(parents=True, exist_ok=True); mesh.write(directory)
    report['geometry_files'] = {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in sorted(directory.glob('*.obj'))}
    (out / 'extension.json').write_text(json.dumps(report, indent=2)+'\n')
    (root / HEADER).write_text(header(report, root)); (out / '.gitignore').write_text('Geometry/\n')
    return report


def load(root=ROOT):
    root = Path(root); saved = json.loads((root / DATA / 'extension.json').read_text()); _, expected = build(root)
    geometry = saved.pop('geometry_files'); assert saved == json.loads(json.dumps(expected)), 'Extension metadata is stale or edited'
    assert set(geometry) == {name+'.obj' for name in saved['materials']}
    for name, entry in geometry.items():
        p = root / DATA / 'Geometry' / name
        assert p.is_file() and p.stat().st_size == entry['bytes'] and sha(p) == entry['sha256'], ('Missing/changed new closure geometry', name)
    assert (root / HEADER).read_text() == header(saved, root), 'Separate radar header is stale'
    saved['geometry_files'] = geometry
    return saved


if __name__ == '__main__':
    r = prepare(); print('MONTREAL_EAST_PREPARED', r['road_segments'], len(r['closures']), len(r['materials']), r['triangles'])
