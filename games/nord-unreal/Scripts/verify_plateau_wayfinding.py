"""Read-only source and saved-asset checks for the two park orientation boards."""
import hashlib
import json
import math
from pathlib import Path
import tempfile

from plateau_wayfinding import LABEL_PREFIX, prepare


def _asset_path(path):
    return path + '.' + path.rsplit('/', 1)[1]


def _sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _base_color_samples(u, material):
    """Inspect saved connections, which also work without compiled NullRHI shaders."""
    library = u.MaterialEditingLibrary
    pending = [library.get_material_property_input_node(material, u.MaterialProperty.MP_BASE_COLOR)]
    visited, samples = [], []
    while pending:
        node = pending.pop()
        if node is None or node in visited:
            continue
        visited.append(node)
        if isinstance(node, u.MaterialExpressionTextureSample):
            samples.append(node)
        pending.extend(library.get_inputs_for_material_expression(material, node))
    return samples


def _verify_panel_uvs(u, mesh, board):
    # These reflected editor methods read the saved source mesh description,
    # not GPU resources. ElementID's inherited IDValue is a struct init argument.
    description = mesh.get_static_mesh_description(0)
    assert description and description.get_triangle_count() == 2, 'Missing saved image mesh description'
    seen = set()
    for index in range(2):
        instances = description.get_triangle_vertex_instances(u.TriangleID(id_value=index))
        assert len(instances) == 3, 'Invalid saved image triangle'
        for instance in instances:
            vertex = description.get_vertex_instance_vertex(instance)
            p = description.get_vertex_position(vertex)
            point = (p.x, p.y, p.z)
            distances = [math.dist(point, corner) for corner in board['panel_corners_cm']]
            nearest = min(range(4), key=distances.__getitem__)
            assert distances[nearest] < .02, 'Saved image corner moved ' + board['id']
            seen.add(nearest)
            uv = description.get_vertex_instance_uv(instance, 0)
            expected_u, obj_v = board['obj_uvs'][nearest]
            assert all(math.isfinite(v) for v in (uv.x, uv.y))
            assert abs(uv.x - expected_u) < 1e-5 and abs(uv.y - (1 - obj_v)) < 1e-5, \
                'Saved image UV is mirrored, inverted or includes padding ' + board['id']
    assert seen == {0, 1, 2, 3}, 'Saved image does not cover all four corners'


def verify(u, labels, root):
    root = Path(root)
    directory = root / 'Data/Plateau/Wayfinding/Geometry'
    cartography = root / 'Data/Plateau/Cartography/cartography.json'
    manifest = json.loads((directory / 'wayfinding.json').read_text())
    with tempfile.TemporaryDirectory(prefix='plateau_wayfinding_verify_') as temporary:
        expected = prepare(temporary, cartography)
    assert manifest == expected, 'Saved wayfinding manifest differs from approved artwork or generator'
    batches, boards = manifest['batches'], manifest['boards']
    assert len(batches) == 4 and len(boards) == 2 and manifest['triangles'] == 572
    assert sum(b['collision'] for b in batches.values()) == 2
    wanted = {b['actor_label'] for b in batches.values()}
    assert {label for label in labels if label.startswith(LABEL_PREFIX)} == wanted, 'Missing or extra wayfinding actors'
    for name, metadata in batches.items():
        assert _sha256(directory / (name + '.obj')) == metadata['sha256'], 'Changed wayfinding OBJ ' + name

    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    materials = {}
    for board in boards:
        identifier = board['id']
        image = cartography.parent / board['texture_source']
        assert _sha256(image) == board['texture_sha256'], 'Changed source cartography PNG ' + identifier
        assert board['image_size_cm'] == [105, 140] and board['frame_size_cm'] == [112, 148]
        assert board['image_bottom_cm'] == 75 and board['image_top_cm'] == 215
        assert board['texture_built_size_pixels'] == [2048, 2048]
        assert board['texture_uv_bounds'] == [0, 0, .75, 1]
        assert board['obj_uvs'] == [[0, 0], [0, 1], [.75, 1], [.75, 0]]
        assert board['minimum_capsule_edge_clearance_cm'] > 52
        texture = assets.load_asset(board['texture_asset'])
        assert isinstance(texture, u.Texture2D), 'Missing saved cartography Texture2D ' + identifier
        assert texture.get_path_name() == _asset_path(board['texture_asset']), 'Wrong cartography texture asset ' + identifier
        properties = {'srgb': True, 'power_of_two_mode': u.TexturePowerOfTwoSetting.PAD_TO_POWER_OF_TWO,
                      'pad_with_border_color': True, 'compression_settings': u.TextureCompressionSettings.TC_BC7,
                      'address_x': u.TextureAddress.TA_CLAMP, 'address_y': u.TextureAddress.TA_CLAMP,
                      'mip_gen_settings': u.TextureMipGenSettings.TMGS_SHARPEN2, 'never_stream': False}
        for key, target in properties.items():
            assert texture.get_editor_property(key) == target, 'Wrong cartography texture ' + key + ' ' + identifier
        material = assets.load_asset(board['material_asset'])
        assert isinstance(material, u.Material), 'Missing saved cartography material ' + identifier
        assert material.get_path_name() == _asset_path(board['material_asset']), 'Wrong cartography material asset ' + identifier
        assert not material.get_editor_property('two_sided'), 'Unexpected two-sided image material'
        assert material.get_editor_property('blend_mode') == u.BlendMode.BLEND_OPAQUE, 'Nonopaque image material'
        samples = _base_color_samples(u, material)
        assert samples and all(sample.get_editor_property('texture') == texture for sample in samples), \
            'Correct cartography texture is missing or disconnected from BaseColor ' + identifier
        for sample in samples:
            assert sample.get_editor_property('const_coordinate') == 0
            assert not any(library.get_inputs_for_material_expression(material, sample)), 'Image UVs are overridden'
        for property_name, target in (('MP_ROUGHNESS', .9), ('MP_METALLIC', 0.), ('MP_SPECULAR', .2)):
            node = library.get_material_property_input_node(material, getattr(u.MaterialProperty, property_name))
            assert isinstance(node, u.MaterialExpressionConstant)
            assert math.isclose(node.get_editor_property('r'), target, abs_tol=1e-6), 'Wrong matte image response'
        assert library.get_material_property_input_node(material, u.MaterialProperty.MP_EMISSIVE_COLOR) is None, 'Emissive cartography material'
        materials['Wayfinding_' + identifier] = material

    triangle_total = 0
    for name, metadata in batches.items():
        actor = labels[metadata['actor_label']]
        assert isinstance(actor, u.StaticMeshActor), 'Invalid wayfinding actor ' + name
        component, collides = actor.static_mesh_component, metadata['collision']
        mesh = component.static_mesh
        assert isinstance(mesh, u.StaticMesh), 'Missing wayfinding mesh ' + name
        assert mesh.get_path_name() == _asset_path(metadata['mesh_asset']), 'Wrong wayfinding mesh asset ' + name
        assert str(component.get_collision_profile_name()) == ('BlockAll' if collides else 'NoCollision'), 'Wrong wayfinding collision profile ' + name
        assert component.get_collision_enabled() == (u.CollisionEnabled.QUERY_AND_PHYSICS if collides else u.CollisionEnabled.NO_COLLISION), 'Wrong wayfinding collision enabled state ' + name
        if collides:
            body = mesh.get_editor_property('body_setup')
            assert body and body.get_editor_property('collision_trace_flag') == u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE, 'Wayfinding steel lacks complex collision ' + name
        assert component.is_visible() and not component.get_editor_property('hidden_in_game') \
            and not actor.get_editor_property('hidden') and not actor.is_hidden_ed(), 'Hidden wayfinding actor ' + name
        assert bool(component.get_editor_property('cast_shadow')) == collides, 'Wrong wayfinding shadow policy ' + name
        material = component.get_material(0)
        path = '/Game/Plateau/Materials/M_Iron' if collides else next(b['material_asset'] for b in boards if b['panel_mesh_name'] == name)
        assert material and material.get_path_name() == _asset_path(path), 'Wrong assigned wayfinding material ' + name
        if not collides:
            assert material == materials[metadata['material']]
        assert library.has_material_usage(material, u.MaterialUsage.MATUSAGE_NANITE), 'Wayfinding material lacks Nanite usage'
        nanite = mesh.get_editor_property('nanite_settings')
        assert nanite.get_editor_property('enabled'), 'Wayfinding Nanite disabled ' + name
        assert nanite.get_editor_property('fallback_target') == u.NaniteFallbackTarget.PERCENT_TRIANGLES, 'Wrong wayfinding fallback target'
        assert math.isclose(nanite.get_editor_property('fallback_percent_triangles'), 1., abs_tol=1e-6), 'Reduced wayfinding fallback'
        assert math.isclose(nanite.get_editor_property('fallback_relative_error'), 0., abs_tol=1e-6), 'Wayfinding fallback error'
        settings = subsystem.get_lod_build_settings(mesh, 0)
        assert settings.get_editor_property('max_lumen_mesh_cards') == 64, 'Wrong wayfinding Lumen card budget'
        assert settings.get_editor_property('generate_distance_field_as_if_two_sided'), 'Missing wayfinding two-sided distance field'
        bounds = mesh.get_bounds()
        observed = {'min': [getattr(bounds.origin, axis) - getattr(bounds.box_extent, axis) for axis in ('x', 'y', 'z')],
                    'max': [getattr(bounds.origin, axis) + getattr(bounds.box_extent, axis) for axis in ('x', 'y', 'z')]}
        assert all(math.isfinite(value) and abs(value - target) < .2
                   for side in ('min', 'max') for value, target in zip(observed[side], metadata['bounds_cm'][side])), 'Changed wayfinding mesh bounds ' + name
        location, scale, rotation = actor.get_actor_location(), actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert location.length() < .1, 'Moved wayfinding actor ' + name
        assert math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001, 'Scaled wayfinding actor ' + name
        assert all(math.isfinite(v) and abs(v) < .001 for v in (rotation.roll, rotation.pitch, rotation.yaw)), 'Rotated wayfinding actor ' + name
        imported = mesh.get_num_triangles(0)
        assert imported == metadata['triangles'], 'Changed wayfinding triangle count ' + name
        triangle_total += imported
        if not collides:
            board = next(b for b in boards if b['panel_mesh_name'] == name)
            _verify_panel_uvs(u, mesh, board)
    assert triangle_total == manifest['triangles']
    return {'boards': len(boards), 'batches': len(batches), 'triangles': triangle_total,
            'collision_steel_batches': 2, 'no_collision_image_batches': 2,
            'lumen_mesh_cards': 64, 'saved_uv_corners': 8,
            'texture_sources_sha256': {b['id']: b['texture_sha256'] for b in boards},
            'texture_built_size_pixels': [2048, 2048], 'texture_uv_bounds': [0, 0, .75, 1],
            'minimum_capsule_edge_clearances_cm': {b['id']: b['minimum_capsule_edge_clearance_cm'] for b in boards}}
