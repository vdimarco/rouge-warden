"""Production-context saved-state verification and deliberate corruption cases."""
import json
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace

from plateau_context import build_context
from test_verify_plateau_ground import Component, Object, StaticMesh, Vector
import verify_plateau_context as verifier


class Material(Object):
    def __init__(self, name):
        self.path = '/Game/Plateau/Materials/M_' + name + '.M_' + name
        self.nanite_usage = True
    def get_path_name(self): return self.path


class Description:
    def __init__(self, faces):
        points = {tuple(verifier._float32(float(f'{v:.3f}')) for v in point)
                  for face in faces for point in face}
        self.points = [Vector(*point) for point in sorted(points)]
        indices = {tuple((p.x, p.y, p.z)): i for i, p in enumerate(self.points)}
        self.triangles = []
        for face in faces:
            ids = [indices[tuple(verifier._float32(float(f'{v:.3f}')) for v in point)] for point in face]
            self.triangles.extend((ids[i + 1], ids[i], ids[0]) for i in range(1, len(ids) - 1))
    def get_triangle_count(self): return len(self.triangles)
    def get_triangle_vertex_instances(self, triangle): return self.triangles[triangle.id_value]
    def get_vertex_instance_vertex(self, instance): return Object(id_value=instance)
    def get_vertex_position(self, vertex): return self.points[vertex.id_value]


class ContextMesh(StaticMesh, Object):
    def __init__(self, name, metadata, faces):
        low, high = metadata['bounds_cm']
        super().__init__(name, metadata['triangles'], [low[0], low[1], high[0], high[1], low[2], high[2]])
        self.path = '/Game/Plateau/Context/SM_' + name + '.SM_' + name
        self.nanite_settings = Object(enabled=True, fallback_target=1, fallback_percent_triangles=1., fallback_relative_error=0.)
        self.build_settings = Object(max_lumen_mesh_cards=64, generate_distance_field_as_if_two_sided=True)
        self.body_setup = Object(collision_trace_flag=3 if metadata['collision'] else 0)
        self.description = Description(faces)
    def get_path_name(self): return self.path
    def get_static_mesh_description(self, lod): return self.description


class ContextComponent(Component):
    def is_visible(self): return self.visible


class ContextActor(Object):
    def __init__(self, name, metadata, material, faces):
        self.hidden, self.position = False, Vector()
        self.scale, self.rotation = Vector(1, 1, 1), Object(roll=0, pitch=0, yaw=0)
        self.static_mesh_component = ContextComponent(static_mesh=ContextMesh(name, metadata, faces), material=material,
            profile='BlockAll' if metadata['collision'] else 'NoCollision', collision=2 if metadata['collision'] else 0,
            cast_shadow=metadata['material'] != 'Gravel', visible=True)
    def get_actor_location(self): return self.position
    def get_actor_scale3d(self): return self.scale
    def get_actor_rotation(self): return self.rotation


def main():
    source_root = Path(__file__).resolve().parents[1]
    production_path = source_root / 'Data/Plateau/ContextGeometry/context.json'
    production_before = production_path.read_bytes()
    previous_manifest = json.loads(production_before)
    source_mesh, generated = build_context()
    manifest = json.loads(json.dumps(generated))
    # Collision metadata can be tested while the editor still uses the previous
    # manifest. The existing OBJ topology and filenames must remain identical.
    assert set(previous_manifest['materials']) == set(manifest['materials'])
    for name, metadata in previous_manifest['materials'].items():
        assert {k: v for k, v in metadata.items() if k != 'collision'} == {
            k: v for k, v in manifest['materials'][name].items() if k != 'collision'}
    assert previous_manifest['triangles'] == manifest['triangles']
    for before, after in zip(previous_manifest['buildings'], manifest['buildings']):
        assert {k: v for k, v in before.items() if k != 'roof_area_square_metres'} == {
            k: v for k, v in after.items() if k != 'roof_area_square_metres'}
        # Embedded UE Python and host Python can sum identical roof triangles
        # with a final few floating-point bits of difference.
        assert math.isclose(before['roof_area_square_metres'], after['roof_area_square_metres'], abs_tol=1e-8)
    materials = {name: Material(name) for name in {b['material'] for b in manifest['materials'].values()}}
    labels = {'Unrelated gameplay actor': Object()}
    labels.update({'Plateau context ' + name: ContextActor(name, metadata, materials[metadata['material']], source_mesh.groups[name])
                   for name, metadata in manifest['materials'].items()})
    subsystem = Object(get_lod_build_settings=lambda mesh, lod: mesh.build_settings)
    fake = SimpleNamespace(StaticMeshActor=ContextActor, StaticMeshEditorSubsystem=object,
        get_editor_subsystem=lambda cls: subsystem, CollisionEnabled=Object(NO_COLLISION=0, QUERY_AND_PHYSICS=2),
        CollisionTraceFlag=Object(CTF_USE_COMPLEX_AS_SIMPLE=3),
        NaniteFallbackTarget=Object(PERCENT_TRIANGLES=1), MaterialUsage=Object(MATUSAGE_NANITE=7),
        MaterialEditingLibrary=Object(has_material_usage=lambda mat, usage: mat.nanite_usage), TriangleID=Object)
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        directory = root / 'Data/Plateau/ContextGeometry'
        directory.mkdir(parents=True)
        metadata_path = directory / 'context.json'
        metadata_path.write_text(json.dumps(manifest))
        (root / 'Data/LaFontaine').mkdir()
        (root / 'Data/LaFontaine/osm.xml').symlink_to(source_root / 'Data/LaFontaine/osm.xml')
        result = verifier.verify(fake, labels, root)
        assert result['batches'] == 742 and result['triangles'] == 80799
        assert result['buildings'] == 1722 and result['continued_road_ways'] == 235
        assert result['excluded_interior_buildings'] == 1663 and result['new_collision'] == 'mapped building shells only'
        assert result['partial_buildings'] == 176
        assert result['nanite_materials'] == ['Asphalt', 'BrickBrown', 'BrickRed', 'Glass', 'Gravel', 'Roof']

        # The baseline above regenerates the production survey. Reuse that same
        # independent result for the many saved-state corruptions below.
        original_builder = verifier.build_context
        verifier.build_context = lambda osm_path: (source_mesh, generated)
        try:
            first_label = next(label for label in labels if label.startswith('Plateau context '))
            actor = labels[first_label]
            component, mesh = actor.static_mesh_component, actor.static_mesh_component.static_mesh
            gravel = next(a.static_mesh_component for label, a in labels.items()
                          if label.startswith('Plateau context Gravel_'))
            shell = next(a.static_mesh_component for label, a in labels.items()
                         if label.startswith('Plateau context BrickRed_'))
            mutations = [(component, 'profile', 'BlockAll'), (component, 'collision', 2),
                         (component, 'visible', False), (actor, 'hidden', True),
                         (component, 'cast_shadow', False), (gravel, 'cast_shadow', True),
                         (component, 'material', None), (component.material, 'path', '/Game/Wrong.M_Wrong'),
                         (component.material, 'nanite_usage', False),
                         (mesh, 'path', '/Game/Plateau/Context/SM_wrong.SM_wrong'),
                         (mesh.nanite_settings, 'enabled', False),
                         (mesh.nanite_settings, 'fallback_target', 0),
                         (mesh.nanite_settings, 'fallback_percent_triangles', .5),
                         (mesh.nanite_settings, 'fallback_relative_error', .1),
                         (mesh.build_settings, 'max_lumen_mesh_cards', 12),
                         (mesh.build_settings, 'generate_distance_field_as_if_two_sided', False),
                         (mesh.bounds.origin, 'x', mesh.bounds.origin.x + 1),
                         (mesh.bounds.box_extent, 'y', mesh.bounds.box_extent.y - 1),
                         (mesh.bounds.origin, 'z', float('nan')),
                         (actor.position, 'x', 1), (actor.scale, 'z', 2), (actor.rotation, 'yaw', 1),
                         (actor.rotation, 'yaw', float('nan')),
                         (mesh, 'triangles', mesh.triangles - 1), (mesh, 'triangles', mesh.triangles + 1),
                         (component, 'static_mesh', None)]
            mutations += [(mesh, 'description', None),
                          (mesh.description.points[0], 'z', mesh.description.points[0].z + .03),
                          (mesh.description.points[0], 'x', float('nan'))]
            mutations += [(shell, 'profile', 'NoCollision'), (shell, 'collision', 0),
                          (shell.static_mesh.body_setup, 'collision_trace_flag', 0)]
            for obj, key, bad in mutations:
                original = getattr(obj, key)
                setattr(obj, key, bad)
                try:
                    verifier.verify(fake, labels, root)
                except AssertionError:
                    pass
                else:
                    raise AssertionError('Context verifier accepted corrupt ' + key)
                finally:
                    setattr(obj, key, original)

            removed = labels.pop(first_label)
            try:
                try: verifier.verify(fake, labels, root)
                except AssertionError: pass
                else: raise AssertionError('Context verifier accepted a missing actor')
            finally:
                labels[first_label] = removed
            labels['Plateau context stale'] = removed
            try:
                try: verifier.verify(fake, labels, root)
                except AssertionError: pass
                else: raise AssertionError('Context verifier accepted a stale actor')
            finally:
                labels.pop('Plateau context stale')

            first_name = next(iter(manifest['materials']))
            corruptions = [lambda m: m['buildings'][0]['footprint_xy'][0].__setitem__(0, m['buildings'][0]['footprint_xy'][0][0] + 1),
                           lambda m: m['buildings'][0].__setitem__('source', m['excluded_interior_sources'][0]),
                           lambda m: m['buildings'][0].__setitem__('height_cm', 999),
                           lambda m: m['apron'].__setitem__('area_square_metres', 1),
                           lambda m: m['outer_bounds_xy'].__setitem__(0, 0),
                           lambda m: m['materials'][first_name].__setitem__('material', 'Roof'),
                           lambda m: m['materials'][first_name].__setitem__('triangles', 1),
                           lambda m: m['roads'][0]['segments'][0]['centerline_xy'][0].__setitem__(0, 0)]
            for corrupt in corruptions:
                changed = json.loads(json.dumps(manifest))
                corrupt(changed)
                metadata_path.write_text(json.dumps(changed))
                try:
                    verifier.verify(fake, labels, root)
                except AssertionError:
                    pass
                else:
                    raise AssertionError('Context verifier accepted changed surveyed metadata')
            metadata_path.write_text(json.dumps(manifest))
            assert verifier.verify(fake, labels, root) == result

            # Coarse Nanite clusters may expand render bounds without moving
            # any saved source vertex. Reproduce the observed 0.667 cm Z pad.
            original_origin, original_extent = mesh.bounds.origin.z, mesh.bounds.box_extent.z
            mesh.bounds.origin.z += .6671142578125 / 2
            mesh.bounds.box_extent.z += .6671142578125 / 2
            try:
                expanded = verifier.verify(fake, labels, root)
                assert expanded['source_vertex_positions_verified']
                assert expanded['nanite_render_bounds_max_padding_cm'] > .66
            finally:
                mesh.bounds.origin.z, mesh.bounds.box_extent.z = original_origin, original_extent
        finally:
            verifier.build_context = original_builder
    assert production_path.read_bytes() == production_before, 'Verifier mutated the production manifest'
    print('Saved-context verifier checks passed: 742 production batches / 80,799 triangles; corrupt survey, mesh paths, collision, shadows, materials, Nanite, Lumen/DF settings, bounds, transforms and triangles rejected')


if __name__ == '__main__':
    main()
