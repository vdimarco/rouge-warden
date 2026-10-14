"""Add surveyed Toronto trees using the retained Nanite tree, offline only."""
import json
import math
from pathlib import Path
import shlex
import unreal as u

assert '-nullrhi' in [v.lower() for v in shlex.split(u.SystemLibrary.get_command_line())]
root = Path(u.Paths.project_dir()).resolve()
layout = json.loads((root / 'Data/CollegeBathurst/layout.json').read_text())
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
assert world.get_path_name().startswith('/Game/Maps/CollegeBathurst.')
assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Start from the saved map'
assert not any(a.get_actor_label() == 'Toronto mapped vegetation' for a in editor.get_all_level_actors())
points = layout['trees']
assert len(points) == layout['counts']['trees'] == 185
x0, y0, x1, y1 = layout['bounds_cm']
assert all(len(p) == 2 and all(math.isfinite(v) for v in p) and x0 <= p[0] <= x1 and y0 <= p[1] <= y1 for p in points)
assert all(math.dist(p, layout['spawn'][:2]) > 200 and math.dist(p, layout['car'][:2]) > 350 for p in points)
mesh = u.EditorAssetLibrary.load_asset('/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02')
vegetation = u.load_class(None, '/Script/Quebec.QuebecVegetation')
assert isinstance(mesh, u.StaticMesh) and vegetation
assert mesh.get_editor_property('nanite_settings').get_editor_property('enabled')
assert all(u.MaterialEditingLibrary.has_material_usage(slot.material_interface, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
           and u.MaterialEditingLibrary.has_material_usage(slot.material_interface, u.MaterialUsage.MATUSAGE_NANITE)
           for slot in mesh.get_editor_property('static_materials'))
height = mesh.get_bounds().box_extent.z * 2
assert math.isfinite(height) and height > 100

actor = editor.spawn_actor_from_class(vegetation, u.Vector())
actor.set_actor_label('Toronto mapped vegetation')
actor.set_folder_path('CollegeBathurst/Trees')
component = actor.get_editor_property('trees')
assert component.set_static_mesh(mesh)
transforms = []
for index, (x, y) in enumerate(points):
    scale = (650 + index % 7 * 55) / height
    transforms.append(u.Transform(u.Vector(x, y, 0), u.Rotator(yaw=index * 137 % 360), u.Vector(scale, scale, scale)))
component.add_instances(transforms, False, False, False)
assert component.get_instance_count() == len(points)
assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
assert levels.save_current_level()
u.log('COLLEGE_TREES_OK ' + json.dumps({'instances': len(points), 'mesh': mesh.get_path_name(),
    'placement': 'retained OSM tree XY; illustrative 6.5–9.8 m heights and rotations; no tree collision'}))
