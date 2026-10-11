"""Check surveyed shells, exterior-only visual paving and local render bounds."""
from collections import Counter
import math
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace
import xml.etree.ElementTree as ET

import plateau_context as context
from plateau_ground import district_bounds, signed_area
from prepare_lafontaine import ORIGIN, ROOT, tags, xy


def _normal(a, b, c):
    u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0])


def _surface_area(face):
    return sum(math.sqrt(sum(v * v for v in _normal(face[0], face[i], face[i + 1]))) / 2
               for i in range(1, len(face) - 1))


def _fixture(path):
    """Include concavity, reversed winding, a border crossing and invalid ways."""
    document = ET.Element('osm')
    next_id = 1
    def way(ident, points, properties, closed=True, missing=False):
        nonlocal next_id
        element = ET.SubElement(document, 'way', id=str(ident))
        refs = []
        for x, y in points:
            ref = str(next_id)
            next_id += 1
            lat = ORIGIN[0] + y / 11132000
            lon = ORIGIN[1] + x / (11132000 * math.cos(math.radians(ORIGIN[0])))
            ET.SubElement(document, 'node', id=ref, lat=str(lat), lon=str(lon))
            refs.append(ref)
        if missing:
            refs[1] = '99999999'
        for ref in refs + ([refs[0]] if closed else []):
            ET.SubElement(element, 'nd', ref=ref)
        for key, value in properties.items():
            ET.SubElement(element, 'tag', k=key, v=str(value))
    way(10, [(100, 100), (300, 100), (300, 300), (100, 300)], {'building': 'yes'})
    way(11, [(900, 100), (1200, 100), (1200, 400), (900, 400)],
        {'building': 'yes', 'building:levels': '2'})
    way(12, [(1200, 500), (1200, 1300), (1450, 1300), (1450, 700), (1800, 700), (1800, 500)],
        {'building': 'apartments', 'height': '12 m'})
    way(13, [(1900, 1500), (2100, 1500), (2100, 1700), (1900, 1700)], {'building': 'yes'})
    way(14, [(-800, 100), (-500, 100), (-500, 300), (-800, 300)], {'building': 'yes'}, closed=False)
    way(15, [(-800, 400), (-500, 400), (-500, 700), (-800, 700)], {'building': 'yes'}, missing=True)
    way(16, [(-400, 0), (-300, 0), (-200, 0)], {'building': 'yes'})
    way(17, [(-600, -700), (-300, -700), (-300, -300), (-600, -300)], {'building': 'yes', 'height': 'nan'})
    way(18, [(-400, 1200), (200, 1200), (200, 1600), (-400, 1600)],
        {'building': 'roof', 'building:levels': '5'})
    way(90, [(500, 600), (2500, 600)], {'highway': 'residential', 'width': '2', 'name': 'Rue Panet'}, closed=False)
    way(91, [(200, 800), (800, 800)], {'highway': 'residential', 'width': '1'}, closed=False)
    way(92, [(-700, 200), (-700, 800)], {'highway': 'footway'}, closed=False)
    ET.ElementTree(document).write(path, encoding='utf-8')


def _check_geometry(mesh, report, tile_cm):
    original, outer = report['bounds_xy'], report['outer_bounds_xy']
    triangles, apron_area, roof_area, wall_area = 0, 0., 0., 0.
    for name, faces in mesh.groups.items():
        metadata = report['materials'][name]
        assert metadata['collision'] == (metadata['material'] in context.SHELL_MATERIALS)
        assert metadata['material'] in context.MATERIALS
        assert max(metadata['bounds_cm'][1][i] - metadata['bounds_cm'][0][i] for i in (0, 1)) <= tile_cm + 1e-6
        for face in faces:
            assert all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in face)
            assert all(outer[0] - 1e-6 <= p[0] <= outer[2] + 1e-6 and
                       outer[1] - 1e-6 <= p[1] <= outer[3] + 1e-6 for p in face)
            triangles += len(face) - 2
            if metadata['material'] in ('Gravel', 'Asphalt'):
                # These are convex faces. Their intersection with the original
                # floor must have zero area, including after grid subdivision.
                overlap = context._clip_face(face, original)
                assert not overlap or abs(signed_area([p[:2] for p in overlap])) < .001
                assert all(p[2] == (.5 if metadata['material'] == 'Gravel' else 6.) for p in face)
                assert signed_area([p[:2] for p in face]) > 0, 'Inverted paving'
            if metadata['material'] == 'Gravel':
                apron_area += signed_area([p[:2] for p in face])
            elif metadata['material'] == 'Roof':
                roof_area += signed_area([p[:2] for p in face])
                assert signed_area([p[:2] for p in face]) > 0, 'Inverted roof'
            elif metadata['material'] in ('BrickRed', 'BrickBrown'):
                wall_area += _surface_area(face)
            for i in range(1, len(face) - 1):
                triangle = [face[0], face[i], face[i + 1]]
                assert sum(v * v for v in _normal(*triangle)) > 1e-10, 'Degenerate context triangle'
                quantized = [tuple(struct.unpack('f', struct.pack('f', round(v, 3)))[0] for v in p)
                             for p in triangle]
                assert sum(v * v for v in _normal(*quantized)) > 1e-10, 'OBJ/float32 triangle collapses'
    expected_apron = ((outer[2] - outer[0]) * (outer[3] - outer[1]) -
                      (original[2] - original[0]) * (original[3] - original[1]))
    assert math.isclose(apron_area, expected_apron, abs_tol=.01)
    assert math.isclose(apron_area / 10000, report['apron']['area_square_metres'], abs_tol=1e-5)
    expected_roofs = sum(abs(signed_area(r['footprint_xy'])) for r in report['buildings'])
    assert math.isclose(roof_area, expected_roofs, abs_tol=.02), 'Concave roof tessellation changed surveyed area'
    expected_walls = sum(sum(math.dist(a, b) for a, b in
                             zip(r['footprint_xy'], r['footprint_xy'][1:] + r['footprint_xy'][:1])) * r['height_cm']
                         for r in report['buildings'] if r['building_tag'] != 'roof')
    assert math.isclose(wall_area, expected_walls, abs_tol=.05), 'Grid clipping lost or duplicated exterior walls'
    assert triangles == report['triangles'] == sum(b['triangles'] for b in report['materials'].values())
    assert report['new_collision'] == 'mapped building shells only' and report['tile_size_cm'] == tile_cm


def _check_import_policy(report):
    from test_plateau_edges import Actor, Editor
    from test_verify_plateau_ground import Object, Vector
    editor, token = Editor(), object()
    fake = SimpleNamespace(EditorActorSubsystem=token, get_editor_subsystem=lambda cls: editor,
                           StaticMeshActor=Actor, Vector=Vector)
    original_actors = [(a, a.static_mesh_component.profile, a.static_mesh_component.collision) for a in editor.actors]
    imports = {}
    def importer(path, destination, name, collision=False):
        assert destination == '/Game/Plateau/Context'
        imports[path.stem] = collision
        return Object(body_setup=Object(collision_trace_flag=3 if collision else 0))
    prepare = context.prepare
    context.prepare = lambda: report
    try:
        context.apply(fake, {name: name for name in context.MATERIALS}, importer, lambda *args: None)
        assert imports == {name: m['collision'] for name, m in report['materials'].items()}
        assert sum(imports.values()) == 369
        for actor in editor.actors[len(original_actors):]:
            name = actor.label.removeprefix('Plateau context ')
            assert actor.static_mesh_component.profile == ('BlockAll' if imports[name] else 'NoCollision')
            assert actor.static_mesh_component.collision == (2 if imports[name] else 0)
        for actor, profile, collision in original_actors:
            assert (actor.static_mesh_component.profile, actor.static_mesh_component.collision) == (profile, collision)
    finally:
        context.prepare = prepare


def main():
    assert context._height({'height': '17.5 m'})['height_cm'] == 1750
    assert context._height({'building:levels': '4'})['height_cm'] == 1280
    assert context._height({'building:levels': '20'})['height_clamped']
    assert context._height({'height': '0'})['height_cm'] == 250
    assert context._height({'height': 'oops'})['height_estimated']
    with tempfile.TemporaryDirectory() as directory:
        source = Path(directory) / 'context.xml'
        _fixture(source)
        mesh, report = context.build_context(source, (0., 0., 1000., 1000.), 1000., 1000.)
        records = {r['source']: r for r in report['buildings']}
        assert set(records) == {'way/11', 'way/12', 'way/17', 'way/18'}
        assert report['excluded_interior_sources'] == ['way/10']
        assert records['way/11']['height_cm'] == 640 and records['way/11']['height_estimated']
        assert records['way/12']['height_cm'] == 1200 and not records['way/12']['height_estimated']
        assert math.isclose(records['way/12']['roof_area_square_metres'], 27., abs_tol=1e-6)
        assert records['way/17']['height_source'] == 'fallback_3_storey_estimate'
        assert records['way/18']['window_cards'] == 0
        assert {r['source'] for r in report['roads']} == {'way/90'}
        assert report['roads'][0]['name'] == 'Rue Panet' and report['roads'][0]['width_cm'] == 200
        assert math.isclose(report['roads'][0]['segments'][0]['centerline_xy'][1][0], 2000, abs_tol=1e-6)
        _check_geometry(mesh, report, 1000.)
        mesh.write(directory)
        exported = sum((Path(directory) / (name + '.obj')).read_text().count('\nf ') for name in mesh.groups)
        assert exported == report['triangles']
        repeated, repeated_report = context.build_context(source, (0., 0., 1000., 1000.), 1000., 1000.)
        assert repeated.groups == mesh.groups and repeated_report == report, 'Context preparation is not deterministic'

    mesh, report = context.build_context()
    assert report['building_count'] == 1722 and len(report['excluded_interior_sources']) == 1663
    assert report['partial_building_count'] == 176
    assert len(report['materials']) <= context.MAX_BATCHES
    document = ET.parse(ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {n.get('id'): xy(float(n.get('lat')), float(n.get('lon'))) for n in document.findall('node')}
    ways = {w.get('id'): w for w in document.findall('way')}
    original = district_bounds()
    source_ids = set()
    for record in report['buildings']:
        ident = record['source'].split('/')[1]
        way = ways[ident]
        refs = [n.get('ref') for n in way.findall('nd')]
        assert refs[0] == refs[-1] and all(ref in nodes for ref in refs)
        expected = []
        for ref in refs[:-1]:
            if not expected or nodes[ref] != expected[-1]:
                expected.append(nodes[ref])
        if expected[-1] == expected[0]:
            expected.pop()
        assert record['footprint_xy'] == expected, 'Context moved a surveyed footprint'
        assert not all(original[0] <= p[0] <= original[2] and original[1] <= p[1] <= original[3] for p in expected)
        assert record['source'] not in source_ids and record['source'] not in report['excluded_interior_sources']
        source_ids.add(record['source'])
        assert record['height_tags'] == {k: tags(way)[k] for k in ('height', 'building:levels') if k in tags(way)}
        assert math.isclose(record['roof_area_square_metres'], abs(signed_area(expected)) / 10000, abs_tol=1e-6)
    assert {r['height_source'] for r in report['buildings']} == {'levels_3.2m_estimate', 'fallback_3_storey_estimate'}
    assert Counter(r['height_source'] for r in report['buildings']) == {
        'levels_3.2m_estimate': 201, 'fallback_3_storey_estimate': 1521}
    assert any(r['name'] == 'Rue Panet' for r in report['roads']), 'Panet visual asphalt stops at the playable border'
    assert all(r['highway'] in context.DRIVE for r in report['roads'])
    _check_geometry(mesh, report, context.TILE_CM)
    _check_import_policy(report)
    print('Plateau context checks passed:', report['building_count'], 'exact mapped footprints,',
          len(report['roads']), 'continued road ways,', len(report['materials']),
          'bounded batches with solid surveyed shells,', report['triangles'], 'triangles')


if __name__ == '__main__':
    main()
