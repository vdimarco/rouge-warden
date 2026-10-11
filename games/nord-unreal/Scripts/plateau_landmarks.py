"""Illustrative stage-envelope cladding over the unchanged surveyed theatre mass."""
import json
import math

from plateau_batches import spatial_batches
from plateau_mesh import Mesh
from prepare_lafontaine import ROOT
from prepare_plateau import geography

STAGE_ID = '433686251'
REFERENCES = ['https://lemay.com/projects/theatre-de-verdure/',
              'https://montreal.ca/lieux/theatre-de-verdure']


def offset_ring(points, distance):
    """Miter a surveyed CCW perimeter; the original footprint is never altered."""
    normals = []
    for a, b in zip(points, points[1:] + points[:1]):
        length = math.dist(a, b)
        assert length > 1
        normals.append(((b[1] - a[1]) / length, -(b[0] - a[0]) / length))
    output = []
    for index, point in enumerate(points):
        previous, following = normals[index - 1], normals[index]
        denominator = 1 + sum(previous[i] * following[i] for i in range(2))
        assert denominator > .15, 'Unexpected sharp stage roof corner'
        output.append(tuple(point[i] + distance * (previous[i] + following[i]) / denominator for i in range(2)))
    return output


def build_landmarks(buildings=None):
    if buildings is None:
        buildings, _ = geography()
    stage = next(building for building in buildings if building['id'] == STAGE_ID)
    points, height = stage['points'], stage['height']
    assert sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) > 0
    mesh, walls = Mesh(), []
    backing = offset_ring(points, 18)
    for a, b in zip(backing, backing[1:] + backing[:1]):
        mesh.face('Iron', [(a[0], a[1], 0), (b[0], b[1], 0),
                           (b[0], b[1], height), (a[0], a[1], height)])
    mesh.face('Iron', [(x, y, height) for x, y in backing])
    mesh.face('Iron', [(x, y, 0) for x, y in backing[::-1]])
    fins = 0
    for index, (a, b) in enumerate(zip(points, points[1:] + points[:1])):
        length = math.dist(a, b)
        tangent = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        normal = (tangent[1], -tangent[0])
        yaw = math.degrees(math.atan2(tangent[1], tangent[0]))

        def local(x, depth, z):
            return (a[0] + tangent[0] * x + normal[0] * depth,
                    a[1] + tangent[1] * x + normal[1] * depth, z)

        # A continuous opaque envelope masks every legacy blue window. It implies no entry.
        mesh.box('Iron', local(length / 2, 18, 29), (length + 24, 16, 58), yaw)
        for z in (110, height * .58, height - 56):
            mesh.box('Iron', local(length / 2, 24, z), (length, 22, 7), yaw)
        count = max(2, round((length - 36) / 34))
        for fin in range(count):
            x = 18 + (length - 36) * (fin + .5) / count
            depth = 31 + (2 if fin % 8 == 0 else 0)
            mesh.box('Wood', local(x, depth, (height - 12) / 2), (8, 28, height - 52), yaw)
            fins += 1
        walls.append({'a': list(a), 'b': list(b), 'normal': list(normal), 'length_cm': length,
                      'backing_front_cm': 18, 'fin_front_max_cm': 47,
                      'opaque_height_cm': height, 'fins': count, 'yaw': yaw})

    roof = offset_ring(points, 55)
    mesh.face('Roof', [(x, y, height + 14) for x, y in roof])
    mesh.face('Iron', [(x, y, height - 6) for x, y in roof[::-1]])
    for a, b in zip(roof, roof[1:] + roof[:1]):
        mesh.face('Trim', [(a[0], a[1], height - 6), (b[0], b[1], height - 6),
                           (b[0], b[1], height + 14), (a[0], a[1], height + 14)])
    # Use the facade that faces the pond-side promenade. This is an identification plaque,
    # not a portal into the retained solid source mass.
    observer = (13500, -8000)
    wall = max((wall for wall in walls if wall['length_cm'] > 800),
               key=lambda wall: sum(((observer[i] - (wall['a'][i] + wall['b'][i]) / 2)
                                     * wall['normal'][i]) for i in range(2)) /
               math.dist(observer, [(wall['a'][i] + wall['b'][i]) / 2 for i in range(2)]))
    center = [(wall['a'][i] + wall['b'][i]) / 2 for i in range(2)]
    normal = wall['normal']
    plaque = [center[i] + normal[i] * 48 for i in range(2)]
    mesh.box('Iron', (*plaque, 340), (590, 8, 94), wall['yaw'])
    signs = [{'id': 'TheatreVerdure', 'text': 'THÉÂTRE DE VERDURE',
              'position': [center[0] + normal[0] * 57, center[1] + normal[1] * 57, 340],
              'normal': list(normal), 'yaw': math.degrees(math.atan2(normal[1], normal[0])), 'size': 34}]
    original_triangles = sum(len(face) - 2 for faces in mesh.groups.values() for face in faces)
    mesh, batches, tile_size = spatial_batches(mesh, tile_size_cm=4500, max_batches=20)
    vertices = [point for faces in mesh.groups.values() for face in faces for point in face]
    bounds = [[min(p[axis] for p in vertices) for axis in range(3)],
              [max(p[axis] for p in vertices) for axis in range(3)]]
    report = {'source': 'Data/LaFontaine/osm.xml', 'attribution': '© OpenStreetMap contributors, ODbL 1.0',
              'references': REFERENCES, 'interpretation': 'Illustrative closed timber-and-metal stage envelope; not an exact reconstruction.',
              'source_mass': {'id': STAGE_ID, 'footprint_cm': [list(p) for p in points], 'height_cm': height,
                              'preserved': True, 'original_collision_unchanged': True},
              'new_collision': False, 'enterable': False, 'walls': walls, 'vertical_fins': fins,
              'backing_ring_cm': [list(p) for p in backing],
              'roof_overhang_cm': 55, 'roof_ring_cm': [list(p) for p in roof],
              'bounds_cm': bounds, 'signs': signs, 'materials': batches, 'tile_size_cm': tile_size,
              'triangles': original_triangles}
    assert sum(batch['triangles'] for batch in batches.values()) == original_triangles
    assert len(batches) <= 20 and all(not batch['collision'] for batch in batches.values())
    return mesh, report


def prepare():
    mesh, report = build_landmarks()
    directory = ROOT / 'Data/Plateau/LandmarkGeometry'
    mesh.write(directory)
    (directory / 'landmarks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def apply(u, materials, import_mesh, nanite):
    report = prepare()
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    actors = {actor.get_actor_label(): actor for actor in editor.get_all_level_actors()}
    prefix = 'Plateau landmark '
    wanted = {prefix + name for name in report['materials']} | {prefix + 'sign ' + sign['id'] for sign in report['signs']}
    for label, actor in actors.items():
        if label.startswith(prefix) and label not in wanted:
            editor.destroy_actor(actor)
    for name, metadata in report['materials'].items():
        mesh = import_mesh(ROOT / 'Data/Plateau/LandmarkGeometry' / (name + '.obj'),
                           '/Game/Plateau/Landmarks', 'SM_' + name)
        material = materials[metadata['material']]
        nanite(u, mesh, [material])
        label = prefix + name
        actor = actors.get(label) or editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label(label)
        actor.set_folder_path('Plateau/Landmarks')
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_collision_profile_name('NoCollision')
        component.set_cast_shadow(True)
    for sign in report['signs']:
        label = prefix + 'sign ' + sign['id']
        actor = actors.get(label) or editor.spawn_actor_from_class(u.TextRenderActor, u.Vector())
        actor.set_actor_label(label)
        actor.set_folder_path('Plateau/Landmarks')
        actor.set_actor_location(u.Vector(*sign['position']), False, False)
        actor.set_actor_rotation(u.Rotator(yaw=sign['yaw']), False)
        component = actor.get_component_by_class(u.TextRenderComponent)
        component.set_text(sign['text'])
        component.set_world_size(sign['size'])
        component.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER)
        component.set_vertical_alignment(u.VerticalTextAligment.EVRTA_TEXT_CENTER)
        component.set_text_render_color(u.Color(230, 229, 211, 255))
        component.set_collision_profile_name('NoCollision')
    return report


if __name__ == '__main__':
    report = prepare()
    print(json.dumps({key: report[key] for key in ('vertical_fins', 'triangles', 'new_collision', 'enterable')}))
