"""Capture the complete Meshy crew, each full body, and revised face in actual PIE, then exit automatically."""
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
            pitch=max((p for p in data['pitches'] if p['sport']=='soccer'),key=lambda p:abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p['points'],p['points'][1:]))))
            points=pitch['points'][:-1];x=sum(p[0] for p in points)/len(points);y=sum(p[1] for p in points)/len(points)
            camera.get_component_by_class(u.CameraComponent).set_editor_property('field_of_view',55.)
            for i,style in enumerate(range(3,11)):
                resident=next(a for a in residents if a.get_editor_property('Style')==style)
                resident.set_editor_property('Route',[])
                resident.get_component_by_class(u.TextRenderComponent).set_hidden_in_game(True)
                resident.set_actor_location_and_rotation(u.Vector(x,y+(i-3.5)*110,7),u.Rotator(),False,True)
                resident.get_component_by_class(u.TextRenderComponent).set_visibility(False)
            shots.append(('CottageCrew',u.Vector(x+900,y,135),u.Vector(x,y,100),None))
            for style in range(3,11):
                resident=next(a for a in residents if a.get_editor_property('Style')==style)
                shots.append(('MeshyResident'+str(style),None,None,resident))
            resident=next(a for a in residents if a.get_editor_property('Style')==9)
            p=resident.get_actor_location()
            shots.append(('SkullShirtFace',p+u.Vector(120,10,170),p+u.Vector(0,0,165),None))
            state.update(phase=2,ready=now)
        elif state['phase']==2:
            name,p,target,resident=shots[state['shot']]
            for other in state['residents']:
                other.set_actor_hidden_in_game(resident is not None and other!=resident)
            if resident:
                p=resident.get_actor_location()+resident.get_actor_forward_vector()*300+resident.get_actor_right_vector()*60+u.Vector(0,0,110)
                target=resident.get_actor_location()+u.Vector(0,0,98)
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
