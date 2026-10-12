"""Remove two obsolete visible OSM shells while retaining original collision.

Copies retain the original numeric position/UV tokens and ordered faces. The
municipal survey bodies supply the visible landmarks; no collision is changed.
"""
import hashlib
import json
import math
from pathlib import Path

from plateau_background import read_obj
from plateau_facades import _nearest
from prepare_plateau import geography

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'Data/Plateau/LandmarkVisualGeometry'
TARGETS = ('27395533', '355385456')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def face_digest(faces):
    return hashlib.sha256(json.dumps(faces, separators=(',', ':')).encode()).hexdigest()


def belongs(record, material, target):
    points = [(float(v[0]), -float(v[1]), float(v[2])) for v, _ in record]
    if min(p[2] for p in points) < -.01 or max(p[2] for p in points) > target['height'] + .01:
        return False
    edges = list(zip(target['points'], target['points'][1:] + target['points'][:1]))
    if material == 'Roof':
        return (all(abs(p[2] - target['height']) < .01 for p in points)
                and all(min(_nearest(p[:2], a, b)[0] for a, b in edges) < .01 for p in points))
    offset = 3 if material == 'Glass' else 0
    for a, b in edges:
        length = math.dist(a, b)
        normal = ((b[1] - a[1]) / length, -(b[0] - a[0]) / length)
        if (all(abs(sum((p[i] - a[i]) * normal[i] for i in (0, 1)) - offset) < .02 for p in points)
                and all(_nearest(p[:2], a, b)[0] < offset + .02 for p in points)):
            return True
    return False


def split(records, material, targets):
    kept, removed = [], {target['id']: [] for target in targets}
    for record in records:
        owners = [target['id'] for target in targets if belongs(record, material, target)]
        assert len(owners) <= 1, 'Ambiguous landmark face association'
        if owners:
            removed[owners[0]].append(record)
        else:
            kept.append(record)
    return kept, removed


def write(path, name, records):
    with Path(path).open('w') as stream:
        stream.write('o ' + name + '\n')
        index = 1
        for record in records:
            for vertex, _ in record:
                stream.write('v ' + ' '.join(vertex) + '\n')
            for _, uv in record:
                stream.write('vt ' + ' '.join(uv) + '\n')
            stream.write('f ' + ' '.join(f'{index+i}/{index+i}' for i in range(len(record))) + '\n')
            index += len(record)


def prepare(directory=DIRECTORY):
    targets = [building for building in geography()[0] if building['id'] in TARGETS]
    assert set(target['id'] for target in targets) == set(TARGETS)
    background = json.loads((ROOT / 'Data/Plateau/BackgroundGeometry/layout.json').read_text())
    bindings = json.loads((DIRECTORY / 'bindings.json').read_text())
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    sources = [(name, metadata['material'], 'Plateau background ' + name,
                'Data/Plateau/BackgroundGeometry/' + name + '.obj',
                '/Game/Plateau/Background/SM_' + name + '.SM_' + name)
               for name, metadata in background['batches'].items()]
    sources.append(('Glass', 'Glass', 'OSM Glass', 'Data/Plateau/BaseGeometry/Glass.obj',
                    '/Game/LaFontaine/SM_Glass.SM_Glass'))
    replacements = []
    totals = {ident: {} for ident in TARGETS}
    guards = {name: digest(ROOT / name) for name in
              ('Data/LaFontaine/osm.xml', 'Data/Plateau/BackgroundGeometry/layout.json',
               'Data/Plateau/LandmarkVisualGeometry/bindings.json')}
    for name, material, actor, source, source_asset in sources:
        records = read_obj(ROOT / source)
        kept, removed = split(records, material, targets)
        count = sum(len(faces) for faces in removed.values())
        if not count:
            continue
        for ident, faces in removed.items():
            if faces:
                totals[ident][material] = totals[ident].get(material, 0) + len(faces)
        key = 'LandmarkContext_' + name
        filename = key + '.obj'
        if kept:
            write(directory / filename, key, kept)
            assert read_obj(directory / filename) == kept, 'Retained face/UV tokens changed'
        guards[source] = digest(ROOT / source)
        binding = bindings[actor]
        assert binding['source_asset'] == source_asset and binding['original_visible']
        package = 'Content/' + source_asset.split('.')[0].removeprefix('/Game/') + '.uasset'
        guards[package] = digest(ROOT / package)
        replacements.append({'name': name, 'material': material, 'source': source,
                             **binding,
                             'source_actor_label': actor, 'source_asset': source_asset,
                             'target_actor_label': 'Plateau survey context ' + name if kept else None,
                             'target_asset': '/Game/Plateau/Perimeter/SM_' + key + '.SM_' + key if kept else None,
                             'geometry': filename if kept else None,
                             'geometry_sha256': digest(directory / filename) if kept else None,
                             'source_faces': len(records), 'retained_faces': len(kept),
                             'removed_faces': count, 'source_face_sha256': face_digest(records),
                             'retained_face_sha256': face_digest(kept),
                             'removed_face_sha256': {ident: face_digest(faces) for ident, faces in removed.items()},
                             'source_triangles': sum(len(face)-2 for face in records),
                             'retained_triangles': sum(len(face)-2 for face in kept),
                             'removed_triangles': sum(len(face)-2 for faces in removed.values() for face in faces),
                             'bounds_cm': [[operation(float(v[axis]) * (-1 if axis == 1 else 1)
                                                       for face in kept for v, _ in face)
                                            for axis in range(3)] for operation in (min, max)] if kept else None,
                             'transition': {'component_visible': False, 'actor_hidden': True,
                                            'cast_shadow': False, 'affect_distance_field_lighting': False,
                                            'affect_dynamic_indirect_lighting': False}})
    assert totals == {'27395533': {'Cream': 21, 'Roof': 1, 'Glass': 312},
                      '355385456': {'Sage': 11, 'Roof': 1, 'Glass': 81}}, totals
    manifest = {'targets': list(TARGETS), 'source_sha256': guards, 'replacements': replacements,
                'removed_by_target_material': totals, 'collision_changed': False,
                'visible_copy_triangles': sum(r['retained_triangles'] for r in replacements),
                'removed_triangles': sum(r['removed_triangles'] for r in replacements),
                'limits': 'Exact original OSM wall edges, roof vertices and 3 cm window cards for only the two approved landmarks. All other ordered face/UV tokens are preserved. Original mesh assets and collision components remain unchanged.'}
    (directory / 'visuals.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def validate_inputs(manifest):
    for path, expected in manifest['source_sha256'].items():
        assert digest(ROOT / path) == expected, path
    for record in manifest['replacements']:
        if record['geometry']:
            path = DIRECTORY / record['geometry']
            assert digest(path) == record['geometry_sha256'], str(path)
            assert face_digest(read_obj(path)) == record['retained_face_sha256']


def refresh_bindings(u):
    """Only the full regeneration caller may rebind freshly recreated batches."""
    manifest = json.loads((DIRECTORY / 'visuals.json').read_text())
    bindings = json.loads((DIRECTORY / 'bindings.json').read_text())
    labels = {actor.get_actor_label(): actor for actor in u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()}
    for record in manifest['replacements']:
        actor = labels[record['source_actor_label']]
        component = actor.static_mesh_component
        assert component.static_mesh.get_path_name() == record['source_asset']
        assert component.static_mesh.get_num_triangles(0) == record['source_triangles']
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        binding = bindings[record['source_actor_label']]
        assert [m.get_path_name() for m in component.get_materials()] == binding['original_materials']
        binding['source_actor_path'] = actor.get_path_name()
        binding['source_component_path'] = component.get_path_name()
    (DIRECTORY / 'bindings.json').write_text(json.dumps(bindings, ensure_ascii=False, indent=2) + '\n')
    return prepare()


def apply(u, import_mesh, nanite, regenerate_bindings=False):
    if regenerate_bindings:
        refresh_bindings(u)
    manifest = json.loads((DIRECTORY / 'visuals.json').read_text())
    validate_inputs(manifest)
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    labels = {actor.get_actor_label(): actor for actor in editor.get_all_level_actors()}
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    for record in manifest['replacements']:
        source = labels[record['source_actor_label']]
        component = source.static_mesh_component
        original = component.static_mesh
        assert source.get_path_name() == record['source_actor_path']
        assert component.get_path_name() == record['source_component_path']
        assert original.get_path_name() == record['source_asset']
        assert original.get_num_triangles(0) == record['source_triangles']
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        collision = (component.get_collision_enabled(), component.get_collision_profile_name())
        if record['geometry']:
            name = record['target_asset'].split('/')[-1].split('.')[0]
            mesh = import_mesh(DIRECTORY / record['geometry'], '/Game/Plateau/Perimeter', name, False)
            subsystem.set_lod_build_settings(mesh, 0, subsystem.get_lod_build_settings(original, 0))
            material = component.get_material(0)
            mesh.set_material(0, material)
            subsystem.set_nanite_settings(mesh, original.get_editor_property('nanite_settings'), True)
            u.EditorAssetLibrary.save_loaded_asset(mesh)
            assert mesh.get_num_triangles(0) == record['retained_triangles']
            previous = labels.get(record['target_actor_label'])
            actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
            actor.set_actor_label(record['target_actor_label'])
            actor.set_folder_path('Plateau/Landmark visual corrections')
            actor.static_mesh_component.set_static_mesh(mesh)
            actor.static_mesh_component.set_material(0, material)
            actor.static_mesh_component.set_collision_profile_name('NoCollision')
            if previous:
                editor.destroy_actor(previous)
        component.set_visibility(False)
        source.set_actor_hidden_in_game(True)
        component.set_cast_shadow(False)
        component.set_affect_distance_field_lighting(False)
        component.set_affect_dynamic_indirect_lighting(False)
        assert collision == (component.get_collision_enabled(), component.get_collision_profile_name())
    return {'passed': True, 'replacements': len(manifest['replacements']),
            'removed_triangles': manifest['removed_triangles'], 'collision_changed': False}


def assert_labels(names, wanted):
    owned = [name for name in names if name.startswith('Plateau survey context ')]
    assert len(owned) == len(wanted) and set(owned) == wanted, 'Survey context inventory differs'


def verify(u):
    manifest = json.loads((DIRECTORY / 'visuals.json').read_text())
    validate_inputs(manifest)
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    labels = {actor.get_actor_label(): actor for actor in actors}
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    wanted = {r['target_actor_label'] for r in manifest['replacements'] if r['geometry']}
    assert_labels([actor.get_actor_label() for actor in actors], wanted)
    for record in manifest['replacements']:
        source = labels[record['source_actor_label']]
        old = source.static_mesh_component
        assert source.get_path_name() == record['source_actor_path']
        assert old.get_path_name() == record['source_component_path']
        assert old.static_mesh.get_path_name() == record['source_asset']
        assert old.static_mesh.get_num_triangles(0) == record['source_triangles']
        assert old.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert str(old.get_collision_profile_name()) == 'NoCollision'
        assert not old.is_visible() and source.get_editor_property('hidden')
        assert not any(old.get_editor_property(field) for field in
                       ('cast_shadow', 'affect_distance_field_lighting', 'affect_dynamic_indirect_lighting'))
        if not record['geometry']:
            continue
        actor = labels[record['target_actor_label']]
        component, mesh = actor.static_mesh_component, actor.static_mesh_component.static_mesh
        assert mesh.get_path_name() == record['target_asset']
        assert mesh.get_num_triangles(0) == record['retained_triangles']
        assert component.get_material(0) == old.get_material(0)
        assert component.is_visible() and not actor.get_editor_property('hidden')
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        assert mesh.get_editor_property('nanite_settings').enabled == old.static_mesh.get_editor_property('nanite_settings').enabled
        assert subsystem.get_lod_build_settings(mesh, 0).max_lumen_mesh_cards == subsystem.get_lod_build_settings(old.static_mesh, 0).max_lumen_mesh_cards
        assert actor.get_actor_location().length() < .1
        rotation, scale = actor.get_actor_rotation(), actor.get_actor_scale3d()
        assert max(abs(v) for v in (rotation.roll, rotation.pitch, rotation.yaw)) < .001
        assert max(abs(v-1) for v in (scale.x, scale.y, scale.z)) < .001
        bounds = mesh.get_bounds()
        actual = [[bounds.origin.x + sign*bounds.box_extent.x,
                   bounds.origin.y + sign*bounds.box_extent.y,
                   bounds.origin.z + sign*bounds.box_extent.z] for sign in (-1, 1)]
        assert all(abs(actual[e][axis]-record['bounds_cm'][e][axis]) < .2
                   for e in (0, 1) for axis in range(3))
    return {'passed': True, 'replacements': len(manifest['replacements']),
            'removed_triangles': manifest['removed_triangles'], 'collision_changed': False}


if __name__ == '__main__':
    print(json.dumps(prepare(), ensure_ascii=False, indent=2))
