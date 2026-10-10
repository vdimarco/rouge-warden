"""Refresh appearance only. Load LaFontaine, stop PIE, run after source preparation."""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import shutil
import sys
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
sys.path.insert(0, str(ROOT / 'Scripts'))
from prepare_environment_refresh import tree_profile

data = json.loads((ROOT / 'Data/EnvironmentRefresh/layout.json').read_text())
park = json.loads((ROOT / 'Data/ParkComic/layout.json').read_text())
for name,path in (('park','Data/ParkComic/layout.json'),('city','Data/CityBuildings/manifest.json')):
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == data['source_sha256'][name], 'Reprepare environment sources'
assets = u.EditorAssetLibrary
M = u.MaterialEditingLibrary
tools = u.AssetToolsHelpers.get_asset_tools()
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
assert '/Maps/LaFontaine.' in u.EditorLevelLibrary.get_editor_world().get_path_name()
assert not u.EditorLevelLibrary.get_pie_worlds(False), 'Stop PIE before refreshing the environment'
assert levels.save_current_level()
backup = ROOT/'Saved/Recovery'/('environment-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
assert not backup.exists()
backup.mkdir(parents=True)
shutil.copy2(ROOT/'Content/Maps/LaFontaine.umap',backup/'LaFontaine.umap')
for folder in ('ParkComic','CityBuildings','Art'):
    shutil.copytree(ROOT/'Content'/folder,backup/folder)

def gameplay_snapshot():
    result={}
    for actor in editor.get_all_level_actors():
        if not (isinstance(actor,(u.Pawn,u.PlayerStart)) or actor.get_actor_label().startswith('Mission ')):continue
        location=actor.get_actor_location();rotation=actor.get_actor_rotation();scale=actor.get_actor_scale3d()
        # Unreal struct strings include transient allocation addresses, so compare numeric values.
        result[actor.get_path_name()]={'class':actor.get_class().get_path_name(),'label':actor.get_actor_label(),
            'location':[location.x,location.y,location.z],
            'rotation':[rotation.pitch,rotation.yaw,rotation.roll],
            'scale':[scale.x,scale.y,scale.z]}
    return result

before = gameplay_snapshot()
parent = assets.load_asset('/Game/ParkComic/M_Palette')
assert parent
def material(name,color):
    path='/Game/EnvironmentRefresh/M_'+name
    mat=assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset('M_'+name,'/Game/EnvironmentRefresh',u.MaterialInstanceConstant,u.MaterialInstanceConstantFactoryNew())
    M.set_material_instance_parent(mat,parent)
    # UE 5.8's setter applies the value but always returns false; verify the stored value.
    M.set_material_instance_vector_parameter_value(mat,'Tint',u.LinearColor(*color,1))
    stored=M.get_material_instance_vector_parameter_value(mat,'Tint')
    assert all(abs(actual-expected)<1.e-5 for actual,expected in zip((stored.r,stored.g,stored.b,stored.a),(*color,1))), name+' Tint readback'
    assert assets.save_loaded_asset(mat)
    return mat

mats={name:material(name,color) for name,color in data['palette'].items()}
leaf_mats={}
for color,base in enumerate(data['leaf_colors']):
    for shade,mult in enumerate((.82,1.,1.13)):
        leaf_mats[color,shade]=material(f'Leaf{color}_{shade}',tuple(v*mult for v in base))
source=(ROOT/'Scripts/import_city_buildings.py').read_text()
import_namespace={'u':u,'tools':tools,'assets':assets}
exec(source[source.index('def mesh_import'):source.index('# Shared parent')],import_namespace)
mesh_import=import_namespace['mesh_import']
meshes={}
for model in data['models']:
    name=Path(model['file']).stem
    mesh=mesh_import(ROOT/'Data/EnvironmentRefresh/Geometry'/model['file'],'/Game/EnvironmentRefresh','SM_'+name,import_normals=name.startswith('Canopy'))
    if name.startswith('Canopy'):
        settings=mesh.get_editor_property('nanite_settings');settings.set_editor_property('enabled',True)
        u.get_editor_subsystem(u.StaticMeshEditorSubsystem).set_nanite_settings(mesh,settings,True)
        for i,slot in enumerate(mesh.get_editor_property('static_materials')):
            label=str(slot.material_slot_name)
            mesh.set_material(i,leaf_mats[0,int(label[-1])] if label.startswith('Leaf') else mats['Wood'])
    else:
        for i,slot in enumerate(mesh.get_editor_property('static_materials')):mesh.set_material(i,mats[str(slot.material_slot_name)])
    assert assets.save_loaded_asset(mesh)
    meshes[name]=mesh

instances=u.load_class(None,'/Script/Quebec.QuebecParkInstances')
assert instances
actors=editor.get_all_level_actors()
old_crowns=[a for a in actors if a.get_actor_label().startswith('Comic park inventory crowns')]
trunks=next(a for a in actors if a.get_actor_label()=='Comic park inventory trunks').get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
assert trunks.get_instance_count()==len(park['trees'])
crowns={}
for i,tree in enumerate(park['trees']):
    p=tree_profile(tree);x,y=tree['xy'];height=p['height'];radius=p['radius']
    # Municipal XY and measured trunk diameters are preserved exactly.
    transform=u.Transform(u.Vector(x,y,height*.24),u.Rotator(),u.Vector(tree['diameter_cm']/100,tree['diameter_cm']/100,height*.48/100))
    assert trunks.update_instance_transform(i,transform,True,i==len(park['trees'])-1,True)
    mesh=meshes[f"Canopy{tree['style']}_{p['variant']}"];bounds=mesh.get_bounds()
    scale=radius/max(bounds.box_extent.x,bounds.box_extent.y)
    crowns.setdefault((tree['style'],p['variant'],p['color']),[]).append(u.Transform(u.Vector(x,y,0),u.Rotator(yaw=p['yaw']),u.Vector(scale,scale*p['width_ratio'],height/(bounds.origin.z+bounds.box_extent.z))))
new=[]
for (style,variant,color),transforms in crowns.items():
    actor=editor.spawn_actor_from_class(instances,u.Vector());assert actor
    actor.set_actor_label(f'Comic park inventory crowns refreshed {style} {variant} {color}')
    comp=actor.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
    mesh=meshes[f'Canopy{style}_{variant}'];comp.set_static_mesh(mesh);comp.set_collision_profile_name('NoCollision')
    for i,slot in enumerate(mesh.get_editor_property('static_materials')):
        label=str(slot.material_slot_name);comp.set_material(i,leaf_mats[color,int(label[-1])] if label.startswith('Leaf') else mats['Wood'])
    comp.add_instances(transforms,False,True,False)
    assert comp.get_instance_count()==len(transforms)
    new.append(actor)
assert sum(a.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent).get_instance_count() for a in new)==len(park['trees'])
for actor in old_crowns:editor.destroy_actor(actor)
for actor in actors:
    if actor.get_actor_label()=='Environment architecture accents':editor.destroy_actor(actor)
accents=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector());accents.set_actor_label('Environment architecture accents')
accents.static_mesh_component.set_static_mesh(meshes['ArchitectureAccents'])
accents.static_mesh_component.set_collision_profile_name('NoCollision')
for actor in editor.get_all_level_actors():
    if actor.get_actor_label()=='OSM Grass':actor.static_mesh_component.set_material(0,material('Grass',(.095,.185,.075)))
    if actor.get_actor_label()=='Comic park mapped landmarks':
        comp=actor.static_mesh_component
        for i,slot in enumerate(comp.static_mesh.get_editor_property('static_materials')):
            if str(slot.material_slot_name) in mats:comp.set_material(i,mats[str(slot.material_slot_name)])

# Pond water stays on the mapped polygons; reduce the tropical blue/metallic finish.
water=assets.load_asset('/Game/Art/M_Water_Finish')
assert isinstance(water,u.Material)
color=M.get_material_property_input_node(water,u.MaterialProperty.MP_BASE_COLOR)
assert isinstance(color,u.MaterialExpressionConstant3Vector)
color.set_editor_property('constant',u.LinearColor(.035,.085,.075,1))
for prop,value in ((u.MaterialProperty.MP_ROUGHNESS,.28),(u.MaterialProperty.MP_METALLIC,0.)):
    node=M.get_material_property_input_node(water,prop);assert isinstance(node,u.MaterialExpressionConstant)
    node.set_editor_property('r',value)
normal=M.get_material_property_input_node(water,u.MaterialProperty.MP_NORMAL)
if not isinstance(normal,u.MaterialExpressionCustom):
    normal=M.create_material_expression(water,u.MaterialExpressionCustom)
    inputs=[]
    for input_name in ('Position','Seconds'):
        entry=u.CustomInput();entry.set_editor_property('input_name',input_name);inputs.append(entry)
    normal.set_editor_property('inputs',inputs)
normal.set_editor_property('code',(ROOT/'Scripts/pond_normal.hlsl').read_text())
normal.set_editor_property('output_type',u.CustomMaterialOutputType.CMOT_FLOAT3)
normal.set_editor_property('description','Quiet pond ripples')
for index,(input_name,cls) in enumerate((('Position',u.MaterialExpressionWorldPosition),('Seconds',u.MaterialExpressionTime))):
    connected=M.get_inputs_for_material_expression(water,normal)
    if not connected[index]:
        assert M.connect_material_expressions(M.create_material_expression(water,cls),'',normal,input_name)
assert M.connect_material_property(normal,'',u.MaterialProperty.MP_NORMAL)
M.recompile_material(water);assert assets.save_loaded_asset(water)
style_path=ROOT/'Scripts/apply_city_comic_style.py'
exec(compile(style_path.read_text(),str(style_path),'exec'),{'__name__':'__environment_city_style__','__file__':str(style_path)})
after=gameplay_snapshot()
differences={key:{'before':before.get(key),'after':after.get(key)}
             for key in sorted(set(before)|set(after)) if before.get(key)!=after.get(key)}
if differences:
    failure_path=ROOT/'Saved/Tests/EnvironmentRefreshFailure.json'
    failure_path.parent.mkdir(parents=True,exist_ok=True)
    failure_path.write_text(json.dumps({'passed':False,'gameplay_changes':differences,'backup':str(backup)},indent=2)+'\n')
    u.log_error('NORD_ENVIRONMENT_GAMEPLAY_DIFF '+json.dumps(differences))
    raise AssertionError('Appearance refresh changed gameplay actors; see '+str(failure_path))
assert levels.save_current_level()
report={'passed':True,'trees':len(park['trees']),'crown_batches':len(new),'facade_edges':len(data['sherbrooke_facades']),
        'gameplay_actors_preserved':len(before),'backup':str(backup),'limits':data['limits']}
(ROOT/'Saved/Tests').mkdir(parents=True,exist_ok=True)
(ROOT/'Saved/Tests/EnvironmentRefresh.json').write_text(json.dumps(report,indent=2)+'\n')
u.log('NORD_ENVIRONMENT_REFRESH_OK '+json.dumps(report))
