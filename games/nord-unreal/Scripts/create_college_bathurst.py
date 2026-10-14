"""Import the prepared College and Bathurst OBJ blockout into a separate greybox map.

Editor only. Run Scripts/prepare_college_bathurst.py first, then start the editor on an engine map so
La Fontaine is never loaded, for example:
UnrealEditor-Cmd "$PWD/Quebec.uproject" /Engine/Maps/Entry -NullRHI -ExecutePythonScript="$PWD/Scripts/create_college_bathurst.py" -unattended -nop4
"""
import json
import math
import shlex
from pathlib import Path
import unreal as u

# Importing geometry and saving assets must happen in a fresh offline editor, before rendering.
assert '-nullrhi' in [argument.lower() for argument in shlex.split(u.SystemLibrary.get_command_line())], \
    'Use a fresh -NullRHI editor for College/Bathurst authoring'
ROOT=Path(u.Paths.project_dir()).resolve()
DATA=ROOT/'Data/CollegeBathurst'
layout=json.loads((DATA/'layout.json').read_text())
assert all(key in layout for key in ('bounds_cm','spawn','car','car_yaw','counts')), 'Incomplete Toronto layout'
assert len(layout['bounds_cm'])==4 and len(layout['spawn'])==len(layout['car'])==3, 'Invalid Toronto layout vectors'
assert all(isinstance(value,(int,float)) and math.isfinite(value)
           for value in [*layout['bounds_cm'],*layout['spawn'],*layout['car'],layout['car_yaw']]), \
    'Non-finite Toronto layout coordinates'
assert layout['bounds_cm'][0]<layout['bounds_cm'][2] and layout['bounds_cm'][1]<layout['bounds_cm'][3], \
    'Invalid Toronto layout bounds'
assert isinstance(layout['counts'],dict),'Invalid Toronto layout counts'
MAP='/Game/Maps/CollegeBathurst'
# Existing Plateau materials; nothing new is authored for the greybox.
MATERIALS={'Road':'Asphalt','Marking':'Yellow','Path':'Concrete','Tram':'Iron','Grass':'ParkGrass','Ground':'Concrete',
           'Roof':'Roof','Brick':'BrickRed','Cream':'Limestone','Sage':'SageBackground','Glass':'Glass','Landmark':'BrickRed'}
BLOCKING=('Brick','Cream','Sage','Roof','Landmark')
# Resolve every prerequisite before new_level, imports, actor creation or saves.
required_classes=('StaticMesh','MaterialInterface','StaticMeshActor','PlayerStart','DirectionalLight',
                  'SkyAtmosphere','SkyLight','ExponentialHeightFog','ExponentialHeightFogComponent',
                  'VolumetricCloud','VolumetricCloudComponent','PostProcessVolume','AssetImportTask',
                  'FbxImportUI','EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem',
                  'Vector','Rotator')
assert all(getattr(u,name,None) is not None for name in required_classes), \
    'Missing Unreal class: '+', '.join(name for name in required_classes if getattr(u,name,None) is None)
assets=u.EditorAssetLibrary
assert not assets.does_asset_exist(MAP),'Map exists; preserve edits before regenerating'
assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), \
    'Unsaved map edits; start a fresh offline editor on /Engine/Maps/Entry'
objs=sorted((DATA/'Geometry').glob('*.obj'))
assert {obj.stem for obj in objs}==set(MATERIALS), \
    'Required OBJ groups differ; run Scripts/prepare_college_bathurst.py first'
assert all(obj.is_file() and obj.stat().st_size>0 for obj in objs),'Missing or empty College/Bathurst OBJ'
assert not any(assets.does_asset_exist('/Game/CollegeBathurst/SM_'+obj.stem) for obj in objs), \
    'Toronto meshes exist; preserve the earlier authoring attempt before regenerating'
mats={name:assets.load_asset('/Game/Plateau/Materials/M_'+material) for name,material in MATERIALS.items()}
assert all(isinstance(mat,u.MaterialInterface) for mat in mats.values()), \
    'Missing Plateau material: '+', '.join(name for name,mat in mats.items() if not isinstance(mat,u.MaterialInterface))
cube=assets.load_asset('/Engine/BasicShapes/Cube')
assert isinstance(cube,u.StaticMesh),'Missing engine cube mesh'
cloud_material=assets.load_asset('/Engine/EngineSky/VolumetricClouds/m_SimpleVolumetricCloud_Inst')
assert isinstance(cloud_material,u.MaterialInterface),'Missing engine volumetric cloud material'
car_class=u.load_class(None,'/Script/Quebec.QuebecCar')
assert car_class,'Compile QuebecEditor before generating the map'
collision_trace=u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE
movable=u.ComponentMobility.MOVABLE
editor=u.get_editor_subsystem(u.EditorActorSubsystem)
levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
world_editor=u.get_editor_subsystem(u.UnrealEditorSubsystem)
tools=u.AssetToolsHelpers.get_asset_tools()
assert editor and levels and world_editor and tools,'Missing editor subsystem or asset tools'
assert levels.new_level(MAP)
for obj in objs:
    name=obj.stem
    task=u.AssetImportTask();task.filename=str(obj);task.destination_path='/Game/CollegeBathurst';task.destination_name='SM_'+name
    task.automated=True;task.save=True;task.replace_existing=True
    options=u.FbxImportUI();options.import_mesh=True;options.import_materials=False;options.import_textures=False
    options.import_as_skeletal=False;options.static_mesh_import_data.combine_meshes=True
    options.static_mesh_import_data.auto_generate_collision=False;task.options=options
    tools.import_asset_tasks([task])
    assert task.imported_object_paths,'Import failed: '+name
    mesh=assets.load_asset(task.imported_object_paths[0]);assert isinstance(mesh,u.StaticMesh)
    collision=name in BLOCKING
    if collision:
        mesh.get_editor_property('body_setup').set_editor_property('collision_trace_flag',collision_trace)
    actor=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector())
    actor.set_actor_label('Toronto '+name);actor.set_folder_path('CollegeBathurst/Blockout')
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.static_mesh_component.set_material(0,mats[name])
    actor.static_mesh_component.set_collision_profile_name('BlockAll' if collision else 'NoCollision')
    assets.save_loaded_asset(mesh)
    u.log('COLLEGE_BATHURST_IMPORTED '+name+' '+str(mesh.get_bounds()))
# The visual Ground mesh has no collision; a hidden slab under it and edge walls hold players in.
x0,y0,x1,y1=layout['bounds_cm'];cx,cy=(x0+x1)/2,(y0+y1)/2
def block(label,pos,size):
    actor=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector(*pos))
    actor.set_actor_label(label);actor.set_folder_path('CollegeBathurst/Collision')
    actor.static_mesh_component.set_static_mesh(cube);actor.static_mesh_component.set_material(0,mats['Ground'])
    actor.static_mesh_component.set_collision_profile_name('BlockAll')
    actor.set_actor_scale3d(u.Vector(*(s/100 for s in size)));actor.set_actor_hidden_in_game(True)
    return actor
block('Collision floor',(cx,cy,-101),(x1-x0,y1-y0,200))
for x in (x0,x1):block('District edge',(x,cy,150),(70,y1-y0,300))
for y in (y0,y1):block('District edge',(cx,y,150),(x1-x0,70,300))
spawn,yaw=layout['spawn'],layout['car_yaw']
along=(math.cos(math.radians(yaw)),math.sin(math.radians(yaw)))
for offset in (0,160,-160,320):
    start=editor.spawn_actor_from_class(u.PlayerStart,u.Vector(spawn[0]+along[0]*offset,spawn[1]+along[1]*offset,spawn[2]),u.Rotator(yaw=yaw))
    start.set_actor_label("Sneaky Dee's sidewalk spawn")
car=editor.spawn_actor_from_class(car_class,u.Vector(*layout['car']),u.Rotator(yaw=yaw))
car.set_actor_label('Your first car')
# Sun, sky and exposure match the accepted Montreal afternoon; named rotations avoid positional order.
sun=editor.spawn_actor_from_class(u.DirectionalLight,u.Vector(0,0,3000),u.Rotator(pitch=-44,yaw=-35))
sun.light_component.set_editor_property('mobility',movable)
sun.light_component.set_editor_property('intensity',26000.)
sun.light_component.set_editor_property('use_temperature',True)
sun.light_component.set_editor_property('temperature',6200.)
sun.light_component.set_editor_property('atmosphere_sun_light',True)
sun.light_component.set_editor_property('light_source_angle',2.)
editor.spawn_actor_from_class(u.SkyAtmosphere,u.Vector())
sky=editor.spawn_actor_from_class(u.SkyLight,u.Vector(0,0,1000))
sky.light_component.set_editor_property('mobility',movable)
sky.light_component.set_editor_property('real_time_capture',True)
sky.light_component.set_editor_property('intensity',1.9)
fog=editor.spawn_actor_from_class(u.ExponentialHeightFog,u.Vector(0,0,-150)).get_component_by_class(u.ExponentialHeightFogComponent)
fog.set_fog_density(.003);fog.set_start_distance(8000.)
cloud=editor.spawn_actor_from_class(u.VolumetricCloud,u.Vector());cloud.set_actor_label('Toronto clouds')
component=cloud.get_component_by_class(u.VolumetricCloudComponent);component.set_material(cloud_material)
component.set_editor_property('layer_bottom_altitude',1.8);component.set_editor_property('layer_height',1.4)
post=editor.spawn_actor_from_class(u.PostProcessVolume,u.Vector());post.set_editor_property('unbound',True)
settings=post.get_editor_property('settings')
for k,v in {'override_auto_exposure_min_brightness':True,'override_auto_exposure_max_brightness':True,'auto_exposure_min_brightness':12.5,'auto_exposure_max_brightness':12.5}.items():settings.set_editor_property(k,v)
post.set_editor_property('settings',settings)
world_editor.set_level_viewport_camera_info(u.Vector(spawn[0]+4500,spawn[1]-4500,3000),u.Rotator(pitch=-25,yaw=135))
assets.save_directory('/Game/CollegeBathurst')
assert levels.save_current_level()
world=world_editor.get_editor_world()
assert world.get_path_name().startswith(MAP+'.'),world.get_path_name()
assert len([a for a in editor.get_all_level_actors() if isinstance(a,u.PlayerStart)])==4
u.log('COLLEGE_BATHURST_WORLD_OK '+json.dumps(layout['counts']))
