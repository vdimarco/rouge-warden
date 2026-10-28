"""Fresh-load saved isolated Tripo assets; read-only NullRHI verification."""
import hashlib
import json
from pathlib import Path


def verify_assets(u, root, paths, hashes, folder, scale, report_path):
    assert '-nullrhi' in u.SystemLibrary.get_command_line().lower().split()
    assert not report_path.exists(), 'Preserve the previous fresh-load report'
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    mesh = u.load_asset(folder + '/SK_Body')
    assert isinstance(mesh, u.SkeletalMesh)
    skeleton = mesh.get_editor_property('skeleton')
    assert skeleton and skeleton.get_path_name().startswith(folder + '/')
    pose = u.AnimPoseExtensions.get_reference_pose(skeleton)
    names = list(map(str, u.AnimPoseExtensions.get_bone_names(pose)))
    assert len(names) in (61, 62) and {'root', 'pelvis', 'hand_r', 'head', 'middle_03_r'} <= set(names)
    height = mesh.get_bounds().box_extent.z * 2
    assert abs(height - 182.) < .1
    feet_z = mesh.get_bounds().origin.z - mesh.get_bounds().box_extent.z
    assert abs(feet_z) < .1, ('Body must be grounded in its own imported frame', feet_z)

    def saved_source(asset, expected):
        data = asset.get_editor_property('asset_import_data')
        assert Path(data.get_first_filename()).resolve() == expected.resolve(), asset.get_path_name()
        assert abs(data.get_editor_property('import_uniform_scale') - scale) < 1e-5
        return str(expected.relative_to(root))

    saved_source(mesh, paths['Body'])
    build = u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh, 0)
    flags = {key: bool(build.get_editor_property(key)) for key in ('recompute_normals', 'recompute_tangents', 'use_mikk_t_space',
                                                                'compute_weighted_normals', 'use_full_precision_u_vs', 'use_high_precision_tangent_basis')}
    assert flags == {'recompute_normals': False, 'recompute_tangents': True, 'use_mikk_t_space': True,
                     'compute_weighted_normals': False, 'use_full_precision_u_vs': True, 'use_high_precision_tangent_basis': True}
    assert mesh.get_editor_property('asset_import_data').get_editor_property('normal_import_method') == u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS
    clips = {}
    for kind, seconds in [('Idle', 4.), ('Walk', 31 / 30), ('Run', 19 / 30), ('Jump', 1.2)]:
        clip = u.load_asset(folder + '/A_' + kind)
        assert isinstance(clip, u.AnimSequence) and clip.get_editor_property('skeleton') == skeleton
        assert abs(clip.get_play_length() - seconds) < .001, (kind, clip.get_play_length())
        assert not clip.get_editor_property('enable_root_motion') and clip.get_editor_property('force_root_lock') == (kind != 'Jump')
        saved_source(clip, paths[kind])
        clips[kind] = {'path': clip.get_path_name(), 'seconds': clip.get_play_length()}
    space = u.load_asset(folder + '/BS_Locomotion')
    assert isinstance(space, u.BlendSpace1D) and space.get_editor_property('skeleton') == skeleton
    samples = space.get_editor_property('sample_data')
    assert len(samples) == 3
    for sample, kind in zip(samples, ('Idle', 'Walk', 'Run')):
        assert sample.get_editor_property('animation').get_path_name() == clips[kind]['path']

    material = u.load_asset(folder + '/M_Crew')
    assert isinstance(material, u.Material)
    slots = mesh.get_editor_property('materials')
    assert len(slots) == 1 and slots[0].material_interface == material
    connections = {}
    for name, output, prop in [('base_color', 'RGB', u.MaterialProperty.MP_BASE_COLOR), ('normal', 'RGB', u.MaterialProperty.MP_NORMAL),
                               ('metallic_roughness', 'G', u.MaterialProperty.MP_ROUGHNESS), ('metallic_roughness', 'B', u.MaterialProperty.MP_METALLIC)]:
        node = library.get_material_property_input_node(material, prop)
        assert isinstance(node, u.MaterialExpressionTextureSample)
        texture = node.get_editor_property('texture')
        assert texture.get_path_name() == folder + '/T_' + name + '.T_' + name
        assert Path(texture.get_editor_property('asset_import_data').get_first_filename()).resolve() == paths[name].resolve()
        assert texture.get_editor_property('srgb') == (name == 'base_color')
        selected = str(library.get_material_property_input_node_output_name(material, prop))
        assert selected == output, (name, output, selected)
        if name == 'normal':
            assert texture.get_editor_property('flip_green_channel')
            assert texture.get_editor_property('compression_settings') == u.TextureCompressionSettings.TC_NORMALMAP
        elif name == 'metallic_roughness':
            assert texture.get_editor_property('compression_settings') == u.TextureCompressionSettings.TC_MASKS
        connections[str(prop)] = {'texture': texture.get_path_name(), 'channel': selected}
    socket = u.find_object(skeleton, 'TripoGrip')
    assert isinstance(socket, u.SkeletalMeshSocket)
    assert str(socket.get_editor_property('socket_name')) == 'TripoGrip'
    assert str(socket.get_editor_property('bone_name')) == 'hand_r'
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == hashes[name] for name, path in paths.items())
    report = {'passed': True, 'scope': 'Fresh saved asset/source/material/socket reload; no rendered art or functional grasp acceptance',
              'mesh': mesh.get_path_name(), 'skeleton': skeleton.get_path_name(), 'bones': names, 'height_cm': height,
              'feet_z_cm': feet_z, 'shared_import_scale': scale, 'build_flags': flags, 'clips': clips, 'material_connections': connections,
              'socket_parent': 'hand_r', 'source_hashes': hashes}
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    u.log('NORD_TRIPO_FRESH_LOAD_OK')
    return report


def main():
    import unreal as u
    import sys
    root = Path(u.Paths.project_dir()).resolve()
    sys.path.insert(0, str(root / 'Scripts'))
    from import_tripo_pilot import FOLDER, SCALE, source_plan
    paths, hashes = source_plan(root)
    verify_assets(u, root, paths, hashes, FOLDER, SCALE, root / 'Saved/Tests/TripoNative/FreshLoad.json')
    u.SystemLibrary.quit_editor()


if __name__ == '__main__':
    main()
