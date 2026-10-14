"""Offline, bounded collision-proxy import; original car art and maps are untouched."""
import json
from pathlib import Path
import sys
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
sys.path.insert(0, str(ROOT/'Scripts'))
from plateau_mesh import Mesh

assert '-nullrhi' in u.SystemLibrary.get_command_line().lower(), 'Use a fresh -NullRHI editor for asset authoring'
out = ROOT/'Saved/CurbParking-20261013'
out.mkdir(exist_ok=True)
editor = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
assets = u.EditorAssetLibrary
report = []
for profile in range(3):
    name = f'CarCollision{profile}'
    proxy = Mesh()
    for part in ('Body', 'Cabin', 'Roof'):
        vertices = []
        for line in (ROOT/f'Data/SeventiesCars/Geometry/Car70{part}{profile}.obj').read_text().splitlines():
            if line.startswith('v '):
                x, y, z = map(float, line.split()[1:])
                vertices.append((x, -y, z))
            elif line.startswith('f '):
                points = [vertices[int(item.split('/')[0])-1] for item in line.split()[1:]]
                assert len(points) == 3
                proxy.face(name, points[::-1])
    proxy.write(out)
    task = u.AssetImportTask()
    task.filename = str(out/f'{name}.obj')
    task.destination_path = '/Game/ParkComic'
    task.destination_name = 'SM_'+name
    task.automated = task.replace_existing = task.save = True
    options = u.FbxImportUI()
    options.import_mesh = True
    options.import_materials = options.import_textures = options.import_as_skeletal = False
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False
    task.options = options
    u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    mesh = assets.load_asset(f'/Game/ParkComic/SM_{name}')
    assert isinstance(mesh, u.StaticMesh), task.imported_object_paths
    assert editor.set_convex_decomposition_collisions(mesh, 8, 24, 100000)
    mesh.get_editor_property('body_setup').set_editor_property('collision_trace_flag', u.CollisionTraceFlag.CTF_USE_SIMPLE_AS_COMPLEX)
    count = editor.get_convex_collision_count(mesh)
    assert 2 <= count <= 8, count
    assert assets.save_loaded_asset(mesh)
    report.append({'asset': mesh.get_path_name(), 'convex_hulls': count})
(out/'collision-assets.json').write_text(json.dumps(report, indent=2)+'\n')
print('NORD_CAR_COLLISION_ASSETS', report)
