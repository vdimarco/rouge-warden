"""A small Unreal facade rejects corrupt saved stage shells and sign settings."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace

from plateau_landmarks import build_landmarks
from test_verify_plateau_ground import Component, Object, StaticMesh, Vector
import verify_plateau_landmarks as verifier


class Material(Object):
    def __init__(self, name):
        self.path = '/Game/Plateau/Materials/M_' + name + '.M_' + name
        self.nanite_usage = True
    def get_path_name(self): return self.path


class LandmarkMesh(StaticMesh, Object):
    def __init__(self, name, metadata, points):
        low, high = [[operation(p[i] for p in points) for i in range(3)] for operation in (min, max)]
        super().__init__(name, metadata['triangles'], [low[0], low[1], high[0], high[1], low[2], high[2]])
        self.path = '/Game/Plateau/Landmarks/SM_' + name + '.SM_' + name
        self.nanite_settings = Object(enabled=True, fallback_target=1, fallback_percent_triangles=1., fallback_relative_error=0.)
        self.build_settings = Object(max_lumen_mesh_cards=64, generate_distance_field_as_if_two_sided=True)
    def get_path_name(self): return self.path


class VisibleComponent(Component):
    def is_visible(self): return self.visible


class TransformActor(Object):
    def __init__(self):
        self.position, self.scale = Vector(), Vector(1, 1, 1)
        self.rotation, self.hidden = Object(pitch=0, roll=0, yaw=0), False
    def get_actor_location(self): return self.position
    def get_actor_scale3d(self): return self.scale
    def get_actor_rotation(self): return self.rotation


class LandmarkActor(TransformActor):
    def __init__(self, name, metadata, points):
        super().__init__()
        self.static_mesh_component = VisibleComponent(static_mesh=LandmarkMesh(name, metadata, points),
            material=Material(metadata['material']), profile='NoCollision', collision=0,
            cast_shadow=True, visible=True)


class TextActor(TransformActor):
    def __init__(self, sign):
        super().__init__()
        self.position = Vector(*sign['position'])
        self.rotation.yaw = sign['yaw']
        self.component = VisibleComponent(text=sign['text'], world_size=sign['size'], profile='NoCollision',
                                          collision=0, cast_shadow=False, visible=True)
    def get_component_by_class(self, cls): return self.component


def check():
    generated_mesh, generated = build_landmarks()
    manifest = json.loads(json.dumps(generated))
    labels = {'Unrelated gameplay actor': Object()}
    labels.update({'Plateau landmark ' + name: LandmarkActor(name, metadata,
                   [point for face in generated_mesh.groups[name] for point in face])
                   for name, metadata in manifest['materials'].items()})
    labels.update({'Plateau landmark sign ' + sign['id']: TextActor(sign) for sign in manifest['signs']})
    subsystem = Object(get_lod_build_settings=lambda mesh, lod: mesh.build_settings)
    fake = SimpleNamespace(StaticMeshActor=LandmarkActor, TextRenderActor=TextActor, TextRenderComponent=object,
        StaticMeshEditorSubsystem=object, get_editor_subsystem=lambda cls: subsystem,
        CollisionEnabled=Object(NO_COLLISION=0), NaniteFallbackTarget=Object(PERCENT_TRIANGLES=1),
        MaterialUsage=Object(MATUSAGE_NANITE=7),
        MaterialEditingLibrary=Object(has_material_usage=lambda material, usage: material.nanite_usage))
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        directory = root / 'Data/Plateau/LandmarkGeometry'
        directory.mkdir(parents=True)
        path = directory / 'landmarks.json'
        path.write_text(json.dumps(manifest))
        result = verifier.verify(fake, labels, root)
        assert result['batches'] == 13 and result['signs'] == 1 and result['triangles'] == 3584
        assert result['nanite_materials'] == ['Iron', 'Roof', 'Trim', 'Wood']
        first_label = next(label for label in labels if label.startswith('Plateau landmark Iron_'))
        actor = labels[first_label]
        component, mesh = actor.static_mesh_component, actor.static_mesh_component.static_mesh
        sign = labels['Plateau landmark sign TheatreVerdure']
        original_builder = verifier.build_landmarks
        verifier.build_landmarks = lambda: (generated_mesh, generated)
        try:
            mutations = [(component, 'profile', 'BlockAll'), (component, 'collision', 2),
                         (component, 'visible', False), (component, 'cast_shadow', False),
                         (actor, 'hidden', True), (component, 'material', None),
                         (component.material, 'path', '/Game/Wrong.M_Wrong'),
                         (component.material, 'nanite_usage', False),
                         (mesh, 'path', '/Game/Plateau/Landmarks/SM_wrong.SM_wrong'),
                         (mesh.nanite_settings, 'enabled', False),
                         (mesh.nanite_settings, 'fallback_target', 0),
                         (mesh.nanite_settings, 'fallback_percent_triangles', .5),
                         (mesh.nanite_settings, 'fallback_relative_error', .1),
                         (mesh.build_settings, 'max_lumen_mesh_cards', 12),
                         (mesh.build_settings, 'generate_distance_field_as_if_two_sided', False),
                         (mesh.bounds.origin, 'x', mesh.bounds.origin.x + 1),
                         (mesh.bounds.box_extent, 'z', mesh.bounds.box_extent.z + 1),
                         (mesh.bounds.origin, 'z', float('nan')),
                         (mesh, 'triangles', mesh.triangles + 1), (component, 'static_mesh', None),
                         (actor.position, 'x', 1), (actor.scale, 'x', 2), (actor.rotation, 'yaw', 1),
                         (sign.component, 'text', 'Wrong label'), (sign.component, 'world_size', 18),
                         (sign.component, 'visible', False), (sign.component, 'cast_shadow', True),
                         (sign.component, 'collision', 2), (sign.component, 'profile', 'BlockAll'),
                         (sign.position, 'z', sign.position.z + 1), (sign.scale, 'y', 2),
                         (sign.rotation, 'yaw', sign.rotation.yaw + 1),
                         (sign.rotation, 'pitch', 1), (sign.rotation, 'yaw', float('nan'))]
            for obj, key, bad in mutations:
                saved = getattr(obj, key)
                setattr(obj, key, bad)
                try:
                    verifier.verify(fake, labels, root)
                except AssertionError:
                    pass
                else:
                    raise AssertionError('Landmark verifier accepted corrupt ' + key)
                finally:
                    setattr(obj, key, saved)
            removed = labels.pop(first_label)
            try:
                try: verifier.verify(fake, labels, root)
                except AssertionError: pass
                else: raise AssertionError('Landmark verifier accepted a missing actor')
            finally:
                labels[first_label] = removed
            labels['Plateau landmark stale'] = removed
            try:
                try: verifier.verify(fake, labels, root)
                except AssertionError: pass
                else: raise AssertionError('Landmark verifier accepted a stale actor')
            finally:
                labels.pop('Plateau landmark stale')
            changed = json.loads(json.dumps(manifest))
            changed['source_mass']['footprint_cm'][0][0] += 1
            path.write_text(json.dumps(changed))
            try:
                verifier.verify(fake, labels, root)
            except AssertionError:
                pass
            else:
                raise AssertionError('Landmark verifier accepted changed source mass metadata')
            path.write_text(json.dumps(manifest))
            # Unreal can return an equivalent wrapped yaw. This is the same facing.
            sign.rotation.yaw += 360
            assert verifier.verify(fake, labels, root) == result
        finally:
            verifier.build_landmarks = original_builder
    return result


if __name__ == '__main__':
    print(json.dumps(check()))
