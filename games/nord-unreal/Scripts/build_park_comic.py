"""Import original art and add mapped park detail to the saved LaFontaine level."""
import json
import math
import shutil
import textwrap
from pathlib import Path
import unreal as u

ROOT=Path(u.Paths.project_dir()).resolve()
data=json.loads((ROOT/'Data/ParkComic/layout.json').read_text())
layout=json.loads((ROOT/'Data/LaFontaine/layout.json').read_text())
assets=u.EditorAssetLibrary;M=u.MaterialEditingLibrary;tools=u.AssetToolsHelpers.get_asset_tools()
editor=u.get_editor_subsystem(u.EditorActorSubsystem);levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
assert levels.get_current_level().get_outer().get_name()=='LaFontaine'
assert not u.EditorLevelLibrary.get_pie_worlds(False),'Stop PIE before rebuilding the park'
backup=ROOT/'Saved/Recovery/pre-park-scene/LaFontaine.umap';backup.parent.mkdir(parents=True,exist_ok=True)
assert levels.save_current_level()
if not backup.exists():shutil.copy2(ROOT/'Content/Maps/LaFontaine.umap',backup)
instances_class=u.load_class(None,'/Script/Quebec.QuebecParkInstances')
resident_class=u.load_class(None,'/Script/Quebec.QuebecParkResident')
assert instances_class and resident_class,'Build the editor module first'
parent=assets.load_asset('/Game/ParkComic/M_Palette') if assets.does_asset_exist('/Game/ParkComic/M_Palette') else tools.create_asset('M_Palette','/Game/ParkComic',u.Material,u.MaterialFactoryNew())
M.delete_all_material_expressions(parent)
tint=M.create_material_expression(parent,u.MaterialExpressionVectorParameter);tint.set_editor_property('parameter_name','Tint')
assert M.connect_material_property(tint,'',u.MaterialProperty.MP_BASE_COLOR)
rough=M.create_material_expression(parent,u.MaterialExpressionConstant);rough.set_editor_property('r',.78)
assert M.connect_material_property(rough,'',u.MaterialProperty.MP_ROUGHNESS)
for usage in (u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES,u.MaterialUsage.MATUSAGE_NANITE):M.set_base_material_usage(parent,usage,True)
M.recompile_material(parent);assert assets.save_loaded_asset(parent)

def material(name,color):
    path='/Game/ParkComic/M_'+name
    mat=assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset('M_'+name,'/Game/ParkComic',u.MaterialInstanceConstant,u.MaterialInstanceConstantFactoryNew())
    M.set_material_instance_parent(mat,parent);M.set_material_instance_vector_parameter_value(mat,'Tint',u.LinearColor(*color,1))
    assert assets.save_loaded_asset(mat)
    return mat

mats={name:material(name,color) for name,color in data['palette'].items()}
# Unlit illustration inks need daylight-scale emission under the outdoor exposure.
def daylight_material(name,color=None,texture=None):
    path='/Game/ParkComic/M_'+name
    mat=assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset('M_'+name,'/Game/ParkComic',u.Material,u.MaterialFactoryNew())
    M.delete_all_material_expressions(mat);mat.set_editor_property('shading_model',u.MaterialShadingModel.MSM_UNLIT)
    if texture:
        task=u.AssetImportTask();task.set_editor_property('filename',str(ROOT/'Data/ParkComic/References'/texture));task.set_editor_property('destination_path','/Game/ParkComic');task.set_editor_property('automated',True);task.set_editor_property('replace_existing',True);task.set_editor_property('save',True)
        tools.import_asset_tasks([task]);tex=assets.load_asset(task.get_editor_property('imported_object_paths')[0]);assert tex
        source=M.create_material_expression(mat,u.MaterialExpressionTextureSample);source.set_editor_property('texture',tex)
    else:
        source=M.create_material_expression(mat,u.MaterialExpressionConstant3Vector);source.set_editor_property('constant',u.LinearColor(*color,1))
    mul=M.create_material_expression(mat,u.MaterialExpressionMultiply);mul.set_editor_property('const_b',3500.)
    assert M.connect_material_expressions(source,'RGB' if texture else '',mul,'A')
    assert M.connect_material_property(mul,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
    for usage in (u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES,u.MaterialUsage.MATUSAGE_NANITE):M.set_base_material_usage(mat,usage,True)
    M.recompile_material(mat);assert assets.save_loaded_asset(mat);return mat
mats['CrewFace']=daylight_material('IllustrationCrew',texture='CottageFive.png')
mats['BrawlFace']=daylight_material('IllustrationBrawl',texture='BrawlCrew.png')
# White ink is assigned directly so instances cannot retain the old lit shader.
paper=daylight_material('Paper',color=(.80,.78,.67))
mats['White']=paper
text_path='/Game/ParkComic/M_Text'
if assets.does_asset_exist(text_path):assets.delete_asset(text_path)
text_mat=assets.duplicate_asset('/Engine/EngineMaterials/DefaultTextMaterialOpaque',text_path);assert text_mat
source=M.get_material_property_input_node(text_mat,u.MaterialProperty.MP_EMISSIVE_COLOR) or M.get_material_property_input_node(text_mat,u.MaterialProperty.MP_BASE_COLOR);assert source
text_mat.set_editor_property('shading_model',u.MaterialShadingModel.MSM_UNLIT)
mul=M.create_material_expression(text_mat,u.MaterialExpressionMultiply);mul.set_editor_property('const_b',3500.)
assert M.connect_material_expressions(source,'',mul,'A');assert M.connect_material_property(mul,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
M.recompile_material(text_mat);assert assets.save_loaded_asset(text_mat)
for index,color in enumerate(((.035,.26,.24),(.38,.045,.07),(.52,.32,.035),(.07,.15,.34))):material('CarPaint'+str(index),color)
leaf_palettes=((.06,.18,.07),(.34,.22,.025),(.32,.075,.025),(.07,.22,.15))
for color,base in enumerate(leaf_palettes):
    for shade,mult in enumerate((.75,1.,1.2)):mats[f'Leaves{color}_{shade}']=material(f'Leaves{color}_{shade}',tuple(v*mult for v in base))
# Reuse the municipal importer collision refresh rather than maintaining a second import path.
source=(ROOT/'Scripts/import_city_buildings.py').read_text();exec(source[source.index('def mesh_import'):source.index('# Shared parent')])
meshes={name:assets.load_asset('/Engine/BasicShapes/'+name) for name in ('Cube','Cylinder','Sphere','Cone')}
for model in data['models']:
    name=Path(model['file']).stem;mesh=mesh_import(ROOT/'Data/ParkComic/Geometry'/model['file'],'/Game/ParkComic','SM_'+name)
    for i,slot in enumerate(mesh.get_editor_property('static_materials')):
        assert str(slot.material_slot_name) in mats,str(slot.material_slot_name)
        mesh.set_material(i,mats[str(slot.material_slot_name)])
    if name.startswith('TreeCrown'):
        settings=mesh.get_editor_property('nanite_settings');settings.set_editor_property('enabled',True)
        u.get_editor_subsystem(u.StaticMeshEditorSubsystem).set_nanite_settings(mesh,settings,True)
    assert assets.save_loaded_asset(mesh);meshes[name]=mesh
# Remove only this pass's scene actors and previous tree/furniture placeholders.
for actor in editor.get_all_level_actors():
    label=actor.get_actor_label()
    if label.startswith(('Comic park ','Comic resident ','Comic parked car ','Detailed tree ','Street detail ')):editor.destroy_actor(actor)
    elif label in ('OSM Wood','OSM HiddenTrunks','OSM Canopy','OSM CanopyGold','OSM CanopyRust'):
        actor.set_actor_hidden_in_game(True);actor.static_mesh_component.set_visibility(False)
        actor.static_mesh_component.set_collision_profile_name('NoCollision')
# Reimport the five generic batches after excluding the mapped landmark footprints.
by_name={a.get_actor_label():a for a in editor.get_all_level_actors()}
by_name['OSM Grass'].static_mesh_component.set_material(0,mats['Grass'])
for name in ('Brick','Cream','Sage','Roof','Glass'):
    mesh=mesh_import(ROOT/'Data/LaFontaine/Geometry'/f'{name}.obj','/Game/LaFontaine','SM_'+name)
    by_name['OSM '+name].static_mesh_component.set_static_mesh(mesh)
    by_name['OSM '+name].static_mesh_component.set_collision_profile_name('NoCollision' if name=='Glass' else 'BlockAll')

def batch(label,mesh,transforms,materials=None,collision=False):
    actor=editor.spawn_actor_from_class(instances_class,u.Vector())
    actor.set_actor_label('Comic park '+label)
    comp=actor.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
    comp.set_static_mesh(mesh)
    if materials:
        for i,mat in enumerate(materials):comp.set_material(i,mat)
    comp.set_collision_profile_name('BlockAll' if collision else 'NoCollision')
    comp.add_instances(transforms,False,True,False)
    assert comp.get_instance_count()==len(transforms),(label,comp.get_instance_count(),len(transforms))
    return actor

def transform(p,size,yaw=0):return u.Transform(u.Vector(*p),u.Rotator(yaw=yaw),u.Vector(*size))
trunks=[];crowns={}
for tree in data['trees']:
    x,y=tree['xy'];height=tree['height_cm'];diameter=tree['diameter_cm'];radius=tree['crown_radius_cm']
    trunks.append(transform((x,y,height*.32),(diameter/100,diameter/100,height*.64/100)))
    mesh=meshes['TreeCrown'+str(tree['style'])];bounds=mesh.get_bounds();zmax=bounds.origin.z+bounds.box_extent.z
    scale=radius/max(bounds.box_extent.x,bounds.box_extent.y)
    crowns.setdefault((tree['style'],tree['color']),[]).append(transform((x,y,0),(scale,scale,height/zmax),tree['seed']%360))
batch('inventory trunks',meshes['Cylinder'],trunks,[mats['Wood']],True)
for (style,color),transforms in crowns.items():
    mesh=meshes['TreeCrown'+str(style)]
    materials=[mats['Leaves'+str(color)+'_'+str(int(str(s.material_slot_name)[-1]))] if str(s.material_slot_name).startswith('Leaf') else mats['Wood'] for s in mesh.get_editor_property('static_materials')]
    batch(f'inventory crowns {style} {color}',mesh,transforms,materials)
# Furniture is instanced by shared mesh and colour, keeping thousands of details inexpensive.
groups={}
def part(mesh,mat,p,size,yaw=0):groups.setdefault((mesh,mat),[]).append(transform(p,[v/100 for v in size],yaw))
def yaw_near_path(p):
    best=None
    for line in data['paths']:
        for a,b in zip(line,line[1:]):
            dx,dy=b[0]-a[0],b[1]-a[1];length=dx*dx+dy*dy
            if length<1:continue
            t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length));d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
            if best is None or d<best[0]:best=(d,math.degrees(math.atan2(dy,dx)))
    return best[1] if best else 0
for f in data['furniture']:
    x,y=f['xy'];kind=f['kind']
    if kind=='bench':
        yaw=yaw_near_path((x,y));a=math.radians(yaw)
        try:yaw=float(f['direction'])-90 if f['direction'] else yaw
        except ValueError:pass
        a=math.radians(yaw)
        def local(dx,dy,z):return (x+math.cos(a)*dx-math.sin(a)*dy,y+math.sin(a)*dx+math.cos(a)*dy,z)
        for d in (-17,0,17):part('Cube','Wood',local(0,d,47),(180,14,7),yaw)
        for z in (72,91):part('Cube','Wood',local(0,29,z),(180,7,16),yaw)
        for dx in (-65,65):
            part('Cube','Ink',local(dx,0,25),(8,48,50),yaw);part('Cube','Ink',local(dx,28,65),(8,8,65),yaw)
    elif kind=='street_lamp':
        part('Cylinder','Ink',(x,y,245),(13,13,490));part('Cylinder','Ink',(x,y,495),(65,65,15))
        part('Sphere','Cream',(x,y,477),(39,39,43));part('Cone','Ink',(x,y,514),(78,78,35))
    elif kind=='drinking_water':
        part('Cylinder','Paint',(x,y,45),(35,35,90));part('Cylinder','Cream',(x,y,95),(55,55,12))
    elif kind=='waste_basket':
        part('Cylinder','Ink',(x,y,45),(55,55,90));part('Cylinder','Paint',(x,y,92),(63,63,10))
for d in data['details']:part(d['mesh'],d['material'],d['position'],d['size'],d['yaw'])
for (mesh,mat),transforms in groups.items():batch(mesh+' '+mat,meshes[mesh],transforms,[mats[mat]],mat in ('Wood','Stone'))
landmark=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector());landmark.set_actor_label('Comic park mapped landmarks')
landmark.static_mesh_component.set_static_mesh(meshes['ParkLandmarks']);landmark.static_mesh_component.set_collision_profile_name('BlockAll')
for s in data['signs']:
    actor=editor.spawn_actor_from_class(u.TextRenderActor,u.Vector(*s['position']),u.Rotator(yaw=s['yaw']))
    actor.set_actor_label('Comic park sign '+s['text']);comp=actor.get_component_by_class(u.TextRenderComponent)
    comp.set_text('\n'.join(textwrap.wrap(s['text'],32)));comp.set_world_size(s['size']);comp.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER)
    comp.set_text_render_color(u.Color(255,244,194,255));comp.set_text_material(text_mat)
for i,r in enumerate(data['residents']):
    actor=editor.spawn_actor_from_class(resident_class,u.Vector(*r['route'][0]))
    actor.set_actor_label('Comic resident '+str(i));actor.set_editor_property('Style',r['style']);actor.set_editor_property('Phase',r['phase'])
    actor.set_editor_property('Route',[u.Vector(*p) for p in r['route']])
# Place a small driveable fleet along long mapped streets, away from the starting car.
car_class=u.load_class(None,'/Script/Quebec.QuebecCar');parked=[]
for road in layout['roads']:
    for a,b in zip(road,road[1:]):
        length=math.dist(a,b)
        if length<4500 or len(parked)>=8:continue
        dx,dy=(b[0]-a[0])/length,(b[1]-a[1])/length
        p=((a[0]+b[0])/2-dy*210,(a[1]+b[1])/2+dx*210,115)
        if math.dist(p[:2],layout['car'][:2])<6000 or any(math.dist(p[:2],q[:2])<4000 for q in parked):continue
        if not (-43000<p[0]<53000 and -43000<p[1]<65000):continue
        hit=u.SystemLibrary.box_trace_single(u.EditorLevelLibrary.get_editor_world(),u.Vector(*p),u.Vector(p[0],p[1],p[2]+1),u.Vector(220,108,90),u.Rotator(yaw=math.degrees(math.atan2(dy,dx))),u.TraceTypeQuery.TRACE_TYPE_QUERY1,False,[],u.DrawDebugTrace.NONE,True)
        if hit is not None:continue
        actor=editor.spawn_actor_from_class(car_class,u.Vector(*p),u.Rotator(yaw=math.degrees(math.atan2(dy,dx))))
        actor.set_actor_label('Comic parked car '+str(len(parked)));actor.set_editor_property('PaintStyle',len(parked)%4);parked.append(p)
assert len(parked)>=3,'No clear roadside spaces found'
assert levels.save_current_level();assert assets.save_directory('/Game/ParkComic')
report={'passed':True,'inventory_trees':len(trunks),'park_inventory_trees':sum(t['park']=='LA FONTAINE' for t in data['trees']),'mapped_furniture':len(data['furniture']),'sports_pitches':len(data['pitches']),'instanced_details':sum(len(g) for g in groups.values()),'residents':len(data['residents']),'parked_cars':len(parked),'original_meshes':len(data['models']),'landmark_overrides':data['landmark_overrides']}
(ROOT/'Saved/Tests/ParkBuild.json').write_text(json.dumps(report,indent=2))
u.log('NORD_PARK_BUILD_OK '+json.dumps(report))
