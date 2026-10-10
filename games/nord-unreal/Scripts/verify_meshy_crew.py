"""Fresh-process checks for saved crew assets; -NordNeutralCandidate checks style 9 only."""
import hashlib
import json
import math
from pathlib import Path
import runpy
import unreal as u
root=Path(u.Paths.project_dir()).resolve();report=[]
command=u.SystemLibrary.get_command_line()
candidate='-NordNeutralCandidate' in command
styles=(9,) if candidate else range(3,11)
crew_path='/Game/ParkComic/'+('CrewNeutral' if candidate else 'Crew')
names={3:'GreenCap51',4:'Memphis33',5:'BlackCap',6:'WhiteCap',7:'RedJersey',8:'LimeJacket',9:'CurlyMetalhead',10:'Topknot'}
source_root=root/'Data/CharactersNeutral'
inspect_fbx_rig=runpy.run_path(str(root/'Scripts/test_meshy_crew.py'))['inspect_fbx_rig']

def vector(value):return (value.x,value.y,value.z)

def saved_source(asset,path):
    data=asset.get_editor_property('asset_import_data');assert data,asset.get_path_name()
    filenames=[Path(value).resolve() for value in data.extract_filenames()]
    assert filenames and filenames[0]==path.resolve(),(asset.get_path_name(),'Wrong saved source',filenames,path)
    tags=u.EditorAssetLibrary.get_tag_values(asset.get_path_name())
    rows=json.loads(next(value for key,value in tags.items() if str(key)=='AssetImportData'))
    expected=hashlib.md5(path.read_bytes()).hexdigest()
    assert rows and rows[0]['FileMD5'].lower()==expected,(asset.get_path_name(),'Saved source hash differs',rows)
    return {'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'saved_md5':expected}

def saved_reference_pose(mesh,skeleton,body):
    component=u.SkeletalMeshComponent();component.set_skinned_asset_and_update(mesh,True)
    pose=u.AnimPoseExtensions.get_reference_pose(skeleton)
    assert u.AnimPoseExtensions.is_valid(pose),skeleton.get_path_name()
    skeleton_names=set(map(str,u.AnimPoseExtensions.get_bone_names(pose)))
    mesh_names={str(component.get_bone_name(index)) for index in range(component.get_num_bones())}
    assert mesh_names==skeleton_names,(mesh.get_path_name(),'Mesh/skeleton bone names differ')
    errors={'translation_cm':0.,'rotation_radians':0.,'scale':0.};world={}
    for name in mesh_names:
        actual=component.get_ref_pose_transform(component.get_bone_index(name))
        reference=u.AnimPoseExtensions.get_ref_bone_pose(pose,name,u.AnimPoseSpaces.LOCAL)
        errors['translation_cm']=max(errors['translation_cm'],math.dist(vector(actual.translation),vector(reference.translation)))
        errors['rotation_radians']=max(errors['rotation_radians'],actual.rotation.angular_distance(reference.rotation))
        errors['scale']=max(errors['scale'],math.dist(vector(actual.scale3d),vector(reference.scale3d)))
        world[name]=u.AnimPoseExtensions.get_ref_bone_pose(pose,name,u.AnimPoseSpaces.WORLD).translation
    assert errors['translation_cm']<.01 and errors['rotation_radians']<.0001 and errors['scale']<.0001,(mesh.get_path_name(),'Saved skeleton retains a different bind pose',errors)
    parents,_,bindings=inspect_fbx_rig(body,include_wrappers=True)
    assert set(parents)==mesh_names,(mesh.get_path_name(),'Source/mesh bone names differ',
                                     {'missing':sorted(set(parents)-mesh_names),'unexpected':sorted(mesh_names-set(parents))})
    for name,parent in parents.items():
        actual=str(component.get_parent_bone(name));actual=None if actual in ('None','') else actual
        assert actual==parent,(mesh.get_path_name(),'Source/mesh bone parent differs',name,actual,parent)
    source_positions={name:matrix[12:15] for name,matrix in bindings.items()}
    assert set(source_positions)<=mesh_names and len(source_positions)>=20,body
    # Distances are invariant under the FBX-to-Unreal axis conversion. This also
    # catches an old mesh and old skeleton that happen to agree with each other.
    pairs=[(a,b) for index,a in enumerate(sorted(source_positions)) for b in sorted(source_positions)[index+1:]]
    error=max(abs(math.dist(source_positions[a],source_positions[b])-math.dist(vector(world[a]),vector(world[b]))) for a,b in pairs)
    assert error<.05,(mesh.get_path_name(),'Saved bind geometry differs from its source FBX',error)
    return {'bones':len(mesh_names),'source_wrapper_roots':sorted(name for name,parent in parents.items() if parent is None and name not in bindings),
            'mesh_skeleton_max_errors':errors,'source_bind_pairs':len(pairs),'source_bind_max_distance_error_cm':error}

for style in styles:
    folder=f'{crew_path}/Resident{style}'
    mesh=u.load_asset(folder+'/SK_Body');assert isinstance(mesh,u.SkeletalMesh),style
    skeleton=mesh.get_editor_property('skeleton');assert skeleton and u.EditorAssetLibrary.does_asset_exist(skeleton.get_path_name())
    source=source_root/names[style]
    provenance={'body':saved_source(mesh,source/'body.fbx')}
    reference=saved_reference_pose(mesh,skeleton,source/'body.fbx')
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
        provenance[name]=saved_source(clip,source/(name[2:].lower()+'.fbx'))
        assert not clip.get_editor_property('enable_root_motion')
        if name=='A_Jump':
            assert abs(clip.get_play_length()-1.2)<.05 and not clip.get_editor_property('force_root_lock')
            first=u.AnimationLibrary.get_bone_pose_for_time(clip,'LeftLeg',0,False)
            apex=u.AnimationLibrary.get_bone_pose_for_time(clip,'LeftLeg',.47,False)
            assert first.rotation.angular_distance(apex.rotation)>.8, 'Jump has no knee tuck'
    report.append({'style':style,'height_cm':round(bounds.box_extent.z*2,1),'material_slots':len(slots),'mesh_build_flags':build_flags,'base_color':{'mipmaps':False,'never_stream':True,'lod_bias':0,'compression':'BC7','shading':'DEFAULT_LIT'},'saved_skeleton':skeleton.get_path_name(),'reference_pose':reference,'source_provenance':provenance})
for prop in ('Plunger','PVCTube'):
    assert isinstance(u.load_asset('/Game/ParkComic/Crew/SM_'+prop),u.StaticMesh)
output=root/'Verification'/('NeutralCandidate/MeshyAssets.json' if candidate else 'MeshyAssets.json')
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({'passed':True,'candidate':candidate,'source':str(source_root.relative_to(root)),'characters':report},indent=2)+'\n')
u.log('NORD_MESHY_ASSETS_OK '+str(len(report)))
