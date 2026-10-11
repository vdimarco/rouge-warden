"""Exercise canonical saved-park QA with production geometry and corruptions."""
import ast
import json
import math
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace

import plateau_park
from test_verify_plateau_ground import Component, Object, StaticMesh, Vector


class Material(Object):
    def get_path_name(self): return '/Game/Plateau/Materials/M_' + self.name + '.M_' + self.name


class Description:
    def __init__(self, faces):
        def rounded(point):
            return tuple(struct.unpack('<f', struct.pack('<f', float(f'{v:.3f}')))[0] for v in point)
        points = sorted({rounded(point) for face in faces for point in face})
        self.points = [Vector(*point) for point in points]
        indices = {point: i for i, point in enumerate(points)}
        self.triangles = []
        for face in faces:
            ids = [indices[rounded(point)] for point in face]
            self.triangles.extend((ids[i + 1], ids[i], ids[0]) for i in range(1, len(ids) - 1))
    def get_triangle_count(self): return len(self.triangles)
    def get_triangle_vertex_instances(self, triangle): return self.triangles[triangle.id_value]
    def get_vertex_instance_vertex(self, instance): return instance
    def get_vertex_position(self, vertex): return self.points[vertex]


class ParkMesh(StaticMesh, Object):
    def __init__(self, name, metadata, faces):
        super().__init__(name, metadata['triangles'], [0, 0, 1, 1, 0, 1])
        self.nanite_settings = Object(enabled=True)
        self.build_settings = Object(max_lumen_mesh_cards=64)
        self.body_setup = Object(collision_trace_flag=3)
        self.description = Description(faces) if metadata['material'] == 'PondWater' else None
    def get_path_name(self): return '/Game/Plateau/Park/SM_' + self.name + '.SM_' + self.name
    def get_static_mesh_description(self, lod): return self.description


class ParkComponent(Component):
    def is_visible(self): return self.visible


class ParkActor(Object):
    def __init__(self, name, metadata, faces):
        self.position, self.scale = Vector(), Vector(1, 1, 1)
        self.rotation = Object(roll=0, pitch=0, yaw=0)
        self.hidden, self.hidden_ed = False, False
        collides, material = metadata['collision'], metadata['material']
        self.static_mesh_component = ParkComponent(static_mesh=ParkMesh(name, metadata, faces),
            material=Material(name=material), profile='BlockAll' if collides else 'NoCollision',
            collision=2 if collides else 0, visible=True, hidden_in_game=False,
            cast_shadow=material not in ('PondWater', 'AutumnGold', 'AutumnRust'))
    def get_actor_location(self): return self.position
    def get_actor_scale3d(self): return self.scale
    def get_actor_rotation(self): return self.rotation
    def is_hidden_ed(self): return self.hidden_ed


class Cloud(Object):
    def get_component_by_class(self, cls): return Object(material='/Engine/EngineSky/VolumetricClouds/Test')


def main():
    root = Path(__file__).resolve().parents[1]
    production = root / 'Data/Plateau/ParkGeometry/park.json'
    before = production.read_bytes()
    source_mesh, manifest = plateau_park.build_park()
    labels = {'Plateau park ' + name: ParkActor(name, metadata, source_mesh.groups[name])
              for name, metadata in manifest['materials'].items()}
    labels['OSM Water'] = Object(hidden=True, static_mesh_component=ParkComponent(visible=False, collision=0))
    labels['Plateau autumn clouds'] = Cloud()
    traces = []
    def line_trace(world, start, end, *args):
        traces.append((start.x, start.y))
        return [True, None, None, None, None, Vector(start.x, start.y, 49)]
    mesh_subsystem = Object(get_lod_build_settings=lambda mesh, lod: mesh.build_settings)
    world_subsystem = Object(get_editor_world=lambda: Object())
    fake = SimpleNamespace(StaticMeshActor=ParkActor, CollisionEnabled=Object(NO_COLLISION=0, QUERY_AND_PHYSICS=2),
        CollisionTraceFlag=Object(CTF_USE_COMPLEX_AS_SIMPLE=3), StaticMeshEditorSubsystem=type('MeshSubsystem', (), {}),
        UnrealEditorSubsystem=type('WorldSubsystem', (), {}), VolumetricCloud=Cloud, VolumetricCloudComponent=Object,
        EditorAssetLibrary=Object(load_asset=lambda path: Material(name='PondWater')),
        MaterialProperty=Object(MP_NORMAL=0, MP_BASE_COLOR=1),
        MaterialEditingLibrary=Object(get_material_property_input_node=lambda material, prop: Object()),
        Vector=Vector, TriangleID=Object, TraceTypeQuery=Object(TRACE_TYPE_QUERY1=0), DrawDebugTrace=Object(NONE=0),
        SystemLibrary=Object(line_trace_single=line_trace), load_class=lambda *args: Object(),
        get_default_object=lambda cls: Object(call_method=lambda method, args: args[0]))
    fake.get_editor_subsystem = lambda cls: mesh_subsystem if cls == fake.StaticMeshEditorSubsystem else world_subsystem
    syntax = ast.parse((root / 'Scripts/verify_plateau.py').read_text())
    function = next(node for node in syntax.body if isinstance(node, ast.FunctionDef) and node.name == 'verify_park')
    with tempfile.TemporaryDirectory() as temporary:
        task_root = Path(temporary)
        directory = task_root / 'Data/Plateau/ParkGeometry'
        directory.mkdir(parents=True)
        (directory / 'park.json').write_text(json.dumps(manifest))
        report = {'checks': []}
        scope = {'ROOT': task_root, 'REPORT': report, 'u': fake, 'json': json, 'math': math}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'canonical_verify_park', 'exec'), scope)
        verify = scope['verify_park']
        verify(labels)
        assert len(traces) == len(manifest['benches']) == 234
        proof = report['park']
        assert proof['saved_pond_source_triangles'] == 940
        assert proof['saved_pond_unique_vertices'] == 950
        assert proof['saved_pond_vertex_positions_and_topology_verified']
        baseline = dict(proof)
        original_builder = plateau_park.build_park
        plateau_park.build_park = lambda: (source_mesh, manifest)
        try:
            actor = next(actor for label, actor in labels.items() if label.startswith('Plateau park PondWater_'))
            component, mesh = actor.static_mesh_component, actor.static_mesh_component.static_mesh
            dry = next(actor for label, actor in labels.items() if label.startswith('Plateau park Iron_'))
            mutations = [(component, 'visible', False), (component, 'hidden_in_game', True),
                (actor, 'hidden', True), (actor, 'hidden_ed', True),
                (actor.position, 'x', 1), (actor.scale, 'z', 1.1),
                (actor.rotation, 'yaw', 1), (actor.rotation, 'pitch', float('nan')),
                (dry.static_mesh_component, 'visible', False), (dry.position, 'z', 10),
                (mesh, 'description', None), (mesh.description.points[0], 'z', mesh.description.points[0].z + .03),
                (mesh.description.points[0], 'x', float('nan'))]
            for obj, key, value in mutations:
                original = getattr(obj, key)
                setattr(obj, key, value)
                try:
                    try: verify(labels)
                    except AssertionError: pass
                    else: raise AssertionError('Saved-park QA accepted corrupt ' + key)
                finally:
                    setattr(obj, key, original)
            # Preserve every point and the triangle count, but alter connectivity.
            description = mesh.description
            first = description.triangles[0]
            other_index = next(i for i, triangle in enumerate(description.triangles) if triangle[0] != first[0])
            other = description.triangles[other_index]
            description.triangles[0] = (other[0], *first[1:])
            description.triangles[other_index] = (first[0], *other[1:])
            try:
                try: verify(labels)
                except AssertionError: pass
                else: raise AssertionError('Saved-park QA accepted changed pond connectivity with identical vertex set')
            finally:
                description.triangles[0], description.triangles[other_index] = first, other
            verify(labels)
            assert report['park'] == baseline
        finally:
            plateau_park.build_park = original_builder
    assert production.read_bytes() == before, 'Saved-park QA mutated production metadata'
    print('Saved-park QA passed: 284 batches, 940 pond triangles / 950 OBJ-rounded unique vertices; hidden/moved/scaled/rotated actors, missing/moved/nonfinite pond vertices and changed topology rejected')


if __name__ == '__main__':
    main()
