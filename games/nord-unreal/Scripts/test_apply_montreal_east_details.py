"""CPU-only rejection tests for the additive native Details authoring contract."""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace as NS
from unittest.mock import patch

import apply_montreal_east_details as author


class Object:
    def __init__(self, path): self.path = path
    def get_path_name(self): return self.path


class Material(Object): pass


def reject(fn):
    try: fn()
    except AssertionError: return
    raise AssertionError('Unsafe Details operation accepted')


def fixture(root, report):
    events = []
    labels = ['Original mission actor', 'Plateau east extension collision floor']
    actors = [NS(get_actor_label=lambda label=label: label) for label in labels]
    materials = {path: Material(path) for path in report['native_contract']['materials'].values()}
    editor, world_editor, level, mesh_editor = object(), object(), object(), object()
    subsystems = {
        editor: NS(get_all_level_actors=lambda: actors),
        world_editor: NS(get_editor_world=lambda: Object(author.MAP)),
        level: NS(save_current_level=lambda: events.append('save')),
        mesh_editor: NS(),
    }
    classes = {name: type(name, (), {}) for name in ('StaticMeshActor', 'ActorComponent', 'SceneComponent', 'PrimitiveComponent',
               'StaticMeshComponent', 'InstancedStaticMeshComponent', 'TextRenderComponent', 'AssetImportTask', 'FbxImportUI',
               'StaticMesh', 'Vector', 'Rotator', 'TriangleID')}
    u = NS(**classes, EditorActorSubsystem=editor, UnrealEditorSubsystem=world_editor,
           LevelEditorSubsystem=level, StaticMeshEditorSubsystem=mesh_editor, MaterialInterface=Material,
           Paths=NS(project_dir=lambda: str(root)), SystemLibrary=NS(get_command_line=lambda: '-NullRHI'),
           EditorLevelLibrary=NS(get_pie_worlds=lambda unused: []),
           EditorLoadingAndSavingUtils=NS(get_dirty_map_packages=lambda: [], get_dirty_content_packages=lambda: []),
           EditorAssetLibrary=NS(does_directory_exist=lambda path: False, does_asset_exist=lambda path: False,
                                 load_asset=lambda path: materials.get(path)),
           MaterialEditingLibrary=NS(has_material_usage=lambda material, usage: True),
           MaterialUsage=NS(MATUSAGE_NANITE=1), NaniteFallbackTarget=NS(PERCENT_TRIANGLES=1),
           CollisionEnabled=NS(NO_COLLISION=0), get_editor_subsystem=lambda cls: subsystems[cls],
           AssetToolsHelpers=NS(get_asset_tools=lambda: NS(import_asset_tasks=lambda tasks: events.append('import'))))
    return u, events, actors, materials, subsystems


def preflight_tests(root, source_mesh, report):
    map_file = root/author.MAP_FILE
    map_file.parent.mkdir(parents=True); map_file.write_bytes(b'original saved map')
    before = {'old': {'label': 'Original mission actor', 'hidden': False}}
    inventory = {f'Content/protected{i}.uasset': str(i) for i in range(author.EXPECTED_CONTENT_FILES-1)}
    inventory[str(author.MAP_FILE)] = author.plan.sha(map_file)
    baseline_files = sorted(p.relative_to(root) for p in root.rglob('*') if p.is_file())
    canonical_calls = []
    def canonical(*args, **kwargs):
        canonical_calls.append((args[2], kwargs)); return {'passed': True, 'new_actor_count': 54}
    with patch.object(author.plan, 'load', return_value=(source_mesh, report)), \
         patch.object(author.extension, 'snapshot', return_value=before), \
         patch.object(author.extension, 'content_hashes', return_value=inventory), \
         patch.object(author.extension, 'verify', side_effect=canonical):
        u, events, _, _, _ = fixture(root, report)
        result = author.preflight(u, root, root/'Saved/Recovery/details', root/'Saved/Recovery/old-extension')
        assert result[3] == before and result[4] == inventory and not events
        assert canonical_calls == [(root/'Saved/Recovery/old-extension', {'compare_content': False})]
        assert sorted(p.relative_to(root) for p in root.rglob('*') if p.is_file()) == baseline_files
        for defect in ('rendered', 'pie', 'wrong_map', 'wrong_project', 'dirty_map', 'dirty_asset', 'outside_backup',
                       'stale_backup', 'destination', 'asset', 'file', 'label', 'material', 'material_identity',
                       'nanite_usage', 'api', 'enum', 'inventory', 'source', 'canonical'):
            uu, actions, actors, materials, subsystems = fixture(root, report)
            backup = root/'Saved/Recovery'/('details-'+defect)
            patches, cleanup = [], None
            if defect == 'rendered': uu.SystemLibrary.get_command_line = lambda: '-vulkan'
            elif defect == 'pie': uu.EditorLevelLibrary.get_pie_worlds = lambda unused: [object()]
            elif defect == 'wrong_map': subsystems[uu.UnrealEditorSubsystem].get_editor_world = lambda: Object('/Game/Maps/CollegeBathurst.CollegeBathurst')
            elif defect == 'wrong_project': uu.Paths.project_dir = lambda: str(root/'other')
            elif defect == 'dirty_map': uu.EditorLoadingAndSavingUtils.get_dirty_map_packages = lambda: [object()]
            elif defect == 'dirty_asset': uu.EditorLoadingAndSavingUtils.get_dirty_content_packages = lambda: [object()]
            elif defect == 'outside_backup': backup = root/'Content/unsafe'
            elif defect == 'stale_backup': backup.mkdir(parents=True)
            elif defect == 'destination': uu.EditorAssetLibrary.does_directory_exist = lambda path: True
            elif defect == 'asset': uu.EditorAssetLibrary.does_asset_exist = lambda path: path.endswith('SM_Iron')
            elif defect == 'file':
                cleanup = root/author.package_files()[1]; cleanup.parent.mkdir(parents=True); cleanup.write_bytes(b'unregistered old attempt')
            elif defect == 'label': actors.append(NS(get_actor_label=lambda: author.plan.PREFIX+'unexpected'))
            elif defect == 'material': materials.pop(report['native_contract']['materials']['Trim'])
            elif defect == 'material_identity': materials[report['native_contract']['materials']['Trim']] = Material('/Game/Wrong.Wrong')
            elif defect == 'nanite_usage': uu.MaterialEditingLibrary.has_material_usage = lambda material, usage: False
            elif defect == 'api': uu.TriangleID = None
            elif defect == 'enum': uu.NaniteFallbackTarget = NS()
            elif defect == 'inventory': patches.append(patch.object(author.extension, 'content_hashes', return_value={}))
            elif defect == 'source': patches.append(patch.object(author.plan, 'load', side_effect=AssertionError('source mismatch')))
            elif defect == 'canonical': patches.append(patch.object(author.extension, 'verify', side_effect=AssertionError('old extension drift')))
            for item in patches: item.start()
            try:
                reject(lambda: author.preflight(uu, root, backup, root/'Saved/Recovery/old-extension'))
                assert not actions and not (backup/'backup-manifest.json').exists(), 'Mutation before rejected preflight'
            finally:
                for item in reversed(patches): item.stop()
                if cleanup: cleanup.unlink()
        assert not (root/'Content/unsafe').exists()


def preservation_tests():
    map_files = [str(author.MAP_FILE), str(author.MAP_FILE.with_suffix('.uexp'))]
    before = {map_files[0]: 'oldmap', map_files[1]: 'oldsidecar', 'Content/old.uasset': 'old'}
    after = {**before, map_files[0]: 'newmap', map_files[1]: 'newsidecar', **{p: 'new' for p in author.package_files()}}
    assert author.preserved_content(before, after, map_files) == sorted(author.package_files())
    for defect in ('old_bytes', 'remove', 'extra_package', 'prefix_trick', 'missing_mesh', 'undeclared_sidecar'):
        changed = copy.deepcopy(after)
        if defect == 'old_bytes': changed['Content/old.uasset'] = 'changed'
        elif defect == 'remove': del changed[map_files[1]]
        elif defect == 'extra_package': changed['Content/Plateau/EastDetails/Other.uasset'] = 'bad'
        elif defect == 'prefix_trick': changed['Content/Plateau/EastDetails/SM_Glass_backup.uasset'] = 'bad'
        elif defect == 'missing_mesh': del changed[author.package_files()[0]]
        else: changed['Content/Maps/LaFontaine.extra'] = 'bad'
        reject(lambda: author.preserved_content(before, changed, map_files))
    with_sidecar = {**after, str(Path(author.package_files()[0]).with_suffix('.ubulk')): 'declared'}
    assert len(author.preserved_content(before, with_sidecar, map_files)) == 4
    actors = {'old': {'label': 'Campaign', 'components': {'root': {'collision': 'BlockAll'}}}}
    paths = {name: 'saved.'+name for name in author.plan.MATERIALS}
    actual = {**copy.deepcopy(actors), **{p: {'label': author.plan.PREFIX+n} for n, p in paths.items()}}
    author.exact_actor_delta(actors, actual, paths)
    for defect in ('old_collision', 'remove', 'extra_actor', 'new_identity', 'wrong_label'):
        changed = copy.deepcopy(actual)
        if defect == 'old_collision': changed['old']['components']['root']['collision'] = 'NoCollision'
        elif defect == 'remove': del changed['old']
        elif defect == 'extra_actor': changed['saved.extra'] = {'label': author.plan.PREFIX+'extra'}
        elif defect == 'new_identity': changed['different.Trim'] = changed.pop(paths['Trim'])
        else: changed[paths['Glass']]['label'] = author.plan.PREFIX+'Glass2'
        reject(lambda: author.exact_actor_delta(actors, changed, paths))


def backup_test(root):
    backup = root/'Saved/Recovery/seal'; target = backup/author.MAP_FILE
    target.parent.mkdir(parents=True); target.write_bytes(b'map')
    (backup/'original-actors.json').write_text('{}')
    (backup/'original-content.json').write_text(json.dumps({str(author.MAP_FILE): author.plan.sha(target)}))
    manifest = {p: author.plan.sha(backup/p) for p in ('original-actors.json', 'original-content.json', str(author.MAP_FILE))}
    (backup/'backup-manifest.json').write_text(json.dumps(manifest))
    receipt = {'backup_manifest_sha256': author.plan.sha(backup/'backup-manifest.json')}
    author.extension.verify_backup(backup, receipt)
    target.write_bytes(b'changed'); reject(lambda: author.extension.verify_backup(backup, receipt))


def normals_test(mesh, report):
    # OBJ reverses the original face order; native coordinates restore Y, while
    # native winding remains reversed. Use float32 saved-coordinate precision.
    import struct
    f32 = lambda value: struct.unpack('f', struct.pack('f', float(f'{value:.3f}')))[0]
    triangles = [[[f32(v) for v in p] for p in (face[2], face[1], face[0])] for face in mesh.groups['Glass']]
    triangles += [[[f32(v) for v in p] for p in (face[3], face[2], face[0])] for face in mesh.groups['Glass']]
    check = author.glass_normals(triangles, report['windows'])
    assert check['outward_triangles'] == 84 and check['minimum_normal_dot'] > .999
    changed = copy.deepcopy(triangles); changed[0].reverse()
    reject(lambda: author.glass_normals(changed, report['windows']))
    reject(lambda: author.glass_normals(triangles[:-1], report['windows']))
    reject(lambda: author.glass_normals(triangles[1:]+[triangles[1]], report['windows']))
    changed = copy.deepcopy(triangles); changed[0][0][0] += 1
    reject(lambda: author.glass_normals(changed, report['windows']))


def verify_epoch_tests():
    import hashlib
    import shutil
    report = json.loads((author.plan.ROOT/author.plan.DATA/'details.json').read_text())
    source_files = [*report['source_hashes'], 'Scripts/prepare_montreal_east_details.py',
                    'Scripts/apply_montreal_east_details.py', 'Scripts/apply_montreal_east_extension.py',
                    'Scripts/montreal_east_extension.py', 'Scripts/verify_plateau_context.py',
                    str(author.plan.DATA/'details.json'), str(author.plan.DATA/'source-subset.osm.xml'),
                    *(str(author.plan.DATA/p) for p in report['geometry_files'])]
    sha_bytes = lambda data: hashlib.sha256(data).hexdigest()
    rejected = []

    def reject_verification(label, fn, message):
        try:
            fn()
        except AssertionError as error:
            assert message in str(error), (label, 'wrong rejection', str(error), message)
            rejected.append(label)
        else:
            raise AssertionError('Unsafe verification accepted: '+label)

    with tempfile.TemporaryDirectory(prefix='nord-east-details-verify-', dir='/tmp') as directory:
        root = Path(directory).resolve()
        for relative in source_files:
            target = root/relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(author.plan.ROOT/relative, target)
        backup = root/'Saved/Recovery/details-verify-fixture'
        map_files = [str(author.MAP_FILE), str(author.MAP_FILE.with_suffix('.uexp'))]
        content = {f'Content/originals/protected{i}.uasset': sha_bytes(str(i).encode())
                   for i in range(author.EXPECTED_CONTENT_FILES-len(map_files))}
        for name in map_files:
            target = backup/name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(('sealed-original:'+name).encode())
            content[name] = author.plan.sha(target)
        before = {'world.original': {'label': 'Original campaign actor', 'hidden': False,
                                    'components': {'root': {'collision': 'BlockAll', 'tick': True}}}}
        new_paths = {name: 'world.saved.'+name for name in author.plan.MATERIALS}
        actors = {**copy.deepcopy(before), **{path: {'label': author.plan.PREFIX+name} for name, path in new_paths.items()}}
        for name, value in (('original-actors.json', before), ('original-content.json', content)):
            (backup/name).write_text(json.dumps(value, indent=2)+'\n')
        manifest = {p: author.plan.sha(backup/p) for p in ('original-actors.json', 'original-content.json', *map_files)}
        (backup/'backup-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        after = {**content, **{p: sha_bytes(('new:'+p).encode()) for p in author.package_files()},
                 **{p: sha_bytes(('authored-map:'+p).encode()) for p in map_files}}
        receipt = {'passed': True, 'map': author.MAP, 'backup': str(backup.relative_to(root)),
                   'backup_manifest_sha256': author.plan.sha(backup/'backup-manifest.json'),
                   'source_hashes': author.source_hashes(root, report), 'original_content_count': len(content),
                   'original_actor_count': len(before), 'new_actors': new_paths, 'map_package_files': map_files,
                   'new_content_files': {p: after[p] for p in author.package_files()},
                   'map_after_sha256': {p: after[p] for p in map_files}}
        (backup/'apply-report.json').write_text(json.dumps(receipt, indent=2)+'\n')
        u, events, _, _, _ = fixture(root, report)
        native_calls = []

        def native_boundary(_u, _root, _source_mesh, _report, actual_before, paths):
            native_calls.append(True)
            author.exact_actor_delta(actual_before, actors, paths)
            return [{'mocked_native_boundary': True}]

        with patch.object(author.plan, 'load', return_value=(object(), report)), \
             patch.object(author, 'native_readback', side_effect=native_boundary), \
             patch.object(author.extension, 'content_hashes', side_effect=lambda unused: dict(after)):
            strict = author.verify(u, root, backup)
            assert strict['content_epoch_compared'] is True
            assert strict['original_non_map_content_preserved'] == len(content)-len(map_files)
            assert strict['new_actor_count'] == 3 and strict['new_content_files'] == sorted(author.package_files())
            canonical = author.verify(u, root, backup, compare_content=False)
            assert canonical['content_epoch_compared'] is False
            assert canonical['original_non_map_content_preserved'] is None

            # An independent Content addition is accepted only by explicit later
            # canonical verification. The omitted argument must stay strict.
            unrelated = 'Content/Audio/Music/LaterIndependentAsset.uasset'
            after[unrelated] = sha_bytes(b'later independent feature')
            reject_verification('strict-default-unrelated-addition', lambda: author.verify(u, root, backup), 'Unexpected new Content inventory')
            assert author.verify(u, root, backup, compare_content=False)['content_epoch_compared'] is False
            reject_verification('strict-default-after-canonical', lambda: author.verify(u, root, backup), 'Unexpected new Content inventory')
            protected = 'Content/originals/protected0.uasset'
            old = after[protected]; after[protected] = sha_bytes(b'changed old unrelated bytes')
            reject_verification('strict-default-old-byte-drift', lambda: author.verify(u, root, backup), 'existing non-map Content file changed')
            after[protected] = old

            # Keep the later addition in place for every false-mode rejection:
            # it must not mask drift in any of the still-required checks.
            for relative in ('Scripts/apply_montreal_east_details.py', 'Scripts/apply_montreal_east_extension.py',
                             'Scripts/montreal_east_extension.py', 'Scripts/verify_plateau_context.py',
                             str(author.plan.DATA/'details.json'), str(author.plan.DATA/'Geometry/Glass.obj')):
                path = root/relative; original = path.read_bytes(); path.write_bytes(original+b'\n# source drift\n')
                try:
                    reject_verification('canonical-pin:'+relative, lambda: author.verify(u, root, backup, compare_content=False), 'Applied Details source changed')
                finally:
                    path.write_bytes(original)
            for relative in map_files:
                original = after[relative]; after[relative] = sha_bytes(b'drift in authored map package')
                reject_verification('canonical-map:'+relative, lambda: author.verify(u, root, backup, compare_content=False), 'Saved LaFontaine package changed')
                after[relative] = original
            for relative in author.package_files():
                original = after[relative]; after[relative] = sha_bytes(b'drift in authored mesh package')
                reject_verification('canonical-asset:'+relative, lambda: author.verify(u, root, backup, compare_content=False), 'Saved Details package bytes changed')
                after[relative] = original
            extra = 'Content/Plateau/EastDetails/SM_Unexpected.uasset'
            after[extra] = sha_bytes(b'unexpected Details asset')
            reject_verification('canonical-extra-owned-inventory', lambda: author.verify(u, root, backup, compare_content=False), 'Unexpected saved Details file inventory')
            del after[extra]
            missing = author.package_files()[0]; value = after.pop(missing)
            reject_verification('canonical-missing-owned-inventory', lambda: author.verify(u, root, backup, compare_content=False), 'Unexpected saved Details file inventory')
            after[missing] = value
            actors['world.original']['components']['root']['collision'] = 'NoCollision'
            reject_verification('canonical-original-actor-drift', lambda: author.verify(u, root, backup, compare_content=False), 'existing actor semantic changed')
            actors['world.original']['components']['root']['collision'] = 'BlockAll'
            actors['world.extra'] = {'label': author.plan.PREFIX+'Extra'}
            reject_verification('canonical-extra-actor', lambda: author.verify(u, root, backup, compare_content=False), 'Unexpected new actor identity')
            del actors['world.extra']
            actors[new_paths['Glass']]['label'] = 'wrong label'
            reject_verification('canonical-new-actor-label-drift', lambda: author.verify(u, root, backup, compare_content=False), '')
            actors[new_paths['Glass']]['label'] = author.plan.PREFIX+'Glass'
            for relative in ('original-actors.json', 'original-content.json', *map_files):
                path = backup/relative; original = path.read_bytes(); path.write_bytes(original+b' ')
                try:
                    reject_verification('canonical-seal:'+relative, lambda: author.verify(u, root, backup, compare_content=False), 'Immutable original backup/snapshot changed')
                finally:
                    path.write_bytes(original)
            path = backup/'backup-manifest.json'; original = path.read_bytes(); path.write_bytes(original+b' ')
            try:
                reject_verification('canonical-manifest-seal', lambda: author.verify(u, root, backup, compare_content=False), 'Original backup manifest changed')
            finally:
                path.write_bytes(original)
            # The test's edited backup files were restored, not repinned.
            assert author.verify(u, root, backup, compare_content=False)['new_actor_count'] == 3
            del after[unrelated]
            assert author.verify(u, root, backup)['content_epoch_compared'] is True
            assert native_calls and not events, 'Verification attempted a native import/save'
    return len(rejected)



if __name__ == '__main__':
    mesh, report = author.plan.load()
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory).resolve()
        preflight_tests(root, mesh, report); backup_test(root)
    preservation_tests(); normals_test(mesh, report); assert verify_epoch_tests() == 24
    print('NORD_EAST_DETAILS_AUTHOR_CPU_OK:20 unsafe preflights rejected before mutation; exact original actor/Content preservation; three saved package roots/declared sidecars; immutable backup seal; 84 outward saved-card triangles/missing/repeated/inward/moved rejection')
