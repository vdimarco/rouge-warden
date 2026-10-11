"""Illustrative road closures that explain the unchanged playable boundary.

OSM supplies the two road exits and nominal road widths. Orange barricades and
RUE BARRÉE placards are fictional game furniture, not surveyed city works.
The original four invisible boundary cubes retain all gameplay collision.
"""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from plateau_batches import spatial_batches
from plateau_ground import district_bounds
from plateau_mesh import Mesh
from plateau_streets import _distance, _local, WALK_ROUTE
from prepare_lafontaine import ROOT, clip_segment, road_width, tags, xy


EXIT_WAYS = ('490998043', '19938440')
INSET_CM = 250.
PREFIX = 'Plateau edge '
TEXT_COLOR = {'r': 6, 'g': 6, 'b': 6, 'a': 255}


def edge_survey(osm_path=None):
    document = ET.parse(osm_path or ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {n.get('id'): xy(float(n.get('lat')), float(n.get('lon'))) for n in document.findall('node')}
    ways = {w.get('id'): w for w in document.findall('way')}
    bounds = district_bounds()
    exits = []
    for ident in EXIT_WAYS:
        way, candidates = ways[ident], []
        refs = [n.get('ref') for n in way.findall('nd')]
        for a, b in zip(refs, refs[1:]):
            line = clip_segment(nodes[a], nodes[b], bounds)
            if line:
                for i in (0, 1):
                    if abs(line[i][0] - bounds[2]) < .001:
                        candidates.append((line[i], line[1 - i]))
        assert len(candidates) == 1, ('Ambiguous district road exit', ident)
        exit_point, interior = candidates[0]
        distance = math.dist(exit_point, interior)
        outward = [(exit_point[i] - interior[i]) / distance for i in (0, 1)]
        across = [-outward[1], outward[0]]
        center = [exit_point[i] - outward[i] * INSET_CM for i in (0, 1)]
        properties = tags(way)
        yaw = math.degrees(math.atan2(across[1], across[0]))
        q = _local(center, yaw)
        exits.append({'source': 'way/' + ident, 'street': properties.get('name', ''),
                      'mapped_exit_xy': list(exit_point), 'interior_reference_xy': list(interior),
                      'outward_direction': outward, 'across_road_direction': across,
                      'closure_center_xy': center, 'inset_cm': INSET_CM, 'yaw': yaw,
                      'road_width_cm': road_width(properties), 'illustrative': True,
                      'route_clearance_cm': min(_distance(center, a, b) for a, b in zip(WALK_ROUTE, WALK_ROUTE[1:])),
                      'sign': {'text': 'RUE BARRÉE', 'position': list(q(0, 5.3, 145)),
                               'normal': [-v for v in outward],
                               'yaw': math.degrees(math.atan2(-outward[1], -outward[0])), 'size': 19.}})
    return exits


def _barricade(mesh, exit_record):
    q = _local(exit_record['closure_center_xy'], exit_record['yaw'])
    width = exit_record['road_width_cm']
    span = min(600., width - 80)
    sections = max(1, math.ceil(span / 160))
    step = span / sections
    for index in range(sections):
        center = (index + .5) * step - span / 2
        panel_width = step - 8
        for side in (-1, 1):
            x = center + side * step * .32
            for y in (-22, 22):
                mesh.box('Rubber', q(x, y, 8), (24, 20, 4), exit_record['yaw'])
                mesh.rod('Iron', q(x, y, 10), q(x, 0, 110), 2.2)
            mesh.rod('Iron', q(x, -14, 50), q(x, 14, 50), 1.7)
        mesh.box('ConstructionOrange', q(center, 0, 92), (panel_width, 7, 30), exit_record['yaw'])
        # Diagonal reflective stripes are inset into each board's perimeter.
        for x in range(-int(panel_width / 2) + 7, int(panel_width / 2) - 47, 40):
            stripe = [(center + x, 77.1), (center + x + 28, 106.9),
                      (center + x + 46, 106.9), (center + x + 18, 77.1)]
            mesh.face('White', [q(a, 3.6, z) for a, z in stripe])
            mesh.face('White', [q(a, -3.6, z) for a, z in stripe[::-1]])
    for side in (-1, 1):
        x = side * (width / 2 - 45)
        mesh.box('Rubber', q(x, 40, 8.5), (54, 54, 5), exit_record['yaw'])
        mesh.cylinder('ConstructionOrange', q(x, 40, 43), 20, 64, 12)
        for z in (30, 57):
            mesh.cylinder('White', q(x, 40, z), 20.3, 10, 12)
        mesh.cylinder('Rubber', q(x, 40, 75.8), 19, 1.6, 12)
    mesh.box('ConstructionOrange', q(0, 0, 145), (214, 8, 47), exit_record['yaw'])
    mesh.box('White', q(0, 4.5, 145), (204, 1, 37), exit_record['yaw'])
    for x in (-80, 80):
        mesh.rod('Iron', q(x, -3, 103), q(x, -3, 124), 2)
    exit_record['barrier_span_cm'] = span


def build_edges(osm_path=None):
    exits = edge_survey(osm_path)
    mesh = Mesh()
    for record in exits:
        _barricade(mesh, record)
    mesh, batches, size = spatial_batches(mesh, tile_size_cm=10000, max_batches=12)
    bounds = district_bounds()
    for name, metadata in batches.items():
        points = [p for face in mesh.groups[name] for p in face]
        metadata['bounds_cm'] = [[op(p[i] for p in points) for i in range(3)] for op in (min, max)]
        assert all(bounds[0] <= p[0] <= bounds[2] and bounds[1] <= p[1] <= bounds[3] for p in points), name
        assert metadata['collision'] is False
    return mesh, {'source': 'Data/LaFontaine/osm.xml', 'attribution': '© OpenStreetMap contributors, ODbL 1.0',
                  'closures_illustrative': True, 'closures': exits, 'materials': batches, 'tile_size_cm': size,
                  'triangles': sum(m['triangles'] for m in batches.values()),
                  'original_boundary_actor_count': 4, 'original_boundary_collision': 'preserve BlockAll',
                  'new_collision': False}


def prepare(directory=None):
    mesh, report = build_edges()
    directory = Path(directory or ROOT / 'Data/Plateau/EdgesGeometry')
    mesh.write(directory)
    (directory / 'edges.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def _original_barriers(u):
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    barriers = [a for a in actors if a.get_actor_label() == 'District edge']
    assert len(barriers) == 4, ('Expected all four original duplicate-labelled boundary actors', len(barriers))
    for actor in barriers:
        component = actor.static_mesh_component
        assert str(component.get_collision_profile_name()) == 'BlockAll'
        assert component.get_collision_enabled() == u.CollisionEnabled.QUERY_AND_PHYSICS
    return barriers


def apply(u, materials, import_mesh, nanite):
    report = prepare()
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    barriers = _original_barriers(u)
    for actor in barriers:
        component = actor.static_mesh_component
        before = (str(component.get_collision_profile_name()), component.get_collision_enabled(), component.static_mesh)
        component.set_visibility(False)
        component.set_cast_shadow(False)
        component.set_affect_distance_field_lighting(False)
        component.set_affect_dynamic_indirect_lighting(False)
        actor.set_actor_hidden_in_game(True)
        assert before == (str(component.get_collision_profile_name()), component.get_collision_enabled(), component.static_mesh)
    actors = editor.get_all_level_actors()
    labels = {a.get_actor_label(): a for a in actors}
    wanted = {PREFIX + name for name in report['materials']} | {PREFIX + 'sign ' + r['source'] for r in report['closures']}
    for actor in actors:
        if actor.get_actor_label().startswith(PREFIX) and actor.get_actor_label() not in wanted:
            editor.destroy_actor(actor)
    for name, metadata in report['materials'].items():
        mesh = import_mesh(ROOT / 'Data/Plateau/EdgesGeometry' / (name + '.obj'), '/Game/Plateau/Edges', 'SM_' + name)
        material = materials[metadata['material']]
        nanite(u, mesh, [material])
        actor = labels.get(PREFIX + name) or editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label(PREFIX + name)
        actor.set_folder_path('Plateau/Boundary closures')
        actor.set_actor_hidden_in_game(False)
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_visibility(True)
        component.set_collision_profile_name('NoCollision')
        component.set_cast_shadow(True)
    for closure in report['closures']:
        sign = closure['sign']
        label = PREFIX + 'sign ' + closure['source']
        actor = labels.get(label) or editor.spawn_actor_from_class(u.TextRenderActor, u.Vector())
        actor.set_actor_label(label)
        actor.set_folder_path('Plateau/Boundary closures')
        actor.set_actor_hidden_in_game(False)
        actor.set_actor_location(u.Vector(*sign['position']), False, False)
        actor.set_actor_rotation(u.Rotator(yaw=sign['yaw']), False)
        component = actor.get_component_by_class(u.TextRenderComponent)
        component.set_text(sign['text'])
        component.set_world_size(sign['size'])
        component.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER)
        component.set_vertical_alignment(u.VerticalTextAligment.EVRTA_TEXT_CENTER)
        component.set_text_render_color(u.Color(**TEXT_COLOR))
        component.set_collision_profile_name('NoCollision')
        component.set_visibility(True)
        component.set_cast_shadow(False)
    return report | {'hidden_original_barriers': len(barriers), 'original_collision_preserved': True}


def verify(u, labels, root):
    root = Path(root)
    saved = json.loads((root / 'Data/Plateau/EdgesGeometry/edges.json').read_text())
    _, expected = build_edges(root / 'Data/LaFontaine/osm.xml')
    assert saved == json.loads(json.dumps(expected)), 'Saved closures differ from the mapped road exits'
    barriers = _original_barriers(u)
    for actor in barriers:
        component = actor.static_mesh_component
        assert not component.is_visible() and actor.get_editor_property('hidden'), 'Boundary wall remains visible'
        assert not component.get_editor_property('cast_shadow')
        assert not component.get_editor_property('affect_distance_field_lighting')
        assert not component.get_editor_property('affect_dynamic_indirect_lighting')
        assert component.static_mesh.get_path_name() == '/Engine/BasicShapes/Cube.Cube'
    wanted = {PREFIX + name for name in saved['materials']} | {PREFIX + 'sign ' + r['source'] for r in saved['closures']}
    assert {label for label in labels if label.startswith(PREFIX)} == wanted
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    triangles = 0
    for name, metadata in saved['materials'].items():
        actor = labels[PREFIX + name]
        assert isinstance(actor, u.StaticMeshActor)
        component, mesh = actor.static_mesh_component, actor.static_mesh_component.static_mesh
        assert mesh.get_path_name() == '/Game/Plateau/Edges/SM_' + name + '.SM_' + name
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert component.is_visible() and not actor.get_editor_property('hidden') and component.get_editor_property('cast_shadow')
        material = component.get_material(0)
        assert material.get_path_name() == '/Game/Plateau/Materials/M_' + metadata['material'] + '.M_' + metadata['material']
        assert u.MaterialEditingLibrary.has_material_usage(material, u.MaterialUsage.MATUSAGE_NANITE)
        assert mesh.get_editor_property('nanite_settings').get_editor_property('enabled')
        settings = subsystem.get_lod_build_settings(mesh, 0)
        assert settings.get_editor_property('max_lumen_mesh_cards') == 64
        assert settings.get_editor_property('generate_distance_field_as_if_two_sided')
        assert mesh.get_num_triangles(0) == metadata['triangles']
        bounds = mesh.get_bounds()
        actual = [[bounds.origin.x - bounds.box_extent.x, bounds.origin.y - bounds.box_extent.y, bounds.origin.z - bounds.box_extent.z],
                  [bounds.origin.x + bounds.box_extent.x, bounds.origin.y + bounds.box_extent.y, bounds.origin.z + bounds.box_extent.z]]
        assert all(math.isfinite(v) and abs(v - target) < .2 for a, b in zip(actual, metadata['bounds_cm']) for v, target in zip(a, b))
        assert actor.get_actor_location().length() < .1
        scale, rotation = actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001
        assert all(math.isfinite(a) and abs(a) < .001 for a in (rotation.pitch, rotation.roll, rotation.yaw))
        triangles += metadata['triangles']
    for closure in saved['closures']:
        sign = closure['sign']
        actor = labels[PREFIX + 'sign ' + closure['source']]
        assert isinstance(actor, u.TextRenderActor)
        component = actor.get_component_by_class(u.TextRenderComponent)
        assert component.is_visible() and not actor.get_editor_property('hidden')
        assert not component.get_editor_property('cast_shadow')
        assert str(component.get_editor_property('text')) == sign['text']
        color = component.get_editor_property('text_render_color')
        assert all(getattr(color, channel) == value for channel, value in TEXT_COLOR.items()), 'Washed-out closure lettering'
        assert abs(component.get_editor_property('world_size') - sign['size']) < .001
        assert (actor.get_actor_location() - u.Vector(*sign['position'])).length() < .1
        rotation = actor.get_actor_rotation()
        assert all(math.isfinite(a) and abs(a) < .001 for a in (rotation.pitch, rotation.roll, rotation.yaw - sign['yaw']))
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    assert triangles == saved['triangles']
    return {'hidden_original_barriers': len(barriers), 'original_collision_preserved': True,
            'batches': len(saved['materials']), 'triangles': triangles, 'signs': len(saved['closures']),
            'closures': saved['closures'], 'new_collision': False}
