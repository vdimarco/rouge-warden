"""Survey coverage, exact clipping and import integration; no Unreal required."""
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace

import plateau_ground as ground
from plateau_mesh import Mesh
from plateau_streets import _inside


def covered(point, triangles):
    return any(_inside(point, triangle) for triangle in triangles)


def main():
    records = ground.survey()
    park = next(r for r in records if r['source'] == 'way/4767368')
    assert park['name'] == 'Parc La Fontaine' and park['source_way_ids'] == ['4767368']
    assert len(park['rings']) == 1 and len(park['rings'][0]) == 95
    bounds = ground.district_bounds()
    triangles = ground.triangulate(park['rings'], bounds)
    area = sum(ground.signed_area(t) for t in triangles)
    assert math.isclose(area, abs(ground.signed_area(park['rings'][0])), abs_tol=.01)
    expected_bounds = (-31199.34662615831, -32099.121999953466, 45186.1750032611, 59796.65120004114)
    observed_bounds = tuple(op(p[i] for t in triangles for p in t) for op in (min, max) for i in (0, 1))
    assert all(abs(a - b) < .001 for a, b in zip(observed_bounds, expected_bounds))
    assert all(ground.signed_area(t) > 0 for t in triangles), 'Inverted lawn triangle'
    for x in range(-32000, 47000, 2300):
        for y in range(-33000, 61000, 2300):
            point = (x + .317, y + .713)
            assert covered(point, triangles) == _inside(point, park['rings'][0]), 'Grass differs from surveyed park'
    assert covered((36000, 0), triangles), 'Surveyed southeast park lawn remains uncovered'
    assert not covered((36500, -4400), triangles), 'Lawn extends beyond the surveyed southeast park edge'
    assert not covered((42000, -10900), triangles), 'Alley courtyard was turned into invented park lawn'

    outer = [(0, 0), (8, 0), (8, 2), (3, 2), (3, 8), (0, 8)]
    hole = [(1, 1), (2, 1), (2, 2), (1, 2)]
    clipped = ground.triangulate([outer, hole], (1.5, -1, 6, 5))
    assert math.isclose(sum(ground.signed_area(t) for t in clipped), 13., abs_tol=1e-8)
    assert not covered((1.75, 1.5), clipped), 'Multipolygon inner hole was filled'
    assert covered((2.5, 4.5), clipped) and not covered((4, 4.5), clipped)
    assert all(1.5 <= p[0] <= 6 and -1 <= p[1] <= 5 for t in clipped for p in t)
    diagonal = ground.triangulate([[(0, 0), (10, 10), (0, 10)]], (2, 2, 8, 8))
    assert math.isclose(sum(ground.signed_area(t) for t in diagonal), 18., abs_tol=1e-8)

    with tempfile.TemporaryDirectory() as temporary:
        source = Path(temporary) / 'multipolygon.xml'
        source.write_text('<osm>' + ''.join(
            f'<node id="{i}" lat="{45.525 + y / 10000}" lon="{-73.5699 + x / 10000}"/>'
            for i, (x, y) in enumerate([(0, 0), (8, 0), (8, 8), (0, 8),
                                       (2, 2), (3, 2), (3, 3), (2, 3)], 1)) +
            '<way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><tag k="leisure" v="park"/></way>'
            '<way id="11"><nd ref="1"/><nd ref="4"/><nd ref="3"/></way>'
            '<way id="12"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="8"/><nd ref="5"/></way>'
            '<relation id="20"><member type="way" ref="10" role="outer"/>'
            '<member type="way" ref="11" role="outer"/><member type="way" ref="12" role="inner"/>'
            '<tag k="type" v="multipolygon"/><tag k="leisure" v="park"/></relation></osm>')
        parsed = ground.survey(source)
        assert len(parsed) == 1 and parsed[0]['source'] == 'relation/20'
        assert sorted(map(len, parsed[0]['rings'])) == [4, 4], 'Reversed OSM members failed to join'
        mesh = Mesh()
        report = ground.build_ground(mesh)
        mesh.write(temporary)
        assert all(p[2] in (2., 9.) for f in mesh.groups['ParkGrass'] for p in f)
        assert all(p[2] == .5 for f in mesh.groups['YardGround'] for p in f)
        assert report['new_collision'] is False
        island = next(s for s in report['surfaces'] if s['kind'] == 'pond_island')
        assert island['source'] == 'relation/14474534' and island['source_way_ids'] == ['433686252'] and island['z'] == 9
        uv = [tuple(map(float, line.split()[1:])) for line in
              (Path(temporary) / 'YardGround.obj').read_text().splitlines() if line.startswith('vt ')]
        assert max(p[0] for p in uv) - min(p[0] for p in uv) > 400, 'Yard texture stretched over district'

    class Component:
        def __init__(self): self.profile = 'BlockAll'
        def set_material(self, slot, material): self.material = material
        def set_static_mesh(self, mesh): self.mesh = mesh
        def set_collision_profile_name(self, profile): self.profile = profile
        def set_cast_shadow(self, shadow): self.shadow = shadow
    class Actor:
        def __init__(self, label): self.label, self.static_mesh_component = label, Component()
        def get_actor_label(self): return self.label
        def set_actor_label(self, label): self.label = label
        def set_folder_path(self, folder): self.folder = folder
    class Editor:
        def __init__(self): self.actors = [Actor('District ground'), Actor('OSM Grass')]
        def get_all_level_actors(self): return self.actors
        def spawn_actor_from_class(self, cls, point):
            actor = Actor('New actor'); self.actors.append(actor); return actor
    editor = Editor()
    fake = SimpleNamespace(EditorActorSubsystem=object, StaticMeshActor=object, Vector=lambda: (),
                           get_editor_subsystem=lambda cls: editor)
    original_prepare = ground.prepare
    ground.prepare = lambda: report
    try:
        imports = []
        def importer(source, destination, name):
            imports.append((source.name, name)); return name
        for _ in range(2):
            assert ground.apply(fake, {'Gravel': 'gravel', 'ParkGrass': 'grass'}, importer) is report
        assert len(editor.actors) == 3, 'Repeated import duplicated ground actors'
        assert editor.actors[0].static_mesh_component.profile == 'BlockAll', 'Original floor collision changed'
        assert editor.actors[0].static_mesh_component.material == 'gravel'
        assert all(a.static_mesh_component.profile == 'NoCollision' for a in editor.actors[1:])
        assert all(a.static_mesh_component.shadow is False for a in editor.actors[1:])
        assert editor.actors[1].static_mesh_component.mesh == 'SM_ParkGrass'
        assert imports[:2] == [('ParkGrass.obj', 'SM_ParkGrass'), ('YardGround.obj', 'SM_YardGround')]
    finally:
        ground.prepare = original_prepare
    print('Plateau ground checks passed: exact 360035 m² park boundary, clipped holes, retained pond island, idempotent visual import')


if __name__ == '__main__':
    main()
