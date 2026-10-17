"""Add three reviewed decorative meshes in a fresh offline LaFontaine editor.

Author with -NullRHI -NordMontrealEastBackup=<original-extension-backup>
-NordMontrealEastDetailsBackup=<fresh-Saved/Recovery-directory>. Relaunch with
the same Details backup and -NordMontrealEastDetailsVerify for saved readback.
No old asset import, material edit, collision change or visual acceptance.
"""
import json
import math
from pathlib import Path
import shlex
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import apply_montreal_east_extension as extension
import prepare_montreal_east_details as plan

MAP, MAP_FILE = extension.MAP, extension.MAP_FILE
EXPECTED_CONTENT_FILES = 6847
SIDECARS = ('.uasset', '.uexp', '.ubulk')


def offline(u, root):
    assert Path(u.Paths.project_dir()).resolve() == root, 'Wrong Unreal project'
    assert '-nullrhi' in [a.lower() for a in shlex.split(u.SystemLibrary.get_command_line())], 'Use a fresh -NullRHI process'
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'PIE must be stopped'
    assert u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world().get_path_name() == MAP, 'Load only saved LaFontaine'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Refuse unsaved map changes'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Refuse unsaved asset changes'


def source_hashes(root, report):
    paths = [*report['source_hashes'], 'Scripts/prepare_montreal_east_details.py',
             'Scripts/apply_montreal_east_details.py', 'Scripts/apply_montreal_east_extension.py',
             'Scripts/montreal_east_extension.py', 'Scripts/verify_plateau_context.py',
             str(plan.DATA/'details.json'), str(plan.DATA/'source-subset.osm.xml'),
             *(str(plan.DATA/p) for p in report['geometry_files'])]
    return {p: plan.sha(root/p) for p in paths}


def preserved_content(before, after, map_files):
    """Permit only the sealed map sidecars and three exact new package roots."""
    assert set(before) <= set(after), 'An existing Content file was removed'
    assert set(map_files) <= set(before) and str(MAP_FILE) in map_files
    assert all(after[p] == h for p, h in before.items() if p not in map_files), 'An existing non-map Content file changed'
    allowed = {str(Path(p).with_suffix(s)) for p in package_files() for s in SIDECARS}
    added = set(after)-set(before)
    assert set(package_files()) <= added <= allowed, 'Unexpected new Content inventory'
    return sorted(added)


def package_files():
    return ['Content/Plateau/EastDetails/SM_'+name+'.uasset' for name in plan.MATERIALS]


def exact_actor_delta(before, after, new_paths):
    assert len(new_paths) == 3 and len(set(new_paths.values())) == 3
    assert set(after)-set(before) == set(new_paths.values()), 'Unexpected new actor identity'
    assert set(before) <= set(after) and all(after[p] == row for p, row in before.items()), 'An existing actor semantic changed'
    assert {after[path]['label'] for path in new_paths.values()} == {plan.PREFIX+n for n in plan.MATERIALS}


def preflight(u, root, backup, extension_backup):
    root, backup = Path(root).resolve(), Path(backup).resolve()
    offline(u, root)
    assert (root/'Saved/Recovery').resolve() in backup.parents and not backup.exists(), 'Use a fresh backup inside Saved/Recovery'
    assert (root/MAP_FILE).is_file(), 'Missing saved LaFontaine package'
    assert not any((root/'Content/__ExternalActors__/Maps/LaFontaine').rglob('*.uasset')), 'External actors require a separate backup plan'
    source_mesh, report = plan.load(root)
    assert report['candidate_window_cards'] == 42 and report['triangles'] == 2604 and tuple(report['materials']) == plan.MATERIALS
    assert report['native_contract']['new_packages'] == package_files()
    required = ('EditorActorSubsystem', 'LevelEditorSubsystem', 'UnrealEditorSubsystem', 'StaticMeshActor',
                'ActorComponent', 'SceneComponent', 'PrimitiveComponent', 'StaticMeshComponent', 'InstancedStaticMeshComponent',
                'TextRenderComponent', 'AssetImportTask', 'FbxImportUI', 'StaticMeshEditorSubsystem',
                'MaterialInterface', 'StaticMesh', 'Vector', 'Rotator', 'TriangleID', 'AssetToolsHelpers',
                'MaterialEditingLibrary', 'MaterialUsage', 'NaniteFallbackTarget', 'CollisionEnabled')
    assert all(getattr(u, name, None) is not None for name in required), 'Missing required Unreal API'
    assert hasattr(u.NaniteFallbackTarget, 'PERCENT_TRIANGLES') and hasattr(u.CollisionEnabled, 'NO_COLLISION'), 'Missing required Unreal enum value'
    assert u.get_editor_subsystem(u.LevelEditorSubsystem) and u.get_editor_subsystem(u.StaticMeshEditorSubsystem) and u.AssetToolsHelpers.get_asset_tools()
    assets = u.EditorAssetLibrary
    assert not assets.does_directory_exist(plan.ASSETS), 'Details destination already exists'
    assert not any(assets.does_asset_exist(plan.ASSETS+'/SM_'+n) for n in plan.MATERIALS), 'Details package already exists'
    assert not any((root/Path(p).with_suffix(s)).exists() for p in package_files() for s in SIDECARS), 'Details package file already exists'
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    assert not any(a.get_actor_label().startswith(plan.PREFIX) for a in actors), 'Details actors already exist'
    materials = {name: assets.load_asset(report['native_contract']['materials'][name]) for name in plan.MATERIALS}
    assert all(isinstance(m, u.MaterialInterface) and extension.ref(m) == report['native_contract']['materials'][name]
               for name, m in materials.items()), 'Missing or incorrect existing material'
    assert all(u.MaterialEditingLibrary.has_material_usage(m, u.MaterialUsage.MATUSAGE_NANITE) for m in materials.values()), 'Existing material lacks Nanite usage; do not edit it'
    # Validate the current 54 additions before a new actor can be excluded from
    # the canonical extension check. Later assets have separate preservation epochs.
    extension.verify(u, root, extension_backup, compare_content=False)
    before = extension.snapshot(u, actors)
    content = extension.content_hashes(root)
    assert len(content) == EXPECTED_CONTENT_FILES, 'Current Content inventory changed; review the authoring baseline'
    return source_mesh, report, materials, before, content


def import_mesh(u, root, name, material):
    task = u.AssetImportTask()
    task.filename = str(root/plan.DATA/'Geometry'/(name+'.obj'))
    task.destination_path, task.destination_name = plan.ASSETS, 'SM_'+name
    task.automated, task.save, task.replace_existing = True, False, False
    options = u.FbxImportUI()
    options.import_mesh, options.import_materials, options.import_textures = True, False, False
    options.import_as_skeletal = False
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False
    task.options = options
    u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    path = plan.ASSETS+'/SM_'+name+'.SM_'+name
    assert list(task.imported_object_paths) == [path], 'Unexpected imported object'
    mesh = u.EditorAssetLibrary.load_asset(path)
    assert isinstance(mesh, u.StaticMesh) and extension.ref(mesh) == path
    assert len(mesh.get_editor_property('static_materials')) == 1, 'Expected one material slot'
    mesh.set_material(0, material)
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    build = subsystem.get_lod_build_settings(mesh, 0)
    build.set_editor_property('max_lumen_mesh_cards', 64)
    build.set_editor_property('generate_distance_field_as_if_two_sided', False)
    subsystem.set_lod_build_settings(mesh, 0, build)
    settings = mesh.get_editor_property('nanite_settings')
    settings.set_editor_property('enabled', True)
    settings.set_editor_property('fallback_target', u.NaniteFallbackTarget.PERCENT_TRIANGLES)
    settings.set_editor_property('fallback_percent_triangles', 1.)
    settings.set_editor_property('fallback_relative_error', 0.)
    subsystem.set_nanite_settings(mesh, settings, True)
    assert u.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
    return mesh


def glass_normals(triangles, windows):
    """Read the saved card winding in UE's left-handed mesh-description order."""
    counts, dots = [0]*len(windows), []
    for points in triangles:
        matches = []
        for index, window in enumerate(windows):
            origin = window['glass_vertices_cm'][0]
            n, tangent = window['outward_xy'], window['tangent_xy']
            local = [(sum((p[i]-origin[i])*tangent[i] for i in (0, 1)),
                      sum((p[i]-origin[i])*n[i] for i in (0, 1)), p[2]-origin[2]) for p in points]
            if all(-.02 <= x <= 100.02 and abs(out) <= .02 and -.02 <= z <= 150.02 for x, out, z in local):
                matches.append(index)
        assert len(matches) == 1, 'Saved Glass triangle does not belong to exactly one source pane'
        index = matches[0]
        a, b = [[points[k][i]-points[0][i] for i in range(3)] for k in (2, 1)]
        cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
        length = math.sqrt(sum(v*v for v in cross))
        assert length > 1e-6, 'Degenerate saved Glass triangle'
        dot = sum(cross[i]*windows[index]['outward_xy'][i] for i in (0, 1))/length
        assert dot > .999, 'Saved Glass card faces inward'
        counts[index] += 1; dots.append(dot)
    assert len(windows) == 42 and counts == [2]*42, 'Missing or repeated saved Glass pane triangles'
    return {'outward_triangles': len(triangles), 'source_panes': len(windows), 'minimum_normal_dot': min(dots)}


def native_readback(u, root, source_mesh, report, before, new_paths):
    from verify_plateau_context import _source_geometry
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    after = extension.snapshot(u, actors)
    exact_actor_delta(before, after, new_paths)
    by_path = {a.get_path_name(): a for a in actors}
    checks = []
    for name in plan.MATERIALS:
        actor = by_path[new_paths[name]]
        assert isinstance(actor, u.StaticMeshActor) and actor.get_actor_label() == plan.PREFIX+name
        c = actor.static_mesh_component; mesh = c.static_mesh
        assert extension.ref(mesh) == report['materials'][name]['asset']
        assert extension.vec(actor.get_actor_location()) == [0., 0., 0.] and extension.rot(actor.get_actor_rotation()) == [0., 0., 0.]
        assert extension.vec(actor.get_actor_scale3d()) == [1., 1., 1.] and c.get_attach_parent() is None
        assert c.is_visible() and not actor.get_editor_property('hidden')
        assert str(c.get_collision_profile_name()) == 'NoCollision' and c.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert not actor.get_actor_enable_collision()
        assert all(not c.get_editor_property(p) for p in ('cast_shadow', 'cast_hidden_shadow', 'affect_distance_field_lighting', 'affect_dynamic_indirect_lighting'))
        material = report['native_contract']['materials'][name]
        assert c.get_num_materials() == 1 and extension.ref(c.get_material(0)) == material
        slots = mesh.get_editor_property('static_materials')
        assert len(slots) == 1 and extension.ref(slots[0].get_editor_property('material_interface')) == material
        assert u.MaterialEditingLibrary.has_material_usage(c.get_material(0), u.MaterialUsage.MATUSAGE_NANITE)
        nanite = mesh.get_editor_property('nanite_settings')
        assert nanite.get_editor_property('enabled') and nanite.get_editor_property('fallback_target') == u.NaniteFallbackTarget.PERCENT_TRIANGLES
        assert nanite.get_editor_property('fallback_percent_triangles') == 1. and nanite.get_editor_property('fallback_relative_error') == 0.
        build = u.get_editor_subsystem(u.StaticMeshEditorSubsystem).get_lod_build_settings(mesh, 0)
        assert build.get_editor_property('max_lumen_mesh_cards') == 64 and not build.get_editor_property('generate_distance_field_as_if_two_sided')
        bounds, tolerance = _source_geometry(u, mesh, source_mesh.groups[name], report['materials'][name], name)
        normal_check = None
        if name == 'Glass':
            description = mesh.get_static_mesh_description(0)
            triangles = []
            for index in range(description.get_triangle_count()):
                instances = description.get_triangle_vertex_instances(u.TriangleID(id_value=index))
                triangles.append([extension.vec(description.get_vertex_position(description.get_vertex_instance_vertex(instance))) for instance in instances])
            normal_check = glass_normals(triangles, report['windows'])
        checks.append({'name': name, 'actor': actor.get_path_name(), 'mesh': extension.ref(mesh),
                       'triangles': report['materials'][name]['triangles'], 'bounds_cm': bounds,
                       'source_vertex_tolerance_cm': tolerance, 'material': material,
                       'collision': 'NoCollision', 'cast_shadow': False,
                       'affect_distance_field_lighting': False, 'affect_dynamic_indirect_lighting': False,
                       'saved_card_winding': normal_check})
    return checks


def apply(u, root, backup, extension_backup):
    root, backup = Path(root).resolve(), Path(backup).resolve()
    source_mesh, report, materials, before, content = preflight(u, root, backup, extension_backup)
    sources = source_hashes(root, report)
    map_files = [str(MAP_FILE.with_suffix(s)) for s in ('.umap', '.uexp', '.ubulk') if (root/MAP_FILE.with_suffix(s)).is_file()]
    backup.mkdir(parents=True, exist_ok=False)
    for p in map_files:
        target = backup/p; target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root/p, target); assert plan.sha(target) == content[p]
    for name, data in (('original-actors.json', before), ('original-content.json', content)):
        (backup/name).write_text(json.dumps(data, indent=2)+'\n')
    manifest = {p: plan.sha(backup/p) for p in ['original-actors.json', 'original-content.json', *map_files]}
    (backup/'backup-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    receipt = {'passed': False, 'map': MAP, 'backup': str(backup.relative_to(root)),
               'backup_manifest_sha256': plan.sha(backup/'backup-manifest.json'), 'map_package_files': map_files,
               'source_hashes': sources, 'original_content_count': len(content), 'original_actor_count': len(before),
               'new_actors': {}, 'native_visual_acceptance': False, 'limits': report['limits']}
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    try:
        for name in plan.MATERIALS:
            mesh = import_mesh(u, root, name, materials[name])
            actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector(0., 0., 0.), u.Rotator())
            assert actor
            actor.set_actor_label(plan.PREFIX+name); actor.set_folder_path('Plateau/East details')
            actor.set_actor_enable_collision(False); actor.set_actor_hidden_in_game(False)
            c = actor.static_mesh_component
            c.set_static_mesh(mesh); c.set_material(0, materials[name]); c.set_visibility(True)
            c.set_collision_profile_name('NoCollision'); c.set_cast_shadow(False)
            c.set_editor_property('cast_hidden_shadow', False)
            c.set_affect_distance_field_lighting(False); c.set_affect_dynamic_indirect_lighting(False)
            receipt['new_actors'][name] = actor.get_path_name()
        receipt['readback'] = native_readback(u, root, source_mesh, report, before, receipt['new_actors'])
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        receipt['readback'] = native_readback(u, root, source_mesh, report, before, receipt['new_actors'])
        after = extension.content_hashes(root)
        additions = preserved_content(content, after, map_files)
        assert source_hashes(root, report) == sources, 'Reviewed source changed during authoring'
        receipt.update(passed=True, new_content_files={p: after[p] for p in additions},
                       map_after_sha256={p: after[p] for p in map_files},
                       original_non_map_content_preserved=len(content)-len(map_files))
    except Exception as error:
        receipt['error'] = repr(error); raise
    finally:
        (backup/'apply-report.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


def verify(u, root, backup, compare_content=True):
    """Fresh verification compares the Content epoch; later canonical checks may skip it.

    Actor semantics, source geometry and exact saved map/Details package hashes
    remain mandatory in both modes. The sealed author/fresh receipts preserve the
    original epoch when later independent features add Content.
    """
    root, backup = Path(root).resolve(), Path(backup).resolve()
    offline(u, root)
    assert (root/'Saved/Recovery').resolve() in backup.parents and backup.is_dir()
    source_mesh, report = plan.load(root)
    receipt = json.loads((backup/'apply-report.json').read_text())
    assert receipt['passed'] and receipt['map'] == MAP and receipt['backup'] == str(backup.relative_to(root))
    extension.verify_backup(backup, receipt)
    assert receipt['source_hashes'] == source_hashes(root, report), 'Applied Details source changed'
    before = json.loads((backup/'original-actors.json').read_text())
    content = json.loads((backup/'original-content.json').read_text())
    assert len(content) == receipt['original_content_count'] == EXPECTED_CONTENT_FILES and len(before) == receipt['original_actor_count']
    checks = native_readback(u, root, source_mesh, report, before, receipt['new_actors'])
    after = extension.content_hashes(root)
    additions = sorted(receipt['new_content_files'])
    if compare_content:
        assert preserved_content(content, after, receipt['map_package_files']) == additions
    assert {p for p in after if p.startswith('Content/Plateau/EastDetails/')} == set(additions), 'Unexpected saved Details file inventory'
    assert {p: after[p] for p in additions} == receipt['new_content_files'], 'Saved Details package bytes changed'
    assert {p: after[p] for p in receipt['map_package_files']} == receipt['map_after_sha256'], 'Saved LaFontaine package changed since Details authoring'
    return {'passed': True, 'new_actor_count': 3, 'new_actors': receipt['new_actors'],
            'new_content_files': additions, 'checks': checks, 'triangles': report['triangles'],
            'original_actor_count_preserved': len(before), 'content_epoch_compared': compare_content,
            'original_non_map_content_preserved': len(content)-len(receipt['map_package_files']) if compare_content else None,
            'source_hashes': receipt['source_hashes'], 'native_visual_acceptance': False, 'limits': report['limits']}


def main():
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    args = shlex.split(u.SystemLibrary.get_command_line())
    values = [a.split('=', 1)[1] for a in args if a.startswith('-NordMontrealEastDetailsBackup=')]
    assert len(values) == 1, 'Pass one -NordMontrealEastDetailsBackup path'
    if '-NordMontrealEastDetailsVerify' in args:
        result = verify(u, root, values[0])
    else:
        original = [a.split('=', 1)[1] for a in args if a.startswith('-NordMontrealEastBackup=')]
        assert len(original) == 1, 'Pass the preserved -NordMontrealEastBackup path'
        result = apply(u, root, values[0], original[0])
    u.log('MONTREAL_EAST_DETAILS_OK '+json.dumps(result))


if __name__ == '__main__': main()
