"""Import the prepared OSM geometry and save a separate playable Unreal map."""
import json
from pathlib import Path
import unreal as u
ROOT=Path(u.Paths.project_dir()).resolve()
DATA=ROOT/'Data/LaFontaine'
layout=json.loads((DATA/'layout.json').read_text())
MAP='/Game/Maps/LaFontaine'
assets=u.EditorAssetLibrary
assert not assets.does_asset_exist(MAP),'Map exists; preserve edits before regenerating'
editor=u.get_editor_subsystem(u.EditorActorSubsystem)
levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
assert levels.new_level(MAP)
# Reuse the prototype palette and helpers without executing its world generator.
source=(ROOT/'Scripts/create_world.py').read_text()
helpers=source[source.index('def material('):source.index('shape("Neighborhood ground"')]
tools=u.AssetToolsHelpers.get_asset_tools()
exec(helpers)
for name,color in {'Path':(.43,.40,.34),'Court':(.18,.34,.27),'Marking':(.85,.73,.39),
                   'Water':(.025,.22,.28),'Canopy':(.23,.34,.12),'CanopyGold':(.68,.34,.035),'CanopyRust':(.47,.11,.035)}.items():
    mats[name]=material('M_LF_'+name,color)
mats['HiddenTrunks']=mats['Wood']
for obj in sorted((DATA/'Geometry').glob('*.obj')):
    name=obj.stem
    task=u.AssetImportTask();task.filename=str(obj);task.destination_path='/Game/LaFontaine';task.destination_name='SM_'+name
    task.automated=True;task.save=True;task.replace_existing=True
    options=u.FbxImportUI();options.import_mesh=True;options.import_materials=False;options.import_textures=False
    options.import_as_skeletal=False;options.static_mesh_import_data.combine_meshes=True
    options.static_mesh_import_data.auto_generate_collision=False;task.options=options
    tools.import_asset_tasks([task])
    assert task.imported_object_paths,'Import failed: '+name
    mesh=assets.load_asset(task.imported_object_paths[0]);assert isinstance(mesh,u.StaticMesh)
    collision=name in ('Brick','Cream','Sage','Roof','Wood','HiddenTrunks')
    if collision:
        mesh.get_editor_property('body_setup').set_editor_property('collision_trace_flag',u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    actor=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector())
    actor.set_actor_label('OSM '+name)
    if name=='HiddenTrunks':actor.set_actor_hidden_in_game(True)
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.static_mesh_component.set_material(0,mats[name])
    actor.static_mesh_component.set_collision_profile_name('BlockAll' if collision else 'NoCollision')
    assets.save_loaded_asset(mesh)
    u.log('LAFONTAINE_IMPORTED '+name+' '+str(mesh.get_bounds()))
lo=layout['bounds'];origin=layout['origin']
import math
project=lambda lat,lon:((lon-origin[1])*111320*math.cos(math.radians(origin[0]))*100,(lat-origin[0])*111320*100)
a,b=project(lo[0],lo[1]),project(lo[2],lo[3]);cx,cy=(a[0]+b[0])/2,(a[1]+b[1])/2
shape('District ground',(cx,cy,-100),(b[0]-a[0],b[1]-a[1],200),'Stone')
for x in (a[0],b[0]):shape('District edge',(x,cy,100),(70,b[1]-a[1],200),'Stone')
for y in (a[1],b[1]):shape('District edge',(cx,y,100),(b[0]-a[0],70,200),'Stone')
for offset in (0,160,-160,320):
    p=layout['spawn'];start=editor.spawn_actor_from_class(u.PlayerStart,u.Vector(p[0]+offset,p[1],p[2]),u.Rotator(yaw=layout['car_yaw']))
    start.set_actor_label('1334 Sherbrooke sidewalk spawn')
car=editor.spawn_actor_from_class(u.load_class(None,'/Script/Quebec.QuebecCar'),u.Vector(*layout['car']),u.Rotator(yaw=layout['car_yaw']))
car.set_actor_label('Your first car')
for i,p in enumerate(layout['missions']):
    shape('Mission ring',(*p[:2],16),(380,380,20),'Beacon','Cylinder',collision=False)
    shape('Mission beacon',(*p[:2],240),(20,20,460),'Beacon','Cylinder',collision=False)
# Named rotations avoid Python Rotator's roll/pitch/yaw positional order.
sun=editor.spawn_actor_from_class(u.DirectionalLight,u.Vector(0,0,3000),u.Rotator(pitch=-38,yaw=-35))
sun.light_component.set_editor_property('mobility',u.ComponentMobility.MOVABLE)
sun.light_component.set_editor_property('intensity',18000.)
sun.light_component.set_editor_property('atmosphere_sun_light',True)
sun.light_component.set_editor_property('light_source_angle',2.)
editor.spawn_actor_from_class(u.SkyAtmosphere,u.Vector())
sky=editor.spawn_actor_from_class(u.SkyLight,u.Vector(0,0,1000))
sky.light_component.set_editor_property('mobility',u.ComponentMobility.MOVABLE)
sky.light_component.set_editor_property('real_time_capture',True)
sky.light_component.set_editor_property('intensity',1.3)
post=editor.spawn_actor_from_class(u.PostProcessVolume,u.Vector());post.set_editor_property('unbound',True)
settings=post.get_editor_property('settings')
for k,v in {'override_auto_exposure_min_brightness':True,'override_auto_exposure_max_brightness':True,'auto_exposure_min_brightness':13.,'auto_exposure_max_brightness':13.}.items():settings.set_editor_property(k,v)
post.set_editor_property('settings',settings)
u.get_editor_subsystem(u.UnrealEditorSubsystem).set_level_viewport_camera_info(u.Vector(70000,-60000,70000),u.Rotator(pitch=-42,yaw=135))
assets.save_directory('/Game/Materials');assets.save_directory('/Game/LaFontaine')
assert levels.save_current_level()
assert len([a for a in editor.get_all_level_actors() if isinstance(a,u.PlayerStart)])==4
u.log('LAFONTAINE_WORLD_OK '+str(layout['counts']))
