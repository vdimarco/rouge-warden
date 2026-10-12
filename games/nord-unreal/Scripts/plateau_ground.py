"""Tessellated OSM park lawns and a textured visual base, without new collision.

The checked-in 2026-10-09 snapshot stores Parc La Fontaine as closed OSM way
4767368, not a multipolygon relation. Its 95-vertex concave outline must not be
exported as a triangle fan. All leisure=park ways and multipolygon outer/inner
rings use even/odd scanline tessellation, clipped to the existing district.
Source: Data/LaFontaine/osm.xml, © OpenStreetMap contributors, ODbL 1.0.
https://www.openstreetmap.org/copyright
"""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

from plateau_mesh import Mesh
from prepare_lafontaine import BOUNDS, ROOT, tags, xy


def district_bounds():
    return (*xy(BOUNDS[0], BOUNDS[1]), *xy(BOUNDS[2], BOUNDS[3]))


def _rings(segments):
    """Join OSM member ways by node identity, allowing reversed member order."""
    remaining = [list(segment) for segment in segments if len(segment) > 1]
    rings = []
    while remaining:
        ring = remaining.pop(0)
        while ring[-1] != ring[0]:
            match = next(((i, p if p[0] == ring[-1] else p[::-1])
                          for i, p in enumerate(remaining)
                          if p[0] == ring[-1] or p[-1] == ring[-1]), None)
            assert match is not None, 'Incomplete OSM park/island ring'
            i, following = match
            remaining.pop(i)
            ring.extend(following[1:])
        assert len(ring) >= 4, 'Degenerate OSM park/island ring'
        rings.append(ring[:-1])
    return rings


def survey(osm_path=None):
    """Read authoritative park boundaries, plus existing pond-island caps."""
    root = ET.parse(osm_path or ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {e.get('id'): xy(float(e.get('lat')), float(e.get('lon')))
             for e in root.findall('node')}
    ways = {e.get('id'): e for e in root.findall('way')}
    refs = {ident: [n.get('ref') for n in way.findall('nd')]
            for ident, way in ways.items()}
    records, consumed = [], set()
    for relation in root.findall('relation'):
        properties = tags(relation)
        park = properties.get('type') == 'multipolygon' and properties.get('leisure') == 'park'
        island = properties.get('type') == 'multipolygon' and properties.get('natural') == 'water'
        if not park and not island:
            continue
        members = [m for m in relation.findall('member') if m.get('type') == 'way']
        selected = [m for m in members if m.get('role', 'outer') in ('', 'outer', 'inner')]
        if island:
            selected = [m for m in selected if m.get('role') == 'inner']
        if not selected:
            continue
        assert all(m.get('ref') in ways for m in selected), 'Missing OSM ring member'
        outer = _rings([refs[m.get('ref')] for m in selected
                        if island or m.get('role', 'outer') in ('', 'outer')])
        inner = [] if island else _rings([refs[m.get('ref')] for m in selected if m.get('role') == 'inner'])
        identifiers = [m.get('ref') for m in selected]
        if park:
            consumed.update(identifiers)
        records.append({'source': 'relation/' + relation.get('id'),
                        'source_way_ids': identifiers, 'name': properties.get('name', ''),
                        'kind': 'pond_island' if island else 'park',
                        'rings': [[nodes[n] for n in ring] for ring in outer + inner]})
    for ident, way in ways.items():
        if tags(way).get('leisure') != 'park' or ident in consumed:
            continue
        rings = _rings([refs[ident]])
        assert all(n in nodes for ring in rings for n in ring), 'Missing OSM park node'
        records.append({'source': 'way/' + ident, 'source_way_ids': [ident],
                        'name': tags(way).get('name', ''), 'kind': 'park',
                        'rings': [[nodes[n] for n in ring] for ring in rings]})
    return records


def triangulate(rings, bounds):
    """Exact polygon/rectangle intersection via horizontal convex trapezoids.

    Break at every vertex and every vertical clipping-edge crossing. The even/odd
    fill supports concave outlines, disconnected outers and inner holes without
    bridges or triangles outside the surveyed boundary.
    """
    xmin, ymin, xmax, ymax = bounds
    assert xmin < xmax and ymin < ymax
    edges = [(a, b) for ring in rings for a, b in zip(ring, ring[1:] + ring[:1])
             if abs(a[1] - b[1]) > 1e-8]
    levels = {ymin, ymax}
    for a, b in edges:
        levels.update(y for y in (a[1], b[1]) if ymin < y < ymax)
        if abs(a[0] - b[0]) > 1e-8:
            for x in (xmin, xmax):
                f = (x - a[0]) / (b[0] - a[0])
                y = a[1] + (b[1] - a[1]) * f
                if 0 < f < 1 and ymin < y < ymax:
                    levels.add(y)
    levels = sorted(levels)
    triangles = []
    for lo, hi in zip(levels, levels[1:]):
        if hi - lo < 1e-8:
            continue
        mid = (lo + hi) / 2
        crossing = []
        for a, b in edges:
            if min(a[1], b[1]) < mid < max(a[1], b[1]):
                slope = (b[0] - a[0]) / (b[1] - a[1])
                crossing.append((a[0] + (mid - a[1]) * slope, a, slope))
        crossing.sort(key=lambda item: item[0])
        assert len(crossing) % 2 == 0, 'Unclosed OSM polygon'
        for left, right in zip(crossing[::2], crossing[1::2]):
            if right[0] <= xmin or left[0] >= xmax:
                continue
            points = []
            for boundary, y in ((left, lo), (right, lo), (right, hi), (left, hi)):
                _, a, slope = boundary
                p = (max(xmin, min(xmax, a[0] + (y - a[1]) * slope)), y)
                if not points or p != points[-1]:
                    points.append(p)
            if len(points) > 1 and points[0] == points[-1]:
                points.pop()
            for i in range(1, len(points) - 1):
                triangle = [points[0], points[i], points[i + 1]]
                if signed_area(triangle) > 1e-6:
                    triangles.append(triangle)
    return triangles


def signed_area(points):
    return sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(points, points[1:] + points[:1])) / 2


def build_ground(mesh, osm_path=None, bounds=None):
    bounds = bounds or district_bounds()
    surfaces = []
    for record in survey(osm_path):
        triangles = triangulate(record['rings'], bounds)
        if not triangles:
            continue
        z = 9. if record['kind'] == 'pond_island' else 2.
        for triangle in triangles:
            mesh.face('ParkGrass', [(x, y, z) for x, y in triangle])
        points = [p for triangle in triangles for p in triangle]
        surfaces.append({k: v for k, v in record.items() if k != 'rings'} | {
            'triangles': len(triangles), 'z': z,
            'area_square_metres': sum(signed_area(t) for t in triangles) / 10000,
            'bounds_xy': [min(p[i] for p in points) for i in (0, 1)] +
                         [max(p[i] for p in points) for i in (0, 1)]})
    assert any(s['source'] == 'way/4767368' for s in surfaces), 'Missing Parc La Fontaine'
    xmin, ymin, xmax, ymax = bounds
    # The existing district cube remains the collision floor. A visual overlay
    # gives its full extent consistent 2 m UVs rather than one giant cube UV tile.
    mesh.face('YardGround', [(xmin, ymin, .5), (xmax, ymin, .5),
                             (xmax, ymax, .5), (xmin, ymax, .5)])
    return {'source': 'Data/LaFontaine/osm.xml',
            'attribution': '© OpenStreetMap contributors, ODbL 1.0',
            'source_url': 'https://www.openstreetmap.org/way/4767368',
            'bounds_xy': list(bounds), 'surfaces': surfaces, 'new_collision': False}


def prepare(directory=None):
    directory = Path(directory or ROOT / 'Data/Plateau/GroundGeometry')
    mesh = Mesh()
    report = build_ground(mesh)
    mesh.write(directory)
    (directory / 'ground.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def apply(u, materials, import_mesh):
    """Integrate after material creation; the caller saves the level/assets."""
    report = prepare()
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    actors = {actor.get_actor_label(): actor for actor in editor.get_all_level_actors()}
    ground = actors.get('District ground')
    assert ground, 'Expected the existing district collision floor'
    ground.static_mesh_component.set_material(0, materials['Gravel'])
    for name, material, label in [('ParkGrass', 'ParkGrass', 'OSM Grass'),
                                   ('YardGround', 'Gravel', 'Plateau ground textured yards')]:
        mesh = import_mesh(ROOT / 'Data/Plateau/GroundGeometry' / (name + '.obj'),
                           '/Game/Plateau/Ground', 'SM_' + name)
        actor = actors.get(label)
        if actor is None:
            actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
            actor.set_actor_label(label)
        actor.set_folder_path('Plateau/Ground')
        actor.static_mesh_component.set_static_mesh(mesh)
        actor.static_mesh_component.set_material(0, materials[material])
        actor.static_mesh_component.set_collision_profile_name('NoCollision')
        actor.static_mesh_component.set_cast_shadow(False)
    return report


if __name__ == '__main__':
    report = prepare()
    print(json.dumps(report, ensure_ascii=False, indent=2))
