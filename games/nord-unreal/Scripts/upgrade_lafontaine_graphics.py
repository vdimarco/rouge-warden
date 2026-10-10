"""Apply the licensed surface textures and detailed foreground vegetation."""
import json
from pathlib import Path
import unreal as u
ROOT=Path(u.Paths.project_dir()).resolve()
assets=u.EditorAssetLibrary
tools=u.AssetToolsHelpers.get_asset_tools()
editor=u.get_editor_subsystem(u.EditorActorSubsystem)
levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
assert levels.get_current_level().get_outer().get_name()=='LaFontaine'
layout=json.loads((ROOT/'Data/LaFontaine/layout.json').read_text())
M=u.MaterialEditingLibrary
def link(source, output, target, input_name):
    assert M.connect_material_expressions(source,output,target,input_name), (source.get_name(),target.get_name(),input_name)

textures={}
for source in sorted((ROOT/'Data/Art').glob('*.jpg')):
    task=u.AssetImportTask();task.filename=str(source);task.destination_path='/Game/Art/Textures';task.automated=True;task.save=True;task.replace_existing=True
    tools.import_asset_tasks([task]);assert task.imported_object_paths
    tex=assets.load_asset(task.imported_object_paths[0]);textures[source.stem]=tex
    if 'nor_dx' in source.stem:
        tex.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_NORMALMAP);tex.set_editor_property('srgb',False)
    elif source.stem.endswith('rough'):tex.set_editor_property('srgb',False)
    assets.save_loaded_asset(tex)

def material(name):
    path='/Game/Art/'+name
    mat=assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset(name,'/Game/Art',u.Material,u.MaterialFactoryNew())
    M.delete_all_material_expressions(mat)
    return mat

def node(mat,cls,**properties):
    n=M.create_material_expression(mat,cls)
    for k,v in properties.items():n.set_editor_property(k,v)
    return n

def scalar(mat,value,prop):
    M.connect_material_property(node(mat,u.MaterialExpressionConstant,r=value),'',prop)

materials={}
for label,asset,tint in [('Road','asphalt_02',(1,1,1)),('Brick','brick_wall_001',(1,1,1)),
                        ('Cream','brick_wall_001',(1.5,1.45,1.2)),('Sage','brick_wall_001',(.65,.9,.75)),
                        ('Grass','grass_ground',(1,1,1)),('Path','concrete_pavement',(1,1,1))]:
    mat=material('M_'+label+'_Surface')
    for role,prop in [('diff',u.MaterialProperty.MP_BASE_COLOR),('nor_dx',u.MaterialProperty.MP_NORMAL),('rough',u.MaterialProperty.MP_ROUGHNESS)]:
        tex=textures[asset+'_'+role]
        sample=node(mat,u.MaterialExpressionTextureSample,texture=tex,sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL if role=='nor_dx' else (u.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR if role=='rough' else u.MaterialSamplerType.SAMPLERTYPE_COLOR))
        if role=='diff':
            color=node(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(*tint,1))
            mult=node(mat,u.MaterialExpressionMultiply);link(sample,'RGB',mult,'A');link(color,'',mult,'B');sample=mult
        M.connect_material_property(sample,'',prop)
    M.recompile_material(mat);materials[label]=mat
# Reflective paint/glass improve the existing car without changing its collision body.
for name,color,rough,metal in [('CarBody',(.025,.22,.29),.23,.65),('Glass',(.025,.065,.085),.1,.35),('Water',(.035,.085,.075),.28,0.)]:
    mat=material('M_'+name+'_Finish')
    M.connect_material_property(node(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(*color,1)),'',u.MaterialProperty.MP_BASE_COLOR)
    scalar(mat,rough,u.MaterialProperty.MP_ROUGHNESS);scalar(mat,metal,u.MaterialProperty.MP_METALLIC)
    if name=='Water':
        normal=node(mat,u.MaterialExpressionCustom,code=(ROOT/'Scripts/pond_normal.hlsl').read_text(),output_type=u.CustomMaterialOutputType.CMOT_FLOAT3,description='Quiet pond ripples')
        inputs=[]
        for input_name in ('Position','Seconds'):
            entry=u.CustomInput();entry.set_editor_property('input_name',input_name);inputs.append(entry)
        normal.set_editor_property('inputs',inputs)
        link(node(mat,u.MaterialExpressionWorldPosition),'',normal,'Position')
        link(node(mat,u.MaterialExpressionTime),'',normal,'Seconds')
        assert M.connect_material_property(normal,'',u.MaterialProperty.MP_NORMAL)
    M.recompile_material(mat);materials[name]=mat
    if name in ('CarBody','Glass'):
        mi=assets.load_asset('/Game/Materials/M_'+name)
        M.set_material_instance_parent(mi,mat);assets.save_loaded_asset(mi)
for actor in editor.get_all_level_actors():
    label=actor.get_actor_label()
    if label.startswith('OSM ') and label[4:] in materials:actor.static_mesh_component.set_material(0,materials[label[4:]])
    if isinstance(actor,u.DirectionalLight):
        actor.set_actor_rotation(u.Rotator(pitch=-28,yaw=-35),False)
        actor.light_component.set_editor_property('temperature',5100.)
        actor.light_component.set_editor_property('use_temperature',True)
    if isinstance(actor,u.PostProcessVolume):
        s=actor.get_editor_property('settings')
        for k,v in {'auto_exposure_min_brightness':12.5,'auto_exposure_max_brightness':12.5,'override_bloom_intensity':True,'bloom_intensity':.25}.items():s.set_editor_property(k,v)
        actor.set_editor_property('settings',s)
# Import one detailed tree and instance its mesh at the mapped positions near the address.
task=u.AssetImportTask();task.filename=str(ROOT/'Data/Art/tree_small_02/tree_small_02.gltf');task.destination_path='/Game/Art/Tree';task.automated=True;task.save=True;task.replace_existing=True
tools.import_asset_tasks([task]);assert task.imported_object_paths
meshes=[assets.load_asset(p) for p in task.imported_object_paths if isinstance(assets.load_asset(p),u.StaticMesh)]
assert len(meshes)==1,'Expected one tree mesh'
mesh=meshes[0]
alpha_task=u.AssetImportTask();alpha_task.filename=str(ROOT/'Data/Art/tree_small_02/textures/tree_small_02_leaves_alpha_1k.jpg');alpha_task.destination_path='/Game/Art/Tree';alpha_task.automated=True;alpha_task.save=True
tools.import_asset_tasks([alpha_task]);alpha=assets.load_asset(alpha_task.imported_object_paths[0]);alpha.set_editor_property('srgb',False)
# glTF declares blended foliage but its JPEG lacks alpha: explicitly provide the source cutout mask.
leaf=material('M_DetailedAutumnLeaves');leaf.set_editor_property('blend_mode',u.BlendMode.BLEND_MASKED);leaf.set_editor_property('two_sided',True)
leaf.set_editor_property('shading_model',u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE)
leaf_paths=assets.list_assets('/Game/Art/Tree',True,False)
diffuse=next(assets.load_asset(p) for p in leaf_paths if 'leaves_diff' in p and isinstance(assets.load_asset(p),u.Texture2D))
sample=node(leaf,u.MaterialExpressionTextureSample,texture=diffuse)
desat=node(leaf,u.MaterialExpressionDesaturation)
link(sample,'RGB',desat,'');link(node(leaf,u.MaterialExpressionConstant,r=.7),'',desat,'Fraction')
tint=node(leaf,u.MaterialExpressionMultiply);link(desat,'',tint,'A');link(node(leaf,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(1.8,1.0,.25,1)),'',tint,'B')
M.connect_material_property(tint,'',u.MaterialProperty.MP_BASE_COLOR);M.connect_material_property(tint,'',u.MaterialProperty.MP_SUBSURFACE_COLOR)
mask=node(leaf,u.MaterialExpressionTextureSample,texture=alpha,sampler_type=u.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR);M.connect_material_property(mask,'R',u.MaterialProperty.MP_OPACITY_MASK);scalar(leaf,.8,u.MaterialProperty.MP_ROUGHNESS);M.recompile_material(leaf)
for i,slot in enumerate(mesh.get_editor_property('static_materials')):
    if 'leav' in str(slot.material_slot_name).lower() or 'leav' in slot.material_interface.get_name().lower():mesh.set_material(i,leaf)
settings=mesh.get_editor_property('nanite_settings');settings.set_editor_property('enabled',True)
u.get_editor_subsystem(u.StaticMeshEditorSubsystem).set_nanite_settings(mesh,settings,True)
height=mesh.get_bounds().box_extent.z*2;assert 300<height<600,str(mesh.get_bounds())
for a in editor.get_all_level_actors():
    if a.get_actor_label().startswith('Detailed tree '):editor.destroy_actor(a)
for x,y,seed in layout['detailed_trees']:
    actor=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector(x,y,0),u.Rotator(yaw=seed%360))
    actor.set_actor_label('Detailed tree '+str(seed));actor.static_mesh_component.set_static_mesh(mesh)
    actor.static_mesh_component.set_collision_profile_name('NoCollision')
    scale=(650+seed%500)/height;actor.set_actor_scale3d(u.Vector(scale,scale,scale))
if not any(isinstance(a,u.ExponentialHeightFog) for a in editor.get_all_level_actors()):
    fog=editor.spawn_actor_from_class(u.ExponentialHeightFog,u.Vector(0,0,-150))
    fog.get_component_by_class(u.ExponentialHeightFogComponent).set_editor_property('fog_density',.000015)
import math
import xml.etree.ElementTree as ET
# Furniture positions come from mapped bench/lamp nodes; shapes are illustrative.
for old in editor.get_all_level_actors():
    if old.get_actor_label().startswith('Street detail '):editor.destroy_actor(old)
cube=assets.load_asset('/Engine/BasicShapes/Cube');cylinder=assets.load_asset('/Engine/BasicShapes/Cylinder')
wood=assets.load_asset('/Game/Materials/M_Wood');metal=assets.load_asset('/Game/Materials/M_Dark')
origin=layout['origin'];count=0

def part(label,x,y,z,sx,sy,sz,mat,mesh=cube):
    a=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector(x,y,z))
    a.set_actor_label('Street detail '+label);a.static_mesh_component.set_static_mesh(mesh)
    a.static_mesh_component.set_material(0,mat);a.static_mesh_component.set_collision_profile_name('NoCollision')
    a.set_actor_scale3d(u.Vector(sx/100,sy/100,sz/100))

for e in ET.parse(ROOT/'Data/LaFontaine/osm.xml').getroot().findall('node'):
    t={v.get('k'):v.get('v') for v in e.findall('tag')}
    if t.get('amenity')!='bench' and t.get('highway')!='street_lamp':continue
    x=(float(e.get('lon'))-origin[1])*111320*math.cos(math.radians(origin[0]))*100
    y=(float(e.get('lat'))-origin[0])*111320*100
    if math.dist((x,y),layout['spawn'][:2])>20000:continue
    if t.get('amenity')=='bench':
        for d in (-17,0,17):part('bench seat',x,y+d,46,180,14,7,wood)
        for z in (70,91):part('bench back',x,y+28,z,180,7,16,wood)
        for dx in (-65,65):part('bench leg',x+dx,y,25,9,48,50,metal)
        count+=1
    else:
        part('lamp post',x,y,250,15,15,500,metal,cylinder)
        part('lamp shade',x,y,503,75,75,18,metal,cylinder)
        part('lamp lens',x,y,490,48,48,14,assets.load_asset('/Game/Materials/M_Light'),cylinder)
u.log('LAFONTAINE_FURNITURE benches='+str(count))

assets.save_directory('/Game/Art');assert levels.save_current_level()
u.log('LAFONTAINE_GRAPHICS_OK detailed_trees='+str(len(layout['detailed_trees'])))

# Persist usage flags; game mode cannot repair missing Nanite permutations.
exec((ROOT/"Scripts/fix_tree_material_usage.py").read_text())
