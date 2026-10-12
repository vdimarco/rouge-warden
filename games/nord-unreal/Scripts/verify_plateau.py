"""Run after reloading LaFontaine to verify saved Plateau assets and collision."""
import json
import math
from pathlib import Path
import sys
import traceback
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
sys.path.insert(0, str(ROOT / 'Scripts'))
from prepare_plateau import geography

REPORT = {'passed': False, 'checks': [],
          'limitations': ['No GUI/art-fidelity assessment or audio listening',
                          'Collision traces are not a full player/car physics playthrough']}
OUTPUT = ROOT / 'Saved/Tests/Plateau.json'


def samples(points, spacing=200):
    for a, b in zip(points, points[1:]):
        steps = max(1, math.ceil(math.dist(a[:2], b[:2]) / spacing))
        for i in range(steps + 1):
            yield (a[0] + (b[0] - a[0]) * i / steps,
                   a[1] + (b[1] - a[1]) * i / steps)


def verify_ground(labels):
    from plateau_ground import build_ground
    from plateau_mesh import Mesh

    def base_color_textures(material):
        # Compiled material resources are unavailable under NullRHI. Follow the
        # saved expression connections instead of GetMaterialUsedTextures.
        pending = [u.MaterialEditingLibrary.get_material_property_input_node(material, u.MaterialProperty.MP_BASE_COLOR)]
        visited, textures = [], []
        while pending:
            expression = pending.pop()
            if expression is None or expression in visited:
                continue
            visited.append(expression)
            if isinstance(expression, u.MaterialExpressionTextureSample):
                texture = expression.get_editor_property('texture')
                if texture:
                    textures.append(texture)
            pending.extend(u.MaterialEditingLibrary.get_inputs_for_material_expression(material, expression))
        return textures

    directory = ROOT / 'Data/Plateau/GroundGeometry'
    metadata = json.loads((directory / 'ground.json').read_text())
    expected = build_ground(Mesh())
    assert metadata == expected, 'Ground metadata differs from the checked-in OSM survey'
    park = next(surface for surface in metadata['surfaces'] if surface['source'] == 'way/4767368')
    assert park['name'] == 'Parc La Fontaine' and park['source_way_ids'] == ['4767368']
    assert math.isclose(park['area_square_metres'], 360035.04088788066, abs_tol=.01)
    assert park['z'] == 2 and metadata['new_collision'] is False
    assert 'OpenStreetMap contributors' in metadata['attribution'] and 'ODbL' in metadata['attribution']

    surfaces = metadata['surfaces']
    grass_bounds = [min(s['bounds_xy'][i] for s in surfaces) for i in (0, 1)] + [
                    max(s['bounds_xy'][i] for s in surfaces) for i in (2, 3)]
    grass_bounds += [min(s['z'] for s in surfaces), max(s['z'] for s in surfaces)]
    xmin, ymin, xmax, ymax = metadata['bounds_xy']
    mesh_results = {}
    for label, name, material, expected_triangles, limits in (
            ('OSM Grass', 'ParkGrass', 'ParkGrass', sum(s['triangles'] for s in surfaces), grass_bounds),
            ('Plateau ground textured yards', 'YardGround', 'Gravel', 2, [xmin, ymin, xmax, ymax, .5, .5])):
        actor = labels.get(label)
        assert isinstance(actor, u.StaticMeshActor), 'Missing ground actor ' + label
        component = actor.static_mesh_component
        mesh = component.static_mesh
        assert mesh and mesh.get_path_name().startswith('/Game/Plateau/Ground/SM_' + name + '.')
        assert mesh.get_num_triangles(0) == expected_triangles, (name, mesh.get_num_triangles(0), expected_triangles)
        bounds = mesh.get_bounds()
        observed = [bounds.origin.x - bounds.box_extent.x, bounds.origin.y - bounds.box_extent.y,
                    bounds.origin.x + bounds.box_extent.x, bounds.origin.y + bounds.box_extent.y,
                    bounds.origin.z - bounds.box_extent.z, bounds.origin.z + bounds.box_extent.z]
        assert all(math.isfinite(v) and abs(v - target) < .2 for v, target in zip(observed, limits)), (name, observed, limits)
        assert str(component.get_collision_profile_name()) == 'NoCollision', name
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION, name
        assert not component.get_editor_property('cast_shadow'), name
        assert (actor.get_actor_location() - u.Vector()).length() < .1, name
        scale = actor.get_actor_scale3d()
        assert math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001, name
        rotation = actor.get_actor_rotation()
        assert max(abs(rotation.roll), abs(rotation.pitch), abs(rotation.yaw)) < .001, name
        assigned = component.get_material(0)
        assert assigned and assigned.get_path_name().startswith('/Game/Plateau/Materials/M_' + material + '.')
        connected_textures = base_color_textures(assigned)
        diffuse = 'grass_ground_diff' if name == 'ParkGrass' else 'concrete_pavement_diff'
        assert any(texture.get_name() == diffuse for texture in connected_textures), 'Ground Base Color lost its connected diffuse texture: ' + name
        textures = [expression.get_editor_property('texture')
                    for expression in u.MaterialEditingLibrary.get_material_expressions(assigned)
                    if isinstance(expression, u.MaterialExpressionTextureSample) and expression.get_editor_property('texture')]
        mesh_results[name] = {'triangles': expected_triangles, 'bounds_xyz': observed,
                              'material': assigned.get_path_name(), 'textures': sorted(t.get_name() for t in textures),
                              'base_color_textures': sorted(t.get_name() for t in connected_textures)}

    vertices, uv = [], []
    for line in (directory / 'YardGround.obj').read_text().splitlines():
        if line.startswith('v '): vertices.append(tuple(map(float, line.split()[1:])))
        elif line.startswith('vt '): uv.append(tuple(map(float, line.split()[1:])))
    assert len(vertices) == len(uv) == 4
    assert all(abs(v[0] / 200 - t[0]) < .00002 and abs(-v[1] / 200 - t[1]) < .00002
               for v, t in zip(vertices, uv)), 'Yard OBJ lost world-scaled 2 m texture coordinates'
    spans = [max(t[i] for t in uv) - min(t[i] for t in uv) for i in (0, 1)]
    assert all(span > 400 for span in spans), 'Yard texture is stretched over the district'
    yard_material = labels['Plateau ground textured yards'].static_mesh_component.get_material(0)
    coordinates = [expression for expression in u.MaterialEditingLibrary.get_material_expressions(yard_material)
                   if isinstance(expression, u.MaterialExpressionTextureCoordinate)]
    assert coordinates and all(expression.get_editor_property('u_tiling') == 1 and
                               expression.get_editor_property('v_tiling') == 1 for expression in coordinates)
    assert labels['District ground'].static_mesh_component.get_material(0) == yard_material
    REPORT['ground'] = {'park_source': park['source'], 'park_area_square_metres': park['area_square_metres'],
                        'surfaces': len(surfaces), 'meshes': mesh_results, 'yard_source_uv_span': spans}
    REPORT['checks'].append('saved OSM park tessellation, exact extent/area, retained island, textured yard UVs and nonblocking shadowless overlays')


def verify_background(labels):
    from plateau_background import SOURCES
    visual_manifest = json.loads((ROOT / 'Data/Plateau/LandmarkVisualGeometry/visuals.json').read_text())
    corrected_visuals = {record['source_actor_label'] for record in visual_manifest['replacements']}
    manifest = json.loads((ROOT / 'Data/Plateau/BackgroundGeometry/layout.json').read_text())
    batches = manifest['batches']
    assert 0 < len(batches) <= 599
    assert sum(s['triangles'] for s in manifest['sources'].values()) == manifest['triangles']
    assert sum(batch['triangles'] for batch in batches.values()) == manifest['triangles']
    assert len([label for label in labels if label.startswith('Plateau background ')]) == len(batches)
    originals, original_triangles = {}, 0
    for name in SOURCES:
        actor = labels.get('OSM ' + name)
        assert isinstance(actor, u.StaticMeshActor), 'Missing original background ' + name
        component = actor.static_mesh_component
        assert not component.is_visible(), 'Original background still visible in editor: ' + name
        assert actor.get_editor_property('hidden'), 'Original background still visible in game: ' + name
        assert not component.get_editor_property('cast_shadow'), name
        assert not component.get_editor_property('affect_distance_field_lighting'), name
        assert not component.get_editor_property('affect_dynamic_indirect_lighting'), name
        # create_lafontaine.py makes all four sources (including Roof) blocking;
        # verify_lafontaine.py also requires the address roof's collision trace.
        assert str(component.get_collision_profile_name()) == 'BlockAll', name
        assert component.get_collision_enabled() == u.CollisionEnabled.QUERY_AND_PHYSICS, name
        mesh = component.static_mesh
        assert mesh and mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag') == u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE, name
        original_triangles += mesh.get_num_triangles(0)
        originals[name] = component
    imported_triangles, oversized = 0, []
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    for name, metadata in batches.items():
        assert metadata['material'] in originals and metadata['source_actor'] == 'OSM ' + metadata['material'], name
        assert metadata['collision'] is False, name
        limits = metadata['bounds_cm']
        assert len(limits) == 2 and all(len(point) == 3 for point in limits), name
        assert all(math.isfinite(v) and abs(v) < 200000 for point in limits for v in point), name
        span = max(limits[1][i] - limits[0][i] for i in (0, 1))
        assert metadata['oversized_face'] == (span > 12000), name
        if metadata['oversized_face']:
            assert metadata['faces'] == 1, 'Oversized background batch is divisible: ' + name
            oversized.append(name)
        else:
            assert span <= 12000, name
        actor = labels.get('Plateau background ' + name)
        assert isinstance(actor, u.StaticMeshActor), 'Missing background batch ' + name
        component = actor.static_mesh_component
        mesh = component.static_mesh
        assert mesh and mesh.get_path_name().startswith('/Game/Plateau/Background/SM_' + name + '.'), name
        assert str(component.get_collision_profile_name()) == 'NoCollision', name
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION, name
        assert component.get_material(0) == originals[metadata['material']].get_material(0), name
        if 'Plateau background ' + name in corrected_visuals:
            assert not component.is_visible() and actor.get_editor_property('hidden'), name
        else:
            assert component.is_visible() and not actor.get_editor_property('hidden'), name
        assert mesh.get_editor_property('nanite_settings').get_editor_property('enabled'), name
        assert subsystem.get_lod_build_settings(mesh, 0).get_editor_property('max_lumen_mesh_cards') == 64, name
        bounds = mesh.get_bounds()
        low = [bounds.origin.x - bounds.box_extent.x, bounds.origin.y - bounds.box_extent.y, bounds.origin.z - bounds.box_extent.z]
        high = [bounds.origin.x + bounds.box_extent.x, bounds.origin.y + bounds.box_extent.y, bounds.origin.z + bounds.box_extent.z]
        assert all(math.isfinite(v) and abs(v - wanted) < .2
                   for observed, expected in zip((low, high), limits) for v, wanted in zip(observed, expected)), (name, low, high, limits)
        position, scale, rotation = actor.get_actor_location(), actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert position.length() < .1 and math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001, name
        assert max(abs(rotation.roll), abs(rotation.pitch), abs(rotation.yaw)) < .001, name
        triangles = mesh.get_num_triangles(0)
        assert triangles > 0 and triangles <= metadata['triangles'], name
        imported_triangles += triangles
    assert imported_triangles == original_triangles, (imported_triangles, original_triangles)
    REPORT['background'] = {'batches': len(batches), 'triangles': imported_triangles,
                            'original_triangles': original_triangles, 'source_triangles': manifest['triangles'],
                            'tile_size_cm': manifest['tile_size_cm'], 'oversized_indivisible_faces': oversized}
    REPORT['checks'].append('saved local background bounds/materials, Nanite/64 Lumen cards, unchanged triangles and hidden originals retaining collision')


def verify_park(labels):
    from collections import Counter
    import struct
    from plateau_park import build_park
    source_mesh, expected = build_park()

    def verify_water_vertices(mesh, faces, metadata, name):
        # Mesh.write rounds OBJ coordinates to .001 cm; MeshDescription stores
        # FVector3f. Compare with that exact representation first, then allow
        # at most one float32 ULP plus one OBJ decimal unit for conversion.
        def obj_point(point):
            return tuple(struct.unpack('<f', struct.pack('<f', float(f'{v:.3f}')))[0] for v in point)
        source_triangles = [tuple(sorted((obj_point(face[0]), obj_point(face[i]), obj_point(face[i + 1]))))
                            for face in faces for i in range(1, len(face) - 1)]
        expected_points = {point for triangle in source_triangles for point in triangle}
        largest = max(abs(v) for point in expected_points for v in point)
        tolerance = .001 + 2. ** (math.floor(math.log2(largest)) - 23) if largest else .001
        description = mesh.get_static_mesh_description(0)
        assert description and description.get_triangle_count() == metadata['triangles'], 'Missing or changed saved pond source triangles ' + name
        seen, observed_triangles = set(), []
        for index in range(description.get_triangle_count()):
            instances = description.get_triangle_vertex_instances(u.TriangleID(id_value=index))
            assert len(instances) == 3, 'Invalid saved pond triangle ' + name
            triangle = []
            for instance in instances:
                vertex = description.get_vertex_instance_vertex(instance)
                position = description.get_vertex_position(vertex)
                point = (position.x, position.y, position.z)
                assert all(math.isfinite(v) for v in point), 'Nonfinite saved pond vertex ' + name
                match = point if point in expected_points else min(expected_points, key=lambda candidate: math.dist(point, candidate))
                assert math.dist(point, match) <= tolerance, (name, 'Saved pond vertex moved', point, tolerance)
                triangle.append(match)
                seen.add(match)
            observed_triangles.append(tuple(sorted(triangle)))
        assert seen == expected_points, 'Saved pond source vertices omitted ' + name
        assert Counter(observed_triangles) == Counter(source_triangles), 'Saved pond triangulation or island hole changed ' + name
        return seen

    saved = json.loads((ROOT / 'Data/Plateau/ParkGeometry/park.json').read_text())
    assert saved == json.loads(json.dumps(expected)), 'Saved park differs from the OSM survey or generator'
    assert saved['new_collision'] == 'mapped benches only'
    assert len(saved['ponds']) == 2 and sum(p['island_holes'] for p in saved['ponds']) == 1
    assert not labels['OSM Water'].static_mesh_component.is_visible()
    assert labels['OSM Water'].get_editor_property('hidden')
    assert labels['OSM Water'].static_mesh_component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    batches = saved['materials']
    assert len([name for name in labels if name.startswith('Plateau park ')]) == len(batches)
    triangles, water_triangles, water_vertices = 0, 0, set()
    for name, metadata in batches.items():
        actor = labels.get('Plateau park ' + name)
        assert isinstance(actor, u.StaticMeshActor), name
        component = actor.static_mesh_component
        assert component.is_visible() and not component.get_editor_property('hidden_in_game') and not actor.get_editor_property('hidden') and not actor.is_hidden_ed(), 'Hidden park batch ' + name
        assert actor.get_actor_location().length() < .1, 'Moved park actor ' + name
        scale, rotation = actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001, 'Scaled park actor ' + name
        assert all(math.isfinite(angle) and abs(angle) < .001 for angle in (rotation.pitch, rotation.roll, rotation.yaw)), 'Rotated park actor ' + name
        mesh = component.static_mesh
        assert mesh and mesh.get_path_name().startswith('/Game/Plateau/Park/SM_' + name + '.')
        assert mesh.get_num_triangles(0) == metadata['triangles'], name
        collides = metadata['collision']
        assert component.get_collision_enabled() == (u.CollisionEnabled.QUERY_AND_PHYSICS if collides else u.CollisionEnabled.NO_COLLISION), name
        assert str(component.get_collision_profile_name()) == ('BlockAll' if collides else 'NoCollision'), name
        if collides:
            assert mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag') == u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE, name
        material = component.get_material(0)
        assert material and material.get_path_name().startswith('/Game/Plateau/Materials/M_' + metadata['material'] + '.'), name
        assert bool(component.get_editor_property('cast_shadow')) == (metadata['material'] not in ('PondWater', 'AutumnGold', 'AutumnRust')), name
        if metadata['material'] != 'PondWater':
            assert mesh.get_editor_property('nanite_settings').get_editor_property('enabled'), name
            assert u.get_editor_subsystem(u.StaticMeshEditorSubsystem).get_lod_build_settings(mesh, 0).get_editor_property('max_lumen_mesh_cards') == 64, name
        else:
            water_vertices.update(verify_water_vertices(mesh, source_mesh.groups[name], metadata, name))
            water_triangles += metadata['triangles']
        triangles += metadata['triangles']
    assert water_triangles == sum(pond['triangles'] for pond in saved['ponds']), 'Saved pond triangle total differs from surveyed basins'
    water = u.EditorAssetLibrary.load_asset('/Game/Plateau/Materials/M_PondWater')
    assert u.MaterialEditingLibrary.get_material_property_input_node(water, u.MaterialProperty.MP_NORMAL)
    assert u.MaterialEditingLibrary.get_material_property_input_node(water, u.MaterialProperty.MP_BASE_COLOR)
    cloud = labels.get('Plateau autumn clouds')
    assert isinstance(cloud, u.VolumetricCloud)
    component = cloud.get_component_by_class(u.VolumetricCloudComponent)
    assert '/Engine/EngineSky/VolumetricClouds/' in str(component.get_editor_property('material'))
    world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
    for bench in saved['benches']:
        x, y = bench['position']
        hit = u.SystemLibrary.line_trace_single(world, u.Vector(x,y,120), u.Vector(x,y,10),
                                               u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, [], u.DrawDebugTrace.NONE, True)
        assert hit is not None, ('Bench has no saved seat collision', bench['source'])
        result = gameplay.call_method('BreakHitResult', (hit,))
        assert result[0], ('Bench seat trace did not block', bench['source'])
        point = result[5]
        assert abs(point.z-49) < 1, (bench['source'], point)
    REPORT['park'] = {'batches': len(batches), 'triangles': triangles, 'ponds': saved['ponds'],
                      'saved_pond_source_triangles': water_triangles, 'saved_pond_unique_vertices': len(water_vertices),
                      'saved_pond_vertex_positions_and_topology_verified': True,
                      'benches': len(saved['benches']), 'fallen_leaves': saved['fallen_leaves'],
                      'mapped_path_surfaces': len(saved['path_surfaces']), 'bench_seat_collision_traces': len(saved['benches'])}
    REPORT['checks'].append('saved surveyed pond holes/areas, solid mapped benches clear of paths, autumn detail, animated water/cloud material and nonblocking surface overlays')


def run():
    data = json.loads((ROOT / 'Data/Plateau/layout.json').read_text())
    baseline = json.loads((ROOT / 'Data/LaFontaine/layout.json').read_text())
    world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    assert world.get_path_name().startswith('/Game/Maps/LaFontaine.'), 'Open the saved LaFontaine map first'
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    labels = {actor.get_actor_label(): actor for actor in actors}
    municipal = [actor for actor in actors if actor.get_actor_label().startswith('Municipal building ')]
    if municipal:
        expected_city = len(json.loads((ROOT / 'Data/CityBuildings/manifest.json').read_text())['buildings'])
        assert len(municipal) == expected_city, 'Warden city actor inventory changed'
        old_city = municipal + [labels['Environment architecture accents']]
        assert all(actor.get_editor_property('hidden') and
                   not actor.static_mesh_component.is_visible() and
                   actor.static_mesh_component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
                   for actor in old_city), 'Legacy city building/accent overlaps Plateau geometry'
        REPORT['retired_warden_city_buildings'] = len(municipal)
        REPORT['checks'].append('legacy Warden city shells and accents retired while Plateau context supplies visible/colliding buildings')
    owned = [a.get_actor_label() for a in actors if a.get_actor_label().startswith(('Plateau detail ', 'Plateau context ', 'Plateau park ', 'Plateau wayfinding ', 'Plateau landmark ', 'Plateau edge '))]
    assert len(owned) == len(set(owned)), 'Duplicate generated actor labels'
    fronts = data['facades']['fronts']
    assert len(fronts) >= 100 and len({front['id'] for front in fronts}) == len(fronts)
    assert data['facades']['counts']['fronts'] == len(fronts)
    assert data['facades']['counts']['treated_surfaces'] >= 600
    assert data['facades']['counts']['rear_galleries'] >= 50
    REPORT['checks'].append(str(len(fronts)) + ' unique authored frontage metadata records')

    total = expected_total = 0
    mesh_report = {}
    for name, metadata in data['materials'].items():
        actor = labels.get('Plateau detail ' + name)
        assert actor and isinstance(actor, u.StaticMeshActor), 'Missing batch actor ' + name
        component = actor.static_mesh_component
        mesh = component.static_mesh
        assert mesh and mesh.get_path_name().startswith('/Game/Plateau/Meshes/SM_' + name + '.')
        triangles = mesh.get_num_triangles(0)
        expected = metadata['triangles']
        assert triangles == expected, (name, triangles, expected)
        assert component.is_visible() and not actor.get_editor_property('hidden'), 'Hidden detail batch ' + name
        position, scale, rotation = actor.get_actor_location(), actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert position.length() < .1 and math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001, 'Moved/scaled detail batch ' + name
        assert all(math.isfinite(angle) and abs(angle) < .001 for angle in (rotation.roll, rotation.pitch, rotation.yaw)), 'Rotated detail batch ' + name
        bounds = mesh.get_bounds()
        assert all(math.isfinite(v) for v in (bounds.origin.x, bounds.origin.y, bounds.origin.z,
                                             bounds.box_extent.x, bounds.box_extent.y, bounds.box_extent.z))
        assert 0 <= bounds.box_extent.x < 100000 and 0 <= bounds.box_extent.y < 100000
        assert 0 <= bounds.box_extent.z < 100000 and max(bounds.box_extent.x, bounds.box_extent.y, bounds.box_extent.z) > 0
        assert triangles > 0 and expected > 0
        assert all(abs(v) < 200000 for v in (bounds.origin.x, bounds.origin.y, bounds.origin.z))
        collides = metadata.get('collision',name.endswith('_Collision'))
        assert str(component.get_collision_profile_name()) == ('BlockAll' if collides else 'NoCollision'), name
        assert component.get_collision_enabled() == (u.CollisionEnabled.QUERY_AND_PHYSICS if collides else u.CollisionEnabled.NO_COLLISION), name
        if collides:
            assert mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag') == u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE, name
        material = component.get_material(0)
        assert material and material.get_path_name() == '/Game/Plateau/Materials/M_' + metadata['material'] + '.M_' + metadata['material'], 'Wrong detail material ' + name
        if metadata['material'] == 'White':
            assert not component.get_editor_property('cast_shadow'), 'Paint casts plank shadows: ' + name
        assert mesh.get_editor_property('nanite_settings').get_editor_property('enabled'), name
        assert u.get_editor_subsystem(u.StaticMeshEditorSubsystem).get_lod_build_settings(mesh,0).get_editor_property('max_lumen_mesh_cards') == 64, name
        if collides:
            nanite = mesh.get_editor_property('nanite_settings')
            assert nanite.get_editor_property('fallback_target') == u.NaniteFallbackTarget.PERCENT_TRIANGLES, name
            assert math.isclose(nanite.get_editor_property('fallback_percent_triangles'), 1.), name
            assert nanite.get_editor_property('fallback_relative_error') == 0., name
        total += triangles
        expected_total += expected
        mesh_report[name] = triangles
    assert expected_total * .95 <= total <= expected_total * 1.05, (total, expected_total)
    REPORT['geometry'] = {'batches': len(mesh_report), 'triangles': total, 'source_triangles': expected_total,
                          'triangles_by_batch': mesh_report}
    REPORT['checks'].append('saved mesh batches, triangle bounds, materials and collision profiles')
    verify_ground(labels)
    verify_background(labels)
    import plateau_landmark_visuals
    REPORT['landmark_visuals'] = plateau_landmark_visuals.verify(u)
    import plateau_facade_finish
    REPORT['facade_finish'] = plateau_facade_finish.verify(u)
    verify_park(labels)
    from verify_plateau_context import verify as verify_context
    REPORT['context'] = verify_context(u, labels, ROOT)
    REPORT['checks'].append('saved surrounding OSM context: exact source manifests, local bounds, collision, materials, Nanite and lighting')
    from plateau_ground import triangulate, signed_area
    context = json.loads((ROOT/'Data/Plateau/ContextGeometry/context.json').read_text())
    bounds = context['bounds_xy']
    gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
    roof_traces = 0
    ignored = [a for a in actors if a.get_actor_label() in ('OSM Wood','OSM HiddenTrunks')]
    for building in context['buildings']:
        if building['building_tag'] == 'roof' or not any(bounds[0]<p[0]<bounds[2] and bounds[1]<p[1]<bounds[3] for p in building['footprint_xy']):
            continue
        clipped = triangulate([building['footprint_xy']], bounds)
        if not clipped:
            continue
        triangle = max(clipped,key=lambda t:abs(signed_area(t)))
        x,y = [sum(p[i] for p in triangle)/3 for i in (0,1)]
        z = building['height_cm']
        hit = u.SystemLibrary.line_trace_single(world,u.Vector(x,y,z+20),u.Vector(x,y,z-20),
                u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,ignored,u.DrawDebugTrace.NONE,True)
        result = gameplay.call_method('BreakHitResult',(hit,))
        assert result[0] and abs(result[5].z-z)<1, ('Missing solid boundary building roof',building['source'])
        roof_traces += 1
    assert roof_traces >= 150, 'Insufficient boundary building collision probes'
    REPORT['context']['boundary_building_roof_traces'] = roof_traces
    from verify_plateau_landmarks import verify as verify_landmarks
    from verify_plateau_wayfinding import verify as verify_wayfinding
    from plateau_edges import verify as verify_edges
    REPORT['landmarks'] = verify_landmarks(u, labels, ROOT)
    REPORT['wayfinding'] = verify_wayfinding(u, labels, ROOT)
    REPORT['edges'] = verify_edges(u, labels, ROOT)
    REPORT['checks'].append('saved theatre envelope, upright French cartography with solid frames, and readable closures at preserved map boundaries')
    for board in json.loads((ROOT/'Data/Plateau/Wayfinding/Geometry/wayfinding.json').read_text())['boards']:
        point, normal = board['position_cm'], board['facing_normal_xy']
        hit = u.SystemLibrary.line_trace_single(world, u.Vector(point[0]+normal[0]*100,point[1]+normal[1]*100,145),
                    u.Vector(point[0]-normal[0]*100,point[1]-normal[1]*100,145),u.TraceTypeQuery.TRACE_TYPE_QUERY1,
                    True,[],u.DrawDebugTrace.NONE,True)
        gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
        result = gameplay.call_method('BreakHitResult',(hit,))
        assert result[0] and math.dist((result[5].x,result[5].y),point[:2]) < 2, ('Board is not solid',board['id'])

    tree_points = data['streets']['detailed_trees']
    street_trees = [actor for actor in actors if actor.get_actor_label().startswith('Plateau detail street tree ')]
    assert len(street_trees) == len(tree_points) == 7
    tree_mesh = u.EditorAssetLibrary.load_asset('/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02')
    assert tree_mesh and tree_mesh.get_editor_property('nanite_settings').get_editor_property('enabled')
    tree_height = tree_mesh.get_bounds().box_extent.z * 2
    for i, point in enumerate(tree_points):
        actor = labels.get('Plateau detail street tree ' + str(i))
        assert isinstance(actor, u.StaticMeshActor)
        position = actor.get_actor_location()
        assert math.dist((position.x, position.y, position.z), (*point, 18)) < .1
        component = actor.static_mesh_component
        assert component.static_mesh == tree_mesh
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert abs(actor.get_actor_scale3d().z * tree_height - (360 + i % 3 * 35)) < .1
    for slot in tree_mesh.get_editor_property('static_materials'):
        assert u.MaterialEditingLibrary.has_material_usage(slot.material_interface, u.MaterialUsage.MATUSAGE_NANITE), slot.material_interface.get_path_name()
    REPORT['checks'].append('seven saved street trees at authored coordinates using Nanite mesh/material usage')

    from plateau_rendering import tree_positions
    assert not municipal and 'Environment architecture accents' not in labels, 'Legacy Warden architecture overlaps baked Plateau geometry'
    assert not any(actor.get_class().get_name() == 'QuebecParkInstances' for actor in actors), 'Legacy Comic park instances overlap baked Plateau geometry'
    assert not any(actor.get_actor_label() == 'Comic park inventory trunks' or
                   actor.get_actor_label().startswith('Comic park inventory crowns') for actor in actors), 'Legacy Warden trees overlap baked Plateau geometry'
    assert sum(actor.get_class().get_name() == 'QuebecVegetation' for actor in actors) == 1, 'Duplicate surveyed vegetation actors'
    assert sum(actor.get_actor_label() == 'Plateau mapped vegetation' for actor in actors) == 1, 'Duplicate mapped tree labels'
    vegetation = labels['Plateau mapped vegetation']
    trees = vegetation.get_editor_property('trees')
    assert trees.static_mesh == tree_mesh and trees.get_instance_count() == 4571
    assert trees.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    for i, (x, y, seed) in enumerate(tree_positions()):
        transform = trees.get_instance_transform(i, True)
        assert math.dist((transform.translation.x, transform.translation.y), (x, y)) < .1, seed
    REPORT['integration_mode'] = 'baked-plateau-environment-with-warden-gameplay'
    REPORT['tree_layer'] = {'mapped_tree_instances': trees.get_instance_count()}
    REPORT['checks'].append('4,571 saved detailed tree instances at surveyed coordinates')
    resident_data = json.loads((ROOT/'Data/ParkComic/layout.json').read_text())['residents']
    assert len(resident_data) == 14
    comic_residents = [actor for actor in actors if actor.get_class().get_name() == 'QuebecParkResident']
    assert len(comic_residents) == 14, 'Warden park route actors were lost'
    assert {actor.get_actor_label() for actor in comic_residents} == {
        'Comic resident ' + str(i) for i in range(14)}, 'Warden park route labels changed'
    for i, row in enumerate(resident_data):
        actor = labels['Comic resident ' + str(i)]
        assert actor.get_editor_property('Style') == row['style'], 'Warden resident style changed'
        assert math.isclose(actor.get_editor_property('Phase'), row['phase'], abs_tol=.001), 'Warden resident phase changed'
        route = actor.get_editor_property('Route')
        assert len(route) == len(row['route']) >= 2, 'Warden resident route lost'
        assert all(math.dist((point.x, point.y, point.z), expected) < .1
                   for point, expected in zip(route, row['route'])), 'Warden resident route changed'
    parked = [actor for actor in actors if actor.get_actor_label().startswith('Comic parked car ')]
    assert len(parked) == 8 and {actor.get_actor_label() for actor in parked} == {
        'Comic parked car ' + str(i) for i in range(8)}, 'Warden parked-car layer changed'
    assert all(actor.get_class().get_name() == 'QuebecCar' for actor in parked), 'Warden parked-car class changed'
    REPORT['warden_actor_layer'] = {'park_route_actors': len(comic_residents), 'parked_cars': len(parked)}
    REPORT['checks'].append('14 Warden residents with authored routes and styles plus eight driveable parked cars retained')
    for name in ('Wood', 'HiddenTrunks', 'Canopy', 'CanopyGold', 'CanopyRust'):
        assert not labels['OSM '+name].static_mesh_component.is_visible(), name
    for name in ('Brick', 'Cream', 'Sage', 'Roof'):
        assert labels['OSM '+name].static_mesh_component.static_mesh.get_editor_property('nanite_settings').get_editor_property('enabled'), name
    REPORT['checks'].append('old OSM crowns hidden and city batches use Nanite')

    signs = data['facades'].get('signs', []) + data['streets'].get('signs', [])
    for i, sign in enumerate(signs):
        actor = labels.get('Plateau detail sign ' + str(i) + ' ' + sign['text'])
        assert isinstance(actor, u.TextRenderActor), 'Missing sign ' + sign['text']
        text = actor.get_component_by_class(u.TextRenderComponent)
        assert str(text.get_editor_property('text')) == sign['text']
    REPORT['checks'].append(str(len(signs)) + ' saved French text signs')

    residents = [actor for actor in actors if actor.get_actor_label().startswith('Plateau life resident ')]
    assert len(residents) == 12
    walking_residents = 0
    civilian_meshes = set()
    for actor in residents:
        assert actor.get_class().get_name() == 'QuebecPedestrian'
        assert actor.get_editor_property('replicates') and actor.get_editor_property('replicate_movement')
        component = actor.get_editor_property('resident_mesh')
        mesh = component.get_skeletal_mesh_asset()
        assert mesh and mesh.get_path_name().startswith('/Game/Plateau/Life/Civilians/')
        civilian_meshes.add(mesh.get_name())
        assert 140 < mesh.get_bounds().box_extent.z * 2 < 220
        idle = actor.get_editor_property('idle_animation')
        walk = actor.get_editor_property('walk_animation')
        skeleton = mesh.get_editor_property('skeleton')
        assert skeleton and idle and walk
        assert idle.get_name().endswith('_Idle') and walk.get_name().endswith('_Walk')
        assert idle.get_editor_property('skeleton') == walk.get_editor_property('skeleton') == skeleton
        assert idle.get_play_length() > .5 and walk.get_play_length() > .5
        saved = component.get_editor_property('animation_data')
        animation = saved.get_editor_property('anim_to_play')
        assert animation == idle
        assert saved.get_editor_property('saved_looping') and saved.get_editor_property('saved_playing')
        assert component.get_animation_mode() == u.AnimationMode.ANIMATION_SINGLE_NODE
        assert all(material.get_path_name().startswith('/Game/Plateau/Life/') for material in component.get_materials())
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        points = actor.get_editor_property('patrol_points')
        assert len(points) in (1, 2)
        assert (actor.get_actor_location() - points[0]).length() < 1
        if len(points) > 1:
            walking_residents += 1
            assert 50 < actor.get_editor_property('walk_speed') < 140
            assert 2 <= actor.get_editor_property('pause_duration') <= 5
    assert walking_residents == 6 and len(civilian_meshes) == 6
    REPORT['checks'].append('12 saved clothed civilian residents, six original rigs with idle/walk clips, six replicated walking routes')

    ambience = [actor for actor in actors if actor.get_actor_label().startswith('Plateau life ambience ')]
    assert len(ambience) == 2
    for actor in ambience:
        assert isinstance(actor, u.AmbientSound)
        audio = actor.get_component_by_class(u.AudioComponent)
        sound = audio.get_editor_property('sound')
        assert isinstance(sound, u.SoundWave) and sound.get_editor_property('looping')
        assert sound.get_path_name().startswith('/Game/Plateau/Audio/')
        assert audio.get_editor_property('auto_activate') and audio.get_editor_property('override_attenuation')
        attenuation = audio.get_editor_property('attenuation_overrides')
        assert attenuation.get_editor_property('attenuate') and attenuation.get_editor_property('spatialize')
        assert attenuation.get_editor_property('falloff_distance') > 0
        assert 0 < audio.get_editor_property('volume_multiplier') < 1
    REPORT['checks'].append('two saved looping auto-activating spatialized ambient SoundWaves')

    assert sum(isinstance(actor, u.PlayerStart) for actor in actors) == 4
    car = labels.get('Your first car')
    assert car and car.get_class().get_name() == 'QuebecCar'
    assert math.dist((car.get_actor_location().x, car.get_actor_location().y), baseline['car'][:2]) < 1
    rings = [actor for actor in actors if actor.get_actor_label().startswith('Mission ring')]
    beacons = [actor for actor in actors if actor.get_actor_label().startswith('Mission beacon')]
    assert len(rings) == len(beacons) == len(baseline['missions']) == 3
    for position in baseline['missions']:
        for group in (rings, beacons):
            assert any(math.dist((actor.get_actor_location().x, actor.get_actor_location().y), position[:2]) < 1 for actor in group)
    REPORT['checks'].append('original four player starts, playable car and three mission marker pairs preserved')

    gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))

    def ground(point):
        hit = u.SystemLibrary.line_trace_single(world, u.Vector(point[0], point[1], 220),
            u.Vector(point[0], point[1], -100), u.TraceTypeQuery.TRACE_TYPE_QUERY1,
            True, [car], u.DrawDebugTrace.NONE, True)
        assert hit is not None, 'No collision ground at ' + str(point)
        result = gameplay.call_method('BreakHitResult', (hit,))
        assert result[0], 'Ground trace did not block at ' + str(point)
        return result[5].z

    gallery_decks = 0
    surfaces = fronts + [surface for front in fronts for surface in front.get('corner_returns', [])]
    for surface in surfaces:
        if 'gallery_headroom' not in surface: continue
        assert surface['gallery_headroom'] >= 240
        depth = (surface['gallery_depth'] / 2 + 10) * min(1, max(.43, surface['setback'] / 70))
        point = [(surface['a'][i] + surface['b'][i]) / 2 + surface['normal'][i] * depth for i in range(2)]
        assert -1 <= ground(point) <= 20, ('Gallery passage blocked', surface['id'])
        for height in surface['balcony_levels']:
            hit = u.SystemLibrary.line_trace_single(world, u.Vector(*point, height + 60),
                u.Vector(*point, height - 30), u.TraceTypeQuery.TRACE_TYPE_QUERY1,
                True, [car], u.DrawDebugTrace.NONE, True)
            assert hit is not None, ('Missing gallery collision', surface['id'], height)
            result = gameplay.call_method('BreakHitResult', (hit,))
            assert result[0] and abs(result[5].z - height - 6) < .2, ('Gallery deck collision', surface['id'], height, result[5])
            gallery_decks += 1
    assert gallery_decks == data['facades']['counts']['rear_galleries']
    REPORT['checks'].append(str(gallery_decks)+' gallery deck collision traces and clear passages below')

    walk_points = list(samples(data['streets']['route']))
    walk_heights = [ground(point) for point in walk_points]
    assert all(-1 <= z <= 20 for z in walk_heights), ('Walking route obstacle', max(walk_heights))
    capsule_segments = 0
    for a, b in zip(data['streets']['route'], data['streets']['route'][1:]):
        # The body sweep clears permitted curb steps while detecting walls, rails and low galleries.
        hit = u.SystemLibrary.capsule_trace_single(world, u.Vector(a[0], a[1], 116),
            u.Vector(b[0], b[1], 116), 42., 96., u.TraceTypeQuery.TRACE_TYPE_QUERY1,
            True, [car], u.DrawDebugTrace.NONE, True)
        assert hit is None or not gameplay.call_method('BreakHitResult', (hit,))[0], ('Walking body blocked', a, b, hit)
        capsule_segments += 1
    # Roads are surveyed OSM centrelines; probe the existing car's 2 m body width.
    _, roads = geography()
    focus = data.get('focus', data['route'])

    def near(point):
        for a, b in zip(focus, focus[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            fraction = max(0., min(1., ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
            if math.dist(point, (a[0] + dx * fraction, a[1] + dy * fraction)) < 2500:
                return True
        return False

    car_heights = []
    for road in roads:
        if (road['name'] not in ('Rue Sherbrooke Est', 'Rue Panet', 'Rue de la Visitation')
                or road['tags'].get('highway') not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified')):
            continue
        for a, b in zip(road['points'], road['points'][1:]):
            length = math.dist(a, b)
            if length < 1:
                continue
            nx, ny = -(b[1] - a[1]) / length, (b[0] - a[0]) / length
            for point in samples((a, b)):
                if near(point):
                    for offset in (-100, 0, 100):
                        probe = (point[0] + nx * offset, point[1] + ny * offset)
                        z = ground(probe)
                        assert -1 <= z <= 18.5, ('Car road clearance blocked', road['name'], probe, z)
                        car_heights.append(z)
    assert len(car_heights) >= 30, 'Insufficient road clearance samples'
    REPORT['collision'] = {'walking_samples': len(walk_points), 'walking_body_capsule_segments': capsule_segments, 'gallery_decks': gallery_decks, 'walking_surface_z_range_cm': [min(walk_heights), max(walk_heights)],
                           'car_road_samples': len(car_heights), 'car_surface_z_range_cm': [min(car_heights), max(car_heights)]}
    REPORT['checks'].append('walking route ground and 2 m car-width street clearance traces')
    REPORT['passed'] = True


try:
    run()
except Exception:
    REPORT['error'] = traceback.format_exc()
    raise
finally:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))
    u.log(('PLATEAU_VERIFY_OK ' if REPORT['passed'] else 'PLATEAU_VERIFY_FAILED ') + json.dumps(REPORT, ensure_ascii=False))
