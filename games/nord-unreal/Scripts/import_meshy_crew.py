"""Import downloaded Meshy FBX bodies and clips; never submits paid generation."""
import json
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir()).resolve()
styles={'GreenCap51':3,'Memphis33':4,'BlackCap':5,'WhiteCap':6,'RedJersey':7,'LimeJacket':8,'CurlyMetalhead':9,'Topknot':10}
tools=u.AssetToolsHelpers.get_asset_tools();materials=u.MaterialEditingLibrary;assets=u.EditorAssetLibrary
u.SystemLibrary.execute_console_command(None,'Interchange.FeatureFlags.Import.FBX 0')
def load_file(filename,folder,name,options=None):
    task=u.AssetImportTask();task.filename=str(filename);task.destination_path=folder;task.destination_name=name
    task.automated=True;task.replace_existing=True;task.save=True
    if options:task.options=options;task.factory=u.FbxFactory()
    tools.import_asset_tasks([task]);asset=u.load_asset(folder+'/'+name)
    assert asset,(filename,list(task.imported_object_paths));return asset
# Reuse the existing static importer for the original handheld props.
helper=(root/'Scripts/import_city_buildings.py').read_text()
exec(helper[helper.index('def mesh_import'):helper.index('# Shared parent')])
for prop in ('Plunger','PVCTube'):
    mesh=mesh_import(root/'Data/CharactersMeshy/Geometry'/(prop+'.obj'),'/Game/ParkComic/Crew','SM_'+prop)
    for i,slot in enumerate(mesh.get_editor_property('static_materials')):
        material=u.load_asset('/Game/ParkComic/M_'+str(slot.material_slot_name));assert material
        mesh.set_material(i,material)
    u.EditorAssetLibrary.save_loaded_asset(mesh)
reports=[]
for name,style in styles.items():
    source=root/'Data/CharactersMeshy'/name
    if not (source/'body.fbx').exists():continue
    folder=f'/Game/ParkComic/Crew/Resident{style}';u.EditorAssetLibrary.make_directory(folder)
    options=u.FbxImportUI();options.automated_import_should_detect_type=False
    options.mesh_type_to_import=u.FBXImportType.FBXIT_SKELETAL_MESH
    options.import_as_skeletal=True;options.import_mesh=True;options.import_animations=False
    options.import_materials=False;options.import_textures=False;options.create_physics_asset=False
    options.skeletal_mesh_import_data.force_front_x_axis=True
    options.skeletal_mesh_import_data.convert_scene=True;options.skeletal_mesh_import_data.convert_scene_unit=True
    mesh=load_file(source/'body.fbx',folder,'SK_Body',options);assert isinstance(mesh,u.SkeletalMesh)
    skeleton=mesh.get_editor_property('skeleton');assert skeleton
    u.EditorAssetLibrary.save_loaded_asset(skeleton,only_if_is_dirty=False)
    material=tools.create_asset('M_Crew',folder,u.Material,u.MaterialFactoryNew()) if not u.EditorAssetLibrary.does_asset_exist(folder+'/M_Crew') else u.load_asset(folder+'/M_Crew')
    materials.delete_all_material_expressions(material)
    for channel,prop in [('base_color',u.MaterialProperty.MP_BASE_COLOR),('normal',u.MaterialProperty.MP_NORMAL),('roughness',u.MaterialProperty.MP_ROUGHNESS),('metallic',u.MaterialProperty.MP_METALLIC)]:
        texture=load_file(source/(channel+'.png'),folder,'T_'+channel)
        texture.set_editor_property('srgb',channel=='base_color')
        if channel=='normal':
            texture.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_NORMALMAP)
            texture.set_editor_property('flip_green_channel',True)
        elif channel!='base_color':texture.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_MASKS)
        u.EditorAssetLibrary.save_loaded_asset(texture)
        node=materials.create_material_expression(material,u.MaterialExpressionTextureSample,-400,0)
        node.texture=texture
        if channel=='normal':node.sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL
        elif channel!='base_color':node.sampler_type=u.MaterialSamplerType.SAMPLERTYPE_MASKS
        assert materials.connect_material_property(node,'RGB' if channel in ('normal','base_color') else 'R',prop)
    # Baked comic inks stay readable under the park's deep tree shadows.
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
    for kind in ('Walk','Idle'):
        options=u.FbxImportUI();options.automated_import_should_detect_type=False
        options.mesh_type_to_import=u.FBXImportType.FBXIT_ANIMATION
        options.import_as_skeletal=True;options.import_mesh=False;options.import_animations=True
        options.import_materials=False;options.import_textures=False;options.skeleton=mesh.get_editor_property('skeleton')
        options.anim_sequence_import_data.force_front_x_axis=True
        options.anim_sequence_import_data.convert_scene=True;options.anim_sequence_import_data.convert_scene_unit=True
        options.anim_sequence_import_data.set_editor_property('use_default_sample_rate',True)
        clip=load_file(source/(kind.lower()+'.fbx'),folder,'A_'+kind,options)
        assert isinstance(clip,u.AnimSequence) and clip.get_play_length()>.1,kind
        clip.set_editor_property('force_root_lock',True)
        u.EditorAssetLibrary.save_loaded_asset(clip);clips.append({'name':kind,'seconds':clip.get_play_length()})
    u.EditorAssetLibrary.save_directory(folder,only_if_is_dirty=False,recursive=True)
    reports.append({'style':style,'name':name,'materials':len(slots),'clips':clips})
assert reports,'No downloaded models to import'
(root/'Verification/MeshyImport.json').write_text(json.dumps({'passed':True,'characters':reports},indent=2)+'\n')
u.log('NORD_MESHY_IMPORT_OK '+str(len(reports)))
