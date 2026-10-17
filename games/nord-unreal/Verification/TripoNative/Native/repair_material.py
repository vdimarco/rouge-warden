"""Bounded recovery of the own mesh's sole material slot after fresh-load rejection."""
from pathlib import Path
import sys
import unreal as u

root = Path(u.Paths.project_dir()).resolve()
sys.path.insert(0, str(root / 'Scripts'))
from import_tripo_pilot import FOLDER, source_plan

assert '-nullrhi' in u.SystemLibrary.get_command_line().lower().split()
assert not u.EditorLevelLibrary.get_pie_worlds(False)
source_plan(root)
mesh = u.load_asset(FOLDER + '/SK_Body')
material = u.load_asset(FOLDER + '/M_Crew')
assert isinstance(mesh, u.SkeletalMesh) and isinstance(material, u.Material)
slots = mesh.get_editor_property('materials')
assert len(slots) == 1
u.log('NORD_TRIPO_REPAIR_BEFORE ' + str(slots[0].material_interface))
slot = slots[0]
slot.material_interface = material
slots[0] = slot
mesh.set_editor_property('materials', slots)
assert u.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
assert mesh.get_editor_property('materials')[0].material_interface == material
u.log('NORD_TRIPO_MATERIAL_REPAIR_OK')
u.SystemLibrary.quit_editor()
