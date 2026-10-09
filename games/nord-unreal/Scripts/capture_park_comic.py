"""Capture actual PIE car, resident and park views, then exit automatically."""
import json
import math
import time
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir()).resolve();out=root/'Preview';out.mkdir(exist_ok=True)
data=json.loads((root/'Data/ParkComic/layout.json').read_text())
levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
settings=u.get_default_object(u.load_class(None,'/Script/UnrealEd.LevelEditorPlaySettings'))
script=u.get_default_object(u.load_class(None,'/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
system=u.get_default_object(u.load_class(None,'/Script/Engine.KismetSystemLibrary'))
gameplay=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics'))
old=settings.get_editor_property('PlayNumberOfClients');settings.set_editor_property('PlayNumberOfClients',1)
script.call_method('SetKeepPythonScriptAlive',(True,))
system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',0))
state={'phase':0,'start':time.monotonic(),'shot':0,'frames':[]};shots=[]
def finish():
    levels.editor_request_end_play();settings.set_editor_property('PlayNumberOfClients',old)
    system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',1));u.unregister_slate_post_tick_callback(state['callback'])
    script.call_method('SetKeepPythonScriptAlive',(False,))
def aim(position,target):
    delta=target-position;yaw=math.degrees(math.atan2(delta.y,delta.x));pitch=math.degrees(math.atan2(delta.z,math.hypot(delta.x,delta.y)))
    state['camera'].set_actor_location_and_rotation(position,u.Rotator(pitch=pitch,yaw=yaw),False,True)
def tick(dt):
    try:
        now=time.monotonic();assert now-state['start']<240,'Capture timed out'
        if state['phase']==0 and now-state['start']>2:levels.editor_request_begin_play();state['phase']=1
        elif state['phase']==1:
            worlds=u.EditorLevelLibrary.get_pie_worlds(True)
            if not worlds:return
            world=worlds[0];pc=u.GameplayStatics.get_player_controller(world,0)
            if not pc or not pc.get_controlled_pawn():return
            transform=u.Transform(u.Vector(0,0,1000))
            camera=gameplay.call_method('BeginDeferredActorSpawnFromClass',(world,u.CameraActor.static_class(),transform,u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN,None,u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
            gameplay.call_method('FinishSpawningActor',(camera,transform,u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
            camera.get_component_by_class(u.CameraComponent).set_editor_property('post_process_blend_weight',1.)
            camera.get_component_by_class(u.CameraComponent).set_editor_property('field_of_view',65.)
            pc.set_view_target_with_blend(camera,0)
            u.SystemLibrary.execute_console_command(world,'showhud',pc)
            residents=u.GameplayStatics.get_all_actors_of_class(world,u.load_class(None,'/Script/Quebec.QuebecParkResident'))
            cars=u.GameplayStatics.get_all_actors_of_class(world,u.load_class(None,'/Script/Quebec.QuebecCar'))
            assert len(residents)==len(data['residents']) and len(cars)>=4
            state.update(world=world,pc=pc,camera=camera,residents=residents,car=cars[0])
            c=cars[0].get_actor_location();f=cars[0].get_actor_forward_vector();r=cars[0].get_actor_right_vector()
            shots.extend([('ParkComicCar',c+f*580+r*430+u.Vector(0,0,240),c+u.Vector(0,0,10),None)])
            for style in range(11):
                resident=next(a for a in residents if a.get_editor_property('Style')==style)
                shots.append(('ParkComicResident'+str(style),None,None,resident))
            shots.extend([
                ('ParkComicTheatre',u.Vector(-11500,1700,750),u.Vector(-9750,5100,250),None),
                ('ParkComicChalet',u.Vector(6367,2761,900),u.Vector(2920,2150,280),None),
                ('ParkComicCentre',u.Vector(7510,22944,1000),u.Vector(4010,22944,350),None),
                ('ParkComicCourts',u.Vector(35000,36000,9000),u.Vector(22000,28000,0),None),
                ('ParkComicPond',u.Vector(17000,-21000,300),u.Vector(1100,1000,120),None),
                ('ParkComicOverview',u.Vector(64000,-62000,74000),u.Vector(3000,14000,0),None)])
            state.update(phase=2,ready=now)
        elif state['phase']==2:
            name,p,target,resident=shots[state['shot']]
            if resident:
                p=resident.get_actor_location()+resident.get_actor_forward_vector()*520+resident.get_actor_right_vector()*150+u.Vector(0,0,185)
                target=resident.get_actor_location()+u.Vector(0,0,140)
            aim(p,target)
            if now-state['ready'] > (20 if state['shot']==0 else 5):
                path=out/(name+'.png')
                u.SystemLibrary.execute_console_command(state['world'],'HighResShot 1600x900 filename="'+str(path)+'"',state['pc'])
                state.update(phase=3,ready=now)
            if now-state['ready']>2:state['frames'].append(dt)
        elif state['phase']==3 and now-state['ready']>2:
            path=out/(shots[state['shot']][0]+'.png');assert path.exists() and path.stat().st_size>10000,str(path)
            u.log('NORD_PARK_SHOT '+str(path));state['shot']+=1
            if state['shot']==len(shots):
                u.log('NORD_PARK_PREVIEW_OK '+str(len(shots))+' shots');finish()
            else:state.update(phase=2,ready=now)
    except Exception as exc:
        u.log_error('NORD_PARK_PREVIEW_FAILED '+repr(exc));finish()
state['callback']=u.register_slate_post_tick_callback(tick)
