"""Import only the verified own-rig Tripo pilot in a fresh NullRHI editor."""
import hashlib
import json
from pathlib import Path

FOLDER = '/Game/ParkComic/CrewGraphicNovelTripo/Resident9'
SCALE = 1.82


def source_plan(root):
    root = Path(root).resolve()
    data = root / 'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/derived'
    surface = json.loads((root / 'Verification/TripoNative/Surface/Surface.json').read_text())
    material = json.loads((root / 'Verification/TripoNative/Surface/MaterialVerification.json').read_text())
    gait = json.loads((root / 'Verification/TripoNative/Locomotion/Locomotion.json').read_text())
    independent = json.loads((root / 'Verification/TripoNative/Locomotion/Independent.json').read_text())
    natural = json.loads((root / 'Verification/TripoPilot/NaturalPose/AuthoringSummary.json').read_text())
    checked = json.loads((root / 'Verification/TripoPilot/NaturalPose/IndependentVerification-semantic.json').read_text())
    timing = json.loads((root / 'Verification/TripoNative/Timing/Timing.json').read_text())
    assert all(r['passed'] for r in (surface, material, gait, independent, checked, timing))
    assert surface['rig']['armature_object'] == 'Armature' and surface['rig']['bones'] == 61
    assert checked['all_retained_inputs_unchanged'] and gait['retained_inputs_unchanged'] and independent['retained_inputs_unchanged']
    paths = {'Body': data / 'native-ready/body.fbx', 'Idle': data / 'native-ready/idle.fbx',
             'Jump': data / 'native-ready/jump.fbx',
             'Walk': data / 'native-ready/walk.fbx', 'Run': data / 'native-ready/run.fbx'}
    hashes = {'Body': surface['output']['sha256']}
    for kind in ('Walk', 'Run'):
        hashes[kind] = gait['clips'][kind.lower()]['output']['sha256']
        assert hashes[kind] == independent['clips'][kind.lower()]['sha256']
    for kind, name in [('Idle', 'relaxed-idle'), ('Jump', 'natural-jump')]:
        assert natural['clips'][name]['sha256'] == checked['clips'][name]['sha256']
        assert timing['inputs'][kind.lower()]['sha256'] == natural['clips'][name]['sha256']
        hashes[kind] = timing['clips'][kind.lower()]['output']['sha256']
    for name, row in surface['textures'].items():
        paths[name] = root / row['path']
        hashes[name] = row['sha256']
    for name, path in paths.items():
        assert path.resolve().is_relative_to(root / 'Data') and path.is_file() and not path.is_symlink(), path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == hashes[name], ('Unverified import source', name)
    return paths, hashes


def main():
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    args = set(u.SystemLibrary.get_command_line().lower().split())
    assert '-nullrhi' in args, 'Material authoring requires a fresh NullRHI editor'
    assert not u.EditorLevelLibrary.get_pie_worlds(False), 'Stop PIE before importing'
    assert not (root / 'Content/ParkComic/CrewGraphicNovelTripo').exists(), 'Preserve/recover any prior owned import before rerunning'
    paths, hashes = source_plan(root)
    import_assets(u, root, paths, hashes, FOLDER, SCALE,
                  root / 'Saved/Tests/TripoNative/Import.json', '/Game/ParkComic/Crew/SM_Plunger')
    u.SystemLibrary.quit_editor()


def import_assets(u, root, paths, hashes, folder, scale, report_path, prop_path):
    """Shared own-rig import; every call creates a new isolated resident folder."""
    import sys
    assert '-nullrhi' in set(u.SystemLibrary.get_command_line().lower().split())
    assert not u.EditorLevelLibrary.get_pie_worlds(False)
    assert not report_path.exists(), 'Preserve the previous import report'
    assert not (root / 'Content' / folder.removeprefix('/Game/')).exists(), 'Preserve the previous resident import'
    sys.path.insert(0, str(root / 'Scripts'))
    import plateau_atmosphere
    tools = u.AssetToolsHelpers.get_asset_tools()
    assets = u.EditorAssetLibrary
    library = u.MaterialEditingLibrary
    u.SystemLibrary.execute_console_command(None, 'Interchange.FeatureFlags.Import.FBX 0')

    def load_file(path, name, options=None):
        assert not assets.does_asset_exist(folder + '/' + name)
        task = u.AssetImportTask()
        task.filename, task.destination_path, task.destination_name = str(path), folder, name
        task.automated, task.replace_existing, task.save = True, False, True
        if options:
            task.options, task.factory = options, u.FbxFactory()
        tools.import_asset_tasks([task])
        asset = u.load_asset(folder + '/' + name)
        assert asset, (name, list(task.imported_object_paths))
        return asset

    options = u.FbxImportUI()
    options.automated_import_should_detect_type = False
    options.mesh_type_to_import = u.FBXImportType.FBXIT_SKELETAL_MESH
    options.import_as_skeletal, options.import_mesh, options.import_animations = True, True, False
    options.import_materials, options.import_textures, options.create_physics_asset = False, False, False
    mesh_data = options.skeletal_mesh_import_data
    mesh_data.import_uniform_scale = scale
    mesh_data.force_front_x_axis = True
    mesh_data.convert_scene, mesh_data.convert_scene_unit = True, True
    mesh_data.normal_import_method = u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS
    mesh_data.normal_generation_method = u.FBXNormalGenerationMethod.MIKK_T_SPACE
    mesh_data.compute_weighted_normals = False
    mesh_data.set_editor_property('update_skeleton_reference_pose', False)
    mesh = load_file(paths['Body'], 'SK_Body', options)
    assert isinstance(mesh, u.SkeletalMesh)
    build = u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh, 0)
    for key, value in {'recompute_normals': False, 'recompute_tangents': True, 'use_mikk_t_space': True,
                       'compute_weighted_normals': False, 'use_full_precision_u_vs': True,
                       'use_high_precision_tangent_basis': True}.items():
        build.set_editor_property(key, value)
    u.SkeletalMeshEditorSubsystem.set_lod_build_settings(mesh, 0, build)
    skeleton = mesh.get_editor_property('skeleton')
    assert skeleton and skeleton.get_path_name().startswith(folder + '/')
    pose = u.AnimPoseExtensions.get_reference_pose(skeleton)
    bones = set(map(str, u.AnimPoseExtensions.get_bone_names(pose)))
    assert {'root', 'pelvis', 'hand_r', 'head', 'middle_03_r'} <= bones and len(bones) in (61, 62)
    height = mesh.get_bounds().box_extent.z * 2
    assert abs(height - 182.) < .1, ('Wrong native body scale', height)
    feet_z = mesh.get_bounds().origin.z - mesh.get_bounds().box_extent.z
    assert abs(feet_z) < .1, ('Wrong native foot grounding', feet_z)

    material = tools.create_asset('M_Crew', folder, u.Material, u.MaterialFactoryNew())
    samples = {}
    textures = {}
    for kind in ('base_color', 'normal', 'metallic_roughness'):
        texture = load_file(paths[kind], 'T_' + kind)
        texture.set_editor_property('srgb', kind == 'base_color')
        texture.set_editor_property('compression_settings', u.TextureCompressionSettings.TC_BC7 if kind == 'base_color'
                                    else u.TextureCompressionSettings.TC_NORMALMAP if kind == 'normal'
                                    else u.TextureCompressionSettings.TC_MASKS)
        if kind == 'base_color':
            texture.set_editor_property('lod_group', u.TextureGroup.TEXTUREGROUP_CHARACTER)
            # shortcut: retain source atlas detail until its tiny UV islands have padded mips.
            texture.set_editor_property('mip_gen_settings', u.TextureMipGenSettings.TMGS_NO_MIPMAPS)
            texture.set_editor_property('never_stream', True)
        elif kind == 'normal':
            texture.set_editor_property('flip_green_channel', True)
        assets.save_loaded_asset(texture)
        sample = library.create_material_expression(material, u.MaterialExpressionTextureSample)
        sample.texture = texture
        if kind != 'base_color':
            sample.sampler_type = u.MaterialSamplerType.SAMPLERTYPE_NORMAL if kind == 'normal' else u.MaterialSamplerType.SAMPLERTYPE_MASKS
        samples[kind], textures[kind] = sample, texture
    for name, output, prop in [('base_color', 'RGB', u.MaterialProperty.MP_BASE_COLOR),
                               ('normal', 'RGB', u.MaterialProperty.MP_NORMAL),
                               ('metallic_roughness', 'G', u.MaterialProperty.MP_ROUGHNESS),
                               ('metallic_roughness', 'B', u.MaterialProperty.MP_METALLIC)]:
        assert library.connect_material_property(samples[name], output, prop)
    fill = library.create_material_expression(material, u.MaterialExpressionMultiply)
    fill.set_editor_property('const_b', 250.)
    assert library.connect_material_expressions(samples['base_color'], 'RGB', fill, 'A')
    assert library.connect_material_property(fill, '', u.MaterialProperty.MP_EMISSIVE_COLOR)
    assert assets.does_asset_exist(plateau_atmosphere.COLLECTION)
    plateau_atmosphere.exposure(u, material, assets.load_asset(plateau_atmosphere.COLLECTION))
    library.set_base_material_usage(material, u.MaterialUsage.MATUSAGE_SKELETAL_MESH, True)
    library.recompile_material(material)
    assets.save_loaded_asset(material, only_if_is_dirty=False)
    slots = mesh.get_editor_property('materials')
    assert len(slots) == 1
    slot = slots[0]
    slot.material_interface = material
    slots[0] = slot
    mesh.set_editor_property('materials', slots)
    clips = {}
    for kind in ('Idle', 'Walk', 'Run', 'Jump'):
        options = u.FbxImportUI()
        options.automated_import_should_detect_type = False
        options.mesh_type_to_import = u.FBXImportType.FBXIT_ANIMATION
        options.import_as_skeletal, options.import_mesh, options.import_animations = True, False, True
        options.import_materials, options.import_textures, options.skeleton = False, False, skeleton
        anim_data = options.anim_sequence_import_data
        anim_data.import_uniform_scale = scale
        anim_data.force_front_x_axis = True
        anim_data.convert_scene, anim_data.convert_scene_unit = True, True
        anim_data.set_editor_property('use_default_sample_rate', True)
        clip = load_file(paths[kind], 'A_' + kind, options)
        assert isinstance(clip, u.AnimSequence) and clip.get_editor_property('skeleton') == skeleton
        clip.set_editor_property('force_root_lock', kind != 'Jump')
        clip.set_editor_property('enable_root_motion', False)
        assets.save_loaded_asset(clip, only_if_is_dirty=False)
        clips[kind] = clip
    factory = u.BlendSpaceFactory1D()
    factory.set_editor_property('target_skeleton', skeleton)
    space = tools.create_asset('BS_Locomotion', folder, u.BlendSpace1D, factory)
    assert u.QuebecCrewAnimInstance.configure_crew_blend_space(space, clips['Idle'], clips['Walk'], clips['Run'])
    prop = u.load_asset(prop_path)
    assert isinstance(prop, u.StaticMesh) and u.QuebecCrewAnimInstance.configure_tripo_grip(mesh, prop)
    for asset in (skeleton, mesh, space):
        assert assets.save_loaded_asset(asset, only_if_is_dirty=False)
    assets.save_directory(folder, only_if_is_dirty=False, recursive=True)
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == hashes[name] for name, path in paths.items())
    report = {'passed': True, 'folder': folder, 'import_scale': scale, 'height_cm': height,
              'feet_z_cm': feet_z, 'bones': sorted(bones), 'sources': {name: {'path': str(path.relative_to(root)), 'sha256': hashes[name]} for name, path in paths.items()},
              'mesh': mesh.get_path_name(), 'skeleton': skeleton.get_path_name(),
              'clips': {name: {'path': clip.get_path_name(), 'seconds': clip.get_play_length()} for name, clip in clips.items()},
              'material': material.get_path_name(), 'textures': {name: t.get_path_name() for name, t in textures.items()},
              'socket': 'TripoGrip / hand_r; own native reference and existing measured prop bounds',
              'scope': 'Fresh saved native authoring only; reload, motion, shading and grip appearance require separate checks'}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    u.log('NORD_TRIPO_IMPORT_OK ' + str(report_path))
    return report


if __name__ == '__main__':
    main()
