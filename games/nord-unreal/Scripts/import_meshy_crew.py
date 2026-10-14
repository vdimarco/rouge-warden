"""Import retained relaxed crew bodies and their own clips; never submits generation.

-NordNeutralCandidate imports only style 9 into a separate review folder.
-NordGraphicNovelCandidate -NordGraphicNovelGenerated imports the refined generated body and its own clips separately.
Add -NordGraphicNovelHighDetail for the separate raw high-detail body and its own maps/clips.
Original source bodies remain in Data/CharactersMeshy for recovery.
"""
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir()).resolve()
sys.path.insert(0, str(root/'Scripts'))
import plateau_atmosphere
import plateau_water
styles={'GreenCap51':3,'Memphis33':4,'BlackCap':5,'WhiteCap':6,'RedJersey':7,'LimeJacket':8,'CurlyMetalhead':9,'Topknot':10}
command=u.SystemLibrary.get_command_line()
candidate='-NordNeutralCandidate' in command
graphic_novel='-NordGraphicNovelCandidate' in command
generated='-NordGraphicNovelGenerated' in command
high_detail='-NordGraphicNovelHighDetail' in command.split()
assert not high_detail or (graphic_novel and generated), 'High-detail import requires Candidate and Generated flags'
assert not generated or graphic_novel, 'Generated import requires -NordGraphicNovelCandidate'
assert not (candidate and graphic_novel), 'Choose one candidate route'
if graphic_novel:
    assert '-nullrhi' in command.lower(), 'Author materials in a separate NullRHI process'
source_root=root/'Data/CharactersNeutral'
if candidate or graphic_novel:styles={'CurlyMetalhead':9}
if generated:
    source_root=root/'Data/GraphicNovel/Pilot/CurlyMetalhead'
    styles={'generated-v2-high-detail' if high_detail else 'generated-v1':9}
crew_folder='CrewGraphicNovelHighDetail' if high_detail else 'CrewGraphicNovelGenerated' if generated else 'CrewGraphicNovel' if graphic_novel else 'CrewNeutral' if candidate else 'Crew'
pilot_body=root/'Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe/body-bind-pose.fbx'
if generated:pilot_body=source_root/'refined-v1/body.fbx'
if high_detail:pilot_body=source_root/'generated-v2-high-detail/body.fbx'
if graphic_novel:assert pilot_body.is_file(), pilot_body
for name in styles:
    for filename in ('body.fbx','idle.fbx','walk.fbx','run.fbx','jump.fbx','base_color.png','normal.png','roughness.png','metallic.png'):
        assert (source_root/name/filename).is_file(),(name,filename)
if generated and not high_detail:
    refinement=json.loads((source_root/'refined-v1/body.json').read_text())
    assert refinement['passed'] and refinement['original_fbx_contents_identical_except_appended_uv1_layer']
    assert refinement['fresh_reimport_geometry_normals_uv0_weights_binds_identical']
    for key in ('source','output','mask'):
        path=root/refinement[key] if key!='mask' else source_root/'refined-v1/collar-uv1.json'
        assert hashlib.sha256(path.read_bytes()).hexdigest()==refinement[key+'_sha256'],path
if high_detail:
    high_source=source_root/'generated-v2-high-detail'
    review=json.loads((high_source/'source-review.json').read_text())
    generation=json.loads((high_source/'generation.json').read_text())
    assert all(review[key] is True for key in ('passed','source_unchanged','own_clip_bind_checks_passed')), 'High-detail source review failed'
    assert review['uv_channels']==1, 'High-detail body must retain its single UV channel'
    assert generation['status']=='completed_downloaded' and review['generation_request_id']==generation['request_id'], 'High-detail generation receipt mismatch'
    manifest=high_source/'files.json'
    assert hashlib.sha256(manifest.read_bytes()).hexdigest()==review['manifest_sha256'], 'High-detail manifest changed'
    files=json.loads(manifest.read_text())
    expected={'body.fbx','body.glb','idle.fbx','walk.fbx','run.fbx','run.glb','jump.fbx','jump.json',
              'base_color.png','normal.png','roughness.png','metallic.png','preview.png','reference.png'}
    assert len(files)==len(expected) and {row['file'] for row in files}==expected, 'Incomplete high-detail source manifest'
    for row in files:
        path=high_source/row['file']
        assert path.resolve().parent==high_source.resolve(), 'High-detail source escapes its folder'
        assert path.stat().st_size==row['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'], path
    hashes={row['file']:row['sha256'] for row in files}
    assert review['body_sha256']==hashes['body.fbx'] and review['body_glb_sha256']==hashes['body.glb'], 'High-detail reviewed body mismatch'
    assert generation['source_reference_sha256']==hashes['reference.png'], 'High-detail generation reference mismatch'
# Retain a recovery copy before touching any saved candidate or production asset.
backup=root/'Saved/Backups'/('CrewImport-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
for style in styles.values():
    relative=Path('Content/ParkComic')/crew_folder/f'Resident{style}'
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
    folder=f'/Game/ParkComic/{crew_folder}/Resident{style}';u.EditorAssetLibrary.make_directory(folder)
    options=u.FbxImportUI();options.automated_import_should_detect_type=False
    options.mesh_type_to_import=u.FBXImportType.FBXIT_SKELETAL_MESH
    options.import_as_skeletal=True;options.import_mesh=True;options.import_animations=False
    options.import_materials=False;options.import_textures=False;options.create_physics_asset=False
    options.skeletal_mesh_import_data.set_editor_property('import_morph_targets',graphic_novel)
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
        previous_import.set_editor_property('import_morph_targets',graphic_novel)
        previous_import.set_editor_property('import_content_type',u.FBXImportContentType.FBXICT_ALL)
    # Preserve the normals the generated normal atlas was baked against. FBX has
    # authored normals, but no smoothing/tangent layers; recompute only Mikk tangents.
    options.skeletal_mesh_import_data.normal_import_method=u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS
    options.skeletal_mesh_import_data.normal_generation_method=u.FBXNormalGenerationMethod.MIKK_T_SPACE
    options.skeletal_mesh_import_data.compute_weighted_normals=False
    mesh=load_file(pilot_body if graphic_novel else source/'body.fbx',folder,'SK_Body',options);assert isinstance(mesh,u.SkeletalMesh)
    build=u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh,0)
    for key,value in {'recompute_normals':False,'recompute_tangents':True,'use_mikk_t_space':True,
                      'compute_weighted_normals':False,'use_full_precision_u_vs':True,
                      'use_high_precision_tangent_basis':True}.items():build.set_editor_property(key,value)
    u.SkeletalMeshEditorSubsystem.set_lod_build_settings(mesh,0,build)
    skeleton=mesh.get_editor_property('skeleton');assert skeleton
    u.EditorAssetLibrary.save_loaded_asset(skeleton,only_if_is_dirty=False)
    material=tools.create_asset('M_Crew',folder,u.Material,u.MaterialFactoryNew()) if not u.EditorAssetLibrary.does_asset_exist(folder+'/M_Crew') else u.load_asset(folder+'/M_Crew')
    plateau_water.clear_material(u, material)
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
        if generated and not high_detail and channel=='base_color':
            # Albedo alone uses the repaired collar; the normal bake retains UV0.
            uv=materials.create_material_expression(material,u.MaterialExpressionTextureCoordinate,-600,0)
            uv.set_editor_property('coordinate_index',1)
            assert materials.connect_material_expressions(uv,'',node,'UVs')
        if channel=='normal':node.sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL
        elif channel!='base_color':node.sampler_type=u.MaterialSamplerType.SAMPLERTYPE_MASKS
        if channel=='normal':
            # The new bake needs full detail; retain the older bodies' calibrated attenuation.
            flat=materials.create_material_expression(material,u.MaterialExpressionConstant3Vector,-400,250)
            flat.set_editor_property('constant',u.LinearColor(0,0,1,1))
            detail=materials.create_material_expression(material,u.MaterialExpressionLinearInterpolate,-150,250)
            detail.set_editor_property('const_alpha',0. if generated else .65)
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
    if assets.does_asset_exist(plateau_atmosphere.COLLECTION):
        plateau_atmosphere.exposure(u, material, assets.load_asset(plateau_atmosphere.COLLECTION))
    materials.set_base_material_usage(material,u.MaterialUsage.MATUSAGE_SKELETAL_MESH,True)
    materials.recompile_material(material);u.EditorAssetLibrary.save_loaded_asset(material)
    cloth={}
    if graphic_novel and not generated:
        # Source cloth meshes carry distinct slots; colours are linear, with the existing exposure-calibrated fill.
        palette={'Trousers':((.025,.095,.105),.9), 'TrousersSeam':((.009,.028,.033),.95),
                 'Canvas':((.018,.022,.028),.9), 'Sole':((.65,.62,.53),.7),
                 'RubberStripe':((.006,.008,.012),.85), 'Laces':((.7,.67,.57),.85),
                 'Eyelets':((.12,.12,.11),.3)}
        imported_names={str(slot.get_editor_property('imported_material_slot_name')) for slot in mesh.get_editor_property('materials')}
        for slot_name,(color,roughness) in palette.items():
            if slot_name not in imported_names:continue
            path=folder+'/M_'+slot_name
            mat=tools.create_asset('M_'+slot_name,folder,u.Material,u.MaterialFactoryNew()) if not assets.does_asset_exist(path) else u.load_asset(path)
            plateau_water.clear_material(u,mat)
            base=materials.create_material_expression(mat,u.MaterialExpressionConstant3Vector)
            base.set_editor_property('constant',u.LinearColor(*color,1))
            assert materials.connect_material_property(base,'',u.MaterialProperty.MP_BASE_COLOR)
            rough=materials.create_material_expression(mat,u.MaterialExpressionConstant)
            rough.set_editor_property('r',roughness)
            assert materials.connect_material_property(rough,'',u.MaterialProperty.MP_ROUGHNESS)
            fill=materials.create_material_expression(mat,u.MaterialExpressionMultiply);fill.set_editor_property('const_b',250.)
            assert materials.connect_material_expressions(base,'',fill,'A')
            assert materials.connect_material_property(fill,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
            if assets.does_asset_exist(plateau_atmosphere.COLLECTION):
                plateau_atmosphere.exposure(u,mat,assets.load_asset(plateau_atmosphere.COLLECTION))
            materials.set_base_material_usage(mat,u.MaterialUsage.MATUSAGE_SKELETAL_MESH,True)
            materials.recompile_material(mat);assets.save_loaded_asset(mat)
            cloth[slot_name]=mat
    slots=mesh.get_editor_property('materials');assert slots
    assigned=[]
    for i,slot in enumerate(slots):
        slot_name=str(slot.get_editor_property('imported_material_slot_name'))
        slot.material_interface=cloth.get(slot_name,material);slots[i]=slot
        assigned.append({'slot':slot_name,'material':slot.material_interface.get_path_name()})
    if graphic_novel and not generated:
        assert {'Trousers','TrousersSeam','Canvas','Sole','RubberStripe','Laces'}.issubset(cloth),assigned
        assert len(slots)>len(cloth),'Missing retained body material'
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
    if graphic_novel:
        factory=u.BlendSpaceFactory1D()
        factory.set_editor_property('target_skeleton',skeleton)
        path=folder+'/BS_Locomotion'
        space=u.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset('BS_Locomotion',folder,u.BlendSpace1D,factory)
        assert isinstance(space,u.BlendSpace1D)
        assert u.QuebecCrewAnimInstance.configure_crew_blend_space(space,*(u.load_asset(folder+'/A_'+kind) for kind in ('Idle','Walk','Run')))
        assets.save_loaded_asset(space,only_if_is_dirty=False)
    u.EditorAssetLibrary.save_directory(folder,only_if_is_dirty=False,recursive=True)
    reports.append({'style':style,'name':name,'materials':len(slots),'material_slots':assigned,'clips':clips})
assert reports,'No downloaded models to import'
report_path=root/('Saved/Tests/GraphicNovel/PilotImport.json' if graphic_novel else 'Verification/'+('NeutralCandidateImport.json' if candidate else 'NeutralCrewImport.json'))
if generated:report_path=root/'Saved/Tests/GraphicNovel/GeneratedImport.json'
if high_detail:report_path=root/'Saved/Tests/GraphicNovel/HighDetailImport.json'
report_path.parent.mkdir(parents=True,exist_ok=True)
report_path.write_text(json.dumps({'passed':True,'source':str(source_root.relative_to(root)),'body_source':str(pilot_body.relative_to(root)) if graphic_novel else 'body.fbx','backup':str(backup),'characters':reports},indent=2)+'\n')
u.log('NORD_MESHY_IMPORT_OK '+str(len(reports)))
