"""Fresh NullRHI-only additive extension; root owns actual Unreal execution.

Load /Game/Maps/LaFontaine and pass -NordMontrealEastBackup=/absolute/fresh/path
under this project's Saved/Recovery. Refuses stale sources, dirty maps, old
attempt assets and unexpected actors BEFORE package or map mutation. Never calls
an old-map generator, changes materials or destroys an original actor.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import shlex
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import montreal_east_extension as plan

MAP = '/Game/Maps/LaFontaine.LaFontaine'
MAP_FILE = Path('Content/Maps/LaFontaine.umap')


def vec(v): return [float(v.x), float(v.y), float(v.z)]
def rot(v): return [float(v.pitch), float(v.yaw), float(v.roll)]
def ref(o): return o.get_path_name() if o else None


def actor_state(u, actor):
    root = actor.get_editor_property('root_component')
    row = {'class': actor.get_class().get_path_name(), 'label': actor.get_actor_label(),
           'location': vec(actor.get_actor_location()), 'rotation': rot(actor.get_actor_rotation()),
           'scale': vec(actor.get_actor_scale3d()), 'hidden': bool(actor.get_editor_property('hidden')),
           'folder': str(actor.get_folder_path()), 'collision': bool(actor.get_actor_enable_collision()),
           'tick_enabled': bool(actor.is_actor_tick_enabled()), 'root_component': ref(root), 'components': {}}
    for c in actor.get_components_by_class(u.ActorComponent):
        state = {'class': c.get_class().get_path_name(), 'tick_enabled': bool(c.is_component_tick_enabled()), 'active': bool(c.is_active())}
        if isinstance(c, u.SceneComponent):
            state.update(relative_location=vec(c.get_editor_property('relative_location')),
                         relative_rotation=rot(c.get_editor_property('relative_rotation')),
                         relative_scale=vec(c.get_editor_property('relative_scale3d')),
                         parent=ref(c.get_attach_parent()), visible=bool(c.is_visible()))
        if isinstance(c, u.PrimitiveComponent):
            state.update(profile=str(c.get_collision_profile_name()), collision=str(c.get_collision_enabled()),
                         materials=[ref(c.get_material(i)) for i in range(c.get_num_materials())],
                         **{p: bool(c.get_editor_property(p)) for p in ('cast_shadow', 'cast_hidden_shadow',
                            'affect_distance_field_lighting', 'affect_dynamic_indirect_lighting')})
        if isinstance(c, u.StaticMeshComponent): state['mesh'] = ref(c.static_mesh)
        if isinstance(c, u.InstancedStaticMeshComponent):
            state['instances'] = []
            for i in range(c.get_instance_count()):
                t = c.get_instance_transform(i, False)
                state['instances'].append([vec(t.translation), [t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w], vec(t.scale3d)])
        if isinstance(c, u.TextRenderComponent):
            state['text'] = str(c.get_editor_property('text')); state['world_size'] = float(c.get_editor_property('world_size'))
        row['components'][c.get_path_name()] = state
    name = actor.get_class().get_name()
    if name == 'QuebecParkResident':
        row['resident'] = {'style': actor.get_editor_property('Style'), 'phase': actor.get_editor_property('Phase'),
                           'route': [vec(p) for p in actor.get_editor_property('Route')]}
    if name == 'QuebecCar': row['paint_style'] = actor.get_editor_property('PaintStyle')
    return row


def snapshot(u, actors):
    return {a.get_path_name(): actor_state(u, a) for a in sorted(actors, key=lambda a: a.get_path_name())}


def assert_originals(before, after, east_path, old_primary):
    """Compare captured original semantics, allowing exactly the requested edits."""
    assert set(before) <= set(after), 'An original actor was removed'
    expected = copy.deepcopy(before)
    east = expected[east_path]; east['location'][0] += plan.EXPANSION_CM
    east['components'][east['root_component']]['relative_location'][0] += plan.EXPANSION_CM
    for path, primary in old_primary.items():
        expected[path]['hidden'] = True; expected[path]['components'][primary]['visible'] = False
    for path, row in expected.items():
        assert row == after[path], ('Original actor semantics changed outside allowance', path)
    return True


def content_hashes(root):
    return {str(p.relative_to(root)): plan.sha(p) for p in sorted((root/'Content').rglob('*')) if p.is_file()}


def preflight(u, root, backup):
    root, backup = Path(root).resolve(), Path(backup).resolve()
    command = [s.lower() for s in shlex.split(u.SystemLibrary.get_command_line())]
    assert '-nullrhi' in command, 'Use a fresh -NullRHI authoring process'
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'PIE must be stopped'
    world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    assert world.get_path_name() == MAP, 'Open only the persistent LaFontaine map'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Refuse unsaved map changes'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Refuse unsaved asset changes'
    recovery = (root/'Saved/Recovery').resolve()
    assert root in recovery.parents, 'Recovery directory must stay inside this project'
    assert recovery in backup.parents and not backup.exists(), 'Backup must be a fresh directory inside Saved/Recovery'
    assert (root/MAP_FILE).is_file(), 'Missing existing map package'
    report = plan.load(root)
    required = ('EditorActorSubsystem', 'LevelEditorSubsystem', 'UnrealEditorSubsystem', 'StaticMeshActor', 'TextRenderActor', 'TextRenderComponent', 'ActorComponent', 'SceneComponent',
                'PrimitiveComponent', 'StaticMeshComponent', 'InstancedStaticMeshComponent', 'AssetImportTask',
                'FbxImportUI', 'StaticMeshEditorSubsystem', 'MaterialInterface', 'StaticMesh', 'Vector', 'Rotator',
                'AssetToolsHelpers', 'MaterialEditingLibrary', 'MaterialUsage', 'NaniteFallbackTarget',
                'CollisionEnabled', 'Color', 'HorizTextAligment', 'VerticalTextAligment')
    assert all(getattr(u, name, None) is not None for name in required), 'Required Unreal class missing'
    assert u.get_editor_subsystem(u.LevelEditorSubsystem) and u.get_editor_subsystem(u.StaticMeshEditorSubsystem) and u.AssetToolsHelpers.get_asset_tools(), 'Required authoring subsystem missing'
    _ = (u.NaniteFallbackTarget.PERCENT_TRIANGLES, u.HorizTextAligment.EHTA_CENTER, u.VerticalTextAligment.EVRTA_TEXT_CENTER, u.MaterialUsage.MATUSAGE_NANITE)
    assets = u.EditorAssetLibrary
    assert not assets.does_directory_exist(plan.ASSETS), 'Earlier extension assets exist; preserve/restore them first'
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    actors = editor.get_all_level_actors()
    assert not any(a.get_actor_label().startswith(plan.PREFIX) for a in actors), 'Extension already exists in map'
    by_label = {}
    for a in actors: by_label.setdefault(a.get_actor_label(), []).append(a)
    originals = by_label.get('District edge', [])
    assert len(originals) == 4 and len(by_label.get('District ground', [])) == 1, 'Unexpected original floor/boundary inventory'
    b = report['original_bounds_xy']; cy = (b[1]+b[3])/2; cx = (b[0]+b[2])/2
    expected = [(b[0], cy, 100., 70., b[3]-b[1], 200.), (b[2], cy, 100., 70., b[3]-b[1], 200.),
                (cx, b[1], 100., b[2]-b[0], 70., 200.), (cx, b[3], 100., b[2]-b[0], 70., 200.)]
    matched = {}
    for a in originals:
        c = a.static_mesh_component; position = vec(a.get_actor_location()); scale = vec(a.get_actor_scale3d())
        index = next((i for i, p in enumerate(expected) if math.dist(position, p[:3]) < .1), None)
        assert index is not None and index not in matched, 'Original boundary transform changed'
        assert math.dist(scale, [v/100 for v in expected[index][3:]]) < .002
        assert all(abs(v) < .001 for v in rot(a.get_actor_rotation()))
        assert ref(c.static_mesh) == '/Engine/BasicShapes/Cube.Cube'
        assert str(c.get_collision_profile_name()) == 'BlockAll' and c.get_collision_enabled() == u.CollisionEnabled.QUERY_AND_PHYSICS
        assert a.get_actor_enable_collision(), 'Original boundary actor collision is disabled'
        assert bool(a.get_editor_property('hidden')) and not c.is_visible(), 'Original wall must remain hidden'
        assert c.get_attach_parent() is None, 'Original boundary is unexpectedly attached'
        matched[index] = a
    ground = by_label['District ground'][0]
    assert math.dist(vec(ground.get_actor_location()), [cx, cy, -100.]) < .1
    assert math.dist(vec(ground.get_actor_scale3d()), [(b[2]-b[0])/100, (b[3]-b[1])/100, 2.]) < .002
    assert str(ground.static_mesh_component.get_collision_profile_name()) == 'BlockAll'
    assert ground.static_mesh_component.get_collision_enabled() == u.CollisionEnabled.QUERY_AND_PHYSICS and ground.get_actor_enable_collision()
    assert ref(ground.static_mesh_component.static_mesh) == '/Engine/BasicShapes/Cube.Cube'
    old_primary = {}
    for label in report['old_closure_labels_to_hide']:
        assert len(by_label.get(label, [])) == 1, ('Missing/duplicate old closure actor', label)
        actor = by_label[label][0]
        c = actor.get_component_by_class(u.TextRenderComponent) if 'sign ' in label else actor.static_mesh_component
        assert c and c.is_visible() and not actor.get_editor_property('hidden')
        assert str(c.get_collision_profile_name()) == 'NoCollision' and c.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert not c.get_editor_property('cast_hidden_shadow'), 'Hidden old closure would retain a shadow'
        assert ref(actor.get_editor_property('root_component')) == c.get_path_name(), 'Unexpected old closure root component'
        old_primary[actor.get_path_name()] = c.get_path_name()
    # Every retained visual/shell must already exist; never reconstruct context.
    context = json.loads((root/'Data/Plateau/ContextGeometry/context.json').read_text())
    for name, m in context['materials'].items():
        label = 'Plateau context '+name
        assert len(by_label.get(label, [])) == 1, ('Missing retained context', label)
        c = by_label[label][0].static_mesh_component
        assert ref(c.static_mesh) == '/Game/Plateau/Context/SM_'+name+'.SM_'+name
        assert str(c.get_collision_profile_name()) == ('BlockAll' if m['collision'] else 'NoCollision')
        assert c.get_collision_enabled() == (u.CollisionEnabled.QUERY_AND_PHYSICS if m['collision'] else u.CollisionEnabled.NO_COLLISION)
        assert not m['collision'] or by_label[label][0].get_actor_enable_collision(), 'Retained context shell collision is disabled'
        assert c.is_visible() and not by_label[label][0].get_editor_property('hidden')
    materials = {name: assets.load_asset('/Game/Plateau/Materials/M_'+name) for name in {m['material'] for m in report['materials'].values()}}
    assert all(isinstance(m, u.MaterialInterface) for m in materials.values()), 'Required existing closure material missing'
    assert all(u.MaterialEditingLibrary.has_material_usage(m, u.MaterialUsage.MATUSAGE_NANITE) for m in materials.values()), 'Existing material lacks Nanite usage; do not mutate old materials here'
    cube = assets.load_asset('/Engine/BasicShapes/Cube')
    assert isinstance(cube, u.StaticMesh)
    before = snapshot(u, actors)
    assert before[matched[1].get_path_name()]['root_component'] == matched[1].static_mesh_component.get_path_name()
    return report, actors, matched[1], old_primary, materials, cube, before


def _import(u, root, name, metadata):
    assets = u.EditorAssetLibrary; task = u.AssetImportTask()
    task.filename = str(root/plan.DATA/'Geometry'/(name+'.obj')); task.destination_path = plan.ASSETS
    task.destination_name = 'SM_'+name; task.automated = True; task.save = False; task.replace_existing = False
    options = u.FbxImportUI(); options.import_mesh = True; options.import_materials = False; options.import_textures = False
    options.import_as_skeletal = False; options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False; task.options = options
    u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    assert len(task.imported_object_paths) == 1
    mesh = assets.load_asset(task.imported_object_paths[0]); assert isinstance(mesh, u.StaticMesh)
    assert ref(mesh) == plan.ASSETS+'/SM_'+name+'.SM_'+name
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    settings = subsystem.get_lod_build_settings(mesh, 0)
    settings.set_editor_property('max_lumen_mesh_cards', 64); settings.set_editor_property('generate_distance_field_as_if_two_sided', True)
    subsystem.set_lod_build_settings(mesh, 0, settings)
    settings = mesh.get_editor_property('nanite_settings'); settings.set_editor_property('enabled', True)
    settings.set_editor_property('fallback_target', u.NaniteFallbackTarget.PERCENT_TRIANGLES)
    settings.set_editor_property('fallback_percent_triangles', 1.); settings.set_editor_property('fallback_relative_error', 0.)
    subsystem.set_nanite_settings(mesh, settings, True)
    assert u.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
    return mesh


def verify_backup(backup, receipt=None):
    backup = Path(backup)
    manifest = json.loads((backup/'backup-manifest.json').read_text())
    expected = {'original-actors.json', 'original-content.json'} | {str(MAP_FILE.with_suffix(s)) for s in ('.umap', '.uexp', '.ubulk') if (backup/MAP_FILE.with_suffix(s)).is_file()}
    assert set(manifest) == expected and str(MAP_FILE) in manifest, 'Incomplete original backup inventory'
    assert all(plan.sha(backup/p) == h for p, h in manifest.items()), 'Immutable original backup/snapshot changed'
    if receipt:
        assert plan.sha(backup/'backup-manifest.json') == receipt['backup_manifest_sha256'], 'Original backup manifest changed'
    return manifest


def apply(u, root, backup):
    root, backup = Path(root).resolve(), Path(backup).resolve()
    report, actors, east, old_primary, materials, cube, before = preflight(u, root, backup)
    # Read-only preflight is complete. Snapshot the original disk map before any
    # asset import, actor spawn, visibility change, location change or level save.
    original_content = content_hashes(root)
    map_files = [str(MAP_FILE.with_suffix(s)) for s in ('.umap', '.uexp', '.ubulk') if (root/MAP_FILE.with_suffix(s)).exists()]
    assert not any((root/'Content/__ExternalActors__/Maps/LaFontaine').rglob('*.uasset')), 'External actor storage needs a separate backup plan'
    backup.mkdir(parents=True, exist_ok=False); target = backup/MAP_FILE
    target.parent.mkdir(parents=True)
    for name in map_files:
        shutil.copy2(root/name, backup/name); assert plan.sha(backup/name) == original_content[name]
    (backup/'original-actors.json').write_text(json.dumps(before, indent=2)+'\n')
    (backup/'original-content.json').write_text(json.dumps(original_content, indent=2)+'\n')
    manifest = {p: plan.sha(backup/p) for p in ['original-actors.json', 'original-content.json', *map_files]}
    (backup/'backup-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    receipt = {'passed': False, 'backup': str(backup.relative_to(root)), 'map_before_sha256': plan.sha(target),
               'east_actor': east.get_path_name(), 'old_primary_components': old_primary,
               'backup_manifest_sha256': plan.sha(backup/'backup-manifest.json'), 'map_package_files': map_files, 'source_hashes': report['source_hashes'], 'original_actor_count': len(before),
               'snapshot_scope': 'Actor identity/class/label/transform/folder/hidden/collision/tick; component identity/relative transforms/visibility/tick/active/materials/mesh/collision/shadow flags/instanced transforms; resident routes/style/phase and car paint.',
               'limits': report['limits']}
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    def spawn(cls, label, location=(0, 0, 0)):
        actor = editor.spawn_actor_from_class(cls, u.Vector(*location)); assert actor
        actor.set_actor_label(label); actor.set_folder_path('Plateau/East extension'); return actor
    try:
        for name, metadata in report['materials'].items():
            mesh = _import(u, root, name, metadata); actor = spawn(u.StaticMeshActor, plan.PREFIX+name)
            c = actor.static_mesh_component; c.set_static_mesh(mesh); c.set_material(0, materials[metadata['material']])
            c.set_collision_profile_name('NoCollision'); c.set_cast_shadow(True)
        for closure in report['closures']:
            sign = closure['sign']; actor = spawn(u.TextRenderActor, plan.PREFIX+'sign '+closure['source'], sign['position'])
            actor.set_actor_rotation(u.Rotator(yaw=sign['yaw']), False); c = actor.get_component_by_class(u.TextRenderComponent)
            c.set_text(sign['text']); c.set_world_size(sign['size']); c.set_text_render_color(u.Color(r=6, g=6, b=6, a=255))
            c.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER); c.set_vertical_alignment(u.VerticalTextAligment.EVRTA_TEXT_CENTER)
            c.set_collision_profile_name('NoCollision'); c.set_cast_shadow(False)
        for volume in [report['hidden_collision']['floor'], *report['hidden_collision']['bounds']]:
            actor = spawn(u.StaticMeshActor, volume['label'], volume['location_cm'])
            actor.set_actor_scale3d(u.Vector(*(v/100 for v in volume['size_cm'])))
            c = actor.static_mesh_component; c.set_static_mesh(cube); c.set_collision_profile_name('BlockAll')
            c.set_visibility(False); c.set_cast_shadow(False); c.set_affect_distance_field_lighting(False)
            c.set_affect_dynamic_indirect_lighting(False); actor.set_actor_hidden_in_game(True)
        by_path = {a.get_path_name(): a for a in actors}
        for path in old_primary:
            actor = by_path[path]; c = actor.get_component_by_class(u.TextRenderComponent) if 'sign ' in actor.get_actor_label() else actor.static_mesh_component
            c.set_visibility(False); actor.set_actor_hidden_in_game(True)
        p = east.get_actor_location(); east.set_actor_location(u.Vector(p.x+plan.EXPANSION_CM, p.y, p.z), False, False)
        assert_originals(before, snapshot(u, editor.get_all_level_actors()), receipt['east_actor'], old_primary)
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        # Fresh-process verification repeats these semantic and source checks.
        receipt['readback'] = verify(u, root, backup, compare_content=False)
        after_content = content_hashes(root)
        assert all(after_content.get(path) == digest for path, digest in original_content.items() if path not in map_files), 'An original package other than LaFontaine changed'
        additions = set(after_content)-set(original_content)
        assert all(p.startswith('Content/Plateau/EastExtension/') for p in additions), 'Unexpected new Content destination'
        receipt.update(passed=True, original_packages_preserved=len(original_content)-len(map_files),
                       new_package_files=sorted(additions), map_after_sha256=plan.sha(root/MAP_FILE))
    except Exception as error:
        receipt['error'] = repr(error); raise
    finally:
        (backup/'apply-report.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


def verify(u, root, backup, compare_content=True):
    """Read-only fresh-load check; root must separately prove actual traversal."""
    root, backup = Path(root).resolve(), Path(backup).resolve(); report = plan.load(root)
    assert (root/'Saved/Recovery').resolve() in backup.parents and backup.is_dir(), 'Use the preserved original extension backup'
    assert u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world().get_path_name() == MAP
    before = json.loads((backup/'original-actors.json').read_text())
    original_content = json.loads((backup/'original-content.json').read_text())
    assert plan.sha(backup/MAP_FILE) == original_content[str(MAP_FILE)], 'Original map backup changed'
    receipt = json.loads((backup/'apply-report.json').read_text()) if (backup/'apply-report.json').exists() else None
    verify_backup(backup, receipt)
    # During initial apply the receipt has not been persisted yet; identify the
    # original east actor from the exact snapshot transform, not duplicate labels.
    old_east = report['original_bounds_xy'][2]
    east = next(p for p, a in before.items() if a['label']=='District edge' and abs(a['location'][0]-old_east)<.1)
    old_primary = {p: a['root_component'] for p, a in before.items() if a['label'] in report['old_closure_labels_to_hide']}
    if receipt: assert receipt['east_actor'] == east and receipt['old_primary_components'] == old_primary
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors(); after = snapshot(u, actors)
    assert_originals(before, after, east, old_primary)
    labels = {a.get_actor_label(): a for a in actors}
    wanted = {plan.PREFIX+n for n in report['materials']} | {plan.PREFIX+'sign '+c['source'] for c in report['closures']}
    wanted |= {v['label'] for v in [report['hidden_collision']['floor'], *report['hidden_collision']['bounds']]}
    added = [a for a in actors if a.get_path_name() not in before]
    assert len(added) == len(wanted) and {a.get_actor_label() for a in added} == wanted, 'Unexpected extension actor inventory'
    for v in [report['hidden_collision']['floor'], *report['hidden_collision']['bounds']]:
        a = labels[v['label']]; c = a.static_mesh_component
        assert math.dist(vec(a.get_actor_location()), v['location_cm']) < .1
        assert math.dist(vec(a.get_actor_scale3d()), [x/100 for x in v['size_cm']]) < .002
        assert all(abs(x)<.001 for x in rot(a.get_actor_rotation()))
        assert ref(c.static_mesh) == '/Engine/BasicShapes/Cube.Cube' and str(c.get_collision_profile_name()) == 'BlockAll'
        assert c.get_collision_enabled() == u.CollisionEnabled.QUERY_AND_PHYSICS and a.get_actor_enable_collision()
        assert not c.get_editor_property('affect_distance_field_lighting') and not c.get_editor_property('affect_dynamic_indirect_lighting')
        assert a.get_editor_property('hidden') and not c.is_visible() and not c.get_editor_property('cast_shadow')
    from verify_plateau_context import _source_geometry
    source_mesh, _ = plan.build(root)
    for name, metadata in report['materials'].items():
        a = labels[plan.PREFIX+name]; c = a.static_mesh_component; mesh = c.static_mesh
        assert ref(mesh) == plan.ASSETS+'/SM_'+name+'.SM_'+name
        assert c.is_visible() and not a.get_editor_property('hidden') and c.get_editor_property('cast_shadow')
        settings = mesh.get_editor_property('nanite_settings')
        assert settings.get_editor_property('enabled') and settings.get_editor_property('fallback_target') == u.NaniteFallbackTarget.PERCENT_TRIANGLES
        assert abs(settings.get_editor_property('fallback_percent_triangles')-1.) < 1e-6 and abs(settings.get_editor_property('fallback_relative_error')) < 1e-6
        build = u.get_editor_subsystem(u.StaticMeshEditorSubsystem).get_lod_build_settings(mesh, 0)
        assert build.get_editor_property('max_lumen_mesh_cards') == 64 and build.get_editor_property('generate_distance_field_as_if_two_sided')
        assert str(c.get_collision_profile_name()) == 'NoCollision' and c.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert ref(c.get_material(0)) == '/Game/Plateau/Materials/M_'+metadata['material']+'.M_'+metadata['material']
        assert math.dist(vec(a.get_actor_location()), [0, 0, 0]) < .1
        assert math.dist(vec(a.get_actor_scale3d()), [1, 1, 1]) < .001 and max(abs(v) for v in rot(a.get_actor_rotation())) < .001
        _source_geometry(u, mesh, source_mesh.groups[name], metadata, name)
    for closure in report['closures']:
        sign = closure['sign']; a = labels[plan.PREFIX+'sign '+closure['source']]; c = a.get_component_by_class(u.TextRenderComponent)
        assert str(c.get_editor_property('text')) == sign['text'] and abs(c.get_editor_property('world_size')-sign['size']) < .001
        color = c.get_editor_property('text_render_color')
        assert [color.r, color.g, color.b, color.a] == [6, 6, 6, 255]
        assert math.dist(vec(a.get_actor_location()), sign['position']) < .1 and abs(a.get_actor_rotation().yaw-sign['yaw']) < .001
        assert c.is_visible() and not a.get_editor_property('hidden') and not c.get_editor_property('cast_shadow')
        assert str(c.get_collision_profile_name()) == 'NoCollision' and c.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    if compare_content:
        actual = content_hashes(root)
        assert all(actual.get(p) == h for p, h in original_content.items() if p not in [str(MAP_FILE.with_suffix(s)) for s in ('.umap', '.uexp', '.ubulk')]), 'Protected original Content changed'
        assert all(p.startswith('Content/Plateau/EastExtension/') for p in set(actual)-set(original_content)), 'Unexpected Content addition'
    return {'passed': True, 'original_content_epoch_compared': compare_content, 'original_actor_semantics_preserved_except_declared_changes': True,
            'original_boundary_actors_retained': 4, 'moved_original_east_actor': east,
            'hidden_old_closure_actors': len(old_primary), 'new_actor_count': len(added),
            'new_collision_cubes': 1+len(report['hidden_collision']['bounds']), 'road_segments': report['road_segments'], 'closure_sites': len(report['closures']),
            'traversal_jump_containment_rendered_acceptance': False}


def main():
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    args = shlex.split(u.SystemLibrary.get_command_line())
    value = [a.split('=', 1)[1] for a in args if a.startswith('-NordMontrealEastBackup=')]
    assert len(value) == 1, 'Pass one fresh -NordMontrealEastBackup=absolute-path'
    result = verify(u, root, value[0]) if '-NordMontrealEastVerify' in args else apply(u, root, value[0])
    u.log('MONTREAL_EAST_EXTENSION_OK '+json.dumps(result))


if __name__ == '__main__': main()
