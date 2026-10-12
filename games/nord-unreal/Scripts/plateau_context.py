"""Surveyed OSM city context around the original playable rectangle.

Complete mapped building ways are selected within a 200 m surrounding buffer.
Footprints retain the snapshot's coordinates; untagged heights use the original
district's three-storey estimate. Mapped building shells block movement because
some complete footprints cross into the playable rectangle. The visual apron,
roads and glass stay nonblocking; no walkable floor or gameplay bounds expand.
"""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from plateau_batches import spatial_batches
from plateau_ground import district_bounds, signed_area, triangulate
from plateau_mesh import Mesh
from plateau_streets import _clean_fill, _road_rectangle, _subtract_convex
from prepare_lafontaine import ROOT, clip_segment, road_width, tags, xy


BUFFER_CM = 20000.
TILE_CM = 10000.
MAX_BATCHES = 800
WINDOW_DISTANCE_CM = 5000.
MATERIALS = ('BrickRed', 'BrickBrown', 'Roof', 'Glass', 'Gravel', 'Asphalt')
DRIVE = ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'living_street')
SHELL_MATERIALS = ('BrickRed', 'BrickBrown', 'Roof')


def _inside(point, bounds):
    return bounds[0] <= point[0] <= bounds[2] and bounds[1] <= point[1] <= bounds[3]


def _bounds(faces):
    return [[operation(p[i] for face in faces for p in face) for i in range(3)]
            for operation in (min, max)]


def _height(properties):
    """Match the original 3.2 m/storey fallback, reporting every estimate/clamp."""
    try:
        if 'height' in properties:
            value = float(properties['height'].split()[0]) * 100
            source = 'height_tag'
        elif 'building:levels' in properties:
            value = float(properties['building:levels']) * 320
            source = 'levels_3.2m_estimate'
        else:
            value, source = 960., 'fallback_3_storey_estimate'
        if not math.isfinite(value):
            raise ValueError('Nonfinite height')
    except (ValueError, IndexError):
        value, source = 960., 'fallback_3_storey_estimate'
    height = max(250., min(value, 6000.))
    return {'height_cm': height, 'height_source': source,
            'height_estimated': source != 'height_tag', 'height_clamped': height != value}


def context_survey(osm_path=None, bounds=None, buffer_cm=BUFFER_CM):
    """Select complete closed ways, excluding every fully interior building."""
    bounds = tuple(bounds or district_bounds())
    assert buffer_cm > 0
    outer = (bounds[0] - buffer_cm, bounds[1] - buffer_cm,
             bounds[2] + buffer_cm, bounds[3] + buffer_cm)
    document = ET.parse(osm_path or ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {node.get('id'): xy(float(node.get('lat')), float(node.get('lon')))
             for node in document.findall('node')}
    records, interior = [], []
    for way in document.findall('way'):
        properties = tags(way)
        refs = [node.get('ref') for node in way.findall('nd')]
        if properties.get('building', 'no') == 'no' or len(refs) < 4 or refs[0] != refs[-1]:
            continue
        if any(ref not in nodes for ref in refs):
            continue
        footprint = []
        for ref in refs[:-1]:
            if not footprint or nodes[ref] != footprint[-1]:
                footprint.append(nodes[ref])
        if len(footprint) > 1 and footprint[-1] == footprint[0]:
            footprint.pop()
        if len(footprint) < 3 or abs(signed_area(footprint)) < 1:
            continue
        if all(_inside(point, bounds) for point in footprint):
            interior.append('way/' + way.get('id'))
            continue
        if not all(_inside(point, outer) for point in footprint):
            continue
        records.append({'source': 'way/' + way.get('id'), 'footprint_xy': footprint,
                        'building_tag': properties['building'],
                        'height_tags': {key: properties[key] for key in ('height', 'building:levels')
                                        if key in properties}, **_height(properties)})
    records.sort(key=lambda record: int(record['source'].split('/')[1]))
    return records, {'bounds_xy': list(bounds), 'outer_bounds_xy': list(outer),
                     'excluded_interior_sources': sorted(interior), 'buffer_cm': buffer_cm}


def _clip_face(face, bounds):
    """Clip a convex 3D render face to an XY cell without changing its plane."""
    points = list(face)
    for axis, limit, lower in ((0, bounds[0], True), (0, bounds[2], False),
                               (1, bounds[1], True), (1, bounds[3], False)):
        clipped = []
        for a, b in zip(points, points[1:] + points[:1]):
            ain = a[axis] >= limit if lower else a[axis] <= limit
            bin = b[axis] >= limit if lower else b[axis] <= limit
            if ain:
                clipped.append(a)
            if ain != bin:
                fraction = (limit - a[axis]) / (b[axis] - a[axis])
                point = [a[i] + (b[i] - a[i]) * fraction for i in range(3)]
                point[axis] = limit
                clipped.append(tuple(point))
        points = []
        for point in clipped:
            if not points or math.dist(point, points[-1]) > 1e-7:
                points.append(point)
        if len(points) > 1 and math.dist(points[0], points[-1]) <= 1e-7:
            points.pop()
        if len(points) < 3:
            return []
    # Vertical faces have zero XY area; test their full 3D normal instead.
    a = points[0]
    normal = [0., 0., 0.]
    for b, c in zip(points[1:-1], points[2:]):
        u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
        cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
                 u[0] * v[1] - u[1] * v[0])
        normal = [normal[i] + cross[i] for i in range(3)]
    return points if sum(value * value for value in normal) > 1e-10 else []


def _bounded_faces(mesh, outer, tile_cm):
    """Cut only render faces at grid lines; source footprint records stay exact."""
    output = Mesh()
    for material, faces in mesh.groups.items():
        for face in faces:
            face = _clip_face(face, outer)
            if not face:
                continue
            xmin, ymin = (min(p[i] for p in face) for i in (0, 1))
            xmax, ymax = (max(p[i] for p in face) for i in (0, 1))
            for x in range(math.floor(xmin / tile_cm), math.floor(xmax / tile_cm) + 1):
                for y in range(math.floor(ymin / tile_cm), math.floor(ymax / tile_cm) + 1):
                    clipped = _clip_face(face, (x * tile_cm, y * tile_cm,
                                                (x + 1) * tile_cm, (y + 1) * tile_cm))
                    if clipped:
                        # Faces lying exactly on a grid line belong to one cell.
                        center = tuple(sum(p[i] for p in clipped) / len(clipped) for i in (0, 1))
                        if (math.floor(center[0] / tile_cm), math.floor(center[1] / tile_cm)) == (x, y):
                            output.face(material, clipped)
    return output


def _apron(mesh, bounds, outer):
    xmin, ymin, xmax, ymax = bounds
    oxmin, oymin, oxmax, oymax = outer
    # Four disjoint strips share edges only; no face covers the playable floor.
    strips = [(oxmin, oymin, xmin, oymax), (xmax, oymin, oxmax, oymax),
              (xmin, oymin, xmax, ymin), (xmin, ymax, xmax, oymax)]
    for left, bottom, right, top in strips:
        mesh.face('Gravel', [(left, bottom, .5), (right, bottom, .5),
                             (right, top, .5), (left, top, .5)])
    return {'material': 'Gravel', 'z_cm': .5, 'rectangles_xy': [list(r) for r in strips],
            'area_square_metres': sum((r - l) * (t - b) for l, b, r, t in strips) / 10000}


def _roads(mesh, osm_path, bounds, outer):
    document = ET.parse(osm_path or ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {node.get('id'): xy(float(node.get('lat')), float(node.get('lon')))
             for node in document.findall('node')}
    original = [(bounds[0], bounds[1]), (bounds[2], bounds[1]),
                (bounds[2], bounds[3]), (bounds[0], bounds[3])]
    roads = []
    for way in document.findall('way'):
        properties = tags(way)
        if properties.get('highway') not in DRIVE:
            continue
        refs = [node.get('ref') for node in way.findall('nd')]
        width, segments = road_width(properties), []
        for a, b in zip(refs, refs[1:]):
            if a not in nodes or b not in nodes:
                continue
            line = clip_segment(nodes[a], nodes[b], outer)
            if line is None:
                continue
            fragments = [_clean_fill(p) for p in _subtract_convex(_road_rectangle(*line, width), original)]
            fragments = [p for p in fragments if p]
            for polygon in fragments:
                mesh.face('Asphalt', [(x, y, 6.) for x, y in polygon])
            if fragments:
                segments.append({'node_ids': [a, b], 'centerline_xy': line})
        if segments:
            roads.append({'source': 'way/' + way.get('id'), 'highway': properties['highway'],
                          'name': properties.get('name', ''), 'width_cm': width, 'segments': segments})
    return roads


def build_context(osm_path=None, bounds=None, buffer_cm=BUFFER_CM, tile_cm=TILE_CM):
    records, survey = context_survey(osm_path, bounds, buffer_cm)
    outer, bounds = survey['outer_bounds_xy'], survey['bounds_xy']
    mesh = Mesh()
    windows = 0
    for record in records:
        footprint = record['footprint_xy']
        footprint = footprint if signed_area(footprint) > 0 else footprint[::-1]
        height = record['height_cm']
        roof = triangulate([footprint], outer)
        record['roof_area_square_metres'] = sum(signed_area(t) for t in roof) / 10000
        for triangle in roof:
            mesh.face('Roof', [(x, y, height) for x, y in triangle])
        material = ('BrickRed', 'BrickBrown')[int(record['source'].split('/')[1]) % 2]
        record['wall_material'] = material
        record['window_cards'] = 0
        if record['building_tag'] == 'roof':
            continue
        center = tuple(sum(p[i] for p in footprint) / len(footprint) for i in (0, 1))
        distance = math.hypot(max(bounds[0] - center[0], 0, center[0] - bounds[2]),
                              max(bounds[1] - center[1], 0, center[1] - bounds[3]))
        for a, b in zip(footprint, footprint[1:] + footprint[:1]):
            length = math.dist(a, b)
            if length < .001:
                continue
            mesh.face(material, [(*a, 0.), (*b, 0.), (*b, height), (*a, height)])
            if distance > WINDOW_DISTANCE_CM or length < 430:
                continue
            direction = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
            normal = (direction[1] * 3, -direction[0] * 3)
            for z in range(170, int(height) - 170, 320):
                for offset in range(165, int(length) - 220, 550):
                    point = lambda d, h: (a[0] + direction[0] * d + normal[0],
                                          a[1] + direction[1] * d + normal[1], h)
                    mesh.face('Glass', [point(offset, z), point(offset + 100, z),
                                        point(offset + 100, z + 150), point(offset, z + 150)])
                    record['window_cards'] += 1
        windows += record['window_cards']
    apron = _apron(mesh, bounds, outer)
    roads = _roads(mesh, osm_path, bounds, outer)
    mesh = _bounded_faces(mesh, outer, tile_cm)
    mesh, batches, actual_tile = spatial_batches(mesh, tile_size_cm=tile_cm, max_batches=MAX_BATCHES)
    assert actual_tile == tile_cm, 'Context budget would widen the local render grid'
    for name, metadata in batches.items():
        metadata['collision'] = metadata['material'] in SHELL_MATERIALS
        metadata['bounds_cm'] = _bounds(mesh.groups[name])
        assert max(metadata['bounds_cm'][1][i] - metadata['bounds_cm'][0][i]
                   for i in (0, 1)) <= tile_cm + 1e-6, name
        assert metadata['material'] in MATERIALS
    report = {'source': 'Data/LaFontaine/osm.xml', 'attribution': '© OpenStreetMap contributors, ODbL 1.0',
              'source_url': 'https://www.openstreetmap.org/copyright', **survey,
              'buildings': records, 'building_count': len(records),
              'partial_building_count': sum(bool(triangulate([r['footprint_xy']], bounds)) for r in records),
              'height_estimate_count': sum(r['height_estimated'] for r in records),
              'height_clamped_count': sum(r['height_clamped'] for r in records),
              'window_cards': windows, 'window_distance_cm': WINDOW_DISTANCE_CM,
              'apron': apron, 'roads': roads, 'materials': batches, 'tile_size_cm': actual_tile,
              'triangles': sum(b['triangles'] for b in batches.values()),
              'new_collision': 'mapped building shells only'}
    return mesh, report


def prepare(directory=None):
    mesh, report = build_context()
    directory = Path(directory or ROOT / 'Data/Plateau/ContextGeometry')
    mesh.write(directory)
    (directory / 'context.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def apply(u, materials, import_mesh, nanite):
    """Import mapped shells and visual surroundings; the caller saves the level."""
    report = prepare()
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    actors = editor.get_all_level_actors()
    labels = {actor.get_actor_label(): actor for actor in actors}
    wanted = {'Plateau context ' + name for name in report['materials']}
    for actor in actors:
        label = actor.get_actor_label()
        if label.startswith('Plateau context ') and label not in wanted:
            editor.destroy_actor(actor)
    for name, metadata in report['materials'].items():
        mesh = import_mesh(ROOT / 'Data/Plateau/ContextGeometry' / (name + '.obj'),
                           '/Game/Plateau/Context', 'SM_' + name, collision=metadata['collision'])
        material = materials[metadata['material']]
        nanite(u, mesh, [material])
        actor = labels.get('Plateau context ' + name) or editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label('Plateau context ' + name)
        actor.set_folder_path('Plateau/Surrounding context')
        actor.set_actor_hidden_in_game(False)
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_visibility(True)
        component.set_collision_profile_name('BlockAll' if metadata['collision'] else 'NoCollision')
        component.set_cast_shadow(metadata['material'] != 'Gravel')
    return report


if __name__ == '__main__':
    report = prepare()
    print(json.dumps({'buildings': report['building_count'], 'batches': len(report['materials']),
                      'triangles': report['triangles'], 'estimated_heights': report['height_estimate_count'],
                      'apron_square_metres': report['apron']['area_square_metres'],
                      'tile_size_cm': report['tile_size_cm']}, indent=2))
