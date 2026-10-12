"""Restore current Warden residents/cars into the staged, baked Plateau map.

Stage the original Warden map at /Game/UnifiedWarden/LaFontaine and the
Plateau map at /Game/Maps/LaFontaine first. Recovery files are kept outside Content.
"""
import json
from pathlib import Path
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
assert world.get_path_name() == '/Game/Maps/LaFontaine.LaFontaine'
assert not u.EditorLevelLibrary.get_pie_worlds(False)
assert not any(a.get_class().get_name() == 'QuebecParkResident' for a in editor.get_all_level_actors()), 'Already merged'
stream = u.EditorLevelUtils.add_level_to_world(world, '/Game/UnifiedWarden/LaFontaine', u.LevelStreamingAlwaysLoaded)
assert stream, 'Cannot load original Warden actor layer'
original = stream.get_loaded_level()
assert original
assert levels.set_current_level_by_name('LaFontaine'), 'Cannot select persistent Plateau level'
assert levels.get_current_level() != original, 'Persistent Plateau level must remain current'
keepers = [a for a in editor.get_all_level_actors() if a.get_outer() == original and
           (a.get_class().get_name() == 'QuebecParkResident' or a.get_actor_label().startswith('Comic parked car '))]
assert sum(a.get_class().get_name() == 'QuebecParkResident' for a in keepers) == 14
assert sum(a.get_actor_label().startswith('Comic parked car ') for a in keepers) == 8
before = {a.get_actor_label(): {'class': a.get_class().get_name(),
          'route': [[v.x, v.y, v.z] for v in a.get_editor_property('Route')] if a.get_class().get_name() == 'QuebecParkResident' else None}
          for a in keepers}
copied = editor.duplicate_actors(keepers, to_world=world)
assert len(copied) == 22, len(copied)
assert all(a.get_outer() != original for a in copied), 'Copied actors must belong to persistent map'
def signature(actor):
 p = actor.get_actor_location()
 return (actor.get_class().get_name(), round(p.x, 2), round(p.y, 2), round(p.z, 2))
originals = {signature(a): a for a in keepers}
assert len(originals) == len(keepers), 'Ambiguous original actor transform'
labels = {}
for a in copied:
 source = originals[signature(a)]
 label = source.get_actor_label()
 labels[a] = label
 if before[label]['route'] is not None:
  route = a.get_editor_property('Route')
  assert len(route) == len(before[label]['route'])
  assert all((v-u.Vector(*p)).length() < .001 for v,p in zip(route,before[label]['route'])), label
assert u.EditorLevelUtils.remove_level_from_world(original)
for actor, label in labels.items(): actor.set_actor_label(label)
assert u.GameplayStatics.get_streaming_level(world, '/Game/UnifiedWarden/LaFontaine') is None, 'Recovery level must not enter the release'
actors = editor.get_all_level_actors()
assert sum(a.get_class().get_name() == 'QuebecParkResident' for a in actors) == 14
assert sum(a.get_class().get_name() == 'QuebecCar' for a in actors) == 9
assert sum(a.get_class().get_name() == 'QuebecPedestrian' for a in actors) == 12
assert sum(a.get_class().get_name() == 'QuebecVegetation' for a in actors) == 1
assert sum(a.get_class().get_name() == 'QuebecParkInstances' for a in actors) == 0
assert levels.save_current_level()
report = {'passed': True, 'source_commit': 'eddc54c', 'baked_plateau_actors': 2679,
          'merged_actors': len(actors), 'restored_warden_actors': before,
          'retained_gameplay': 'Warden campaign, handling, crew, traffic graph and native classes',
          'environment': 'exact baked Plateau actor layer; old Warden environment omitted'}
(ROOT/'Saved/Tests/UnifiedMapMerge.json').write_text(json.dumps(report, indent=2))
u.log('UNIFIED_MAP_MERGE_OK')
