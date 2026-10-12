"""Local render batches for the surveyed city; original meshes retain collision."""
import json
from pathlib import Path

from plateau_batches import spatial_batches
from plateau_mesh import Mesh


SOURCES = ('Brick', 'Cream', 'Sage', 'Roof')


def _bounds(faces):
    return [[operation(p[i] for face in faces for p in face) for i in range(3)] for operation in (min, max)]


def _bounded_parts(faces, limit=12000):
    """Subdivide an oversized tile without cutting any surveyed polygon."""
    parts, current, bounds = [], [], None
    for face in faces:
        box = _bounds([face])
        combined = box if bounds is None else [[min(bounds[0][i], box[0][i]) for i in range(3)],
                                               [max(bounds[1][i], box[1][i]) for i in range(3)]]
        if current and max(combined[1][i] - combined[0][i] for i in (0, 1)) > limit:
            parts.append(current)
            current, combined = [], box
        current.append(face)
        bounds = combined
    if current:
        parts.append(current)
    return parts


def read_obj(path):
    """Keep original position/UV tokens and ordered polygons, including roof n-gons."""
    vertices, uvs, faces = [], [], []
    for line in Path(path).read_text().splitlines():
        fields = line.split()
        if not fields or fields[0].startswith('#'):
            continue
        if fields[0] == 'v':
            assert len(fields) == 4
            vertices.append(tuple(fields[1:]))
        elif fields[0] == 'vt':
            assert len(fields) == 3
            uvs.append(tuple(fields[1:]))
        elif fields[0] == 'f':
            face = []
            for field in fields[1:]:
                indices = field.split('/')
                assert len(indices) == 2 and all(indices), 'Expected surveyed OBJ position/UV faces'
                vertex, uv = (int(value) for value in indices)
                assert vertex != 0 and uv != 0
                face.append((vertices[vertex - 1 if vertex > 0 else vertex],
                             uvs[uv - 1 if uv > 0 else uv]))
            assert len(face) >= 3
            faces.append(face)
        else:
            assert fields[0] == 'o', 'Unexpected surveyed OBJ attribute: ' + fields[0]
    assert faces
    return faces


def partition(source_directory, tile_size_cm=10000, max_batches=599):
    """Return spatial geometry, explicit batch metadata, and unmodified OBJ faces."""
    mesh, attributes, source_counts = Mesh(), {}, {}
    for material in SOURCES:
        records = read_obj(Path(source_directory) / (material + '.obj'))
        source_counts[material] = {'faces': len(records), 'triangles': sum(len(face) - 2 for face in records)}
        for record in records:
            # Mesh uses Unreal XY and outward winding; retain original OBJ records
            # separately so export never recalculates UVs or triangulates n-gons.
            mesh.face(material, [(float(v[0]), -float(v[1]), float(v[2])) for v, _ in record[::-1]])
            attributes[id(mesh.groups[material][-1])] = record
    output, batches, size = spatial_batches(mesh, tile_size_cm, max_batches)
    bounded, records = Mesh(), {}
    for name, metadata in batches.items():
        parts = _bounded_parts(output.groups[name])
        for index, faces in enumerate(parts):
            key = name if len(parts) == 1 else name + f'_P{index:03d}'
            bounded.groups[key] = faces
            record = dict(metadata, faces=len(faces), triangles=sum(len(face) - 2 for face in faces),
                          bounds_cm=_bounds(faces), source_actor='OSM ' + metadata['material'])
            record['oversized_face'] = max(record['bounds_cm'][1][i] - record['bounds_cm'][0][i] for i in (0, 1)) > 12000
            assert not record['oversized_face'] or len(faces) == 1
            records[key] = record
            assert not record['collision']
    output, batches = bounded, records
    assert len(batches) <= max_batches, 'Background subdivision exceeded the mesh budget'
    manifest = {'tile_size_cm': size, 'batches': batches, 'sources': source_counts,
                'faces': sum(record['faces'] for record in source_counts.values()),
                'triangles': sum(record['triangles'] for record in source_counts.values())}
    assert manifest['faces'] == sum(record['faces'] for record in batches.values())
    assert manifest['triangles'] == sum(record['triangles'] for record in batches.values())
    return output, manifest, attributes


def write_obj(path, name, faces, attributes):
    """Write identical numeric tokens and polygon winding; only indices change."""
    with Path(path).open('w') as stream:
        stream.write('o ' + name + '\n')
        index = 1
        for face in faces:
            record = attributes[id(face)]
            for vertex, _ in record:
                stream.write('v ' + ' '.join(vertex) + '\n')
            for _, uv in record:
                stream.write('vt ' + ' '.join(uv) + '\n')
            stream.write('f ' + ' '.join(f'{index + i}/{index + i}' for i in range(len(record))) + '\n')
            index += len(record)


def prepare(root, tile_size_cm=10000):
    root = Path(root)
    # These are the surveyed source shells used by the Plateau bake. Warden's
    # LaFontaine OBJ files deliberately retain its separate gameplay road graph.
    mesh, manifest, attributes = partition(root / 'Data/Plateau/BaseGeometry', tile_size_cm)
    output = root / 'Data/Plateau/BackgroundGeometry'
    output.mkdir(parents=True, exist_ok=True)
    for name, faces in mesh.groups.items():
        write_obj(output / (name + '.obj'), name, faces, attributes)
    (output / 'layout.json').write_text(json.dumps(manifest, indent=2))
    return manifest


def apply(u, import_mesh, nanite):
    """Called by the root importer with its existing import and Nanite helpers."""
    root = Path(u.Paths.project_dir()).resolve()
    directory = root / 'Data/Plateau/BackgroundGeometry'
    manifest = prepare(root)
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    actors = editor.get_all_level_actors()
    labels = {actor.get_actor_label(): actor for actor in actors}
    originals = {name: labels['OSM ' + name] for name in SOURCES}
    materials, collisions, old_triangles = {}, {}, 0
    for name, actor in originals.items():
        component = actor.static_mesh_component
        slots = list(component.get_materials())
        assert len(slots) == 1 and slots[0], ('Background source material', name)
        materials[name] = slots[0]
        collisions[name] = (component.get_collision_profile_name(), component.get_collision_enabled())
        old_triangles += component.static_mesh.get_num_triangles(0)
    for actor in actors:
        if actor.get_actor_label().startswith('Plateau background '):
            editor.destroy_actor(actor)
    imported_triangles = 0
    for name, metadata in manifest['batches'].items():
        mesh = import_mesh(directory / (name + '.obj'), '/Game/Plateau/Background', 'SM_' + name, False)
        material = materials[metadata['material']]
        actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label('Plateau background ' + name)
        actor.set_folder_path('Plateau/Surveyed background')
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_collision_profile_name('NoCollision')
        nanite(u, mesh, [material])
        imported_triangles += mesh.get_num_triangles(0)
    assert imported_triangles == old_triangles, ('Background import changed triangles', imported_triangles, old_triangles)
    # Rendering and collision are separated only after all replacements exist.
    for name, actor in originals.items():
        component = actor.static_mesh_component
        component.set_visibility(False)
        actor.set_actor_hidden_in_game(True)
        component.set_cast_shadow(False)
        component.set_affect_distance_field_lighting(False)
        component.set_affect_dynamic_indirect_lighting(False)
        assert collisions[name] == (component.get_collision_profile_name(), component.get_collision_enabled()), name
    return {'batches': len(manifest['batches']), 'tile_size_cm': manifest['tile_size_cm'],
            'source_faces': manifest['faces'], 'source_triangles': manifest['triangles'],
            'imported_triangles': imported_triangles, 'original_imported_triangles': old_triangles}


if __name__ == '__main__':
    result = prepare(Path(__file__).resolve().parents[1])
    print(json.dumps({'batches': len(result['batches']), 'tile_size_cm': result['tile_size_cm'],
                      'faces': result['faces'], 'triangles': result['triangles']}, indent=2))
