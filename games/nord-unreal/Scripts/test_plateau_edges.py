"""Verify exact exits, inward signs and unchanged duplicate boundary collision."""
import json
import math
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace

import plateau_edges as edges
from plateau_ground import district_bounds
from plateau_streets import _distance, WALK_ROUTE
from test_verify_plateau_ground import Object, StaticMesh, Vector


class Material(Object):
    def __init__(self, name): self.name, self.nanite_usage = name, True
    def get_path_name(self): return '/Game/Plateau/Materials/M_' + self.name + '.M_' + self.name


class EdgeMesh(StaticMesh, Object):
    def __init__(self, name, metadata):
        low, high = metadata['bounds_cm']
        super().__init__(name, metadata['triangles'], [low[0], low[1], high[0], high[1], low[2], high[2]])
        self.nanite_settings = Object(enabled=True)
        self.build_settings = Object(max_lumen_mesh_cards=64, generate_distance_field_as_if_two_sided=True)
    def get_path_name(self): return '/Game/Plateau/Edges/SM_' + self.name + '.SM_' + self.name


class Cube:
    def get_path_name(self): return '/Engine/BasicShapes/Cube.Cube'


class Component(Object):
    def __init__(self):
        super().__init__(static_mesh=Cube(), material=None, profile='BlockAll', collision=2, visible=True,
                         cast_shadow=True, affect_distance_field_lighting=True, affect_dynamic_indirect_lighting=True,
                         collision_mutations=0, text='', world_size=0.)
    def set_static_mesh(self, mesh): self.static_mesh = mesh
    def set_material(self, index, material): self.material = material
    def get_material(self, index): return self.material
    def set_visibility(self, visible): self.visible = visible
    def is_visible(self): return self.visible
    def set_cast_shadow(self, value): self.cast_shadow = value
    def set_affect_distance_field_lighting(self, value): self.affect_distance_field_lighting = value
    def set_affect_dynamic_indirect_lighting(self, value): self.affect_dynamic_indirect_lighting = value
    def get_collision_profile_name(self): return self.profile
    def get_collision_enabled(self): return self.collision
    def set_collision_profile_name(self, profile):
        self.profile, self.collision = profile, 0 if profile == 'NoCollision' else 2
        self.collision_mutations += 1
    def set_text(self, text): self.text = text
    def set_world_size(self, size): self.world_size = size
    def set_horizontal_alignment(self, value): self.horizontal_alignment = value
    def set_vertical_alignment(self, value): self.vertical_alignment = value
    def set_text_render_color(self, value): self.text_render_color = value


class Actor(Object):
    def __init__(self):
        self.label, self.hidden = 'New actor', False
        self.position, self.scale = Vector(), Vector(1, 1, 1)
        self.rotation = Object(pitch=0., roll=0., yaw=0.)
        self.static_mesh_component = Component()
    def get_actor_label(self): return self.label
    def set_actor_label(self, value): self.label = value
    def set_folder_path(self, value): self.folder = value
    def set_actor_hidden_in_game(self, value): self.hidden = value
    def get_actor_location(self): return self.position
    def get_actor_scale3d(self): return self.scale
    def get_actor_rotation(self): return self.rotation
    def set_actor_location(self, value, sweep, teleport): self.position = value
    def set_actor_rotation(self, value, teleport): self.rotation = value
    def get_component_by_class(self, cls): return self.static_mesh_component


class TextActor(Actor):
    pass


class Editor:
    def __init__(self):
        self.actors = [Actor() for _ in range(5)]
        for actor in self.actors[:4]: actor.label = 'District edge'
        self.actors[4].label = 'Unrelated gameplay actor'
    def get_all_level_actors(self): return list(self.actors)
    def spawn_actor_from_class(self, cls, position):
        actor = cls(); actor.position = position; self.actors.append(actor); return actor
    def destroy_actor(self, actor): self.actors.remove(actor)


def main():
    mesh, report = edges.build_edges()
    assert len(mesh.groups) == 8 and report['triangles'] == 2832 and report['new_collision'] is False
    expected_exits = {'way/490998043': (55373.30293126712, -15194.011797595113),
                      'way/19938440': (55373.30293126712, -25751.739891552836)}
    bounds = district_bounds()
    for closure in report['closures']:
        assert tuple(closure['mapped_exit_xy']) == expected_exits[closure['source']]
        assert closure['illustrative'] and closure['road_width_cm'] == 680
        assert math.isclose(math.dist(closure['mapped_exit_xy'], closure['closure_center_xy']), 250., abs_tol=1e-7)
        inward = [closure['interior_reference_xy'][i] - closure['closure_center_xy'][i] for i in (0, 1)]
        norm = math.hypot(*inward)
        assert sum(inward[i] / norm * closure['sign']['normal'][i] for i in (0, 1)) > .999999
        angle = math.radians(closure['sign']['yaw'])
        assert math.dist((math.cos(angle), math.sin(angle)), closure['sign']['normal']) < 1e-8
        assert abs(sum(closure['outward_direction'][i] * closure['across_road_direction'][i] for i in (0, 1))) < 1e-8
        assert closure['route_clearance_cm'] > 13000 and closure['sign']['text'] == 'RUE BARRÉE'
    triangles = 0
    for name, faces in mesh.groups.items():
        assert not report['materials'][name]['collision']
        for face in faces:
            assert all(bounds[0] <= p[0] <= bounds[2] and bounds[1] <= p[1] <= bounds[3]
                       and all(math.isfinite(v) for v in p) for p in face), 'Closure geometry crosses playable boundary'
            for p in face:
                assert min(_distance(p, a, b) for a, b in zip(WALK_ROUTE, WALK_ROUTE[1:])) > 12000
            for i in range(1, len(face) - 1):
                a, b, c = [tuple(struct.unpack('f', struct.pack('f', round(v, 3)))[0] for v in p)
                           for p in (face[0], face[i], face[i + 1])]
                u, v = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
                normal = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
                assert sum(k * k for k in normal) > 1e-10, 'Exported closure triangle collapses'
                triangles += 1
    assert triangles == report['triangles']
    editor, editor_token, mesh_token = Editor(), object(), object()
    subsystem = Object(get_lod_build_settings=lambda mesh, lod: mesh.build_settings)
    fake = SimpleNamespace(EditorActorSubsystem=editor_token, StaticMeshEditorSubsystem=mesh_token,
        get_editor_subsystem=lambda cls: editor if cls is editor_token else subsystem,
        StaticMeshActor=Actor, TextRenderActor=TextActor, TextRenderComponent=Component, Vector=Vector,
        Rotator=lambda yaw=0: Object(pitch=0, roll=0, yaw=yaw), Color=lambda **values: Object(**values),
        CollisionEnabled=Object(NO_COLLISION=0, QUERY_AND_PHYSICS=2),
        MaterialUsage=Object(MATUSAGE_NANITE=7),
        MaterialEditingLibrary=Object(has_material_usage=lambda mat, usage: mat.nanite_usage),
        HorizTextAligment=Object(EHTA_CENTER=1), VerticalTextAligment=Object(EVRTA_TEXT_CENTER=2))
    originals = [(a, a.static_mesh_component.static_mesh, a.position, a.scale, a.rotation) for a in editor.actors[:4]]
    materials = {name: Material(name) for name in ('ConstructionOrange', 'White', 'Iron', 'Rubber')}
    imports = []
    def importer(path, destination, name):
        assert destination == '/Game/Plateau/Edges'
        imports.append(name)
        return EdgeMesh(path.stem, report['materials'][path.stem])
    old_prepare = edges.prepare
    edges.prepare = lambda: report
    try:
        for _ in range(2):
            applied = edges.apply(fake, materials, importer, lambda *args: None)
            assert applied['hidden_original_barriers'] == 4 and applied['original_collision_preserved']
        assert len(editor.actors) == 15 and len(imports) == 16, 'Repeated apply duplicated edge actors'
        for actor, mesh_before, position, scale, rotation in originals:
            component = actor.static_mesh_component
            assert component.profile == 'BlockAll' and component.collision == 2 and component.collision_mutations == 0
            assert component.static_mesh is mesh_before
            assert actor.position is position and actor.scale is scale and actor.rotation is rotation
            assert not component.visible and actor.hidden and not component.cast_shadow
        assert editor.actors[4].static_mesh_component.visible and not editor.actors[4].hidden
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            directory = root / 'Data/Plateau/EdgesGeometry'
            directory.mkdir(parents=True)
            (directory / 'edges.json').write_text(json.dumps(report))
            (root / 'Data/LaFontaine').mkdir()
            (root / 'Data/LaFontaine/osm.xml').symlink_to(edges.ROOT / 'Data/LaFontaine/osm.xml')
            labels = {a.get_actor_label(): a for a in editor.actors}
            verified = edges.verify(fake, labels, root)
            assert verified['hidden_original_barriers'] == 4 and verified['batches'] == 8
            actor = labels[edges.PREFIX + next(iter(report['materials']))]
            component = actor.static_mesh_component
            sign = labels[edges.PREFIX + 'sign way/490998043']
            corruptions = [(originals[2][0].static_mesh_component, 'visible', True),
                           (originals[1][0].static_mesh_component, 'profile', 'NoCollision'),
                           (originals[3][0].static_mesh_component, 'collision', 0),
                           (component, 'profile', 'BlockAll'), (component, 'collision', 2),
                           (component.static_mesh, 'triangles', 1),
                           (component.static_mesh.nanite_settings, 'enabled', False),
                           (component.static_mesh.build_settings, 'max_lumen_mesh_cards', 12),
                           (component.static_mesh.build_settings, 'generate_distance_field_as_if_two_sided', False),
                           (sign.static_mesh_component, 'text', 'wrong'),
                           (sign.static_mesh_component, 'text_render_color', Object(r=35, g=35, b=30, a=255)),
                           (sign.rotation, 'yaw', 0)]
            for obj, key, bad in corruptions:
                previous = getattr(obj, key); setattr(obj, key, bad)
                try:
                    edges.verify(fake, labels, root)
                except AssertionError:
                    pass
                else:
                    raise AssertionError('Edge verifier accepted corrupt ' + key)
                finally:
                    setattr(obj, key, previous)
            removed = editor.actors.pop(0)
            try:
                try: edges.verify(fake, labels, root)
                except AssertionError: pass
                else: raise AssertionError('Label dict hid a missing duplicate boundary actor')
            finally:
                editor.actors.insert(0, removed)
    finally:
        edges.prepare = old_prepare
    print('Plateau edge checks passed: exact two road exits, eight batches/2,832 triangles, inward signs, exterior route clearance, four duplicate barriers hidden with collision unchanged, idempotent apply and saved-state corruption rejection')


if __name__ == '__main__':
    main()
