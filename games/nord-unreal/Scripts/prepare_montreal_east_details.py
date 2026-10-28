"""CPU-only additive window study on three retained Visitation shells.

Reuse the original context window producer on a strictly filtered source copy.
Never regenerate/import old context assets or change the original eligibility rule.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET

import plateau_context as context
from plateau_ground import signed_area
from plateau_mesh import Mesh
from plateau_streets import _distance, _inside

ROOT = Path(__file__).resolve().parents[1]
DATA = Path('Data/Plateau/EastDetails')
ASSETS = '/Game/Plateau/EastDetails'
PREFIX = 'Plateau east details '
TARGETS = ('345567245', '345578954', '345578982')
COUNTS = {'way/345567245': 18, 'way/345578954': 12, 'way/345578982': 20}
MATERIALS = ('Glass', 'Iron', 'Trim')
SOURCE_HASHES = {
    'Data/LaFontaine/osm.xml': 'fe4410d45007a627bf6d9b9ddeeae329fa9cdd7492dfb5fa6beff851e7cf8f86',
    'Data/Plateau/ContextGeometry/context.json': '74764fd01528c320439692fdc6eefd3394770e547f425b886ceabbd73fc9392a',
    'Data/Plateau/EastExtension/extension.json': '1539d58bc356acf89e37ca565f320f510534ce7d02091c3ab499fb74fb6e60d4',
    'Scripts/plateau_context.py': 'b5df165d154c2c18697cc7884cd486c5f3e056886398cda220e96b9cfcfbf5be',
    'Scripts/plateau_mesh.py': '0db445d502ffeb5a0d77c49fb1cb9d3a1bd49492b6956f37ce96bad505033217',
    'Scripts/plateau_ground.py': '9ba1e57a062d94c6eb2c3ecef2ea191d63d5cf97ada05cccf9e9441a1ce7c445',
    'Scripts/plateau_batches.py': '8a2a46cf1ba27373472d9050d69a4461aa4df8b2202d10bdbaebad261302e6af',
    'Scripts/plateau_streets.py': '9e246e7c2d66e370be709117912df167be7edae5e6857adacc9d0641829c1179',
    'Scripts/prepare_lafontaine.py': 'e7b6e5f068a96ee7306b1fff247fa73158f5cf7c343dc5510ab8cce92ee3c924',
}


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def digest(value): return hashlib.sha256(json.dumps(value, separators=(',', ':')).encode()).hexdigest()
def bounds(faces): return [[op(p[i] for face in faces for p in face) for i in range(3)] for op in (min, max)]


def sources(root=ROOT):
    actual = {path: sha(Path(root)/path) for path in SOURCE_HASHES}
    assert actual == SOURCE_HASHES, 'Retained source/helper changed; review before authoring'
    return actual


def filtered_osm(root=ROOT):
    original = ET.parse(Path(root)/'Data/LaFontaine/osm.xml').getroot()
    ways = {way.get('id'): way for way in original.findall('way') if way.get('id') in TARGETS}
    assert set(ways) == set(TARGETS), 'Exactly three pinned building ways are required'
    refs = {node.get('ref') for way in ways.values() for node in way.findall('nd')}
    nodes = {node.get('id'): node for node in original.findall('node') if node.get('id') in refs}
    assert set(nodes) == refs, 'A selected building has an incomplete source footprint'
    selected = ET.Element('osm', original.attrib)
    for ident in sorted(nodes, key=int): selected.append(copy.deepcopy(nodes[ident]))
    for ident in TARGETS:
        way = ways[ident]; ordered = [node.get('ref') for node in way.findall('nd')]
        assert len(ordered) >= 4 and ordered[0] == ordered[-1], 'Selected footprint must be closed'
        selected.append(copy.deepcopy(way))
    return ET.tostring(selected, encoding='utf-8', xml_declaration=True)


def context_glass(root=ROOT):
    source = filtered_osm(root)
    old_distance = context.WINDOW_DISTANCE_CM
    assert old_distance == 5000., 'Do not inherit an unrelated context-window override'
    with tempfile.TemporaryDirectory(prefix='nord-east-details-') as directory:
        path = Path(directory)/'three-buildings.osm.xml'; path.write_bytes(source)
        try:
            # Only this disposable three-way computation bypasses the old 50m
            # gate. The large temporary grid prevents cutting the original panes.
            context.WINDOW_DISTANCE_CM = 20000.
            source_bounds = json.loads((Path(root)/'Data/Plateau/ContextGeometry/context.json').read_text())['bounds_xy']
            mesh, report = context.build_context(path, bounds=source_bounds, tile_cm=1000000.)
        finally:
            context.WINDOW_DISTANCE_CM = old_distance
    assert {row['source']: row['window_cards'] for row in report['buildings']} == COUNTS
    faces = [face for name, group in mesh.groups.items() if report['materials'][name]['material'] == 'Glass' for face in group]
    assert len(faces) == 50 and all(len(face) == 4 for face in faces)
    return faces, report['buildings'], source


def window_owner(face, buildings):
    a, b, c, d = face; matches = []
    assert math.dist(a, b) > 99.999 and abs(math.dist(a, b)-100) < 1e-6
    assert abs(c[2]-b[2]-150) < 1e-6 and a[2] in (170, 490)
    assert abs(a[2]-b[2]) < 1e-6 and abs(c[2]-d[2]) < 1e-6
    for building in buildings:
        poly = building['footprint_xy']; poly = poly if signed_area(poly) > 0 else poly[::-1]
        for edge, (left, right) in enumerate(zip(poly, poly[1:]+poly[:1])):
            length = math.dist(left, right); u = [(right[i]-left[i])/length for i in (0, 1)]; n = [u[1], -u[0]]
            offset = sum((a[i]-left[i])*u[i] for i in (0, 1))
            if (all(abs(sum((p[i]-left[i])*n[i] for i in (0, 1))-3) < 1e-6 for p in face)
                    and abs((offset-165)/550-round((offset-165)/550)) < 1e-6
                    and offset >= 164.999 and offset+100 <= length-119.999
                    and all(abs((b[i]-a[i])-100*u[i]) < 1e-6 for i in (0, 1))):
                matches.append({'source': building['source'], 'edge': edge, 'offset_cm': round(offset),
                                'bottom_z_cm': a[2], 'outward_xy': n, 'tangent_xy': u})
    assert len(matches) == 1, ('Ambiguous source window association', matches)
    return matches[0]


def contained_segment(a, b, polygon):
    """Closed-polygon containment, including concave exits and boundary edges."""
    inside = lambda p: _inside(p, polygon) or any(_distance(p, c, d) <= .00001 for c, d in zip(polygon, polygon[1:]+polygon[:1]))
    if not inside(a) or not inside(b): return False
    delta = [b[i]-a[i] for i in (0, 1)]; length2 = sum(v*v for v in delta)
    if length2 < 1e-12: return True
    cross = lambda u, v: u[0]*v[1]-u[1]*v[0]
    times = [0., 1.]
    for c, d in zip(polygon, polygon[1:]+polygon[:1]):
        edge = [d[i]-c[i] for i in (0, 1)]; origin = [c[i]-a[i] for i in (0, 1)]
        determinant = cross(delta, edge)
        if abs(determinant) > 1e-10:
            t, s = cross(origin, edge)/determinant, cross(origin, delta)/determinant
            if -1e-9 <= t <= 1+1e-9 and -1e-9 <= s <= 1+1e-9: times.append(max(0., min(1., t)))
        elif abs(cross(origin, delta)) <= .00001*math.sqrt(length2):
            for point in (c, d):
                t = sum((point[i]-a[i])*delta[i] for i in (0, 1))/length2
                if 0 <= t <= 1: times.append(t)
    times = sorted(set(times))
    return all(inside([a[i]+delta[i]*(left+right)/2 for i in (0, 1)]) for left, right in zip(times, times[1:]))


def occluding_shells(face, owner, buildings):
    """Cull only a whole vertical pane within a different retained solid shell."""
    return [row['source'] for row in buildings if row['source'] != owner
            and min(p[2] for p in face) >= 0 and max(p[2] for p in face) <= row['height_cm']
            and all(contained_segment(a[:2], b[:2], row['footprint_xy']) for a, b in zip(face, face[1:]+face[:1]))]


def native_contract(materials):
    return {'map': '/Game/Maps/LaFontaine.LaFontaine', 'map_file': 'Content/Maps/LaFontaine.umap',
            'actor_labels': [PREFIX+name for name in MATERIALS],
            'new_packages': ['Content/Plateau/EastDetails/SM_'+name+'.uasset' for name in MATERIALS],
            'actor_transform': {'location_cm': [0, 0, 0], 'rotation_degrees': [0, 0, 0], 'scale': [1, 1, 1]},
            'all_new_actor_collision': 'NoCollision / NO_COLLISION', 'all_new_actor_cast_shadow': False,
            'all_new_actor_visibility': 'visible component / not hidden actor',
            'all_new_actor_affect_distance_field_lighting': False,
            'all_new_actor_affect_dynamic_indirect_lighting': False,
            'materials': {name: '/Game/Plateau/Materials/M_'+name+'.M_'+name for name in MATERIALS},
            'existing_actor_policy': 'Every pre-author actor identity and semantic snapshot must remain exact, including all 54 east-extension actors and 742 context actors.',
            'existing_content_policy': 'Preserve every pre-author Content file except the LaFontaine map package; permit exactly these three new static-mesh packages and their declared package sidecars. Never reimport old assets or edit materials.',
            'preflight': ['fresh NullRHI process, exact saved LaFontaine map and no dirty packages',
                          'fresh backup inside Saved/Recovery; all three destination packages and actor labels absent',
                          'all source/OBJ hashes and three existing material identities/Nanite usage valid before any mutation'],
            'backup': ['copy all present LaFontaine map package files before mutation',
                       'seal complete actor semantic snapshot and full Content inventory/hash table with backup-manifest hash',
                       'author/fresh verifier use separate processes and compare exact before/after actor and Content inventories'],
            'source_geometry': {name: {'triangles': materials[name]['triangles'], 'bounds_cm': materials[name]['bounds_cm']} for name in MATERIALS},
            'canonical_east_invariant': 'The old verifier currently requires exactly 54 added actors. A later integration must validate a separate Details receipt and subtract only its three exact actor paths/labels before checking those 54. No broad label-prefix or arbitrary Content exception.'}


def build(root=ROOT):
    root = Path(root); pinned = sources(root)
    faces, buildings, source = context_glass(root)
    original = json.loads((root/'Data/Plateau/ContextGeometry/context.json').read_text())
    selected = {row['source']: row for row in original['buildings'] if row['source'] in COUNTS}
    assert set(selected) == set(COUNTS) and all(row['window_cards'] == 0 for row in selected.values())
    assert all(json.loads(json.dumps(row['footprint_xy'])) == selected[row['source']]['footprint_xy'] and row['height_cm'] == selected[row['source']]['height_cm'] for row in buildings)
    mesh = Mesh(); windows, culled = [], []
    for face in faces:
        window = window_owner(face, buildings); a = face[0]; u, n = window['tangent_xy'], window['outward_xy']
        hidden = occluding_shells(face, window['source'], original['buildings'])
        if hidden:
            culled.append({**window, 'glass_vertices_cm': face, 'fully_contained_by_shells': hidden}); continue
        mesh.face('Glass', face)
        yaw = math.degrees(math.atan2(u[1], u[0]))
        def box(material, x, normal, z, size):
            mesh.box(material, [a[0]+u[0]*x+n[0]*normal, a[1]+u[1]*x+n[1]*normal, a[2]+z], size, yaw)
        for x in (-1.5, 101.5): box('Iron', x, 1, 75, (3, 4, 156))
        for z in (-1.5, 151.5): box('Iron', 50, 1, z, (100, 4, 3))
        box('Trim', 50, 2, -4, (116, 10, 5))
        window.update(glass_vertices_cm=face)
        windows.append(window)
    assert set(mesh.groups) == set(MATERIALS)
    materials = {name: {'material': name, 'faces': len(mesh.groups[name]),
                       'triangles': sum(len(face)-2 for face in mesh.groups[name]), 'bounds_cm': bounds(mesh.groups[name]),
                       'collision': False, 'cast_shadow': False, 'source_faces_sha256': digest(mesh.groups[name]),
                       'asset': ASSETS+'/SM_'+name+'.SM_'+name, 'actor_label': PREFIX+name} for name in MATERIALS}
    assert {name: row['triangles'] for name, row in materials.items()} == {'Glass': 84, 'Iron': 2016, 'Trim': 504}
    assert len(windows) == 42 and len(culled) == 8
    report = {'version': 1, 'source_hashes': pinned, 'generator_sha256': sha(Path(__file__)),
              'attribution': '© OpenStreetMap contributors, ODbL 1.0', 'source_url': 'https://www.openstreetmap.org/copyright',
              'source_ids': list(COUNTS), 'source_subset_sha256': hashlib.sha256(source).hexdigest(),
              'producer': 'Unchanged plateau_context.build_context on exactly three original ways with their nodes/tags. Only the temporary eligibility distance (20000cm) and source grouping (1000000cm) differ; the original 5000cm gate is restored in finally. The large grid is not a native scene tiling policy.',
              'original_context_source_unchanged': True, 'source_glass_sha256': digest(faces),
              'retained_glass_sha256': digest(mesh.groups['Glass']),
              'source_emitted_window_cards': 50, 'source_cards_per_source': COUNTS,
              'culled_fully_occluded_cards': 8, 'candidate_window_cards': 42,
              'candidate_cards_per_source': {source: sum(window['source'] == source for window in windows) for source in COUNTS},
              'buildings': [{key: row[key] for key in ('source', 'footprint_xy', 'height_cm', 'height_source', 'height_estimated', 'height_clamped')} for row in buildings],
              'windows': windows, 'culled_windows': culled, 'materials': materials, 'triangles': 2604,
              'frame_estimates_cm': {'iron_width': 3, 'iron_depth': 4, 'sill_width': 116, 'sill_depth': 10, 'sill_height': 5, 'max_wall_projection': 10},
              'native_contract': native_contract(materials), 'native_imported': False, 'visual_accepted': False,
              'limits': ['Additive decorative cards and estimated frames; no actual wall openings/interiors or measured facade details.',
                         'Building footprints are sourced; 9.6m heights and window rhythm are retained illustrative estimates.',
                         '50 source emissions minus 8 wholly neighbour-contained panes leave 42 candidate panes; 42 visible windows is not claimed.',
                         'This does not repair Panet source coverage/horizon, former-edge ground seams or establish final graphic-novel appearance.',
                         'CPU authoring only; fresh offline native import/readback, unchanged collision and matched actual images remain required.']}
    assert sources(root) == pinned and context.WINDOW_DISTANCE_CM == 5000.
    return mesh, report, source


def prepare(directory=None, root=ROOT):
    directory = Path(directory) if directory is not None else Path(root)/DATA
    assert directory.resolve() == (Path(root)/DATA).resolve(), 'Write only the owned Details source directory'
    assert not directory.exists(), 'Use a fresh output directory; preserve reviewed candidates'
    mesh, report, source = build(root)
    directory.mkdir(parents=True, exist_ok=False); mesh.write(directory/'Geometry')
    (directory/'source-subset.osm.xml').write_bytes(source)
    report['geometry_files'] = {str(path.relative_to(directory)): sha(path) for path in sorted((directory/'Geometry').glob('*.obj'))}
    (directory/'details.json').write_text(json.dumps(report, indent=2)+'\n')
    return report


def load(root=ROOT):
    directory = Path(root)/DATA; actual = json.loads((directory/'details.json').read_text())
    mesh, expected, source = build(root)
    files = actual.pop('geometry_files')
    assert actual == json.loads(json.dumps(expected)), 'Reviewed Details manifest differs from current sources/generator'
    assert set(files) == {'Geometry/'+name+'.obj' for name in MATERIALS}
    assert {path.name for path in (directory/'Geometry').glob('*.obj')} == {name+'.obj' for name in MATERIALS}, 'Unexpected Details OBJ; import only the three declared sources'
    with tempfile.TemporaryDirectory(prefix='nord-east-details-verify-') as temporary:
        expected_directory = Path(temporary); mesh.write(expected_directory/'Geometry')
        assert files == {path: sha(expected_directory/path) for path in files}, 'Reviewed OBJ differs from deterministic producer'
    assert {path: sha(directory/path) for path in files} == files, 'Reviewed Details OBJ changed'
    assert (directory/'source-subset.osm.xml').read_bytes() == source, 'Reviewed source subset changed'
    return mesh, {**actual, 'geometry_files': files}


if __name__ == '__main__':
    result = prepare()
    print(json.dumps({'source_emissions': result['source_emitted_window_cards'], 'culled': result['culled_fully_occluded_cards'], 'candidate_cards': result['candidate_window_cards'], 'groups': list(result['materials']), 'triangles': result['triangles'], 'native_imported': False, 'output': str(DATA)}))
