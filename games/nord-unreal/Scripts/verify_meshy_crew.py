"""Fresh-process checks for saved skeletal meshes, materials and animation dependencies."""
import json
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir()).resolve();report=[]
for style in range(3,11):
    folder=f'/Game/ParkComic/Crew/Resident{style}'
    mesh=u.load_asset(folder+'/SK_Body');assert isinstance(mesh,u.SkeletalMesh),style
    skeleton=mesh.get_editor_property('skeleton');assert skeleton and u.EditorAssetLibrary.does_asset_exist(skeleton.get_path_name())
    bounds=mesh.get_bounds();assert 165<bounds.box_extent.z*2<205,(style,bounds)
    expected_build={'recompute_normals':False,'recompute_tangents':True,'use_mikk_t_space':True,
                       'compute_weighted_normals':False,'use_full_precision_u_vs':True,'use_high_precision_tangent_basis':True}
    build=u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh,0)
    build_flags={key:bool(build.get_editor_property(key)) for key in expected_build}
    assert build_flags==expected_build,(style,'crew normals/UV build settings',build_flags)
    slots=mesh.get_editor_property('materials');assert slots
    for slot in slots:
        material=slot.material_interface;assert material and material.get_path_name().startswith(folder+'/M_Crew')
        node=u.MaterialEditingLibrary.get_material_property_input_node(material,u.MaterialProperty.MP_BASE_COLOR)
        assert node and node.get_editor_property('texture') and node.get_editor_property('texture').get_path_name().startswith(folder+'/T_base_color')
        texture=node.get_editor_property('texture')
        assert texture.get_editor_property('compression_settings')==u.TextureCompressionSettings.TC_BC7
        assert texture.get_editor_property('mip_gen_settings')==u.TextureMipGenSettings.TMGS_NO_MIPMAPS,(style,'atlas mip bleed regression')
        assert texture.get_editor_property('never_stream') and texture.get_editor_property('lod_bias')==0,(style,'full painted atlas must stay resident')
        assert material.get_editor_property('shading_model')==u.MaterialShadingModel.MSM_DEFAULT_LIT,(style,'painted atlas fix must retain dynamic lighting')
        normal=u.MaterialEditingLibrary.get_material_property_input_node(material,u.MaterialProperty.MP_NORMAL)
        assert isinstance(normal,u.MaterialExpressionLinearInterpolate) and abs(normal.get_editor_property('const_alpha')-.65)<.001
    for name in ('A_Walk','A_Idle','A_Run','A_Jump'):
        clip=u.load_asset(folder+'/'+name)
        assert isinstance(clip,u.AnimSequence) and clip.get_editor_property('skeleton')==skeleton and clip.get_play_length()>.1
        assert not clip.get_editor_property('enable_root_motion')
        if name=='A_Jump':
            assert abs(clip.get_play_length()-1.2)<.05 and not clip.get_editor_property('force_root_lock')
            first=u.AnimationLibrary.get_bone_pose_for_time(clip,'LeftLeg',0,False)
            apex=u.AnimationLibrary.get_bone_pose_for_time(clip,'LeftLeg',.47,False)
            assert first.rotation.angular_distance(apex.rotation)>.8, 'Jump has no knee tuck'
    report.append({'style':style,'height_cm':round(bounds.box_extent.z*2,1),'material_slots':len(slots),'mesh_build_flags':build_flags,'base_color':{'mipmaps':False,'never_stream':True,'lod_bias':0,'compression':'BC7','shading':'DEFAULT_LIT'},'saved_skeleton':skeleton.get_path_name()})
for prop in ('Plunger','PVCTube'):
    assert isinstance(u.load_asset('/Game/ParkComic/Crew/SM_'+prop),u.StaticMesh)
(root/'Verification/MeshyAssets.json').write_text(json.dumps({'passed':True,'characters':report},indent=2)+'\n')
u.log('NORD_MESHY_ASSETS_OK '+str(len(report)))
