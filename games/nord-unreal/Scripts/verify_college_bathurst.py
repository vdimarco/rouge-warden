"""Fresh-load Toronto map geometry, spawn, landmark and collision checks."""
import json
import math
from pathlib import Path
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
DATA = ROOT / 'Data/CollegeBathurst'
layout = json.loads((DATA / 'layout.json').read_text())
world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
assert world.get_path_name().startswith('/Game/Maps/CollegeBathurst.'), world.get_path_name()
actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
labels = {a.get_actor_label(): a for a in actors}
assert len([a for a in actors if isinstance(a, u.PlayerStart)]) == 4
assert len([a for a in actors if a.get_actor_label() == 'District edge']) == 4
assert not any(a.get_class().get_name() in ('QuebecCampaign', 'QuebecResident') for a in actors)

checks = []
blocking = {'Brick', 'Cream', 'Sage', 'Roof', 'Landmark'}
for source in sorted((DATA / 'Geometry').glob('*.obj')):
    actor = labels['Toronto ' + source.stem]
    component = actor.static_mesh_component
    mesh = component.static_mesh
    assert mesh.get_path_name() == f'/Game/CollegeBathurst/SM_{source.stem}.SM_{source.stem}'
    points = []
    triangles = 0
    for line in source.read_text().splitlines():
        fields = line.split()
        if fields and fields[0] == 'v':
            points.append((float(fields[1]), -float(fields[2]), float(fields[3])))
        elif fields and fields[0] == 'f':
            triangles += len(fields) - 3
    expected = [[operation(p[axis] for p in points) for axis in range(3)] for operation in (min, max)]
    bounds = mesh.get_bounds()
    observed = [[getattr(bounds.origin, axis) + side * getattr(bounds.box_extent, axis)
                 for axis in ('x', 'y', 'z')] for side in (-1, 1)]
    assert all(math.isfinite(v) and abs(v - expected[end][axis]) < .25
               for end, row in enumerate(observed) for axis, v in enumerate(row)), (source.name, observed, expected)
    assert mesh.get_num_triangles(0) == triangles, (source.name, triangles, mesh.get_num_triangles(0))
    assert (actor.get_actor_location() - u.Vector()).length() < .01
    scale = actor.get_actor_scale3d()
    assert math.dist((scale.x, scale.y, scale.z), (1, 1, 1)) < .001
    profile = 'BlockAll' if source.stem in blocking else 'NoCollision'
    assert str(component.get_collision_profile_name()) == profile, source.name
    if source.stem in blocking:
        assert mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag') == u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE
    assert component.get_material(0), source.name
    checks.append({'group': source.stem, 'triangles': triangles, 'bounds_cm': observed, 'collision': profile})
assert len(checks) == 12, len(checks)

vegetation = [a for a in actors if a.get_actor_label() == 'Toronto mapped vegetation']
assert len(vegetation) <= 1
if vegetation:
    trees = vegetation[0].get_editor_property('trees')
    assert trees.get_instance_count() == len(layout['trees']) == 185
    assert trees.static_mesh.get_path_name() == '/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02.tree_small_02'
    assert trees.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    height = trees.static_mesh.get_bounds().box_extent.z * 2
    for index, point in enumerate(layout['trees']):
        transform = trees.get_instance_transform(index, True)
        assert math.dist((transform.translation.x, transform.translation.y, transform.translation.z), (*point, 0)) < .1
        assert abs(transform.scale3d.z * height - (650 + index % 7 * 55)) < .1
    checks.append({'surveyed_tree_instances': trees.get_instance_count(), 'collision': 'NoCollision', 'height': 'illustrative'})

starts = [a for a in actors if isinstance(a, u.PlayerStart)]
assert min((a.get_actor_location() - u.Vector(*layout['spawn'])).length() for a in starts) < .01
car = labels['Your first car']
assert car.get_class().get_name() == 'QuebecCar'
assert (car.get_actor_location() - u.Vector(*layout['car'])).length() < .01
assert abs(u.MathLibrary.normalized_delta_rotator(car.get_actor_rotation(), u.Rotator(yaw=layout['car_yaw'])).yaw) < .01

gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
landmark = layout['landmarks']['sneaky_dees']
for name, point, height in [('spawn', layout['spawn'], -1.), ('car', layout['car'], -1.),
                            ('landmark roof', landmark['centroid'], landmark['height'])]:
    hit = u.SystemLibrary.line_trace_single(world, u.Vector(point[0], point[1], 10000),
        u.Vector(point[0], point[1], -200), u.TraceTypeQuery.TRACE_TYPE_QUERY1, True,
        [car], u.DrawDebugTrace.NONE, True)
    assert hit is not None, name + ' lacks collision'
    result = gameplay.call_method('BreakHitResult', (hit,))
    assert result[0] and abs(result[5].z - height) < 1., (name, result[5].z, height)
    checks.append({'probe': name, 'surface_z_cm': result[5].z, 'actor': result[9].get_actor_label()})

report = {'passed': True, 'world': world.get_path_name(), 'checks': checks,
          'counts': layout['counts'], 'attribution': layout['attribution'],
          'limits': ['Map readback and collision traces; native walking/driving/rendering checked separately']}
output = ROOT / 'Saved/Tests/DistrictRuntime/TorontoMap.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
u.log('COLLEGE_BATHURST_VERIFY_OK ' + json.dumps(report))
