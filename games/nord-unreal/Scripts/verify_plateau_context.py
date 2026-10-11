"""Read-only verification of saved mapped shells and visual city surroundings."""
import json
import math
from pathlib import Path
import struct

from plateau_context import MAX_BATCHES, SHELL_MATERIALS, TILE_CM, build_context


def _float32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def _source_geometry(u, mesh, faces, metadata, name):
    """Check authored vertices, rather than the union of Nanite's coarse LODs.

    Mesh.write emits three decimal places and the source MeshDescription stores
    FVector3f. Allow one float32 ULP plus one OBJ decimal unit; this remains below
    .009 cm at the outer edge of this survey.
    """
    points = {_float32(float(f'{v:.3f}')) for face in faces for point in face for v in point}
    largest = max(abs(v) for v in points)
    exponent = math.floor(math.log2(largest)) if largest else 0
    tolerance = .001 + 2. ** (exponent - 23)
    expected = {tuple(_float32(float(f'{v:.3f}')) for v in point)
                for face in faces for point in face}
    cells = {}
    for point in expected:
        key = tuple(math.floor(v / tolerance) for v in point)
        cells.setdefault(key, []).append(point)
    description = mesh.get_static_mesh_description(0)
    assert description and description.get_triangle_count() == metadata['triangles'], 'Missing or changed saved context source triangles ' + name
    seen, read_vertices = set(), set()
    low, high = [math.inf] * 3, [-math.inf] * 3
    for index in range(description.get_triangle_count()):
        instances = description.get_triangle_vertex_instances(u.TriangleID(id_value=index))
        assert len(instances) == 3, 'Invalid saved context source triangle ' + name
        for instance in instances:
            vertex = description.get_vertex_instance_vertex(instance)
            identifier = vertex.get_editor_property('id_value')
            if identifier in read_vertices:
                continue
            read_vertices.add(identifier)
            position = description.get_vertex_position(vertex)
            point = (position.x, position.y, position.z)
            assert all(math.isfinite(v) for v in point), 'Nonfinite saved context source vertex ' + name
            matched = point if point in expected else None
            if matched is None:
                key = tuple(math.floor(v / tolerance) for v in point)
                candidates = (candidate for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1)
                              for candidate in cells.get((key[0] + dx, key[1] + dy, key[2] + dz), ()))
                matched = min(candidates, key=lambda candidate: math.dist(point, candidate), default=None)
                assert matched is not None and math.dist(point, matched) <= tolerance, (name, 'Saved context source vertex moved', point, tolerance)
            seen.add(matched)
            low = [min(a, b) for a, b in zip(low, point)]
            high = [max(a, b) for a, b in zip(high, point)]
    assert seen == expected, 'Saved context source vertices omitted ' + name
    limits = metadata['bounds_cm']
    assert all(abs(value - target) <= tolerance for actual, expected_bound in zip((low, high), limits)
               for value, target in zip(actual, expected_bound)), (name, 'Saved context source bounds', [low, high], limits)
    assert max(high[i] - low[i] for i in (0, 1)) <= TILE_CM + 2 * tolerance, 'Oversized saved context source batch ' + name
    return [low, high], tolerance


def verify(u, labels, root):
    root = Path(root)
    manifest = json.loads((root / 'Data/Plateau/ContextGeometry/context.json').read_text())
    source_mesh, generated = build_context(root / 'Data/LaFontaine/osm.xml')
    expected = json.loads(json.dumps(generated))
    assert manifest == expected, 'Saved context manifest differs from the OSM survey or current generator'
    batches = manifest['materials']
    assert len(batches) == 742 and len(batches) <= MAX_BATCHES, 'Unexpected surrounding context batch count'
    assert manifest['new_collision'] == 'mapped building shells only' and manifest['tile_size_cm'] == TILE_CM
    wanted = {'Plateau context ' + name for name in batches}
    assert {label for label in labels if label.startswith('Plateau context ')} == wanted, 'Missing or extra context actors'

    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    triangles = 0
    materials = set()
    render_padding = 0.
    for name, metadata in batches.items():
        actor = labels['Plateau context ' + name]
        assert isinstance(actor, u.StaticMeshActor), 'Invalid context actor ' + name
        component = actor.static_mesh_component
        mesh = component.static_mesh
        path = '/Game/Plateau/Context/SM_' + name + '.SM_' + name
        assert mesh and mesh.get_path_name() == path, 'Wrong saved context mesh ' + name
        collides = metadata['material'] in SHELL_MATERIALS
        assert metadata['collision'] == collides
        assert str(component.get_collision_profile_name()) == ('BlockAll' if collides else 'NoCollision'), 'Wrong context collision profile ' + name
        assert component.get_collision_enabled() == (u.CollisionEnabled.QUERY_AND_PHYSICS if collides else u.CollisionEnabled.NO_COLLISION), 'Wrong context collision mode ' + name
        if collides:
            assert mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag') == u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE, 'Mapped context shell lost complex collision ' + name
        assert component.is_visible() and not actor.get_editor_property('hidden'), 'Hidden context batch ' + name
        assert bool(component.get_editor_property('cast_shadow')) == (metadata['material'] != 'Gravel'), 'Wrong context shadow policy ' + name
        material = component.get_material(0)
        material_path = '/Game/Plateau/Materials/M_' + metadata['material'] + '.M_' + metadata['material']
        assert material and material.get_path_name() == material_path, 'Wrong context material ' + name
        assert u.MaterialEditingLibrary.has_material_usage(material, u.MaterialUsage.MATUSAGE_NANITE), 'Missing context Nanite material usage ' + name
        materials.add(metadata['material'])

        nanite = mesh.get_editor_property('nanite_settings')
        assert nanite.get_editor_property('enabled'), 'Context Nanite disabled ' + name
        assert nanite.get_editor_property('fallback_target') == u.NaniteFallbackTarget.PERCENT_TRIANGLES, 'Wrong context Nanite fallback target ' + name
        assert math.isclose(nanite.get_editor_property('fallback_percent_triangles'), 1., abs_tol=1e-6), 'Reduced context fallback triangles ' + name
        assert math.isclose(nanite.get_editor_property('fallback_relative_error'), 0., abs_tol=1e-6), 'Context fallback error changed ' + name
        settings = subsystem.get_lod_build_settings(mesh, 0)
        assert settings.get_editor_property('max_lumen_mesh_cards') == 64, 'Wrong context Lumen card budget ' + name
        assert settings.get_editor_property('generate_distance_field_as_if_two_sided'), 'Context two-sided distance field disabled ' + name

        limits = metadata['bounds_cm']
        assert max(limits[1][i] - limits[0][i] for i in (0, 1)) <= TILE_CM + 1e-6, 'Oversized source context batch ' + name
        source_bounds, source_tolerance = _source_geometry(u, mesh, source_mesh.groups[name], metadata, name)
        bounds = mesh.get_bounds()
        observed = [[bounds.origin.x - bounds.box_extent.x, bounds.origin.y - bounds.box_extent.y,
                     bounds.origin.z - bounds.box_extent.z],
                    [bounds.origin.x + bounds.box_extent.x, bounds.origin.y + bounds.box_extent.y,
                     bounds.origin.z + bounds.box_extent.z]]
        # UE unions bounds from every Nanite LOD (ClusterDAG::ReduceMesh),
        # including simplified vertices outside the authored mesh. Those render
        # bounds must enclose the strict source above, but are not its footprint.
        assert all(math.isfinite(value) for side in observed for value in side), 'Nonfinite context render bounds ' + name
        assert all(observed[0][i] <= source_bounds[0][i] + source_tolerance and
                   observed[1][i] >= source_bounds[1][i] - source_tolerance
                   for i in range(3)), (name, 'Context render bounds do not enclose saved source', observed, source_bounds)
        render_padding = max(render_padding, *(abs(value - target) for actual, expected_bound in zip(observed, source_bounds)
                                               for value, target in zip(actual, expected_bound)))
        position, scale, rotation = actor.get_actor_location(), actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert position.length() < .1, 'Moved context actor ' + name
        assert math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001, 'Scaled context actor ' + name
        angles = (rotation.roll, rotation.pitch, rotation.yaw)
        assert all(math.isfinite(angle) and abs(angle) < .001 for angle in angles), 'Rotated context actor ' + name
        imported = mesh.get_num_triangles(0)
        assert imported == metadata['triangles'], (name, 'Context triangles changed on import', imported, metadata['triangles'])
        triangles += imported
    assert triangles == manifest['triangles'], 'Context triangle total changed'
    return {'batches': len(batches), 'buildings': manifest['building_count'],
            'triangles': triangles, 'source_triangles': manifest['triangles'],
            'tile_size_cm': manifest['tile_size_cm'], 'lumen_mesh_cards': 64,
            'source_vertex_positions_verified': True,
            'nanite_render_bounds_max_padding_cm': render_padding,
            'two_sided_distance_fields': True, 'nanite_materials': sorted(materials),
            'apron_area_square_metres': manifest['apron']['area_square_metres'],
            'continued_road_ways': len(manifest['roads']),
            'height_estimates': manifest['height_estimate_count'],
            'height_clamps': manifest['height_clamped_count'],
            'partial_buildings': manifest['partial_building_count'],
            'excluded_interior_buildings': len(manifest['excluded_interior_sources']),
            'bounds_xy': manifest['bounds_xy'], 'outer_bounds_xy': manifest['outer_bounds_xy'],
            'new_collision': manifest['new_collision']}
