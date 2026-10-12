"""Capture actual PIE car, resident and park views, then exit automatically.

-NordEnvironmentOnly -NordCaptureWidth=1280|1920 writes seven baseline views,
seven neighbourhood close-ups and the same close-ups with native F2 toggled to
Preview/Environment{width}/ and Verification/EnvironmentRender{width}.json.
Omitting the width preserves the original 1600x900 Preview/ output.
"""
import configparser
import json
import math
import re
import struct
import time
from pathlib import Path
def segment_distance(point, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = max(0., min(1., ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/max(dx*dx+dy*dy, 1.e-9)))
    return math.hypot(point[0]-a[0]-dx*t, point[1]-a[1]-dy*t)


def polygon_contains(point, ring):
    inside = False
    for a, b in zip(ring, ring[1:]+ring[:1]):
        if (a[1] > point[1]) != (b[1] > point[1]) and point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]:
            inside = not inside
    return inside


def segments_cross(a, b, c, d):
    cross = lambda p, q, r: (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    return cross(a,b,c)*cross(a,b,d) < 0 and cross(c,d,a)*cross(c,d,b) < 0


def source_camera_clear(position, target, footprints, trees):
    for ring in footprints:
        if polygon_contains(position, ring) or polygon_contains(target, ring):
            return False
        for a, b in zip(ring, ring[1:]+ring[:1]):
            if segment_distance(position,a,b) < 150 or segments_cross(position,target,a,b):
                return False
    dx, dy = target[0]-position[0], target[1]-position[1]
    length = math.hypot(dx,dy)
    for tree in trees:
        vx, vy = tree['xy'][0]-position[0], tree['xy'][1]-position[1]
        distance = math.hypot(vx,vy)
        dot = (vx*dx+vy*dy)/max(distance*length,1.)
        if distance < 350 or (distance < 1000 and dot > math.cos(math.radians(40))):
            return False
        along = (vx*dx+vy*dy)/max(length*length,1.)
        if 0 < along < 1 and segment_distance(tree['xy'],position,target) < tree['diameter_cm']/2+80:
            return False
    return True


def source_facade_view(fronts, footprints, trees, near=None):
    def priority(front):
        center = [sum(p[i] for p in front['edge'])/2 for i in (0,1)]
        return math.dist(center,near) if near else -(front.get('exterior_stairs',0)*10+front.get('balconies',0)*.5)
    for front in sorted(fronts,key=priority):
        center = [sum(p[i] for p in front['edge'])/2 for i in (0,1)]
        normal = front['normal']; along = (-normal[1],normal[0])
        outside = [center[i]+normal[i]*50 for i in (0,1)]
        preferred = max(2200., front['height_cm']*2.)
        for distance in (preferred,preferred+500,preferred-400):
            for shift in (0.,-600.,600.,-1000.,1000.):
                position = [center[i]+normal[i]*distance+along[i]*shift for i in (0,1)]
                if source_camera_clear(position,outside,footprints,trees):
                    return (*position,220.), (*center,min(600.,front['height_cm']*.45)), front['building']
    raise AssertionError('No unobstructed source-backed facade close-up')


import unreal as u
root=Path(u.Paths.project_dir()).resolve();command=u.SystemLibrary.get_command_line()
environment_only='-NordEnvironmentOnly' in command
width_flag=re.search(r'(?:^|\s)-NordCaptureWidth=(\S+)',command)
width=int(width_flag.group(1)) if width_flag else 1600
assert not width_flag or width in (1280,1920), 'NordCaptureWidth must be 1280 or 1920'
height=width*9//16
out=root/'Preview'
if environment_only and width_flag:out=out/f'Environment{width}'
out.mkdir(parents=True,exist_ok=True)
data=json.loads((root/'Data/ParkComic/layout.json').read_text())
levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
settings=u.get_default_object(u.load_class(None,'/Script/UnrealEd.LevelEditorPlaySettings'))
script=u.get_default_object(u.load_class(None,'/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
system=u.get_default_object(u.load_class(None,'/Script/Engine.KismetSystemLibrary'))
gameplay=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics'))
old=settings.get_editor_property('PlayNumberOfClients')
# EPlayNetMode is not exported to Python. Match capture_player_quality.py's
# cold-start settings read before changing the mode for this capture.
config=configparser.ConfigParser(strict=False)
config.read(Path(u.Paths.project_saved_dir())/'Config/LinuxEditor/EditorPerProjectUserSettings.ini')
old_mode={'PIE_Standalone':0,'PIE_ListenServer':1,'PIE_Client':2}[
    config.get('/Script/UnrealEd.LevelEditorPlaySettings','PlayNetMode',fallback='PIE_Standalone')]
settings.set_editor_property('PlayNumberOfClients',1)
script.call_method('SetKeepPythonScriptAlive',(True,))
system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',0))
state={'phase':0,'start':time.monotonic(),'shot':0,'frames':[],'finished':False};shots=[]
report={'passed':False,'resolution':[width,height],'views':[],
        'original_play_net_mode':old_mode,'play_settings_restored':False}
def finish(error=None):
    if state['finished']:return
    state['finished']=True
    if error:report['error']=error
    try:
        levels.editor_request_end_play()
    finally:
        settings.set_editor_property('PlayNumberOfClients',old)
        system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',old_mode))
        report['play_settings_restored']=True
        u.unregister_slate_post_tick_callback(state['callback'])
        script.call_method('SetKeepPythonScriptAlive',(False,))
        if environment_only:
            report['passed']=not error and len(report['views'])==21
            verify=root/'Verification';verify.mkdir(exist_ok=True)
            (verify/f'EnvironmentRender{width}.json').write_text(json.dumps(report,indent=2)+'\n')
def complete_png(path):
    if not path.exists():return None
    image=path.read_bytes()
    if len(image)<10000 or not image.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'):return None
    assert image[:8]==b'\x89PNG\r\n\x1a\n' and image[12:16]==b'IHDR',str(path)
    assert struct.unpack('>II',image[16:24])==(width,height),str(path)
    return {'dimensions':[width,height],'bytes':len(image),'signature_ihdr_iend_complete':True}
def vec(value):return [round(value.x,5),round(value.y,5),round(value.z,5)]
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
            if not environment_only:
                residents=[a for a in residents if not a.actor_has_tag('CityCrowd')]
                assert len(residents)==len(data['residents']) and len(cars)>=4
            state.update(world=world,pc=pc,camera=camera,residents=residents,car=cars[0])
            c=cars[0].get_actor_location();f=cars[0].get_actor_forward_vector();r=cars[0].get_actor_right_vector()
            if not environment_only:
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
            if environment_only:
                layout=json.loads((root/'Data/LaFontaine/layout.json').read_text())
                p=u.Vector(*layout['spawn'])+u.Vector(0,0,70)
                angle=math.radians(layout['car_yaw']);facing=u.Vector(math.cos(angle),math.sin(angle),0)
                shots.append(('ParkComicSherbrooke',p,p+facing*7000,None))
                shots[:]=[(name.replace('ParkComic','Environment'),p,target,resident) for name,p,target,resident in shots]
                details=json.loads((root/'Data/EnvironmentRefresh/layout.json').read_text())
                city=json.loads((root/'Data/CityBuildings/manifest.json').read_text())
                footprints=[ring for building in city['buildings'] for ring in building['footprints']]
                entries=[front for front in details['sherbrooke_facades'] if front.get('entry')]
                corner_p,corner_target,corner_id=source_facade_view(entries,footprints,data['trees'],layout['spawn'][:2])
                terrace_p,terrace_target=(6253.32,2785.14,230.),(4370.,2900.,140.)
                assert source_camera_clear(terrace_p,terrace_target,footprints,data['trees']), 'Chalet camera obstructed by retained source geometry'
                report['camera_source_checks']={'StreetCorner':{'building':corner_id,'clear':True},'ChaletTerrace':{'clear':True}}
                court=next(c for c in details['courts'] if c['sport']=='tennis')
                sports=u.Vector(*court['center'],0)
                length,a,b=max((math.dist(a,b),a,b) for a,b in zip(court['points'],court['points'][1:]))
                axis=u.Vector((b[0]-a[0])/length,(b[1]-a[1])/length,0)
                closeups=[('EnvironmentStreetCorner',u.Vector(*corner_p),u.Vector(*corner_target),None),
                          ('EnvironmentChaletTerrace',u.Vector(*terrace_p),u.Vector(*terrace_target),None),
                          ('EnvironmentSportsGround',sports-axis*(length*.44)+u.Vector(0,0,180),sports+axis*400+u.Vector(0,0,90),None)]
                for name,street in (('Rachel','Rue Rachel Est'),('ParcLaFontaine','Avenue du Parc-La Fontaine'),('Papineau','Avenue Papineau')):
                    fronts=[f for f in details['street_facades'] if f['street']==street and f.get('entry')]
                    camera_p,camera_target,building_id=source_facade_view(fronts,footprints,data['trees'])
                    closeups.append(('Environment'+name,u.Vector(*camera_p),u.Vector(*camera_target),None))
                    report['camera_source_checks'][name]={'building':building_id,'clear':True}
                volley=next(c for c in details['courts'] if c['sport']=='beachvolleyball')
                center=u.Vector(*volley['center'],0)
                axis=u.Vector(*volley['subcourts'][0]['axis'],0)
                closeups.append(('EnvironmentSandCourts',center-axis*1900+u.Vector(0,0,180),center+axis*250+u.Vector(0,0,130),None))
                shots.extend(closeups)
                shots.extend([(name+'_F2',p,target,resident) for name,p,target,resident in closeups])
                state['comic']=True
                assert len(shots)==21
            state.update(phase=2,ready=now)
        elif state['phase']==2:
            name,p,target,resident=shots[state['shot']]
            if environment_only:
                comic=not name.endswith('_F2')
                if comic!=state['comic']:
                    state['pc'].call_method('ToggleComicStyle')
                    state.update(comic=comic,ready=now)
            if resident:
                p=resident.get_actor_location()+resident.get_actor_forward_vector()*520+resident.get_actor_right_vector()*150+u.Vector(0,0,185)
                target=resident.get_actor_location()+u.Vector(0,0,140)
            aim(p,target)
            if now-state['ready'] > (20 if state['shot']==0 else 5):
                path=out/(name+'.png')
                path.unlink(missing_ok=True)
                u.SystemLibrary.execute_console_command(state['world'],f'HighResShot {width}x{height} filename="{path}"',state['pc'])
                state['capture']={'name':name,'file':str(path.relative_to(root)),
                    'position_cm':vec(p),'target_cm':vec(target),'horizontal_fov_degrees':65.,
                    'comic':state.get('comic',True)}
                state.update(phase=3,ready=now)
            if now-state['ready']>2:state['frames'].append(dt)
        elif state['phase']==3 and now-state['ready']>2:
            path=out/(shots[state['shot']][0]+'.png')
            assert now-state['ready']<20,('Screenshot incomplete or missing',str(path))
            png=complete_png(path)
            if not png:return
            report['views'].append({**state['capture'],'png':png})
            u.log('NORD_PARK_SHOT '+str(path));state['shot']+=1
            if state['shot']==len(shots):
                u.log('NORD_PARK_PREVIEW_OK '+str(len(shots))+' shots');finish()
            else:state.update(phase=2,ready=now)
    except Exception as exc:
        u.log_error('NORD_PARK_PREVIEW_FAILED '+repr(exc));finish(repr(exc))
state['callback']=u.register_slate_post_tick_callback(tick)
