"""Import retained relaxed crew bodies and their own clips; never submits generation.

-NordNeutralCandidate imports only style 9 into a separate review folder.
Original source bodies remain in Data/CharactersMeshy for recovery.
"""
import json
import shutil
from datetime import datetime
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir()).resolve()
styles={'GreenCap51':3,'Memphis33':4,'BlackCap':5,'WhiteCap':6,'RedJersey':7,'LimeJacket':8,'CurlyMetalhead':9,'Topknot':10}
command=u.SystemLibrary.get_command_line()
candidate='-NordNeutralCandidate' in command
source_root=root/'Data/CharactersNeutral'
if candidate:styles={'CurlyMetalhead':9}
for name in styles:
    for filename in ('body.fbx','idle.fbx','walk.fbx','run.fbx','jump.fbx','base_color.png','normal.png','roughness.png','metallic.png'):
        assert (source_root/name/filename).is_file(),(name,filename)
# Retain a recovery copy before touching any saved candidate or production asset.
backup=root/'Saved/Backups'/('CrewImport-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
for style in styles.values():
    relative=Path('Content/ParkComic')/('CrewNeutral' if candidate else 'Crew')/f'Resident{style}'
    if (root/relative).exists():shutil.copytree(root/relative,backup/relative)
tools=u.AssetToolsHelpers.get_asset_tools();materials=u.MaterialEditingLibrary;assets=u.EditorAssetLibrary
u.SystemLibrary.execute_console_command(None,'Interchange.FeatureFlags.Import.FBX 0')
def load_file(filename,folder,name,options=None):
    task=u.AssetImportTask();task.filename=str(filename);task.destination_path=folder;task.destination_name=name
    task.automated=True;task.replace_existing=True;task.save=True
    if options:task.options=options;task.factory=u.FbxFactory()
    tools.import_asset_tasks([task]);asset=u.load_asset(folder+'/'+name)
    assert asset,(filename,list(task.imported_object_paths));return asset
for prop in ('Plunger','PVCTube'):
    assert isinstance(u.load_asset('/Game/ParkComic/Crew/SM_'+prop),u.StaticMesh)
reports=[]
for name,style in styles.items():
    source=source_root/name
    folder=f'/Game/ParkComic/{"CrewNeutral" if candidate else "Crew"}/Resident{style}';u.EditorAssetLibrary.make_directory(folder)
    options=u.FbxImportUI();options.automated_import_should_detect_type=False
    options.mesh_type_to_import=u.FBXImportType.FBXIT_SKELETAL_MESH
    options.import_as_skeletal=True;options.import_mesh=True;options.import_animations=False
    options.import_materials=False;options.import_textures=False;options.create_physics_asset=False
    options.skeletal_mesh_import_data.force_front_x_axis=True
    options.skeletal_mesh_import_data.convert_scene=True;options.skeletal_mesh_import_data.convert_scene_unit=True
    # New geometry and all four own clips must share its new bind pose.
    options.skeletal_mesh_import_data.set_editor_property('update_skeleton_reference_pose',True)
    previous=u.load_asset(folder+'/SK_Body') if u.EditorAssetLibrary.does_asset_exist(folder+'/SK_Body') else None
    if previous:
        # UE reimport reads the mesh's saved settings instead of this task's options.
        previous_import=previous.get_editor_property('asset_import_data')
        assert isinstance(previous_import,u.FbxSkeletalMeshImportData)
        previous_import.set_editor_property('update_skeleton_reference_pose',True)
        previous_import.set_editor_property('import_content_type',u.FBXImportContentType.FBXICT_ALL)
    # Preserve the normals the generated normal atlas was baked against. FBX has
    # authored normals, but no smoothing/tangent layers; recompute only Mikk tangents.
    options.skeletal_mesh_import_data.normal_import_method=u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS
    options.skeletal_mesh_import_data.normal_generation_method=u.FBXNormalGenerationMethod.MIKK_T_SPACE
    options.skeletal_mesh_import_data.compute_weighted_normals=False
    mesh=load_file(source/'body.fbx',folder,'SK_Body',options);assert isinstance(mesh,u.SkeletalMesh)
    build=u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh,0)
    for key,value in {'recompute_normals':False,'recompute_tangents':True,'use_mikk_t_space':True,
                      'compute_weighted_normals':False,'use_full_precision_u_vs':True,
                      'use_high_precision_tangent_basis':True}.items():build.set_editor_property(key,value)
    u.SkeletalMeshEditorSubsystem.set_lod_build_settings(mesh,0,build)
    skeleton=mesh.get_editor_property('skeleton');assert skeleton
    u.EditorAssetLibrary.save_loaded_asset(skeleton,only_if_is_dirty=False)
    material=tools.create_asset('M_Crew',folder,u.Material,u.MaterialFactoryNew()) if not u.EditorAssetLibrary.does_asset_exist(folder+'/M_Crew') else u.load_asset(folder+'/M_Crew')
    materials.delete_all_material_expressions(material)
    for channel,prop in [('base_color',u.MaterialProperty.MP_BASE_COLOR),('normal',u.MaterialProperty.MP_NORMAL),('roughness',u.MaterialProperty.MP_ROUGHNESS),('metallic',u.MaterialProperty.MP_METALLIC)]:
        texture=load_file(source/(channel+'.png'),folder,'T_'+channel)
        texture.set_editor_property('srgb',channel=='base_color')
        if channel=='base_color':
            texture.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_BC7)
            texture.set_editor_property('lod_group',u.TextureGroup.TEXTUREGROUP_CHARACTER)
            # shortcut: tiny UV islands bleed in mips; keep full atlases until UVs are repacked with padding.
            texture.set_editor_property('mip_gen_settings',u.TextureMipGenSettings.TMGS_NO_MIPMAPS)
            texture.set_editor_property('never_stream',True)
            texture.set_editor_property('lod_bias',0)
        elif channel=='normal':
            texture.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_NORMALMAP)
            texture.set_editor_property('flip_green_channel',True)
        elif channel!='base_color':texture.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_MASKS)
        u.EditorAssetLibrary.save_loaded_asset(texture)
        node=materials.create_material_expression(material,u.MaterialExpressionTextureSample,-400,0)
        node.texture=texture
        if channel=='normal':node.sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL
        elif channel!='base_color':node.sampler_type=u.MaterialSamplerType.SAMPLERTYPE_MASKS
        if channel=='normal':
            # Dense generated skin normals overwhelm painted eyes/mouth; retain 35% of their strength.
            flat=materials.create_material_expression(material,u.MaterialExpressionConstant3Vector,-400,250)
            flat.set_editor_property('constant',u.LinearColor(0,0,1,1))
            detail=materials.create_material_expression(material,u.MaterialExpressionLinearInterpolate,-150,250)
            detail.set_editor_property('const_alpha',.65)
            assert materials.connect_material_expressions(node,'RGB',detail,'A')
            assert materials.connect_material_expressions(flat,'',detail,'B')
            assert materials.connect_material_property(detail,'',prop)
        else:
            assert materials.connect_material_property(node,'RGB' if channel=='base_color' else 'R',prop)
    # Retain the existing emission calibrated to the daylight exposure; source colour pixels stay unchanged.
    base=materials.get_material_property_input_node(material,u.MaterialProperty.MP_BASE_COLOR)
    fill=materials.create_material_expression(material,u.MaterialExpressionMultiply,-150,400);fill.set_editor_property('const_b',250.)
    assert materials.connect_material_expressions(base,'RGB',fill,'A')
    assert materials.connect_material_property(fill,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
    materials.set_base_material_usage(material,u.MaterialUsage.MATUSAGE_SKELETAL_MESH,True)
    materials.recompile_material(material);u.EditorAssetLibrary.save_loaded_asset(material)
    slots=mesh.get_editor_property('materials');assert slots
    for i,slot in enumerate(slots):
        slot.material_interface=material;slots[i]=slot
    mesh.set_editor_property('materials',slots);u.EditorAssetLibrary.save_loaded_asset(mesh)
    clips=[]
    for kind in ('Walk','Idle','Run','Jump'):
        options=u.FbxImportUI();options.automated_import_should_detect_type=False
        options.mesh_type_to_import=u.FBXImportType.FBXIT_ANIMATION
        options.import_as_skeletal=True;options.import_mesh=False;options.import_animations=True
        options.import_materials=False;options.import_textures=False;options.skeleton=mesh.get_editor_property('skeleton')
        options.anim_sequence_import_data.force_front_x_axis=True
        options.anim_sequence_import_data.convert_scene=True;options.anim_sequence_import_data.convert_scene_unit=True
        options.anim_sequence_import_data.set_editor_property('use_default_sample_rate',True)
        clip=load_file(source/(kind.lower()+'.fbx'),folder,'A_'+kind,options)
        assert isinstance(clip,u.AnimSequence) and clip.get_play_length()>.1,kind
        assert clip.get_editor_property('skeleton')==skeleton,(name,kind,'wrong skeleton')
        clip.set_editor_property('force_root_lock',kind!='Jump')
        clip.set_editor_property('enable_root_motion',False)
        u.EditorAssetLibrary.save_loaded_asset(clip);clips.append({'name':kind,'seconds':clip.get_play_length()})
    u.EditorAssetLibrary.save_directory(folder,only_if_is_dirty=False,recursive=True)
    reports.append({'style':style,'name':name,'materials':len(slots),'clips':clips})
assert reports,'No downloaded models to import'
(root/'Verification'/('NeutralCandidateImport.json' if candidate else 'NeutralCrewImport.json')).write_text(json.dumps({'passed':True,'source':str(source_root.relative_to(root)),'backup':str(backup),'characters':reports},indent=2)+'\n')
u.log('NORD_MESHY_IMPORT_OK '+str(len(reports)))
