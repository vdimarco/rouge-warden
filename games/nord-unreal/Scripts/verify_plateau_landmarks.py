"""Read-only checks of the saved illustrative theatre shell and its identification sign."""
import json
import math
from pathlib import Path

from plateau_landmarks import build_landmarks


def _xyz(vector):
    return vector.x, vector.y, vector.z


def _angle_error(observed, expected):
    return abs((observed - expected + 180) % 360 - 180)


def verify(u, labels, root):
    manifest = json.loads((Path(root) / 'Data/Plateau/LandmarkGeometry/landmarks.json').read_text())
    generated_mesh, generated = build_landmarks()
    assert manifest == json.loads(json.dumps(generated)), 'Saved landmark manifest differs from the source footprint or current generator'
    batches, signs = manifest['materials'], manifest['signs']
    assert len(batches) == 13 and len(signs) == 1, 'Unexpected theatre mesh/sign count'
    assert manifest['new_collision'] is False and manifest['enterable'] is False
    prefix = 'Plateau landmark '
    wanted = {prefix + name for name in batches} | {prefix + 'sign ' + sign['id'] for sign in signs}
    assert {label for label in labels if label.startswith(prefix)} == wanted, 'Missing or extra landmark actors'
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    triangles, materials = 0, set()
    for name, metadata in batches.items():
        actor = labels[prefix + name]
        assert isinstance(actor, u.StaticMeshActor), 'Invalid landmark actor ' + name
        component = actor.static_mesh_component
        mesh = component.static_mesh
        path = '/Game/Plateau/Landmarks/SM_' + name + '.SM_' + name
        assert mesh and mesh.get_path_name() == path, 'Wrong saved landmark mesh ' + name
        assert metadata['collision'] is False
        assert str(component.get_collision_profile_name()) == 'NoCollision', 'Blocking landmark profile ' + name
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION, 'Enabled landmark collision ' + name
        assert component.is_visible() and not actor.get_editor_property('hidden'), 'Hidden landmark batch ' + name
        assert component.get_editor_property('cast_shadow'), 'Landmark does not cast its expected shadow ' + name
        material = component.get_material(0)
        expected_material = '/Game/Plateau/Materials/M_' + metadata['material'] + '.M_' + metadata['material']
        assert material and material.get_path_name() == expected_material, 'Wrong landmark material ' + name
        assert u.MaterialEditingLibrary.has_material_usage(material, u.MaterialUsage.MATUSAGE_NANITE), 'Missing landmark Nanite material usage ' + name
        materials.add(metadata['material'])
        settings = mesh.get_editor_property('nanite_settings')
        assert settings.get_editor_property('enabled'), 'Landmark Nanite disabled ' + name
        assert settings.get_editor_property('fallback_target') == u.NaniteFallbackTarget.PERCENT_TRIANGLES
        assert math.isclose(settings.get_editor_property('fallback_percent_triangles'), 1., abs_tol=1e-6)
        assert math.isclose(settings.get_editor_property('fallback_relative_error'), 0., abs_tol=1e-6)
        build = subsystem.get_lod_build_settings(mesh, 0)
        assert build.get_editor_property('max_lumen_mesh_cards') == 64, 'Wrong landmark Lumen card budget ' + name
        assert build.get_editor_property('generate_distance_field_as_if_two_sided'), 'Landmark two-sided distance field disabled ' + name

        vertices = [point for face in generated_mesh.groups[name] for point in face]
        expected_bounds = [[min(p[i] for p in vertices) for i in range(3)],
                           [max(p[i] for p in vertices) for i in range(3)]]
        bounds = mesh.get_bounds()
        origin, extent = _xyz(bounds.origin), _xyz(bounds.box_extent)
        observed_bounds = [[origin[i] - extent[i] for i in range(3)],
                           [origin[i] + extent[i] for i in range(3)]]
        assert all(math.isfinite(value) and abs(value - target) < .2
                   for observed, expected in zip(observed_bounds, expected_bounds)
                   for value, target in zip(observed, expected)), (name, 'Landmark bounds differ', observed_bounds, expected_bounds)
        assert math.dist(_xyz(actor.get_actor_location()), (0, 0, 0)) < .1, 'Moved landmark actor ' + name
        assert math.dist(_xyz(actor.get_actor_scale3d()), (1, 1, 1)) < .001, 'Scaled landmark actor ' + name
        rotation = actor.get_actor_rotation()
        assert all(math.isfinite(angle) and abs(angle) < .001 for angle in (rotation.pitch, rotation.roll, rotation.yaw)), 'Rotated landmark actor ' + name
        imported = mesh.get_num_triangles(0)
        assert imported == metadata['triangles'], (name, 'Landmark triangle count changed', imported, metadata['triangles'])
        triangles += imported
    assert materials == {'Iron', 'Wood', 'Trim', 'Roof'}
    assert triangles == manifest['triangles'], 'Saved landmark triangle total changed'

    for sign in signs:
        actor = labels[prefix + 'sign ' + sign['id']]
        assert isinstance(actor, u.TextRenderActor), 'Invalid landmark text actor'
        component = actor.get_component_by_class(u.TextRenderComponent)
        assert component and str(component.get_editor_property('text')) == sign['text'], 'Wrong landmark sign text'
        assert math.dist(_xyz(actor.get_actor_location()), sign['position']) < .1, 'Moved landmark sign'
        assert math.dist(_xyz(actor.get_actor_scale3d()), (1, 1, 1)) < .001, 'Scaled landmark sign'
        rotation = actor.get_actor_rotation()
        angles = (rotation.pitch, rotation.roll, rotation.yaw)
        assert all(math.isfinite(angle) for angle in angles)
        assert abs(rotation.pitch) < .001 and abs(rotation.roll) < .001 and _angle_error(rotation.yaw, sign['yaw']) < .001, 'Wrong landmark sign facing'
        assert math.isclose(component.get_editor_property('world_size'), sign['size'], abs_tol=.001), 'Wrong landmark sign size'
        assert component.is_visible() and not actor.get_editor_property('hidden'), 'Hidden landmark sign'
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        # TextRenderComponent inherits the engine's non-shadow-casting primitive default.
        assert not component.get_editor_property('cast_shadow'), 'Unexpected landmark lettering shadow'
    return {'batches': len(batches), 'signs': len(signs), 'triangles': triangles,
            'source_triangles': manifest['triangles'], 'vertical_fins': manifest['vertical_fins'],
            'lumen_mesh_cards': 64, 'two_sided_distance_fields': True,
            'nanite_materials': sorted(materials), 'new_collision': False, 'enterable': False,
            'source_mass_id': manifest['source_mass']['id'], 'source_mass_height_cm': manifest['source_mass']['height_cm']}
